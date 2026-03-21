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
    2. Full IFRS Chart of Accounts via centralized template system
    3. Cash Drawer financial account
    4. Auto-mapped posting rules
    5. Global financial settings
    
    This handler replaces the direct model imports that were previously
    in ProvisioningService, achieving full module isolation.
    """
    from .models import ChartOfAccount, FiscalYear, FiscalPeriod
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
            
            # ── Step 2: Chart of Accounts (via centralized template system) ──
            # Uses LedgerService.apply_coa_template to prevent dual-standard
            # pollution. Auto-seeds templates from JSON if not yet in database.
            from .services import LedgerService
            from .models import COATemplate
            
            # Auto-seed templates if DB is empty (first org provisioned before seed_coa_templates ran)
            if not COATemplate.objects.exists():
                import json, glob, os
                seeds_dir = os.path.join(os.path.dirname(__file__), 'seeds')
                for fp in sorted(glob.glob(os.path.join(seeds_dir, '*.json'))):
                    with open(fp, 'r', encoding='utf-8') as f:
                        d = json.load(f)
                    def _cnt(items):
                        return sum(1 + _cnt(i.get('children', [])) for i in items)
                    COATemplate.objects.update_or_create(
                        key=d['key'],
                        defaults={'name': d['name'], 'description': d.get('description', ''),
                                  'accounts': d['accounts'], 'account_count': _cnt(d['accounts']),
                                  'root_count': len(d['accounts'])}
                    )
                logger.info("Finance: Auto-seeded COA templates from JSON files")
            
            LedgerService.apply_coa_template(org, 'IFRS_COA', reset=False)
            
            # ── Step 3: Default Financial Account (Cash Drawer) ───
            if site_id:
                from .services import FinancialAccountService
                try:
                    FinancialAccountService.create_account(
                        organization=org,
                        name="Cash Drawer",
                        type="CASH",
                        currency="USD",
                        site_id=site_id
                    )
                except Exception as e:
                    logger.warning(f"Finance: Could not create Cash Drawer: {e}")
            
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
        
        coa_count = ChartOfAccount.objects.filter(organization=org, is_active=True).count()
        
        logger.info(
            f"✅ Finance: Full financial infrastructure provisioned for org '{org.name}' "
            f"(CoA={coa_count} accounts, FY={fiscal_year.name})"
        )
        
        return {
            'success': True,
            'fiscal_year': fiscal_year.name,
            'accounts_created': coa_count,
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
    logger.info(f"💰 Finance: Processing order completion for org {organization_id}")
    # Future: Auto-create journal entries from completed orders
    # order_id = payload.get('order_id')
    # JournalEntryService.create_from_order(order_id, organization_id)


def _on_inventory_adjusted(payload: dict, organization_id: int):
    """React to inventory adjustments — update asset valuations."""
    logger.info(f"📦 Finance: Inventory adjustment received for org {organization_id}")
    # Future: Update inventory asset account values


def _on_subscription_renewed(payload: dict, organization_id: int):
    """React to subscription renewals — record revenue."""
    logger.info(f"🔄 Finance: Subscription renewal for org {organization_id}")
    # Future: Create revenue recognition journal entries
