# PR Triage Bot — Phase 3: Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-memory knowledge graph from repo code structure using NetworkX, mapping relationships (calls, imports, inherits, implements, tests) to enable cross-file impact scoring, enhanced agent prompts with graph context, and optional visualization of change impact radius.

**Architecture:** Extends the existing Phase 2 analyzer sidecar. The knowledge graph is built on-demand per analysis, stored in-memory as a NetworkX DiGraph. A new `/graph` endpoint returns serialized graph data. The backend's ranking agent receives graph context (connectivity scores, high-risk nodes) to make smarter clustering and ranking decisions. A new frontend component optionally visualizes the graph.

**Tech Stack:** NetworkX (graph), existing tree-sitter pipeline (data source), D3.js or react-force-graph (optional visualization in frontend), existing FastAPI + Express infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-02-pr-triage-bot-design.md` — Phase 3 section.

**Prerequisite:** Phase 2 must be complete (analyzer sidecar with AST parsing and dependency graph).

---

## File Structure

```
analyzer/
├── src/
│   ├── services/
│   │   ├── knowledge_graph.py      # Build NetworkX graph from symbols + edges
│   │   ├── impact_scoring.py       # Score nodes by connectivity + change proximity
│   │   └── graph_serializer.py     # Serialize graph for API response / visualization
│   ├── routers/
│   │   └── graph.py                # GET /graph/:analysis_id endpoint
│   └── models.py                   # Extended with graph-related models
├── tests/
│   ├── test_knowledge_graph.py
│   ├── test_impact_scoring.py
│   ├── test_graph_serializer.py
│   └── test_graph_api.py

backend/
├── src/
│   ├── services/
│   │   └── analyzer-client.ts      # Extended: call /graph endpoint
│   ├── services/agents/
│   │   └── ranking.ts              # Enhanced: include graph context in prompt
│   └── routes/
│       └── analyze.ts              # Add GET /api/analysis/:id/graph
├── tests/
│   └── services/
│       └── analyzer-client.test.ts # Extended

frontend/
├── src/
│   ├── components/
│   │   └── GraphView.tsx           # Optional impact radius visualization
│   └── types.ts                    # Extended with graph types
├── tests/
│   └── components/
│       └── GraphView.test.tsx
```

---

## Task 1: Knowledge Graph — Build Graph from Symbols & Dependencies

**Files:**
- Create: `analyzer/src/services/knowledge_graph.py`
- Create: `analyzer/tests/test_knowledge_graph.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_knowledge_graph.py`:

```python
from src.services.knowledge_graph import build_knowledge_graph
from src.models import SymbolInfo, DependencyEdge


def test_build_graph_with_symbols_and_edges():
    symbols = [
        SymbolInfo(name="UserService", kind="class", file_path="services/user.py", line_start=1, line_end=20),
        SymbolInfo(name="get_user", kind="method", file_path="services/user.py", line_start=5, line_end=10),
        SymbolInfo(name="UserController", kind="class", file_path="controllers/user.py", line_start=1, line_end=15),
        SymbolInfo(name="handle_request", kind="method", file_path="controllers/user.py", line_start=5, line_end=12),
        SymbolInfo(name="test_get_user", kind="function", file_path="tests/test_user.py", line_start=1, line_end=8),
    ]
    edges = [
        DependencyEdge(source="controllers/user.py", target="services/user", kind="imports"),
        DependencyEdge(source="tests/test_user.py", target="services/user", kind="imports"),
    ]

    graph = build_knowledge_graph(symbols, edges)

    assert graph.number_of_nodes() == 5
    assert graph.number_of_edges() >= 2

    # Check that nodes have attributes
    node = graph.nodes["services/user.py:UserService"]
    assert node["kind"] == "class"
    assert node["file_path"] == "services/user.py"


def test_adds_contains_edges_for_methods():
    symbols = [
        SymbolInfo(name="MyClass", kind="class", file_path="app.py", line_start=1, line_end=20),
        SymbolInfo(name="my_method", kind="method", file_path="app.py", line_start=5, line_end=10),
    ]
    edges: list[DependencyEdge] = []

    graph = build_knowledge_graph(symbols, edges)

    # Method should have a "contains" edge from the class
    assert graph.has_edge("app.py:MyClass", "app.py:my_method")
    edge_data = graph.edges["app.py:MyClass", "app.py:my_method"]
    assert edge_data["kind"] == "contains"


