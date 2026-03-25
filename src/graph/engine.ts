import { generateId, generateGraphId } from './id.js';
import type {
  MessageNode,
  ConversationGraph,
  Role,
  NodeMeta,
  BranchInfo,
  DiffResult,
  GraphSnapshot,
} from './types.js';

export class GraphEngine {
  private graph: ConversationGraph;

  constructor(graphId?: string) {
    this.graph = {
      id: graphId ?? generateGraphId(),
      version: '0.1.0',
      nodes: new Map(),
      root: '',
      activeBranches: {},
    };
  }

  // --- Node Creation ---

  createNode(
    role: Role,
    content: string,
    parentIds: string[] = [],
    options: Partial<Pick<MessageNode, 'model' | 'provider'>> & Partial<NodeMeta> = {}
  ): MessageNode {
    const id = generateId();
    const node: MessageNode = {
      id,
      role,
      content,
      model: options.model ?? null,
      provider: options.provider ?? null,
      parents: [...parentIds],
      children: [],
      meta: {
        timestamp: Date.now(),
        branchLabel: options.branchLabel ?? null,
        mergeStrategy: options.mergeStrategy ?? null,
        parallelGroupId: options.parallelGroupId ?? null,
        tags: options.tags ?? [],
        pinned: options.pinned ?? false,
        volatile: options.volatile ?? false,
        squashedFrom: options.squashedFrom ?? [],
      },
    };

    this.graph.nodes.set(id, node);

    // Wire parent → child edges
    for (const pid of parentIds) {
      const parent = this.graph.nodes.get(pid);
      if (parent) {
        parent.children.push(id);
      }
    }

    // If no root, this is root
    if (!this.graph.root) {
      this.graph.root = id;
    }

    return node;
  }

  addNode(node: MessageNode): void {
    this.graph.nodes.set(node.id, node);
    for (const pid of node.parents) {
      const parent = this.graph.nodes.get(pid);
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }
    if (!this.graph.root) {
      this.graph.root = node.id;
    }
  }

  getNode(id: string): MessageNode | undefined {
    return this.graph.nodes.get(id);
  }

  getRoot(): MessageNode | undefined {
    return this.graph.nodes.get(this.graph.root);
  }

  // --- Lineage ---

  /** Walk from a node back to root, following first parent at each step */
  getLineage(leafId: string): MessageNode[] {
    const lineage: MessageNode[] = [];
    let current = this.graph.nodes.get(leafId);
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      lineage.unshift(current);
      if (current.parents.length === 0) break;
      current = this.graph.nodes.get(current.parents[0]);
    }

