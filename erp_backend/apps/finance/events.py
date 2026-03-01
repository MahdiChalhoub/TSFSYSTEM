"""
Finance Module Event Handlers
==============================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.finance.events')
    
And calls handle_event() for each subscribed event.

To subscribe to events, register them in your ModuleContract's
`needs.events_from` JSON field.
"""

import logging
import calendar
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the finance module.
    
    Called by ConnectorEngine._deliver_event when an event is
    routed to this module.
    
    Args:
        event_name: The event identifier (e.g., 'org:provisioned')
        payload: Event data dictionary
        organization_id: The tenant context
    """
    handlers = {
        'org:provisioned': _on_org_provisioned,
        'contact:created': _on_contact_created,
        'order:completed': _on_order_completed,
        'inventory:adjusted': _on_inventory_adjusted,
        'subscription:renewed': _on_subscription_renewed,
        'subscription:updated': _on_subscription_updated,
        'purchase_order:received': _on_purchase_order_received,
    }
    
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    else:
        logger.debug(f"Finance module: unhandled event '{event_name}'")
        return None


# =============================================================================
# PROVISIONING EVENTS
# =============================================================================

def _on_org_provisioned(payload: dict, organization_id: int) -> dict:
    """
    React to a new organization being provisioned.
    
    Creates the FULL financial infrastructure for the new tenant:
    1. Fiscal Year + 12 monthly periods
    2. Full standardized Chart of Accounts (16 accounts)
    3. Cash Drawer financial account
    4. Auto-mapped posting rules
    5. Global financial settings
    
    This handler replaces the direct model imports that were previously
    in ProvisioningService, achieving full module isolation.
    """
    from .models import ChartOfAccount, FiscalYear, FiscalPeriod, FinancialAccount
    from erp.models import Organization, Site
    
    org_id = payload.get('org_id')
    site_id = payload.get('site_id')
    
    if not org_id:
        logger.error("Finance: org:provisioned event missing org_id")
        return {'success': False, 'error': 'Missing org_id in payload'}
    
    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.error(f"Finance: Organization {org_id} not found")
        return {'success': False, 'error': f'Organization {org_id} not found'}
    
    try:
        with transaction.atomic():
            # ── Step 1: Fiscal Infrastructure ──────────────────────
            now = timezone.now()
            fiscal_year = FiscalYear.objects.create(
                organization=org,
                name=f"FY-{now.year}",
                start_date=f"{now.year}-01-01",
                end_date=f"{now.year}-12-31"
            )
            
            for month in range(1, 13):
                last_day = calendar.monthrange(now.year, month)[1]
                FiscalPeriod.objects.create(
                    organization=org,
                    fiscal_year=fiscal_year,
                    name=f"P{str(month).zfill(2)}-{now.year}",
                    start_date=f"{now.year}-{str(month).zfill(2)}-01",
                    end_date=f"{now.year}-{str(month).zfill(2)}-{last_day}"
                )
            
            # ── Step 2: Chart of Accounts ─────────────────────────
            coa_template = [
                # Assets
                ('1000', 'ASSETS', 'ASSET', None, None),
                ('1110', 'Accounts Receivable', 'ASSET', 'RECEIVABLE', '1000'),
                ('1120', 'Inventory', 'ASSET', 'INVENTORY', '1000'),
                ('1300', 'Cash & Equivalents', 'ASSET', 'CASH', '1000'),
                ('1310', 'Petty Cash', 'ASSET', 'CASH', '1300'),
                ('1320', 'Main Bank Account', 'ASSET', 'BANK', '1300'),
                # Liabilities
                ('2000', 'LIABILITIES', 'LIABILITY', None, None),
                ('2101', 'Accounts Payable', 'LIABILITY', 'PAYABLE', '2000'),
                ('2102', 'Accrued Reception', 'LIABILITY', 'SUSPENSE', '2000'),
                ('2111', 'VAT Payable', 'LIABILITY', 'TAX', '2000'),
                # Equity
                ('3000', 'EQUITY', 'EQUITY', None, None),
                # Revenue
                ('4000', 'REVENUE', 'INCOME', None, None),
                ('4100', 'Sales Revenue', 'INCOME', 'REVENUE', '4000'),
                # Expenses
                ('5000', 'EXPENSES', 'EXPENSE', None, None),
                ('5100', 'Cost of Goods Sold (COGS)', 'EXPENSE', 'COGS', '5000'),
                ('5104', 'Inventory Adjustments', 'EXPENSE', 'ADJUSTMENT', '5000'),
                ('5200', 'Operating Expenses', 'EXPENSE', None, '5000'),
            ]
            
            account_map = {}
            for code, acc_name, acc_type, sub_type, parent_code in coa_template:
                parent = account_map.get(parent_code)
                acc = ChartOfAccount.objects.create(
                    organization=org,
                    code=code,
                    name=acc_name,
                    type=acc_type,
                    sub_type=sub_type,
                    parent=parent,
                    is_active=True
                )
                account_map[code] = acc
            
            # ── Step 3: Default Financial Account (Cash Drawer) ───
            if site_id:
                cash_parent = account_map.get('1300')
                if cash_parent:
                    code = f"{cash_parent.code}.001"
                    cash_ledger = ChartOfAccount.objects.create(
                        organization=org,
                        code=code,
                        name="Cash Drawer",
                        type='ASSET',
                        parent=cash_parent,
                        is_system_only=True,
                        is_active=True,
                        balance=Decimal('0.00')
                    )
                    FinancialAccount.objects.create(
                        organization=org,
                        name="Cash Drawer",
                        type="CASH",
                        currency="USD",
                        site_id=site_id,
                        ledger_account=cash_ledger
                    )
            
            # ── Step 4: Auto-map Posting Rules ────────────────────
            # Use kernel's ConfigurationService (no cross-module import needed)
            from erp.services import ConfigurationService
            ConfigurationService.apply_smart_posting_rules(org)
            
            # ── Step 5: Global Financial Settings ─────────────────
            ConfigurationService.save_global_settings(org, {
                "companyType": "REGULAR",
                "currency": "USD",
                "defaultTaxRate": 0.11,
                "salesTaxPercentage": 11.0,
                "purchaseTaxPercentage": 11.0,
                "worksInTTC": True,
                "allowHTEntryForTTC": True,
                "declareTVA": True,
                "dualView": True,
                "pricingCostBasis": "AMC"
            })
        
        logger.info(
            f"✅ Finance: Full financial infrastructure provisioned for org '{org.name}' "
            f"(CoA={len(account_map)} accounts, FY={fiscal_year.name})"
        )
        
        return {
            'success': True,
            'fiscal_year': fiscal_year.name,
            'accounts_created': len(account_map),
        }
        
    except Exception as e:
        logger.error(f"Finance: Failed to provision financial infrastructure for org {org_id}: {e}")
        return {'success': False, 'error': str(e)}


def _on_contact_created(payload: dict, organization_id: int) -> dict:
    """
    React to a new CRM contact being created.
    
    When CRM creates a billing contact for a new tenant, Finance
    may need to create a corresponding ledger sub-account.
    
    This is the CHAINED EVENT flow:
        CRM handles 'org:provisioned' → creates Contact → 
        connector emits 'contact:created' → Finance creates ledger sub-account
    """
    contact_id = payload.get('contact_id')
    contact_name = payload.get('contact_name')
    saas_org_id = payload.get('saas_org_id')
    
    if not contact_id or not saas_org_id:
        logger.debug("Finance: contact:created event missing contact_id or saas_org_id")
        return {'success': True, 'skipped': True}
    
    # Future: Create a linked ledger sub-account for this tenant contact
    # This is where automatic AR/AP sub-accounts would be created
    logger.info(
        f"📒 Finance: Contact '{contact_name}' (id={contact_id}) created. "
        f"Ledger sub-account creation deferred to configuration."
    )
    
    return {'success': True, 'contact_id': contact_id}


# =============================================================================
# BUSINESS EVENTS
# =============================================================================

def _on_order_completed(payload: dict, organization_id: int):
    """React to POS order completion — create journal entries."""
    from .services import LedgerService
    from erp.services import ConfigurationService
    from erp.models import Organization
    
    logger.info(f"💰 Finance: Processing order completion for org {organization_id}")
    
    order_id = payload.get('order_id')
    order_type = payload.get('type')
    total_amount = Decimal(str(payload.get('total_amount', '0')))
    tax_amount = Decimal(str(payload.get('tax_amount', '0')))
    reference = payload.get('reference', f"ORD-{order_id}")
    date = payload.get('date')
    contact_id = payload.get('contact_id')
    lines = payload.get('lines', [])

    if total_amount == 0 and not lines:
        return {'success': True, 'skipped': True}

    try:
        org = Organization.objects.get(id=organization_id)
        rules = ConfigurationService.get_posting_rules(org)
        
        entry_lines = []
        
        if order_type == 'SALE':
            # ── 1. Sales Revenue & AR/Cash ──
            # Debit: Cash/AR
            # Credit: Revenue
            # Credit: VAT
            
            # Find accounts
            ar_acc_id = rules.get('sales', {}).get('receivable')
            rev_acc_id = rules.get('sales', {}).get('revenue')
            tax_acc_id = rules.get('purchases', {}).get('tax') # Usually same for sales tax payable
            
            if not ar_acc_id or not rev_acc_id:
                logger.warning(f"Finance: Missing sales posting rules in org {organization_id}")
                return {'success': False, 'error': "Missing sales posting rules"}

            # Revenue Part (Taxes excluded)
            net_revenue = total_amount - tax_amount
            
            # Debit (Money In)
            entry_lines.append({
                'account_id': ar_acc_id,
                'debit': total_amount,
                'credit': 0,
                'description': f"Sale {reference}",
                'contact_id': contact_id
            })
            
            # Credit (Revenue)
            entry_lines.append({
                'account_id': rev_acc_id,
                'debit': 0,
                'credit': net_revenue,
                'description': f"Revenue from {reference}"
            })
            
            # Credit (Tax)
            if tax_amount > 0 and tax_acc_id:
                entry_lines.append({
                    'account_id': tax_acc_id,
                    'debit': 0,
                    'credit': tax_amount,
                    'description': f"VAT on {reference}"
                })

            # ── 2. COGS & Inventory (Asset) ──
            # Debit: COGS
            # Credit: Inventory
            
            cogs_acc_id = rules.get('sales', {}).get('cogs')
            inv_acc_id = rules.get('sales', {}).get('inventory')
            
            if cogs_acc_id and inv_acc_id:
                total_cost = sum(Decimal(str(l.get('cost_price', 0))) * Decimal(str(l.get('quantity', 0))) for l in lines)
                if total_cost > 0:
                    entry_lines.append({
                        'account_id': cogs_acc_id,
                        'debit': total_cost,
                        'credit': 0,
                        'description': f"COGS for {reference}"
                    })
                    entry_lines.append({
                        'account_id': inv_acc_id,
                        'debit': 0,
                        'credit': total_cost,
                        'description': f"Inventory Reduction for {reference}"
                    })

        elif order_type == 'PURCHASE':
            # ── Purchase recorded via POS ──
            # Debit: Inventory
            # Credit: Cash/Payable
            
            inv_acc_id = rules.get('purchases', {}).get('inventory')
            ap_acc_id = rules.get('purchases', {}).get('payable')
            
            if inv_acc_id and ap_acc_id:
                entry_lines.append({
                    'account_id': inv_acc_id,
                    'debit': total_amount,
                    'credit': 0,
                    'description': f"Purchase {reference}"
                })
                entry_lines.append({
                    'account_id': ap_acc_id,
                    'debit': 0,
                    'credit': total_amount,
                    'description': f"Payment for {reference}",
                    'contact_id': contact_id
                })

        if entry_lines:
            entry = LedgerService.create_journal_entry(
                organization=org,
                transaction_date=date or timezone.now(),
                description=f"POS Order: {reference}",
                reference=reference,
                status='POSTED',
                lines=entry_lines
            )
            
            # ── 3. Update Running Balances ──
            if contact_id:
                if order_type == 'SALE':
                    from .payment_models import CustomerBalance
                    balance, _ = CustomerBalance.objects.get_or_create(
                        organization=org,
                        contact_id=contact_id
                    )
                    balance.current_balance += total_amount
                    if date: balance.last_invoice_date = date
                    balance.save()
                elif order_type == 'PURCHASE':
                    from .payment_models import SupplierBalance
                    balance, _ = SupplierBalance.objects.get_or_create(
                        organization=org,
                        contact_id=contact_id
                    )
                    balance.current_balance += total_amount
                    if date: balance.last_invoice_date = date
                    balance.save()

            return {'success': True, 'entry_id': str(entry.id)}
        
        return {'success': True, 'skipped': True}

    except Exception as e:
        logger.error(f"Finance: Failed to process order completion: {e}")
        return {'success': False, 'error': str(e)}


def _on_purchase_order_received(payload: dict, organization_id: int):
    """React to PO receipt — create journal entry (Stock In / Accrual)."""
    from .services import LedgerService
    from erp.services import ConfigurationService
    from erp.models import Organization
    
    logger.info(f"🚚 Finance: Processing PO receipt for org {organization_id}")
    
    po_number = payload.get('po_number')
    lines = payload.get('lines', [])
    
    if not lines:
        return {'success': True, 'skipped': True}

    try:
        org = Organization.objects.get(id=organization_id)
        rules = ConfigurationService.get_posting_rules(org)
        
        # Debit: Inventory
        # Credit: Accrued Reception (Suspense)
        
        inv_acc_id = rules.get('purchases', {}).get('inventory')
        suspense_acc_id = rules.get('suspense', {}).get('reception')
        
        if not inv_acc_id or not suspense_acc_id:
            logger.warning(f"Finance: Missing accrual posting rules in org {organization_id}")
            return {'success': False, 'error': "Missing accrual posting rules"}

        total_received_value = sum(Decimal(str(l.get('qty_received', 0))) * Decimal(str(l.get('unit_price', 0))) for l in lines)
        
        if total_received_value <= 0:
            return {'success': True, 'skipped': True}

        entry_lines = [
            {
                'account_id': inv_acc_id,
                'debit': total_received_value,
                'credit': 0,
                'description': f"Stock Receipt PO {po_number}"
            },
            {
                'account_id': suspense_acc_id,
                'debit': 0,
                'credit': total_received_value,
                'description': f"Accrual for PO {po_number}"
            }
        ]

        entry = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=timezone.now(),
            description=f"PO Receipt: {po_number}",
            reference=f"RECPT-{po_number}",
            status='POSTED',
            lines=entry_lines
        )
        
        # Update Supplier Balance
        supplier_id = payload.get('supplier_id')
        if supplier_id:
            from .payment_models import SupplierBalance
            balance, _ = SupplierBalance.objects.get_or_create(
                organization=org,
                contact_id=supplier_id
            )
            balance.current_balance += total_received_value
            balance.last_invoice_date = timezone.now().date()
            balance.save()

        return {'success': True, 'entry_id': str(entry.id)}

    except Exception as e:
        logger.error(f"Finance: Failed to process PO receipt: {e}")
        return {'success': False, 'error': str(e)}


def _on_inventory_adjusted(payload: dict, organization_id: int):
    """React to inventory adjustments — update asset valuations in ledger."""
    from .services import LedgerService
    from .models import ChartOfAccount
    from erp.services import ConfigurationService
    from erp.models import Organization
    
    logger.info(f"📦 Finance: Processing inventory adjustment for org {organization_id}")
    
    order_id = payload.get('order_id')
    total_amount = Decimal(str(payload.get('total_amount', '0')))
    reference = payload.get('reference')
    date = payload.get('date') or timezone.now().date()
    
    if total_amount == 0:
        return {'success': True, 'skipped': True}

    try:
        org = Organization.objects.get(id=organization_id)
        rules = ConfigurationService.get_posting_rules(org)
        
        # 1120 (Inventory) and 5104 (Inventory Adjustments)
        inv_acc_id = rules.get('sales', {}).get('inventory') or rules.get('purchases', {}).get('inventory')
        adj_acc_id = rules.get('inventory', {}).get('adjustment')
        
        if not inv_acc_id or not adj_acc_id:
            logger.error(f"Finance: Missing inventory or adjustment accounts in org {organization_id}")
            return {'success': False, 'error': "Missing posting rules for inventory adjustment"}

        # If positive adjustment (found stock): Inventory Dr, Adjustment Expense Cr
        # If negative adjustment (loss): Adjustment Expense Dr, Inventory Cr
        if total_amount > 0:
            lines = [
                {'account_id': inv_acc_id, 'debit': total_amount, 'credit': 0, 'description': f"Stock Adjustment {reference}"},
                {'account_id': adj_acc_id, 'debit': 0, 'credit': total_amount, 'description': f"Stock Adjustment {reference}"}
            ]
        else:
            abs_amount = abs(total_amount)
            lines = [
                {'account_id': adj_acc_id, 'debit': abs_amount, 'credit': 0, 'description': f"Stock Adjustment {reference}"},
                {'account_id': inv_acc_id, 'debit': 0, 'credit': abs_amount, 'description': f"Stock Adjustment {reference}"}
            ]

        entry = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=date,
            description=f"Inventory Adjustment: {reference}",
            reference=reference,
            status='POSTED',
            lines=lines
        )
        
        return {'success': True, 'entry_id': str(entry.id)}
        
    except Exception as e:
        logger.error(f"Finance: Failed to process inventory adjustment: {e}")
        return {'success': False, 'error': str(e)}


def _on_subscription_renewed(payload: dict, organization_id: int):
    """React to subscription renewals — record revenue."""
    logger.info(f"🔄 Finance: Subscription renewal for org {organization_id}")
    # Future: Create revenue recognition journal entries


def _on_subscription_updated(payload: dict, organization_id: int):
    """
    React to subscription updates (purchases/credits) — record ledger entry.
    Triggered by SaaS layer when a tenant changes their plan.
    """
    from .services import LedgerService
    from .models import ChartOfAccount
    from erp.models import Organization
    
    amount = Decimal(str(payload.get('amount', '0')))
    txn_type = payload.get('type') # PURCHASE or CREDIT_NOTE
    description = payload.get('description')
    target_org_id = payload.get('target_org_id')
    
    if amount <= 0:
        return {'success': True, 'skipped': True}

    try:
        # 1. Identify context (should be SaaS org)
        org = Organization.objects.get(id=organization_id)
        
        # 2. Find target organization (tenant) and its client
        target_org = Organization.objects.filter(id=target_org_id).select_related('client').first()
        client = target_org.client if target_org else None
        
        contact_id = None
        if client:
            from apps.crm.models import Contact
            billing_contact = Contact.objects.filter(organization=org, email=client.email).first()
            if billing_contact:
                contact_id = billing_contact.id
        
        if not contact_id:
            logger.warning(f"Finance: No billing contact found for tenant {target_org_id}. Ledger entry may be unlinked.")

        # 3. Resolve accounts
        # Standard: 1110 (AR) and 4100 (Sales Revenue)
        ar_acc = ChartOfAccount.objects.filter(organization=org, code='1110').first()
        rev_acc = ChartOfAccount.objects.filter(organization=org, code='4100').first()
        
        if not ar_acc or not rev_acc:
            logger.error(f"Finance: Missing accounts 1110 (AR) or 4100 (Revenue) in SaaS org {organization_id}.")
            return {'success': False, 'error': "Missing core accounts"}

        # 4. Create Journal Entry lines
        # If PURCHASE (Billing): AR Debit, Revenue Credit
        # If CREDIT_NOTE (Refund): Revenue Debit, AR Credit
        if txn_type == 'PURCHASE':
            lines = [
                {'account_id': ar_acc.id, 'debit': amount, 'credit': 0, 'description': description, 'contact_id': contact_id},
                {'account_id': rev_acc.id, 'debit': 0, 'credit': amount, 'description': description}
            ]
        else: # CREDIT_NOTE
            lines = [
                {'account_id': rev_acc.id, 'debit': amount, 'credit': 0, 'description': description},
                {'account_id': ar_acc.id, 'debit': 0, 'credit': amount, 'description': description, 'contact_id': contact_id}
            ]

        # 5. Create Entry
        entry = LedgerService.create_journal_entry(
            organization=org,
            transaction_date=timezone.now(),
            description=description,
            status='POSTED', # Auto-post billing entries
            lines=lines
        )
        
        logger.info(f"✅ Finance: Created journal entry {entry.reference} for subscription {txn_type}")
        return {'success': True, 'entry_id': str(entry.id)}
        
    except Exception as e:
        logger.error(f"Finance: Failed to process subscription update: {e}")
        return {'success': False, 'error': str(e)}