def test_empty_inputs():
    graph = build_knowledge_graph([], [])
    assert graph.number_of_nodes() == 0
    assert graph.number_of_edges() == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_knowledge_graph.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement knowledge graph builder**

Create `analyzer/src/services/knowledge_graph.py`:

```python
import networkx as nx
from src.models import SymbolInfo, DependencyEdge


def _node_id(symbol: SymbolInfo) -> str:
    return f"{symbol.file_path}:{symbol.name}"


def _find_parent_class(
    symbol: SymbolInfo, symbols: list[SymbolInfo]
) -> SymbolInfo | None:
    """Find the enclosing class for a method based on line ranges."""
    if symbol.kind != "method":
        return None
    for s in symbols:
        if (
            s.kind == "class"
            and s.file_path == symbol.file_path
            and s.line_start <= symbol.line_start
            and s.line_end >= symbol.line_end
        ):
            return s
    return None


def build_knowledge_graph(
    symbols: list[SymbolInfo],
    edges: list[DependencyEdge],
) -> nx.DiGraph:
    graph = nx.DiGraph()

    # Add symbol nodes
    for symbol in symbols:
        node_id = _node_id(symbol)
        graph.add_node(
            node_id,
            name=symbol.name,
            kind=symbol.kind,
            file_path=symbol.file_path,
            line_start=symbol.line_start,
            line_end=symbol.line_end,
        )

    # Add "contains" edges for methods inside classes
    for symbol in symbols:
        parent = _find_parent_class(symbol, symbols)
        if parent:
            graph.add_edge(
                _node_id(parent),
                _node_id(symbol),
                kind="contains",
            )

    # Add import/dependency edges
    # Match edges to symbol nodes: edge.source is a file, edge.target is a module name
    nodes_by_file: dict[str, list[str]] = {}
    for symbol in symbols:
        nid = _node_id(symbol)
        nodes_by_file.setdefault(symbol.file_path, []).append(nid)

    for edge in edges:
        source_nodes = nodes_by_file.get(edge.source, [])
        # Find target nodes: match by module name in file path
        target_nodes: list[str] = []
        for file_path, node_ids in nodes_by_file.items():
            # "services/user" matches "services/user.py"
            file_stem = file_path.rsplit(".", 1)[0] if "." in file_path else file_path
            if file_stem == edge.target or file_path == edge.target:
                target_nodes.extend(node_ids)

        # Create edges from each source file symbol to each target module symbol
        for src in source_nodes:
            for tgt in target_nodes:
                if src != tgt:
                    graph.add_edge(src, tgt, kind=edge.kind)

    return graph
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_knowledge_graph.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/knowledge_graph.py analyzer/tests/test_knowledge_graph.py
git commit -m "feat: add knowledge graph builder with NetworkX"
```

---

## Task 2: Impact Scoring — Score Nodes by Connectivity & Change Proximity

**Files:**
- Create: `analyzer/src/services/impact_scoring.py`
- Create: `analyzer/tests/test_impact_scoring.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_impact_scoring.py`:

```python
import networkx as nx
from src.services.impact_scoring import score_impact


def test_high_connectivity_scores_higher():
    graph = nx.DiGraph()
    # Hub node with many connections
    graph.add_node("core.py:process", kind="function", file_path="core.py", name="process", line_start=1, line_end=10)
    graph.add_node("a.py:use_a", kind="function", file_path="a.py", name="use_a", line_start=1, line_end=5)
    graph.add_node("b.py:use_b", kind="function", file_path="b.py", name="use_b", line_start=1, line_end=5)
    graph.add_node("c.py:use_c", kind="function", file_path="c.py", name="use_c", line_start=1, line_end=5)
    graph.add_node("leaf.py:helper", kind="function", file_path="leaf.py", name="helper", line_start=1, line_end=5)

    graph.add_edge("a.py:use_a", "core.py:process", kind="imports")
    graph.add_edge("b.py:use_b", "core.py:process", kind="imports")
    graph.add_edge("c.py:use_c", "core.py:process", kind="imports")

    changed_files = ["core.py"]
    scores = score_impact(graph, changed_files)

    # core.py:process should have highest score (most dependents + is changed)
    assert scores["core.py:process"] > scores.get("leaf.py:helper", 0)


def test_changed_files_get_boosted():
    graph = nx.DiGraph()
    graph.add_node("changed.py:func", kind="function", file_path="changed.py", name="func", line_start=1, line_end=5)
    graph.add_node("unchanged.py:func", kind="function", file_path="unchanged.py", name="func", line_start=1, line_end=5)

    changed_files = ["changed.py"]
    scores = score_impact(graph, changed_files)

    assert scores["changed.py:func"] > scores["unchanged.py:func"]


def test_empty_graph():
    graph = nx.DiGraph()
    scores = score_impact(graph, ["anything.py"])
    assert scores == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_impact_scoring.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement impact scoring**

Create `analyzer/src/services/impact_scoring.py`:

```python
import networkx as nx


def score_impact(
    graph: nx.DiGraph,
    changed_files: list[str],
) -> dict[str, float]:
    if graph.number_of_nodes() == 0:
        return {}

    scores: dict[str, float] = {}

    # Base score: PageRank for structural importance
    try:
        pagerank = nx.pagerank(graph)
    except nx.NetworkXError:
        pagerank = {node: 1.0 / graph.number_of_nodes() for node in graph.nodes}

    # In-degree: how many things depend on this node
    in_degrees = dict(graph.in_degree())
    max_in = max(in_degrees.values()) if in_degrees else 1

    for node in graph.nodes:
        node_data = graph.nodes[node]
        file_path = node_data.get("file_path", "")

        # Component 1: PageRank (0-1 normalized)
        pr_score = pagerank.get(node, 0)

        # Component 2: In-degree normalized (0-1)
        degree_score = in_degrees.get(node, 0) / max(max_in, 1)

        # Component 3: Change proximity boost
        change_boost = 1.0 if file_path in changed_files else 0.0

        # Weighted combination
        score = (pr_score * 30) + (degree_score * 30) + (change_boost * 40)
        scores[node] = round(score, 4)

    return scores
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_impact_scoring.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/impact_scoring.py analyzer/tests/test_impact_scoring.py
git commit -m "feat: add impact scoring combining PageRank, in-degree, and change proximity"
```

---

## Task 3: Graph Serializer — Serialize for API & Visualization

**Files:**
- Create: `analyzer/src/services/graph_serializer.py`
- Create: `analyzer/tests/test_graph_serializer.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_graph_serializer.py`:

```python
import networkx as nx
from src.services.graph_serializer import serialize_graph


def test_serialize_graph_structure():
    graph = nx.DiGraph()
    graph.add_node("a.py:Foo", kind="class", file_path="a.py", name="Foo", line_start=1, line_end=10)
    graph.add_node("b.py:bar", kind="function", file_path="b.py", name="bar", line_start=1, line_end=5)
    graph.add_edge("b.py:bar", "a.py:Foo", kind="imports")

    scores = {"a.py:Foo": 0.8, "b.py:bar": 0.3}
    changed_files = ["a.py"]

    result = serialize_graph(graph, scores, changed_files)

    assert len(result["nodes"]) == 2
    assert len(result["edges"]) == 1

    foo_node = next(n for n in result["nodes"] if n["id"] == "a.py:Foo")
    assert foo_node["kind"] == "class"
    assert foo_node["impactScore"] == 0.8
    assert foo_node["isChanged"] is True

    bar_node = next(n for n in result["nodes"] if n["id"] == "b.py:bar")
    assert bar_node["isChanged"] is False

    edge = result["edges"][0]
    assert edge["source"] == "b.py:bar"
    assert edge["target"] == "a.py:Foo"
    assert edge["kind"] == "imports"


def test_serialize_empty_graph():
    graph = nx.DiGraph()
    result = serialize_graph(graph, {}, [])
    assert result == {"nodes": [], "edges": []}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_graph_serializer.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement graph serializer**

