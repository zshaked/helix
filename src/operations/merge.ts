import type { GraphEngine } from '../graph/engine.js';
import type { MergeStrategy, MessageNode } from '../graph/types.js';

export interface MergeOptions {
  strategy: MergeStrategy;
  /** For 'synthesize' strategy, the synthesized content */
  synthesizedContent?: string;
  /** Target branch to merge INTO */
  targetBranch: string;
  /** Source branch to merge FROM */
  sourceBranch: string;
}

/**
 * Merge two branches together, creating a merge-marker node.
 *
 * The merge node has both branch leaves as parents, creating
 * a true DAG merge point.
 */
export function merge(engine: GraphEngine, options: MergeOptions): MessageNode {
  const { strategy, targetBranch, sourceBranch, synthesizedContent } = options;

  const targetLeaf = engine.getBranch(targetBranch);
  const sourceLeaf = engine.getBranch(sourceBranch);

  if (!targetLeaf || !sourceLeaf) {
    throw new Error('Both branches must exist');
  }

  let content: string;

  switch (strategy) {
    case 'concatenate': {
      const sourceLineage = engine.getLineage(sourceLeaf);
      const lca = engine.findLCA(targetLeaf, sourceLeaf);
      const uniqueNodes = lca
        ? sourceLineage.filter(n => {
            // Nodes after LCA
            const lcaIdx = sourceLineage.findIndex(sn => sn.id === lca);
            return sourceLineage.indexOf(n) > lcaIdx;
          })
        : sourceLineage;
      content = uniqueNodes.map(n => `[${n.role}]: ${n.content}`).join('\n\n');
      break;
    }

    case 'synthesize':
      content = synthesizedContent ?? '[Merge: synthesis pending]';
      break;

    case 'pick-left':
      content = `[Merged: kept ${targetBranch}]`;
      break;

    case 'pick-right':
      content = `[Merged: kept ${sourceBranch}]`;
      break;

    case 'interleave': {
      const targetLineage = engine.getLineage(targetLeaf);
      const srcLineage = engine.getLineage(sourceLeaf);
      const lca = engine.findLCA(targetLeaf, sourceLeaf);
      const lcaIdx_t = lca ? targetLineage.findIndex(n => n.id === lca) : -1;
      const lcaIdx_s = lca ? srcLineage.findIndex(n => n.id === lca) : -1;
      const uniqueT = targetLineage.slice(lcaIdx_t + 1);
      const uniqueS = srcLineage.slice(lcaIdx_s + 1);
      const interleaved: string[] = [];
      const maxLen = Math.max(uniqueT.length, uniqueS.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < uniqueT.length) interleaved.push(`[${targetBranch}/${uniqueT[i].role}]: ${uniqueT[i].content}`);
        if (i < uniqueS.length) interleaved.push(`[${sourceBranch}/${uniqueS[i].role}]: ${uniqueS[i].content}`);
      }
      content = interleaved.join('\n\n');
      break;
    }
  }

  const mergeNode = engine.createNode(
    'merge-marker',
    content,
    [targetLeaf, sourceLeaf],
    { mergeStrategy: strategy }
  );

  // Update target branch to point at merge node
  engine.updateBranch(targetBranch, mergeNode.id);

  return mergeNode;
}
