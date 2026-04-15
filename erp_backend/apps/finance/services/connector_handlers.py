"""
Finance Connector Handlers
============================
Implements the Finance Public Contract for cross-module access.

Other modules call these methods through ConnectorEngine.route_read() / route_write().
This is the ONLY entry point for cross-module access to finance internals.

Architecture ref: .ai/plans/module-decoupling-blueprint.md
Contract ref:     apps/finance/public_contract.py
"""
import logging
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger('erp.finance.connector')

# ── SYSCOHADA COA Code Registry ──────────────────────────────────────────────
# These mappings are OWNED by finance. No other module should know these codes.
# Previously these were duplicated in:
#   - apps/pos/services/accounting_poster.py (_COA, _PM_TO_COA)
#   - apps/pos/services/reconciliation_service.py (_PM_TO_COA)

_SALE_ACCOUNTS = {
    'AR':            '411',   # Accounts Receivable — Clients
    'REVENUE':       '701',   # Ventes de marchandises HT
    'VAT_PAYABLE':   '443',   # TVA collectée sur ventes
    'COGS':          '601',   # Coût des marchandises vendues
    'INVENTORY':     '311',   # Marchandises en stock
    'CASH':          '571',   # Caisse (cash drawer)
    'BANK':          '521',   # Banque
    'MOBILE':        '562',   # Portefeuille mobile (Wave, Orange Money)
    'AIRSI_PAYABLE': '447',   # AIRSI collecté à reverser
    'WRITE_OFF':     '673',   # Charges exceptionnelles / write-off
    'OTHER':         '4718',  # Other operations
}

_PAYMENT_METHOD_TO_COA = {
    'CASH':          '571',
    'WAVE':          '562',
    'ORANGE_MONEY':  '562',
    'MTN_MOBILE':    '562',
    'MOBILE':        '562',
    'BANK':          '521',
    'CREDIT':        '411',   # On credit → stays in A/R until reconciled
    'REWARD_POINTS': '411',
    'WALLET_DEBIT':  '411',
    'ROUND_OFF':     '673',
    'OTHER':         '4718',
}


def _resolve_account(organization, code: str):
    """Resolve a ChartOfAccount by code for an organization. Returns (id, name) or (None, None)."""
    from apps.finance.models import ChartOfAccount
    acc = ChartOfAccount.objects.filter(
        organization=organization, code=code, is_active=True
    ).first()
    if acc:
        return acc.id, acc.name
    return None, None


def _resolve_account_id(organization, code: str):
    """Shortcut: returns just the account ID or None."""
    acc_id, _ = _resolve_account(organization, code)
    return acc_id


