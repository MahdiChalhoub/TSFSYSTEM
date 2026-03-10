"""
Migration Service — Orchestrates the full UltimatePOS → TSF migration.
Runs entity imports in dependency order with transaction safety and progress tracking.
"""
import logging
import traceback
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.migration.models import MigrationJob, MigrationMapping
from apps.migration.parsers import SQLDumpParser, DirectDBReader
from apps.migration.mappers import (
    UnitMapper, CategoryMapper, BrandMapper, ProductMapper,
    ContactMapper, TransactionMapper, SellLineMapper, PurchaseLineMapper,
    AccountMapper, SiteMapper, ExpenseMapper, TransactionPaymentMapper,
    safe_int, safe_bool, safe_decimal, safe_str
)

logger = logging.getLogger(__name__)



class MigrationFinanceMixin:

    def _migrate_payments(self):
        """Migrate transaction_payments → TSF Payment records."""
        from apps.finance.payment_models import Payment
        from apps.finance.models import FinancialAccount
        from apps.migration.mappers import TransactionPaymentMapper

        # Ensure a fallback payment account exists for orphaned payments
        fallback_account, _ = FinancialAccount.objects.get_or_create(
            organization_id=self.organization_id,
            name='Migration Default Account',
            defaults={'type': 'CASH', 'description': 'Auto-created during migration for payments without a linked account'}
        )

        rows = self._get_rows('transaction_payments')
        count = 0
        draft_count = 0

        # Optimization: pre-calculate valid transaction IDs
        valid_tx_ids = set(self.id_maps['TRANSACTION'].keys())

        for row in rows:
            source_id = safe_int(row.get('id'))
            tx_id = safe_int(row.get('transaction_id'))
            if not source_id or tx_id not in valid_tx_ids:
                continue

            existing = self._get_or_create_mapping('PAYMENT', source_id, 'transaction_payments')
            if existing:
                self.id_maps['PAYMENT'][source_id] = existing
                continue

            try:
                mapped = TransactionPaymentMapper.map_row(
                    row,
                    order_mapping=self.id_maps['TRANSACTION'],
                    contact_mapping=self.id_maps['CONTACT'],
                    account_mapping=self.id_maps['ACCOUNT'],
                    transaction_contact_map=self.transaction_contact_map,
                    transaction_type_map=self.transaction_type_map,
                )

                # Ensure required fields
                if not mapped.get('payment_date'):
                    mapped['payment_date'] = timezone.now().date().isoformat()

                # Payment requires both contact and payment_account
                needs_draft = False
                draft_reasons = []

                if not mapped.get('contact_id'):
                    needs_draft = True
                    draft_reasons.append('missing contact')

                if not mapped.get('payment_account_id'):
                    mapped['payment_account_id'] = fallback_account.id
                    if not self.id_maps['ACCOUNT']:
                        needs_draft = True
                        draft_reasons.append('no account mapping')

                if needs_draft:
                    mapped['status'] = 'DRAFT'
                    mapped['description'] = f"[NEEDS REVIEW: {', '.join(draft_reasons)}] {mapped.get('description') or ''}"
                    draft_count += 1

                # Remove None FK fields that Django won't accept
                for fk_field in ['supplier_invoice_id', 'sales_order_id', 'contact_id']:
                    if fk_field in mapped and mapped[fk_field] is None:
                        del mapped[fk_field]

                # Contact is required by the model - skip if truly missing
                if 'contact_id' not in mapped:
                    # Save the data in extra_data for reference but skip creation
                    self._log_error(f"Payment {source_id}: No contact found, skipping (amount={mapped.get('amount')})")
                    continue

                payment = Payment.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self.id_maps['PAYMENT'][source_id] = payment.id
                self._save_mapping('PAYMENT', source_id, payment.id, 'transaction_payments',
                                   TransactionPaymentMapper.extra_data(row))
                count += 1
                if count % 500 == 0:
                    self._heartbeat()
            except Exception as e:
                self._log_error(f"Payment {source_id}: {str(e)}")

        logger.info(f"Migrated {count} payments ({draft_count} as DRAFT for review)")


    def _migrate_accounts(self):
        """Migrate accounts → FinancialAccount, using account_types for classification."""
        from apps.finance.models import FinancialAccount

        # Pre-load account types for classification
        account_type_names = {}
        for at_row in self._get_rows('account_types'):
            at_id = safe_int(at_row.get('id'))
            if at_id:
                account_type_names[at_id] = safe_str(at_row.get('name')).lower()

        # Keyword → TSF type mapping
        TYPE_KEYWORDS = {
            'cash': 'CASH', 'caisse': 'CASH', 'drawer': 'CASH',
            'mobile': 'MOBILE', 'wallet': 'MOBILE', 'momo': 'MOBILE', 'orange': 'MOBILE',
            'savings': 'SAVINGS', 'epargne': 'SAVINGS',
            'petty': 'PETTY_CASH', 'petite': 'PETTY_CASH',
        }

        rows = self._get_rows('accounts')
        count = 0

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id:
                continue
            if row.get('deleted_at'):
                continue

            existing = self._get_or_create_mapping('ACCOUNT', source_id, 'accounts')
            if existing:
                self.id_maps['ACCOUNT'][source_id] = existing
                continue

            try:
                mapped = AccountMapper.map_row(row)

                # Determine type from account_type name
                account_type = 'BANK'  # default
                at_id = safe_int(row.get('account_type_id'))
                at_name = account_type_names.get(at_id, '')
                acct_name = safe_str(row.get('name')).lower()
                combined = f"{at_name} {acct_name}"
                for keyword, tsf_type in TYPE_KEYWORDS.items():
                    if keyword in combined:
                        account_type = tsf_type
                        break

                # TRY AUTO-MAPPING TO COA
                from apps.finance.models import ChartOfAccount
                coa_match = ChartOfAccount.objects.filter(
                    organization_id=self.organization_id,
                    name__iexact=mapped['name']
                ).first()
                
                if not coa_match:
                    # Try by code if name has it
                    import re
                    code_match = re.search(r'^\d{3,6}', mapped['name'])
                    if code_match:
                        coa_match = ChartOfAccount.objects.filter(
                            organization_id=self.organization_id,
                            code=code_match.group()
                        ).first()

                # MANDATORY: If still no match, create a child COA under the appropriate parent
                if not coa_match:
                    parent = ChartOfAccount.objects.filter(organization_id=self.organization_id, sub_type=account_type).first()
                    if not parent:
                        # Fallback to general Assets (1000) or Liabilities (2000) if no sub_type match
                        if account_type in ['BANK', 'CASH', 'MOBILE', 'PETTY_CASH']:
                            parent = ChartOfAccount.objects.filter(organization_id=self.organization_id, code='1000').first()
                        else:
                            parent = ChartOfAccount.objects.filter(organization_id=self.organization_id, code='2000').first()
                    
                    if parent:
                        # Find next available code
                        last = ChartOfAccount.objects.filter(organization_id=self.organization_id, parent=parent).order_by('-code').first()
                        suffix = (int(last.code.split('.')[-1]) + 1) if (last and '.' in last.code) else 1
                        new_code = f"{parent.code}.{str(suffix).zfill(3)}"
                        
                        coa_match = ChartOfAccount.objects.create(
                            organization_id=self.organization_id,
                            code=new_code,
                            name=f"{mapped['name']} (Migrated)",
                            type=parent.type,
                            parent=parent,
                            is_active=True,
                            description=f"Auto-created during migration for account {source_id}"
                        )

                # Resolve org currency for the account
                from erp.models import Organization
                org = Organization.objects.get(id=self.organization_id)
                org_currency = org.base_currency.code if org.base_currency_id else 'XOF'

                # GUARD: Never create an account without a COA link
                if not coa_match:
                    self._log_error(f"Account {source_id} ({mapped['name']}): No COA parent found, skipping to prevent orphan")
                    continue

                account = FinancialAccount.objects.create(
                    organization_id=self.organization_id,
                    name=mapped['name'],
                    type=account_type,
                    currency=org_currency,
                    ledger_account=coa_match,
                    description=f"Imported from UltimatePOS. Category: {at_name or 'N/A'}",
                )
                self.id_maps['ACCOUNT'][source_id] = account.id
                self._save_mapping('ACCOUNT', source_id, account.id, 'accounts',
                                   {**AccountMapper.extra_data(row), 'account_type_name': at_name})
                count += 1
            except Exception as e:
                self._log_error(f"Account {source_id} ({row.get('name')}): {str(e)}")

        self.job.total_accounts = count
        logger.info(f"Migrated {count} accounts")


    def _migrate_expenses(self):
        """Migrate transactions (type=expense) → DirectExpense."""
        from apps.finance.models import DirectExpense
        from apps.migration.mappers import ExpenseMapper

        # Pre-load expense categories for name lookup
        expense_cat_names = {}
        for cat_row in self._get_rows('expense_categories'):
            cat_id = safe_int(cat_row.get('id'))
            if cat_id:
                expense_cat_names[cat_id] = cat_row.get('name', '')

        rows = self._get_rows('transactions')
        count = 0

        for row in rows:
            if safe_str(row.get('type')).lower() != 'expense':
                continue

            source_id = safe_int(row.get('id'))
            if not source_id:
                continue

            existing = self._get_or_create_mapping('EXPENSE', source_id, 'transactions')
            if existing:
                self.id_maps.setdefault('EXPENSE', {})[source_id] = existing
                continue

            try:
                # Resolve expense category name
                exp_cat_id = safe_int(row.get('expense_category_id'))
                exp_cat_name = expense_cat_names.get(exp_cat_id)

                mapped = ExpenseMapper.map_row(row, expense_category_name=exp_cat_name)
                expense = DirectExpense.objects.create(
                    organization_id=self.organization_id,
                    **mapped
                )
                self.id_maps.setdefault('EXPENSE', {})[source_id] = expense.id
                self._save_mapping('EXPENSE', source_id, expense.id, 'transactions',
                                   {**ExpenseMapper.extra_data(row), 'expense_category_name': exp_cat_name})
                count += 1
            except Exception as e:
                # Import as DRAFT if validation fails
                try:
                    exp_cat_id = safe_int(row.get('expense_category_id'))
                    exp_cat_name = expense_cat_names.get(exp_cat_id)
                    mapped = ExpenseMapper.map_row(row, expense_category_name=exp_cat_name)
                    mapped['status'] = 'DRAFT'
                    mapped['description'] = f"[NEEDS REVIEW] {mapped.get('description', '')}"
                    expense = DirectExpense.objects.create(
                        organization_id=self.organization_id,
                        **mapped
                    )
                    self.id_maps.setdefault('EXPENSE', {})[source_id] = expense.id
                    self._save_mapping('EXPENSE', source_id, expense.id, 'transactions',
                                       {**ExpenseMapper.extra_data(row), 'imported_as_draft': True, 'original_error': str(e), 'expense_category_name': exp_cat_name})
                    count += 1
                except Exception as e2:
                    self._log_error(f"Expense {source_id}: {str(e)} → Draft also failed: {str(e2)}")

        self.job.total_accounts += count
        logger.info(f"Migrated {count} expenses")


    def _migrate_account_transactions(self):
        """Migrate UPOS account_transactions → TSF JournalEntry records.
        
        This creates proper double-entry journal entries for:
        - Deposits (credit account → debit cash/bank)
        - Withdrawals (debit account → credit cash/bank)  
        - Transfers between accounts
        
        This ensures account balances match and financial reports work.
        """
        from apps.finance.models.ledger_models import JournalEntry, JournalEntryLine
        from apps.finance.models.coa_models import ChartOfAccount, FinancialAccount

        rows = self._get_rows('account_transactions')
        total_rows = self.job.discovered_data.get('global_counts', {}).get('account_transactions', 0)
        if total_rows == 0:
            logger.info("No account_transactions found in source data")
            return

        # Initialize JOURNAL_ENTRY map
        self.id_maps.setdefault('JOURNAL_ENTRY', {})

        # Ensure we have default CoA accounts for journal entries
        default_coa, _ = ChartOfAccount.objects.get_or_create(
            organization_id=self.organization_id,
            code='5700',
            defaults={
                'name': 'Cash & Bank (Migration)',
                'type': 'ASSET',
                'sub_type': 'CASH',
                'description': 'Auto-created during migration for account transaction entries',
            }
        )

        revenue_coa, _ = ChartOfAccount.objects.get_or_create(
            organization_id=self.organization_id,
            code='7000',
            defaults={
                'name': 'Revenue (Migration)',
                'type': 'REVENUE',
                'description': 'Auto-created during migration for income entries',
            }
        )

        expense_coa, _ = ChartOfAccount.objects.get_or_create(
            organization_id=self.organization_id,
            code='6000',
            defaults={
                'name': 'Expenses (Migration)',
                'type': 'EXPENSE',
                'description': 'Auto-created during migration for expense entries',
            }
        )

        # Build account → CoA mapping
        # Each FinancialAccount might have a ledger_account, use it; otherwise use default
        account_coa_map = {}
        for fa in FinancialAccount.objects.filter(organization_id=self.organization_id):
            if fa.ledger_account_id:
                account_coa_map[fa.id] = fa.ledger_account_id
            else:
                account_coa_map[fa.id] = default_coa.id

        count = 0
        skipped = 0

        # UPOS account_transaction types:
        # 'debit' = money coming IN to account (deposit)
        # 'credit' = money going OUT of account (withdrawal) 
        # Optimization: pre-calculate valid parent IDs
        valid_tx_ids = set(self.id_maps['TRANSACTION'].keys())
        valid_account_ids = set(self.id_maps['ACCOUNT'].keys())

        for row in rows:
            source_id = safe_int(row.get('id'))
            if not source_id or row.get('deleted_at'):
                continue

            # Critical: isolation by business
            source_account_id = safe_int(row.get('account_id'))
            tx_id = safe_int(row.get('transaction_id'))
            
            # If it belongs to an account we didn't import (different business), skip it
            if source_account_id not in valid_account_ids:
                continue
                
            # If it's linked to a transaction, it must be OUR transaction
            if tx_id and tx_id not in valid_tx_ids:
                continue

            existing = self._get_or_create_mapping('JOURNAL_ENTRY', source_id, 'account_transactions')
            if existing:
                self.id_maps['JOURNAL_ENTRY'][source_id] = existing
                continue

            try:
                amount = safe_decimal(row.get('amount'))
                if not amount or amount == 0:
                    continue

                tx_type = safe_str(row.get('type')).lower()  # 'debit' or 'credit'
                sub_type = safe_str(row.get('sub_type')).lower()  # 'deposit', 'fund_transfer', etc.
                source_account_id = safe_int(row.get('account_id'))
                operation_date = row.get('operation_date')
                note = safe_str(row.get('note'))
                reff_no = safe_str(row.get('reff_no'))

                # Resolve target account
                target_account_id = self.id_maps.get('ACCOUNT', {}).get(source_account_id)
                if not target_account_id:
                    skipped += 1
                    continue

                account_coa_id = account_coa_map.get(target_account_id, default_coa.id)

                # Determine which CoA gets the other side of the entry
                if sub_type in ('fund_transfer', 'transfer'):
                    # Transfer: other side is also an account
                    transfer_id = safe_int(row.get('transfer_transaction_id'))
                    contra_coa_id = default_coa.id  # Simplification: both sides use cash
                elif tx_type == 'debit':
                    # Money coming in → revenue side
                    contra_coa_id = revenue_coa.id
                else:
                    # Money going out → expense side
                    contra_coa_id = expense_coa.id

                # Build description
                desc_parts = []
                if sub_type: desc_parts.append(f"[{sub_type.upper()}]")
                if note: desc_parts.append(note)
                if reff_no: desc_parts.append(f"Ref: {reff_no}")
                description = ' | '.join(desc_parts) or f"UPOS Account Transaction #{source_id}"

                # Create reference to avoid duplicates
                reference = f"MIG-AT-{self.job.id}-{source_id}"

                # Parse date
                je_date = None
                if operation_date:
                    try:
                        if isinstance(operation_date, str):
                            je_date = datetime.strptime(operation_date[:19], '%Y-%m-%d %H:%M:%S')
                        else:
                            je_date = operation_date
                    except (ValueError, TypeError):
                        je_date = timezone.now()
                else:
                    je_date = timezone.now()

                # Create JournalEntry with DRAFT status for review
                je = JournalEntry(
                    organization_id=self.organization_id,
                    transaction_date=je_date,
                    description=description,
                    status='DRAFT',
                    reference=reference,
                    scope='INTERNAL',
                    created_at=je_date,
                )
                je.save()

                # Create the two lines (double-entry)
                if tx_type == 'debit':
                    # Money IN: debit the account, credit revenue/contra
                    JournalEntryLine.objects.create(
                        organization_id=self.organization_id,
                        journal_entry=je,
                        account_id=account_coa_id,
                        debit=abs(amount),
                        credit=Decimal('0.00'),
                        description=f"Deposit to account (UPOS #{source_account_id})",
                    )
                    JournalEntryLine.objects.create(
                        organization_id=self.organization_id,
                        journal_entry=je,
                        account_id=contra_coa_id,
                        debit=Decimal('0.00'),
                        credit=abs(amount),
                        description=f"Source: {sub_type or 'deposit'}",
                    )
                else:
                    # Money OUT: credit the account, debit expense/contra
                    JournalEntryLine.objects.create(
                        organization_id=self.organization_id,
                        journal_entry=je,
                        account_id=account_coa_id,
                        debit=Decimal('0.00'),
                        credit=abs(amount),
                        description=f"Withdrawal from account (UPOS #{source_account_id})",
                    )
                    JournalEntryLine.objects.create(
                        organization_id=self.organization_id,
                        journal_entry=je,
                        account_id=contra_coa_id,
                        debit=abs(amount),
                        credit=Decimal('0.00'),
                        description=f"Destination: {sub_type or 'withdrawal'}",
                    )

                self.id_maps['JOURNAL_ENTRY'][source_id] = je.id
                self._save_mapping('JOURNAL_ENTRY', source_id, je.id, 'account_transactions',
                                   {'type': tx_type, 'sub_type': sub_type, 'amount': str(amount)})
                count += 1

                if count % 100 == 0:
                    self._heartbeat(sub_progress=f"{count:,}/{total_rows:,} ledger entries")

            except Exception as e:
                self._log_error(f"Account transaction {source_id}: {str(e)}")

        if skipped > 0:
            self._log_error(f"Account transactions: {skipped} rows skipped (unmapped account)")
        
        self._heartbeat(sub_progress=f"{count:,} ledger entries done")
        logger.info(f"Migrated {count} account transactions → journal entries ({skipped} skipped)")


    def _migrate_currency_check(self):
        """Validate and set the source currency on the TSF organization."""
        from erp.models import Organization, GlobalCurrency

        # Try to detect currency from UPOS business table
        source_currency_code = None
        for biz in self._get_rows('business'):
            biz_id = safe_int(biz.get('id'))
            if self.job.source_business_id and biz_id != self.job.source_business_id:
                continue
            currency_id = safe_int(biz.get('currency_id'))
            if currency_id:
                # Look up in currencies table
                for cur in self._get_rows('currencies'):
                    if safe_int(cur.get('id')) == currency_id:
                        source_currency_code = safe_str(cur.get('code')).upper()
                        break
            break

        if not source_currency_code:
            self._log_error("Currency check: Could not detect source currency from UPOS data. Defaulting to XOF.")
            source_currency_code = 'XOF'

        logger.info(f"Source currency detected: {source_currency_code}")

        # Ensure currency exists in GlobalCurrency
        KNOWN_CURRENCIES = {
            'XOF': ('CFA', 'West African CFA Franc'),
            'XAF': ('FCFA', 'Central African CFA Franc'),
            'USD': ('$', 'US Dollar'),
            'EUR': ('€', 'Euro'),
            'GBP': ('£', 'British Pound'),
            'NGN': ('₦', 'Nigerian Naira'),
            'GHS': ('GH₵', 'Ghanaian Cedi'),
            'KES': ('KSh', 'Kenyan Shilling'),
        }

        symbol, name = KNOWN_CURRENCIES.get(source_currency_code, (source_currency_code, source_currency_code))
        currency, created = GlobalCurrency.objects.get_or_create(
            code=source_currency_code,
            defaults={'symbol': symbol, 'name': name}
        )
        if created:
            logger.info(f"Created GlobalCurrency: {source_currency_code} ({name})")

        # Set on the organization if not already set
        try:
            org = Organization.objects.get(id=self.organization_id)
            if org.base_currency_id != currency.id:
                logger.info(f"Force updating organization base currency to {source_currency_code} from {org.base_currency.code if org.base_currency_id else 'None'}")
                org.base_currency = currency
                org.save(update_fields=['base_currency'])
        except Organization.DoesNotExist:
            self._log_error(f"Currency check: Organization {self.organization_id} not found")

