#!/usr/bin/env python3
"""audit_drift.py - comprehensive Django migration drift detector.

Statically scans every migration in the repo against 9 of the 10 documented
drift categories (A-J). Category H is runtime-only (cascade-drop walks the
live Python registry); it is noted but not detected.

Categories:
    A - AlterField on a field not yet in state
    B - RemoveField on a field not yet in state
    C - RemoveIndex / RenameIndex on a non-existent index
    D - DeleteModel / RenameModel on a non-existent model
    E - Module-level `from apps.X.models import Y` where Y is no longer in source
    F - AddField on a field already in state
    G - RenameIndex on an index that may not exist on fresh replay
        (RenameIndex outside SeparateDatabaseAndState, especially after
         AlterModelTable on the same model in the prior 5 ops)
    H - Cascade-drop walks live registry (runtime-only - not detected here)
    I - Cross-app model ownership transfer without paired RemoveModel
    J - Multiple parallel `_initial` branches in one app

Usage:
    python3 scripts/release/audit_drift.py
    python3 scripts/release/audit_drift.py --app inventory
    python3 scripts/release/audit_drift.py --category F
    python3 scripts/release/audit_drift.py --quiet
    python3 scripts/release/audit_drift.py --json

Exit codes:
    0 - no critical drift found (Cats A/B/C/D/E/F/G clean)
    1 - critical drift detected (must be fixed before merge)

Cat I/J findings do NOT trigger exit 1 by themselves - they require a
release-cut squash to resolve (see scripts/release/squash_for_release.py),
not inline patches. They are reported as informational.

Should run in CI on every PR touching `migrations/`.
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional

# ──────────────────────────────────────────────────────────────────────
# Repo paths
# ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
ERP_BACKEND = SCRIPT_DIR.parent.parent  # erp_backend/scripts/release/ → erp_backend/

# App label overrides for apps where the directory name differs from the
# Django app_label (parsed from `apps.py: label = '...'`).
APP_LABEL_OVERRIDES = {
    'core': 'apps_core',
    'migration': 'data_migration',
}

CATEGORY_DESCRIPTIONS = {
    'A': 'AlterField on missing field',
    'B': 'RemoveField on missing field',
    'C': 'RemoveIndex/RenameIndex on missing index',
    'D': 'DeleteModel/RenameModel on missing model',
    'E': 'broken module-level model import',
    'F': 'AddField on existing field',
    'G': 'RenameIndex unsafe (post-AlterModelTable, not state-only)',
    'H': 'cascade-drop walks live registry (runtime-only)',
    'I': 'cross-app ownership transfer without RemoveModel',
    'J': 'parallel `_initial` branches with shared number prefixes',
}

CRITICAL_CATEGORIES = ('A', 'B', 'C', 'D', 'E', 'F', 'G')
SQUASH_REQUIRED_CATEGORIES = ('I', 'J')


# ──────────────────────────────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────────────────────────────

@dataclass
class Finding:
    category: str
    app: str
    file: str           # repo-relative path
    line: Optional[int]
    message: str

    def to_dict(self) -> dict:
        return {
            'category': self.category,
            'app': self.app,
            'file': self.file,
            'line': self.line,
            'message': self.message,
        }


@dataclass
class ParsedOp:
    """A flattened migration operation extracted via AST."""
    op_name: str
    line: int
    in_state_only: bool         # True if inside SeparateDatabaseAndState.state_operations
    in_database_only: bool      # True if inside SeparateDatabaseAndState.database_operations
    model_name: Optional[str] = None      # for AddField/AlterField/RemoveField/etc
    field_name: Optional[str] = None      # the `name` for field/index ops
    new_name: Optional[str] = None        # for RenameField / RenameIndex / RenameModel
    fields_list: Optional[list[str]] = None     # for CreateModel
    index_names_in_meta: Optional[list[str]] = None  # for CreateModel options.indexes
    db_table: Optional[str] = None        # for CreateModel.options.db_table or AlterModelTable.table


@dataclass
class AppState:
    """Virtual model + index state for a single app."""
    # model_name -> {'fields': set[str], 'indexes': set[str], 'db_table': str|None}
    models: dict = field(default_factory=lambda: defaultdict(lambda: {
        'fields': set(),
        'indexes': set(),
        'db_table': None,
    }))


# ──────────────────────────────────────────────────────────────────────
# AST helpers
# ──────────────────────────────────────────────────────────────────────

def _const(node: ast.AST) -> Optional[object]:
    if isinstance(node, ast.Constant):
        return node.value
    return None


def _extract_options_dict(node: ast.AST) -> dict:
    """Extract a literal dict (str keys / str values) from `options=...` kw."""
    out: dict = {}
    if not isinstance(node, ast.Dict):
        return out
    for k_node, v_node in zip(node.keys, node.values):
        k = _const(k_node)
        if not isinstance(k, str):
            continue
        if k == 'indexes' and isinstance(v_node, ast.List):
            names = []
            for idx_call in v_node.elts:
                if isinstance(idx_call, ast.Call):
                    for kw in idx_call.keywords:
                        if kw.arg == 'name' and isinstance(kw.value, ast.Constant):
                            names.append(kw.value.value)
            out['indexes'] = names
        else:
            v = _const(v_node)
            if v is not None:
                out[k] = v
    return out


def _walk_op(node: ast.AST, *, state_only=False, database_only=False) -> Iterable[ParsedOp]:
    """Recursively yield ParsedOp items for a single operations-list element.

    Unwraps SeparateDatabaseAndState into its inner state/database ops.
    """
    if not isinstance(node, ast.Call):
        return
    func = node.func
    if not isinstance(func, ast.Attribute):
        return
    op_name = func.attr

    if op_name == 'SeparateDatabaseAndState':
        for kw in node.keywords:
            if kw.arg == 'state_operations' and isinstance(kw.value, ast.List):
                for inner in kw.value.elts:
                    yield from _walk_op(inner, state_only=True, database_only=False)
            elif kw.arg == 'database_operations' and isinstance(kw.value, ast.List):
                for inner in kw.value.elts:
                    yield from _walk_op(inner, state_only=False, database_only=True)
        return

    line = getattr(node, 'lineno', 0)
    parsed = ParsedOp(
        op_name=op_name,
        line=line,
        in_state_only=state_only,
        in_database_only=database_only,
    )

    for kw in node.keywords:
        if kw.arg == 'model_name':
            v = _const(kw.value)
            if isinstance(v, str):
                parsed.model_name = v
        elif kw.arg == 'name':
            v = _const(kw.value)
            if isinstance(v, str):
                if op_name in ('CreateModel', 'DeleteModel', 'RenameModel'):
                    parsed.model_name = v.lower()
                elif op_name in (
                    'AlterModelTable', 'AlterModelOptions', 'AlterModelManagers',
                    'AlterUniqueTogether', 'AlterIndexTogether', 'AlterOrderWithRespectTo',
                ):
                    # `name` is the model name (case-preserving); store in model_name
                    parsed.model_name = v
                else:
                    parsed.field_name = v
        elif kw.arg == 'old_name':
            v = _const(kw.value)
            if isinstance(v, str):
                parsed.field_name = v
        elif kw.arg == 'new_name':
            v = _const(kw.value)
            if isinstance(v, str):
                parsed.new_name = v
        elif kw.arg == 'fields' and isinstance(kw.value, ast.List):
            names = []
            for tup in kw.value.elts:
                if isinstance(tup, ast.Tuple) and tup.elts:
                    fn = _const(tup.elts[0])
                    if isinstance(fn, str):
                        names.append(fn)
            parsed.fields_list = names
        elif kw.arg == 'options':
            opts = _extract_options_dict(kw.value)
            if 'db_table' in opts:
                parsed.db_table = opts['db_table']
            if 'indexes' in opts:
                parsed.index_names_in_meta = opts['indexes']
        elif kw.arg == 'index' and isinstance(kw.value, ast.Call):
            # AddIndex(model_name=..., index=models.Index(name=...))
            for sub in kw.value.keywords:
                if sub.arg == 'name':
                    v = _const(sub.value)
                    if isinstance(v, str):
                        parsed.field_name = v  # store in field_name slot
        elif kw.arg == 'table':
            v = _const(kw.value)
            if isinstance(v, str):
                parsed.db_table = v

    yield parsed


def parse_migration_ops(path: Path) -> list[ParsedOp]:
    """Return the flat operation list for a migration file."""
    try:
        text = path.read_text()
    except Exception:
        return []
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    ops: list[ParsedOp] = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.ClassDef) and node.name == 'Migration'):
            continue
        for item in node.body:
            if not isinstance(item, ast.Assign):
                continue
            targets = [t.id for t in item.targets if isinstance(t, ast.Name)]
            if 'operations' in targets and isinstance(item.value, ast.List):
                for op in item.value.elts:
                    ops.extend(_walk_op(op))
    return ops


def parse_top_level_imports(path: Path) -> list[tuple[str, list[str], int]]:
    """Return [(module, [names], lineno)] for top-level `from X import Y` lines."""
    try:
        tree = ast.parse(path.read_text())
    except Exception:
        return []
    out = []
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module:
            names = [alias.name for alias in node.names]
            out.append((node.module, names, node.lineno))
    return out


# ──────────────────────────────────────────────────────────────────────
# App discovery
# ──────────────────────────────────────────────────────────────────────

def discover_apps() -> list[tuple[str, Path]]:
    """Return [(app_label, migrations_dir)] for every app with a migrations/ dir.

    Looks under erp_backend/apps/* and erp_backend/erp/.
    """
    apps_root = ERP_BACKEND / 'apps'
    out: list[tuple[str, Path]] = []

    # erp_backend/erp/migrations
    erp_dir = ERP_BACKEND / 'erp' / 'migrations'
    if erp_dir.is_dir():
        out.append(('erp', erp_dir))

    # erp_backend/apps/<dir>/migrations
    if apps_root.is_dir():
        for child in sorted(apps_root.iterdir()):
            if not child.is_dir():
                continue
            md = child / 'migrations'
            if md.is_dir():
                label = APP_LABEL_OVERRIDES.get(child.name, child.name)
                out.append((label, md))

    return out


def list_migration_files(migrations_dir: Path) -> list[Path]:
    return sorted(
        f for f in migrations_dir.iterdir()
        if f.suffix == '.py' and f.stem != '__init__'
    )


def repo_relative(path: Path) -> str:
    try:
        return str(path.relative_to(ERP_BACKEND))
    except ValueError:
        return str(path)


def models_classes_in_source(app_dir: Path) -> Optional[set[str]]:
    """Parse the app's models.py / models/__init__.py and return defined class names.

    Returns None if neither exists (we can't validate; treat imports as ok).
    """
    candidates = [
        app_dir / 'models.py',
        app_dir / 'models' / '__init__.py',
    ]
    seen: set[str] = set()
    found_any = False
    for c in candidates:
        if not c.is_file():
            continue
        found_any = True
        try:
            tree = ast.parse(c.read_text())
        except Exception:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                seen.add(node.name)
            elif isinstance(node, ast.ImportFrom):
                # `from .x import Y` re-exports — count Y as visible
                for alias in node.names:
                    seen.add(alias.asname or alias.name)
    # Also scan sibling files in models/ package directory
    pkg_dir = app_dir / 'models'
    if pkg_dir.is_dir():
        found_any = True
        for sub in pkg_dir.iterdir():
            if sub.suffix != '.py' or sub.name == '__init__.py':
                continue
            try:
                tree = ast.parse(sub.read_text())
            except Exception:
                continue
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    seen.add(node.name)
    return seen if found_any else None


# ──────────────────────────────────────────────────────────────────────
# Detectors
# ──────────────────────────────────────────────────────────────────────

def detect_state_drift_for_app(
    app_label: str,
    migrations_dir: Path,
    *,
    db_table_to_app: dict[str, str],
) -> tuple[list[Finding], dict[str, set[str]]]:
    """Detect Cats A/B/C/D/F/G for one app using a per-app virtual state walk.

    Also populates `db_table_to_app` with (db_table -> app_label) ownership
    info so the caller can compute Category I afterwards.

    Returns (findings, model_field_sets) — the latter feeds Cat E checks.
    """
    findings: list[Finding] = []
    state = AppState()
    files = list_migration_files(migrations_dir)

    for f in files:
        ops = parse_migration_ops(f)
        # Track operations within this file for Cat G heuristic
        # (we examine prior 5 ops for an AlterModelTable on the same model)
        ops_window: list[ParsedOp] = []

        for op in ops:
            rel = repo_relative(f)
            ops_window.append(op)

            if op.op_name == 'CreateModel' and op.model_name:
                model = op.model_name
                state.models[model]['fields'] = set(op.fields_list or [])
                if op.index_names_in_meta:
                    state.models[model]['indexes'] |= set(op.index_names_in_meta)
                if op.db_table:
                    state.models[model]['db_table'] = op.db_table
                    db_table_to_app[op.db_table] = app_label

            elif op.op_name == 'DeleteModel' and op.model_name:
                if op.model_name not in state.models:
                    findings.append(Finding(
                        'D', app_label, rel, op.line,
                        f"DeleteModel('{op.model_name}') — model not in state",
                    ))
                else:
                    state.models.pop(op.model_name, None)

            elif op.op_name == 'RenameModel' and op.model_name and op.new_name:
                # `name` was lowercased into model_name; new_name is the new name
                old = op.model_name
                if old not in state.models:
                    findings.append(Finding(
                        'D', app_label, rel, op.line,
                        f"RenameModel('{old}' → '{op.new_name}') — model not in state",
                    ))
                else:
                    state.models[op.new_name.lower()] = state.models.pop(old)

            elif op.op_name == 'AddField' and op.model_name and op.field_name:
                fields = state.models[op.model_name]['fields']
                if op.field_name in fields and not op.in_database_only:
                    findings.append(Finding(
                        'F', app_label, rel, op.line,
                        f"AddField {op.model_name}.{op.field_name} — already in state",
                    ))
                fields.add(op.field_name)

            elif op.op_name == 'RemoveField' and op.model_name and op.field_name:
                fields = state.models[op.model_name]['fields']
                if op.field_name not in fields and not op.in_database_only:
                    findings.append(Finding(
                        'B', app_label, rel, op.line,
                        f"RemoveField {op.model_name}.{op.field_name} — not in state",
                    ))
                fields.discard(op.field_name)

            elif op.op_name == 'RenameField' and op.model_name and op.field_name and op.new_name:
                fields = state.models[op.model_name]['fields']
                if op.field_name not in fields and not op.in_database_only:
                    findings.append(Finding(
                        'B', app_label, rel, op.line,
                        f"RenameField {op.model_name}.{op.field_name} → {op.new_name} — old name not in state",
                    ))
                fields.discard(op.field_name)
                fields.add(op.new_name)

            elif op.op_name == 'AlterField' and op.model_name and op.field_name:
                fields = state.models[op.model_name]['fields']
                if op.field_name not in fields and not op.in_database_only:
                    findings.append(Finding(
                        'A', app_label, rel, op.line,
                        f"AlterField {op.model_name}.{op.field_name} — field not in state",
                    ))

            elif op.op_name == 'AddIndex' and op.model_name and op.field_name:
                state.models[op.model_name]['indexes'].add(op.field_name)

            elif op.op_name == 'RemoveIndex' and op.model_name and op.field_name:
                indexes = state.models[op.model_name]['indexes']
                if op.field_name not in indexes and not op.in_database_only:
                    findings.append(Finding(
                        'C', app_label, rel, op.line,
                        f"RemoveIndex {op.model_name} '{op.field_name}' — index not in state",
                    ))
                indexes.discard(op.field_name)

            elif op.op_name == 'RenameIndex' and op.model_name:
                indexes = state.models[op.model_name]['indexes']
                old = op.field_name
                new = op.new_name
                if old and old not in indexes and not op.in_database_only:
                    findings.append(Finding(
                        'C', app_label, rel, op.line,
                        f"RenameIndex {op.model_name} '{old}' → '{new}' — old index not in state",
                    ))
                # Cat G: RenameIndex outside SeparateDatabaseAndState
                # is risky if any AlterModelTable ran on this model
                # in the prior 5 ops within this file.
                if not (op.in_state_only or op.in_database_only):
                    recent = ops_window[-6:-1]
                    altered_table_recently = any(
                        prev.op_name == 'AlterModelTable' and prev.model_name == op.model_name
                        for prev in recent
                    )
                    if altered_table_recently:
                        findings.append(Finding(
                            'G', app_label, rel, op.line,
                            f"RenameIndex {op.model_name} '{old}' → '{new}' "
                            f"— unsafe: not wrapped in SeparateDatabaseAndState "
                            f"after AlterModelTable on the same model",
                        ))
                if old:
                    indexes.discard(old)
                if new:
                    indexes.add(new)

            elif op.op_name == 'AlterModelTable' and op.model_name and op.db_table:
                state.models[op.model_name]['db_table'] = op.db_table
                # Track first-seen owner; if already owned by a different app,
                # the earlier app retains primary ownership.
                db_table_to_app.setdefault(op.db_table, app_label)

    # Build snapshot of model -> fields for Cat E (caller may use)
    snapshot = {m: set(d['fields']) for m, d in state.models.items()}
    return findings, snapshot


def detect_broken_imports(app_label: str, migrations_dir: Path) -> list[Finding]:
    """Cat E: module-level imports of model classes that no longer exist in source."""
    findings: list[Finding] = []
    files = list_migration_files(migrations_dir)
    # Pre-cache models per imported app
    cache: dict[str, Optional[set[str]]] = {}

    for f in files:
        for module, names, lineno in parse_top_level_imports(f):
            # Match `apps.X.models` or `apps.X.models.Y`
            m = re.match(r'^(apps|erp)\.([\w_]+)\.models(?:\.([\w_]+))?$', module)
            if not m:
                # Also catch `apps.X.models` without sub-module
                m2 = re.match(r'^(apps|erp)\.([\w_]+)\.models$', module)
                if not m2:
                    continue
            top, app_dir_name = m.group(1), m.group(2)
            if top == 'apps':
                app_dir = ERP_BACKEND / 'apps' / app_dir_name
            else:
                app_dir = ERP_BACKEND / 'erp'
            cache_key = f"{top}/{app_dir_name}"
            if cache_key not in cache:
                cache[cache_key] = models_classes_in_source(app_dir)
            classes = cache[cache_key]
            if classes is None:
                continue
            for name in names:
                if name == '*':
                    continue
                if name not in classes:
                    findings.append(Finding(
                        'E', app_label, repo_relative(f), lineno,
                        f"`from {module} import {name}` — class not found in source models",
                    ))
    return findings


def detect_cross_app_ownership_conflicts(
    apps: list[tuple[str, Path]],
) -> list[Finding]:
    """Cat I: a CreateModel(db_table='X') in one app where 'X' was previously
    set by AlterModelTable in a different app and no RemoveModel/DeleteModel
    in the prior owner accompanies it.

    We do this in two passes:
        1. First pass: gather (app, file, model, db_table, op_kind) for every
           CreateModel-with-db_table and every AlterModelTable.
        2. For each CreateModel(db_table='X'), if any earlier (by file path)
           AlterModelTable in *another* app set the same db_table, and that
           app does not have a corresponding DeleteModel/RemoveModel, flag it.
    """
    create_records: list[dict] = []   # {app, file, line, model, db_table}
    alter_records: list[dict] = []    # {app, file, line, model, db_table}
    delete_records: set[tuple[str, str]] = set()  # (app, model_lower)

    for app_label, migrations_dir in apps:
        for f in list_migration_files(migrations_dir):
            for op in parse_migration_ops(f):
                if op.op_name == 'CreateModel' and op.model_name and op.db_table:
                    create_records.append({
                        'app': app_label,
                        'file': repo_relative(f),
                        'line': op.line,
                        'model': op.model_name,
                        'db_table': op.db_table,
                    })
                elif op.op_name == 'AlterModelTable' and op.model_name and op.db_table:
                    alter_records.append({
                        'app': app_label,
                        'file': repo_relative(f),
                        'line': op.line,
                        'model': op.model_name,
                        'db_table': op.db_table,
                    })
                elif op.op_name in ('DeleteModel', 'RemoveModel') and op.model_name:
                    delete_records.add((app_label, op.model_name.lower()))

    findings: list[Finding] = []
    # Index alters by db_table
    alters_by_table: dict[str, list[dict]] = defaultdict(list)
    for r in alter_records:
        alters_by_table[r['db_table']].append(r)

    for c in create_records:
        prior_alters = [
            a for a in alters_by_table.get(c['db_table'], [])
            if a['app'] != c['app']
        ]
        if not prior_alters:
            continue
        # Check whether the prior owner has a paired RemoveModel/DeleteModel
        unresolved = [
            a for a in prior_alters
            if (a['app'], a['model'].lower()) not in delete_records
        ]
        if not unresolved:
            continue
        owner = unresolved[0]
        findings.append(Finding(
            'I', c['app'], c['file'], c['line'],
            f"CreateModel {c['model']}(db_table='{c['db_table']}') conflicts with "
            f"AlterModelTable in {owner['app']}/{owner['file']} (no paired RemoveModel)",
        ))
    return findings


def detect_parallel_initial_branches(
    apps: list[tuple[str, Path]],
) -> list[Finding]:
    """Cat J: per app, find duplicate number prefixes (e.g. two `0002_*.py`).

    A `merge` migration at a higher number resolves them; if no merge file
    exists, flag the app.
    """
    findings: list[Finding] = []
    for app_label, migrations_dir in apps:
        files = list_migration_files(migrations_dir)
        if not files:
            continue

        by_prefix: dict[str, list[Path]] = defaultdict(list)
        merge_prefixes: set[str] = set()
        for f in files:
            m = re.match(r'^(\d{4})_(.+)$', f.stem)
            if not m:
                continue
            prefix = m.group(1)
            rest = m.group(2)
            by_prefix[prefix].append(f)
            if 'merge' in rest:
                merge_prefixes.add(prefix)

        duplicates = {p: paths for p, paths in by_prefix.items() if len(paths) > 1}
        if not duplicates:
            continue

        # If a merge migration exists at a prefix strictly higher than the
        # maximum duplicate prefix, treat the app as resolved.
        # (Per spec: "any merge migration resolves them at a higher number.")
        max_dup = max(duplicates.keys())
        resolved = any(mp > max_dup for mp in merge_prefixes)

        if not resolved:
            dup_summary = ', '.join(
                f"{p} ({len(paths)} files)" for p, paths in sorted(duplicates.items())
            )
            findings.append(Finding(
                'J', app_label,
                repo_relative(migrations_dir),
                None,
                f"Parallel branches with shared prefixes: {dup_summary} — no merge migration above the duplicates",
            ))
        # If resolved, we silently let it pass (a merge migration is the
        # documented fix; flagging would just add noise).
    return findings


# ──────────────────────────────────────────────────────────────────────
# Reporting
# ──────────────────────────────────────────────────────────────────────

def render_human(
    findings_by_cat: dict[str, list[Finding]],
    *,
    quiet: bool,
) -> str:
    out_lines: list[str] = []
    out_lines.append("=== TSFSYSTEM Migration Drift Audit ===")
    out_lines.append("")

    for cat in 'ABCDEFGHIJ':
        descr = CATEGORY_DESCRIPTIONS[cat]
        items = findings_by_cat.get(cat, [])
        if cat == 'H':
            out_lines.append(f"Category H ({descr}): SKIPPED — runtime detection only")
            continue
        out_lines.append(f"Category {cat} ({descr}): {len(items)} finding(s)")
        if not quiet:
            for fnd in items:
                line_part = f":{fnd.line}" if fnd.line else ''
                out_lines.append(f"  - {fnd.file}{line_part} {fnd.message}")
        out_lines.append("")

    critical = sum(len(findings_by_cat.get(c, [])) for c in CRITICAL_CATEGORIES)
    squash_required = sum(len(findings_by_cat.get(c, [])) for c in SQUASH_REQUIRED_CATEGORIES)
    total = critical + squash_required

    out_lines.append("Summary:")
    out_lines.append(f"  Critical (must fix before merge): {critical} (Cats A/B/C/D/E/F/G)")
    out_lines.append(f"  Squash-required (Cats I/J): {squash_required}")
    out_lines.append(f"  Total: {total}")
    out_lines.append("")
    if squash_required and not critical:
        out_lines.append(
            "Recommendation: run scripts/release/squash_for_release.py vX.Y.Z to resolve Cat I/J."
        )
    elif critical:
        out_lines.append(
            "Recommendation: fix Cats A/B/C/D/E/F/G inline; "
            "run scripts/release/squash_for_release.py for any Cat I/J."
        )
    else:
        out_lines.append("No drift detected. Tree replays cleanly statically.")
    return '\n'.join(out_lines)


def render_json(findings_by_cat: dict[str, list[Finding]], exit_code: int) -> str:
    by_cat = {c: [f.to_dict() for f in findings_by_cat.get(c, [])] for c in 'ABCDEFGHIJ'}
    critical = sum(len(by_cat[c]) for c in CRITICAL_CATEGORIES)
    squash_required = sum(len(by_cat[c]) for c in SQUASH_REQUIRED_CATEGORIES)
    payload = {
        'total_findings': critical + squash_required,
        'by_category': by_cat,
        'critical_count': critical,
        'squash_required_count': squash_required,
        'exit_code': exit_code,
    }
    return json.dumps(payload, indent=2)


# ──────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────

def run_audit(
    *,
    app_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
) -> dict[str, list[Finding]]:
    apps = discover_apps()
    if app_filter:
        apps = [(a, d) for a, d in apps if a == app_filter]
        if not apps:
            print(f"Warning: no app matching '{app_filter}' found.", file=sys.stderr)

    findings_by_cat: dict[str, list[Finding]] = defaultdict(list)
    db_table_to_app: dict[str, str] = {}

    for app_label, migrations_dir in apps:
        state_findings, _snapshot = detect_state_drift_for_app(
            app_label, migrations_dir,
            db_table_to_app=db_table_to_app,
        )
        for f in state_findings:
            findings_by_cat[f.category].append(f)

        for f in detect_broken_imports(app_label, migrations_dir):
            findings_by_cat[f.category].append(f)

    # Cross-app: Cat I and Cat J need the full app set
    full_apps = discover_apps()
    for f in detect_cross_app_ownership_conflicts(full_apps):
        if app_filter and f.app != app_filter:
            continue
        findings_by_cat[f.category].append(f)
    for f in detect_parallel_initial_branches(full_apps):
        if app_filter and f.app != app_filter:
            continue
        findings_by_cat[f.category].append(f)

    if category_filter:
        cat = category_filter.upper()
        if cat not in CATEGORY_DESCRIPTIONS:
            print(f"Warning: unknown category '{cat}'.", file=sys.stderr)
        findings_by_cat = {
            c: items for c, items in findings_by_cat.items() if c == cat
        }

    return dict(findings_by_cat)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or '').strip().split('\n', 1)[0],
    )
    parser.add_argument('--app', help='Restrict to one app (e.g. inventory)')
    parser.add_argument('--category', help='Restrict to one category (A-J)')
    parser.add_argument('--quiet', action='store_true', help='Only show summary')
    parser.add_argument('--json', action='store_true', help='Emit JSON for tooling')
    args = parser.parse_args(argv)

    findings_by_cat = run_audit(
        app_filter=args.app,
        category_filter=args.category,
    )

    critical = sum(len(findings_by_cat.get(c, [])) for c in CRITICAL_CATEGORIES)
    exit_code = 1 if critical > 0 else 0

    if args.json:
        print(render_json(findings_by_cat, exit_code))
    else:
        print(render_human(findings_by_cat, quiet=args.quiet))
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
