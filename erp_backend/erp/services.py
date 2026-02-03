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
                    # Update but only for keys that exist in default_config to maintain schema
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
        from .models import ChartOfAccount
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
        
        # Automation Mappings
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

class InventoryService:
    @staticmethod
    def calculate_effective_cost(cost_price_ht, tva_rate, is_tax_recoverable):
        ht = Decimal(str(cost_price_ht))
        rate = Decimal(str(tva_rate))
        if is_tax_recoverable: return ht
        return ht * (Decimal('1') + rate)

    @staticmethod
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, is_tax_recoverable=True, reference=None):
        from .models import Inventory, InventoryMovement
        if not reference: reference = f"REC-{uuid.uuid4().hex[:8].upper()}"
        inbound_qty = Decimal(str(quantity))
        effective_cost = InventoryService.calculate_effective_cost(cost_price_ht, product.tva_rate, is_tax_recoverable)
        inbound_value = inbound_qty * effective_cost
        with transaction.atomic():
            agg = Inventory.objects.filter(organization=organization, product=product).aggregate(total=Sum('quantity'))['total']
            current_total_qty = Decimal(str(agg or '0'))
            current_avg_cost = Decimal(str(product.cost_price))
            current_total_value = current_total_qty * current_avg_cost
            new_total_qty = current_total_qty + inbound_qty
            if new_total_qty > Decimal('0'): new_amc = (current_total_value + inbound_value) / new_total_qty
            else: new_amc = effective_cost
            product.cost_price = new_amc
            product.cost_price_ht = Decimal(str(cost_price_ht))
            product.cost_price_ttc = Decimal(str(cost_price_ht)) * (Decimal('1') + Decimal(str(product.tva_rate)))
            product.save()
            inventory, _ = Inventory.objects.get_or_create(organization=organization, warehouse=warehouse, product=product)
            inventory.quantity = Decimal(str(inventory.quantity)) + inbound_qty
            inventory.save()
            InventoryMovement.objects.create(organization=organization, product=product, warehouse=warehouse, type='IN', quantity=inbound_qty, cost_price=effective_cost, reference=reference)
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')
            if inv_acc and susp_acc:
                LedgerService.create_journal_entry(organization=organization, transaction_date=timezone.now(), description=f"Stock Reception: {product.name}", reference=reference, status='POSTED', site_id=warehouse.site_id, lines=[
                    {"account_id": inv_acc, "debit": inbound_value, "credit": Decimal('0')},
                    {"account_id": susp_acc, "debit": Decimal('0'), "credit": inbound_value}
                ])
            return inventory

    @staticmethod
    def get_inventory_valuation(organization):
        from .models import Inventory
        result = Inventory.objects.filter(organization=organization).aggregate(total_value=Sum(F('quantity') * F('product__cost_price')))
        return {"total_value": Decimal(str(result['total_value'] or '0')), "item_count": Inventory.objects.filter(organization=organization).count(), "timestamp": timezone.now()}

    @staticmethod
    def reduce_stock(organization, product, warehouse, quantity, reference=None):
        from .models import Inventory, InventoryMovement
        """
        Reduces stock and captures AMC for COGS booking.
        """
        qty_to_reduce = Decimal(str(quantity))
        current_amc = Decimal(str(product.cost_price))
        
        with transaction.atomic():
            inventory = Inventory.objects.filter(
                organization=organization,
                warehouse=warehouse,
                product=product
            ).first()
            
            if not inventory or inventory.quantity < qty_to_reduce:
                raise ValidationError(f"Insufficient stock for {product.name} in {warehouse.name}")
            
            inventory.quantity = Decimal(str(inventory.quantity)) - qty_to_reduce
            inventory.save()
            
            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='OUT',
                quantity=qty_to_reduce,
                cost_price=current_amc,
                reference=reference or f"SALE-{uuid.uuid4().hex[:6].upper()}"
            )
            
            return current_amc

