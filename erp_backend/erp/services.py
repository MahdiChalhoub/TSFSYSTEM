from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import json

class ProvisioningService:
    @staticmethod
    def provision_organization(name, slug):
        from .models import Organization, Site, ChartOfAccount, FiscalYear, FiscalPeriod, Warehouse
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
            # Format: (Code, Name, Type, SubType, ParentCode)
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
            
            account_map = {} # Code -> Object
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
            from .services import FinancialAccountService
            FinancialAccountService.create_account(
                organization=org,
                name="Cash Drawer",
                type="CASH",
                currency="USD",
                site_id=site.id
            )
            
            # 7. Auto-map Posting Rules
            from .services import ConfigurationService
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

            return org

class ConfigurationService:
    @staticmethod
    def get_posting_rules(organization):
        from .models import SystemSettings
        """
        Loads the finance_posting_rules from SystemSettings.
        """
        setting = SystemSettings.objects.filter(
            organization=organization,
            key='finance_posting_rules'
        ).first()

        default_config = {
            "sales": {"receivable": None, "revenue": None, "cogs": None, "inventory": None},
            "purchases": {"payable": None, "inventory": None, "tax": None},
            "inventory": {"adjustment": None, "transfer": None},
            "suspense": {"reception": None}
        }

        if not setting:
            return default_config
        
        try:
            stored = json.loads(setting.value)
            # Merge with defaults
            for key in default_config:
                if key in stored:
                    default_config[key].update(stored[key])
            return default_config
        except:
            return default_config

    @staticmethod
    def save_posting_rules(organization, config):
        from .models import SystemSettings
        import json
        SystemSettings.objects.update_or_create(
            organization=organization,
            key='finance_posting_rules',
            defaults={'value': json.dumps(config)}
        )
        return True

    @staticmethod
    def apply_smart_posting_rules(organization):
        from .models import ChartOfAccount
        """
        Auto-maps accounts based on standard codes.
        """
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True)
        config = ConfigurationService.get_posting_rules(organization)

        def find(code):
            acc = accounts.filter(code=code).first()
            return acc.id if acc else None

        # Sales
        config['sales']['receivable'] = find('1110') or find('1300') or config['sales']['receivable']
        config['sales']['revenue'] = find('4100') or find('701') or config['sales']['revenue']
        config['sales']['cogs'] = find('5100') or find('601') or config['sales']['cogs']
        config['sales']['inventory'] = find('1120') or find('31') or config['sales']['inventory']

        # Purchases
        config['purchases']['payable'] = find('2101') or find('401') or config['purchases']['payable']
        config['purchases']['inventory'] = find('1120') or find('607') or config['purchases']['inventory']
        config['purchases']['tax'] = find('2111') or find('4456') or config['purchases']['tax']

        # Inventory
        config['inventory']['adjustment'] = find('5104') or find('709') or config['inventory']['adjustment']
        config['inventory']['transfer'] = find('1120') or config['inventory']['transfer']

        # Suspense
        config['suspense']['reception'] = find('2102') or find('9004') or config['suspense']['reception']

        ConfigurationService.save_posting_rules(organization, config)
        return config

    @staticmethod
    def get_global_settings(organization):
        from .models import SystemSettings
        import json
        setting = SystemSettings.objects.filter(organization=organization, key='global_financial_settings').first()
        if not setting:
            return {
                "companyType": "REGULAR",
                "currency": "USD",
                "defaultTaxRate": 0.11,
                "salesTaxPercentage": 11.0,
                "purchaseTaxPercentage": 11.0,
                "worksInTTC": True,
                "allowHTEntryForTTC": True,
                "declareTVA": True,
                "dualView": False,
                "pricingCostBasis": "AMC"
            }
        try:
            return json.loads(setting.value)
        except:
            return {}

    @staticmethod
    def save_global_settings(organization, config):
        from .models import SystemSettings
        import json
        SystemSettings.objects.update_or_create(
            organization=organization,
            key='global_financial_settings',
            defaults={'value': json.dumps(config)}
        )
        return True