class FinanceConnectorService:
    """
    Public contract implementation for the Finance module.

    All methods are classmethods with standardized signatures:
      - Read methods:  (organization, **params) → dict
      - Write methods: (organization, data: dict) → dict with 'success' key
    """

    # ═════════════════════════════════════════════════════════════════════════
    # READS
    # ═════════════════════════════════════════════════════════════════════════

    @classmethod
    def get_account_by_code(cls, organization, code=None, **kwargs):
        """Resolve a ChartOfAccount by code. Returns {account_id, account_name, code}."""
        acc_id, acc_name = _resolve_account(organization, code)
        return {'account_id': acc_id, 'account_name': acc_name, 'code': code}

    @classmethod
    def get_payment_method_account(cls, organization, payment_method=None, **kwargs):
        """Resolve the COA account ID for a payment method. Returns {account_id, code}."""
        code = _PAYMENT_METHOD_TO_COA.get((payment_method or '').upper(), _SALE_ACCOUNTS['OTHER'])
        acc_id = _resolve_account_id(organization, code)
        return {'account_id': acc_id, 'code': code}

    @classmethod
    def get_customer_balance(cls, organization, contact_id=None, **kwargs):
        """Get outstanding A/R balance for a contact."""
        from apps.finance.models import JournalLine
        from django.db.models import Sum, F

        balance = Decimal('0')
        try:
            ar_id = _resolve_account_id(organization, _SALE_ACCOUNTS['AR'])
            if ar_id:
                agg = JournalLine.objects.filter(
                    journal_entry__organization=organization,
                    journal_entry__status='POSTED',
                    account_id=ar_id,
                    contact_id=contact_id,
                ).aggregate(
                    total_dr=Sum('debit'),
                    total_cr=Sum('credit'),
                )
                total_dr = agg['total_dr'] or Decimal('0')
                total_cr = agg['total_cr'] or Decimal('0')
                balance = total_dr - total_cr
        except Exception as e:
            logger.warning(f"[FinanceConnector] get_customer_balance failed: {e}")

        return {'balance': str(balance), 'currency': getattr(organization, 'currency_code', 'XOF')}

    @classmethod
    def get_fiscal_year(cls, organization, **kwargs):
        """Get the active fiscal year for an organization."""
        from apps.finance.models import FiscalYear
        try:
            fy = FiscalYear.objects.filter(
                organization=organization, is_locked=False
            ).order_by('-start_date').first()
            if fy:
                return {
                    'fiscal_year_id': fy.id,
                    'start_date': str(fy.start_date),
                    'end_date': str(fy.end_date),
                    'is_locked': fy.is_locked,
                }
        except Exception:
            pass
        return {'fiscal_year_id': None, 'start_date': None, 'end_date': None, 'is_locked': True}

    @classmethod
    def generate_sequence(cls, organization, sequence_type=None, **kwargs):
        """Generate the next sequence number for a document type."""
        from apps.finance.services.base_services import SequenceService
        seq = SequenceService.get_next(organization, sequence_type)
        return {'sequence_number': seq}

    @classmethod
    def get_financial_account(cls, organization, account_id=None, **kwargs):
        """Get a FinancialAccount by ID."""
        from apps.finance.models import FinancialAccount
        try:
            fa = FinancialAccount.objects.filter(
                organization=organization, id=account_id
            ).first()
            if fa:
                return {
                    'id': fa.id,
                    'name': fa.name,
                    'type': getattr(fa, 'account_type', ''),
                    'balance': str(getattr(fa, 'balance', '0')),
                    'ledger_account_id': fa.ledger_account_id,
                }
        except Exception:
            pass
        return {'id': None, 'name': None, 'type': None, 'balance': '0'}

    @classmethod
    def get_account_balance(cls, organization, account_id=None, **kwargs):
        """Get the balance for a ChartOfAccount by ID."""
        from apps.finance.models import ChartOfAccount
        try:
            acc = ChartOfAccount.objects.filter(
                organization=organization, id=account_id
            ).first()
            if acc:
                return {'balance': str(getattr(acc, 'balance', '0')), 'name': acc.name, 'code': acc.code}
        except Exception:
            pass
        return {'balance': '0', 'name': None, 'code': None}

    @classmethod
    def log_audit_mutation(cls, organization, data):
        """Route audit logging via ConnectorEngine — delegates to ForensicAuditService."""
        try:
            from apps.finance.services import ForensicAuditService
            ForensicAuditService.log_mutation(
                organization=organization,
                user=_resolve_user(data.get('user_id')),
                model_name=data.get('model_name', ''),
                object_id=data.get('object_id'),
                change_type=data.get('change_type', 'UPDATE'),
                payload=data.get('payload', {}),
            )
            return {'success': True}
        except Exception as exc:
            logger.warning(f"[FinanceConnector] log_audit_mutation failed: {exc}")
            return {'success': False, 'error': str(exc)}

    @classmethod
    def generate_barcode(cls, organization, data=None, **kwargs):
        """Generate a barcode via BarcodeService."""
        try:
            from apps.finance.services import BarcodeService
            barcode = BarcodeService.generate_barcode(organization)
            return {'barcode': barcode, 'success': True}
        except Exception as exc:
            return {'barcode': None, 'success': False, 'error': str(exc)}

    @classmethod
    def record_supplier_payment(cls, organization, data):
        """Record a supplier payment via PaymentService."""
        try:
            from apps.finance.payment_service import PaymentService
            from apps.finance.models import FinancialAccount

            # Resolve cash account
            cash_acc_id = data.get('cash_account_id')
            cash_fin_acc = None
            if cash_acc_id:
                cash_fin_acc = FinancialAccount.objects.filter(
                    organization=organization, ledger_account_id=cash_acc_id
                ).first()
            if not cash_fin_acc:
                cash_fin_acc = FinancialAccount.objects.filter(
                    organization=organization, name__icontains='cash'
                ).first()
            if not cash_fin_acc:
                return {'success': False, 'error': 'NO_CASH_ACCOUNT'}

            payment = PaymentService.record_supplier_payment(
                organization=organization,
                contact_id=data.get('contact_id'),
                amount=data.get('amount'),
                payment_date=data.get('payment_date'),
                payment_account_id=cash_fin_acc.id,
                method=data.get('method', 'CASH'),
                description=data.get('description', ''),
                supplier_invoice_id=data.get('invoice_id'),
                scope='OFFICIAL',
                user=_resolve_user(data.get('user_id')),
            )
            return {'success': True, 'payment_id': payment.id if payment else None}
        except Exception as exc:
            logger.error(f"[FinanceConnector] record_supplier_payment failed: {exc}", exc_info=True)
            return {'success': False, 'error': str(exc)}

    # ─────────────────────────────────────────────────────────────────────────
    # TAX ENGINE — Encapsulates all TaxCalculator access so POS never imports it
    # ─────────────────────────────────────────────────────────────────────────

    @classmethod
    def get_tax_context(cls, organization, scope='OFFICIAL', is_export=False, **kwargs):
        """
        Build a TaxEngineContext for an organization/scope.
        Returns a serializable dict with all fields POS needs.
        """
        try:
            from apps.finance.tax_calculator import TaxEngineContext
            ctx = TaxEngineContext.from_org(organization, scope=scope, is_export=is_export)
            return {
                'vat_active': ctx.vat_active,
                'vat_input_recoverability': str(ctx.vat_input_recoverability),
                'airsi_treatment': getattr(ctx, 'airsi_treatment', 'NONE'),
                'custom_rules': [
                    {
                        'id': r.id,
                        'name': r.name,
                        'rate': str(r.rate),
                        'transaction_type': r.transaction_type,
                        'math_behavior': r.math_behavior,
                        'liability_account_id': r.liability_account_id,
                    }
                    for r in getattr(ctx, 'custom_rules', [])
                ],
                'scope': scope,
                'success': True,
            }
        except Exception as exc:
            logger.warning(f"[FinanceConnector] get_tax_context failed: {exc}")
            return {
                'vat_active': scope == 'OFFICIAL',
                'vat_input_recoverability': '1',
                'airsi_treatment': 'NONE',
                'custom_rules': [],
                'scope': scope,
                'success': False,
            }

    @classmethod
    def resolve_invoice_type(cls, organization, data):
        """
        Determine invoice type for a sale based on scope and client VAT status.
        data: {scope, contact_id, is_export}
        """
        try:
            from apps.finance.tax_calculator import TaxEngineContext, TaxCalculator
            scope = data.get('scope', 'OFFICIAL')
            is_export = data.get('is_export', False)
            ctx = TaxEngineContext.from_org(organization, scope=scope, is_export=is_export)

            client_vat_registered = False
            contact_id = data.get('contact_id')
            if contact_id:
                try:
                    from apps.finance.tax_calculator import _ClientProfile
                    from erp.connector_registry import connector
                    Contact = connector.require('crm.contacts.get_model', org_id=0, source='finance')
                    contact = Contact.objects.filter(id=contact_id, organization=organization).first()
                    if contact:
                        client_vat_registered = _ClientProfile.from_contact(contact).vat_registered
                except Exception:
                    pass

            invoice_type = TaxCalculator.resolve_invoice_type(ctx, client_vat_registered)
            return {'invoice_type': invoice_type, 'success': True}
        except Exception as exc:
            logger.warning(f"[FinanceConnector] resolve_invoice_type failed: {exc}")
            return {'invoice_type': 'RECEIPT', 'success': False}

    @classmethod
    def resolve_purchase_costs(cls, organization, data):
        """
        Calculate purchase cost breakdown using TaxCalculator.
        data: {base_ht, vat_rate, airsi_rate, scope, is_export,
               supplier_id, supplier_vat_registered, supplier_reverse_charge, supplier_airsi_subject}
        """
        try:
            from apps.finance.tax_calculator import TaxEngineContext, TaxCalculator, _SupplierProfile

            scope = data.get('scope', 'OFFICIAL')
            is_export = data.get('is_export', False)
            ctx = TaxEngineContext.from_org(organization, scope=scope, is_export=is_export)

            # Build supplier profile from data or contact
            supplier_id = data.get('supplier_id')
            if supplier_id:
                try:
                    from erp.connector_registry import connector
                    Contact = connector.require('crm.contacts.get_model', org_id=0, source='finance')
                    supplier = Contact.objects.filter(id=supplier_id, organization=organization).first()
                    if supplier:
                        supplier_profile = _SupplierProfile.from_contact(supplier)
                    else:
                        supplier_profile = _SupplierProfile(
                            vat_registered=data.get('supplier_vat_registered', True),
                            reverse_charge=data.get('supplier_reverse_charge', False),
                            airsi_subject=data.get('supplier_airsi_subject', False),
                        )
                except Exception:
                    supplier_profile = _SupplierProfile(
                        vat_registered=data.get('supplier_vat_registered', True),
                        reverse_charge=data.get('supplier_reverse_charge', False),
                        airsi_subject=data.get('supplier_airsi_subject', False),
                    )
            else:
                supplier_profile = _SupplierProfile(
                    vat_registered=data.get('supplier_vat_registered', True),
                    reverse_charge=data.get('supplier_reverse_charge', False),
                    airsi_subject=data.get('supplier_airsi_subject', False),
                )

            costs = TaxCalculator.resolve_purchase_costs(
                base_ht=Decimal(str(data.get('base_ht', '0'))),
                vat_rate=Decimal(str(data.get('vat_rate', '0'))),
                airsi_rate=Decimal(str(data.get('airsi_rate', '0'))),
                ctx=ctx,
                supplier_vat_registered=supplier_profile.vat_registered,
                supplier_reverse_charge=supplier_profile.reverse_charge,
                supplier_airsi_subject=supplier_profile.airsi_subject,
            )

            # Serialize the result
            serialized = {}
            for k, v in costs.items():
                if isinstance(v, Decimal):
                    serialized[k] = str(v)
                elif isinstance(v, list):
                    serialized[k] = [
                        {sk: str(sv) if isinstance(sv, Decimal) else sv for sk, sv in tl.items()}
                        for tl in v
                    ]
                else:
                    serialized[k] = v

            serialized['success'] = True
            serialized['vat_active'] = ctx.vat_active
            serialized['vat_input_recoverability'] = str(ctx.vat_input_recoverability)
            serialized['airsi_treatment'] = getattr(ctx, 'airsi_treatment', 'NONE')
            return serialized

        except Exception as exc:
            logger.error(f"[FinanceConnector] resolve_purchase_costs failed: {exc}", exc_info=True)
            return {'success': False, 'error': str(exc)}

    @classmethod
    def get_supplier_tax_profile(cls, organization, data):
        """
        Get tax profile (vat_registered, reverse_charge, airsi_subject) for a supplier contact.
        """
        try:
            from apps.finance.tax_calculator import _SupplierProfile
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=0, source='finance')
            supplier = Contact.objects.filter(
                id=data.get('supplier_id'), organization=organization
            ).first()
            if supplier:
                profile = _SupplierProfile.from_contact(supplier)
                return {
                    'vat_registered': profile.vat_registered,
                    'reverse_charge': profile.reverse_charge,
                    'airsi_subject': profile.airsi_subject,
                    'success': True,
                }
        except Exception as exc:
            logger.warning(f"[FinanceConnector] get_supplier_tax_profile failed: {exc}")
        return {'vat_registered': True, 'reverse_charge': False, 'airsi_subject': False, 'success': False}

    @classmethod
    def get_financial_accounts_for_org(cls, organization, **kwargs):
        """List all FinancialAccounts for an organization. Used by POS for payment method resolution."""
        from apps.finance.models import FinancialAccount
        try:
            accounts = list(
                FinancialAccount.objects.filter(organization=organization).values(
                    'id', 'name', 'account_type', 'ledger_account_id'
                )
            )
            return {'accounts': accounts, 'success': True}
        except Exception:
            return {'accounts': [], 'success': False}

    @classmethod
    def get_journal_lines_for_session(cls, organization, session_id=None, **kwargs):
        """
        Get journal line summaries for a POS session (used in register_lobby reconciliation).
        Returns aggregated debit/credit per account for a given session reference.
        """
        from apps.finance.models import JournalLine
        try:
            lines = list(
                JournalLine.objects.filter(
                    journal_entry__organization=organization,
                    journal_entry__reference__contains=f"SES-{session_id}" if session_id else '',
                ).values('account__code', 'account__name').annotate(
                    total_debit=Sum('debit'),
                    total_credit=Sum('credit'),
                )
            )
            return {'lines': lines, 'success': True}
        except Exception:
            return {'lines': [], 'success': False}

    @classmethod
    def get_invoice_by_id(cls, organization, invoice_id=None, **kwargs):
        """Retrieve an Invoice record by ID for cross-module display."""
        try:
            from apps.finance.invoice_models import Invoice
            inv = Invoice.objects.filter(id=invoice_id, organization=organization).first()
            if inv:
                return {
                    'id': inv.id,
                    'invoice_number': getattr(inv, 'invoice_number', ''),
                    'status': inv.status,
                    'total_amount_ttc': str(getattr(inv, 'total_amount_ttc', '0')),
                    'contact_name': getattr(inv, 'contact_name', ''),
                    'success': True,
                }
        except Exception:
            pass
        return {'id': None, 'success': False}

    @classmethod
    def get_financial_account_serializer_data(cls, organization, account_id=None, **kwargs):
        """Get serialized FinancialAccount data (replaces FinancialAccountSerializer import)."""
        from apps.finance.models import FinancialAccount
        try:
            fa = FinancialAccount.objects.filter(id=account_id, organization=organization).first()
            if fa:
                return {
                    'id': fa.id,
                    'name': fa.name,
                    'account_type': getattr(fa, 'account_type', ''),
                    'ledger_account_id': fa.ledger_account_id,
                    'balance': str(getattr(fa, 'balance', '0')),
                    'is_default': getattr(fa, 'is_default', False),
                    'success': True,
                }
        except Exception:
            pass
        return {'id': None, 'success': False}

    # ═════════════════════════════════════════════════════════════════════════
    # WRITES
    # ═════════════════════════════════════════════════════════════════════════

    @classmethod
    def post_sale_transaction(cls, organization, data):
        """
        Post a complete sale journal entry.
        Dr A/R (411) ← total_ttc
          Cr Revenue (701) ← subtotal_ht
          Cr VAT Payable (443) ← tax_amount
          Cr AIRSI Payable (447) ← airsi_amount (if any)

        Finance owns ALL COA resolution. POS sends business data only.
        """
        try:
            from apps.finance.services.ledger_service import LedgerService

            total_ttc   = Decimal(str(data.get('total_ttc', '0')))
            subtotal_ht = Decimal(str(data.get('subtotal_ht', '0')))
            tax_amount  = Decimal(str(data.get('tax_amount', '0')))
            airsi_amount = Decimal(str(data.get('airsi_amount', '0')))
            scope = data.get('scope', 'OFFICIAL')

            if scope != 'OFFICIAL' or total_ttc <= Decimal('0'):
                return {'success': False, 'journal_ref': None, 'error': 'ZERO_AMOUNT'}

            # Finance resolves accounts — POS never knows these codes
            ar_id       = _resolve_account_id(organization, _SALE_ACCOUNTS['AR'])
            revenue_id  = _resolve_account_id(organization, _SALE_ACCOUNTS['REVENUE'])
            vat_id      = _resolve_account_id(organization, _SALE_ACCOUNTS['VAT_PAYABLE'])
            airsi_id    = _resolve_account_id(organization, _SALE_ACCOUNTS['AIRSI_PAYABLE']) if airsi_amount else None

            if not ar_id or not revenue_id:
                logger.warning(
                    f"[FinanceConnector] post_sale_transaction: 411 or 701 missing for org {organization.id}"
                )
                return {'success': False, 'journal_ref': None, 'error': 'MISSING_ACCOUNTS'}

            invoice_number = data.get('invoice_number', '')
            ref_code = data.get('ref_code', invoice_number)
            contact_id = data.get('contact_id')

            lines = [
                # Dr A/R for full TTC
                {'account_id': ar_id,
                 'debit': total_ttc, 'credit': Decimal('0'),
                 'description': f"A/R — {invoice_number or ref_code}",
                 'contact_id': contact_id},
                # Cr Revenue (HT)
                {'account_id': revenue_id,
                 'debit': Decimal('0'), 'credit': subtotal_ht,
                 'description': f"Ventes HT — {invoice_number or ref_code}"},
            ]

            # Cr VAT Payable
            if vat_id and tax_amount > Decimal('0'):
                lines.append({
                    'account_id': vat_id,
                    'debit': Decimal('0'), 'credit': tax_amount,
                    'description': f"TVA collectée — {invoice_number or ref_code}",
                })
            elif tax_amount > Decimal('0'):
                # No VAT account found — fold into revenue to balance
                lines[1]['credit'] += tax_amount
                logger.warning(f"[FinanceConnector] 443 missing — VAT folded into revenue for order {data.get('order_id')}")

            # Cr AIRSI Payable
            if airsi_id and airsi_amount > Decimal('0'):
                lines.append({
                    'account_id': airsi_id,
                    'debit': Decimal('0'), 'credit': airsi_amount,
                    'description': f"AIRSI collecté — {invoice_number or ref_code}",
                })

            # Balance check
            _ensure_balance(lines)

            journal_ref = f"CONF-{invoice_number or data.get('order_id')}-{scope}"
            confirmed_at = data.get('confirmed_at') or timezone.now()

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=confirmed_at,
                description=f"Vente confirmée — {invoice_number or ref_code}",
                lines=lines,
                reference=journal_ref,
                status='POSTED',
                scope=scope,
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            logger.info(f"[FinanceConnector] Sale JE posted: {journal_ref}")
            return {'success': True, 'journal_ref': journal_ref, 'error': None}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_sale_transaction failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None, 'error': str(exc)}

    @classmethod
    def post_cogs_entry(cls, organization, data):
        """
        Post COGS journal entry on delivery.
        Dr COGS (601) ← cogs_total
          Cr Inventory (311) ← cogs_total
        """
        try:
            from apps.finance.services.ledger_service import LedgerService

            cogs_total = Decimal(str(data.get('cogs_total', '0'))).quantize(Decimal('0.01'))
            if cogs_total <= Decimal('0'):
                return {'success': False, 'journal_ref': None}

            cogs_id = _resolve_account_id(organization, _SALE_ACCOUNTS['COGS'])
            inv_id  = _resolve_account_id(organization, _SALE_ACCOUNTS['INVENTORY'])

            if not cogs_id or not inv_id:
                logger.warning(f"[FinanceConnector] post_cogs_entry: 601 or 311 missing")
                return {'success': False, 'journal_ref': None}

            invoice_number = data.get('invoice_number', '')
            ref_code = data.get('ref_code', invoice_number)
            journal_ref = f"COGS-{invoice_number or data.get('order_id')}"

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=data.get('delivered_at') or timezone.now(),
                description=f"COGS livraison — {invoice_number or ref_code}",
                lines=[
                    {'account_id': cogs_id, 'debit': cogs_total, 'credit': Decimal('0'),
                     'description': f"COGS — {invoice_number or ref_code}"},
                    {'account_id': inv_id, 'debit': Decimal('0'), 'credit': cogs_total,
                     'description': f"Sortie stock — {invoice_number or ref_code}"},
                ],
                reference=journal_ref,
                status='POSTED',
                scope=data.get('scope', 'OFFICIAL'),
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            logger.info(f"[FinanceConnector] COGS JE posted: {journal_ref}")
            return {'success': True, 'journal_ref': journal_ref}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_cogs_entry failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None}

    @classmethod
    def post_payment_receipt(cls, organization, data):
        """
        Post payment journal entry.
        Dr Cash/Bank/Mobile ← amount
          Cr A/R (411) ← amount

        Finance resolves payment_method → COA code internally.
        """
        try:
            from apps.finance.services.ledger_service import LedgerService

            amount = Decimal(str(data.get('amount', '0'))).quantize(Decimal('0.01'))
            payment_method = (data.get('payment_method') or 'CASH').upper()
            scope = data.get('scope', 'OFFICIAL')

            if amount <= Decimal('0') or scope != 'OFFICIAL':
                return {'success': False, 'journal_ref': None}

            # Only post for CREDIT sales (A/R clearance)
            if payment_method != 'CREDIT' and not data.get('force', False):
                return {'success': True, 'journal_ref': None}  # No JE needed for cash sales

            pm_code = _PAYMENT_METHOD_TO_COA.get(payment_method, _SALE_ACCOUNTS['CASH'])
            cash_id = _resolve_account_id(organization, pm_code)
            ar_id   = _resolve_account_id(organization, _SALE_ACCOUNTS['AR'])

            if not cash_id or not ar_id:
                return {'success': False, 'journal_ref': None}

            invoice_number = data.get('invoice_number', '')
            journal_ref = f"PAY-{invoice_number or data.get('order_id')}"

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Encaissement — {invoice_number or data.get('ref_code', '')}",
                lines=[
                    {'account_id': cash_id, 'debit': amount, 'credit': Decimal('0'),
                     'description': f"Encaissement {payment_method}"},
                    {'account_id': ar_id, 'debit': Decimal('0'), 'credit': amount,
                     'description': f"Apurement A/R — {invoice_number}"},
                ],
                reference=journal_ref,
                status='POSTED',
                scope=scope,
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            logger.info(f"[FinanceConnector] Payment JE posted: {journal_ref}")
            return {'success': True, 'journal_ref': journal_ref}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_payment_receipt failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None}

    @classmethod
    def post_refund(cls, organization, data):
        """
        Reverse a previously posted journal entry by reference.
        Idempotent: if already reversed, returns success with already_reversed=True.
        """
        try:
            from apps.finance.services.ledger_service import LedgerService
            from apps.finance.models import JournalEntry

            journal_ref = data.get('journal_ref', '')
            if not journal_ref:
                return {'success': False, 'reversal_ref': None, 'already_reversed': False}

            je = JournalEntry.objects.filter(
                organization=organization,
                reference=journal_ref,
                status='POSTED'
            ).first()

            if not je:
                # Already reversed or never posted — idempotent success
                return {'success': True, 'reversal_ref': None, 'already_reversed': True}

            reversal = LedgerService.reverse_journal_entry(
                organization, je.id,
                user=_resolve_user(data.get('user_id'))
            )
            reversal_ref = getattr(reversal, 'reference', f"REV-{journal_ref}")

            logger.info(f"[FinanceConnector] JE reversed: {journal_ref} → {reversal_ref}")
            return {'success': True, 'reversal_ref': reversal_ref, 'already_reversed': False}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_refund failed: {exc}", exc_info=True)
            return {'success': False, 'reversal_ref': None, 'already_reversed': False}

    @classmethod
    def post_stock_adjustment(cls, organization, data):
        """
        Post journal entry for inventory adjustment.
        Inventory computes the amount; finance creates the journal.
        """
        try:
            from apps.finance.services.ledger_service import LedgerService

            amount = Decimal(str(data.get('adjustment_amount', '0'))).quantize(Decimal('0.01'))
            if amount == Decimal('0'):
                return {'success': False, 'journal_ref': None}

            inv_id  = _resolve_account_id(organization, _SALE_ACCOUNTS['INVENTORY'])
            cogs_id = _resolve_account_id(organization, _SALE_ACCOUNTS['COGS'])

            if not inv_id or not cogs_id:
                return {'success': False, 'journal_ref': None}

            reference = data.get('reference', f"ADJ-{organization.id}")
            reason = data.get('reason', 'Stock adjustment')

            # Positive = increase (Dr Inventory, Cr COGS), Negative = decrease (Dr COGS, Cr Inventory)
            if amount > Decimal('0'):
                lines = [
                    {'account_id': inv_id, 'debit': amount, 'credit': Decimal('0'),
                     'description': f"Stock increase — {reason}"},
                    {'account_id': cogs_id, 'debit': Decimal('0'), 'credit': amount,
                     'description': f"Adjustment credit — {reason}"},
                ]
            else:
                abs_amount = abs(amount)
                lines = [
                    {'account_id': cogs_id, 'debit': abs_amount, 'credit': Decimal('0'),
                     'description': f"Stock decrease — {reason}"},
                    {'account_id': inv_id, 'debit': Decimal('0'), 'credit': abs_amount,
                     'description': f"Inventory relief — {reason}"},
                ]

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Stock adjustment — {reason}",
                lines=lines,
                reference=reference,
                status='POSTED',
                scope=data.get('scope', 'OFFICIAL'),
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            logger.info(f"[FinanceConnector] Stock adjustment JE posted: {reference}")
            return {'success': True, 'journal_ref': reference}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_stock_adjustment failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None}

    @classmethod
    def log_delivery_expense(cls, organization, data):
        """
        Record a delivery-related expense (e.g., driver commission).
        Dr 6222 (Commission) / 61 (Logistics)
          Cr 421 (Personnel) / 401 (Suppliers)
        """
        try:
            from apps.finance.services.ledger_service import LedgerService
            
            amount = Decimal(str(data.get('amount', '0'))).quantize(Decimal('0.01'))
            if amount <= Decimal('0'):
                return {'success': False, 'error': 'ZERO_AMOUNT'}

            exp_type = data.get('type', 'COMMISSION')
            
            # Resolve Expense Account (SYSCOHADA)
            # 6222 = Commissions
            # 61x = Transports
            exp_code = '6222' if exp_type == 'COMMISSION' else '611'
            exp_id = _resolve_account_id(organization, exp_code)
            
            # Resolve Liability Account
            # 421 = Personnel remunerations dues
            liab_code = '421'
            liab_id = _resolve_account_id(organization, liab_code)
            
            if not exp_id or not liab_id:
                # Fallback to general expense if specific codes missing
                from erp.services import ConfigurationService
                rules = ConfigurationService.get_posting_rules(organization)
                exp_id = exp_id or rules.get('expenses', {}).get('general')
                liab_id = liab_id or _resolve_account_id(organization, '401')

            if not exp_id or not liab_id:
                return {'success': False, 'error': 'ACCOUNT_RESOLUTION_FAILED'}

            order_ref = data.get('order_ref', '')
            beneficiary_id = data.get('beneficiary_user_id')
            
            journal_ref = f"DELX-{order_ref}-{timezone.now().strftime('%Y%m%d%H%M')}"
            
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=data.get('description', f"Delivery Expense: {order_ref}"),
                lines=[
                    {'account_id': exp_id, 'debit': amount, 'credit': Decimal('0'),
                     'description': f"Delivery {exp_type} — {order_ref}"},
                    {'account_id': liab_id, 'debit': Decimal('0'), 'credit': amount,
                     'description': f"Due to driver — {order_ref}",
                     'employee_id': beneficiary_id},
                ],
                reference=journal_ref,
                status='POSTED',
                scope='OFFICIAL',
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )
            
            return {'success': True, 'journal_ref': journal_ref}
        except Exception as exc:
            logger.error(f"[FinanceConnector] log_delivery_expense failed: {exc}", exc_info=True)
            return {'success': False, 'error': str(exc)}

    @classmethod
    def get_employee_ledger_history(cls, organization, params):
        """
        Retrieve all ledger movements for an employee (e.g. driver commissions, payouts).
        params: {user_id}
        """
        try:
            from apps.finance.models import JournalEntryLine
            
            user_id = params.get('user_id')
            if not user_id:
                return {'entries': [], 'balance': '0.00', 'success': False}

            lines = JournalEntryLine.objects.filter(
                journal_entry__organization=organization,
                journal_entry__status='POSTED',
                employee_id=user_id
            ).select_related('journal_entry').order_by('-journal_entry__transaction_date')

            entries = []
            total_balance = Decimal('0')
            for line in lines:
                # Credit normally represents earnings for employees (liability to them)
                # So we show it as positive balance
                amount = line.credit - line.debit
                total_balance += amount
                entries.append({
                    'id': line.id,
                    'date': line.journal_entry.transaction_date.isoformat(),
                    'description': line.description or line.journal_entry.description,
                    'reference': line.journal_entry.reference,
                    'debit': str(line.debit),
                    'credit': str(line.credit),
                    'amount': str(amount),
                })

            return {
                'entries': entries,
                'balance': str(total_balance),
                'success': True
            }
        except Exception as exc:
            logger.error(f"[FinanceConnector] get_employee_ledger_history failed: {exc}", exc_info=True)
            return {'entries': [], 'balance': '0.00', 'success': False, 'error': str(exc)}

    @classmethod
    def log_operational_expense(cls, organization, params):
        """
        Log an operational expense linked to a driver (e.g. Fuel, Maintenance).
        params: {user_id, amount, expense_type, reference, description}
        """
        try:
            from apps.finance.services.posting_rules import PostingRuleService
            
            user_id = params.get('user_id')
            amount = Decimal(str(params.get('amount', '0')))
            expense_type = params.get('expense_type', 'maintenance')
            reference = params.get('reference', f'FLEET-{expense_type.upper()}')
            description = params.get('description', f'Fleet operational expense: {expense_type}')
            
            # Map simplified expense type to accounting system role
            # Defaults to 'office_expense' if specific fleet roles aren't seeded yet
            system_role = 'fleet_fuel' if expense_type == 'fuel' else 'fleet_maintenance'
            
            # 1. Resolve Expense Account
            expense_account = PostingRuleService.resolve_account_by_role(organization, system_role)
            if not expense_account:
                 expense_account = PostingRuleService.resolve_account_by_role(organization, 'utility_expense')
            
            # 2. Resolve Liability/Payable Account for Driver
            liability_account = PostingRuleService.resolve_account_by_role(organization, 'driver_payable')
            if not liability_account:
                liability_account = PostingRuleService.resolve_account_by_role(organization, 'salary_liability')
            
            if not expense_account or not liability_account:
                 return {'success': False, 'error': "Accounting configuration for fleet expenses is missing"}

            journal_ref = cls._create_journal_entry(
                organization=organization,
                reference=reference,
                description=description,
                lines=[
                    {'account': expense_account, 'debit': amount, 'credit': 0, 'employee_id': user_id},
                    {'account': liability_account, 'debit': 0, 'credit': amount, 'employee_id': user_id},
                ]
            )
            return {'success': True, 'journal_ref': journal_ref}
        except Exception as exc:
            logger.error(f"[FinanceConnector] log_operational_expense failed: {exc}", exc_info=True)
            return {'success': False, 'error': str(exc)}

    @classmethod
    def post_write_off_entry(cls, organization, data):
        """
        Post a write-off journal entry.
        Dr Write-Off Expense (673), Cr A/R or specified account.
        """
        try:
            from apps.finance.services.ledger_service import LedgerService

            amount = Decimal(str(data.get('amount', '0'))).quantize(Decimal('0.01'))
            if amount <= Decimal('0'):
                return {'success': False, 'journal_ref': None}

            wo_id = _resolve_account_id(organization, _SALE_ACCOUNTS['WRITE_OFF'])
            credit_account_id = data.get('credit_account_id') or _resolve_account_id(
                organization, _SALE_ACCOUNTS['AR']
            )

            if not wo_id or not credit_account_id:
                return {'success': False, 'journal_ref': None}

            reason = data.get('reason', 'approved shortfall')
            reference = data.get('reference', f"WO-{organization.id}")

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Write-Off — {reason}",
                lines=[
                    {'account_id': wo_id, 'debit': amount, 'credit': Decimal('0'),
                     'description': f"Write-off: {reason}"},
                    {'account_id': credit_account_id, 'debit': Decimal('0'), 'credit': amount,
                     'description': f"Clear receivable — {reason}"},
                ],
                reference=reference,
                status='POSTED',
                scope=data.get('scope', 'OFFICIAL'),
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            return {'success': True, 'journal_ref': reference}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_write_off_entry failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None}

    @classmethod
    def post_address_book_entry(cls, organization, data):
        """
        Post a journal entry from a POS Address Book action.
        Handles all entry types — finance resolves accounts by type.

        Supported types:
          SUPPLIER_PAYMENT, CLIENT_PAYMENT, EXPENSE,
          PARTNER_CAPITAL_IN, PARTNER_CASH_IN,
          PARTNER_CAPITAL_OUT, PARTNER_CASH_OUT,
          SALES_RETURN, CASH_OVERAGE, CASH_SHORTAGE,
          MONEY_TRANSFER, SALE_DEPOSIT
        """
        try:
            from apps.finance.services.ledger_service import LedgerService
            from apps.finance.models import ChartOfAccount
            from erp.services import ConfigurationService

            entry_type = data.get('entry_type', '')
            entry_id = data.get('entry_id', '')
            amount = Decimal(str(data.get('amount', '0'))).quantize(Decimal('0.01'))
            description = data.get('description', '')
            cash_acc_id = data.get('cash_account_id')
            target_account_id = data.get('target_account_id')
            extra = data.get('extra_data', {})

            if amount <= Decimal('0'):
                return {'success': False, 'journal_ref': None, 'error': 'ZERO_AMOUNT'}

            if not cash_acc_id:
                logger.warning(f"[FinanceConnector] post_address_book_entry: No cash account for #{entry_id}")
                return {'success': False, 'journal_ref': None, 'error': 'NO_CASH_ACCOUNT'}

            # ── Dispatch by entry type ────────────────────────────────────
            handler = _AB_ENTRY_HANDLERS.get(entry_type)
            if not handler:
                logger.warning(f"[FinanceConnector] Unknown address book entry type: {entry_type}")
                return {'success': False, 'journal_ref': None, 'error': 'UNKNOWN_TYPE'}

            lines, ref_prefix = handler(
                organization, amount, cash_acc_id, target_account_id,
                description, entry_id, extra
            )

            if not lines:
                return {'success': False, 'journal_ref': None, 'error': 'ACCOUNT_RESOLUTION_FAILED'}

            journal_ref = f"AB-{ref_prefix}-{entry_id}"

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=data.get('transaction_date') or timezone.now(),
                description=description,
                lines=lines,
                reference=journal_ref,
                status='POSTED',
                scope='OFFICIAL',
                site_id=data.get('site_id'),
                user=_resolve_user(data.get('user_id')),
                internal_bypass=True,
            )

            # ── Handle invoice linkage ────────────────────────────────────
            invoice_id = data.get('invoice_id')
            if invoice_id and entry_type in ('SUPPLIER_PAYMENT', 'CLIENT_PAYMENT', 'SALES_RETURN'):
                _handle_invoice_payment(organization, invoice_id, amount, entry_type)

            logger.info(f"[FinanceConnector] Address book JE posted: {journal_ref}")
            return {'success': True, 'journal_ref': journal_ref, 'error': None}

        except Exception as exc:
            logger.error(f"[FinanceConnector] post_address_book_entry failed: {exc}", exc_info=True)
            return {'success': False, 'journal_ref': None, 'error': str(exc)}