class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, status='DRAFT', scope='OFFICIAL', site_id=None):
        from .models import FiscalPeriod, JournalEntry, JournalEntryLine
        total_debit = sum((Decimal(str(l['debit'])) for l in lines), Decimal('0'))
        total_credit = sum((Decimal(str(l['credit'])) for l in lines), Decimal('0'))
        if abs(total_debit - total_credit) > Decimal('0.001'): raise ValidationError("Out of Balance")
        with transaction.atomic():
            fp = FiscalPeriod.objects.filter(organization=organization, start_date__lte=transaction_date, end_date__gte=transaction_date).first()
            if not fp: raise ValidationError("No Fiscal Period")
            entry = JournalEntry.objects.create(organization=organization, transaction_date=transaction_date, description=description, reference=reference or f"JRN-{uuid.uuid4().hex[:8].upper()}", fiscal_year=fp.fiscal_year, fiscal_period=fp, status=status, scope=scope, site_id=site_id)
            for l in lines: JournalEntryLine.objects.create(organization=organization, journal_entry=entry, account_id=l['account_id'], debit=Decimal(str(l['debit'])), credit=Decimal(str(l['credit'])), description=l.get('description', description))
            if status == 'POSTED': LedgerService.post_journal_entry(entry)
            return entry

    @staticmethod
    def create_linked_account(organization, name, type, sub_type, parent_id):
        from .models import ChartOfAccount
        parent = ChartOfAccount.objects.get(id=parent_id)
        count = ChartOfAccount.objects.filter(parent=parent).count()
        code = f"{parent.code}-{(count + 1):04d}"
        return ChartOfAccount.objects.create(
            organization=organization,
            code=code,
            name=name,
            type=type,
            sub_type=sub_type,
            parent=parent
        )

    @staticmethod
    def post_journal_entry(entry):
        if entry.status == 'POSTED' and entry.posted_at: return
        with transaction.atomic():
            for line in entry.lines.all():
                net = line.debit - line.credit
                account = line.account
                account.balance = Decimal(str(account.balance)) + net
                if entry.scope == 'OFFICIAL': account.balance_official = Decimal(str(account.balance_official)) + net
                account.save()
            entry.status = 'POSTED'; entry.posted_at = timezone.now(); entry.save()

    @staticmethod
    def apply_coa_template(organization, template_key, reset=False):
        from .models import ChartOfAccount, JournalEntry
        from .coa_templates import TEMPLATES
        from .services import ConfigurationService

        template = TEMPLATES.get(template_key)
        if not template:
            raise ValidationError(f"Template {template_key} not found")

        with transaction.atomic():
            if reset:
                from .models import FinancialAccount
                if JournalEntry.objects.filter(organization=organization).exists():
                    raise ValidationError("Cannot reset Chart of Accounts: Transactions (Journal Entries) already exist. Use the Migration Tool instead.")
                if FinancialAccount.objects.filter(organization=organization).exists():
                    raise ValidationError("Cannot reset Chart of Accounts: Financial Accounts (Cash/Bank) are linked to existing accounts. Remove them or use the Migration Tool.")
                
                ChartOfAccount.objects.filter(organization=organization).delete()
            
            def create_recursive(items, parent=None):
                for item in items:
                    # Try finding existing by code
                    defaults = {
                        "name": item['name'],
                        "type": item['type'],
                        "sub_type": item.get('subType'),
                        "syscohada_code": item.get('syscohadaCode'),
                        "syscohada_class": item.get('syscohadaClass'),
                        "is_active": True,
                        "parent": parent,
                        "is_system_only": item.get('isSystemOnly', False),
                        "is_hidden": item.get('isHidden', False),
                        "requires_zero_balance": item.get('requiresZeroBalance', False)
                    }
                    
                    acc, created = ChartOfAccount.objects.update_or_create(
                        organization=organization,
                        code=item['code'],
                        defaults=defaults
                    )
                    
                    if 'children' in item and item['children']:
                        create_recursive(item['children'], acc)

            create_recursive(template)
            
            # Auto-wire posting rules
            ConfigurationService.apply_smart_posting_rules(organization)
            return True

    @staticmethod
    def migrate_coa(organization, mappings, description):
        from .models import ChartOfAccount, JournalEntry, JournalEntryLine, FiscalYear, FiscalPeriod
        from decimal import Decimal
        import uuid
        from django.utils import timezone

        with transaction.atomic():
            source_ids = [m['sourceId'] for m in mappings]
            target_ids = [m['targetId'] for m in mappings]
            
            source_accounts = ChartOfAccount.objects.filter(id__in=source_ids, organization=organization)
            target_accounts = ChartOfAccount.objects.filter(id__in=target_ids, organization=organization)
            
            src_map = {acc.id: acc for acc in source_accounts}
            tgt_map = {acc.id: acc for acc in target_accounts}
            
            # Prepare posting lines for official and internal reclassifications
            official_lines = []
            internal_only_lines = []
            
            for m in mappings:
                src_acc = src_map.get(m['sourceId'])
                tgt_acc = tgt_map.get(m['targetId'])
                
                if not src_acc or not tgt_acc: continue
                
                bal_official = src_acc.balance_official
                bal_total = src_acc.balance
                bal_internal_diff = bal_total - bal_official
                
                # A. Handle Official Balance (Moves both Total and Official)
                if abs(bal_official) > Decimal('0.0001'):
                    if bal_official > 0:
                        official_lines.append({"account_id": src_acc.id, "debit": 0, "credit": bal_official, "description": f"Migration: {description} (Out)"})
                        official_lines.append({"account_id": tgt_acc.id, "debit": bal_official, "credit": 0, "description": f"Migration: {description} (In)"})
                    else:
                        abs_val = abs(bal_official)
                        official_lines.append({"account_id": src_acc.id, "debit": abs_val, "credit": 0, "description": f"Migration: {description} (Out)"})
                        official_lines.append({"account_id": tgt_acc.id, "debit": 0, "credit": abs_val, "description": f"Migration: {description} (In)"})

                # B. Handle Internal Difference (Moves only Total)
                if abs(bal_internal_diff) > Decimal('0.0001'):
                    if bal_internal_diff > 0:
                        internal_only_lines.append({"account_id": src_acc.id, "debit": 0, "credit": bal_internal_diff, "description": f"Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": bal_internal_diff, "credit": 0, "description": f"Internal Migration (In)"})
                    else:
                        abs_val = abs(bal_internal_diff)
                        internal_only_lines.append({"account_id": src_acc.id, "debit": abs_val, "credit": 0, "description": f"Internal Migration (Out)"})
                        internal_only_lines.append({"account_id": tgt_acc.id, "debit": 0, "credit": abs_val, "description": f"Internal Migration (In)"})
                
                # Deactivate source after mapping
                src_acc.is_active = False
                src_acc.save()

            now = timezone.now()
            
            # Post Official Reclassification
            if official_lines:
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=now,
                    description=description,
                    reference=f"MIG-OFF-{uuid.uuid4().hex[:6].upper()}",
                    status='POSTED',
                    scope='OFFICIAL',
                    lines=official_lines
                )

            # Post Internal Reclassification
            if internal_only_lines:
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=now,
                    description=f"{description} (Internal Only Adjustment)",
                    reference=f"MIG-INT-{uuid.uuid4().hex[:6].upper()}",
                    status='POSTED',
                    scope='INTERNAL',
                    lines=internal_only_lines
                )
            
            # Sync posting rules to new accounts
            from .services import ConfigurationService
            ConfigurationService.apply_smart_posting_rules(organization)
            
            return True

    @staticmethod
    def get_chart_of_accounts(organization, scope='OFFICIAL', include_inactive=False):
        from .models import ChartOfAccount, JournalEntryLine
        qs = ChartOfAccount.objects.filter(organization=organization).order_by('code')
        if not include_inactive:
            qs = qs.filter(is_active=True)
        
        # Calculate Balances (similar to trial balance)
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if scope == 'OFFICIAL': lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
        
        balance_map = {b['account_id']: Decimal(str(b['net'] or '0')) for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))}
        
        accounts = list(qs)
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.rollup_balance = acc.temp_balance # Initialize to prevent AttributeError if skipped
            acc.temp_children = []
            
        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map: 
                account_map[acc.parent_id].temp_children.append(acc)
            else: 
                roots.append(acc)
                
        def rollup(node):
            node.rollup_balance = node.temp_balance + sum(rollup(child) for child in node.temp_children)
            return node.rollup_balance
            
        for root in roots: rollup(root)
        
        return accounts

    @staticmethod
    def get_trial_balance(organization, as_of_date=None, scope='INTERNAL'):
        from .models import ChartOfAccount, JournalEntryLine
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True).order_by('code')
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if as_of_date: lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=as_of_date)
        if scope == 'OFFICIAL': lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
        balance_map = {b['account_id']: Decimal(str(b['net'] or '0')) for b in lines_qs.values('account_id').annotate(net=Sum('debit') - Sum('credit'))}
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts: 
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.temp_children = []
        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map: account_map[acc.parent_id].temp_children.append(acc)
            else: roots.append(acc)
        def rollup(node):
            node.rollup_balance = node.temp_balance + sum(rollup(child) for child in node.temp_children)
            return node.rollup_balance
        for root in roots: rollup(root)
        return accounts

    @staticmethod
    def get_profit_loss(organization, start_date=None, end_date=None, scope='INTERNAL'):
        accounts = LedgerService.get_trial_balance(organization, as_of_date=end_date, scope=scope)
        income_accs = [a for a in accounts if a.type == 'INCOME']
        expense_accs = [a for a in accounts if a.type == 'EXPENSE']
        total_income = abs(sum((a.rollup_balance for a in income_accs if a.parent is None), Decimal('0')))
        total_expenses = sum((a.rollup_balance for a in expense_accs if a.parent is None), Decimal('0'))
        return {"scope": scope, "revenue": total_income, "expenses": total_expenses, "net_income": total_income - total_expenses}

    @staticmethod
    def get_balance_sheet(organization, as_of_date=None, scope='INTERNAL'):
        accounts = LedgerService.get_trial_balance(organization, as_of_date=as_of_date, scope=scope)
        assets = [a for a in accounts if a.type == 'ASSET']
        liabilities = [a for a in accounts if a.type == 'LIABILITY']
        equity = [a for a in accounts if a.type == 'EQUITY']
        total_assets = sum((a.rollup_balance for a in assets if a.parent is None), Decimal('0'))
        total_liabilities = abs(sum((a.rollup_balance for a in liabilities if a.parent is None), Decimal('0')))
        total_equity = abs(sum((a.rollup_balance for a in equity if a.parent is None), Decimal('0')))
        cur_earnings = LedgerService.get_profit_loss(organization, end_date=as_of_date, scope=scope)['net_income']
        return {"scope": scope, "assets": total_assets, "liabilities": total_liabilities, "equity": total_equity, "current_earnings": cur_earnings, "total_liabilities_and_equity": total_liabilities + total_equity + cur_earnings, "is_balanced": abs(total_assets - (total_liabilities + total_equity + cur_earnings)) < Decimal('0.01')}

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
            acc = ChartOfAccount.objects.create(organization=organization, code=code, name=name, type='ASSET', parent=parent, is_system_only=True, is_active=True, balance=Decimal('0.00'))
            return FinancialAccount.objects.create(
                organization=organization, name=name, type=type, currency=currency,
                site_id=site_id, ledger_account=acc
            )

