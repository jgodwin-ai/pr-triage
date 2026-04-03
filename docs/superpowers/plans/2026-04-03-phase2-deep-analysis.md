# PR Triage Bot — Phase 2: Deep Code Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Python FastAPI sidecar container that performs structural code analysis — AST parsing, dependency graphs, convention checking, redundancy detection, and test coverage assessment — enriching the Phase 1 LLM-only analysis with grounded, code-structure-based insights.

**Architecture:** New `analyzer` service (Python + FastAPI) runs alongside the existing Node.js backend in Docker Compose. Backend calls analyzer via internal Docker network HTTP. Analyzer shallow-clones the repo, parses it with tree-sitter, builds dependency graphs, and returns structural insights that enrich `ChangeCluster.insights` and `FileAnalysis.annotations`. A new `POST /api/analyze/deep` endpoint triggers the enhanced pipeline.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, tree-sitter + language grammars (Python, TypeScript, JavaScript, Go, Rust, Java), gitpython (for shallow clone), pytest.

**Spec:** `docs/superpowers/specs/2026-04-02-pr-triage-bot-design.md` — Phase 2 section.

**Prerequisite:** Phase 1 MVP must be complete and working.

---

## File Structure

```
analyzer/
├── Dockerfile                      # Python 3.12-slim, installs tree-sitter grammars
├── pyproject.toml                  # Project config, dependencies, pytest config
├── src/
│   ├── main.py                     # FastAPI app entry point
│   ├── models.py                   # Pydantic models matching backend types
│   ├── routers/
│   │   └── analyze.py              # POST /analyze — main analysis endpoint
│   ├── services/
│   │   ├── repo.py                 # Shallow clone + cleanup
│   │   ├── parser.py               # tree-sitter parsing: extract functions, classes, imports
│   │   ├── dependency_graph.py     # Build caller/callee graph from parsed symbols
│   │   ├── ripple_effect.py        # Find affected dependents of changed symbols
│   │   ├── conventions.py          # Check naming, structure, error handling patterns
│   │   ├── redundancy.py           # Detect if new code duplicates existing functionality
│   │   └── test_coverage.py        # Assess whether changed code paths have test coverage
│   └── utils/
│       └── tree_sitter_langs.py    # Language detection + grammar loading
├── tests/
│   ├── conftest.py                 # Shared fixtures (sample repos, parsed trees)
│   ├── test_parser.py
│   ├── test_dependency_graph.py
│   ├── test_ripple_effect.py
│   ├── test_conventions.py
│   ├── test_redundancy.py
│   ├── test_test_coverage.py
│   └── test_api.py                 # Integration test for the FastAPI endpoint
│
backend/  (modifications to existing Phase 1 code)
├── src/
│   ├── services/
│   │   └── analyzer-client.ts      # HTTP client to call the analyzer sidecar
│   ├── routes/
│   │   └── analyze.ts              # Add POST /api/analyze/deep
│   └── services/
│       └── pipeline.ts             # Extend pipeline to merge structural insights
├── tests/
│   └── services/
│       └── analyzer-client.test.ts
│
docker-compose.yml                  # Add analyzer service
```

---

## Task 1: Analyzer Project Scaffolding

**Files:**
- Create: `analyzer/pyproject.toml`
- Create: `analyzer/src/main.py`
- Create: `analyzer/src/models.py`
- Create: `analyzer/Dockerfile`

- [ ] **Step 1: Create analyzer/pyproject.toml**

```toml
[project]
name = "pr-triage-analyzer"
version = "0.1.0"
requires-python = ">=3.12"
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
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "httpx>=0.28.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create analyzer/src/models.py**

Pydantic models that mirror the backend TypeScript types, plus analyzer-specific types:

```python
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    repo_url: str
    base_branch: str
    head_branch: str
    changed_files: list[str]


class SymbolInfo(BaseModel):
    name: str
    kind: str  # "function", "class", "method", "variable"
    file_path: str
    line_start: int
    line_end: int


class DependencyEdge(BaseModel):
    source: str  # "file:symbol"
    target: str  # "file:symbol"
    kind: str  # "calls", "imports", "inherits"


class RippleEffect(BaseModel):
    changed_symbol: str
    affected_symbols: list[str]
    risk_level: str  # "high", "medium", "low"
    reason: str


class ConventionViolation(BaseModel):
    file_path: str
    line: int
    rule: str
    message: str
    severity: str  # "warning", "info"


class RedundancyMatch(BaseModel):
    new_code_file: str
    new_code_symbol: str
    existing_file: str
    existing_symbol: str
    similarity: float
    message: str


class TestCoverageGap(BaseModel):
    file_path: str
    symbol: str
    has_test: bool
    test_file: str | None
    message: str


class FileInsights(BaseModel):
    file_path: str
    ripple_effects: list[RippleEffect]
    convention_violations: list[ConventionViolation]
    redundancies: list[RedundancyMatch]
    test_coverage_gaps: list[TestCoverageGap]


class AnalyzeResponse(BaseModel):
    file_insights: list[FileInsights]
    dependency_edges: list[DependencyEdge]
    summary: str
```

- [ ] **Step 3: Create analyzer/src/main.py**

```python
from fastapi import FastAPI

app = FastAPI(title="PR Triage Analyzer", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create analyzer/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir . && pip install --no-cache-dir ".[dev]"

COPY src/ ./src/
COPY tests/ ./tests/

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "9002"]
```

- [ ] **Step 5: Verify the analyzer starts**

```bash
cd analyzer && pip install -e ".[dev]" && uvicorn src.main:app --port 9002 &
curl http://localhost:9002/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add analyzer/
git commit -m "feat: scaffold analyzer sidecar with FastAPI, Pydantic models, Dockerfile"
```

---

## Task 2: Language Detection & tree-sitter Grammar Loading

**Files:**
- Create: `analyzer/src/utils/tree_sitter_langs.py`
- Create: `analyzer/tests/test_tree_sitter_langs.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_tree_sitter_langs.py`:

```python
from src.utils.tree_sitter_langs import detect_language, get_parser


def test_detect_language_python():
    assert detect_language("src/main.py") == "python"


def test_detect_language_typescript():
    assert detect_language("src/app.ts") == "typescript"
    assert detect_language("src/app.tsx") == "typescript"


def test_detect_language_javascript():
    assert detect_language("src/app.js") == "javascript"
    assert detect_language("src/app.jsx") == "javascript"


def test_detect_language_go():
    assert detect_language("main.go") == "go"


def test_detect_language_rust():
    assert detect_language("src/main.rs") == "rust"


def test_detect_language_java():
    assert detect_language("src/Main.java") == "java"


def test_detect_language_unknown():
    assert detect_language("Makefile") is None
    assert detect_language("data.csv") is None


def test_get_parser_returns_parser_for_known_language():
    parser = get_parser("python")
    assert parser is not None


