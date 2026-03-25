import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/engine.js';
import { branch, branchFrom, merge, cherryPick, rebase, squash } from '../operations/index.js';
import { bisectStart, bisectStep, bisectCurrent } from '../operations/bisect.js';

function createTestGraph() {
  const engine = new GraphEngine('ops-test');
  const root = engine.createNode('system', 'System prompt');
  engine.createBranch('main', root.id);
  engine.appendToBranch('main', 'user', 'Hello');
  engine.appendToBranch('main', 'assistant', 'Hi there!');
  return engine;
}

describe('operations', () => {
  describe('branch', () => {
    it('creates a branch at a fork point', () => {
      const engine = createTestGraph();
      const mainLeaf = engine.getBranch('main')!;
      branch(engine, 'experiment', mainLeaf);
      expect(engine.getBranch('experiment')).toBe(mainLeaf);
    });

    it('forks from existing branch', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'experiment', 'main');
      expect(engine.getBranch('experiment')).toBe(engine.getBranch('main'));
    });
  });

  describe('merge', () => {
    it('merges two branches with concatenate strategy', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'exp', 'main');

      engine.appendToBranch('main', 'user', 'Main path');
      engine.appendToBranch('exp', 'user', 'Experimental path');

      const mergeNode = merge(engine, {
        strategy: 'concatenate',
        targetBranch: 'main',
        sourceBranch: 'exp',
      });

      expect(mergeNode.role).toBe('merge-marker');
      expect(mergeNode.parents).toHaveLength(2);
      expect(engine.getBranch('main')).toBe(mergeNode.id);
    });

    it('merges with synthesize strategy', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'exp', 'main');

      engine.appendToBranch('exp', 'user', 'Different take');

      const mergeNode = merge(engine, {
        strategy: 'synthesize',
        targetBranch: 'main',
        sourceBranch: 'exp',
        synthesizedContent: 'Combined insight from both branches.',
      });

      expect(mergeNode.content).toBe('Combined insight from both branches.');
    });
  });

  describe('cherry-pick', () => {
    it('copies a node to another branch', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'exp', 'main');

      const expMsg = engine.appendToBranch('exp', 'assistant', 'Great insight');
      const mainMsg = engine.appendToBranch('main', 'user', 'Something else');

      const picked = cherryPick(engine, expMsg.id, 'main');

      expect(picked.content).toBe('Great insight');
      expect(picked.id).not.toBe(expMsg.id); // New node, not same reference
      expect(picked.meta.tags).toContain(`cherry-picked-from:${expMsg.id}`);
      expect(engine.getBranch('main')).toBe(picked.id);
    });
  });

  describe('rebase', () => {
    it('replays branch nodes onto new base', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'exp', 'main');

      engine.appendToBranch('exp', 'user', 'Exp Q1');
      engine.appendToBranch('exp', 'assistant', 'Exp A1');

      engine.appendToBranch('main', 'user', 'Main Q1');
      engine.appendToBranch('main', 'assistant', 'Main A1');

      const rebased = rebase(engine, 'exp', 'main');

      expect(rebased).toHaveLength(2);
      expect(rebased[0].content).toBe('Exp Q1');
      expect(rebased[1].content).toBe('Exp A1');
      expect(rebased[0].meta.tags.some(t => t.startsWith('rebased-from:'))).toBe(true);
    });
  });

  describe('squash', () => {
    it('collapses branch into single node', () => {
      const engine = createTestGraph();
      branchFrom(engine, 'exp', 'main');

      engine.appendToBranch('exp', 'user', 'Detailed Q1');
      engine.appendToBranch('exp', 'assistant', 'Detailed A1');
      engine.appendToBranch('exp', 'user', 'Detailed Q2');
      engine.appendToBranch('exp', 'assistant', 'Detailed A2');

      const squashed = squash(engine, {
        branch: 'exp',
        summary: 'Summary of the experiment branch',
      });

      expect(squashed.content).toBe('Summary of the experiment branch');
      expect(squashed.meta.squashedFrom.length).toBeGreaterThan(0);
      expect(squashed.meta.tags).toContain('squashed');
      expect(engine.getBranch('exp')).toBe(squashed.id);
    });
  });

  describe('bisect', () => {
    it('binary searches for divergence point', () => {
      const engine = new GraphEngine('bisect-test');
      const nodes: string[] = [];

      const root = engine.createNode('user', 'Start');
      nodes.push(root.id);

      let parentId = root.id;
      for (let i = 1; i <= 8; i++) {
        const role = i % 2 === 0 ? 'assistant' as const : 'user' as const;
        const node = engine.createNode(role, `Message ${i}`, [parentId]);
        nodes.push(node.id);
        parentId = node.id;
      }

      const goodId = nodes[0]; // Root
      const badId = nodes[8]; // Last node

      const state = bisectStart(engine, goodId, badId);
      expect(state.candidates.length).toBe(8);

      const currentId = bisectCurrent(state);
      expect(currentId).toBeTruthy();

      // Mark middle as good → narrows to second half
      const result = bisectStep(state, 'good');
      expect(result.state.candidates.length).toBeLessThan(state.candidates.length);
    });
  });
});