class PurchaseService:
    @staticmethod
    def authorize_po(organization, order_id):
        from .models import Order
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            if order.status != 'DRAFT':
                raise ValidationError(f"Cannot authorize order in status {order.status}")
            order.status = 'AUTHORIZED'
            order.save()
            return order

    @staticmethod
    def receive_po(organization, order_id, warehouse_id, is_tax_recoverable=True):
        from .models import Order, Warehouse
        """
        Processes physical reception of all items in the PO.
        Updates stock and creates Accrued Reception ledger entries.
        """
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            warehouse = Warehouse.objects.get(id=warehouse_id, organization=organization)
            
            if order.status not in ['AUTHORIZED', 'PARTIAL_RECEIVED']:
                raise ValidationError(f"Order status {order.status} is not eligible for reception.")

            for line in order.lines.all():
                InventoryService.receive_stock(
                    organization=organization,
                    product=line.product,
                    warehouse=warehouse,
                    quantity=line.quantity,
                    cost_price_ht=line.unit_price, # We assume unit_price in PO is the HT cost
                    is_tax_recoverable=is_tax_recoverable,
                    reference=f"PO-REC-{order.id}"
                )
            
            order.status = 'RECEIVED'
            order.save()
            return order

    @staticmethod
    def quick_purchase(organization, supplier_id, warehouse_id, site_id, scope, invoice_price_type, vat_recoverable, lines, notes=None, ref_code=None, user=None):
        from .models import Order, OrderLine, Product, Contact, ChartOfAccount, StockBatch, Inventory
        from decimal import Decimal

        with transaction.atomic():
            settings = ConfigurationService.get_global_settings(organization)
            pricing_cost_basis = settings.get('pricingCostBasis', 'AUTO')
            company_type = settings.get('companyType', 'REGULAR')
            
            # --- Mixed/Regular/Micro VAT Logic ---
            # Internal Ledger is strictly TTC (Cash Basis). 
            # VAT Recoverability is virtualized in reports, not posted to Ledger.
            if company_type in ['MIXED', 'REGULAR', 'MICRO']:
                vat_recoverable = False
            
            # --- AIRSI Logic ---
            supplier = Contact.objects.get(id=supplier_id, organization=organization)
            global_airsi_rate = Decimal(str(settings.get('airsi_tax_percentage', 0))) / 100
            
            apply_airsi = False
            airsi_rate = Decimal('0')
            
            if global_airsi_rate > 0:
                # Hierarchy: Contact Override -> Global Enabled -> B2B Default?
                # User Guide says: "If enabled, system *can* apply it... Purchases (Suppliers): If is_airsi_subject=True"
                if supplier.is_airsi_subject:
                    apply_airsi = True
                    airsi_rate = supplier.airsi_tax_rate if supplier.airsi_tax_rate is not None else global_airsi_rate

            # 1. Create Order
            order = Order.objects.create(
                organization=organization,
                type='PURCHASE',
                status='COMPLETED',
                scope=scope,
                invoice_price_type=invoice_price_type,
                vat_recoverable=vat_recoverable,
                contact_id=supplier_id,
                user=user,
                site_id=site_id,
                ref_code=ref_code,
                notes=notes,
                payment_method='CREDIT',
                total_amount=Decimal('0'),
                tax_amount=Decimal('0'),
                airsi_amount=Decimal('0')
            )

            total_amount_ht = Decimal('0')
            total_tax = Decimal('0')
            total_airsi = Decimal('0')
            
            for line in lines:
                product = Product.objects.get(id=line['productId'], organization=organization)
                qty = Decimal(str(line['quantity']))
                unit_cost_ht = Decimal(str(line['unitCostHT']))
                unit_cost_ttc = Decimal(str(line['unitCostTTC']))
                tax_rate = Decimal(str(line['taxRate']))
                
                # Default calcs if zero
                if unit_cost_ht > 0 and unit_cost_ttc == 0:
                    unit_cost_ttc = (unit_cost_ht * (Decimal('1') + tax_rate)).quantize(Decimal('0.01'))
                elif unit_cost_ttc > 0 and unit_cost_ht == 0:
                    unit_cost_ht = (unit_cost_ttc / (Decimal('1') + tax_rate)).quantize(Decimal('0.01'))

                line_total_ht = qty * unit_cost_ht
                line_tax = line_total_ht * tax_rate
                line_total_ttc = line_total_ht + line_tax
                
                # Calculate AIRSI for line
                line_airsi = Decimal('0')
                if apply_airsi:
                    # Usually applies to HT base (Service/Goods)
                    line_airsi = (line_total_ht * airsi_rate).quantize(Decimal('0.01'))
                
                total_amount_ht += line_total_ht
                total_tax += line_tax
                total_airsi += line_airsi
                
                # Effective Cost Engine
                base_effective_cost = Decimal('0')
                if pricing_cost_basis == 'FORCE_HT':
                    base_effective_cost = unit_cost_ht
                elif pricing_cost_basis == 'FORCE_TTC':
                    base_effective_cost = unit_cost_ttc
                else: # AUTO
                    base_effective_cost = unit_cost_ht if vat_recoverable else unit_cost_ttc
                
                # Handling AIRSI in Cost
                # Rules:
                # REGULAR -> Capitalize (Typically)
                # MICRO -> Expense
                # REAL -> Recoverable
                # MIXED -> Internal=Capitalize, Declared=Recoverable
                
                airsi_capitalized = True # Default for Mixed/Regular/Micro Internal View
                if company_type == 'REAL': airsi_capitalized = False
                
                final_effective_cost = base_effective_cost
                if apply_airsi and airsi_capitalized and qty > 0:
                    final_effective_cost += (line_airsi / qty).quantize(Decimal('0.01'))

                # A. Order Line
                OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=final_effective_cost,
                    unit_cost_ht=unit_cost_ht,
                    unit_cost_ttc=unit_cost_ttc,
                    vat_amount=line_tax / qty if qty > 0 else 0,
                    airsi_amount=line_airsi / qty if qty > 0 else 0,
                    effective_cost=final_effective_cost,
                    tax_rate=tax_rate,
                    total=line_total_ttc # Note: Total usually doesn't include AIRSI if it's external, but if Supplier Adds it, it does? 
                                         # Let's assume Order Total = Payable to Supplier. If Supplier charged AIRSI, then yes.
                )
                
                # B. Stock Batch & Inventory
                batch = StockBatch.objects.create(
                    organization=organization,
                    product=product,
                    batch_code=f"PUR-{order.id}-{product.id}",
                    cost_price=final_effective_cost,
                    expiry_date=line.get('expiryDate')
                )
                
                inv, _ = Inventory.objects.get_or_create(
                    organization=organization,
                    warehouse_id=warehouse_id,
                    product=product,
                    batch=batch,
                    defaults={'quantity': Decimal('0')}
                )
                inv.quantity += qty
                inv.save()
                
                # C. Update Product Master
                product.cost_price = final_effective_cost # AMC update logic could be more complex, but we follow frontend for now
                product.cost_price_ht = unit_cost_ht
                product.cost_price_ttc = unit_cost_ttc
                if line.get('sellingPriceHT'): product.selling_price_ht = Decimal(str(line['sellingPriceHT']))
                if line.get('sellingPriceTTC'): product.selling_price_ttc = Decimal(str(line['sellingPriceTTC']))
                product.save()

            # Final Order Totals
            # If AIRSI is charged by supplier (Additive), it increases Payable.
            # If it's Withholding, it doesn't change Total Amount (Invoice Amount), but splits payment.
            # Assumption: Supplier CHARGES valid tax.
            order.total_amount = total_amount_ht + total_tax + total_airsi
            order.tax_amount = total_tax
            order.airsi_amount = total_airsi
            order.save()
            
            # 6. Financial Posting
            rules = ConfigurationService.get_posting_rules(organization)
            
            ap_account_id = supplier.linked_account_id or rules['purchases']['payable']
            stock_account_id = rules['purchases']['inventory']
            tax_account_id = rules['purchases']['tax']
            airsi_account_id = rules['purchases'].get('airsi') # Need to ensure this rule exists or fallback
            
            if not ap_account_id or not stock_account_id:
                raise ValidationError("Finance mapping missing: Accounts Payable or Inventory account not configured.")
                
            # Debit Inventory = Sum of Lines Effective Costs * Qty
            # But simpler calculation:
            inventory_debit_amount = total_amount_ht
            if not vat_recoverable: inventory_debit_amount += total_tax
            
            # AIRSI Logic for Ledger
            airsi_ledger_treatment = 'CAPITALIZE' # Default
            if company_type == 'REAL': airsi_ledger_treatment = 'RECOVER'
            elif company_type == 'MICRO': airsi_ledger_treatment = 'EXPENSE'
            
            if apply_airsi:
                if airsi_ledger_treatment == 'CAPITALIZE':
                    inventory_debit_amount += total_airsi
                # Else: handled separately
            
            posting_lines = [
                # Credit AP (Gross Amount including everything charged)
                {"account_id": ap_account_id, "debit": Decimal('0'), "credit": order.total_amount, "description": f"Payable to {supplier.name}"},
                # Debit Inventory
                {"account_id": stock_account_id, "debit": inventory_debit_amount, "credit": Decimal('0'), "description": "Inventory Value"}
            ]
            
            # Debit VAT (Only if recoverable)
            if vat_recoverable and total_tax > 0:
                posting_lines.append({
                    "account_id": tax_account_id,
                    "debit": total_tax,
                    "credit": Decimal('0'),
                    "description": "VAT Recoverable"
                })
                
            # Debit AIRSI (If not capitalized)
            if apply_airsi and airsi_ledger_treatment != 'CAPITALIZE':
                 # If Recoverable -> Asset. If Expense -> Expense.
                 target_acc = airsi_account_id or tax_account_id # Fallback
                 posting_lines.append({
                    "account_id": target_acc,
                    "debit": total_airsi,
                    "credit": Decimal('0'),
                    "description": f"AIRSI ({airsi_ledger_treatment})"
                })
                
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Purchase: {supplier.name} | Basis: {pricing_cost_basis} | Recoverable: {vat_recoverable}",
                reference=f"ORD-{order.id}",
                status='POSTED',
                scope=scope,
                site_id=site_id,
                lines=posting_lines
            )
            
            return order

    @staticmethod
    def invoice_po(organization, order_id, invoice_number, invoice_date=None):
        from .models import Order
        """
        Converts the 'Accrued Reception' liability into a formal 'Accounts Payable'.
        """
        with transaction.atomic():
            order = Order.objects.get(id=order_id, organization=organization, type='PURCHASE')
            if order.status != 'RECEIVED':
                raise ValidationError("Order must be RECEIVED before it can be INVOICED.")

            rules = ConfigurationService.get_posting_rules(organization)
            susp_acc = rules.get('suspense', {}).get('reception')
            ap_acc = rules.get('purchases', {}).get('payable')

            if not susp_acc or not ap_acc:
                raise ValidationError("Finance mapping missing: Accrued Reception or Accounts Payable not configured.")

            # Total amount to move from Suspense to AP
            total_invoice = order.total_amount

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=invoice_date or timezone.now(),
                description=f"Purchase Invoice: {invoice_number} (PO #{order.id})",
                reference=invoice_number,
                status='POSTED',
                scope='OFFICIAL', # Invoices are usually official
                site_id=order.site_id,
                lines=[
                    {
                        "account_id": susp_acc,
                        "debit": total_invoice,
                        "credit": Decimal('0'),
                        "description": "Clearing Accrued Reception"
                    },
                    {
                        "account_id": ap_acc,
                        "debit": Decimal('0'),
                        "credit": total_invoice,
                        "description": "Establishing Accounts Payable"
                    }
                ]
            )

            order.status = 'INVOICED'
            order.notes = f"{order.notes or ''}\nInvoice ref: {invoice_number}".strip()
            order.save()
            return order

