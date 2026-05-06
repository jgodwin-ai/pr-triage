from src.services.parser import extract_symbols


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


def test_extract_symbols_records_line_ranges(sample_python_file):
    symbols = extract_symbols(sample_python_file)
    helper = next(s for s in symbols if s.name == "helper_function")
    assert helper.line_start > 0
    assert helper.line_end >= helper.line_start