def test_get_parser_returns_none_for_unknown():
    parser = get_parser("cobol")
    assert parser is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_tree_sitter_langs.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement language detection and parser loading**

Create `analyzer/src/utils/__init__.py` (empty) and `analyzer/src/utils/tree_sitter_langs.py`:

```python
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
import tree_sitter_go as tsgo
import tree_sitter_rust as tsrust
import tree_sitter_java as tsjava
from tree_sitter import Language, Parser

EXTENSION_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
}

LANGUAGE_MODULES: dict[str, object] = {
    "python": tspython,
    "javascript": tsjavascript,
    "typescript": tstypescript,
    "go": tsgo,
    "rust": tsrust,
    "java": tsjava,
}


def detect_language(file_path: str) -> str | None:
    for ext, lang in EXTENSION_MAP.items():
        if file_path.endswith(ext):
            return lang
    return None


def get_parser(language: str) -> Parser | None:
    module = LANGUAGE_MODULES.get(language)
    if module is None:
        return None
    lang = Language(module.language())
    parser = Parser(lang)
    return parser
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_tree_sitter_langs.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/utils/ analyzer/tests/test_tree_sitter_langs.py
git commit -m "feat: add language detection and tree-sitter parser loading"
```

---

## Task 3: Repo Cloning Service

**Files:**
- Create: `analyzer/src/services/repo.py`
- Create: `analyzer/tests/test_repo.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_repo.py`:

```python
import os
import pytest
from unittest.mock import patch, MagicMock
from src.services.repo import clone_repo, cleanup_repo


def test_clone_repo_creates_directory(tmp_path):
    with patch("src.services.repo.Repo") as MockRepo:
        MockRepo.clone_from.return_value = MagicMock()
        result = clone_repo(
            "https://github.com/octocat/hello-world.git",
            "main",
            base_dir=str(tmp_path),
        )
        assert result.startswith(str(tmp_path))
        MockRepo.clone_from.assert_called_once()
        call_kwargs = MockRepo.clone_from.call_args
        assert call_kwargs[1]["depth"] == 1
        assert call_kwargs[1]["branch"] == "main"


def test_cleanup_repo_removes_directory(tmp_path):
    repo_dir = tmp_path / "test-repo"
    repo_dir.mkdir()
    (repo_dir / "file.txt").write_text("content")

    cleanup_repo(str(repo_dir))
    assert not repo_dir.exists()


def test_cleanup_repo_ignores_nonexistent_directory():
    cleanup_repo("/nonexistent/path/that/does/not/exist")
    # Should not raise
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_repo.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the repo cloning service**

Create `analyzer/src/services/__init__.py` (empty) and `analyzer/src/services/repo.py`:

```python
import os
import shutil
import uuid
from git import Repo


def clone_repo(
    repo_url: str,
    branch: str,
    base_dir: str = "/tmp/pr-triage",
) -> str:
    repo_id = uuid.uuid4().hex[:12]
    clone_dir = os.path.join(base_dir, repo_id)
    os.makedirs(clone_dir, exist_ok=True)

    Repo.clone_from(
        repo_url,
        clone_dir,
        depth=1,
        branch=branch,
        single_branch=True,
    )

    return clone_dir


def cleanup_repo(repo_dir: str) -> None:
    if os.path.exists(repo_dir):
        shutil.rmtree(repo_dir)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_repo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/ analyzer/tests/test_repo.py
git commit -m "feat: add repo shallow clone and cleanup service"
```

---

## Task 4: AST Parser — Extract Symbols from Source Files

**Files:**
- Create: `analyzer/src/services/parser.py`
- Create: `analyzer/tests/test_parser.py`
- Create: `analyzer/tests/conftest.py`

- [ ] **Step 1: Create shared test fixtures**

Create `analyzer/tests/conftest.py`:

```python
import os
import pytest


@pytest.fixture
def sample_python_file(tmp_path):
    code = '''
import os
from pathlib import Path

class FileManager:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir

    def read_file(self, name: str) -> str:
        path = Path(self.base_dir) / name
        return path.read_text()

    def write_file(self, name: str, content: str) -> None:
        path = Path(self.base_dir) / name
        path.write_text(content)

def helper_function(x: int) -> int:
    return x * 2
'''
    file_path = tmp_path / "file_manager.py"
    file_path.write_text(code)
    return str(file_path)


@pytest.fixture
def sample_typescript_file(tmp_path):
    code = '''
import { Router } from "express";
import { parsePrUrl } from "../services/github";

const router = Router();

export function handleAnalyze(req: Request, res: Response): void {
    const url = parsePrUrl(req.body.prUrl);
    res.json({ ok: true });
}

export class AnalyzerService {
    constructor(private client: ApiClient) {}

    async analyze(url: string): Promise<Result> {
        return this.client.post("/analyze", { url });
    }
}
'''
    file_path = tmp_path / "analyze.ts"
    file_path.write_text(code)
    return str(file_path)
```

- [ ] **Step 2: Write the failing test**

Create `analyzer/tests/test_parser.py`:

```python
from src.services.parser import extract_symbols
from src.models import SymbolInfo


def test_extract_symbols_python(sample_python_file):
    symbols = extract_symbols(sample_python_file)

    names = [s.name for s in symbols]
    assert "FileManager" in names
    assert "read_file" in names
    assert "write_file" in names
    assert "helper_function" in names

    class_sym = next(s for s in symbols if s.name == "FileManager")
    assert class_sym.kind == "class"

    func_sym = next(s for s in symbols if s.name == "helper_function")
    assert func_sym.kind == "function"

    method_sym = next(s for s in symbols if s.name == "read_file")
    assert method_sym.kind == "method"


def test_extract_symbols_typescript(sample_typescript_file):
    symbols = extract_symbols(sample_typescript_file)

    names = [s.name for s in symbols]
    assert "handleAnalyze" in names
    assert "AnalyzerService" in names
    assert "analyze" in names


def test_extract_symbols_unknown_extension(tmp_path):
    file_path = tmp_path / "Makefile"
    file_path.write_text("all:\n\techo hello")
    symbols = extract_symbols(str(file_path))
    assert symbols == []
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_parser.py -v`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the AST parser**

Create `analyzer/src/services/parser.py`:

```python
from tree_sitter import Node
from src.models import SymbolInfo
from src.utils.tree_sitter_langs import detect_language, get_parser

# tree-sitter node types that represent symbols we care about, per language
SYMBOL_QUERIES: dict[str, dict[str, str]] = {
    "python": {
        "function_definition": "function",
        "class_definition": "class",
    },
    "typescript": {
        "function_declaration": "function",
        "class_declaration": "class",
        "method_definition": "method",
    },
    "javascript": {
        "function_declaration": "function",
        "class_declaration": "class",
        "method_definition": "method",
    },
    "go": {
        "function_declaration": "function",
        "method_declaration": "method",
        "type_declaration": "class",
    },
    "rust": {
        "function_item": "function",
        "impl_item": "class",
        "struct_item": "class",
    },
    "java": {
        "method_declaration": "method",
        "class_declaration": "class",
    },
}


