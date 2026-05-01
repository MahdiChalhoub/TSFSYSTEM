#!/usr/bin/env python3
"""squash_for_release.py — squash every app's post-baseline migrations for a new release.

This is the release-cut helper. It walks every Django app, finds the latest
squashed baseline (e.g., `0001_squashed_v3_5_0.py`), and squashes everything
above that into a new `0001_squashed_v{NEW}.py`.

Usage:
    python3 scripts/release/squash_for_release.py v3.6.0

Requires:
    - Run from `erp_backend/` directory.
    - All apps must be in INSTALLED_APPS.
    - `verify_clean_replay.sh` must pass beforehand.
    - Working tree clean (no uncommitted migration changes).

This script does NOT touch the DB. It only edits migration files. After it
runs, re-run `verify_clean_replay.sh` to confirm the new squashed tree
replays cleanly.

Output:
    - One `0001_squashed_v{NEW}.py` per app under `apps/{app}/migrations/`.
    - A draft `VERSIONS.md` entry written to `/tmp/versions_md_draft.md`.
    - The operator must manually:
      1. Review each squash file.
      2. Move data migrations (RunPython) into post-squash files if needed.
      3. Append the draft to VERSIONS.md.
      4. `git rm` the now-subsumed old migration files.
      5. Commit + tag.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional


# ── Apps to squash, in dependency order ──────────────────────────────
APP_DEPENDENCY_ORDER = [
    # Foundational
    'erp', 'apps_core', 'iam', 'reference',
    # Layer 1 (depend on foundational)
    'compliance', 'data_migration', 'integrations',
    # Layer 2 (cross-domain, mostly independent of each other)
    'client_portal', 'crm', 'ecommerce', 'hr', 'inventory', 'pos',
    'mcp', 'migration', 'migration_v2', 'storage', 'supplier_portal',
    # Layer 3 (depend on layer 2)
    'workforce', 'workspace',
    # Final (depends on inventory + pos via Pattern D)
    'finance',
    # Kernel-managed
    'packages',
]


# ── Helpers ──────────────────────────────────────────────────────────

def parse_version(s: str) -> tuple[int, int, int]:
    """v3.6.0 → (3, 6, 0). Validates strict semver."""
    m = re.fullmatch(r'v(\d+)\.(\d+)\.(\d+)', s)
    if not m:
        sys.exit(f"❌ Invalid version: {s}. Expected v{{MAJOR}}.{{MINOR}}.{{PATCH}}")
    return (int(m[1]), int(m[2]), int(m[3]))


def version_tag(v: tuple[int, int, int]) -> str:
    """(3, 6, 0) → 'v3_6_0' (Python module-name safe)."""
    return f"v{v[0]}_{v[1]}_{v[2]}"


def find_app_migrations_dir(app: str) -> Optional[Path]:
    """Locate the migrations/ dir for an app. Tries apps/{app}/ then top-level."""
    candidates = [
        Path('apps') / app / 'migrations',
        Path(app) / 'migrations',  # for `erp` and `apps_core` at the top level
    ]
    for c in candidates:
        if c.is_dir():
            return c
    return None


def list_migrations(migrations_dir: Path) -> list[str]:
    """Return sorted migration names (without .py) in the dir, excluding __init__."""
    names = []
    for f in migrations_dir.iterdir():
        if f.suffix == '.py' and f.stem != '__init__':
            names.append(f.stem)
    names.sort()
    return names


def find_baseline_squash(migrations_dir: Path) -> Optional[str]:
    """Return the latest squashed baseline filename (without .py), or None."""
    pattern = re.compile(r'^0001_squashed_v(\d+)_(\d+)_(\d+)$')
    matches = []
    for name in list_migrations(migrations_dir):
        m = pattern.match(name)
        if m:
            matches.append((tuple(int(x) for x in m.groups()), name))
    if not matches:
        return None
    matches.sort()
    return matches[-1][1]


def run_squashmigrations(app: str, start: str, end: str) -> Path:
    """Invoke Django's squashmigrations and return the path of the created file.

    Note: Django writes the squash with name 'XXXX_squashed_<end>.py' where
    XXXX is the number after `start`. We rename to the version convention.
    """
    cmd = ['python3', 'manage.py', 'squashmigrations',
           '--no-optimize', '--no-input', app, start, end]
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ squashmigrations failed for {app}:\n{result.stderr}")
        sys.exit(1)
    # Find the file Django just created
    migrations_dir = find_app_migrations_dir(app)
    if migrations_dir is None:
        sys.exit(f"❌ Couldn't relocate migrations dir for {app}")
    candidates = list(migrations_dir.glob('*_squashed_*.py'))
    candidates = [c for c in candidates if 'v' not in c.stem]  # exclude already-renamed ones
    if not candidates:
        sys.exit(f"❌ Django reported success but no squashed file found in {migrations_dir}")
    # Pick the most recent
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def rename_squash_file(src: Path, version: str) -> Path:
    """Rename `XXXX_squashed_YYY.py` → `0001_squashed_v3_6_0.py`."""
    dst = src.parent / f'0001_squashed_{version}.py'
    if dst.exists():
        sys.exit(f"❌ Target {dst} already exists. Did you forget to delete the prior baseline?")
    src.rename(dst)
    print(f"  → renamed to {dst}")
    return dst


def update_squash_docstring(path: Path, version_str: str) -> None:
    """Replace the auto-generated docstring with our version-tagged one."""
    text = path.read_text()
    new_docstring = f'''"""{version_str} baseline migration.