class POSService:
    @staticmethod
    def checkout(organization, user, warehouse, payment_account_id, items):
        from .models import Order, OrderLine, Product
        """
        items: list of {'product_id': id, 'quantity': q, 'unit_price': p}
        """
        with transaction.atomic():
            total_amount = Decimal('0')
            total_tax = Decimal('0')
            total_cogs = Decimal('0')
            
            order = Order.objects.create(
                organization=organization,
                user=user,
                site=warehouse.site,
                type='SALE',
                status='COMPLETED'
            )
            
            for item in items:
                product = Product.objects.get(id=item['product_id'], organization=organization)
                qty = Decimal(str(item['quantity']))
                price = Decimal(str(item['unit_price']))
                
                # 1. Reduce Stock and get COGS base (AMC)
                amc = InventoryService.reduce_stock(
                    organization=organization,
                    product=product,
                    warehouse=warehouse,
                    quantity=qty,
                    reference=f"POS-{order.id}"
                )
                
                # 2. Financial Calcs
                tax_rate = Decimal(str(product.tva_rate))
                item_total = qty * price
                item_tax = item_total * tax_rate
                item_cogs = qty * amc
                
                total_amount += (item_total + item_tax)
                total_tax += item_tax
                total_cogs += item_cogs
                
                # 3. Create Order Line
                OrderLine.objects.create(
                    organization=organization,
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=price,
                    tax_rate=tax_rate,
                    total=(item_total + item_tax),
                    unit_cost_ht=amc, # Capture current AMC
                    effective_cost=amc
                )
            
            order.total_amount = total_amount
            order.tax_amount = total_tax
            order.save()
            
            # 4. Accounting (Atomic Entry)
            rules = ConfigurationService.get_posting_rules(organization)
            rev_acc = rules.get('sales', {}).get('revenue')
            inv_acc = rules.get('sales', {}).get('inventory')
            cogs_acc = rules.get('sales', {}).get('cogs')
            tax_acc = rules.get('purchases', {}).get('tax') # VAT Payable (often same as tax rule for simplicity here)

            if not all([rev_acc, inv_acc, cogs_acc]):
                raise ValidationError("Missing sales posting rules mapping.")
            
            # Resolve Payment Ledger ID
            from .models import FinancialAccount
            fin_acc = FinancialAccount.objects.filter(id=payment_account_id, organization=organization).first()
            actual_payment_acc_id = fin_acc.ledger_account_id if fin_acc else payment_account_id

            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"POS Sale #{order.id}",
                reference=f"POS-{order.id}",
                status='POSTED',
                scope='INTERNAL', # POS sales update Internal but often we sync to Official too. 
                                   # For now, let's keep consistency.
                site_id=warehouse.site_id,
                lines=[
                    {"account_id": actual_payment_acc_id, "debit": total_amount, "credit": Decimal('0')}, # Dr Cash
                    {"account_id": rev_acc, "debit": Decimal('0'), "credit": (total_amount - total_tax)}, # Cr Revenue
                    {"account_id": tax_acc or rev_acc, "debit": Decimal('0'), "credit": total_tax}, # Cr VAT
                    {"account_id": cogs_acc, "debit": total_cogs, "credit": Decimal('0')}, # Dr COGS
                    {"account_id": inv_acc, "debit": Decimal('0'), "credit": total_cogs}, # Cr Inventory
                ]
            )
            
            return order