# ── Utilities ────────────────────────────────────────────────────────────────

def _ensure_balance(lines: list) -> None:
    """
    Adjusts the last credit line by the debit/credit imbalance to guarantee
    the entry is balanced. Accepts rounding differences up to 1 unit.
    Moved from apps/pos/services/accounting_poster.py into finance domain.
    """
    total_dr = sum(Decimal(str(l['debit']))  for l in lines)
    total_cr = sum(Decimal(str(l['credit'])) for l in lines)
    diff = total_dr - total_cr
    if abs(diff) > Decimal('0') and abs(diff) <= Decimal('1'):
        for l in reversed(lines):
            if l['credit'] > Decimal('0'):
                l['credit'] = Decimal(str(l['credit'])) + diff
                break


def _resolve_user(user_id):
    """Resolve a user instance from an ID, or return None."""
    if not user_id:
        return None
    try:
        from erp.models import User
        return User.objects.get(id=user_id)
    except Exception:
        return None


# ── Address Book Entry Type Handlers ─────────────────────────────────────────
# Each returns (lines, ref_prefix) or (None, None) if accounts can't be resolved.

def _ab_supplier_payment(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. A/P (401) → Cr. Cash"""
    ap_id = _resolve_account_id(org, '401')  # Accounts Payable
    if not ap_id:
        ap_id = _resolve_account_id(org, _SALE_ACCOUNTS['AR'])  # Fallback
    if not ap_id:
        return None, None
    return [
        {'account_id': ap_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Supplier payment: {desc}"},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash outflow'},
    ], 'SUPPAY'


def _ab_client_payment(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash → Cr. A/R (411)"""
    ar_id = _resolve_account_id(org, _SALE_ACCOUNTS['AR'])
    if not ar_id:
        return None, None
    return [
        {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Client payment received: {desc}"},
        {'account_id': ar_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'A/R clearance'},
    ], 'CLIPAY'


def _ab_expense(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Expense → Cr. Cash"""
    from apps.finance.models import ChartOfAccount
    from erp.services import ConfigurationService

    expense_acc_id = target_acc_id
    if not expense_acc_id:
        rules = ConfigurationService.get_posting_rules(org)
        expense_acc_id = rules.get('expenses', {}).get('general') or rules.get('expenses', {}).get('operating')
    if not expense_acc_id:
        expense_acc = ChartOfAccount.objects.filter(
            organization=org, type='EXPENSE'
        ).first()
        expense_acc_id = expense_acc.id if expense_acc else None
    if not expense_acc_id:
        return None, None

    return [
        {'account_id': expense_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Expense: {extra.get('expense_category', desc)}"},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash outflow'},
    ], 'EXP'


def _ab_partner_capital_in(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash → Cr. Owner's Equity"""
    from apps.finance.models import ChartOfAccount
    equity_acc = ChartOfAccount.objects.filter(organization=org, type='EQUITY').first()
    if not equity_acc:
        return None, None
    return [
        {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Cash from partner: {extra.get('partner_name', '')}"},
        {'account_id': equity_acc.id, 'debit': Decimal('0'), 'credit': amount,
         'description': f"Capital injection: {extra.get('partner_name', '')}"},
    ], 'PCAPIN'


def _ab_partner_cash_in(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash → Cr. Partner's Account"""
    partner_acc_id = _resolve_partner_account(org, extra)
    if not partner_acc_id:
        return None, None
    return [
        {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Cash transfer from partner: {extra.get('partner_name', '')}"},
        {'account_id': partner_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': f"Partner account: {extra.get('partner_name', '')}"},
    ], 'PCASHIN'


def _ab_partner_capital_out(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Owner's Drawing → Cr. Cash"""
    from apps.finance.models import ChartOfAccount
    drawing_acc = ChartOfAccount.objects.filter(
        organization=org, code__icontains='drawing'
    ).first()
    if not drawing_acc:
        drawing_acc = ChartOfAccount.objects.filter(
            organization=org, type='EQUITY'
        ).first()
    if not drawing_acc:
        return None, None
    return [
        {'account_id': drawing_acc.id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Capital withdrawal: {extra.get('partner_name', '')}"},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash outflow to partner'},
    ], 'PCAPOUT'


def _ab_partner_cash_out(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Partner's Account → Cr. Cash"""
    partner_acc_id = _resolve_partner_account(org, extra)
    if not partner_acc_id:
        return None, None
    return [
        {'account_id': partner_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Cash transfer to partner: {extra.get('partner_name', '')}"},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash outflow to partner'},
    ], 'PCASHOUT'


def _ab_sales_return(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Sales Returns → Cr. Cash"""
    from apps.finance.models import ChartOfAccount
    from erp.services import ConfigurationService

    rules = ConfigurationService.get_posting_rules(org)
    returns_acc_id = rules.get('sales', {}).get('returns')
    if not returns_acc_id:
        returns_acc = ChartOfAccount.objects.filter(
            organization=org, name__icontains='return'
        ).first()
        returns_acc_id = returns_acc.id if returns_acc else None
    if not returns_acc_id:
        revenue_acc = ChartOfAccount.objects.filter(
            organization=org, type='REVENUE'
        ).first()
        returns_acc_id = revenue_acc.id if revenue_acc else None
    if not returns_acc_id:
        return None, None

    return [
        {'account_id': returns_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': f"Sales return: {extra.get('linked_order_ref', desc)}"},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash refund to customer'},
    ], 'RET'


def _ab_cash_overage(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash → Cr. Cash Over/Short (income)"""
    from apps.finance.models import ChartOfAccount
    cos_acc = ChartOfAccount.objects.filter(
        organization=org, name__icontains='over'
    ).filter(name__icontains='short').first()
    if not cos_acc:
        cos_acc = ChartOfAccount.objects.filter(
            organization=org, type='EXPENSE', name__icontains='cash'
        ).first()
    if not cos_acc:
        return None, None
    return [
        {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': 'Cash overage found'},
        {'account_id': cos_acc.id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash Over/Short (gain)'},
    ], 'COV'


def _ab_cash_shortage(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash Over/Short (expense) → Cr. Cash"""
    from apps.finance.models import ChartOfAccount
    cos_acc = ChartOfAccount.objects.filter(
        organization=org, name__icontains='over'
    ).filter(name__icontains='short').first()
    if not cos_acc:
        cos_acc = ChartOfAccount.objects.filter(
            organization=org, type='EXPENSE', name__icontains='cash'
        ).first()
    if not cos_acc:
        return None, None
    return [
        {'account_id': cos_acc.id, 'debit': amount, 'credit': Decimal('0'),
         'description': 'Cash Over/Short (loss)'},
        {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
         'description': 'Cash shortage'},
    ], 'CSH'


def _ab_money_transfer(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Target → Cr. Cash (or vice versa)"""
    if not target_acc_id:
        return None, None

    direction = extra.get('direction', 'OUT')
    if direction == 'OUT':
        return [
            {'account_id': target_acc_id, 'debit': amount, 'credit': Decimal('0'),
             'description': 'Transfer from POS register'},
            {'account_id': cash_acc_id, 'debit': Decimal('0'), 'credit': amount,
             'description': 'Cash transferred out'},
        ], 'TRF'
    else:
        return [
            {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
             'description': 'Cash transferred in'},
            {'account_id': target_acc_id, 'debit': Decimal('0'), 'credit': amount,
             'description': 'Transfer to POS register'},
        ], 'TRF'


def _ab_sale_deposit(org, amount, cash_acc_id, target_acc_id, desc, entry_id, extra):
    """Dr. Cash → Cr. Unearned Revenue / Deposits"""
    from apps.finance.models import ChartOfAccount
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
        return None, None
    return [
        {'account_id': cash_acc_id, 'debit': amount, 'credit': Decimal('0'),
         'description': 'Cash deposit received'},
        {'account_id': deposit_acc.id, 'debit': Decimal('0'), 'credit': amount,
         'description': f"Customer deposit: {desc}"},
    ], 'DEP'


# ── Dispatch map ─────────────────────────────────────────────────────────────
_AB_ENTRY_HANDLERS = {
    'SUPPLIER_PAYMENT': _ab_supplier_payment,
    'CLIENT_PAYMENT': _ab_client_payment,
    'CLIENT_PREPAYMENT': _ab_client_payment,
    'EXPENSE': _ab_expense,
    'PARTNER_CAPITAL_IN': _ab_partner_capital_in,
    'PARTNER_CASH_IN': _ab_partner_cash_in,
    'PARTNER_CAPITAL_OUT': _ab_partner_capital_out,
    'PARTNER_CASH_OUT': _ab_partner_cash_out,
    'SALES_RETURN': _ab_sales_return,
    'CASH_OVERAGE': _ab_cash_overage,
    'CASH_SHORTAGE': _ab_cash_shortage,
    'MONEY_TRANSFER': _ab_money_transfer,
    'SALE_DEPOSIT': _ab_sale_deposit,
}


# ── Partner account resolution ───────────────────────────────────────────────

def _resolve_partner_account(org, extra):
    """Resolve partner's linked financial account from CRM Contact."""
    from apps.finance.models import ChartOfAccount

    partner_id = extra.get('partner_id')
    if not partner_id:
        return None

    try:
        # Try to get linked account from CRM contact
        from erp.connector_registry import connector
        Contact = connector.require('crm.contacts.get_model', org_id=0, source='finance')
        contact = Contact.objects.filter(id=partner_id, organization=org).first()
        if contact:
            linked_acc_id = getattr(contact, 'linked_account_id', None)
            if linked_acc_id:
                return linked_acc_id

            # Check for sub-account by contact name
            sub_acc = ChartOfAccount.objects.filter(
                organization=org, name__icontains=contact.name, type='EQUITY'
            ).first()
            if sub_acc:
                return sub_acc.id
    except Exception:
        pass

    return None


# ── Invoice payment linkage ──────────────────────────────────────────────────

def _handle_invoice_payment(org, invoice_id, amount, entry_type):
    """Record payment or refund against an invoice."""
    try:
        from apps.finance.invoice_models import Invoice
        invoice = Invoice.objects.get(id=invoice_id, organization=org)

        if entry_type == 'SALES_RETURN':
            invoice.paid_amount -= amount
            invoice.balance_due = invoice.total_amount - invoice.paid_amount
            if invoice.paid_amount <= 0:
                invoice.status = 'SENT'
            elif invoice.balance_due > 0:
                invoice.status = 'PARTIAL_PAID'
            invoice.save(
                update_fields=['paid_amount', 'balance_due', 'status'],
                force_audit_bypass=True
            )
        else:
            invoice.record_payment(amount)
    except Exception as e:
        logger.warning(f"[FinanceConnector] Invoice payment linkage failed for invoice {invoice_id}: {e}")
