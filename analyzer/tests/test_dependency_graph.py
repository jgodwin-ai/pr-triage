from src.services.dependency_graph import build_dependency_graph


def test_build_dependency_graph_python(tmp_path):
    (tmp_path / "utils.py").write_text(
        "def helper():\n    return 42\n"
    )
    (tmp_path / "main.py").write_text(
        "from utils import helper\n\ndef run():\n    return helper()\n"
    )

    edges = build_dependency_graph(str(tmp_path), ["main.py", "utils.py"])

    import_edges = [e for e in edges if e.kind == "imports"]
    assert len(import_edges) >= 1
    assert any("main.py" in e.source and "utils" in e.target for e in import_edges)


def test_build_dependency_graph_with_calls(tmp_path):
    (tmp_path / "math_utils.py").write_text(
        "def add(a, b):\n    return a + b\n\ndef multiply(a, b):\n    return a * b\n"
    )
    (tmp_path / "calculator.py").write_text(
        "from math_utils import add, multiply\n\n"
        "def calculate(x, y):\n    return add(x, y) + multiply(x, y)\n"
    )

    edges = build_dependency_graph(str(tmp_path), ["calculator.py", "math_utils.py"])
    import_edges = [e for e in edges if e.kind == "imports"]
    assert len(import_edges) >= 1


def test_build_dependency_graph_skips_unsupported_files(tmp_path):
    (tmp_path / "data.csv").write_text("a,b,c\n1,2,3\n")
    edges = build_dependency_graph(str(tmp_path), ["data.csv"])
    assert edges == []


def test_build_dependency_graph_skips_missing_files(tmp_path):
    edges = build_dependency_graph(str(tmp_path), ["does-not-exist.py"])
    assert edges == []


def test_build_dependency_graph_typescript(tmp_path):
    (tmp_path / "lib.ts").write_text("export const v = 1;\n")
    (tmp_path / "app.ts").write_text("import { v } from './lib';\nconsole.log(v);\n")
    edges = build_dependency_graph(str(tmp_path), ["app.ts", "lib.ts"])
    import_edges = [e for e in edges if e.kind == "imports"]
    assert any("app.ts" in e.source for e in import_edges)
