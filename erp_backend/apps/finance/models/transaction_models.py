from django.db import models
from erp.models import TenantModel
from apps.finance.models.coa_models import FinancialAccount

class Transaction(TenantModel):
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=10)
    scope = models.CharField(max_length=20, default='OFFICIAL')
    description = models.CharField(max_length=255, null=True, blank=True)
    reference = models.CharField(max_length=100, null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    class Meta:
        db_table = 'transaction'

class TransactionSequence(TenantModel):
    type = models.CharField(max_length=50)
    prefix = models.CharField(max_length=20, null=True, blank=True)
    suffix = models.CharField(max_length=20, null=True, blank=True)
    next_number = models.IntegerField(default=1)
    padding = models.IntegerField(default=6)
    class Meta:
        db_table = 'transactionsequence'
        unique_together = ('type', 'organization')
    # ── 3-Tier Document Numbering ──────────────────────────────────────
    # Each document type has 3 sequence tiers:
    #   DRAFT    → temporary number, can have gaps (deletable)
    #   INTERNAL → saved non-fiscal / internal scope
    #   OFFICIAL → fiscal / posted, strict sequential integrity
    DOCUMENT_PREFIXES = {
        # doc_type: { tier: prefix }
        'PURCHASE_ORDER':  {'DRAFT': 'DFT-',  'INTERNAL': 'IPO-', 'OFFICIAL': 'PO-'},
        'QUOTATION':       {'DRAFT': 'DQT-',  'INTERNAL': 'IQT-', 'OFFICIAL': 'QT-'},
        'SALES_ORDER':     {'DRAFT': 'DSO-',  'INTERNAL': 'ISO-', 'OFFICIAL': 'SO-'},
        'INVOICE':         {'DRAFT': 'DINV-', 'INTERNAL': 'IINV-','OFFICIAL': 'INV-'},
        'RECEIPT':         {'DRAFT': 'DREC-', 'INTERNAL': 'IREC-','OFFICIAL': 'REC-'},
        'CREDIT_NOTE':     {'DRAFT': 'DCN-',  'INTERNAL': 'ICN-', 'OFFICIAL': 'CN-'},
        'DELIVERY_NOTE':   {'DRAFT': 'DDN-',  'INTERNAL': 'IDN-', 'OFFICIAL': 'DN-'},
        'PAYMENT':         {'DRAFT': 'DPAY-', 'INTERNAL': 'IPAY-','OFFICIAL': 'PAY-'},
    }

    @classmethod
    def resolve_seq_key(cls, doc_type, tier='OFFICIAL'):
        """
        Build the sequence type key for a given document type and tier.
        Examples:
            resolve_seq_key('PURCHASE_ORDER', 'DRAFT')    → 'PURCHASE_ORDER_DRAFT'
            resolve_seq_key('PURCHASE_ORDER', 'OFFICIAL') → 'PURCHASE_ORDER'
            resolve_seq_key('INVOICE', 'INTERNAL')        → 'INVOICE_INTERNAL'
        """
        if tier == 'OFFICIAL':
            return doc_type
        return f"{doc_type}_{tier}"

    @classmethod
    def get_prefix(cls, seq_type):
        """Resolve the default prefix for a sequence type key."""
        # Try to decompose: PURCHASE_ORDER_DRAFT → doc=PURCHASE_ORDER, tier=DRAFT
        for doc_type, tiers in cls.DOCUMENT_PREFIXES.items():
            for tier, prefix in tiers.items():
                key = cls.resolve_seq_key(doc_type, tier)
                if key == seq_type:
                    return prefix
        # Fallback
        return seq_type[:3].upper() + '-'

    @classmethod
    def next_value(cls, organization, seq_type):
        from django.db import transaction as db_tx, IntegrityError

        default_prefix = cls.get_prefix(seq_type)
        
        while True:
            # First attempt: Try to create if it doesn't exist
            with db_tx.atomic():
                try:
                    defaults = {'prefix': default_prefix, 'next_number': 1, 'padding': 6}
                    obj = cls.objects.create(
                        organization=organization,
                        type=seq_type,
                        **defaults
                    )
                    # We created the row -> number 1 is ours.
                    # Increment for the next caller.
                    obj.next_number = 2
                    obj.save(update_fields=['next_number'])
                    
                    prefix = obj.prefix or ''
                    suffix = obj.suffix or ''
                    return f"{prefix}{str(1).zfill(obj.padding)}{suffix}"
                except IntegrityError:
                    # Row already exists, proceed to lock-and-increment block
                    pass

            # Second attempt: Lock and increment existing row
            with db_tx.atomic():
                try:
                    seq = cls.objects.select_for_update(nowait=False).get(
                        organization=organization, type=seq_type
                    )
                    current = seq.next_number
                    seq.next_number += 1
                    seq.save(update_fields=['next_number'])
                    
                    prefix = seq.prefix or ''
                    suffix = seq.suffix or ''
                    return f"{prefix}{str(current).zfill(seq.padding)}{suffix}"
                except cls.DoesNotExist:
                    # Row was deleted between blocks (rare), retry the whole loop
                    continue
