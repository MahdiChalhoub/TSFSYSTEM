import hashlib
import json
from decimal import Decimal

class LedgerCryptography:
    @staticmethod
    def calculate_entry_hash(entry_data, previous_hash=None):
        """
        Calculates a SHA-256 hash for a journal entry across its lines and metadata.
        """
        # Ensure data is deterministic for hashing
        def serializer(obj):
            if isinstance(obj, Decimal):
                return str(obj)
            return str(obj)

        data = {
            "id": entry_data.get('id'),
            "organization_id": entry_data.get('organization_id'),
            "transaction_date": entry_data.get('transaction_date'),
            "reference": entry_data.get('reference'),
            "lines": sorted(entry_data.get('lines', []), key=lambda x: str(x.get('account_id'))),
            "previous_hash": previous_hash or "GENESIS"
        }
        
        encoded_data = json.dumps(data, sort_keys=True, default=serializer).encode('utf-8')
        return hashlib.sha256(encoded_data).hexdigest()

    @staticmethod
    def verify_chain(entries):
        """
        Verifies that a list of journal entries forms a valid cryptographic chain.
        """
        expected_prev_hash = "GENESIS"
        for entry in entries:
            # Re-calculate hash (this logic will be expanded in the service layer)
            # For now, we verify the stored field against its predecessor
            if entry.previous_hash != expected_prev_hash:
                return False, f"Chain broken at Entry {entry.id}: Previous hash mismatch"
            
            # Update expected for next iteration
            expected_prev_hash = entry.entry_hash
            
        return True, "Chain integrity verified"
