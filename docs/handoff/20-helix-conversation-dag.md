# Handoff Doc 20: Helix — DAG-Structured Conversation System

**Date:** 2026-03-22 (updated 2026-03-23)
**Status:** Project scaffolded with spec and research docs. No functional code yet. Prototype JSX from conversation artifacts was NOT carried over — build from scratch against the spec.
**Repo:** https://github.com/zshaked/helix
**Local:** `/Users/zach/projects/helix`
**Chat name:** helix-conversation-dag

---

## What Is Helix

A conversation system where chat history is stored as a **directed acyclic graph (DAG)**, not a linear sequence. The key design decision: every message node has `parents: string[]` (plural), not `parent: string`. This single structural choice enables branching, merging, parallel flows, and multi-model council — none of which are possible in tree-structured or linear chat.

The conversation state is **provider-agnostic**. The DAG is the product; models are interchangeable stateless execution engines called against a lineage. Any model (Claude, GPT, Gemini, local) can read from and write to the same graph. Switching models mid-conversation or mid-branch is a first-class operation.

**Strategic reframe:** Originally scoped as a weekend portfolio piece. Now scoped for **autonomous agent-driven build** — agents execute against a phased spec, paying in compute not calendar time. This also serves as a meta-demonstration: using agentic workflows to build the conversation DAG system. The tool builds itself with the paradigm it embodies.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│                    UI Layer                      │
│  Chat View │ DAG View │ Council │ Diff View      │
├─────────────────────────────────────────────────┤
│              Operations Layer                    │
│  branch │ merge │ cherry-pick │ rebase │ squash  │
│  bisect │ council │ diff │ conflict-detect       │
├─────────────────────────────────────────────────┤
│           Canonical Message Layer                │
│  buildCanonicalMessages() │ enforceAlternating() │
│  pruneByRelevance() │ squashToSummary()          │
├─────────────────────────────────────────────────┤
│             Provider Registry                    │
│  Anthropic │ OpenAI │ Gemini │ Ollama │ Custom   │
├─────────────────────────────────────────────────┤
│              Graph Store                         │
│  Nodes │ Edges │ Indexes │ Persistence           │
│  Import/Export │ Protocol Spec                    │
└─────────────────────────────────────────────────┘
```

---

## Core Operations (Git-Like Semantics)

### Branch (fork)
Click any message node, type a different prompt, the graph forks. Each branch evolves independently with its own context lineage. Can use different models on different branches to compare reasoning.

### Merge (anneal)
Select two leaf nodes from different branches. Three merge strategies:
- **Synthesize** — LLM reads both branches, produces unified context
- **Council Vote** — LLM evaluates which direction is stronger
- **Concat** — Raw append of both lineages

The merge node has two parents in the DAG — structurally equivalent to a git merge commit. This is the DNA replication metaphor: fork the helix, let strands evolve independently, anneal them back.

### Council (fan-out / fan-in)
Same prompt dispatched to multiple models in parallel. Each model deliberates independently (no cross-contamination). Results displayed side-by-side, then merged via synthesis. This is the "independent AI council" architecture.

### Cherry-Pick
Select a single node from Branch A, insert into Branch B's lineage as a new node. Snapshot semantics (content copied, not referenced).

### Rebase
Replay a branch's unique nodes on a new base. Does NOT re-run LLM calls by default (preserves original responses). Optional: re-generate assistant responses against new context (expensive but useful).

### Squash
Collapse a branch into a single summary node via LLM call. Critical for token management — a 30-message branch becomes 1 summary. Meta records `squashedFrom: [original_node_ids]` for audit trail.

### Bisect
Binary search through a lineage to find where conversation diverged from intent. User marks endpoints as "good" and "bad", bisect narrows the divergence point.

### Stash
Temporarily save uncommitted input + branch state without creating a node. Restore later for quick context switching.

---

## Storage Architecture & Protocol Spec

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

This `.helix.json` is the interchange format. Any tool that reads it can render, fork, or continue the conversation with any provider. No standard for conversation graph interchange exists — defining this spec is itself a contribution.

---

## Provider Architecture

```
providers: {
  anthropic: { models: [sonnet-4, haiku-4.5], callFn, sanitizeFn },
  openai: { models: [gpt-4.1, gpt-4.1-mini], callFn, sanitizeFn },
  google: { models: [gemini-2.5-pro], callFn, sanitizeFn },
  ollama: { models: [local], callFn, sanitizeFn },
  openrouter: { models: [any], callFn, sanitizeFn },
  custom: { models: [webhook], callFn, sanitizeFn }
}
```

Each provider has its own message sanitization. The graph stores canonical messages; providers translate at call time. Provider metadata is stored per-node so the graph records which provider created each response.

---

## Intelligence Layer (Research-Grade Features)

### Semantic Conflict Detection
Before merging two branches:
1. Extract assertions from each branch via LLM call
2. Embed assertions, compare cosine similarity across branches
3. Flag pairs with high similarity but opposing polarity as conflicts
4. Present conflicts to user before merge with resolution options
5. Feed resolution into merge synthesis prompt

This is the gap between Helix and Forky. Connects to alignment/honesty research — detecting contradictory beliefs across context.

### Auto-Branch Suggestion
Monitor conversation entropy via embedding drift. When cosine similarity between consecutive messages drops below threshold (topic divergence detected), suggest branching. Implementation: embed each message, compare against running centroid of conversation.

### Context Relevance Pruning
Before API calls on long lineages, score each node's relevance to current query via embedding similarity. Drop nodes below threshold, preserving chronological coherence. Insert `[context pruned: N messages omitted]` markers. This is the information-theoretic minimum-description-length problem applied to conversation context.

### Branch Summarization on Idle
Auto-generate summaries for inactive branches. Display in sidebar for quick scanning. Summaries update as branches grow.

### Volatile Nodes
Branches marked volatile auto-delete after session end. Before deletion, LLM summarizes the branch. Summary either merges upstream or is discarded.

---

## Multi-Agent & Council Enhancements

### Enhanced Council
- **Weighted voting** — judge model scores each response on relevance, accuracy, completeness
- **Iterative council (Delphi method)** — multiple rounds where models see each other's responses and refine
- **Selective merge** — user picks which parts of which responses to include

### Debate Mode
Two models argue opposing sides (2-3 rounds). Judge model or user synthesizes conclusion. Structurally: alternating branches from shared root with final merge node.

### Specialist Routing
Auto-route branches to appropriate models based on content: code → coding model, creative → creative model, facts → search-enabled model. Routing logic in operations layer, not UI.

### Agent-as-Branch
An autonomous agent runs as a branch. Each agent step is a node. When complete, branch merges back into main conversation. **This is the direct bridge to AOP work: an AOP workflow IS a branch in the conversation DAG.** The structural isomorphism between Helix's conversation DAG and LangGraph's state graph is not coincidental.

---

## Research Findings

### Competitive Landscape
- **~10 projects** do tree-based branching (TreeGPT, LLMTree, Canvas Chat, GitChat, RabbitMap, Cognis)
- **Exactly one** (Forky by Ishan Dhanani) has true DAG merge with LCA computation and semantic diffing
- **Nobody** combines: DAG merge + multi-model council with recombination + provider-agnostic canonical message layer

### Academic Validation
- **ContextBranch paper (Dec 2025):** 39% performance drop in multi-turn LLM conversations from context poisoning. Branching reduced context size by 58% with up to 13.2% quality improvement.
- **S-DAG paper:** Directed sparse DAGs outperform fully-connected graphs for multi-agent reasoning — more accurate AND cheaper.
- **Conversation Tree Architecture paper:** Formalizes "logical context poisoning" — degradation from structural mismanagement of context, not bad outputs.

---

## Current State

**Nothing has been built.** The JSX prototype exists only as conversation artifacts (never extracted, never run, never tested). The bugs identified below are in that untested prototype code — they are known issues to address when actual implementation begins.

### Known Issues in Prototype Code
1. **Anthropic API message validation** — consecutive same-role messages when merge-marker nodes sit adjacent to user messages.
2. **Council race condition** — parallel `Promise.all` callbacks mutating same graph variable.
3. **Code was never run** — all "fixes" are theoretical, applied in conversation artifacts only.

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

### Agent 1: Graph Engine (Phase 1)
- Persistence layer (IndexedDB or window.storage)
- Import/export (.helix.json)
- Named branches with activeBranches map
- Tests: round-trip serialization, branch CRUD, concurrent mutation safety

### Agent 2: Git Operations (Phase 2)
- Cherry-pick, rebase, squash, bisect, stash
- Each operation as pure function: (graph, params) → graph
- Tests: operation correctness, edge cases

### Agent 3: Intelligence Layer (Phase 3)
- Semantic conflict detection (assertion extraction + embedding comparison)
- Auto-branch suggestion (embedding drift detection)
- Context relevance pruning
- Tests: conflict detection precision/recall on synthetic branches

### Agent 4: Multi-Agent (Phase 4)
- Debate mode, specialist routing, agent-as-branch
- Enhanced council with weighted voting and iterative rounds
- Tests: debate produces opposing arguments, routing correctness

### Agent 5: Visualization (Phase 5)
- Sugiyama/force-directed layout for DAG view
- Diff view, timeline view
- Enhanced branch sidebar
- Tests: layout non-overlap, diff accuracy

### Agent 6: Ecosystem (Phase 6)
- Provider adapters (OpenAI, Gemini, Ollama, OpenRouter)
- MCP integration (expose graph ops as MCP tools)
- CLI interface
- Export formats (.helix.json, Markdown, HTML, Mermaid)

---

## CLI Spec

```bash
helix new "project-name"
helix branch "experiment-a"
helix switch "main"
helix merge "experiment-a" --strategy synthesize
helix squash "experiment-a" --summarize
helix diff "main" "experiment-a"
helix council "What approach is best?" --models sonnet,gpt4o,gemini
helix export graph.helix.json
helix serve --port 3000
```

---

## Success Metrics

**As portfolio piece:**
- DAG-based conversation with merge semantics demonstrated
- Connected to formal literature (ContextBranch, S-DAG)
- Provider-agnostic architecture
- Blog post with architecture diagrams

**As tool:**
- < 100ms for any graph operation
- Supports 1000+ node graphs without UI degradation
- Clean provider switching mid-conversation
- Portable .helix.json format

**As research signal:**
- Semantic conflict detection with measurable precision/recall
- Context pruning with measurable quality preservation
- Auto-branch suggestion with measurable entropy correlation

---

## Connection to Other Initiatives

| Initiative | Connection |
|-----------|-----------|
| **I6 (AOP Architecture)** | Conversation DAG is structurally isomorphic to LangGraph state graphs — same coordination problem at different abstraction levels |
| **I9 (SOP-to-DAG)** | Both use DAG as the core computational primitive |
| **I7 (Hyperpolarization)** | Council mode is ensemble with recombination — "how to merge independent reasoning" appears in both |
| **I11 (Orchestrator)** | Agent-as-branch makes Helix an orchestration surface |

---

## Files

- `helix.jsx` — Prototype code (conversation artifact only, never extracted or run)
- `helix-research.md` — Competitive landscape and capability analysis (conversation artifact)
- `helix-handoff.md` — Earlier handoff doc (conversation artifact)
- `helix-spec.md` — Full feature spec and agent build plan (conversation artifact)

The conversation artifacts were NOT carried into the repo. The repo contains clean docs only (`README.md`, `docs/spec.md`, `docs/research.md`). Build from scratch against the spec.
