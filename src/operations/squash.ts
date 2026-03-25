import type { GraphEngine } from '../graph/engine.js';
import type { MessageNode } from '../graph/types.js';

export interface SquashOptions {
  branch: string;
  /** Summary content. If not provided, auto-concatenates. */
  summary?: string;
  /** Role for the squashed node */
  role?: 'user' | 'assistant' | 'system';
}

/**
 * Squash a branch into a single summary node.
 *
 * Collapses all unique nodes (after the fork point from main lineage)
 * into a single node. The original node IDs are stored in meta.squashedFrom
 * for audit trail.
 */
export function squash(engine: GraphEngine, options: SquashOptions): MessageNode {
  const { branch: branchName, summary, role = 'assistant' } = options;

  const leafId = engine.getBranch(branchName);
  if (!leafId) {
    throw new Error(`Branch '${branchName}' does not exist`);
  }

  const lineage = engine.getLineage(leafId);

  if (lineage.length === 0) {
    throw new Error('Branch has no nodes');
  }

  // Find fork point (first node with multiple children or root)
  let forkIdx = 0;
  for (let i = 0; i < lineage.length; i++) {
    if (lineage[i].children.length > 1) {
      forkIdx = i;
      break;
    }
  }

  const uniqueNodes = lineage.slice(forkIdx + 1);
  if (uniqueNodes.length === 0) {
    throw new Error('Nothing to squash');
  }

  const squashedContent = summary ??
    uniqueNodes.map(n => `[${n.role}]: ${n.content}`).join('\n\n');

  const forkNode = lineage[forkIdx];
  const squashedNode = engine.createNode(
    role,
    squashedContent,
    [forkNode.id],
    {
      squashedFrom: uniqueNodes.map(n => n.id),
      tags: ['squashed'],
    }
  );

  engine.updateBranch(branchName, squashedNode.id);
  return squashedNode;
}