class InventoryService:
    @staticmethod
    def calculate_effective_cost(cost_price_ht, tva_rate, is_tax_recoverable):
        ht = Decimal(str(cost_price_ht))
        rate = Decimal(str(tva_rate))
        if is_tax_recoverable:
            return ht
        return ht * (Decimal('1') + rate)

    @staticmethod
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, 
                      is_tax_recoverable=True, reference=None):
        from .models import Inventory, InventoryMovement
        
        # 0. Generate Unique Reference if not provided
        if not reference:
            reference = f"REC-{uuid.uuid4().hex[:8].upper()}"
        
        inbound_qty = Decimal(str(quantity))
        effective_cost = InventoryService.calculate_effective_cost(
            cost_price_ht, 
            product.tva_rate, 
            is_tax_recoverable
        )
        inbound_value = inbound_qty * effective_cost

        with transaction.atomic():
            agg = Inventory.objects.filter(organization=organization, product=product).aggregate(total=Sum('quantity'))['total']
            current_total_qty = Decimal(str(agg or '0'))
            current_avg_cost = Decimal(str(product.cost_price))
            current_total_value = current_total_qty * current_avg_cost
            
            new_total_qty = current_total_qty + inbound_qty
            
            if new_total_qty > Decimal('0'):
                new_amc = (current_total_value + inbound_value) / new_total_qty
            else:
                new_amc = effective_cost

            # Update Product
            product.cost_price = new_amc
            product.cost_price_ht = Decimal(str(cost_price_ht))
            product.cost_price_ttc = Decimal(str(cost_price_ht)) * (Decimal('1') + Decimal(str(product.tva_rate)))
            product.save()

            # Updated Inventory logic
            inventory, created = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=warehouse,
                product=product
            )
            inventory.quantity = Decimal(str(inventory.quantity)) + inbound_qty
            inventory.save()

            # Record movement
            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='IN',
                quantity=inbound_qty,
                cost_price=effective_cost,
                reference=reference
            )

            # Post to ledger
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')

            if inv_acc and susp_acc:
                from .services import LedgerService
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Stock Reception: {product.name} ({quantity} @ {effective_cost})",
                    reference=reference,
                    status='POSTED',
                    site_id=warehouse.site_id,
                    lines=[
                        {"account_id": inv_acc, "debit": inbound_value, "credit": Decimal('0')},
                        {"account_id": susp_acc, "debit": Decimal('0'), "credit": inbound_value}
                    ]
                )
            return inventory

    @staticmethod
    def adjust_stock(organization, product, warehouse, quantity, reason, reference=None):
        from .models import Inventory, InventoryMovement
        adj_qty = Decimal(str(quantity))
        cost_price = Decimal(str(product.cost_price))
        with transaction.atomic():
            inventory, _ = Inventory.objects.get_or_create(organization=organization, warehouse=warehouse, product=product)
            inventory.quantity = Decimal(str(inventory.quantity)) + adj_qty
            inventory.save()
            InventoryMovement.objects.create(
                organization=organization, product=product, warehouse=warehouse,
                type='ADJUST', quantity=adj_qty, cost_price=cost_price,
                reference=reference or f"ADJ-{timezone.now().timestamp()}", reason=reason
            )
            return inventory

    @staticmethod
    def get_inventory_valuation(organization):
        from .models import Inventory
        result = Inventory.objects.filter(organization=organization).aggregate(
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )
        total_value = Decimal(str(result['total_value'] or '0'))
        return {"total_value": total_value, "item_count": Inventory.objects.filter(organization=organization).count(), "timestamp": timezone.now()}

class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None):
        from .models import FiscalPeriod, JournalEntry, JournalEntryLine
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'):
            raise ValidationError(f"Out of Balance: {total_debit} vs {total_credit}")
        with transaction.atomic():
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
            if not fp: raise ValidationError("No Fiscal Period")
            entry = JournalEntry.objects.create(
                organization=organization, transaction_date=transaction_date, description=description,
                reference=reference or f"JRN-{uuid.uuid4().hex[:8].upper()}",
                fiscal_year=fp.fiscal_year, fiscal_period=fp, status=status, scope=scope, site_id=site_id
            )
            for l in lines:
                JournalEntryLine.objects.create(
                    organization=organization, journal_entry=entry, account_id=l['account_id'],
                    debit=Decimal(str(l['debit'])), credit=Decimal(str(l['credit'])),
                    description=l.get('description', description)
                )
            if status == 'POSTED': LedgerService.post_journal_entry(entry)
            return entry

    @staticmethod
    def post_journal_entry(entry):
        if entry.status == 'POSTED' and entry.posted_at: return
        with transaction.atomic():
            for line in entry.lines.all():
                net = line.debit - line.credit
                line.account.balance = Decimal(str(line.account.balance)) + net
                line.account.save()
            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            entry.save()

class FinancialAccountService:
    @staticmethod
    def create_account(organization, name, type, currency, site_id=None):
        from .models import ChartOfAccount, FinancialAccount
        parent = ChartOfAccount.objects.filter(organization=organization, sub_type=type).first()
        if not parent: raise ValidationError(f"No parent for {type}")
        with transaction.atomic():
            last = ChartOfAccount.objects.filter(organization=organization, code__startswith=f"{parent.code}.").order_by('-code').first()
            suffix = (int(last.code.split('.')[-1]) + 1) if last else 1
            code = f"{parent.code}.{str(suffix).zfill(3)}"
            acc = ChartOfAccount.objects.create(
                organization=organization, code=code, name=name, type='ASSET', parent=parent,
                is_system_only=True, is_active=True, balance=Decimal('0.00')
            )
            return FinancialAccount.objects.create(
                organization=organization, name=name, type=type, currency=currency,
                site_id=site_id, ledger_account=acc
            )
