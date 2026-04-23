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
