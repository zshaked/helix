import type { GraphEngine } from '../graph/engine.js';
import type { MessageNode } from '../graph/types.js';

/**
 * Rebase a branch onto a new base.
 *
 * Takes the unique nodes of the source branch (after the fork point)
 * and replays them onto the target branch's leaf.
 *
 * Does NOT re-run LLM calls — preserves original responses (snapshot semantics).
 */
export function rebase(
  engine: GraphEngine,
  branchToRebase: string,
  ontoBranch: string
): MessageNode[] {
  const branchLeaf = engine.getBranch(branchToRebase);
  const ontoLeaf = engine.getBranch(ontoBranch);

  if (!branchLeaf || !ontoLeaf) {
    throw new Error('Both branches must exist');
  }

  const lca = engine.findLCA(branchLeaf, ontoLeaf);
  const branchLineage = engine.getLineage(branchLeaf);

  // Get unique nodes after fork point
  const lcaIdx = lca ? branchLineage.findIndex(n => n.id === lca) : -1;
  const uniqueNodes = branchLineage.slice(lcaIdx + 1);

  if (uniqueNodes.length === 0) {
    return [];
  }

  // Replay nodes onto the target
  let currentParent = ontoLeaf;
  const replayedNodes: MessageNode[] = [];

  for (const node of uniqueNodes) {
    const replayed = engine.createNode(
      node.role,
      node.content,
      [currentParent],
      {
        model: node.model,
        provider: node.provider,
        tags: [...node.meta.tags, `rebased-from:${node.id}`],
      }
    );
    replayedNodes.push(replayed);
    currentParent = replayed.id;
  }

  // Update the rebased branch to point at the new leaf
  engine.updateBranch(branchToRebase, currentParent);

  return replayedNodes;
}
