// Core graph engine
export { GraphEngine } from './graph/index.js';
export type {
  MessageNode,
  ConversationGraph,
  GraphSnapshot,
  Role,
  NodeMeta,
  MergeStrategy,
  BranchInfo,
  DiffResult,
} from './graph/index.js';
export { generateId, generateGraphId } from './graph/index.js';

// Canonical message builder
export { buildCanonicalMessages } from './canonical/index.js';
export type { CanonicalMessage, BuildOptions } from './canonical/index.js';

// Git-like operations
export {
  branch,
  branchFrom,
  merge,
  cherryPick,
  rebase,
  squash,
  bisectStart,
  bisectStep,
  bisectCurrent,
} from './operations/index.js';
export type { MergeOptions, SquashOptions, BisectState, BisectVerdict } from './operations/index.js';

// Persistence
export { MemoryStorage, GraphStore, exportHelixJson, importHelixJson } from './persistence/index.js';
export type { StorageAdapter } from './persistence/index.js';

// Provider registry
export { ProviderRegistry, AnthropicAdapter, OpenAIAdapter } from './providers/index.js';
export type {
  ProviderAdapter,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from './providers/index.js';
