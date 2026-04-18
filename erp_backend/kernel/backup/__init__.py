"""
Kernel backup utilities.

Currently provides:
- `db_snapshot.snapshot_database` — pre-operation PostgreSQL snapshot via pg_dump.

See `.agent/../task and plan/kernel_rollback_001.md` (Phase 0) for context.
"""

from .db_snapshot import snapshot_database

__all__ = ["snapshot_database"]