Create `analyzer/src/services/graph_serializer.py`:

```python
import networkx as nx


def serialize_graph(
    graph: nx.DiGraph,
    scores: dict[str, float],
    changed_files: list[str],
) -> dict:
    nodes = []
    for node_id in graph.nodes:
        data = graph.nodes[node_id]
        nodes.append({
            "id": node_id,
            "name": data.get("name", node_id),
            "kind": data.get("kind", "unknown"),
            "filePath": data.get("file_path", ""),
            "lineStart": data.get("line_start", 0),
            "lineEnd": data.get("line_end", 0),
            "impactScore": scores.get(node_id, 0),
            "isChanged": data.get("file_path", "") in changed_files,
        })

    edges = []
    for source, target in graph.edges:
        edge_data = graph.edges[source, target]
        edges.append({
            "source": source,
            "target": target,
            "kind": edge_data.get("kind", "unknown"),
        })

    return {"nodes": nodes, "edges": edges}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_graph_serializer.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/graph_serializer.py analyzer/tests/test_graph_serializer.py
git commit -m "feat: add graph serializer for API responses and visualization"
```

---

## Task 4: Graph Models & Analyzer Graph Endpoint

**Files:**
- Modify: `analyzer/src/models.py` (add graph-related models)
- Create: `analyzer/src/routers/graph.py`
- Modify: `analyzer/src/main.py` (mount graph router)
- Create: `analyzer/tests/test_graph_api.py`

- [ ] **Step 1: Extend models.py with graph types**

Add to `analyzer/src/models.py`:

```python
class GraphNode(BaseModel):
    id: str
    name: str
    kind: str
    filePath: str
    lineStart: int
    lineEnd: int
    impactScore: float
    isChanged: bool


class GraphEdge(BaseModel):
    source: str
    target: str
    kind: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class GraphRequest(BaseModel):
    repo_url: str
    base_branch: str
    head_branch: str
    changed_files: list[str]
```

- [ ] **Step 2: Write the failing test**

Create `analyzer/tests/test_graph_api.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport
from src.main import app
import networkx as nx


@pytest.fixture
def mock_clone():
    with patch("src.routers.graph.clone_repo") as mock:
        mock.return_value = "/tmp/test-repo"
        yield mock


@pytest.fixture
def mock_cleanup():
    with patch("src.routers.graph.cleanup_repo") as mock:
        yield mock


@pytest.fixture
def mock_extract():
    with patch("src.routers.graph.extract_symbols") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_dep_graph():
    with patch("src.routers.graph.build_dependency_graph") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_knowledge_graph():
    with patch("src.routers.graph.build_knowledge_graph") as mock:
        mock.return_value = nx.DiGraph()
        yield mock


@pytest.fixture
def mock_score():
    with patch("src.routers.graph.score_impact") as mock:
        mock.return_value = {}
        yield mock


async def test_graph_endpoint(
    mock_clone, mock_cleanup, mock_extract, mock_dep_graph,
    mock_knowledge_graph, mock_score
):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/graph", json={
            "repo_url": "https://github.com/octocat/hello-world.git",
            "base_branch": "main",
            "head_branch": "feature",
            "changed_files": ["src/app.py"],
        })
        assert res.status_code == 200
        body = res.json()
        assert "nodes" in body
        assert "edges" in body

    mock_clone.assert_called_once()
    mock_cleanup.assert_called_once()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_graph_api.py -v`
Expected: FAIL — endpoint not found

- [ ] **Step 4: Implement graph router**

Create `analyzer/src/routers/graph.py`:

