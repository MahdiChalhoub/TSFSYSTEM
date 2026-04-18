"""
Pre-operation database snapshot via `pg_dump`.

Phase 0 of the kernel rollback plan (see `task and plan/kernel_rollback_001.md`):
a strictly additive guard rail that captures a gzipped `pg_dump` before any
update that might mutate schema or data. Failure is non-fatal so this cannot
break the existing update flow — missing `pg_dump`, missing permissions, or
disabled feature flag all result in `None` with a logged warning.
"""

from __future__ import annotations

import gzip
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _is_enabled() -> bool:
    """Check the `KERNEL_DB_SNAPSHOT_ENABLED` kernel-config flag."""
    try:
        from kernel.config import get_config  # lazy to avoid AppRegistryNotReady
    except Exception:
        return True  # default-on if config app isn't ready yet
    try:
        return bool(get_config("KERNEL_DB_SNAPSHOT_ENABLED", default=True))
    except Exception:
        return True


def _pg_dump_binary() -> Optional[str]:
    """Locate `pg_dump` on PATH, returning None if not installed."""
    return shutil.which("pg_dump")


def _backups_dir() -> Path:
    d = Path(settings.BASE_DIR) / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def snapshot_database(label: str) -> Optional[Path]:
    """
    Write a gzipped pg_dump of the `default` DB to `BASE_DIR/backups/`.

    Args:
        label: free-form tag embedded in the filename (e.g. `'kernel_pre_1.2.0'`).

    Returns:
        Path to the snapshot file, or None if snapshotting was skipped / failed.

    Never raises: this is a guard rail, not a hard dependency of the caller.
    """
    if not _is_enabled():
        logger.info("kernel.backup: snapshot skipped (KERNEL_DB_SNAPSHOT_ENABLED=False) label=%s", label)
        return None

    binary = _pg_dump_binary()
    if binary is None:
        logger.warning(
            "kernel.backup: pg_dump not found on PATH; skipping snapshot label=%s. "
            "Install postgresql-client in the backend Docker image to enable.",
            label,
        )
        return None

    db = settings.DATABASES.get("default", {})
    engine = db.get("ENGINE", "")
    if "postgresql" not in engine:
        logger.warning("kernel.backup: DB engine %r is not PostgreSQL; skipping snapshot", engine)
        return None

    ts = timezone.now().strftime("%Y%m%d%H%M%S")
    safe_label = "".join(c if c.isalnum() or c in "-_." else "_" for c in label)
    out_path = _backups_dir() / f"db_{safe_label}_{ts}.sql.gz"

    env = os.environ.copy()
    password = db.get("PASSWORD") or env.get("PGPASSWORD")
    if password:
        env["PGPASSWORD"] = password

    cmd = [
        binary,
        "--host", db.get("HOST", "localhost") or "localhost",
        "--port", str(db.get("PORT") or "5432"),
        "--username", db.get("USER") or "postgres",
        "--no-password",
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        db.get("NAME") or "postgres",
    ]

    start = timezone.now()
    try:
        proc = subprocess.run(
            cmd,
            env=env,
            check=False,
            capture_output=True,
            timeout=600,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError) as e:
        logger.warning("kernel.backup: pg_dump invocation failed label=%s err=%s", label, e)
        return None

    if proc.returncode != 0:
        stderr = (proc.stderr or b"").decode(errors="replace")[:500]
        logger.warning("kernel.backup: pg_dump exit=%s label=%s stderr=%s",
                       proc.returncode, label, stderr)
        return None

    try:
        with gzip.open(out_path, "wb", compresslevel=6) as fh:
            fh.write(proc.stdout)
    except OSError as e:
        logger.warning("kernel.backup: failed to write snapshot %s: %s", out_path, e)
        return None

    elapsed = (timezone.now() - start).total_seconds()
    size_mb = out_path.stat().st_size / (1024 * 1024)
    logger.info(
        "kernel.backup: snapshot written label=%s path=%s size=%.1fMB elapsed=%.1fs",
        label, out_path, size_mb, elapsed,
    )
    return out_path
