#!/usr/bin/env python3
"""
Phase 4 of the scoped-attribute-values feature.

Static AST checker that flags two anti-patterns:

  1. Bare `<x>.attribute_values.add(...)` calls.

     Direct M2M writes bypass the apps.inventory.services.attribute_scope
     helpers and the m2m_changed pre_add validator only catches calls
     that route through Django's signal pipeline (DRF requests, ORM
     update calls). Code that wants to add a value SHOULD call
     `assign_attribute_value(product, value)` so:
        - scope rules are checked before the write
        - the operator_override flag is honored
        - audit / future hooks fire centrally

  2. Bare `<x>.scope_categories.add(...)` / scope_countries / scope_brands.

     Scope edits should go through the dedicated link_brand /
     link_attribute style endpoints (or through the wizard's
     apply_scope_suggestion) so the audit trail (Phase 5) records the
     diff. Bare adds skip that.

Usage
─────
    python scripts/lint/check_attribute_scope.py [path…]

Returns:
    0 if clean
    1 if any violations found

Suppressing
───────────
Add `# linter: noqa-attribute-scope <reason>` on the line of the
.add() call. The reason is required (lint will reject empty
suppressions in a future revision).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path
from dataclasses import dataclass


# ── Config ───────────────────────────────────────────────────────────

# M2M attribute names whose .add()/.remove()/.set() should be flagged.
GUARDED_M2M = {
    'attribute_values':  'use assign_attribute_value(product, value) instead',
    'scope_categories':  'use link_attribute / unlink_attribute on the dedicated endpoints',
    'scope_countries':   'use link_attribute / unlink_attribute on the dedicated endpoints',
    'scope_brands':      'use link_attribute / unlink_attribute on the dedicated endpoints',
}

# Files / dirs to never scan (third-party, generated, frozen).
SKIP_DIRS = {'venv', '.venv', 'node_modules', 'migrations', '__pycache__', '.git'}

# Files where these patterns are legitimate (the implementation itself).
ALLOWED_FILES = {
    'apps/inventory/services/attribute_scope.py',     # the helper itself
    'apps/inventory/services/scope_suggester.py',     # scope edits via apply_scope_suggestion
    'apps/inventory/signals.py',                      # the m2m_changed handler
    'apps/inventory/views/attribute_views.py',        # explicit add/remove endpoints
}


@dataclass
class Violation:
    file: str
    line: int
    col: int
    attr: str
    advice: str

    def __str__(self) -> str:
        return f'{self.file}:{self.line}:{self.col} — bare `.{self.attr}.add(...)`; {self.advice}'


def _has_noqa(source_lines: list[str], lineno: int) -> bool:
    """Match a `# linter: noqa-attribute-scope <reason>` comment on the same line."""
    if 0 < lineno <= len(source_lines):
        return 'noqa-attribute-scope' in source_lines[lineno - 1]
    return False


def check_file(path: Path) -> list[Violation]:
    src = path.read_text(encoding='utf-8', errors='replace')
    try:
        tree = ast.parse(src, filename=str(path))
    except SyntaxError:
        return []  # let the syntax checker surface real parse errors
    lines = src.splitlines()
    relpath = str(path)
    found: list[Violation] = []

    class Visitor(ast.NodeVisitor):
        def visit_Call(self, node: ast.Call):
            # Looking for `<expr>.<m2m>.add(...)` style calls.
            #   Call(func=Attribute(value=Attribute(attr=<m2m>), attr='add'))
            f = node.func
            if (
                isinstance(f, ast.Attribute) and
                f.attr in ('add', 'remove', 'set', 'clear') and
                isinstance(f.value, ast.Attribute) and
                f.value.attr in GUARDED_M2M
            ):
                attr = f.value.attr
                if not _has_noqa(lines, node.lineno):
                    found.append(Violation(
                        file=relpath, line=node.lineno, col=node.col_offset,
                        attr=attr, advice=GUARDED_M2M[attr],
                    ))
            self.generic_visit(node)

    Visitor().visit(tree)
    return found


def _is_skipped(path: Path) -> bool:
    parts = set(path.parts)
    if parts & SKIP_DIRS:
        return True
    rel = str(path)
    for allowed in ALLOWED_FILES:
        # Match suffix so the check works whether the run is from repo
        # root or a subdir.
        if rel.endswith(allowed):
            return True
    return False


def collect_files(roots: list[str]) -> list[Path]:
    out: list[Path] = []
    for root in roots:
        p = Path(root)
        if p.is_file() and p.suffix == '.py':
            out.append(p)
            continue
        if p.is_dir():
            for f in p.rglob('*.py'):
                if not _is_skipped(f):
                    out.append(f)
    return out


def main(argv: list[str]) -> int:
    roots = argv[1:] or ['erp_backend']
    files = collect_files(roots)
    all_violations: list[Violation] = []
    for f in files:
        all_violations.extend(check_file(f))
    if not all_violations:
        print(f'check_attribute_scope: clean ({len(files)} files scanned)')
        return 0
    print(f'check_attribute_scope: {len(all_violations)} violation(s) found:\n')
    for v in all_violations:
        print(f'  {v}')
    print('\nSuppress legitimate cases with: # linter: noqa-attribute-scope <reason>')
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
