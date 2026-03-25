export type Role = 'user' | 'assistant' | 'system' | 'merge-marker';

export interface NodeMeta {
  timestamp: number;
  branchLabel: string | null;
  mergeStrategy: string | null;
  parallelGroupId: string | null;
  tags: string[];
  pinned: boolean;
  volatile: boolean;
  squashedFrom: string[];
}

export interface MessageNode {
  id: string;
  role: Role;
  content: string;
  model: string | null;
  provider: string | null;
  parents: string[];
  children: string[];
  meta: NodeMeta;
}

export interface ConversationGraph {
  id: string;
  version: string;
  nodes: Map<string, MessageNode>;
  root: string;
  activeBranches: Record<string, string>; // branch name → leaf node id
}

export interface GraphSnapshot {
  id: string;
  version: string;
  nodes: Record<string, MessageNode>;
  root: string;
  activeBranches: Record<string, string>;
}

export type MergeStrategy = 'concatenate' | 'synthesize' | 'pick-left' | 'pick-right' | 'interleave';

export interface BranchInfo {
  name: string;
  leafId: string;
  length: number;
  forkPoint: string | null;
}

export interface DiffResult {
  onlyInA: MessageNode[];
  onlyInB: MessageNode[];
  common: MessageNode[];
  lca: string | null; // lowest common ancestor
}
