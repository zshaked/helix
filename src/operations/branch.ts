import type { GraphEngine } from '../graph/engine.js';

/**
 * Fork a new branch from any node in the graph.
 * The new branch points at the given forkPoint node.
 */
export function branch(engine: GraphEngine, branchName: string, forkPointId: string): void {
  const node = engine.getNode(forkPointId);
  if (!node) {
    throw new Error(`Node '${forkPointId}' does not exist`);
  }
  engine.createBranch(branchName, forkPointId);
}

/**
 * Fork from the current leaf of an existing branch.
 */
export function branchFrom(engine: GraphEngine, newBranch: string, sourceBranch: string): void {
  const leafId = engine.getBranch(sourceBranch);
  if (!leafId) {
    throw new Error(`Source branch '${sourceBranch}' does not exist`);
  }
  engine.createBranch(newBranch, leafId);
}