class SequenceService:
    @staticmethod
    def get_next_number(organization, type):
        from .models import TransactionSequence
        from django.db.models import F
        with transaction.atomic():
            seq, created = TransactionSequence.objects.get_or_create(
                organization=organization, 
                type=type,
                defaults={'prefix': type[:3].upper() + '-', 'padding': 5}
            )
            # Use lock to prevent race conditions
            seq = TransactionSequence.objects.select_for_update().get(id=seq.id)
            
            number_string = str(seq.next_number).zfill(seq.padding)
            formatted = f"{seq.prefix or ''}{number_string}{seq.suffix or ''}"
            
            seq.next_number += 1
            seq.save()
            
            return formatted

class BarcodeService:
    @staticmethod
    def calculate_ean13_check_digit(digits):
        # Validation: digits should be string of 12 numbers
        sum_odd = 0
        sum_even = 0
        for i, char in enumerate(digits):
            num = int(char)
            # Even index i (0, 2...) is ODD position (1st, 3rd...) -> weight 1
            # Odd index i (1, 3...) is EVEN position (2nd, 4th...) -> weight 3
            if i % 2 == 0:
                sum_odd += num * 1
            else:
                sum_even += num * 3
        
        total = sum_odd + sum_even
        remainder = total % 10
        return (10 - remainder) % 10

    @staticmethod
    def generate_barcode(organization):
        from .models import BarcodeSettings, Product
        with transaction.atomic():
            settings, created = BarcodeSettings.objects.get_or_create(
                organization=organization,
                defaults={'prefix': '200', 'next_sequence': 1000}
            )
            if not settings.is_enabled:
                raise ValidationError("Barcode generation is disabled")
            
            current_seq = settings.next_sequence
            prefix = settings.prefix
            # Padding: Total length 13. Check digit 1. Payload 12. 
            # Seq length = 12 - len(prefix).
            seq_str = str(current_seq).zfill(12 - len(prefix))
            raw_code = f"{prefix}{seq_str}"
            
            check_digit = BarcodeService.calculate_ean13_check_digit(raw_code)
            final_barcode = f"{raw_code}{check_digit}"
            
            settings.next_sequence += 1
            settings.save()
            
            # Recursion check (unlikely with atomic seq, but safe)
            if Product.objects.filter(organization=organization, barcode=final_barcode).exists():
                return BarcodeService.generate_barcode(organization)
                
            return final_barcode

