"""
Unit tests for the `prune_kernel_backups` management command.

Creates a temporary backups directory with stub files / directories,
invokes the command programmatically, and asserts the right items
are kept / removed.
"""

from __future__ import annotations

import tempfile
import time
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings


def _touch(path: Path, age_seconds: int) -> Path:
    """Create an empty file with mtime set to `age_seconds` in the past."""
    path.write_bytes(b"")
    now = time.time()
    import os
    os.utime(path, (now - age_seconds, now - age_seconds))
    return path


def _touch_dir(path: Path, age_seconds: int) -> Path:
    """Create a directory (with a dummy file inside) with mtime set back."""
    path.mkdir(parents=True, exist_ok=True)
    inner = path / "dummy.txt"
    inner.write_bytes(b"x")
    now = time.time()
    import os
    for p in (inner, path):
        os.utime(p, (now - age_seconds, now - age_seconds))
    return path


class PruneKernelBackupsCommandTests(TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.base_dir = Path(self._tmp.name)
        self.backups = self.base_dir / "backups"
        self.backups.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, **kwargs) -> str:
        buf = StringIO()
        with override_settings(BASE_DIR=str(self.base_dir)):
            call_command("prune_kernel_backups", stdout=buf, **kwargs)
        return buf.getvalue()

    def test_keeps_n_newest_db_snapshots(self):
        # 5 snapshots, ages 0..4 days (older = higher age).
        for age_days in range(5):
            _touch(self.backups / f"db_label_{age_days:03d}.sql.gz", age_days * 86400)
        self._run(keep=2)
        remaining = sorted(p.name for p in self.backups.glob("db_*.sql.gz"))
        # keep=2 means newest 2 survive (age_days 0, 1).
        self.assertEqual(remaining, ["db_label_000.sql.gz", "db_label_001.sql.gz"])

    def test_prunes_kernel_and_module_dirs(self):
        for i in range(4):
            _touch_dir(self.backups / f"kernel_1.0.{i}_20260418", i * 3600)
            _touch_dir(self.backups / f"module_inventory_v{i}_20260418", i * 3600)
        self._run(keep=1)
        kernel_left = [p.name for p in self.backups.glob("kernel_*") if p.is_dir()]
        module_left = [p.name for p in self.backups.glob("module_*") if p.is_dir()]
        self.assertEqual(len(kernel_left), 1)
        self.assertEqual(len(module_left), 1)

    def test_dry_run_does_not_delete(self):
        for age_days in range(3):
            _touch(self.backups / f"db_label_{age_days:03d}.sql.gz", age_days * 86400)
        self._run(keep=1, dry_run=True)
        remaining = sorted(p.name for p in self.backups.glob("db_*.sql.gz"))
        # All 3 still present because dry_run=True.
        self.assertEqual(len(remaining), 3)

    def test_no_backups_dir_is_a_noop(self):
        # Fresh base_dir without backups/ subdirectory.
        fresh = tempfile.TemporaryDirectory()
        try:
            buf = StringIO()
            with override_settings(BASE_DIR=fresh.name):
                call_command("prune_kernel_backups", stdout=buf)
            self.assertIn("No backups directory", buf.getvalue())
        finally:
            fresh.cleanup()

    def test_fewer_backups_than_keep_deletes_nothing(self):
        _touch(self.backups / "db_only_one.sql.gz", 0)
        self._run(keep=10)
        self.assertTrue((self.backups / "db_only_one.sql.gz").exists())
