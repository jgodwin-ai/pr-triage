from tree_sitter import Node
from src.models import SymbolInfo
from src.utils.tree_sitter_langs import detect_language, get_parser

# tree-sitter node types that represent symbols we care about, per language.
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
            # Python functions inside a class are methods; tree-sitter doesn't
            # distinguish them syntactically.
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