class LoanService:
    @staticmethod
    def calculate_schedule(principal, interest_rate, interest_type, term_months, start_date, frequency):
        """
        Pure logic calculation, returns list of dicts.
        interest_rate is Annual %.
        """
        import datetime
        from dateutil.relativedelta import relativedelta
        
        principal = Decimal(str(principal))
        rate = Decimal(str(interest_rate))
        
        # 1. Determine num installments
        if frequency == 'MONTHLY': num_installments = term_months
        elif frequency == 'QUARTERLY': num_installments = math.ceil(term_months / 3)
        elif frequency == 'YEARLY': num_installments = math.ceil(term_months / 12)
        else: num_installments = term_months # Default
        
        if num_installments <= 0: return []
        
        # 2. Calculate Base Amounts
        total_interest = Decimal('0')
        if interest_type == 'SIMPLE':
            # Simple Interest: Principal * (Rate/100) * (Years)
            years = Decimal(term_months) / Decimal('12')
            total_interest = principal * (rate / Decimal('100')) * years
        
        base_principal = principal / Decimal(num_installments)
        base_interest = total_interest / Decimal(num_installments)
        
        installments = []
        remaining_principal = principal
        remaining_interest = total_interest
        
        current_date_obj = start_date if isinstance(start_date, datetime.date) else datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        
        for i in range(1, num_installments + 1):
            # Calculate next date
            if frequency == 'MONTHLY':
                next_date = current_date_obj + relativedelta(months=i)
            elif frequency == 'QUARTERLY':
                next_date = current_date_obj + relativedelta(months=i*3)
            elif frequency == 'YEARLY':
                next_date = current_date_obj + relativedelta(years=i)
            else:
                next_date = current_date_obj + relativedelta(months=i)

            is_last = (i == num_installments)
            
            line_principal = remaining_principal if is_last else base_principal.quantize(Decimal('0.01'))
            line_interest = remaining_interest if is_last else base_interest.quantize(Decimal('0.01'))
            line_total = line_principal + line_interest
            
            installments.append({
                "due_date": next_date,
                "principal": line_principal,
                "interest": line_interest,
                "total": line_total
            })
            
            if not is_last:
                remaining_principal -= line_principal
                remaining_interest -= line_interest
                
        return installments

    @staticmethod
    def create_contract(organization, data):
        from .models import Loan, LoanInstallment, Contact
        """
        Creates a Loan and its Installments in DRAFT status.
        Uses SequenceService for contract number.
        """
        with transaction.atomic():
            contract_number = SequenceService.get_next_number(organization, 'LOAN')
            
            contact = Contact.objects.get(id=data['contact_id'], organization=organization)
            
            loan = Loan.objects.create(
                organization=organization,
                contract_number=contract_number,
                contact=contact,
                principal_amount=data['principal_amount'],
                interest_rate=data['interest_rate'],
                interest_type=data.get('interest_type', 'SIMPLE'),
                term_months=data['term_months'],
                start_date=data['start_date'],
                payment_frequency=data.get('payment_frequency', 'MONTHLY'),
                status='DRAFT'
            )
            
            # Generate Installments
            schedule = LoanService.calculate_schedule(
                loan.principal_amount,
                loan.interest_rate,
                loan.interest_type,
                loan.term_months,
                loan.start_date,
                loan.payment_frequency
            )
            
            for item in schedule:
                LoanInstallment.objects.create(
                    organization=organization,
                    loan=loan,
                    due_date=item['due_date'],
                    principal_amount=item['principal'],
                    interest_amount=item['interest'],
                    total_amount=item['total'],
                    status='PENDING'
                )
            
            return loan

    @staticmethod
    def disburse_loan(organization, loan_id, transaction_ref=None, account_id=None):
        from .models import Loan, FinancialEvent, FinancialAccount
        with transaction.atomic():
            loan = Loan.objects.get(id=loan_id, organization=organization)
            if loan.status != 'DRAFT':
                raise ValidationError("Loan is not in DRAFT status")
            
            # 1. Create Financial Event (Partner Loan if strictly internal, but this looks like lending TO someone)
            # Actually, if we are LENDING, it's an Asset.
            # If we are BORROWING, it's a Liability.
            # The Loan model seems to be "Lending to Contact" (Receiver).
            # Because we have `principal` and `contact`.
            
            # Let's assume Lending for now (common in this ERP context for "Microfinance").
            
            # Create Disbursement Event
            FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_DISBURSEMENT', # Need to add this to choices or map to generic
                amount=loan.principal_amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=transaction_ref or f"DISB-{loan.contract_number}",
                loan_id=loan.id,
                account_id=account_id # Paying FROM this account
            )
            
            loan.status = 'ACTIVE'
            loan.save()
            return loan

    @staticmethod
    def process_repayment(organization, loan_id, amount, account_id, reference=None):
        from .models import Loan, LoanInstallment, FinancialEvent
        with transaction.atomic():
            loan = Loan.objects.get(id=loan_id, organization=organization)
            if loan.status != 'ACTIVE':
                raise ValidationError("Loan must be ACTIVE to receive repayment")
            
            # 1. Distribute amount across installments (Oldest PENDING first)
            msg = f"Repayment {amount}"
            remaining = Decimal(str(amount))
            
            installments = LoanInstallment.objects.filter(organization=organization, loan=loan, status='PENDING').order_by('due_date')
            
            if not installments.exists():
                raise ValidationError("No pending installments found")

            for inst in installments:
                if remaining <= 0: break
                
                # Logic: We don't track partials on installment model strictly in this snippet yet
                # Assuming full or partial matching logic.
                # For simplicity in this sprint: Mark as PAID if remaining >= total.
                # Real implementation would be more complex with 'paid_amount' field.
                
                # Let's assume we just mark what we can complete, or reducing principal.
                # Given the constraints, let's just Log the Financial Event and assume logic elsewhere or simple 'General Repayment'
                pass 
                
            # 2. Create Financial Event
            event = FinancialEventService.create_event(
                organization=organization,
                event_type='LOAN_REPAYMENT',
                amount=amount,
                date=timezone.now(),
                contact_id=loan.contact.id,
                reference=reference or f"REPAY-{loan.contract_number}-{uuid.uuid4().hex[:4]}",
                loan_id=loan.id,
                account_id=account_id # Receiving INTO this account
            )
            
            return event

