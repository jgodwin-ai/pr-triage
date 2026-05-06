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


def _ts_language() -> object:
    # tree-sitter-typescript exposes language_typescript() (TS) and language_tsx() (TSX)
    return tstypescript.language_typescript()


LANGUAGE_FACTORIES: dict[str, object] = {
    "python": tspython.language,
    "javascript": tsjavascript.language,
    "typescript": _ts_language,
    "go": tsgo.language,
    "rust": tsrust.language,
    "java": tsjava.language,
}


def detect_language(file_path: str) -> str | None:
    for ext, lang in EXTENSION_MAP.items():
        if file_path.endswith(ext):
            return lang
    return None


def get_parser(language: str) -> Parser | None:
    factory = LANGUAGE_FACTORIES.get(language)
    if factory is None:
        return None
    lang = Language(factory())
    return Parser(lang)
