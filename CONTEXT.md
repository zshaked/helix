# Helix — Project Context

## Purpose

Helix is a DAG-structured conversation engine with git-like semantics. It enables branching, merging, rebasing, cherry-picking, and council conversations across any LLM provider.

The key structural insight: every message node has `parents: string[]` (plural), not `parent: string`. This single design decision is what separates a DAG from a tree. Trees can only branch. DAGs can branch AND merge — enabling synthesis nodes, conflict detection, three-way merge via LCA, cross-branch information flow, and council-with-recombination.

The conversation state is provider-agnostic. The DAG is the product; models are interchangeable stateless executors called against a lineage. Any model (Claude, GPT, Gemini, local) can read from and write to the same graph. Switching models mid-conversation is a first-class operation.

---

## Current State

- **Project is scaffolded with docs only.** The repo contains `README.md`, `docs/spec.md`, and `docs/research.md`.
- **NO functional code exists yet.** Zero lines of implementation.
- A prototype JSX was written in an earlier Claude conversation but was never extracted, never run, never tested. It exists only as conversation artifacts. Do NOT try to recover it — build from scratch against the spec.
- The full 6-phase spec is in `docs/spec.md`.
- Competitive landscape research is in `docs/research.md`.
- Handoff doc with full architecture narrative is in `docs/handoff/20-helix-conversation-dag.md`.

---

## Build Plan

### Dependency Graph

```
Phase 1 (Core Graph Engine) ──> Phase 2 (Git Operations)
                             ──> Phase 3 (Intelligence Layer)
                             ──> Phase 4 (Multi-Agent)
                             ──> Phase 5 (Visualization)
                             ──> Phase 6 (Ecosystem)
```

Phase 1 is the only hard dependency. Phases 2-6 can proceed in parallel once Phase 1 is complete.

### Phase 1: Core Graph Engine + Persistence + .helix.json Protocol

This is the foundation. Everything else depends on it.

**What to build:**

