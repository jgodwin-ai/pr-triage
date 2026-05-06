from collections import defaultdict
from src.models import DependencyEdge, SymbolInfo, RippleEffect


def _build_reverse_graph(edges: list[DependencyEdge]) -> dict[str, list[str]]:
    """Build target -> [sources that depend on it]. Indexed by both the literal
    target string and its stem so 'utils' matches 'utils.py'."""
    reverse: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        target = edge.target
        reverse[target].append(edge.source)
        if "." in target:
            reverse[target.rsplit(".", 1)[0]].append(edge.source)
    return reverse


def _file_stem(file_path: str) -> str:
    if "." in file_path:
        return file_path.rsplit(".", 1)[0]
    return file_path


def find_ripple_effects(
    symbols: list[SymbolInfo],
    edges: list[DependencyEdge],
    changed_files: list[str],
    max_depth: int = 3,
) -> list[RippleEffect]:
    reverse_graph = _build_reverse_graph(edges)
    results: list[RippleEffect] = []

    for changed_file in changed_files:
        affected: list[str] = []
        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(changed_file, 0)]

        while queue:
            current, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            current_stem = _file_stem(current)
            dependents: list[str] = []
            dependents.extend(reverse_graph.get(current, []))
            dependents.extend(reverse_graph.get(current_stem, []))

            for dep in dependents:
                if dep not in visited and dep != changed_file:
                    visited.add(dep)
                    affected.append(dep)
                    queue.append((dep, depth + 1))

        if affected:
            risk = "high" if len(affected) >= 3 else "medium" if len(affected) >= 1 else "low"
            results.append(
                RippleEffect(
                    changed_symbol=changed_file,
                    affected_symbols=affected,
                    risk_level=risk,
                    reason=f"Changes to {changed_file} may affect {len(affected)} dependent file(s)",
                )
            )

    return results
