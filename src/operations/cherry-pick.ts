import type { GraphEngine } from '../graph/engine.js';
import type { MessageNode } from '../graph/types.js';

/**
 * Cherry-pick a single node from anywhere in the graph and
 * insert a copy into the target branch.
 *
 * Snapshot semantics: content is copied, new node gets a new ID.
 */
export function cherryPick(
  engine: GraphEngine,
  sourceNodeId: string,
  targetBranch: string
): MessageNode {
  const sourceNode = engine.getNode(sourceNodeId);
  if (!sourceNode) {
    throw new Error(`Source node '${sourceNodeId}' does not exist`);
  }

  const targetLeaf = engine.getBranch(targetBranch);
  if (!targetLeaf) {
    throw new Error(`Target branch '${targetBranch}' does not exist`);
  }

  const newNode = engine.createNode(
    sourceNode.role,
    sourceNode.content,
    [targetLeaf],
    {
      model: sourceNode.model,
      provider: sourceNode.provider,
      tags: [...sourceNode.meta.tags, `cherry-picked-from:${sourceNodeId}`],
    }
  );

  engine.updateBranch(targetBranch, newNode.id);
  return newNode;
}