def _get_name(node: Node) -> str | None:
    for child in node.children:
        if child.type in ("identifier", "name", "type_identifier", "property_identifier"):
            return child.text.decode("utf-8") if child.text else None
    return None


def _walk_tree(
    node: Node,
    file_path: str,
    language: str,
    parent_kind: str | None = None,
) -> list[SymbolInfo]:
    symbols: list[SymbolInfo] = []
    node_types = SYMBOL_QUERIES.get(language, {})

    if node.type in node_types:
        name = _get_name(node)
        if name:
            kind = node_types[node.type]
            # Python methods are functions inside a class
            if language == "python" and kind == "function" and parent_kind == "class":
                kind = "method"
            symbols.append(
                SymbolInfo(
                    name=name,
                    kind=kind,
                    file_path=file_path,
                    line_start=node.start_point[0] + 1,
                    line_end=node.end_point[0] + 1,
                )
            )

    for child in node.children:
        child_parent = node_types.get(node.type, parent_kind)
        symbols.extend(_walk_tree(child, file_path, language, child_parent))

    return symbols


def extract_symbols(file_path: str) -> list[SymbolInfo]:
    language = detect_language(file_path)
    if language is None:
        return []

    parser = get_parser(language)
    if parser is None:
        return []

    with open(file_path, "rb") as f:
        source = f.read()

    tree = parser.parse(source)
    return _walk_tree(tree.root_node, file_path, language)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_parser.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add analyzer/src/services/parser.py analyzer/tests/test_parser.py analyzer/tests/conftest.py
git commit -m "feat: add AST parser extracting symbols via tree-sitter"
```

---

## Task 5: Dependency Graph Construction

**Files:**
- Create: `analyzer/src/services/dependency_graph.py`
- Create: `analyzer/tests/test_dependency_graph.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_dependency_graph.py`:

```python
import os
from src.services.dependency_graph import build_dependency_graph
from src.models import DependencyEdge


def test_build_dependency_graph_python(tmp_path):
    # Create a small Python project
    (tmp_path / "utils.py").write_text(
        "def helper():\n    return 42\n"
    )
    (tmp_path / "main.py").write_text(
        "from utils import helper\n\ndef run():\n    return helper()\n"
    )

    edges = build_dependency_graph(str(tmp_path), ["main.py", "utils.py"])

    # Should find that main.py imports from utils.py
    import_edges = [e for e in edges if e.kind == "imports"]
    assert len(import_edges) >= 1
    assert any("main.py" in e.source and "utils" in e.target for e in import_edges)


def test_build_dependency_graph_with_calls(tmp_path):
    (tmp_path / "math_utils.py").write_text(
        "def add(a, b):\n    return a + b\n\ndef multiply(a, b):\n    return a * b\n"
    )
    (tmp_path / "calculator.py").write_text(
        "from math_utils import add, multiply\n\ndef calculate(x, y):\n    return add(x, y) + multiply(x, y)\n"
    )

    edges = build_dependency_graph(str(tmp_path), ["calculator.py", "math_utils.py"])

    import_edges = [e for e in edges if e.kind == "imports"]
    assert len(import_edges) >= 1


def test_build_dependency_graph_skips_unsupported_files(tmp_path):
    (tmp_path / "data.csv").write_text("a,b,c\n1,2,3\n")
    edges = build_dependency_graph(str(tmp_path), ["data.csv"])
    assert edges == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_dependency_graph.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement dependency graph construction**

Create `analyzer/src/services/dependency_graph.py`:

```python
import os
import re
from tree_sitter import Node
from src.models import DependencyEdge
from src.utils.tree_sitter_langs import detect_language, get_parser

# Import node types per language
IMPORT_NODE_TYPES: dict[str, list[str]] = {
    "python": ["import_statement", "import_from_statement"],
    "typescript": ["import_statement"],
    "javascript": ["import_statement"],
    "go": ["import_declaration"],
    "rust": ["use_declaration"],
    "java": ["import_declaration"],
}


def _extract_import_source(node: Node, language: str) -> str | None:
    if language == "python":
        for child in node.children:
            if child.type == "dotted_name":
                return child.text.decode("utf-8") if child.text else None
        # import_from_statement: look for module_name
        for child in node.children:
            if child.type == "module_name" or (
                child.type == "dotted_name" and node.type == "import_from_statement"
            ):
                return child.text.decode("utf-8") if child.text else None

    if language in ("typescript", "javascript"):
        for child in node.children:
            if child.type == "string":
                text = child.text.decode("utf-8") if child.text else ""
                return text.strip("\"'")

    return node.text.decode("utf-8") if node.text else None


def _find_imports(root: Node, language: str) -> list[str]:
    import_types = IMPORT_NODE_TYPES.get(language, [])
    sources: list[str] = []

    def walk(node: Node) -> None:
        if node.type in import_types:
            source = _extract_import_source(node, language)
            if source:
                sources.append(source)
        for child in node.children:
            walk(child)

    walk(root)
    return sources


def build_dependency_graph(
    repo_dir: str,
    changed_files: list[str],
) -> list[DependencyEdge]:
    edges: list[DependencyEdge] = []

    for file_path in changed_files:
        full_path = os.path.join(repo_dir, file_path)
        if not os.path.isfile(full_path):
            continue

        language = detect_language(file_path)
        if language is None:
            continue

        parser = get_parser(language)
        if parser is None:
            continue

        with open(full_path, "rb") as f:
            source = f.read()

        tree = parser.parse(source)
        imports = _find_imports(tree.root_node, language)

        for imp in imports:
            edges.append(
                DependencyEdge(
                    source=file_path,
                    target=imp,
                    kind="imports",
                )
            )

    return edges
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_dependency_graph.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/dependency_graph.py analyzer/tests/test_dependency_graph.py
git commit -m "feat: add dependency graph construction from import analysis"
```

---

## Task 6: Ripple Effect Analysis

**Files:**
- Create: `analyzer/src/services/ripple_effect.py`
- Create: `analyzer/tests/test_ripple_effect.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_ripple_effect.py`:

```python
from src.services.ripple_effect import find_ripple_effects
from src.models import DependencyEdge, SymbolInfo, RippleEffect


def test_finds_affected_dependents():
    symbols = [
        SymbolInfo(name="helper", kind="function", file_path="utils.py", line_start=1, line_end=3),
        SymbolInfo(name="run", kind="function", file_path="main.py", line_start=3, line_end=5),
        SymbolInfo(name="test_run", kind="function", file_path="test_main.py", line_start=1, line_end=5),
    ]
    edges = [
        DependencyEdge(source="main.py", target="utils", kind="imports"),
        DependencyEdge(source="test_main.py", target="main", kind="imports"),
    ]
    changed_files = ["utils.py"]

    effects = find_ripple_effects(symbols, edges, changed_files)

    assert len(effects) >= 1
    affected_files = set()
    for e in effects:
        for s in e.affected_symbols:
            affected_files.add(s.split(":")[0] if ":" in s else s)
    assert "main.py" in affected_files


def test_no_ripple_for_isolated_file():
    symbols = [
        SymbolInfo(name="standalone", kind="function", file_path="standalone.py", line_start=1, line_end=3),
    ]
    edges: list[DependencyEdge] = []
    changed_files = ["standalone.py"]

    effects = find_ripple_effects(symbols, edges, changed_files)
    assert len(effects) == 0 or all(len(e.affected_symbols) == 0 for e in effects)


def test_ripple_risk_level_based_on_depth():
    symbols = [
        SymbolInfo(name="core", kind="function", file_path="core.py", line_start=1, line_end=3),
        SymbolInfo(name="mid", kind="function", file_path="mid.py", line_start=1, line_end=3),
        SymbolInfo(name="outer", kind="function", file_path="outer.py", line_start=1, line_end=3),
    ]
    edges = [
        DependencyEdge(source="mid.py", target="core", kind="imports"),
        DependencyEdge(source="outer.py", target="mid", kind="imports"),
    ]
    changed_files = ["core.py"]

    effects = find_ripple_effects(symbols, edges, changed_files)

    # core.py changes should propagate to mid and outer
    all_affected = set()
    for e in effects:
        all_affected.update(e.affected_symbols)
    assert any("mid" in s for s in all_affected)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_ripple_effect.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ripple effect analysis**

Create `analyzer/src/services/ripple_effect.py`:

```python
from collections import defaultdict
from src.models import DependencyEdge, SymbolInfo, RippleEffect


def _build_reverse_graph(edges: list[DependencyEdge]) -> dict[str, list[str]]:
    """Build a reverse dependency map: target -> list of sources that depend on it."""
    reverse: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        # Normalize target: "utils" matches "utils.py"
        target = edge.target
        reverse[target].append(edge.source)
        # Also register with .py stripped for matching
        if target.endswith(".py"):
            reverse[target[:-3]].append(edge.source)
    return reverse


def _file_stem(file_path: str) -> str:
    """Get file stem without extension: 'utils.py' -> 'utils'."""
    if "." in file_path:
        return file_path.rsplit(".", 1)[0]
    return file_path


def find_ripple_effects(
    symbols: list[SymbolInfo],
    edges: list[DependencyEdge],
    changed_files: list[str],
    max_depth: int = 3,
) -> list[RippleEffect]:
    reverse_graph = _build_reverse_graph(edges)
    results: list[RippleEffect] = []

    for changed_file in changed_files:
        # Find all files that transitively depend on this changed file
        affected: list[str] = []
        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(changed_file, 0)]

        # Also try matching by stem
        stem = _file_stem(changed_file)

        while queue:
            current, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            current_stem = _file_stem(current)
            dependents: list[str] = []
            dependents.extend(reverse_graph.get(current, []))
            dependents.extend(reverse_graph.get(current_stem, []))

            for dep in dependents:
                if dep not in visited and dep != changed_file:
                    visited.add(dep)
                    affected.append(dep)
                    queue.append((dep, depth + 1))

        if affected:
            risk = "high" if len(affected) >= 3 else "medium" if len(affected) >= 1 else "low"
            results.append(
                RippleEffect(
                    changed_symbol=changed_file,
                    affected_symbols=affected,
                    risk_level=risk,
                    reason=f"Changes to {changed_file} may affect {len(affected)} dependent file(s)",
                )
            )

    return results
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_ripple_effect.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/ripple_effect.py analyzer/tests/test_ripple_effect.py
git commit -m "feat: add ripple effect analysis for transitive dependency tracking"
```

---

## Task 7: Convention Checking

**Files:**
- Create: `analyzer/src/services/conventions.py`
- Create: `analyzer/tests/test_conventions.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_conventions.py`:

```python
from src.services.conventions import check_conventions
from src.models import SymbolInfo, ConventionViolation


def test_python_naming_conventions():
    symbols = [
        SymbolInfo(name="MyClass", kind="class", file_path="app.py", line_start=1, line_end=5),
        SymbolInfo(name="my_function", kind="function", file_path="app.py", line_start=7, line_end=10),
        SymbolInfo(name="badFunction", kind="function", file_path="app.py", line_start=12, line_end=15),
        SymbolInfo(name="bad_class", kind="class", file_path="app.py", line_start=17, line_end=20),
    ]

    violations = check_conventions(symbols, "python")

    violation_names = [v.message for v in violations]
    # camelCase function in Python should be flagged
    assert any("badFunction" in m for m in violation_names)
    # lowercase class in Python should be flagged
    assert any("bad_class" in m for m in violation_names)
    # Correct names should not be flagged
    assert not any("MyClass" in m and "convention" in m.lower() for m in violation_names)
    assert not any("my_function" in m and "convention" in m.lower() for m in violation_names)


def test_typescript_naming_conventions():
    symbols = [
        SymbolInfo(name="MyClass", kind="class", file_path="app.ts", line_start=1, line_end=5),
        SymbolInfo(name="handleRequest", kind="function", file_path="app.ts", line_start=7, line_end=10),
        SymbolInfo(name="snake_case_func", kind="function", file_path="app.ts", line_start=12, line_end=15),
    ]

    violations = check_conventions(symbols, "typescript")

    violation_names = [v.message for v in violations]
    assert any("snake_case_func" in m for m in violation_names)


def test_no_violations_for_correct_code():
    symbols = [
        SymbolInfo(name="UserService", kind="class", file_path="user.py", line_start=1, line_end=10),
        SymbolInfo(name="get_user", kind="function", file_path="user.py", line_start=12, line_end=20),
    ]

    violations = check_conventions(symbols, "python")
    assert len(violations) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_conventions.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement convention checking**

Create `analyzer/src/services/conventions.py`:

```python
import re
from src.models import SymbolInfo, ConventionViolation

SNAKE_CASE = re.compile(r"^[a-z][a-z0-9_]*$")
CAMEL_CASE = re.compile(r"^[a-z][a-zA-Z0-9]*$")
PASCAL_CASE = re.compile(r"^[A-Z][a-zA-Z0-9]*$")

# Per-language naming conventions: kind -> expected pattern
CONVENTIONS: dict[str, dict[str, tuple[re.Pattern, str]]] = {
    "python": {
        "function": (SNAKE_CASE, "snake_case"),
        "method": (SNAKE_CASE, "snake_case"),
        "class": (PASCAL_CASE, "PascalCase"),
    },
    "typescript": {
        "function": (CAMEL_CASE, "camelCase"),
        "method": (CAMEL_CASE, "camelCase"),
        "class": (PASCAL_CASE, "PascalCase"),
    },
    "javascript": {
        "function": (CAMEL_CASE, "camelCase"),
        "method": (CAMEL_CASE, "camelCase"),
        "class": (PASCAL_CASE, "PascalCase"),
    },
    "go": {
        "function": (CAMEL_CASE, "camelCase or PascalCase"),
        "class": (PASCAL_CASE, "PascalCase"),
    },
    "java": {
        "method": (CAMEL_CASE, "camelCase"),
        "class": (PASCAL_CASE, "PascalCase"),
    },
}


def check_conventions(
    symbols: list[SymbolInfo],
    language: str,
) -> list[ConventionViolation]:
    lang_conventions = CONVENTIONS.get(language, {})
    if not lang_conventions:
        return []

    violations: list[ConventionViolation] = []

    for symbol in symbols:
        convention = lang_conventions.get(symbol.kind)
        if convention is None:
            continue

        pattern, expected_style = convention
        # Special case: Go exported functions can be PascalCase
        if language == "go" and symbol.kind == "function":
            if CAMEL_CASE.match(symbol.name) or PASCAL_CASE.match(symbol.name):
                continue

        if not pattern.match(symbol.name):
            violations.append(
                ConventionViolation(
                    file_path=symbol.file_path,
                    line=symbol.line_start,
                    rule=f"{symbol.kind}-naming",
                    message=f"{symbol.kind.capitalize()} '{symbol.name}' doesn't follow {language} convention ({expected_style})",
                    severity="info",
                )
            )

    return violations
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_conventions.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/conventions.py analyzer/tests/test_conventions.py
git commit -m "feat: add naming convention checker for Python, TS, JS, Go, Java"
```

---

## Task 8: Redundancy Detection

**Files:**
- Create: `analyzer/src/services/redundancy.py`
- Create: `analyzer/tests/test_redundancy.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_redundancy.py`:

```python
from src.services.redundancy import detect_redundancies
from src.models import SymbolInfo, RedundancyMatch


def test_detects_similar_function_names():
    existing_symbols = [
        SymbolInfo(name="validate_email", kind="function", file_path="validators.py", line_start=1, line_end=5),
        SymbolInfo(name="parse_date", kind="function", file_path="utils.py", line_start=1, line_end=5),
    ]
    new_symbols = [
        SymbolInfo(name="validate_email_address", kind="function", file_path="new_validators.py", line_start=1, line_end=5),
    ]

    matches = detect_redundancies(new_symbols, existing_symbols)

    assert len(matches) >= 1
    assert matches[0].existing_symbol == "validate_email"
    assert matches[0].new_code_symbol == "validate_email_address"


def test_no_redundancy_for_unique_functions():
    existing_symbols = [
        SymbolInfo(name="connect_db", kind="function", file_path="db.py", line_start=1, line_end=5),
    ]
    new_symbols = [
        SymbolInfo(name="render_template", kind="function", file_path="views.py", line_start=1, line_end=5),
    ]

    matches = detect_redundancies(new_symbols, existing_symbols)
    assert len(matches) == 0


def test_ignores_same_file():
    existing_symbols = [
        SymbolInfo(name="helper", kind="function", file_path="utils.py", line_start=1, line_end=5),
    ]
    new_symbols = [
        SymbolInfo(name="helper", kind="function", file_path="utils.py", line_start=1, line_end=5),
    ]

    matches = detect_redundancies(new_symbols, existing_symbols)
    assert len(matches) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_redundancy.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement redundancy detection**

Uses simple name similarity (Jaccard on word tokens). This avoids heavy ML deps — Phase 3's knowledge graph can enhance this later.

Create `analyzer/src/services/redundancy.py`:

```python
import re
from src.models import SymbolInfo, RedundancyMatch

SPLIT_PATTERN = re.compile(r"[_\-]+|(?<=[a-z])(?=[A-Z])")


def _tokenize(name: str) -> set[str]:
    """Split a symbol name into word tokens."""
    parts = SPLIT_PATTERN.split(name)
    return {p.lower() for p in parts if p}


def _similarity(a: set[str], b: set[str]) -> float:
    """Jaccard similarity between two token sets."""
    if not a or not b:
        return 0.0
    intersection = a & b
    union = a | b
    return len(intersection) / len(union)


SIMILARITY_THRESHOLD = 0.5


def detect_redundancies(
    new_symbols: list[SymbolInfo],
    existing_symbols: list[SymbolInfo],
) -> list[RedundancyMatch]:
    matches: list[RedundancyMatch] = []

    for new_sym in new_symbols:
        new_tokens = _tokenize(new_sym.name)
        if not new_tokens:
            continue

        for existing_sym in existing_symbols:
            # Skip if same file (not a redundancy, just an update)
            if new_sym.file_path == existing_sym.file_path:
                continue
            # Only compare same kind
            if new_sym.kind != existing_sym.kind:
                continue

            existing_tokens = _tokenize(existing_sym.name)
            sim = _similarity(new_tokens, existing_tokens)

            if sim >= SIMILARITY_THRESHOLD:
                matches.append(
                    RedundancyMatch(
                        new_code_file=new_sym.file_path,
                        new_code_symbol=new_sym.name,
                        existing_file=existing_sym.file_path,
                        existing_symbol=existing_sym.name,
                        similarity=round(sim, 2),
                        message=f"'{new_sym.name}' in {new_sym.file_path} may duplicate '{existing_sym.name}' in {existing_sym.file_path} (similarity: {sim:.0%})",
                    )
                )

    return matches
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_redundancy.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/redundancy.py analyzer/tests/test_redundancy.py
git commit -m "feat: add redundancy detection via name similarity"
```

---

## Task 9: Test Coverage Assessment

**Files:**
- Create: `analyzer/src/services/test_coverage.py`
- Create: `analyzer/tests/test_test_coverage.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_test_coverage.py`:

```python
import os
from src.services.test_coverage import assess_test_coverage
from src.models import SymbolInfo, TestCoverageGap


def test_finds_tested_symbols(tmp_path):
    (tmp_path / "utils.py").write_text("def helper():\n    return 42\n")
    (tmp_path / "test_utils.py").write_text(
        "from utils import helper\n\ndef test_helper():\n    assert helper() == 42\n"
    )

    symbols = [
        SymbolInfo(name="helper", kind="function", file_path="utils.py", line_start=1, line_end=2),
    ]

    gaps = assess_test_coverage(symbols, str(tmp_path))

    assert len(gaps) == 1
    assert gaps[0].has_test is True
    assert gaps[0].test_file == "test_utils.py"


