"""
Address Book Auto-Execution Service
════════════════════════════════════
When a manager approves an Address Book entry, this service
executes the REAL action in the ERP — exactly like the user
would do it in the full software, but automated.

═══════════════════════════════════════════════════════════════════════════════
  ARCHITECTURE NOTE (Phase 3A — Module Decoupling, Wave 2)
  ─────────────────────────────────────────────────────────
  This file NO LONGER imports from apps.finance directly.
  All financial operations go through ConnectorEngine:
    - Journal entry creation  → connector.route_write('finance', 'post_address_book_entry')
    - Account resolution      → finance resolves COA codes internally
    - Payment recording       → connector.route_write('finance', 'record_supplier_payment')

  POS sends BUSINESS INTENT (entry type + amounts), not journal lines.
  Finance owns all accounting logic.

  Ref: .ai/plans/module-decoupling-blueprint.md (Phase 3A)
═══════════════════════════════════════════════════════════════════════════════
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


def _get_connector():
    """Get the ConnectorEngine singleton."""
    from erp.connector_engine import connector_engine
    return connector_engine


class AddressBookExecutor:
    """
    Executes the real ERP action when an Address Book entry is approved.
    Called from the review endpoint after status → APPROVED.

    All finance operations route through ConnectorEngine — no direct imports.
    """

    @staticmethod
    def execute(entry, manager=None):
        """
        Execute the real action for an approved entry.
        Returns the result dict or None if type doesn't need posting.
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

    # ── Shared connector helper ───────────────────────────────────────────
    @staticmethod
    def _post_via_connector(entry, manager, entry_type, amount, description,
                            contact_id=None, invoice_id=None,
                            target_account_code=None, extra_data=None):
        """
        Route an address book posting through ConnectorEngine.
        Finance resolves all accounts internally.
        """
        connector = _get_connector()
        cash_acc_id = AddressBookExecutor._get_register_cash_account(entry)

        result = connector.route_write(
            target_module='finance',
            endpoint='post_address_book_entry',
            data={
                'organization_id': entry.organization_id,
                'entry_type': entry_type,
                'entry_id': entry.id,
                'amount': str(amount),
                'description': description,
                'contact_id': contact_id,
                'invoice_id': invoice_id,
                'cash_account_id': cash_acc_id,
                'target_account_id': getattr(entry, 'target_account_id', None),
                'target_account_code': target_account_code,
                'site_id': getattr(entry, 'site_id', None),
                'user_id': manager.id if manager else None,
                'transaction_date': str(entry.created_at.date()),
                'extra_data': extra_data or {},
            },
            organization_id=entry.organization_id,
            source_module='pos',
        )

        if result and result.data and isinstance(result.data, dict):
            return result.data
        return None

    # ─── SUPPLIER PAYMENT ────────────────────────────────────────────
    @staticmethod
    def _exec_supplier_payment(entry, manager):
        """Dr. Accounts Payable → Cr. Cash"""
        if not entry.supplier_id:
            logger.warning(f"AddressBook #{entry.id}: No supplier linked — skipping GL post")
            return None

        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='SUPPLIER_PAYMENT',
            amount=entry.amount_out,
            description=f"[AddressBook #{entry.id}] {entry.description}",
            contact_id=entry.supplier_id,
            invoice_id=getattr(entry, 'supplier_invoice_id', None),
        )

    # ─── CLIENT PAYMENT / PREPAYMENT ─────────────────────────────────
    @staticmethod
    def _exec_client_payment(entry, manager):
        """Dr. Cash → Cr. Accounts Receivable"""
        if not entry.client_id:
            logger.warning(f"AddressBook #{entry.id}: No client linked — skipping GL post")
            return None

        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='CLIENT_PAYMENT',
            amount=entry.amount_in,
            description=f"[AddressBook #{entry.id}] {entry.description}",
            contact_id=entry.client_id,
            invoice_id=getattr(entry, 'client_invoice_id', None),
        )

    # ─── EXPENSE ─────────────────────────────────────────────────────
    @staticmethod
    def _exec_expense(entry, manager):
        """Dr. Expense Account → Cr. Cash"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='EXPENSE',
            amount=entry.amount_out,
            description=f"[AddressBook #{entry.id}] Expense: {entry.description}",
            extra_data={
                'expense_category': getattr(entry, 'expense_category', None),
            },
        )

    # ─── PARTNER CAPITAL IN ────────────────────────────────────────
    @staticmethod
    def _exec_partner_capital_in(entry, manager):
        """Dr. Cash, Cr. Owner's Equity (Capital)"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='PARTNER_CAPITAL_IN',
            amount=entry.amount_in,
            description=f"[AccountBook #{entry.id}] Partner Capital Injection: {entry.partner_name or entry.description}",
            extra_data={
                'partner_name': getattr(entry, 'partner_name', None),
                'partner_id': getattr(entry, 'partner_id', None),
            },
        )

    # ─── PARTNER CASH IN ───────────────────────────────────────────
    @staticmethod
    def _exec_partner_cash_in(entry, manager):
        """Dr. Cash, Cr. Partner's Account"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='PARTNER_CASH_IN',
            amount=entry.amount_in,
            description=f"[AccountBook #{entry.id}] Partner Cash Transfer (In): {entry.partner_name or entry.description}",
            extra_data={
                'partner_name': getattr(entry, 'partner_name', None),
                'partner_id': getattr(entry, 'partner_id', None),
            },
        )

    # ─── PARTNER CAPITAL OUT ───────────────────────────────────────
    @staticmethod
    def _exec_partner_capital_out(entry, manager):
        """Dr. Owner's Drawing, Cr. Cash"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='PARTNER_CAPITAL_OUT',
            amount=entry.amount_out,
            description=f"[AccountBook #{entry.id}] Partner Capital Withdrawal: {entry.partner_name or entry.description}",
            extra_data={
                'partner_name': getattr(entry, 'partner_name', None),
                'partner_id': getattr(entry, 'partner_id', None),
            },
        )

    # ─── PARTNER CASH OUT ──────────────────────────────────────────
    @staticmethod
    def _exec_partner_cash_out(entry, manager):
        """Dr. Partner's Account, Cr. Cash"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='PARTNER_CASH_OUT',
            amount=entry.amount_out,
            description=f"[AccountBook #{entry.id}] Partner Cash Transfer (Out): {entry.partner_name or entry.description}",
            extra_data={
                'partner_name': getattr(entry, 'partner_name', None),
                'partner_id': getattr(entry, 'partner_id', None),
            },
        )

    # ─── SALES RETURN ────────────────────────────────────────────────
    @staticmethod
    def _exec_sales_return(entry, manager):
        """Dr. Sales Returns → Cr. Cash"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='SALES_RETURN',
            amount=entry.amount_out,
            description=f"[AddressBook #{entry.id}] Sales Return: {entry.description}",
            invoice_id=getattr(entry, 'client_invoice_id', None),
            extra_data={
                'linked_order_ref': getattr(entry, 'linked_order_ref', None),
            },
        )

    # ─── CASH VARIANCE ───────────────────────────────────────────────
    @staticmethod
    def _exec_cash_variance(entry, manager):
        """
        CASH_OVERAGE: Dr. Cash → Cr. Cash Over/Short (income)
        CASH_SHORTAGE: Dr. Cash Over/Short (expense) → Cr. Cash
        """
        is_overage = entry.entry_type == 'CASH_OVERAGE'
        amount = entry.amount_in if is_overage else entry.amount_out

        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type=entry.entry_type,
            amount=amount,
            description=f"[AddressBook #{entry.id}] {'Cash Overage' if is_overage else 'Cash Shortage'}: {entry.description}",
        )

    # ─── MONEY TRANSFER ──────────────────────────────────────────────
    @staticmethod
    def _exec_money_transfer(entry, manager):
        """Dr. Target Account → Cr. Cash (or vice versa)"""
        amount = entry.amount_out if entry.amount_out > 0 else entry.amount_in

        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='MONEY_TRANSFER',
            amount=amount,
            description=f"[AddressBook #{entry.id}] Money Transfer: {entry.description}",
            extra_data={
                'direction': 'OUT' if entry.amount_out > 0 else 'IN',
            },
        )

    # ─── SALE DEPOSIT ────────────────────────────────────────────────
    @staticmethod
    def _exec_sale_deposit(entry, manager):
        """Dr. Cash → Cr. Unearned Revenue / Customer Deposits"""
        return AddressBookExecutor._post_via_connector(
            entry=entry,
            manager=manager,
            entry_type='SALE_DEPOSIT',
            amount=entry.amount_in,
            description=f"[AddressBook #{entry.id}] Sale Deposit: {entry.description}",
        )
