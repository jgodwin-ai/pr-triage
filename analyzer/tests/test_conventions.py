from src.services.conventions import check_conventions
from src.models import SymbolInfo


def test_python_naming_conventions():
    symbols = [
        SymbolInfo(name="MyClass", kind="class", file_path="app.py", line_start=1, line_end=5),
        SymbolInfo(name="my_function", kind="function", file_path="app.py", line_start=7, line_end=10),
        SymbolInfo(name="badFunction", kind="function", file_path="app.py", line_start=12, line_end=15),
        SymbolInfo(name="bad_class", kind="class", file_path="app.py", line_start=17, line_end=20),
    ]

    violations = check_conventions(symbols, "python")

    msgs = [v.message for v in violations]
    assert any("badFunction" in m for m in msgs)
    assert any("bad_class" in m for m in msgs)
    assert not any("'MyClass'" in m for m in msgs)
    assert not any("'my_function'" in m for m in msgs)


def test_typescript_naming_conventions():
    symbols = [
        SymbolInfo(name="MyClass", kind="class", file_path="app.ts", line_start=1, line_end=5),
        SymbolInfo(name="handleRequest", kind="function", file_path="app.ts", line_start=7, line_end=10),
        SymbolInfo(name="snake_case_func", kind="function", file_path="app.ts", line_start=12, line_end=15),
    ]

    violations = check_conventions(symbols, "typescript")
    msgs = [v.message for v in violations]
    assert any("snake_case_func" in m for m in msgs)
    assert not any("'handleRequest'" in m for m in msgs)


def test_no_violations_for_correct_python():
    symbols = [
        SymbolInfo(name="UserService", kind="class", file_path="user.py", line_start=1, line_end=10),
        SymbolInfo(name="get_user", kind="function", file_path="user.py", line_start=12, line_end=20),
    ]
    violations = check_conventions(symbols, "python")
    assert violations == []


def test_unknown_language_returns_empty():
    symbols = [
        SymbolInfo(name="weird", kind="function", file_path="x.cob", line_start=1, line_end=2),
    ]
    assert check_conventions(symbols, "cobol") == []


def test_go_allows_pascal_or_camel_for_functions():
    symbols = [
        SymbolInfo(name="Exported", kind="function", file_path="m.go", line_start=1, line_end=3),
        SymbolInfo(name="unexported", kind="function", file_path="m.go", line_start=5, line_end=7),
        SymbolInfo(name="snake_case", kind="function", file_path="m.go", line_start=9, line_end=11),
    ]
    violations = check_conventions(symbols, "go")
    msgs = [v.message for v in violations]
    assert not any("'Exported'" in m for m in msgs)
    assert not any("'unexported'" in m for m in msgs)
    assert any("snake_case" in m for m in msgs)


def test_violation_records_include_file_and_line():
    symbols = [
        SymbolInfo(name="badFn", kind="function", file_path="src/x.py", line_start=42, line_end=45),
    ]
    violations = check_conventions(symbols, "python")
    assert len(violations) == 1
    assert violations[0].file_path == "src/x.py"
    assert violations[0].line == 42