def test_finds_untested_symbols(tmp_path):
    (tmp_path / "service.py").write_text("def process():\n    pass\n")
    # No test file exists

    symbols = [
        SymbolInfo(name="process", kind="function", file_path="service.py", line_start=1, line_end=2),
    ]

    gaps = assess_test_coverage(symbols, str(tmp_path))

    assert len(gaps) == 1
    assert gaps[0].has_test is False
    assert gaps[0].test_file is None


def test_handles_nested_test_directories(tmp_path):
    os.makedirs(tmp_path / "src")
    os.makedirs(tmp_path / "tests")
    (tmp_path / "src" / "auth.py").write_text("def login():\n    pass\n")
    (tmp_path / "tests" / "test_auth.py").write_text(
        "from src.auth import login\n\ndef test_login():\n    login()\n"
    )

    symbols = [
        SymbolInfo(name="login", kind="function", file_path="src/auth.py", line_start=1, line_end=2),
    ]

    gaps = assess_test_coverage(symbols, str(tmp_path))

    assert len(gaps) == 1
    assert gaps[0].has_test is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_test_coverage.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement test coverage assessment**

Create `analyzer/src/services/test_coverage.py`:

```python
import os
import re
from src.models import SymbolInfo, TestCoverageGap


def _find_test_files(repo_dir: str) -> list[str]:
    """Find all test files in the repo by naming convention."""
    test_files: list[str] = []
    for root, _dirs, files in os.walk(repo_dir):
        for f in files:
            if (f.startswith("test_") or f.endswith("_test.py") or f.endswith(".test.ts") or f.endswith(".test.js") or f.endswith("_test.go") or f.endswith("Test.java")):
                rel_path = os.path.relpath(os.path.join(root, f), repo_dir)
                test_files.append(rel_path)
    return test_files


def _file_stem(file_path: str) -> str:
    """Get the base filename without extension or directory."""
    basename = os.path.basename(file_path)
    return basename.rsplit(".", 1)[0] if "." in basename else basename


def _test_file_references_symbol(
    test_file_path: str,
    symbol_name: str,
    repo_dir: str,
) -> bool:
    """Check if a test file references a given symbol name."""
    full_path = os.path.join(repo_dir, test_file_path)
    if not os.path.isfile(full_path):
        return False
    try:
        content = open(full_path).read()
        return symbol_name in content
    except (OSError, UnicodeDecodeError):
        return False


def assess_test_coverage(
    symbols: list[SymbolInfo],
    repo_dir: str,
) -> list[TestCoverageGap]:
    test_files = _find_test_files(repo_dir)
    results: list[TestCoverageGap] = []

    for symbol in symbols:
        source_stem = _file_stem(symbol.file_path)

        # Find candidate test files by naming convention
        candidates = [
            tf for tf in test_files
            if source_stem in _file_stem(tf)
        ]

        found_test_file: str | None = None
        has_test = False

        for candidate in candidates:
            if _test_file_references_symbol(candidate, symbol.name, repo_dir):
                found_test_file = candidate
                has_test = True
                break

        # If no matching test references the symbol, check if a test file exists at all
        if not has_test and candidates:
            found_test_file = None

        message = (
            f"'{symbol.name}' in {symbol.file_path} is tested in {found_test_file}"
            if has_test
            else f"'{symbol.name}' in {symbol.file_path} has no test coverage"
        )

        results.append(
            TestCoverageGap(
                file_path=symbol.file_path,
                symbol=symbol.name,
                has_test=has_test,
                test_file=found_test_file,
                message=message,
            )
        )

    return results
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_test_coverage.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add analyzer/src/services/test_coverage.py analyzer/tests/test_test_coverage.py
git commit -m "feat: add test coverage assessment via naming convention heuristics"
```

---

## Task 10: Analyzer API Endpoint — POST /analyze

**Files:**
- Create: `analyzer/src/routers/__init__.py`
- Create: `analyzer/src/routers/analyze.py`
- Modify: `analyzer/src/main.py` (mount router)
- Create: `analyzer/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

Create `analyzer/tests/test_api.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.fixture
def mock_clone():
    with patch("src.routers.analyze.clone_repo") as mock:
        mock.return_value = "/tmp/test-repo"
        yield mock


@pytest.fixture
def mock_cleanup():
    with patch("src.routers.analyze.cleanup_repo") as mock:
        yield mock


@pytest.fixture
def mock_extract():
    with patch("src.routers.analyze.extract_symbols") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_graph():
    with patch("src.routers.analyze.build_dependency_graph") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_ripple():
    with patch("src.routers.analyze.find_ripple_effects") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_conventions():
    with patch("src.routers.analyze.check_conventions") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_redundancy():
    with patch("src.routers.analyze.detect_redundancies") as mock:
        mock.return_value = []
        yield mock


@pytest.fixture
def mock_coverage():
    with patch("src.routers.analyze.assess_test_coverage") as mock:
        mock.return_value = []
        yield mock


async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}


async def test_analyze_endpoint(
    mock_clone, mock_cleanup, mock_extract, mock_graph,
    mock_ripple, mock_conventions, mock_redundancy, mock_coverage
):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/analyze", json={
            "repo_url": "https://github.com/octocat/hello-world.git",
            "base_branch": "main",
            "head_branch": "feature",
            "changed_files": ["src/app.py"],
        })
        assert res.status_code == 200
        body = res.json()
        assert "file_insights" in body
        assert "dependency_edges" in body
        assert "summary" in body

    mock_clone.assert_called_once()
    mock_cleanup.assert_called_once()