1. **Graph data structure** — `MessageNode` and `ConversationGraph` types:
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
     activeBranches: Record<string, string>;  // branch name -> leaf node id
   }
   ```

2. **Core graph operations:**
   - `addNode(graph, node)` — insert node, update parent's children array
   - `branch(graph, fromNodeId, branchLabel)` — create named branch from any node
   - `merge(graph, nodeIdA, nodeIdB, strategy)` — create merge node with two parents
   - `getLineage(graph, nodeId)` — walk parents to root, return ordered path
   - `findLCA(graph, nodeIdA, nodeIdB)` — lowest common ancestor (required for merge/diff)
   - `switchBranch(graph, branchLabel)` — update active branch pointer
   - `listBranches(graph)` — enumerate all named branches

3. **Persistence layer:**
   - Serialize full graph to IndexedDB (browser) or SQLite (server/CLI)
   - Key structure: `helix:graph:{graphId}` for node data, `helix:meta:{graphId}` for metadata
   - Auto-save on every graph mutation
   - Support multiple named graphs

4. **Import/export (.helix.json):**
   - Serialize graph to the `.helix.json` interchange format (see protocol spec below)
   - Parse `.helix.json` back into in-memory graph
   - Round-trip fidelity: export then import must produce identical graph

5. **Canonical message builder:**
   - `buildCanonicalMessages(graph, leafNodeId)` — walk lineage from root to leaf, produce ordered message array
   - `enforceAlternating(messages, provider)` — coalesce consecutive same-role messages per provider requirements
   - Handle merge-marker nodes without breaking role alternation
   - This is what gets sent to LLM providers — the DAG projected into a linear sequence

**Tests to write:**
- Round-trip serialization (graph -> .helix.json -> graph, assert equality)
- Branch CRUD (create, switch, list, delete)
- Merge creates node with two parents
- LCA computation on various graph topologies
- Canonical message builder produces valid alternating sequences
- Concurrent mutation safety

### Phase 2: Git Operations
Cherry-pick, rebase, squash, bisect, stash. Each operation is a pure function: `(graph, params) -> graph`. See `docs/spec.md` for full details.

### Phase 3: Intelligence Layer
Semantic conflict detection (assertion extraction + embedding comparison), auto-branch suggestion (embedding drift), context relevance pruning. Research-grade features.

### Phase 4: Multi-Agent
Enhanced council with weighted voting and iterative rounds (Delphi method), debate mode, specialist routing, agent-as-branch.

### Phase 5: Visualization
DAG layout (Sugiyama or force-directed), diff view, timeline view, branch sidebar.

### Phase 6: Ecosystem
Provider adapters (OpenAI, Gemini, Ollama, OpenRouter), MCP integration (expose graph ops as tools), CLI interface, export formats (.helix.json, Markdown, HTML, Mermaid).

---

## .helix.json Protocol Spec

This is the portable interchange format. No standard for conversation graph interchange exists — defining this is itself a contribution.

```json
{
  "version": "0.1.0",
  "id": "graph_abc123",
  "created": "2026-03-23T...",
  "nodes": {
    "node_id": {
      "id": "string",
      "role": "user | assistant | system | merge-marker",
      "content": "string",
      "model": "string | null",
      "provider": "string | null",
      "parents": ["string"],
      "children": ["string"],
      "meta": {
        "timestamp": "number",
        "branchLabel": "string | null",
        "mergeStrategy": "string | null",
        "parallelGroupId": "string | null",
        "tags": ["string"],
        "pinned": "boolean",
        "volatile": "boolean",
        "squashedFrom": ["string"]
      }
    }
  },
  "root": "string",
  "activeBranches": {
    "main": "leaf_node_id",
    "experiment-a": "leaf_node_id"
  }
}
```

---

## Key Design Decisions

1. **Provider-agnostic DAG**: The conversation graph stores canonical messages. Provider-specific translation happens at call time. The DAG is the product; models are interchangeable executors.

2. **Per-node provider metadata**: Every node records which model and provider generated it. This enables mixed-model conversations and historical auditability.

3. **Canonical message builder**: Walks lineage from root to leaf and enforces provider-specific constraints (e.g., alternating roles for Anthropic). This is the bridge between DAG structure and linear API call format.

4. **`.helix.json` as interchange format**: Portable, JSON-based, version-tagged. Any tool that reads it can render, fork, or continue the conversation with any provider.

5. **Merge strategies**: Three approaches — Synthesize (LLM reads both branches, produces unified context), Council Vote (LLM evaluates which direction is stronger), Concat (raw append of both lineages).

6. **Operations as pure functions**: Each git-like operation is `(graph, params) -> graph`. No side effects in the operation itself; persistence is a separate concern.

---

## Competitive Landscape

- ~10 projects do tree-based branching (TreeGPT, LLMTree, Canvas Chat, GitChat, RabbitMap, Cognis). Trees can branch but cannot merge.
- Exactly one project (Forky by Ishan Dhanani) has true DAG merge with LCA computation and semantic diffing.
- Nobody combines: DAG merge + multi-model council with recombination + provider-agnostic canonical message layer + interchange format. This is the gap Helix fills.

Academic backing: ContextBranch paper (Dec 2025) showed 39% performance drop from context poisoning, 58% context reduction from branching, up to 13.2% quality improvement. S-DAG paper showed sparse DAGs outperform fully-connected graphs for multi-agent reasoning.

---

## Strategic Context

Designed for autonomous agent-driven build. Agents execute against the phased spec, paying in compute not calendar time. This is also a meta-demonstration: using agentic workflows to build the conversation DAG system. The tool builds itself with the paradigm it embodies.

---

## Related Initiatives

| Initiative | Connection |
|---|---|
| **I6 (AOP Architecture)** | Conversation DAG is structurally isomorphic to LangGraph state graphs — same coordination problem at different abstraction levels |
| **I9 (SOP-to-DAG)** | Both use DAG as the core computational primitive |
| **I11 (Orchestrator)** | Agent-as-branch makes Helix an orchestration surface |

See `~/projects/initiatives/` for full initiative details.

---

## Known Issues from Prototype (Address During Implementation)

These bugs were identified in the never-extracted prototype JSX. They are patterns to avoid:

1. **Anthropic API message validation** — consecutive same-role messages when merge-marker nodes sit adjacent to user messages. The canonical message builder must handle this.
2. **Council race condition** — parallel `Promise.all` callbacks mutating the same graph variable. Graph mutations must be serialized or use immutable update patterns.
3. **All prototype code was theoretical** — never run, never tested. Build from scratch and test as you go.

---

## File Map

```
helix/
  README.md                                    # Project overview
  CONTEXT.md                                   # This file
  docs/
    spec.md                                    # Full 6-phase feature spec (primary build reference)
    research.md                                # Competitive landscape and academic validation
    handoff/
      20-helix-conversation-dag.md             # Detailed handoff doc with architecture narrative
```
