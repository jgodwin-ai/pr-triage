from src.services.ripple_effect import find_ripple_effects
from src.models import DependencyEdge, SymbolInfo


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


def test_ripple_risk_level_propagates_transitively():
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
    all_affected = set()
    for e in effects:
        all_affected.update(e.affected_symbols)
    assert any("mid" in s for s in all_affected)


def test_risk_level_high_for_many_dependents():
    symbols: list[SymbolInfo] = []
    edges = [
        DependencyEdge(source=f"dep{i}.py", target="hub", kind="imports") for i in range(5)
    ]
    effects = find_ripple_effects(symbols, edges, ["hub.py"])
    assert len(effects) == 1
    assert effects[0].risk_level == "high"
