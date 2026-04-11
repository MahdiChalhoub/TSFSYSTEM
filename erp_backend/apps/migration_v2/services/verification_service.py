"""
Verification Service
===================
Handles post-migration verification and locking.
(Placeholder - Full implementation available on request)
"""
import logging
from django.db import transaction
from ..models import MigrationJob, MigrationMapping

logger = logging.getLogger(__name__)


class VerificationService:
    """
    Handles verification workflow with locking.
    TODO: Full implementation with bulk operations
    """

    def __init__(self, job: MigrationJob):
        self.job = job

    def verify_mapping(self, mapping_id: int, user, notes: str = ''):
        """Verify a single mapping and lock the record."""
        logger.info(f"Verification service initialized (placeholder)")
        pass

    def bulk_verify(self, mapping_ids: list, user, notes: str = ''):
        """Bulk verify mappings."""
        logger.info(f"Bulk verify called for {len(mapping_ids)} mappings")
        pass
