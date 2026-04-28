import os
from tree_sitter import Node
from src.models import DependencyEdge
from src.utils.tree_sitter_langs import detect_language, get_parser

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
        for imp in _find_imports(tree.root_node, language):
            edges.append(DependencyEdge(source=file_path, target=imp, kind="imports"))

    return edges