async def test_analyze_validates_request():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/analyze", json={})
        assert res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd analyzer && pytest tests/test_api.py -v`
Expected: FAIL — module not found / endpoint not found

- [ ] **Step 3: Implement the analyze router**

Create `analyzer/src/routers/__init__.py` (empty) and `analyzer/src/routers/analyze.py`:

```python
import os
from collections import defaultdict
from fastapi import APIRouter
from src.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    FileInsights,
)
from src.services.repo import clone_repo, cleanup_repo
from src.services.parser import extract_symbols
from src.services.dependency_graph import build_dependency_graph
from src.services.ripple_effect import find_ripple_effects
from src.services.conventions import check_conventions
from src.services.redundancy import detect_redundancies
from src.services.test_coverage import assess_test_coverage
from src.utils.tree_sitter_langs import detect_language

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    repo_dir = clone_repo(request.repo_url, request.base_branch)

    try:
        # 1. Parse all changed files to extract symbols
        all_symbols = []
        symbols_by_file = defaultdict(list)
        for file_path in request.changed_files:
            full_path = os.path.join(repo_dir, file_path)
            if os.path.isfile(full_path):
                file_symbols = extract_symbols(full_path)
                # Normalize file paths to be relative
                for s in file_symbols:
                    s.file_path = file_path
                all_symbols.extend(file_symbols)
                symbols_by_file[file_path] = file_symbols

        # 2. Build dependency graph
        dep_edges = build_dependency_graph(repo_dir, request.changed_files)

        # 3. Find ripple effects
        ripple_effects = find_ripple_effects(all_symbols, dep_edges, request.changed_files)

        # 4. Check conventions per file
        all_violations = []
        for file_path, symbols in symbols_by_file.items():
            language = detect_language(file_path)
            if language:
                violations = check_conventions(symbols, language)
                all_violations.extend(violations)

        # 5. Detect redundancy — compare new symbols against all repo symbols
        # For MVP, compare changed file symbols against each other
        all_repo_symbols = []
        for root, _dirs, files in os.walk(repo_dir):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, repo_dir)
                if rel in request.changed_files:
                    continue  # Skip changed files for existing comparison
                if detect_language(rel):
                    repo_syms = extract_symbols(full)
                    for s in repo_syms:
                        s.file_path = rel
                    all_repo_symbols.extend(repo_syms)

        redundancies = detect_redundancies(all_symbols, all_repo_symbols)

        # 6. Assess test coverage
        coverage_gaps = assess_test_coverage(all_symbols, repo_dir)

        # 7. Assemble per-file insights
        violations_by_file = defaultdict(list)
        for v in all_violations:
            violations_by_file[v.file_path].append(v)

        redundancies_by_file = defaultdict(list)
        for r in redundancies:
            redundancies_by_file[r.new_code_file].append(r)

        ripple_by_file = defaultdict(list)
        for r in ripple_effects:
            ripple_by_file[r.changed_symbol].append(r)

        coverage_by_file = defaultdict(list)
        for c in coverage_gaps:
            coverage_by_file[c.file_path].append(c)

        file_insights = []
        for file_path in request.changed_files:
            file_insights.append(
                FileInsights(
                    file_path=file_path,
                    ripple_effects=ripple_by_file.get(file_path, []),
                    convention_violations=violations_by_file.get(file_path, []),
                    redundancies=redundancies_by_file.get(file_path, []),
                    test_coverage_gaps=coverage_by_file.get(file_path, []),
                )
            )

        # Summary line
        total_issues = len(all_violations) + len(redundancies) + sum(
            1 for c in coverage_gaps if not c.has_test
        )
        summary = f"Analyzed {len(request.changed_files)} files: {len(all_symbols)} symbols, {len(dep_edges)} dependencies, {total_issues} issues found"

        return AnalyzeResponse(
            file_insights=file_insights,
            dependency_edges=dep_edges,
            summary=summary,
        )

    finally:
        cleanup_repo(repo_dir)
```

- [ ] **Step 4: Mount the router in main.py**

Replace `analyzer/src/main.py`:

```python
from fastapi import FastAPI
from src.routers.analyze import router as analyze_router

app = FastAPI(title="PR Triage Analyzer", version="0.1.0")

