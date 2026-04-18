"""
Unit tests for `kernel.backup.db_snapshot.snapshot_database`.

These tests mock `subprocess.run` and `shutil.which` so they do not require
a real PostgreSQL server or `pg_dump` binary to be installed.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from kernel.backup.db_snapshot import snapshot_database


class SnapshotDatabaseTests(TestCase):
    def test_returns_none_when_pg_dump_missing(self):
        with patch("kernel.backup.db_snapshot._pg_dump_binary", return_value=None):
            self.assertIsNone(snapshot_database("test_label"))

    @override_settings(DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3"}})
    def test_returns_none_when_not_postgres(self):
        with patch("kernel.backup.db_snapshot._pg_dump_binary", return_value="/usr/bin/pg_dump"):
            self.assertIsNone(snapshot_database("test_label"))

    def test_returns_none_when_pg_dump_exits_nonzero(self):
        completed = MagicMock(returncode=1, stdout=b"", stderr=b"auth failed")
        with patch("kernel.backup.db_snapshot._pg_dump_binary", return_value="/usr/bin/pg_dump"), \
             patch("kernel.backup.db_snapshot.subprocess.run", return_value=completed):
            self.assertIsNone(snapshot_database("test_label"))

    def test_returns_none_when_feature_disabled(self):
        with patch("kernel.backup.db_snapshot._is_enabled", return_value=False):
            self.assertIsNone(snapshot_database("test_label"))

    def test_writes_gzip_file_on_success(self):
        dump = b"-- SQL DUMP CONTENT\nCREATE TABLE foo (id INT);\n"
        completed = MagicMock(returncode=0, stdout=dump, stderr=b"")
        with patch("kernel.backup.db_snapshot._pg_dump_binary", return_value="/usr/bin/pg_dump"), \
             patch("kernel.backup.db_snapshot.subprocess.run", return_value=completed):
            path = snapshot_database("unit_test")
        self.assertIsNotNone(path)
        assert path is not None
        p = Path(path)
        self.assertTrue(p.exists())
        self.assertTrue(p.name.startswith("db_unit_test_"))
        self.assertTrue(p.name.endswith(".sql.gz"))
        # gzip magic bytes
        with open(p, "rb") as fh:
            self.assertEqual(fh.read(2), b"\x1f\x8b")
        p.unlink()

    def test_label_is_path_safe(self):
        """Labels with unsafe chars are sanitized so they can't escape backups/."""
        dump = b"-- ok"
        completed = MagicMock(returncode=0, stdout=dump, stderr=b"")
        with patch("kernel.backup.db_snapshot._pg_dump_binary", return_value="/usr/bin/pg_dump"), \
             patch("kernel.backup.db_snapshot.subprocess.run", return_value=completed):
            path = snapshot_database("../evil/../label")
        self.assertIsNotNone(path)
        assert path is not None
        self.assertNotIn("..", path.name)
        self.assertNotIn("/", path.name.replace(".sql.gz", "").split("_", 2)[-1])
        Path(path).unlink()