    return lineage;
  }

  /** Get full lineage including all parents (BFS from root, topological order) */
  getFullLineage(leafId: string): MessageNode[] {
    // First, collect all ancestors
    const ancestors = new Set<string>();
    const queue: string[] = [leafId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (ancestors.has(nodeId)) continue;
      ancestors.add(nodeId);
      const node = this.graph.nodes.get(nodeId);
      if (node) {
        for (const pid of node.parents) {
          queue.push(pid);
        }
      }
    }

    // Topological sort of ancestors
    return this.topologicalSort().filter(n => ancestors.has(n.id));
  }

  /** Topological sort of all nodes (Kahn's algorithm) */
  topologicalSort(): MessageNode[] {
    const inDegree = new Map<string, number>();
    for (const [id, node] of this.graph.nodes) {
      inDegree.set(id, node.parents.length);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: MessageNode[] = [];
    while (queue.length > 0) {
      // Sort by timestamp for deterministic ordering
      queue.sort((a, b) => {
        const na = this.graph.nodes.get(a)!;
        const nb = this.graph.nodes.get(b)!;
        return na.meta.timestamp - nb.meta.timestamp;
      });

      const nodeId = queue.shift()!;
      const node = this.graph.nodes.get(nodeId)!;
      sorted.push(node);

      for (const childId of node.children) {
        const deg = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, deg);
        if (deg === 0) queue.push(childId);
      }
    }

    return sorted;
  }

  // --- Branch Management ---

  createBranch(name: string, leafId: string): void {
    if (this.graph.activeBranches[name]) {
      throw new Error(`Branch '${name}' already exists`);
    }
    this.graph.activeBranches[name] = leafId;
  }

  switchBranch(name: string): string {
    const leafId = this.graph.activeBranches[name];
    if (!leafId) {
      throw new Error(`Branch '${name}' does not exist`);
    }
    return leafId;
  }

  getBranch(name: string): string | undefined {
    return this.graph.activeBranches[name];
  }

  updateBranch(name: string, leafId: string): void {
    this.graph.activeBranches[name] = leafId;
  }

  deleteBranch(name: string): void {
    if (!this.graph.activeBranches[name]) {
      throw new Error(`Branch '${name}' does not exist`);
    }
    delete this.graph.activeBranches[name];
  }

  listBranches(): BranchInfo[] {
    return Object.entries(this.graph.activeBranches).map(([name, leafId]) => {
      const lineage = this.getLineage(leafId);
      const forkPoint = this.findForkPointFromRoot(leafId);
      return {
        name,
        leafId,
        length: lineage.length,
        forkPoint,
      };
    });
  }

  private findForkPointFromRoot(leafId: string): string | null {
    const lineage = this.getLineage(leafId);
    for (let i = lineage.length - 1; i >= 0; i--) {
      if (lineage[i].children.length > 1) {
        return lineage[i].id;
      }
    }
    return null;
  }

  // --- Lowest Common Ancestor ---

  findLCA(nodeA: string, nodeB: string): string | null {
    const ancestorsA = new Set<string>();
    let queue: string[] = [nodeA];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (ancestorsA.has(id)) continue;
      ancestorsA.add(id);
      const node = this.graph.nodes.get(id);
      if (node) {
        queue.push(...node.parents);
      }
    }

    // BFS from nodeB, first hit in ancestorsA is LCA
    queue = [nodeB];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (ancestorsA.has(id)) return id;
      const node = this.graph.nodes.get(id);
      if (node) {
        queue.push(...node.parents);
      }
    }

    return null;
  }

  // --- Diff ---

  diff(branchA: string, branchB: string): DiffResult {
    const leafA = this.graph.activeBranches[branchA];
    const leafB = this.graph.activeBranches[branchB];
    if (!leafA || !leafB) {
      throw new Error('Both branches must exist');
    }

    const lineageA = this.getLineage(leafA);
    const lineageB = this.getLineage(leafB);
    const setA = new Set(lineageA.map(n => n.id));
    const setB = new Set(lineageB.map(n => n.id));

    const lca = this.findLCA(leafA, leafB);

    return {
      onlyInA: lineageA.filter(n => !setB.has(n.id)),
      onlyInB: lineageB.filter(n => !setA.has(n.id)),
      common: lineageA.filter(n => setB.has(n.id)),
      lca,
    };
  }

  // --- Append to branch (convenience) ---

  appendToBranch(
    branchName: string,
    role: Role,
    content: string,
    options: Partial<Pick<MessageNode, 'model' | 'provider'>> = {}
  ): MessageNode {
    const leafId = this.graph.activeBranches[branchName];
    if (!leafId) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    const node = this.createNode(role, content, [leafId], options);
    this.graph.activeBranches[branchName] = node.id;
    return node;
  }

  // --- Graph Stats ---

  get nodeCount(): number {
    return this.graph.nodes.size;
  }

  get graphId(): string {
    return this.graph.id;
  }

  get rootId(): string {
    return this.graph.root;
  }

  getAllNodes(): MessageNode[] {
    return Array.from(this.graph.nodes.values());
  }

  // --- Serialization ---

  toSnapshot(): GraphSnapshot {
    const nodesRecord: Record<string, MessageNode> = {};
    for (const [id, node] of this.graph.nodes) {
      nodesRecord[id] = { ...node, meta: { ...node.meta, tags: [...node.meta.tags], squashedFrom: [...node.meta.squashedFrom] } };
    }
    return {
      id: this.graph.id,
      version: this.graph.version,
      nodes: nodesRecord,
      root: this.graph.root,
      activeBranches: { ...this.graph.activeBranches },
    };
  }

  static fromSnapshot(snapshot: GraphSnapshot): GraphEngine {
    const engine = new GraphEngine(snapshot.id);
    for (const [id, node] of Object.entries(snapshot.nodes)) {
      engine.graph.nodes.set(id, {
        ...node,
        parents: [...node.parents],
        children: [...node.children],
        meta: { ...node.meta, tags: [...node.meta.tags], squashedFrom: [...node.meta.squashedFrom] },
      });
    }
    engine.graph.root = snapshot.root;
    engine.graph.version = snapshot.version;
    engine.graph.activeBranches = { ...snapshot.activeBranches };
    return engine;
  }
}
