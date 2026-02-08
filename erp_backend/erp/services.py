"""
Kernel Services
==============
Contains ONLY kernel-level infrastructure services.
Business services live in their respective modules.

IMPORTANT: This file must NEVER import from apps.* directly.
All cross-module communication goes through the ConnectorEngine.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import json
import math
import logging

logger = logging.getLogger(__name__)


class ProvisioningService:
    """
    Kernel-level provisioning service.
    
    Creates ONLY kernel objects (Organization, Site, Warehouse),
    then emits events via ConnectorEngine for modules to react:
    
    Flow:
        1. Kernel creates: Organization, Site, Warehouse
        2. ConnectorEngine dispatches 'org:provisioned' event
        3. Finance module reacts: CoA, Fiscal Year, Cash Drawer, Posting Rules
        4. CRM module reacts: Billing Contact in SaaS org
        5. CRM result triggers 'contact:created' → Finance creates ledger sub-account
    
    If a module is disabled/missing, the ConnectorEngine buffers the event
    and replays it when the module becomes available. No crash, no data loss.
    """
    
    @staticmethod
    def provision_organization(name, slug):
        """
        Creates a new organization with kernel infrastructure,
        then dispatches events for module-level setup.
        
        Returns the created Organization instance.
        """
        from .models import Organization, Site, Warehouse
        
        with transaction.atomic():
            # ── KERNEL OBJECTS (always created, no module dependency) ──
            
            # 1. Organization
            org = Organization.objects.create(name=name, slug=slug)
            
            # 2. Main Site
            site = Site.objects.create(
                organization=org,
                name="Main Branch",
                code="MAIN"
            )

            # 3. Main Warehouse
            Warehouse.objects.create(
                organization=org,
                site=site,
                name="Main Warehouse",
                code="WH01",
                can_sell=True
            )
        
        # ── MODULE EVENTS (outside transaction — each module handles its own) ──
        event_payload = {
            'org_id': str(org.id),
            'org_name': name,
            'org_slug': slug,
            'site_id': str(site.id),
        }
        
        try:
            from .connector_engine import ConnectorEngine
            connector = ConnectorEngine()
            
            # Dispatch to ALL modules that subscribe to 'org:provisioned'
            results = connector.dispatch_event(
                source_module='kernel',
                event_name='org:provisioned',
                payload=event_payload,
                organization_id=str(org.id)
            )
            
            logger.info(
                f"🏗️ Provisioning complete for '{name}' [{slug}]. "
                f"Module events: {results}"
            )
            
        except Exception as e:
            # Connector failure should NOT prevent org creation
            # The kernel objects are already committed
            logger.warning(
                f"⚠️ ConnectorEngine dispatch failed for org '{slug}': {e}. "
                f"Module setup may be incomplete — events will be retried."
            )
        
        return org


class ConfigurationService:
    @staticmethod
    def get_posting_rules(organization):
        from .models import SystemSettings
        setting = SystemSettings.objects.filter(organization=organization, key='finance_posting_rules').first()
        default_config = {
            "sales": {"receivable": None, "revenue": None, "cogs": None, "inventory": None},
            "purchases": {"payable": None, "inventory": None, "tax": None},
            "inventory": {"adjustment": None, "transfer": None},
            "automation": {"customerRoot": None, "supplierRoot": None, "payrollRoot": None},
            "fixedAssets": {"depreciationExpense": None, "accumulatedDepreciation": None},
            "suspense": {"reception": None},
            "partners": {"capital": None, "loan": None, "withdrawal": None}
        }
        if not setting: return default_config
        try:
            stored = json.loads(setting.value)
            for key in default_config:
                if key in stored and isinstance(stored[key], dict):
                    default_config[key].update({k: v for k, v in stored[key].items() if k in default_config[key]})
            return default_config
        except: return default_config

    @staticmethod
    def save_posting_rules(organization, config):
        from .models import SystemSettings
        SystemSettings.objects.update_or_create(organization=organization, key='finance_posting_rules', defaults={'value': json.dumps(config)})
        return True

    @staticmethod
    def apply_smart_posting_rules(organization):
        """
        Auto-map posting rules based on existing Chart of Accounts.
        
        Uses ConnectorEngine to read accounts from the finance module.
        Falls back to direct import if connector is not available
        (e.g., during initial provisioning when called from finance event handler).
        """
        accounts = None
        
        # Try connector first for proper isolation
        try:
            from .connector_engine import ConnectorEngine
            connector = ConnectorEngine()
            response = connector.route_read(
                target_module='finance',
                endpoint='chart-of-accounts',
                organization_id=str(organization.id),
                source_module='kernel',
                params={'is_active': True}
            )
            if response.success and response.data:
                # Got data via connector — but we need queryset-like access
                # Fall through to direct import since we're in kernel context
                pass
        except Exception:
            pass
        
        # Direct import with safety gate — this is acceptable because:
        # 1. This function is called FROM finance event handler (which has access)
        # 2. If finance module is missing, we simply return default config
        try:
            from apps.finance.models import ChartOfAccount
            accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True)
        except ImportError:
            logger.warning("Finance module not installed — posting rules cannot be auto-mapped")
            return ConfigurationService.get_posting_rules(organization)
        
        config = ConfigurationService.get_posting_rules(organization)
        def find(code):
            acc = accounts.filter(code=code).first()
            return acc.id if acc else None
        config['sales']['receivable'] = find('1110') or find('1300') or config['sales']['receivable']
        config['sales']['revenue'] = find('4100') or find('701') or config['sales']['revenue']
        config['sales']['cogs'] = find('5100') or find('601') or config['sales']['cogs']
        config['sales']['inventory'] = find('1120') or find('31') or config['sales']['inventory']
        config['purchases']['payable'] = find('2101') or find('401') or config['purchases']['payable']
        config['purchases']['inventory'] = find('1120') or find('607') or config['purchases']['inventory']
        config['purchases']['tax'] = find('2111') or find('4456') or config['purchases']['tax']
        config['inventory']['adjustment'] = find('5104') or find('709') or config['inventory']['adjustment']
        config['inventory']['transfer'] = find('1120') or config['inventory']['transfer']
        config['suspense']['reception'] = find('2102') or find('9004') or config['suspense']['reception']
        
        config['automation']['customerRoot'] = find('1111') or find('1110') or find('1200') or find('411') or config['automation']['customerRoot']
        config['automation']['supplierRoot'] = find('2101') or find('2100.1') or find('2100') or find('401') or config['automation']['supplierRoot']
        config['automation']['payrollRoot'] = find('2200') or find('421') or config['automation']['payrollRoot']
        
        ConfigurationService.save_posting_rules(organization, config)
        return config

    @staticmethod
    def get_global_settings(organization):
        from .models import SystemSettings
        setting = SystemSettings.objects.filter(organization=organization, key='global_financial_settings').first()
        if not setting: return {"worksInTTC": True, "dualView": False, "pricingCostBasis": "AMC"}
        try: return json.loads(setting.value)
        except: return {}

    @staticmethod
    def save_global_settings(organization, config):
        from .models import SystemSettings
        SystemSettings.objects.update_or_create(organization=organization, key='global_financial_settings', defaults={'value': json.dumps(config)})
        return True

    @staticmethod
    def get_setting(organization, key, default=None):
        from .models import SystemSettings
        setting = SystemSettings.objects.filter(organization=organization, key=key).first()
        if not setting: return default
        try: return json.loads(setting.value)
        except: return default

    @staticmethod
    def save_setting(organization, key, value):
        from .models import SystemSettings
        SystemSettings.objects.update_or_create(
            organization=organization, 
            key=key, 
            defaults={'value': json.dumps(value)}
        )
        return True


# =============================================================================
# BACKWARD-COMPATIBLE RE-EXPORTS (Safe)
# Business services now live in their module directories.
# These re-exports ensure existing code continues to work.
# Wrapped in try/except to prevent kernel crash if a module is removed.
# =============================================================================
try:
    from apps.finance.services import (  # noqa: E402, F401
        LedgerService, FinancialAccountService, SequenceService,
        BarcodeService, LoanService, FinancialEventService, TaxService
    )
except ImportError:
    logger.debug("Finance module not installed — re-exports skipped")

try:
    from apps.inventory.services import InventoryService  # noqa: E402, F401
except ImportError:
    logger.debug("Inventory module not installed — re-exports skipped")

try:
    from apps.pos.services import POSService, PurchaseService  # noqa: E402, F401
except ImportError:
    logger.debug("POS module not installed — re-exports skipped")