Generated 2026-MM-DD by `scripts/release/squash_for_release.py {version_str}`.
Replaces all post-baseline migrations from the prior release through this
release. See `VERSIONS.md` for the full release registry.

Replaces: see `replaces = [...]` below for the full list.
"""
'''
    # Replace the first triple-quoted block, OR insert after the first comment line if none
    if text.lstrip().startswith('"""'):
        end = text.index('"""', 3) + 3
        text = new_docstring + text[end:]
    else:
        # Insert after `from django.db import ...` block
        lines = text.splitlines(keepends=True)
        for i, line in enumerate(lines):
            if line.startswith('from django') or line.startswith('import django'):
                continue
            # Insert before the first non-import, non-blank line
            if line.strip() and not line.startswith('from') and not line.startswith('import'):
                lines.insert(i, new_docstring + '\n')
                break
        text = ''.join(lines)
    path.write_text(text)


# ── Main ─────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n', 1)[0])
    parser.add_argument('version', help='Target release version (e.g., v3.6.0)')
    args = parser.parse_args()

    version = parse_version(args.version)
    version_tag_str = version_tag(version)

    # Sanity check: working tree must be clean
    git_status = subprocess.run(['git', 'status', '--porcelain'],
                                 capture_output=True, text=True)
    if git_status.stdout.strip():
        sys.exit("❌ Working tree is not clean. Commit or stash before squashing.")

    # Sanity check: we're in erp_backend/
    if not Path('manage.py').is_file():
        sys.exit("❌ Run from erp_backend/ directory.")

    print(f"=== Squashing for release {args.version} ===\n")

    summary = []
    for app in APP_DEPENDENCY_ORDER:
        print(f"── {app} ──")
        migrations_dir = find_app_migrations_dir(app)
        if migrations_dir is None:
            print(f"  ⚠ no migrations/ dir found, skipping")
            continue

        all_mig = list_migrations(migrations_dir)
        if not all_mig:
            print(f"  ⚠ empty migrations dir, skipping")
            continue

        baseline = find_baseline_squash(migrations_dir)
        start = baseline if baseline else all_mig[0]
        end = all_mig[-1]

        if start == end:
            print(f"  ✓ already at single squash {start}, no work needed")
            summary.append({'app': app, 'baseline': start, 'latest': end, 'squashed': False})
            continue

        squashed_path = run_squashmigrations(app, start, end)
        renamed = rename_squash_file(squashed_path, version_tag_str)
        update_squash_docstring(renamed, args.version)
        summary.append({'app': app, 'baseline': renamed.stem, 'latest': renamed.stem,
                        'squashed': True, 'replaces_count': len(all_mig) - 1})
        print()

    # Write a draft VERSIONS.md entry to /tmp for human review
    draft_path = Path('/tmp/versions_md_draft.md')
    with draft_path.open('w') as f:
        f.write(f'## {args.version} — {{DATE}}\n\n')
        f.write('### Migration baseline (per app)\n\n')
        f.write('| App | Squash file | Latest |\n|---|---|---|\n')
        for row in summary:
            f.write(f"| {row['app']} | `{row['baseline']}` | `{row['latest']}` |\n")
        f.write('\n### Data migrations (must run, not in squash)\n')
        f.write('- (review each app for `RunPython` ops in the squash file; extract any that need to run on already-applied DBs)\n\n')
        f.write('### Pre-squash drift cleanup\n')
        f.write('- See `MIGRATION_NOTES.md` for any --fake or patched migrations.\n\n')

    print()
    print(f"✅ Squashed {len([r for r in summary if r.get('squashed')])} apps.")
    print(f"   Draft VERSIONS.md entry written to {draft_path}")
    print()
    print("Next steps:")
    print("  1. Review each apps/*/migrations/0001_squashed_{}.py".format(version_tag_str))
    print("  2. Move RunPython data migrations into post-squash 0002_*.py files if needed")
    print("  3. Run `bash scripts/release/verify_clean_replay.sh` to validate")
    print("  4. Append /tmp/versions_md_draft.md content to VERSIONS.md")
    print(f"  5. git rm the now-subsumed old migration files")
    print(f"  6. Commit and tag {args.version}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
