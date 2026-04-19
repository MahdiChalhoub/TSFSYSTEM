"""
Prune kernel backups — retention for the Phase 0 DB snapshot guard rail.

Keeps the N newest of each backup type in `BASE_DIR/backups/`:
- `db_*.sql.gz`      — DB snapshots from `kernel.backup.snapshot_database`
- `kernel_*/`        — filesystem backups from `KernelManager.apply_update`
- `module_*/`        — filesystem backups from `ModuleManager.upgrade`

Usage:
    python manage.py prune_kernel_backups                 # uses KERNEL_BACKUP_RETAIN_COUNT (default 10)
    python manage.py prune_kernel_backups --keep 5        # override
    python manage.py prune_kernel_backups --dry-run       # list what would be deleted, don't delete

Plan reference: `task and plan/kernel_rollback_001.md` (Phase 0).
"""

from __future__ import annotations

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


def _backups_dir() -> Path:
    return Path(settings.BASE_DIR) / "backups"


def _by_mtime_desc(paths: list[Path]) -> list[Path]:
    return sorted(paths, key=lambda p: p.stat().st_mtime, reverse=True)


class Command(BaseCommand):
    help = "Prune oldest kernel / module / DB backups, keeping the N newest of each type."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep",
            type=int,
            default=None,
            help="Number of newest backups to keep per type. Default: KERNEL_BACKUP_RETAIN_COUNT (or 10).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be deleted without touching anything.",
        )

    def handle(self, *args, **options):
        keep = options.get("keep")
        if keep is None:
            try:
                from kernel.config import get_config
                keep = int(get_config("KERNEL_BACKUP_RETAIN_COUNT", default=10))
            except Exception:
                keep = 10
        if keep < 1:
            self.stderr.write(self.style.ERROR("--keep must be >= 1"))
            return

        dry_run = bool(options.get("dry_run"))
        backups = _backups_dir()
        if not backups.exists():
            self.stdout.write(f"No backups directory at {backups}; nothing to prune.")
            return

        groups: dict[str, list[Path]] = {
            "db_*.sql.gz": sorted(backups.glob("db_*.sql.gz")),
            "kernel_*/": [p for p in backups.glob("kernel_*") if p.is_dir()],
            "module_*/": [p for p in backups.glob("module_*") if p.is_dir()],
        }

        total_deleted = 0
        total_bytes = 0
        for label, members in groups.items():
            if not members:
                continue
            ordered = _by_mtime_desc(members)
            keepers = ordered[:keep]
            deleters = ordered[keep:]
            self.stdout.write(
                f"{label}: {len(members)} total — keep {len(keepers)}, "
                f"prune {len(deleters)}"
            )
            for victim in deleters:
                size = _size_bytes(victim)
                total_bytes += size
                total_deleted += 1
                prefix = "[dry-run] would delete" if dry_run else "deleting"
                self.stdout.write(f"  {prefix} {victim.name} ({_fmt_size(size)})")
                if not dry_run:
                    _delete(victim)

        summary = (
            f"{total_deleted} item(s), {_fmt_size(total_bytes)} "
            f"{'would be freed' if dry_run else 'freed'}"
        )
        self.stdout.write(self.style.SUCCESS(summary))


def _size_bytes(p: Path) -> int:
    if p.is_file():
        return p.stat().st_size
    total = 0
    for child in p.rglob("*"):
        if child.is_file():
            total += child.stat().st_size
    return total


def _fmt_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n = int(n / 1024)
    return f"{n:.1f}TB"


def _delete(p: Path) -> None:
    if p.is_file():
        p.unlink()
    else:
        shutil.rmtree(p)