class FinancialEventService:
    @staticmethod
    def create_event(organization, event_type, amount, date, contact_id, reference=None, notes=None, loan_id=None, account_id=None):
        from .models import FinancialEvent, Contact
        with transaction.atomic():
            contact = Contact.objects.get(id=contact_id, organization=organization)
            
            event = FinancialEvent.objects.create(
                organization=organization,
                event_type=event_type,
                amount=amount,
                date=date,
                contact=contact,
                reference=reference,
                notes=notes,
                loan_id=loan_id,
                status='DRAFT' # Created as draft, need to POST to settle
            )
            
            if account_id:
                # Immediate posting if account provided
                FinancialEventService.post_event(organization, event.id, account_id)
                event.refresh_from_db()
                
            return event

    @staticmethod
    def post_event(organization, event_id, account_id):
        from .models import FinancialEvent, FinancialAccount
        with transaction.atomic():
            event = FinancialEvent.objects.get(id=event_id, organization=organization)
            if event.status == 'SETTLED': return event
            
            fin_acc = FinancialAccount.objects.get(id=account_id, organization=organization)
            actual_payment_acc_id = fin_acc.ledger_account_id
            
            rules = ConfigurationService.get_posting_rules(organization)
            
            debit_acc = None
            credit_acc = None
            
            description = ""
            
            # Logic:
            # PARTNER_CAPITAL_INJECTION: Dr Cash, Cr Equity
            # PARTNER_LOAN (Borrowing): Dr Cash, Cr Liability
            # LOAN_DISBURSEMENT (Lending): Dr Asset (Loan Receivable), Cr Cash
            # LOAN_REPAYMENT (Collection): Dr Cash, Cr Asset (Loan Receivable)
            # PARTNER_WITHDRAWAL: Dr Equity (Draws), Cr Cash
            
            if event.event_type == 'PARTNER_CAPITAL_INJECTION':
                debit_acc = actual_payment_acc_id
                credit_acc = rules.get('equity', {}).get('capital')
                description = f"Capital Injection from {event.contact.name}"
                
            elif event.event_type == 'PARTNER_LOAN': # We borrow
                debit_acc = actual_payment_acc_id
                credit_acc = event.contact.linked_account_id
                description = f"Loan from Partner {event.contact.name}"

            elif event.event_type == 'LOAN_DISBURSEMENT': # We lend
                debit_acc = event.contact.linked_account_id
                credit_acc = actual_payment_acc_id
                description = f"Loan Disbursement to {event.contact.name}"
                
            elif event.event_type == 'LOAN_REPAYMENT': # We collect
                debit_acc = actual_payment_acc_id 
                credit_acc = event.contact.linked_account_id
                description = f"Loan Repayment from {event.contact.name}"
                
            elif event.event_type == 'PARTNER_WITHDRAWAL':
                debit_acc = rules.get('equity', {}).get('draws') or rules.get('equity', {}).get('capital') # Fallback to Capital if Draws not set
                credit_acc = actual_payment_acc_id
                description = f"Partner Withdrawal: {event.contact.name}"

            if not debit_acc or not credit_acc:
                raise ValidationError(f"Accounting mapping failed for {event.event_type} (Dr:{debit_acc}, Cr:{credit_acc})")

            # 1. Create Transaction (Cash Move)
            from .models import Transaction
            trx_type = 'IN' if debit_acc == actual_payment_acc_id else 'OUT'
            
            trx = Transaction.objects.create(
                organization=organization,
                account=fin_acc,
                amount=event.amount,
                type=trx_type,
                description=description,
                reference_id=event.reference
            )
            
            # 2. Create Journal Entry
            entry = LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=event.date,
                description=description,
                reference=event.reference,
                status='POSTED',
                site_id=fin_acc.site_id,
                lines=[
                    {"account_id": debit_acc, "debit": event.amount, "credit": Decimal('0')},
                    {"account_id": credit_acc, "debit": Decimal('0'), "credit": event.amount}
                ]
            )
            
            event.transaction = trx
            event.journal_entry = entry
            event.status = 'SETTLED'
            event.save()
            
            return event
            return event

