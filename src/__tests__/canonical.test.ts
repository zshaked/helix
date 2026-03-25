import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/engine.js';
import { buildCanonicalMessages } from '../canonical/builder.js';

describe('buildCanonicalMessages', () => {
  it('builds linear message list from lineage', () => {
    const engine = new GraphEngine();
    const sys = engine.createNode('system', 'You are helpful.');
    const q1 = engine.createNode('user', 'What is 2+2?', [sys.id]);
    const a1 = engine.createNode('assistant', '4', [q1.id]);

    const messages = buildCanonicalMessages(engine, a1.id);
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('coalesces consecutive same-role messages', () => {
    const engine = new GraphEngine();
    const u1 = engine.createNode('user', 'Part 1');
    const u2 = engine.createNode('user', 'Part 2', [u1.id]);
    const a1 = engine.createNode('assistant', 'Response', [u2.id]);

    const messages = buildCanonicalMessages(engine, a1.id);
    expect(messages).toHaveLength(2); // coalesced user + assistant
    expect(messages[0].content).toContain('Part 1');
    expect(messages[0].content).toContain('Part 2');
  });

  it('handles merge-marker nodes', () => {
    const engine = new GraphEngine();
    const root = engine.createNode('user', 'Start');
    const a = engine.createNode('assistant', 'Branch A', [root.id]);
    const b = engine.createNode('assistant', 'Branch B', [root.id]);
    const mergeNode = engine.createNode('merge-marker', 'Merged result', [a.id, b.id]);
    const follow = engine.createNode('user', 'Continue', [mergeNode.id]);

    const messages = buildCanonicalMessages(engine, follow.id);
    const systemMsgs = messages.filter(m => m.role === 'system');
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it('respects maxMessages limit', () => {
    const engine = new GraphEngine();
    let parent = engine.createNode('user', 'Q1');
    for (let i = 0; i < 10; i++) {
      const role = i % 2 === 0 ? 'assistant' as const : 'user' as const;
      parent = engine.createNode(role, `Msg ${i}`, [parent.id]);
    }

    const messages = buildCanonicalMessages(engine, parent.id, { maxMessages: 4 });
    expect(messages.length).toBeLessThanOrEqual(4);
  });

  it('inserts prune markers when enabled', () => {
    const engine = new GraphEngine();
    let parent = engine.createNode('user', 'Q1');
    for (let i = 0; i < 10; i++) {
      const role = i % 2 === 0 ? 'assistant' as const : 'user' as const;
      parent = engine.createNode(role, `Msg ${i}`, [parent.id]);
    }

    const messages = buildCanonicalMessages(engine, parent.id, {
      maxMessages: 4,
      insertPruneMarkers: true,
    });

    const pruneMarker = messages.find(m => m.content.includes('context pruned'));
    expect(pruneMarker).toBeTruthy();
    expect(messages.length).toBe(4); // prune marker + 3 kept messages = maxMessages
  });
});