app.include_router(analyze_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd analyzer && pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add analyzer/src/routers/ analyzer/src/main.py analyzer/tests/test_api.py
git commit -m "feat: add POST /analyze endpoint orchestrating all analysis services"
```

---

## Task 11: Backend — Analyzer Client

**Files:**
- Create: `backend/src/services/analyzer-client.ts`
- Create: `backend/tests/services/analyzer-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/services/analyzer-client.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { callAnalyzer } from "../../src/services/analyzer-client.js";

describe("callAnalyzer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct request and returns parsed response", async () => {
    const mockResponse = {
      file_insights: [],
      dependency_edges: [],
      summary: "Analyzed 2 files",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await callAnalyzer({
      repoUrl: "https://github.com/octocat/repo.git",
      baseBranch: "main",
      headBranch: "feature",
      changedFiles: ["src/a.ts", "src/b.ts"],
    });

    expect(result.summary).toBe("Analyzed 2 files");
    expect(result.fileInsights).toEqual([]);
    expect(result.dependencyEdges).toEqual([]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/analyze"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(
      callAnalyzer({
        repoUrl: "https://github.com/octocat/repo.git",
        baseBranch: "main",
        headBranch: "feature",
        changedFiles: ["src/a.ts"],
      })
    ).rejects.toThrow("Analyzer returned 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/services/analyzer-client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the analyzer client**

Create `backend/src/services/analyzer-client.ts`:

```typescript
interface AnalyzerRequest {
  repoUrl: string;
  baseBranch: string;
  headBranch: string;
  changedFiles: string[];
}

interface FileInsight {
  filePath: string;
  rippleEffects: Array<{
    changedSymbol: string;
    affectedSymbols: string[];
    riskLevel: string;
    reason: string;
  }>;
  conventionViolations: Array<{
    filePath: string;
    line: number;
    rule: string;
    message: string;
    severity: string;
  }>;
  redundancies: Array<{
    newCodeFile: string;
    newCodeSymbol: string;
    existingFile: string;
    existingSymbol: string;
    similarity: number;
    message: string;
  }>;
  testCoverageGaps: Array<{
    filePath: string;
    symbol: string;
    hasTest: boolean;
    testFile: string | null;
    message: string;
  }>;
}

interface AnalyzerResponse {
  fileInsights: FileInsight[];
  dependencyEdges: Array<{
    source: string;
    target: string;
    kind: string;
  }>;
  summary: string;
}

const ANALYZER_URL = process.env.ANALYZER_URL || "http://localhost:9002";

export async function callAnalyzer(request: AnalyzerRequest): Promise<AnalyzerResponse> {
  const res = await fetch(`${ANALYZER_URL}/analyze`, {
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
    throw new Error(`Analyzer returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  // Transform snake_case Python response to camelCase
  return {
    fileInsights: (data.file_insights ?? []).map((fi: any) => ({
      filePath: fi.file_path,
      rippleEffects: fi.ripple_effects ?? [],
      conventionViolations: fi.convention_violations ?? [],
      redundancies: fi.redundancies ?? [],
      testCoverageGaps: fi.test_coverage_gaps ?? [],
    })),
    dependencyEdges: (data.dependency_edges ?? []).map((e: any) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    })),
    summary: data.summary,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/services/analyzer-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/analyzer-client.ts backend/tests/services/analyzer-client.test.ts
git commit -m "feat: add analyzer HTTP client with snake_case to camelCase transform"
```

---

## Task 12: Backend — Deep Analysis Endpoint & Pipeline Integration

**Files:**
- Modify: `backend/src/routes/analyze.ts` (add `POST /api/analyze/deep`)
- Modify: `backend/src/services/pipeline.ts` (accept optional structural insights)
- Modify: `backend/src/types.ts` (add insight types)
- Modify: `backend/src/index.ts` (wire deep pipeline)

- [ ] **Step 1: Extend types.ts with structural insight types**

Add to `backend/src/types.ts`:

```typescript
export interface StructuralInsights {
  fileInsights: Array<{
    filePath: string;
    rippleEffects: Array<{ changedSymbol: string; affectedSymbols: string[]; riskLevel: string; reason: string }>;
    conventionViolations: Array<{ filePath: string; line: number; rule: string; message: string; severity: string }>;
    redundancies: Array<{ message: string }>;
    testCoverageGaps: Array<{ symbol: string; hasTest: boolean; message: string }>;
  }>;
  summary: string;
}
```

- [ ] **Step 2: Update pipeline.ts to merge structural insights into clusters**

Add an optional `structuralInsights` field to `PipelineDeps` and merge insights into cluster `insights[]` arrays after clustering:

```typescript
// Add to PipelineDeps interface:
structuralInsights?: StructuralInsights;

// After clustering (Stage 2), before ranking (Stage 3), add:
if (deps.structuralInsights) {
  const insightsByFile = new Map(
    deps.structuralInsights.fileInsights.map((fi) => [fi.filePath, fi])
  );

  for (const cluster of clusters) {
    for (const file of cluster.files) {
      const fi = insightsByFile.get(file.path);
      if (!fi) continue;

      for (const r of fi.rippleEffects) {
        cluster.insights.push(`Ripple: ${r.reason}`);
      }
      for (const v of fi.conventionViolations) {
        cluster.insights.push(`Convention: ${v.message}`);
      }
      for (const r of fi.redundancies) {
        cluster.insights.push(`Redundancy: ${r.message}`);
      }
      for (const t of fi.testCoverageGaps) {
        if (!t.hasTest) {
          cluster.insights.push(`Missing test: ${t.message}`);
        }
      }
    }
  }
}
```

- [ ] **Step 3: Add POST /api/analyze/deep route to analyze.ts**

Add to `backend/src/routes/analyze.ts`:

```typescript
router.post("/deep", (req, res) => {
  const { prUrl, anthropicApiKey, githubToken } = req.body as AnalyzeRequest;

  if (!prUrl) {
    res.status(400).json({ error: "prUrl is required" });
    return;
  }

  try {
    parsePrUrl(prUrl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const effectiveAnthropicKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const effectiveGithubToken = githubToken || process.env.GITHUB_TOKEN;

  if (!effectiveAnthropicKey || !effectiveGithubToken) {
    res.status(400).json({ error: "Both Anthropic API key and GitHub token are required" });
    return;
  }

  const analysisId = uuidv4();
  analyses.set(analysisId, { status: "running" });

  if (req.app.locals.startDeepPipeline) {
    req.app.locals.startDeepPipeline(analysisId, prUrl, effectiveAnthropicKey, effectiveGithubToken);
  }

  res.status(202).json({ analysisId });
});
```

- [ ] **Step 4: Wire deep pipeline in index.ts**

Add to `backend/src/index.ts`:

```typescript
import { callAnalyzer } from "./services/analyzer-client.js";

app.locals.startDeepPipeline = async (
  analysisId: string,
  prUrl: string,
  anthropicKey: string,
  githubToken: string
) => {
  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const octokit = createOctokit(githubToken);
    const parts = parsePrUrl(prUrl);

    broadcast(wss, { type: "status", stage: "fetching-pr", progress: "loading PR data" });
    const prData = await fetchPR(parts, octokit);

    // Call analyzer sidecar for structural insights
    broadcast(wss, { type: "status", stage: "file-analysis", progress: "running deep analysis" });
    const repoUrl = `https://github.com/${parts.owner}/${parts.repo}.git`;
    const structuralInsights = await callAnalyzer({
      repoUrl,
      baseBranch: prData.metadata.baseBranch,
      headBranch: prData.metadata.headBranch,
      changedFiles: prData.files.map((f) => f.filename),
    });

    const analysis = await runPipeline(prData, {
      analyzeFile: (file) => analyzeFile(file, client),
      clusterFiles: (files) => clusterFiles(files, client),
      rankAndSynthesize: (metadata, clusters) =>
        rankAndSynthesize(metadata, clusters, client),
      onMessage: (msg) => broadcast(wss, msg),
      structuralInsights,
    });

    setAnalysis(analysisId, analysis);
  } catch (err: any) {
    broadcast(wss, { type: "error", error: err.message });
  }
};
```

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/ backend/tests/
git commit -m "feat: add deep analysis endpoint integrating analyzer sidecar insights"
```

---

## Task 13: Docker Compose — Add Analyzer Service

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Add analyzer service to docker-compose.yml**

Add to `docker-compose.yml` services:

```yaml
  analyzer:
    build:
      context: ./analyzer
      dockerfile: Dockerfile
    ports:
      - "${PORT_PREFIX:-90}02:9002"
    environment:
      - PORT=9002
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9002/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Update the existing "app" service to depend on analyzer:
  app:
    # ... existing config ...
    environment:
      - PORT=9000
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - ANALYZER_URL=http://analyzer:9002
    depends_on:
      analyzer:
        condition: service_healthy
```

- [ ] **Step 2: Update .env.example**

Add to `.env.example`:

```
# Analyzer sidecar URL (auto-configured in Docker, override for local dev)
ANALYZER_URL=http://localhost:9002
```

- [ ] **Step 3: Verify Docker build**

Run: `docker compose build`
Expected: Both app and analyzer build successfully

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add analyzer sidecar to Docker Compose with health check"
```

---

## Task 14: Integration Smoke Test — Phase 2

**Files:**
- No new files

- [ ] **Step 1: Run all analyzer tests**

Run: `cd analyzer && pytest -v`
Expected: ALL PASS

- [ ] **Step 2: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Verify TypeScript and Python compile cleanly**

Run: `cd backend && npx tsc --noEmit && cd ../analyzer && python -m py_compile src/main.py`
Expected: No errors

- [ ] **Step 4: Verify full Docker Compose build**

Run: `docker compose build`
Expected: All services build successfully

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: Phase 2 integration verification complete"
```

---

## Spec Coverage Verification

| Spec Requirement | Task |
|---|---|
| Python FastAPI sidecar | Tasks 1, 10 |
| Separate Dockerfile (Python base image) | Task 1 |
| Shallow clone of the repo | Task 3 |
| AST parsing via tree-sitter (multi-language) | Tasks 2, 4 |
| Dependency graph construction | Task 5 |
| Ripple effect analysis | Task 6 |
| Convention checking | Task 7 |
| Redundancy detection | Task 8 |
| Test coverage assessment | Task 9 |
| Results enrich ChangeCluster and FileAnalysis | Task 12 |
| Backend calls analyzer via internal Docker network | Tasks 11, 13 |
| POST /api/analyze/deep endpoint | Task 12 |
| Analyzer not exposed externally | Task 13 (internal Docker network) |