class TaxService:
    @staticmethod
    def get_declared_report(organization, start_date, end_date):
        """
        Generates the 'Virtual Reclassification' Report for Mixed/Regular modes.
        Reconstructs the tax reality from Invoice Metadata.
        """
        from .models import OrderLine, Order
        from django.db.models import Sum
        
        settings = ConfigurationService.get_global_settings(organization)
        company_type = settings.get('companyType', 'REGULAR') # Default to REGULAR if unset
        
        # Date filtering
        # Ideally should filter by fiscal period, but using raw dates for now
        
        if company_type == 'MICRO':
            # Micro logic: Fixed % of Revenue
            sales = Order.objects.filter(
                organization=organization,
                type='SALE',
                scope='OFFICIAL',
                created_at__range=[start_date, end_date]
            ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
            
            micro_rate = Decimal(str(settings.get('microTaxPercentage', 0))) / 100
            tax_due = sales * micro_rate
            
            return {
                "type": "MICRO",
                "period": f"{start_date} to {end_date}",
                "sales_revenue": sales,
                "tax_due": tax_due,
                "note": f"Calculated at {micro_rate*100}% of Revenue"
            }
            
        else:
            # MIXED, REGULAR, REAL
            # Virtual Reclassification of Purchases
            purchase_lines = OrderLine.objects.filter(
                organization=organization,
                order__type='PURCHASE',
                order__scope='OFFICIAL',
                order__status__in=['COMPLETED', 'RECEIVED'],
                order__created_at__range=[start_date, end_date]
            )
            
            total_ht = Decimal('0')
            total_vat_recoverable = Decimal('0')
            total_ttc = Decimal('0')
            
            for line in purchase_lines:
                # Metadata: unit_cost_ht, vat_amount (per unit)
                qty = line.quantity
                # Calculate line totals from scalar + qty to minimize rounding drift, or use line.total
                ht = line.unit_cost_ht * qty
                vat = line.vat_amount * qty
                ttc = line.total
                
                total_ht += ht
                total_vat_recoverable += vat
                total_ttc += ttc
                
            return {
                "type": "STANDARD_RECLASSIFIED",
                "period": f"{start_date} to {end_date}",
                "purchases_ht": total_ht,
                "vat_recoverable": total_vat_recoverable,
                "purchases_ttc_internal": total_ttc,
                "note": "Virtual Reclassification: Ledger=TTC, Report=HT+VAT"
            }
