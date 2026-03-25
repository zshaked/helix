import type { GraphEngine } from '../graph/engine.js';
import type { MessageNode, Role } from '../graph/types.js';

export interface CanonicalMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  nodeId: string;
  model: string | null;
  provider: string | null;
}

export interface BuildOptions {
  /** Max messages to include (most recent kept) */
  maxMessages?: number;
  /** Include system messages */
  includeSystem?: boolean;
  /** Insert pruning markers when messages are dropped */
  insertPruneMarkers?: boolean;
}

/**
 * Builds a canonical (provider-ready) message list from a DAG lineage.
 * - Walks lineage from root to leaf
 * - Enforces alternating user/assistant roles
 * - Coalesces consecutive same-role messages
 * - Handles merge-marker nodes
 */
export function buildCanonicalMessages(
  engine: GraphEngine,
  leafId: string,
  options: BuildOptions = {}
): CanonicalMessage[] {
  const { maxMessages, includeSystem = true, insertPruneMarkers = false } = options;

  const lineage = engine.getFullLineage(leafId);

  // Filter and map nodes to canonical roles
  const raw: CanonicalMessage[] = [];
  for (const node of lineage) {
    if (node.role === 'merge-marker') {
      // Merge markers become system messages with merge context
      if (includeSystem) {
        raw.push({
          role: 'system',
          content: node.content || '[Branches merged]',
          nodeId: node.id,
          model: node.model,
          provider: node.provider,
        });
      }
      continue;
    }

    if (node.role === 'system' && !includeSystem) continue;

    raw.push({
      role: node.role as 'user' | 'assistant' | 'system',
      content: node.content,
      nodeId: node.id,
      model: node.model,
      provider: node.provider,
    });
  }

  // Coalesce consecutive same-role messages
  const coalesced = coalesceMessages(raw);

  // Enforce alternating user/assistant (system can appear anywhere)
  const alternating = enforceAlternating(coalesced);

  // Apply max messages limit
  if (maxMessages && alternating.length > maxMessages) {
    const keepCount = insertPruneMarkers ? maxMessages - 1 : maxMessages;
    const dropped = alternating.length - keepCount;
    const pruned = alternating.slice(alternating.length - keepCount);
    if (insertPruneMarkers) {
      pruned.unshift({
        role: 'system',
        content: `[context pruned: ${dropped} messages omitted]`,
        nodeId: '__pruned__',
        model: null,
        provider: null,
      });
    }
    return pruned;
  }

  return alternating;
}

function coalesceMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  if (messages.length === 0) return [];

  const result: CanonicalMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];

    if (curr.role === prev.role && curr.role !== 'system') {
      // Coalesce: append content
      prev.content += '\n\n' + curr.content;
    } else {
      result.push(curr);
    }
  }

  return result;
}

function enforceAlternating(messages: CanonicalMessage[]): CanonicalMessage[] {
  if (messages.length === 0) return [];

  const result: CanonicalMessage[] = [];
  let lastNonSystemRole: 'user' | 'assistant' | null = null;

  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push(msg);
      continue;
    }

    if (lastNonSystemRole === msg.role) {
      // Same role back-to-back after coalescing — this shouldn't happen
      // but if it does, coalesce again
      const prev = findLastNonSystem(result);
      if (prev) {
        prev.content += '\n\n' + msg.content;
        continue;
      }
    }

    result.push(msg);
    lastNonSystemRole = msg.role;
  }

  return result;
}

function findLastNonSystem(messages: CanonicalMessage[]): CanonicalMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'system') return messages[i];
  }
  return null;
}