```python
import os
from fastapi import APIRouter
from src.models import GraphRequest, GraphResponse
from src.services.repo import clone_repo, cleanup_repo
from src.services.parser import extract_symbols
from src.services.dependency_graph import build_dependency_graph
from src.services.knowledge_graph import build_knowledge_graph
from src.services.impact_scoring import score_impact
from src.services.graph_serializer import serialize_graph
from src.utils.tree_sitter_langs import detect_language

router = APIRouter()


@router.post("/graph", response_model=GraphResponse)
async def get_graph(request: GraphRequest):
    repo_dir = clone_repo(request.repo_url, request.base_branch)

    try:
        # 1. Extract all symbols from changed files
        all_symbols = []
        for file_path in request.changed_files:
            full_path = os.path.join(repo_dir, file_path)
            if os.path.isfile(full_path):
                file_symbols = extract_symbols(full_path)
                for s in file_symbols:
                    s.file_path = file_path
                all_symbols.extend(file_symbols)

        # Also extract symbols from files that import changed files
        # (to build a complete local graph)
        for root, _dirs, files in os.walk(repo_dir):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, repo_dir)
                if rel in request.changed_files:
                    continue
                if detect_language(rel):
                    try:
                        repo_syms = extract_symbols(full)
                        for s in repo_syms:
                            s.file_path = rel
                        all_symbols.extend(repo_syms)
                    except Exception:
                        continue

        # 2. Build dependency graph
        all_files = list({s.file_path for s in all_symbols})
        dep_edges = build_dependency_graph(repo_dir, all_files)

        # 3. Build knowledge graph
        kg = build_knowledge_graph(all_symbols, dep_edges)

        # 4. Score impact
        scores = score_impact(kg, request.changed_files)

        # 5. Serialize
        serialized = serialize_graph(kg, scores, request.changed_files)

        return GraphResponse(
            nodes=[
                {
                    "id": n["id"],
                    "name": n["name"],
                    "kind": n["kind"],
                    "filePath": n["filePath"],
                    "lineStart": n["lineStart"],
                    "lineEnd": n["lineEnd"],
                    "impactScore": n["impactScore"],
                    "isChanged": n["isChanged"],
                }
                for n in serialized["nodes"]
            ],
            edges=[
                {"source": e["source"], "target": e["target"], "kind": e["kind"]}
                for e in serialized["edges"]
            ],
        )

    finally:
        cleanup_repo(repo_dir)
```

- [ ] **Step 5: Mount graph router in main.py**

Update `analyzer/src/main.py`:

```python
from fastapi import FastAPI
from src.routers.analyze import router as analyze_router
from src.routers.graph import router as graph_router

app = FastAPI(title="PR Triage Analyzer", version="0.2.0")

app.include_router(analyze_router)
app.include_router(graph_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_graph_api.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add analyzer/src/ analyzer/tests/test_graph_api.py
git commit -m "feat: add POST /graph endpoint with knowledge graph, scoring, serialization"
```

---

## Task 5: Backend — Graph Client & Enhanced Ranking Prompts

**Files:**
- Modify: `backend/src/services/analyzer-client.ts` (add `fetchGraph`)
- Modify: `backend/src/services/agents/ranking.ts` (include graph context in prompt)
- Modify: `backend/src/types.ts` (add graph types)
- Create: `backend/tests/services/graph-integration.test.ts`

- [ ] **Step 1: Add graph types to backend/src/types.ts**

Add to `backend/src/types.ts`:

```typescript
export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  impactScore: number;
  isChanged: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

- [ ] **Step 2: Add fetchGraph to analyzer-client.ts**

Add to `backend/src/services/analyzer-client.ts`:

```typescript
import type { GraphData } from "../types.js";

interface GraphRequest {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  changedFiles: string[];
}

