import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/engine.js';

describe('GraphEngine', () => {
  function createTestGraph() {
    const engine = new GraphEngine('test-graph');
    const root = engine.createNode('system', 'You are a helpful assistant.');
    engine.createBranch('main', root.id);
    return { engine, root };
  }

  describe('node creation', () => {
    it('creates a root node', () => {
      const engine = new GraphEngine();
      const node = engine.createNode('system', 'Hello');
      expect(node.role).toBe('system');
      expect(node.content).toBe('Hello');
      expect(node.parents).toEqual([]);
      expect(engine.rootId).toBe(node.id);
    });

    it('links parent and child nodes', () => {
      const engine = new GraphEngine();
      const parent = engine.createNode('user', 'Question');
      const child = engine.createNode('assistant', 'Answer', [parent.id]);
      expect(child.parents).toEqual([parent.id]);
      expect(engine.getNode(parent.id)!.children).toContain(child.id);
    });

    it('supports multiple parents (DAG merge)', () => {
      const engine = new GraphEngine();
      const root = engine.createNode('user', 'Start');
      const branchA = engine.createNode('assistant', 'Path A', [root.id]);
      const branchB = engine.createNode('assistant', 'Path B', [root.id]);
      const mergeNode = engine.createNode('merge-marker', 'Merged', [branchA.id, branchB.id]);

      expect(mergeNode.parents).toEqual([branchA.id, branchB.id]);
      expect(engine.getNode(branchA.id)!.children).toContain(mergeNode.id);
      expect(engine.getNode(branchB.id)!.children).toContain(mergeNode.id);
    });
  });

  describe('lineage', () => {
    it('walks lineage from leaf to root', () => {
      const { engine, root } = createTestGraph();
      const msg1 = engine.createNode('user', 'Q1', [root.id]);
      const msg2 = engine.createNode('assistant', 'A1', [msg1.id]);
      const msg3 = engine.createNode('user', 'Q2', [msg2.id]);

      const lineage = engine.getLineage(msg3.id);
      expect(lineage.map(n => n.content)).toEqual([
        'You are a helpful assistant.',
        'Q1',
        'A1',
        'Q2',
      ]);
    });

    it('topological sort orders correctly', () => {
      const engine = new GraphEngine();
      const root = engine.createNode('user', 'Root');
      const a = engine.createNode('assistant', 'A', [root.id]);
      const b = engine.createNode('assistant', 'B', [root.id]);
      const merge = engine.createNode('merge-marker', 'M', [a.id, b.id]);

      const sorted = engine.topologicalSort();
      const rootIdx = sorted.findIndex(n => n.id === root.id);
      const aIdx = sorted.findIndex(n => n.id === a.id);
      const bIdx = sorted.findIndex(n => n.id === b.id);
      const mergeIdx = sorted.findIndex(n => n.id === merge.id);

      expect(rootIdx).toBeLessThan(aIdx);
      expect(rootIdx).toBeLessThan(bIdx);
      expect(aIdx).toBeLessThan(mergeIdx);
      expect(bIdx).toBeLessThan(mergeIdx);
    });
  });

  describe('branches', () => {
    it('creates and switches branches', () => {
      const { engine, root } = createTestGraph();
      const msg = engine.createNode('user', 'Fork point', [root.id]);

      engine.createBranch('experiment', msg.id);
      expect(engine.switchBranch('experiment')).toBe(msg.id);
    });

    it('throws on duplicate branch', () => {
      const { engine, root } = createTestGraph();
      expect(() => engine.createBranch('main', root.id)).toThrow();
    });

    it('appends to a branch', () => {
      const { engine } = createTestGraph();
      const msg = engine.appendToBranch('main', 'user', 'Hello');
      expect(msg.role).toBe('user');
      expect(engine.getBranch('main')).toBe(msg.id);
    });

    it('lists branches with info', () => {
      const { engine, root } = createTestGraph();
      engine.appendToBranch('main', 'user', 'Q1');
      engine.appendToBranch('main', 'assistant', 'A1');

      const branches = engine.listBranches();
      expect(branches).toHaveLength(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].length).toBe(3); // system + Q1 + A1
    });
  });

  describe('LCA', () => {
    it('finds lowest common ancestor', () => {
      const engine = new GraphEngine();
      const root = engine.createNode('user', 'Root');
      const a = engine.createNode('assistant', 'A', [root.id]);
      const b = engine.createNode('assistant', 'B', [root.id]);
      const a2 = engine.createNode('user', 'A2', [a.id]);
      const b2 = engine.createNode('user', 'B2', [b.id]);

      expect(engine.findLCA(a2.id, b2.id)).toBe(root.id);
    });

    it('handles direct ancestor case', () => {
      const engine = new GraphEngine();
      const root = engine.createNode('user', 'Root');
      const child = engine.createNode('assistant', 'Child', [root.id]);
      const grandchild = engine.createNode('user', 'Grandchild', [child.id]);

      expect(engine.findLCA(child.id, grandchild.id)).toBe(child.id);
    });
  });

  describe('diff', () => {
    it('diffs two branches', () => {
      const engine = new GraphEngine();
      const root = engine.createNode('user', 'Root');
      engine.createBranch('main', root.id);

      const a = engine.appendToBranch('main', 'assistant', 'Shared');
      engine.createBranch('exp', a.id);

      engine.appendToBranch('main', 'user', 'Main only');
      engine.appendToBranch('exp', 'user', 'Exp only');

      const diff = engine.diff('main', 'exp');
      expect(diff.onlyInA).toHaveLength(1);
      expect(diff.onlyInB).toHaveLength(1);
      expect(diff.common).toHaveLength(2); // root + shared
      expect(diff.lca).toBe(a.id);
    });
  });

  describe('serialization', () => {
    it('round-trips through snapshot', () => {
      const { engine } = createTestGraph();
      engine.appendToBranch('main', 'user', 'Question');
      engine.appendToBranch('main', 'assistant', 'Answer');

      const snapshot = engine.toSnapshot();
      const restored = GraphEngine.fromSnapshot(snapshot);

      expect(restored.nodeCount).toBe(engine.nodeCount);
      expect(restored.graphId).toBe(engine.graphId);
      expect(restored.getBranch('main')).toBe(engine.getBranch('main'));
    });
  });
});
