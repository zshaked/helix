import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/engine.js';
import { MemoryStorage, GraphStore, exportHelixJson, importHelixJson } from '../persistence/storage.js';

describe('persistence', () => {
  describe('MemoryStorage', () => {
    it('saves and loads a graph snapshot', async () => {
      const storage = new MemoryStorage();
      const engine = new GraphEngine('persist-test');
      const root = engine.createNode('user', 'Hello');
      engine.createBranch('main', root.id);
      engine.appendToBranch('main', 'assistant', 'Hi!');

      const snapshot = engine.toSnapshot();
      await storage.save(snapshot.id, snapshot);

      const loaded = await storage.load(snapshot.id);
      expect(loaded).toBeTruthy();
      expect(loaded!.id).toBe('persist-test');
      expect(Object.keys(loaded!.nodes)).toHaveLength(2);
    });

    it('lists stored graphs', async () => {
      const storage = new MemoryStorage();
      await storage.save('g1', { id: 'g1', version: '0.1.0', nodes: {}, root: '', activeBranches: {} });
      await storage.save('g2', { id: 'g2', version: '0.1.0', nodes: {}, root: '', activeBranches: {} });

      const list = await storage.list();
      expect(list).toContain('g1');
      expect(list).toContain('g2');
    });

    it('deletes a graph', async () => {
      const storage = new MemoryStorage();
      await storage.save('g1', { id: 'g1', version: '0.1.0', nodes: {}, root: '', activeBranches: {} });
      await storage.delete('g1');

      const loaded = await storage.load('g1');
      expect(loaded).toBeNull();
    });
  });

  describe('GraphStore', () => {
    it('round-trips a graph engine', async () => {
      const store = new GraphStore(new MemoryStorage());
      const engine = new GraphEngine('store-test');
      const root = engine.createNode('system', 'System prompt');
      engine.createBranch('main', root.id);
      engine.appendToBranch('main', 'user', 'Question');
      engine.appendToBranch('main', 'assistant', 'Answer');

      await store.saveGraph(engine);
      const loaded = await store.loadGraph('store-test');

      expect(loaded).toBeTruthy();
      expect(loaded!.nodeCount).toBe(3);
      expect(loaded!.getBranch('main')).toBe(engine.getBranch('main'));
    });
  });

  describe('helix.json export/import', () => {
    it('exports and imports .helix.json', () => {
      const engine = new GraphEngine('export-test');
      const root = engine.createNode('user', 'Start');
      engine.createBranch('main', root.id);
      engine.appendToBranch('main', 'assistant', 'Response');

      const json = exportHelixJson(engine);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('0.1.0');
      expect(parsed.id).toBe('export-test');

      const imported = importHelixJson(json);
      expect(imported.nodeCount).toBe(2);
      expect(imported.graphId).toBe('export-test');
    });
  });
});
