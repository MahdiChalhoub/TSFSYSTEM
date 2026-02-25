import logging
from django.db.models import Sum
from decimal import Decimal

logger = logging.getLogger(__name__)

class ForensicAuditService:
    @staticmethod
    def log_mutation(organization, user, model_name, object_id, change_type, payload=None):
        from apps.finance.models import ForensicAuditLog
        try:
            ForensicAuditLog.objects.create(
                organization=organization,
                actor=user,
                model_name=model_name,
                object_id=str(object_id),
                change_type=change_type,
                payload=payload
            )
        except Exception as e:
            # Audit logging should not crash the main transaction, but we log it
            logger.error(f"Audit Logging Failed: {str(e)}")


class AuditVerificationService:
    @staticmethod
    def verify_ledger_integrity(organization):
        """
        Quantum Audit: Mathematically verifies the entire ledger chain for an organization.
        """
        from apps.finance.models import JournalEntry
        
        entries = JournalEntry.objects.filter(
            organization=organization,
            status='POSTED'
        ).order_by('posted_at', 'id')
        
        results = []
        previous_hash = "GENESIS"
        chain_broken = False
        
        for entry in entries:
            # 1. Verify links
            if entry.previous_hash != previous_hash:
                chain_broken = True
                results.append({
                    "id": entry.id,
                    "reference": entry.reference,
                    "status": "FAIL",
                    "error": "Chain broken: previous_hash mismatch"
                })
            
            # 2. Re-calculate hash to ensure no data tampering
            calculated_hash = entry.calculate_hash()
            if entry.entry_hash != calculated_hash:
                chain_broken = True
                results.append({
                    "id": entry.id,
                    "reference": entry.reference,
                    "status": "FAIL",
                    "error": "Content tampered: entry_hash mismatch"
                })
            
            if not chain_broken:
                results.append({
                    "id": entry.id,
                    "reference": entry.reference,
                    "status": "PASS"
                })
            
            previous_hash = entry.entry_hash
            
        return {
            "is_valid": not chain_broken,
            "checked_count": len(results),
            "results": results
        }
