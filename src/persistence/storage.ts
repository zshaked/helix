import type { GraphSnapshot } from '../graph/types.js';
import { GraphEngine } from '../graph/engine.js';

/**
 * Abstract storage adapter interface.
 * Implementations can target different backends (filesystem, IndexedDB, SQLite, etc.)
 */
export interface StorageAdapter {
  save(graphId: string, snapshot: GraphSnapshot): Promise<void>;
  load(graphId: string): Promise<GraphSnapshot | null>;
  delete(graphId: string): Promise<void>;
  list(): Promise<string[]>;
}

/**
 * In-memory storage adapter for testing and ephemeral use.
 */
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, GraphSnapshot>();

  async save(graphId: string, snapshot: GraphSnapshot): Promise<void> {
    this.store.set(graphId, JSON.parse(JSON.stringify(snapshot)));
  }

  async load(graphId: string): Promise<GraphSnapshot | null> {
    const snapshot = this.store.get(graphId);
    return snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
  }

  async delete(graphId: string): Promise<void> {
    this.store.delete(graphId);
  }

  async list(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

/**
 * Export a graph to .helix.json format
 */
export function exportHelixJson(engine: GraphEngine): string {
  const snapshot = engine.toSnapshot();
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Import a graph from .helix.json format
 */
export function importHelixJson(json: string): GraphEngine {
  const snapshot: GraphSnapshot = JSON.parse(json);

  if (!snapshot.version || !snapshot.nodes || !snapshot.root) {
    throw new Error('Invalid .helix.json format');
  }

  return GraphEngine.fromSnapshot(snapshot);
}

/**
 * GraphStore manages persistence for multiple conversation graphs.
 */
export class GraphStore {
  constructor(private adapter: StorageAdapter) {}

  async saveGraph(engine: GraphEngine): Promise<void> {
    const snapshot = engine.toSnapshot();
    await this.adapter.save(snapshot.id, snapshot);
  }

  async loadGraph(graphId: string): Promise<GraphEngine | null> {
    const snapshot = await this.adapter.load(graphId);
    if (!snapshot) return null;
    return GraphEngine.fromSnapshot(snapshot);
  }

  async deleteGraph(graphId: string): Promise<void> {
    await this.adapter.delete(graphId);
  }

  async listGraphs(): Promise<string[]> {
    return this.adapter.list();
  }
}