export async function fetchGraph(request: GraphRequest): Promise<GraphData> {
  const res = await fetch(`${ANALYZER_URL}/graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_url: request.repoUrl,
      base_branch: request.baseBranch,
      head_branch: request.headBranch,
      changed_files: request.changedFiles,
    }),
  });

  if (!res.ok) {
    throw new Error(`Graph endpoint returned ${res.status}: ${await res.text()}`);
  }

  return await res.json() as GraphData;
}
```

- [ ] **Step 3: Write the test for graph-enhanced ranking**

Create `backend/tests/services/graph-integration.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildRankingPrompt } from "../../src/services/agents/ranking.js";
import type { PRMetadata, ChangeCluster, GraphData } from "../../src/types.js";

const metadata: PRMetadata = {
  url: "https://github.com/octocat/repo/pull/1",
  title: "Test PR",
  author: "octocat",
  baseBranch: "main",
  headBranch: "feature",
  additions: 50,
  deletions: 10,
  fileCount: 3,
};

const clusters: ChangeCluster[] = [
  {
    id: "core",
    name: "Core changes",
    summary: "Critical path changes",
    tag: "needs-review",
    priority: 1,
    files: [],
    insights: [],
  },
];

const graphData: GraphData = {
  nodes: [
    { id: "core.py:process", name: "process", kind: "function", filePath: "core.py", lineStart: 1, lineEnd: 10, impactScore: 0.9, isChanged: true },
    { id: "a.py:helper", name: "helper", kind: "function", filePath: "a.py", lineStart: 1, lineEnd: 5, impactScore: 0.2, isChanged: false },
  ],
  edges: [
    { source: "a.py:helper", target: "core.py:process", kind: "imports" },
  ],
};

describe("buildRankingPrompt with graph context", () => {
  it("includes graph data when provided", () => {
    const prompt = buildRankingPrompt(metadata, clusters, graphData);
    expect(prompt).toContain("Knowledge Graph Context");
    expect(prompt).toContain("core.py:process");
    expect(prompt).toContain("impact=0.9");
  });

  it("works without graph data", () => {
    const prompt = buildRankingPrompt(metadata, clusters);
    expect(prompt).not.toContain("Knowledge Graph Context");
    expect(prompt).toContain("Test PR");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/services/graph-integration.test.ts`
Expected: FAIL — `buildRankingPrompt` doesn't accept `graphData` param

- [ ] **Step 5: Update ranking.ts to accept optional graph context**

Modify `backend/src/services/agents/ranking.ts` — update `buildRankingPrompt` signature and body:

```typescript
import type { ChangeCluster, PRMetadata, GraphData } from "../../types.js";

// Update function signature:
export function buildRankingPrompt(
  metadata: PRMetadata,
  clusters: ChangeCluster[],
  graphData?: GraphData
): string {

  // ... existing prompt content ...

  // Add after the cluster summaries section:
  let graphSection = "";
  if (graphData && graphData.nodes.length > 0) {
    const highImpactNodes = graphData.nodes
      .filter((n) => n.impactScore > 0.3)
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 15)
      .map((n) => `  - ${n.id} (${n.kind}, impact=${n.impactScore}, changed=${n.isChanged})`)
      .join("\n");

    const edgeSummary = `${graphData.edges.length} dependency edges`;

    graphSection = `

Knowledge Graph Context:
The following high-impact symbols were identified by structural analysis:
${highImpactNodes}

Graph has ${graphData.nodes.length} nodes and ${edgeSummary}.
Changes to highly-connected, high-impact nodes should be ranked higher for review.`;
  }

  // Include graphSection in the returned prompt string
}

// Also update rankAndSynthesize to accept and pass graphData:
export async function rankAndSynthesize(
  metadata: PRMetadata,
  clusters: ChangeCluster[],
  client: Anthropic,
  graphData?: GraphData
): Promise<RankingResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      { role: "user", content: buildRankingPrompt(metadata, clusters, graphData) },
    ],
  });
  // ... rest unchanged ...
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/services/graph-integration.test.ts`
Expected: PASS

- [ ] **Step 7: Run all backend tests to verify nothing broke**

Run: `cd backend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/ backend/tests/
git commit -m "feat: enhance ranking agent with knowledge graph context"
```

---

## Task 6: Backend — Graph API Endpoint

**Files:**
- Modify: `backend/src/routes/analyze.ts` (add `GET /api/analysis/:id/graph`)
- Modify: `backend/src/index.ts` (wire graph fetching into deep pipeline)

- [ ] **Step 1: Add graph storage alongside analysis results**

Modify `backend/src/routes/analyze.ts` — add a parallel graph store:

```typescript
import type { GraphData } from "../types.js";

const graphStore = new Map<string, GraphData>();

export function getGraph(id: string): GraphData | undefined {
  return graphStore.get(id);
}

export function setGraph(id: string, data: GraphData): void {
  graphStore.set(id, data);
}

// Add new route:
router.get("/:id/graph", (req, res) => {
  const graph = graphStore.get(req.params.id);
  if (!graph) {
    res.status(404).json({ error: "Graph data not found" });
    return;
  }
  res.json(graph);
});
```

- [ ] **Step 2: Wire graph fetching into deep pipeline in index.ts**

Update `app.locals.startDeepPipeline` in `backend/src/index.ts` to also fetch and store graph data:

```typescript
import { fetchGraph } from "./services/analyzer-client.js";
import { setGraph } from "./routes/analyze.js";

// Inside startDeepPipeline, after calling callAnalyzer:
const graphData = await fetchGraph({
  repoUrl,
  baseBranch: prData.metadata.baseBranch,
  headBranch: prData.metadata.headBranch,
  changedFiles: prData.files.map((f) => f.filename),
});

// Pass graphData to pipeline:
const analysis = await runPipeline(prData, {
  analyzeFile: (file) => analyzeFile(file, client),
  clusterFiles: (files) => clusterFiles(files, client),
  rankAndSynthesize: (metadata, clusters) =>
    rankAndSynthesize(metadata, clusters, client, graphData),
  onMessage: (msg) => broadcast(wss, msg),
  structuralInsights,
});

setGraph(analysisId, graphData);
setAnalysis(analysisId, analysis);
```

- [ ] **Step 3: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/
git commit -m "feat: add GET /api/analysis/:id/graph endpoint and wire graph into deep pipeline"
```

---

## Task 7: Frontend — Graph Types & GraphView Component

**Files:**
- Modify: `frontend/src/types.ts` (add graph types)
- Create: `frontend/src/components/GraphView.tsx`
- Modify: `frontend/src/components/AnalysisView.tsx` (add graph toggle)
- Modify: `frontend/package.json` (add react-force-graph-2d)

- [ ] **Step 1: Add graph types to frontend/src/types.ts**

Add to `frontend/src/types.ts`:

```typescript
export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  impactScore: number;
  isChanged: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

- [ ] **Step 2: Add react-force-graph-2d dependency**

```bash
cd frontend && npm install react-force-graph-2d
```

- [ ] **Step 3: Create GraphView component**

Create `frontend/src/components/GraphView.tsx`:

```tsx
import { useEffect, useState, useRef } from "react";
import type { GraphData, GraphNode } from "../types.js";

interface Props {
  analysisId: string;
}

const KIND_COLORS: Record<string, string> = {
  class: "#4a90d9",
  function: "#50c878",
  method: "#f5a623",
  variable: "#999",
};

export default function GraphView({ analysisId }: Props) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/analysis/${analysisId}/graph`)
      .then((res) => {
        if (!res.ok) throw new Error("Graph data not available");
        return res.json();
      })
      .then((data: GraphData) => {
        setGraph(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [analysisId]);

  useEffect(() => {
    if (!graph || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Simple force-directed layout using position hashing
    const positions = new Map<string, { x: number; y: number }>();
    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graph.nodes.length;
      const radius = 150 + node.impactScore * 100;
      positions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    for (const edge of graph.edges) {
      const from = positions.get(edge.source);
      const to = positions.get(edge.target);
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const radius = 4 + node.impactScore * 12;
      const color = KIND_COLORS[node.kind] ?? "#999";

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.isChanged ? color : color + "66";
      ctx.fill();

      if (node.isChanged) {
        ctx.strokeStyle = "#cc3300";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label for high-impact nodes
      if (node.impactScore > 0.4) {
        ctx.fillStyle = "#333";
        ctx.font = "11px monospace";
        ctx.fillText(node.name, pos.x + radius + 4, pos.y + 4);
      }
    }
  }, [graph]);

  if (loading) return <p>Loading graph...</p>;
  if (error) return <p style={{ color: "#666" }}>Graph visualization not available: {error}</p>;
  if (!graph || graph.nodes.length === 0) return <p>No graph data available.</p>;

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Impact Graph</h3>
      <p style={{ fontSize: 14, color: "#666" }}>
        {graph.nodes.length} symbols, {graph.edges.length} relationships.
        Node size = impact score. Red border = changed file.
      </p>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 8 }}>
        {Object.entries(KIND_COLORS).map(([kind, color]) => (
          <span key={kind}>
            <span style={{ display: "inline-block", width: 10, height: 10, background: color, borderRadius: "50%", marginRight: 4 }} />
            {kind}
          </span>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{ border: "1px solid #eee", borderRadius: 4, maxWidth: "100%" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add graph toggle to AnalysisView**

Modify `frontend/src/components/AnalysisView.tsx` to add an optional graph view:

```tsx
import { useState } from "react";
import type { PRAnalysis, ChangeCluster } from "../types.js";
import Breadcrumbs from "./Breadcrumbs.js";
import ExecutiveSummary from "./ExecutiveSummary.js";
import ClusterList from "./ClusterList.js";
import ClusterDetail from "./ClusterDetail.js";
import GraphView from "./GraphView.js";

interface Props {
  analysis: PRAnalysis;
  onBack: () => void;
}

export default function AnalysisView({ analysis, onBack }: Props) {
  const [selectedCluster, setSelectedCluster] = useState<ChangeCluster | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  const crumbs = [
    { label: "New Analysis", onClick: onBack },
    {
      label: "PR Summary",
      onClick: selectedCluster ? () => setSelectedCluster(null) : undefined,
    },
  ];

  if (selectedCluster) {
    crumbs.push({ label: selectedCluster.name });
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <Breadcrumbs crumbs={crumbs} />
      <ExecutiveSummary analysis={analysis} />

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowGraph(!showGraph)}
          style={{ padding: "4px 12px", fontSize: 13 }}
        >
          {showGraph ? "Hide" : "Show"} Impact Graph
        </button>
      </div>

      {showGraph && <GraphView analysisId={analysis.id} />}

      {selectedCluster ? (
        <ClusterDetail cluster={selectedCluster} />
      ) : (
        <ClusterList
          clusters={analysis.clusters}
          onSelectCluster={setSelectedCluster}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: add GraphView component with canvas-based impact visualization"
```

---

## Task 8: Analyzer — Add NetworkX Dependency & Update pyproject.toml

**Files:**
- Modify: `analyzer/pyproject.toml`

- [ ] **Step 1: Add networkx to dependencies**

Add `"networkx>=3.4.0"` to the `dependencies` list in `analyzer/pyproject.toml`:

```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "tree-sitter>=0.24.0",
    "tree-sitter-python>=0.23.0",
    "tree-sitter-javascript>=0.23.0",
    "tree-sitter-typescript>=0.23.0",
    "tree-sitter-go>=0.23.0",
    "tree-sitter-rust>=0.23.0",
    "tree-sitter-java>=0.23.0",
    "gitpython>=3.1.0",
    "pydantic>=2.10.0",
    "networkx>=3.4.0",
]
```

- [ ] **Step 2: Install and verify**

```bash
cd analyzer && pip install -e ".[dev]"
python -c "import networkx; print(networkx.__version__)"
```
Expected: Prints version without error

- [ ] **Step 3: Commit**

```bash
git add analyzer/pyproject.toml
git commit -m "chore: add networkx dependency for knowledge graph"
```

---

## Task 9: Integration Smoke Test — Phase 3

**Files:**
- No new files

- [ ] **Step 1: Run all analyzer tests**

Run: `cd analyzer && pytest -v`
Expected: ALL PASS

- [ ] **Step 2: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Verify all TypeScript compiles**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Verify Docker Compose build**

Run: `docker compose build`
Expected: All services build successfully

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "chore: Phase 3 integration verification complete"
```

---

## Spec Coverage Verification

| Spec Requirement | Task |
|---|---|
| In-memory knowledge graph (NetworkX) | Task 1 |
| Maps relationships: calls, imports, inherits, implements, tests | Tasks 1, 4 |
| Cross-file impact scoring (highly-connected nodes = higher risk) | Task 2 |
| Enhanced agent prompts include graph context | Task 5 |
| Optional graph visualization showing change impact radius | Task 7 |
| Swappable storage backend (can upgrade later) | Task 1 (NetworkX abstracted behind service) |
| GET /api/analysis/:id/graph endpoint | Task 6 |
| NetworkX dependency | Task 8 |
