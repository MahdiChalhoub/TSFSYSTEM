"""
Entity Migration Service
========================
Handles migration of customers and suppliers WITH automatic COA sub-account creation.

This is the CRITICAL integration point between CRM and Finance modules.

For each customer/supplier:
1. Create Contact record in CRM
2. Auto-create COA sub-account under automation root
3. Link contact.ledger_account_id → COA account.id
4. Store mappings for both entities
"""
import logging
from decimal import Decimal
from django.db import transaction
from apps.crm.models import Contact
from apps.finance.models import ChartOfAccount
from erp.services import ConfigurationService
from ..models import MigrationJob, MigrationMapping

logger = logging.getLogger(__name__)


class EntityMigrationService:
    """
    Handles customer/supplier migration with automatic ledger account creation.

    Following TSFSYSTEM architecture:
    - Uses ConfigurationService.get_posting_rules() for automation roots
    - Creates COA sub-accounts dynamically
    - Links CRM → Finance via ledger_account_id
    - Full audit trail via MigrationMapping
    """

    def __init__(self, job: MigrationJob):
        self.job = job
        self.organization = job.target_organization
        self.posting_rules = job.posting_rules_snapshot or ConfigurationService.get_posting_rules(self.organization)
        self.errors = []
        self.warnings = []

    @transaction.atomic
    def import_customers(self, upos_contacts: list) -> int:
        """
        Import customers with automatic ledger account creation.

        For each customer:
        1. Create Contact (type=CUSTOMER)
        2. Auto-create COA sub-account under customerRoot
        3. Link contact.ledger_account_id = coa_account.id
        4. Store both mappings
        """
        # Get customer root account from posting rules
        customer_root_id = self.posting_rules['automation']['customerRoot']
        if not customer_root_id:
            raise ValueError("automation.customerRoot not configured in posting rules. Run validation first.")

        customer_root = ChartOfAccount.objects.get(id=customer_root_id)

        # Find next available account code
        next_suffix = self._get_next_account_suffix(customer_root_id, customer_root.code)

        imported = 0
        self.job.current_step = 'Importing Customers + COA Accounts'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing customers under COA root: {customer_root.code} - {customer_root.name}")

        # Filter only customers from contacts
        customers = [c for c in upos_contacts if c.get('type') == 'customer']

        for upos_contact in customers:
            try:
                # 1. Create Contact in CRM
                contact = Contact.objects.create(
                    organization=self.organization,
                    type='CUSTOMER',
                    name=upos_contact.get('name') or upos_contact.get('supplier_business_name') or f'Customer {upos_contact["id"]}',
                    email=upos_contact.get('email'),
                    phone=upos_contact.get('mobile'),
                    address=upos_contact.get('address_line_1'),
                    city=upos_contact.get('city'),
                    state=upos_contact.get('state'),
                    country=upos_contact.get('country'),
                    zip_code=upos_contact.get('zip_code'),
                    tax_number=upos_contact.get('tax_number'),
                    credit_limit=Decimal(str(upos_contact.get('credit_limit', 0))) if upos_contact.get('credit_limit') else None,
                    # Migration metadata
                    is_migrated=True,
                    migrated_from='UltimatePOS',
                    migration_source_id=upos_contact['id']
                )

                # 2. Auto-create COA sub-account
                account_code = f"{customer_root.code}{next_suffix:03d}"  # e.g., 411001
                account_name = contact.name[:100]  # Truncate if needed

                coa_account = ChartOfAccount.objects.create(
                    organization=self.organization,
                    parent_id=customer_root_id,
                    code=account_code,
                    name=account_name,
                    type='ASSET',  # Receivables are assets
                    sub_type='RECEIVABLE',
                    is_system_only=False,
                    balance=Decimal('0.00'),
                    # Migration metadata
                    is_migrated=True
                )

                # 3. Link contact to COA account
                contact.ledger_account_id = coa_account.id
                contact.save(update_fields=['ledger_account_id'])

                # 4. Store mappings
                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='CONTACT_CUSTOMER',
                    source_id=upos_contact['id'],
                    target_id=contact.id,
                    source_data=upos_contact,
                    verify_status='PENDING'
                )

                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='COA_ACCOUNT',
                    source_id=upos_contact['id'],  # Reference to original contact
                    target_id=coa_account.id,
                    source_data={'type': 'customer_auto', 'contact_id': contact.id, 'account_code': account_code}
                )

                next_suffix += 1
                imported += 1

                # Update progress
                if imported % 10 == 0:
                    self.job.current_step_detail = f"{imported} customers imported"
                    self.job.save(update_fields=['current_step_detail'])

            except Exception as e:
                logger.error(f"Failed to import customer {upos_contact.get('id')}: {e}")
                self.errors.append({
                    'entity_type': 'CUSTOMER',
                    'source_id': upos_contact.get('id'),
                    'error': str(e)
                })

        self.job.imported_customers = imported
        self.job.current_step_detail = f"Completed: {imported} customers + COA accounts"
        self.job.save(update_fields=['imported_customers', 'current_step_detail'])

        logger.info(f"Imported {imported} customers with COA accounts {customer_root.code}001-{customer_root.code}{next_suffix-1:03d}")
        return imported

    @transaction.atomic
    def import_suppliers(self, upos_contacts: list) -> int:
        """
        Import suppliers with automatic ledger account creation.

        Similar to customers but under supplierRoot.
        """
        supplier_root_id = self.posting_rules['automation']['supplierRoot']
        if not supplier_root_id:
            raise ValueError("automation.supplierRoot not configured in posting rules")

        supplier_root = ChartOfAccount.objects.get(id=supplier_root_id)

        # Find next available code
        next_suffix = self._get_next_account_suffix(supplier_root_id, supplier_root.code)

        imported = 0
        self.job.current_step = 'Importing Suppliers + COA Accounts'
        self.job.save(update_fields=['current_step'])

        logger.info(f"Importing suppliers under COA root: {supplier_root.code} - {supplier_root.name}")

        # Filter only suppliers
        suppliers = [c for c in upos_contacts if c.get('type') == 'supplier']

        for upos_contact in suppliers:
            try:
                # 1. Create Contact
                contact = Contact.objects.create(
                    organization=self.organization,
                    type='SUPPLIER',
                    name=upos_contact.get('name') or upos_contact.get('supplier_business_name') or f'Supplier {upos_contact["id"]}',
                    email=upos_contact.get('email'),
                    phone=upos_contact.get('mobile'),
                    address=upos_contact.get('address_line_1'),
                    city=upos_contact.get('city'),
                    state=upos_contact.get('state'),
                    country=upos_contact.get('country'),
                    zip_code=upos_contact.get('zip_code'),
                    tax_number=upos_contact.get('tax_number'),
                    # Migration metadata
                    is_migrated=True,
                    migrated_from='UltimatePOS',
                    migration_source_id=upos_contact['id']
                )

                # 2. Auto-create COA sub-account
                account_code = f"{supplier_root.code}{next_suffix:03d}"  # e.g., 401001
                account_name = contact.name[:100]

                coa_account = ChartOfAccount.objects.create(
                    organization=self.organization,
                    parent_id=supplier_root_id,
                    code=account_code,
                    name=account_name,
                    type='LIABILITY',  # Payables are liabilities
                    sub_type='PAYABLE',
                    is_system_only=False,
                    balance=Decimal('0.00'),
                    # Migration metadata
                    is_migrated=True
                )

                # 3. Link
                contact.ledger_account_id = coa_account.id
                contact.save(update_fields=['ledger_account_id'])

                # 4. Store mappings
                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='CONTACT_SUPPLIER',
                    source_id=upos_contact['id'],
                    target_id=contact.id,
                    source_data=upos_contact
                )

                MigrationMapping.objects.create(
                    job=self.job,
                    entity_type='COA_ACCOUNT',
                    source_id=upos_contact['id'],
                    target_id=coa_account.id,
                    source_data={'type': 'supplier_auto', 'contact_id': contact.id, 'account_code': account_code}
                )

                next_suffix += 1
                imported += 1

                # Update progress
                if imported % 10 == 0:
                    self.job.current_step_detail = f"{imported} suppliers imported"
                    self.job.save(update_fields=['current_step_detail'])

            except Exception as e:
                logger.error(f"Failed to import supplier {upos_contact.get('id')}: {e}")
                self.errors.append({
                    'entity_type': 'SUPPLIER',
                    'source_id': upos_contact.get('id'),
                    'error': str(e)
                })

        self.job.imported_suppliers = imported
        self.job.current_step_detail = f"Completed: {imported} suppliers + COA accounts"
        self.job.save(update_fields=['imported_suppliers', 'current_step_detail'])

        logger.info(f"Imported {imported} suppliers with COA accounts {supplier_root.code}001-{supplier_root.code}{next_suffix-1:03d}")
        return imported

    def _get_next_account_suffix(self, parent_id: int, base_code: str) -> int:
        """
        Find the next available numeric suffix for account codes.

        Example:
        - Existing: 411001, 411002, 411005
        - Returns: 6 (next after max 5)
        """
        existing_codes = ChartOfAccount.objects.filter(
            organization=self.organization,
            parent_id=parent_id
        ).values_list('code', flat=True)

        max_suffix = 0
        for code in existing_codes:
            if code.startswith(base_code):
                try:
                    # Extract numeric suffix
                    suffix_str = code.replace(base_code, '')
                    suffix = int(suffix_str)
                    max_suffix = max(max_suffix, suffix)
                except (ValueError, TypeError):
                    pass

        return max_suffix + 1

    def get_coa_summary(self) -> dict:
        """
        Get summary of COA accounts created during migration.
        Useful for Step 6 confirmation UI.
        """
        customer_accounts = MigrationMapping.objects.filter(
            job=self.job,
            entity_type='COA_ACCOUNT',
            source_data__type='customer_auto'
        ).count()

        supplier_accounts = MigrationMapping.objects.filter(
            job=self.job,
            entity_type='COA_ACCOUNT',
            source_data__type='supplier_auto'
        ).count()

        # Get code ranges
        customer_root_id = self.posting_rules['automation']['customerRoot']
        supplier_root_id = self.posting_rules['automation']['supplierRoot']

        customer_root = ChartOfAccount.objects.get(id=customer_root_id) if customer_root_id else None
        supplier_root = ChartOfAccount.objects.get(id=supplier_root_id) if supplier_root_id else None

        return {
            'customer_accounts_created': customer_accounts,
            'supplier_accounts_created': supplier_accounts,
            'customer_root': {
                'code': customer_root.code if customer_root else None,
                'name': customer_root.name if customer_root else None,
            } if customer_root else None,
            'supplier_root': {
                'code': supplier_root.code if supplier_root else None,
                'name': supplier_root.name if supplier_root else None,
            } if supplier_root else None,
        }

    def get_errors(self) -> list:
        """Return errors encountered during migration."""
        return self.errors

    def get_warnings(self) -> list:
        """Return warnings encountered during migration."""
        return self.warnings
