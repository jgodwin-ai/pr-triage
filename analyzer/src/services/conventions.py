import re
from src.models import SymbolInfo, ConventionViolation

SNAKE_CASE = re.compile(r"^[a-z][a-z0-9_]*$")
CAMEL_CASE = re.compile(r"^[a-z][a-zA-Z0-9]*$")
PASCAL_CASE = re.compile(r"^[A-Z][a-zA-Z0-9]*$")

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
        # Go exported (PascalCase) and unexported (camelCase) functions are both valid.
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
