# Helix

A DAG-structured conversation engine with git-like semantics. Branch, merge, rebase, cherry-pick, and squash conversations across any LLM provider.

## Core Idea

Chat history is a **directed acyclic graph**, not a linear sequence. Every message node has `parents: string[]` (plural), enabling:

- **Branch** — fork from any message, explore different directions
- **Merge** — synthesize two branches back together (like DNA replication annealing)
- **Council** — fan out the same prompt to multiple models, compare, merge results
- **Cherry-pick / Rebase / Squash / Bisect** — full git-like operation set on conversations

The conversation state is **provider-agnostic**. The DAG is the product; models are interchangeable stateless execution engines called against a lineage projection.

## Architecture

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
│  Import/Export │ .helix.json Protocol            │
└─────────────────────────────────────────────────┘
```

## Status

**Early development.** Graph engine and protocol spec in progress. See `docs/spec.md` for the full feature spec and `docs/research.md` for competitive landscape analysis.

## Interchange Format

Helix defines `.helix.json` — a portable JSON schema for conversation DAGs. Any tool that reads it can render, fork, or continue the conversation with any provider.

```json
{
  "version": "0.1.0",
  "id": "graph_abc123",
  "nodes": {
    "node_id": {
      "role": "user | assistant | system | merge-marker",
      "content": "string",
      "model": "string | null",
      "provider": "string | null",
      "parents": ["string"],
      "children": ["string"]
    }
  },
  "root": "string",
  "activeBranches": { "main": "leaf_node_id" }
}
```

## Research Context

- **ContextBranch (2025):** 39% performance drop from context poisoning in multi-turn LLM conversations; branching reduced context by 58%
- **S-DAG:** Sparse DAGs outperform fully-connected graphs for multi-agent reasoning
- **Competitive landscape:** ~10 projects do tree branching; only one (Forky) has true DAG merge; nobody combines DAG merge + multi-model council + provider-agnostic message layer

## License

MIT
