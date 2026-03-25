import type { GraphEngine } from '../graph/engine.js';
import type { MessageNode } from '../graph/types.js';

export type BisectVerdict = 'good' | 'bad' | 'skip';

export interface BisectState {
  goodId: string;
  badId: string;
  candidates: string[];
  currentIdx: number;
  history: Array<{ nodeId: string; verdict: BisectVerdict }>;
}

/**
 * Initialize a bisect session to find where a conversation diverged from intent.
 *
 * User marks a "good" node (where things were fine) and a "bad" node
 * (where things went wrong). Bisect narrows the divergence point
 * via binary search through the lineage.
 */
export function bisectStart(
  engine: GraphEngine,
  goodId: string,
  badId: string
): BisectState {
  const good = engine.getNode(goodId);
  const bad = engine.getNode(badId);

  if (!good || !bad) {
    throw new Error('Both good and bad nodes must exist');
  }

  const lineage = engine.getLineage(badId);
  const goodIdx = lineage.findIndex(n => n.id === goodId);

  if (goodIdx === -1) {
    throw new Error('Good node must be an ancestor of bad node');
  }

  const candidates = lineage.slice(goodIdx + 1).map(n => n.id);
  const midIdx = Math.floor(candidates.length / 2);

  return {
    goodId,
    badId,
    candidates,
    currentIdx: midIdx,
    history: [],
  };
}

/**
 * Process a verdict for the current bisect candidate.
 * Returns the updated state and the next node to evaluate,
 * or null if bisect is complete.
 */
export function bisectStep(
  state: BisectState,
  verdict: BisectVerdict
): { state: BisectState; currentNodeId: string | null; found: string | null } {
  const currentNodeId = state.candidates[state.currentIdx];

  const newHistory = [...state.history, { nodeId: currentNodeId, verdict }];

  if (verdict === 'skip') {
    // Move to next candidate
    const nextIdx = state.currentIdx + 1 < state.candidates.length
      ? state.currentIdx + 1
      : state.currentIdx - 1;

    if (nextIdx < 0 || nextIdx >= state.candidates.length) {
      return { state: { ...state, history: newHistory }, currentNodeId: null, found: currentNodeId };
    }

    return {
      state: { ...state, currentIdx: nextIdx, history: newHistory },
      currentNodeId: state.candidates[nextIdx],
      found: null,
    };
  }

  let newCandidates: string[];
  if (verdict === 'good') {
    // Divergence is after this point
    newCandidates = state.candidates.slice(state.currentIdx + 1);
  } else {
    // Divergence is at or before this point
    newCandidates = state.candidates.slice(0, state.currentIdx + 1);
  }

  if (newCandidates.length <= 1) {
    const found = newCandidates[0] ?? currentNodeId;
    return {
      state: { ...state, candidates: newCandidates, history: newHistory },
      currentNodeId: null,
      found,
    };
  }

  const nextIdx = Math.floor(newCandidates.length / 2);

  return {
    state: {
      ...state,
      candidates: newCandidates,
      currentIdx: nextIdx,
      history: newHistory,
    },
    currentNodeId: newCandidates[nextIdx],
    found: null,
  };
}

/**
 * Get the current node to evaluate in a bisect session.
 */
export function bisectCurrent(state: BisectState): string {
  return state.candidates[state.currentIdx];
}
