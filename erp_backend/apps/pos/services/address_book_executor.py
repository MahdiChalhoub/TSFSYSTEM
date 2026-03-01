"""
Address Book Auto-Execution Service
════════════════════════════════════
When a manager approves an Address Book entry, this service
executes the REAL action in the ERP — exactly like the user
would do it in the full software, but automated.

SUPPLIER_PAYMENT → PaymentService.record_supplier_payment()
CLIENT_PAYMENT   → PaymentService.record_customer_receipt()
EXPENSE          → LedgerService.create_journal_entry() (Dr Expense, Cr Cash)
PARTNER_CAPITAL_IN  → LedgerService.create_journal_entry() (Dr Cash, Cr Owner Equity)
PARTNER_CASH_IN     → LedgerService.create_journal_entry() (Dr Cash, Cr Partner Account)
PARTNER_CAPITAL_OUT → LedgerService.create_journal_entry() (Dr Owner Drawing, Cr Cash)
PARTNER_CASH_OUT    → LedgerService.create_journal_entry() (Dr Partner Account, Cr Cash)
SALES_RETURN     → Creates credit note + GL entry
CASH_SHORTAGE    → LedgerService.create_journal_entry() (Dr Cash Over/Short, Cr Cash)
CASH_OVERAGE     → LedgerService.create_journal_entry() (Dr Cash, Cr Cash Over/Short)

The entry stays in the Address Book as audit trail.
The generated transaction (payment/JE) is linked back to the entry.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class AddressBookExecutor:
    """
    Executes the real ERP action when an Address Book entry is approved.
    Called from the review endpoint after status → APPROVED.
    """

    @staticmethod
    def execute(entry, manager=None):
        """
        Execute the real action for an approved entry.
        Returns the created transaction/JE or None if type doesn't need posting.
        """
        handler_map = {
            'SUPPLIER_PAYMENT': AddressBookExecutor._exec_supplier_payment,
            'CLIENT_PAYMENT': AddressBookExecutor._exec_client_payment,
            'CLIENT_PREPAYMENT': AddressBookExecutor._exec_client_payment,
            'EXPENSE': AddressBookExecutor._exec_expense,
            'PARTNER_CAPITAL_IN': AddressBookExecutor._exec_partner_capital_in,
            'PARTNER_CASH_IN': AddressBookExecutor._exec_partner_cash_in,
            'PARTNER_CAPITAL_OUT': AddressBookExecutor._exec_partner_capital_out,
            'PARTNER_CASH_OUT': AddressBookExecutor._exec_partner_cash_out,
            'SALES_RETURN': AddressBookExecutor._exec_sales_return,
            'CASH_SHORTAGE': AddressBookExecutor._exec_cash_variance,
            'CASH_OVERAGE': AddressBookExecutor._exec_cash_variance,
            'MONEY_TRANSFER': AddressBookExecutor._exec_money_transfer,
            'SALE_DEPOSIT': AddressBookExecutor._exec_sale_deposit,
        }

        handler = handler_map.get(entry.entry_type)
        if not handler:
            logger.info(f"AddressBook #{entry.id}: No auto-execution for type {entry.entry_type}")
            return None

        try:
            result = handler(entry, manager)
            logger.info(f"AddressBook #{entry.id} ({entry.entry_type}): Auto-executed → {result}")
            return result
        except Exception as e:
            logger.error(f"AddressBook #{entry.id} auto-execution failed: {e}", exc_info=True)
            # Don't fail the approval — just log. Manager can manually post later.
            return None

    @staticmethod
    def _get_register_cash_account(entry):
        """Get the cash account from the register linked to this session."""
        session = entry.session
        register = session.register
        if register and register.cash_account_id:
            return register.cash_account.ledger_account_id
        return None

    @staticmethod
    def _get_organization(entry):
        from erp.models import Organization
        return Organization.objects.get(id=entry.organization_id)

    # ─── SUPPLIER PAYMENT ────────────────────────────────────────────
    @staticmethod
    def _exec_supplier_payment(entry, manager):
        """Dr. Accounts Payable → Cr. Cash"""
        from apps.finance.payment_service import PaymentService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)

        if not entry.supplier_id:
            logger.warning(f"AddressBook #{entry.id}: No supplier linked — skipping GL post")
            return None

        # Find the cash FinancialAccount (not COA account)
        from apps.finance.models import FinancialAccount
        cash_fin_acc = None
        if cash_acc_id:
            cash_fin_acc = FinancialAccount.objects.filter(
                organization=org, ledger_account_id=cash_acc_id
            ).first()
        if not cash_fin_acc:
            cash_fin_acc = FinancialAccount.objects.filter(
                organization=org, name__icontains='cash'
            ).first()
        if not cash_fin_acc:
            logger.warning(f"AddressBook #{entry.id}: No cash account found — skipping GL post")
            return None

        payment = PaymentService.record_supplier_payment(
            organization=org,
            contact_id=entry.supplier_id,
            amount=entry.amount_out,
            payment_date=entry.created_at.date(),
            payment_account_id=cash_fin_acc.id,
            method='CASH',
            description=f"[AddressBook #{entry.id}] {entry.description}",
            supplier_invoice_id=entry.supplier_invoice_id,
            scope='OFFICIAL',
            user=manager,
        )

        # If invoice linked, record the payment against it
        if entry.supplier_invoice_id and payment:
            try:
                from apps.finance.invoice_models import Invoice
                invoice = Invoice.objects.get(id=entry.supplier_invoice_id, organization=org)
                invoice.record_payment(entry.amount_out)
            except Exception as e:
                logger.warning(f"AddressBook #{entry.id}: Invoice payment recording failed: {e}")

        return payment

    # ─── CLIENT PAYMENT / PREPAYMENT ─────────────────────────────────
    @staticmethod
    def _exec_client_payment(entry, manager):
        """Dr. Cash → Cr. Accounts Receivable"""
        from apps.finance.payment_service import PaymentService

        org = AddressBookExecutor._get_organization(entry)

        if not entry.client_id:
            logger.warning(f"AddressBook #{entry.id}: No client linked — skipping GL post")
            return None

        from apps.finance.models import FinancialAccount
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        cash_fin_acc = None
        if cash_acc_id:
            cash_fin_acc = FinancialAccount.objects.filter(
                organization=org, ledger_account_id=cash_acc_id
            ).first()
        if not cash_fin_acc:
            cash_fin_acc = FinancialAccount.objects.filter(
                organization=org, name__icontains='cash'
            ).first()
        if not cash_fin_acc:
            return None

        payment = PaymentService.record_customer_receipt(
            organization=org,
            contact_id=entry.client_id,
            amount=entry.amount_in,
            payment_date=entry.created_at.date(),
            payment_account_id=cash_fin_acc.id,
            method='CASH',
            description=f"[AddressBook #{entry.id}] {entry.description}",
            scope='OFFICIAL',
            user=manager,
        )

        # If invoice linked, record the payment against it
        if entry.client_invoice_id and payment:
            try:
                from apps.finance.invoice_models import Invoice
                invoice = Invoice.objects.get(id=entry.client_invoice_id, organization=org)
                invoice.record_payment(entry.amount_in)
            except Exception as e:
                logger.warning(f"AddressBook #{entry.id}: Invoice payment recording failed: {e}")

        return payment

    # ─── EXPENSE ─────────────────────────────────────────────────────
    @staticmethod
    def _exec_expense(entry, manager):
        """Dr. Expense Account → Cr. Cash"""
        from apps.finance.services import LedgerService
        from erp.services import ConfigurationService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        # Find expense account — use target_account_id if set, otherwise default
        expense_acc_id = entry.target_account_id
        if not expense_acc_id:
            rules = ConfigurationService.get_posting_rules(org)
            expense_acc_id = rules.get('expenses', {}).get('general') or rules.get('expenses', {}).get('operating')

        if not expense_acc_id:
            # Fallback: find general expense account
            from apps.finance.models import ChartOfAccount
            expense_acc = ChartOfAccount.objects.filter(
                organization=org, type='EXPENSE'
            ).first()
            expense_acc_id = expense_acc.id if expense_acc else None

        if not expense_acc_id:
            logger.warning(f"AddressBook #{entry.id}: No expense account found")
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AddressBook #{entry.id}] Expense: {entry.description}",
            reference=f"AB-EXP-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": expense_acc_id, "debit": entry.amount_out, "credit": Decimal('0'),
                 "description": f"Expense: {entry.expense_category or entry.description}"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": entry.amount_out,
                 "description": "Cash outflow"},
            ]
        )
        return je

    # ─── PARTNER CAPITAL IN ────────────────────────────────────────
    @staticmethod
    def _exec_partner_capital_in(entry, manager):
        """
        Partner injects capital into the business (Equity).
        Dr. Cash, Cr. Owner's Equity (Capital)
        """
        from apps.finance.services import LedgerService
        from apps.finance.models import ChartOfAccount

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        # Look for Equity Account directly
        equity_acc = ChartOfAccount.objects.filter(
            organization=org, type='EQUITY'
        ).first()
        if not equity_acc:
            logger.warning(f"AddressBook #{entry.id}: No equity account found")
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AccountBook #{entry.id}] Partner Capital Injection: {entry.partner_name or entry.description}",
            reference=f"AB-PCAPIN-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": cash_acc_id, "debit": entry.amount_in, "credit": Decimal('0'),
                 "description": f"Cash from partner: {entry.partner_name}"},
                {"account_id": equity_acc.id, "debit": Decimal('0'), "credit": entry.amount_in,
                 "description": f"Capital Injection: {entry.partner_name}"},
            ]
        )
        return je

    # ─── PARTNER CASH IN ───────────────────────────────────────────
    @staticmethod
    def _exec_partner_cash_in(entry, manager):
        """
        Partner transfers cash from their personal/linked account to the register.
        Dr. Cash, Cr. Partner's Account
        """
        from apps.finance.services import LedgerService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        partner_acc_id = AddressBookExecutor._get_partner_account(entry, org)
        if not partner_acc_id:
            logger.warning(f"AddressBook #{entry.id}: No partner account found for cash in")
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AccountBook #{entry.id}] Partner Cash Transfer (In): {entry.partner_name or entry.description}",
            reference=f"AB-PCASHIN-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": cash_acc_id, "debit": entry.amount_in, "credit": Decimal('0'),
                 "description": f"Cash transfer from partner: {entry.partner_name}"},
                {"account_id": partner_acc_id, "debit": Decimal('0'), "credit": entry.amount_in,
                 "description": f"Partner account: {entry.partner_name}"},
            ]
        )
        return je

    # ─── PARTNER CAPITAL OUT ───────────────────────────────────────
    @staticmethod
    def _exec_partner_capital_out(entry, manager):
        """
        Partner withdraws capital from the business (Drawing/Equity).
        Dr. Owner's Drawing, Cr. Cash
        """
        from apps.finance.services import LedgerService
        from apps.finance.models import ChartOfAccount

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        drawing_acc = ChartOfAccount.objects.filter(
            organization=org, code__icontains='drawing'
        ).first()
        if not drawing_acc:
            drawing_acc = ChartOfAccount.objects.filter(
                organization=org, type='EQUITY'
            ).first()
        if not drawing_acc:
            logger.warning(f"AddressBook #{entry.id}: No drawing/equity account found")
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AccountBook #{entry.id}] Partner Capital Withdrawal: {entry.partner_name or entry.description}",
            reference=f"AB-PCAPOUT-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": drawing_acc.id, "debit": entry.amount_out, "credit": Decimal('0'),
                 "description": f"Capital Withdrawal: {entry.partner_name}"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": entry.amount_out,
                 "description": "Cash outflow to partner"},
            ]
        )
        return je

    # ─── PARTNER CASH OUT ──────────────────────────────────────────
    @staticmethod
    def _exec_partner_cash_out(entry, manager):
        """
        Partner transfers cash from register to their personal account.
        Dr. Partner's Account, Cr. Cash
        """
        from apps.finance.services import LedgerService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        partner_acc_id = AddressBookExecutor._get_partner_account(entry, org)
        if not partner_acc_id:
            logger.warning(f"AddressBook #{entry.id}: No partner account found for cash out")
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AccountBook #{entry.id}] Partner Cash Transfer (Out): {entry.partner_name or entry.description}",
            reference=f"AB-PCASHOUT-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": partner_acc_id, "debit": entry.amount_out, "credit": Decimal('0'),
                 "description": f"Cash transfer to partner: {entry.partner_name}"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": entry.amount_out,
                 "description": "Cash outflow to partner"},
            ]
        )
        return je

    @staticmethod
    def _get_partner_account(entry, org):
        """
        Get the partner's linked financial account from their CRM Contact record.
        Partners may have a linked_account_id pointing to their personal account in the COA.
        """
        partner_id = getattr(entry, 'partner_id', None)
        if not partner_id:
            return None

        try:
            from apps.crm.models import Contact
            contact = Contact.objects.get(id=partner_id, organization=org)
            # Contact may have a linked_account_id (their personal ledger account)
            linked_acc_id = getattr(contact, 'linked_account_id', None)
            if linked_acc_id:
                return linked_acc_id

            # Also check if there's a sub-account created for this contact
            from apps.finance.models import ChartOfAccount
            sub_acc = ChartOfAccount.objects.filter(
                organization=org,
                name__icontains=contact.name,
                type='EQUITY'
            ).first()
            if sub_acc:
                return sub_acc.id
        except Exception as e:
            logger.warning(f"AddressBook #{entry.id}: Partner account lookup failed: {e}")

        return None

    # ─── SALES RETURN ────────────────────────────────────────────────
    @staticmethod
    def _exec_sales_return(entry, manager):
        """Dr. Sales Returns → Cr. Cash (simplified)"""
        from apps.finance.services import LedgerService
        from apps.finance.models import ChartOfAccount
        from erp.services import ConfigurationService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        # Find sales returns account
        rules = ConfigurationService.get_posting_rules(org)
        returns_acc_id = rules.get('sales', {}).get('returns')
        if not returns_acc_id:
            returns_acc = ChartOfAccount.objects.filter(
                organization=org, name__icontains='return'
            ).first()
            returns_acc_id = returns_acc.id if returns_acc else None
        if not returns_acc_id:
            # Fallback to revenue contra
            revenue_acc = ChartOfAccount.objects.filter(
                organization=org, type='REVENUE'
            ).first()
            returns_acc_id = revenue_acc.id if revenue_acc else None
        if not returns_acc_id:
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AddressBook #{entry.id}] Sales Return: {entry.description}",
            reference=f"AB-RET-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": returns_acc_id, "debit": entry.amount_out, "credit": Decimal('0'),
                 "description": f"Sales Return: {entry.linked_order_ref or entry.description}"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": entry.amount_out,
                 "description": "Cash refund to customer"},
            ]
        )

        # Record against invoice if linked
        if entry.client_invoice_id:
            try:
                from apps.finance.invoice_models import Invoice
                invoice = Invoice.objects.get(id=entry.client_invoice_id, organization=org)
                # Reduce paid amount (refund)
                invoice.paid_amount -= entry.amount_out
                invoice.balance_due = invoice.total_amount - invoice.paid_amount
                if invoice.paid_amount <= 0:
                    invoice.status = 'SENT'
                elif invoice.balance_due > 0:
                    invoice.status = 'PARTIAL_PAID'
                invoice.save(update_fields=['paid_amount', 'balance_due', 'status'], force_audit_bypass=True)
            except Exception as e:
                logger.warning(f"AddressBook #{entry.id}: Invoice refund recording failed: {e}")

        return je

    # ─── CASH VARIANCE ───────────────────────────────────────────────
    @staticmethod
    def _exec_cash_variance(entry, manager):
        """
        CASH_OVERAGE: Dr. Cash → Cr. Cash Over/Short (income)
        CASH_SHORTAGE: Dr. Cash Over/Short (expense) → Cr. Cash
        """
        from apps.finance.services import LedgerService
        from apps.finance.models import ChartOfAccount

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        # Find Cash Over/Short account
        cos_acc = ChartOfAccount.objects.filter(
            organization=org, name__icontains='over'
        ).filter(name__icontains='short').first()
        if not cos_acc:
            cos_acc = ChartOfAccount.objects.filter(
                organization=org, type='EXPENSE', name__icontains='cash'
            ).first()
        if not cos_acc:
            return None

        is_overage = entry.entry_type == 'CASH_OVERAGE'
        amount = entry.amount_in if is_overage else entry.amount_out

        lines = []
        if is_overage:
            lines = [
                {"account_id": cash_acc_id, "debit": amount, "credit": Decimal('0'),
                 "description": "Cash overage found"},
                {"account_id": cos_acc.id, "debit": Decimal('0'), "credit": amount,
                 "description": "Cash Over/Short (gain)"},
            ]
        else:
            lines = [
                {"account_id": cos_acc.id, "debit": amount, "credit": Decimal('0'),
                 "description": "Cash Over/Short (loss)"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": amount,
                 "description": "Cash shortage"},
            ]

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AddressBook #{entry.id}] {'Cash Overage' if is_overage else 'Cash Shortage'}: {entry.description}",
            reference=f"AB-{'COV' if is_overage else 'CSH'}-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=lines,
        )
        return je

    # ─── MONEY TRANSFER ──────────────────────────────────────────────
    @staticmethod
    def _exec_money_transfer(entry, manager):
        """Dr. Target Account → Cr. Cash (or vice versa)"""
        from apps.finance.services import LedgerService

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        target_acc_id = entry.target_account_id
        if not target_acc_id:
            logger.warning(f"AddressBook #{entry.id}: No target account for money transfer")
            return None

        amount = entry.amount_out if entry.amount_out > 0 else entry.amount_in
        is_out = entry.amount_out > 0

        lines = []
        if is_out:
            # Cash moved OUT of register to another account
            lines = [
                {"account_id": target_acc_id, "debit": amount, "credit": Decimal('0'),
                 "description": f"Transfer from POS register"},
                {"account_id": cash_acc_id, "debit": Decimal('0'), "credit": amount,
                 "description": "Cash transferred out"},
            ]
        else:
            # Cash moved IN to register from another account
            lines = [
                {"account_id": cash_acc_id, "debit": amount, "credit": Decimal('0'),
                 "description": "Cash transferred in"},
                {"account_id": target_acc_id, "debit": Decimal('0'), "credit": amount,
                 "description": f"Transfer to POS register"},
            ]

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AddressBook #{entry.id}] Money Transfer: {entry.description}",
            reference=f"AB-TRF-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=lines,
        )
        return je

    # ─── SALE DEPOSIT ────────────────────────────────────────────────
    @staticmethod
    def _exec_sale_deposit(entry, manager):
        """Dr. Cash → Cr. Unearned Revenue / Customer Deposits"""
        from apps.finance.services import LedgerService
        from apps.finance.models import ChartOfAccount

        org = AddressBookExecutor._get_organization(entry)
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)
        if not cash_acc_id:
            return None

        # Find unearned revenue / customer deposits account
        deposit_acc = ChartOfAccount.objects.filter(
            organization=org, name__icontains='deposit'
        ).first()
        if not deposit_acc:
            deposit_acc = ChartOfAccount.objects.filter(
                organization=org, name__icontains='unearned'
            ).first()
        if not deposit_acc:
            deposit_acc = ChartOfAccount.objects.filter(
                organization=org, type='LIABILITY'
            ).first()
        if not deposit_acc:
            return None

        je = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=entry.created_at.date(),
            description=f"[AddressBook #{entry.id}] Sale Deposit: {entry.description}",
            reference=f"AB-DEP-{entry.id}",
            status='POSTED',
            scope='OFFICIAL',
            user=manager,
            lines=[
                {"account_id": cash_acc_id, "debit": entry.amount_in, "credit": Decimal('0'),
                 "description": "Cash deposit received"},
                {"account_id": deposit_acc.id, "debit": Decimal('0'), "credit": entry.amount_in,
                 "description": f"Customer deposit: {entry.description}"},
            ]
        )
        return je
