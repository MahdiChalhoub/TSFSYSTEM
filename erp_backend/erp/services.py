"""
Kernel Services
Contains ONLY kernel-level infrastructure services.
Business services have been migrated to their respective modules.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import json
import math


class ProvisioningService:
    @staticmethod
    def provision_organization(name, slug):
        from .models import Organization, Site, Warehouse
        from apps.finance.models import ChartOfAccount, FiscalYear, FiscalPeriod
        """
        Creates a new organization and a FULL operational skeleton.
        """
        with transaction.atomic():
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
            
            # 4. Fiscal Infrastructure (Current Year)
            now = timezone.now()
            fiscal_year = FiscalYear.objects.create(
                organization=org,
                name=f"FY-{now.year}",
                start_date=f"{now.year}-01-01",
                end_date=f"{now.year}-12-31"
            )

            # Create Monthly Periods
            for month in range(1, 13):
                import calendar
                last_day = calendar.monthrange(now.year, month)[1]
                FiscalPeriod.objects.create(
                    organization=org,
                    fiscal_year=fiscal_year,
                    name=f"P{str(month).zfill(2)}-{now.year}",
                    start_date=f"{now.year}-{str(month).zfill(2)}-01",
                    end_date=f"{now.year}-{str(month).zfill(2)}-{last_day}"
                )
            
            # 5. Full Standardized Chart of Accounts
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

            # 6. Default Financial Accounts
            from apps.finance.services import FinancialAccountService
            FinancialAccountService.create_account(
                organization=org,
                name="Cash Drawer",
                type="CASH",
                currency="USD",
                site_id=site.id
            )
            
            # 7. Auto-map Posting Rules
            ConfigurationService.apply_smart_posting_rules(org)
            
            # 8. Global settings
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

            # 9. SaaS Financial Integration (Client Linking)
            if slug != 'saas':
                try:
                    saas_org = Organization.objects.filter(slug='saas').first()
                    if saas_org:
                        from apps.crm.models import Contact
                        client_contact = Contact.objects.create(
                            organization=saas_org,
                            type='CUSTOMER',
                            customer_type='B2B',
                            name=f"{name} (Tenant)",
                            email=f"billing@{slug}.tsf-city.com",
                            is_airsi_subject=False,
                            balance=Decimal('0.00'),
                            credit_limit=Decimal('0.00')
                        )
                        
                        org.billing_contact_id = client_contact.id
                        org.save()
                except Exception as e:
                    print(f"Warning: Failed to link SaaS billing contact: {e}")

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
        from apps.finance.models import ChartOfAccount
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True)
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
# BACKWARD-COMPATIBLE RE-EXPORTS
# Business services now live in their module directories.
# These re-exports ensure existing code continues to work.
# =============================================================================
from apps.finance.services import (  # noqa: E402, F401
    LedgerService, FinancialAccountService, SequenceService,
    BarcodeService, LoanService, FinancialEventService, TaxService
)
from apps.inventory.services import InventoryService  # noqa: E402, F401
from apps.pos.services import POSService, PurchaseService  # noqa: E402, F401
