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
