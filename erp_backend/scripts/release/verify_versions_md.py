#!/usr/bin/env python3
"""verify_versions_md.py — sanity-check VERSIONS.md against the migration tree.

Asserts that the latest version's per-app baselines listed in VERSIONS.md
all exist on disk, and that no orphan migration files (not in any squash's
`replaces = [...]`) are lurking unmentioned.

Run as a CI gate to prevent VERSIONS.md from drifting out of sync with the
actual migrations directory.

Usage:
    python3 scripts/release/verify_versions_md.py

Exit 0 = registry matches the tree.
Exit 1 = drift detected (specific issues printed to stderr).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]  # erp_backend/scripts/release/ → repo root
VERSIONS_MD = REPO_ROOT / 'VERSIONS.md'
ERP_BACKEND = REPO_ROOT / 'erp_backend'


def parse_latest_version_block(versions_md: Path) -> tuple[str, dict[str, str]]:
    """Parse the most recent version's per-app baseline table from VERSIONS.md.

    Returns (version_string, {app: baseline_filename}).
    """
    if not versions_md.is_file():
        sys.exit(f"❌ {versions_md} does not exist. Run release cutover first.")

    text = versions_md.read_text()

    # Find the first ## heading (most recent version, since we prepend)
    match = re.search(r'^## (v\d+\.\d+\.\d+) — ', text, re.MULTILINE)
    if not match:
        sys.exit("❌ No version heading found in VERSIONS.md (expected `## vX.Y.Z — DATE`)")
    version = match.group(1)

    # Find the next table after this heading
    block_start = match.end()
    next_heading = re.search(r'^## ', text[block_start:], re.MULTILINE)
    block_end = block_start + next_heading.start() if next_heading else len(text)
    block = text[block_start:block_end]

    # Parse table rows: | app | `baseline` | ... |
    baselines = {}
    for row in re.finditer(r'^\| (\w+) \| `([^`]+)` \|', block, re.MULTILINE):
        app, baseline = row.group(1), row.group(2)
        if app == 'App':  # header row
            continue
        baselines[app] = baseline

    return version, baselines


def find_app_migrations_dir(app: str) -> Path | None:
    candidates = [ERP_BACKEND / 'apps' / app / 'migrations',
                  ERP_BACKEND / app / 'migrations']
    for c in candidates:
        if c.is_dir():
            return c
    return None


def main() -> int:
    version, baselines = parse_latest_version_block(VERSIONS_MD)
    print(f"Verifying {version} against the migration tree…")

    issues: list[str] = []

    for app, baseline in baselines.items():
        migrations_dir = find_app_migrations_dir(app)
        if migrations_dir is None:
            issues.append(f"  - {app}: no migrations/ dir found in repo")
            continue
        baseline_file = migrations_dir / f'{baseline}.py'
        if not baseline_file.is_file():
            issues.append(f"  - {app}: baseline {baseline_file} listed in VERSIONS.md but missing on disk")

    # Detect orphan migration files (files in the tree not mentioned in VERSIONS.md
    # and not in any squash's `replaces = [...]`).
    # This is more involved; for now, emit a warning when an app has migrations
    # not matching either the registered baseline or post-baseline `0002+` pattern.
    for app, baseline in baselines.items():
        migrations_dir = find_app_migrations_dir(app)
        if migrations_dir is None:
            continue
        for f in migrations_dir.iterdir():
            if f.suffix != '.py' or f.stem == '__init__':
                continue
            name = f.stem
            if name == baseline:
                continue
            # Allow post-squash migrations (numbered higher than the baseline number prefix)
            m_baseline = re.match(r'^(\d{4})_', baseline)
            m_file = re.match(r'^(\d{4})_', name)
            if m_baseline and m_file and int(m_file.group(1)) > int(m_baseline.group(1)):
                continue
            # Anything else is an orphan
            issues.append(f"  - {app}: orphan migration file {f.name} (not the baseline, not a post-squash incremental)")

    if issues:
        print()
        print("❌ VERSIONS.md is out of sync with the migration tree:")
        for i in issues:
            print(i, file=sys.stderr)
        return 1

    print(f"✅ VERSIONS.md ({version}) matches the tree.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
