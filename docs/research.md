# Helix — Research & Competitive Landscape

## The Topology Difference

Most existing tools build conversation **trees** (branch only). Helix builds a **DAG** (branch + merge). That single structural difference — `parents: string[]` instead of `parent: string` — enables:

- Synthesis nodes (merge two reasoning paths)
- Conflict detection (compare divergent conclusions)
- Three-way merge via LCA (lowest common ancestor)
- Cross-branch information flow
- Council-with-recombination

None of these are possible in a tree.

---

## Academic Validation

### ContextBranch (Dec 2025)
- 39% performance drop in multi-turn LLM conversations due to context poisoning
- Branching reduced context size by 58%
- Up to 13.2% quality improvement on complex scenarios
- Key finding: structural mismanagement of context causes more degradation than bad model outputs

### Conversation Tree Architecture
- Formalizes "logical context poisoning" — degradation from how context is managed, not from model quality
- Argues that conversation structure is a first-class engineering concern

### S-DAG
- Directed sparse DAGs outperform fully-connected graphs for multi-agent reasoning
- More accurate AND cheaper than complete graphs
- Validates the idea that topology matters for multi-model coordination

---

## Competitive Landscape

### Tree-Based Branching (~10 projects)
- **TreeGPT** — tree-structured chat, no merge
- **LLMTree** — conversation branching with visualization
- **Canvas Chat** — branching with canvas UI
- **GitChat** — git metaphor for chat, tree only
- **RabbitMap** — mind-map style branching
- **Cognis** — branching with knowledge graphs
- Several others with similar tree-only approaches

### DAG-Based (1 project)
- **Forky** (Ishan Dhanani) — the only project with true DAG merge
  - Has: SQLite persistence, LCA computation, semantic diffing, conflict detection
  - Missing: multi-model council, provider-agnostic message layer, iterative council
  - A few hundred GitHub stars
  - Blog post identifies "no standard spec for LLM conversations" as open problem

### What Nobody Has
The combination of:
1. DAG merge (not just tree branching)
2. Multi-model council with recombination
3. Provider-agnostic canonical message layer
4. Formal interchange format (.helix.json)

---

## Unexploited Operations

All structurally enabled by the DAG, none implemented by anyone:

| Operation | Description | Analogy |
|-----------|-------------|---------|
| **Rebase** | Replay a branch on a newer base | `git rebase` |
| **Cherry-pick** | Graft one insight across branches | `git cherry-pick` |
| **Squash** | Collapse branch to summary for token management | `git squash` |
| **Bisect** | Binary search for where understanding diverged | `git bisect` |
| **Volatile nodes** | Transient branches that auto-merge-or-purge | Temp branches |
| **Stash** | Save uncommitted input for later | `git stash` |

---

## Structural Connections

The conversation DAG is structurally isomorphic to:

- **LangGraph state graphs** — same coordination problem at different abstraction levels
- **PDDL planning graphs** — branches are alternate plans, merges are plan reconciliation
- **Git object model** — but for conversation turns instead of file changes
- **DNA replication** — fork, evolve independently, anneal back together

This is not coincidental. All of these are instances of the same abstract structure: directed acyclic graphs with typed edges encoding dependency and lineage relationships.
