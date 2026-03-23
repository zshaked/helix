# Helix — Full Feature Spec & Agent Build Plan

## System Identity

Helix is a conversation graph engine. The core primitive is a provider-agnostic DAG where messages are nodes, edges encode conversational lineage, and merge nodes enable context synthesis across branches. Models are stateless executors called against lineage projections.

---

## Phase 1: Core Graph Engine (Foundation)

### 1.1 Graph Data Structure

```typescript
interface MessageNode {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'merge-marker';
  content: string;
  model: string | null;
  provider: string | null;
  parents: string[];           // THE key design decision
  children: string[];
  meta: {
    timestamp: number;
    branchLabel: string | null;
    mergeStrategy: string | null;
    parallelGroupId: string | null;
    tags: string[];
    pinned: boolean;
    volatile: boolean;
    squashedFrom: string[];
  };
}

interface ConversationGraph {
  id: string;
  version: string;
  nodes: Map<string, MessageNode>;
  root: string;
  activeBranches: Record<string, string>;  // branch name → leaf node id
}
```

### 1.2 Persistence Layer
- Serialize full graph to IndexedDB (browser) or SQLite (server/CLI)
- Key structure: `helix:graph:{graphId}` for node data, `helix:meta:{graphId}` for metadata
- Auto-save on every graph mutation
- Support multiple named graphs (like git repos)
- Import/export as `.helix.json` files

### 1.3 Named Branches
- Branch labels: `main`, `debug-session`, `creative-direction-b`
- `activeBranches` map: branch name → current leaf node
- Switch between named branches instantly

### 1.4 Canonical Message Builder
- Walk lineage from root to current leaf
- Enforce alternating user/assistant roles per provider requirements
- Coalesce consecutive same-role messages
- Handle merge-marker nodes without breaking role alternation

---

## Phase 2: Git Operations

### 2.1 Cherry-Pick
- Select a single node from Branch A
- Insert into Branch B's lineage as a new node (snapshot semantics — content copied)
- UI: right-click node → "Cherry-pick to [branch]"

### 2.2 Rebase
- Take a branch's unique nodes (after fork point) and replay on a new base
- Does NOT re-run LLM calls by default (preserves original responses)
- Optional: re-generate assistant responses against new context

### 2.3 Squash
- Collapse a branch into a single summary node via LLM call
- Meta records `squashedFrom: [original_node_ids]` for audit trail
- Critical for token management on long conversations

### 2.4 Bisect
- Binary search through lineage to find where conversation diverged from intent
- User marks "good" and "bad" endpoints, bisect narrows the divergence point

### 2.5 Stash
- Save uncommitted input + branch state without creating a node
- Restore later for quick context switching

---

## Phase 3: Intelligence Layer

### 3.1 Semantic Conflict Detection
1. Extract assertions from each branch via LLM call
2. Embed assertions, compare cosine similarity across branches
3. Flag pairs with high similarity but opposing polarity as conflicts
4. Present conflicts to user before merge with resolution options
5. Feed resolution into merge synthesis prompt

### 3.2 Auto-Branch Suggestion
- Embed each message, compute cosine similarity with running conversation centroid
- When similarity drops below threshold → suggest branch
- Detects topic divergence and contradictory question patterns

### 3.3 Context Relevance Pruning
- Before API calls, score each node's relevance to current query via embedding similarity
- Drop nodes below threshold, preserving chronological coherence
- Insert `[context pruned: N messages omitted]` markers

### 3.4 Branch Summarization on Idle
- Auto-generate summaries for inactive branches
- Display in sidebar for quick scanning

### 3.5 Volatile Nodes
- Branches marked volatile auto-delete after session end
- LLM summarizes before deletion; summary merges upstream or is discarded

---

## Phase 4: Multi-Agent & Council

### 4.1 Enhanced Council
- **Weighted voting** — judge model scores responses on relevance, accuracy, completeness
- **Iterative council (Delphi method)** — multiple rounds where models see each other's responses
- **Selective merge** — user picks which parts of which responses to include

### 4.2 Debate Mode
- Two models argue opposing sides (2-3 rounds)
- Each model sees the other's arguments and responds
- Judge model or user synthesizes conclusion
- Structure: alternating branches from shared root with final merge node

### 4.3 Specialist Routing
- Auto-route branches to appropriate models based on content
- Code → coding model, creative → creative model, facts → search-enabled model

### 4.4 Agent-as-Branch
- Autonomous agent runs as a branch; each step is a node
- On completion, branch merges back into main conversation
- An AOP workflow IS a branch in the conversation DAG

---

## Phase 5: Visualization

### 5.1 DAG View
- Sugiyama or force-directed layout
- Color-code by provider/model
- Collapse/expand subtrees
- Minimap for large graphs
- Click-to-navigate

### 5.2 Diff View
- Side-by-side comparison of two branches
- Show LCA (common ancestor) as baseline
- Semantic diff: what each branch knows that the other doesn't

### 5.3 Timeline View
- Horizontal timeline showing all nodes chronologically regardless of branch
- Color-coded by branch

---

## Phase 6: Ecosystem

### 6.1 Provider Adapters
- Anthropic, OpenAI, Google, Ollama, OpenRouter, Custom webhook
- Each handles: auth, rate limiting, streaming, error recovery, wire format

### 6.2 MCP Integration
- Expose graph operations as MCP tools
- Other agents can create branches, merge, query lineages

### 6.3 Export Formats
- `.helix.json` — full graph (native)
- Markdown — linearized branch export
- HTML — standalone rendered view
- Mermaid — graph structure as diagram code

### 6.4 CLI
```bash
helix new "project-name"
helix branch "experiment-a"
helix switch "main"
helix merge "experiment-a" --strategy synthesize
helix squash "experiment-a" --summarize
helix diff "main" "experiment-a"
helix council "What approach?" --models sonnet,gpt4o,gemini
helix export graph.helix.json
helix serve --port 3000
```

---

## Agent Build Plan

### Dependency Graph
```
Phase 1 (Graph Engine) ──→ Phase 2 (Git Ops)
                       ──→ Phase 3 (Intelligence)
                       ──→ Phase 4 (Multi-Agent)
                       ──→ Phase 5 (Visualization)
                       ──→ Phase 6 (Ecosystem)
```
Phase 1 is the only hard dependency. Phases 2-6 can run in parallel.

### Success Metrics
- < 100ms for any graph operation
- Supports 1000+ node graphs without UI degradation
- Clean provider switching mid-conversation
- Portable .helix.json format
- Semantic conflict detection with measurable precision/recall
