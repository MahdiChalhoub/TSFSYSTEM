from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum
import uuid
import json

class ProvisioningService:
    @staticmethod
    def provision_organization(name, slug):
        from .models import Organization, Site, ChartOfAccount
        """
        Creates a new organization and default skeleton.
        """
        with transaction.atomic():
            org = Organization.objects.create(name=name, slug=slug)
            
            # Default Site
            Site.objects.create(
                organization=org,
                name="Main Branch",
                code="MAIN"
            )
            
            # Core Accounts
            core_accounts = [
                ('1000', 'ASSETS', 'ASSET'),
                ('2000', 'LIABILITIES', 'LIABILITY'),
                ('3000', 'EQUITY', 'EQUITY'),
                ('4000', 'REVENUE', 'REVENUE'),
                ('5000', 'EXPENSES', 'EXPENSE'),
            ]
            
            for code, name, type in core_accounts:
                ChartOfAccount.objects.create(
                    organization=org,
                    code=code,
                    name=name,
                    type=type
                )
            
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
    def receive_stock(organization, product, warehouse, quantity, cost_price_ht, reference="RECEPTION"):
        from .models import Inventory, InventoryMovement
        """
        Receives stock, updates AMC, and creates Journal Entry.
        """
        inbound_qty = Decimal(str(quantity))
        inbound_cost = Decimal(str(cost_price_ht))
        inbound_value = inbound_qty * inbound_cost

        with transaction.atomic():
            # 1. AMC
            current_total_qty = Inventory.objects.filter(
                organization=organization,
                product=product
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
            
            current_total_value = current_total_qty * product.cost_price
            
            new_total_qty = current_total_qty + inbound_qty
            new_amc = product.cost_price
            
            if new_total_qty > 0:
                new_amc = (current_total_value + inbound_value) / new_total_qty

            product.cost_price = new_amc
            product.cost_price_ht = inbound_cost
            product.save()

            inventory, created = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=warehouse,
                product=product
            )
            inventory.quantity += inbound_qty
            inventory.save()

            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='IN',
                quantity=inbound_qty,
                cost_price=inbound_cost,
                reference=reference
            )

            # 5. Financial Integration
            rules = ConfigurationService.get_posting_rules(organization)
            inv_acc = rules.get('sales', {}).get('inventory')
            susp_acc = rules.get('suspense', {}).get('reception')

            if inv_acc and susp_acc:
                from .services import LedgerService
                LedgerService.create_journal_entry(
                    organization=organization,
                    transaction_date=timezone.now(),
                    description=f"Stock Reception: {product.name} ({quantity})",
                    reference=reference,
                    status='POSTED',
                    site_id=warehouse.site_id,
                    lines=[
                        {
                            "account_id": inv_acc,
                            "debit": inbound_value,
                            "credit": 0,
                            "description": "Inventory Increase"
                        },
                        {
                            "account_id": susp_acc,
                            "debit": 0,
                            "credit": inbound_value,
                            "description": "Accrued Liability for Reception"
                        }
                    ]
                )
            
            return inventory

    @staticmethod
    def adjust_stock(organization, product, warehouse, quantity, reason, reference=None):
        from .models import Inventory, InventoryMovement
        """
        Manual adjustment.
        """
        adj_qty = Decimal(str(quantity))
        cost_price = product.cost_price
        
        with transaction.atomic():
            inventory, created = Inventory.objects.get_or_create(
                organization=organization,
                warehouse=warehouse,
                product=product
            )
            
            inventory.quantity += adj_qty
            inventory.save()

            InventoryMovement.objects.create(
                organization=organization,
                product=product,
                warehouse=warehouse,
                type='ADJUST',
                quantity=adj_qty,
                cost_price=cost_price,
                reference=reference or f"ADJ-{timezone.now().timestamp()}",
                reason=reason
            )
            
            return inventory

    @staticmethod
    def get_inventory_valuation(organization):
        from .models import Inventory
        from django.db.models import Sum, F
        """
        Calculates total value of inventory based on AMC.
        """
        # Sum of (Inventory.quantity * Product.cost_price)
        result = Inventory.objects.filter(organization=organization).aggregate(
            total_value=Sum(F('quantity') * F('product__cost_price'))
        )
        total_value = result['total_value'] or Decimal('0')
        item_count = Inventory.objects.filter(organization=organization).count()
        
        return {
            "total_value": total_value,
            "item_count": item_count,
            "timestamp": timezone.now()
        }

    @staticmethod
    def get_inventory_financial_status(organization):
        from .models import ChartOfAccount
        valuation = InventoryService.get_inventory_valuation(organization)
        rules = ConfigurationService.get_posting_rules(organization)
        
        inv_acc_id = rules.get('sales', {}).get('inventory')
        if not inv_acc_id:
            return {
                **valuation,
                "ledger_balance": Decimal('0'),
                "discrepancy": Decimal('0'),
                "is_mapped": False
            }
            
        try:
            account = ChartOfAccount.objects.get(id=inv_acc_id)
            ledger_balance = account.balance
        except ChartOfAccount.DoesNotExist:
            ledger_balance = Decimal('0')

        discrepancy = valuation['total_value'] - ledger_balance
        
        return {
            **valuation,
            "ledger_balance": ledger_balance,
            "discrepancy": discrepancy,
            "is_mapped": True,
            "account_name": account.name if 'account' in locals() else "N/A",
            "account_code": account.code if 'account' in locals() else "N/A"
        }

class LedgerService:
    @staticmethod
    def create_journal_entry(organization, transaction_date, description, lines, reference=None, 
                             status='DRAFT', scope='OFFICIAL', site_id=None):
        from .models import FiscalPeriod, JournalEntry, JournalEntryLine
        """
        Creates a JournalEntry with multiple lines.
        Ensures total debit equals total credit.
        """
        # 1. Double-Entry Validation
        total_debit = sum(Decimal(str(l['debit'])) for l in lines)
        total_credit = sum(Decimal(str(l['credit'])) for l in lines)

        if abs(total_debit - total_credit) > Decimal('0.001'):
            raise ValidationError(f"Out of Balance: Total Debit ({total_debit}) must equal Total Credit ({total_credit})")

        with transaction.atomic():
            # 2. Resolve Fiscal Period
            fiscal_period = FiscalPeriod.objects.filter(
                organization=organization,
                start_date__lte=transaction_date,
                end_date__gte=transaction_date
            ).first()

            if not fiscal_period:
                raise ValidationError(f"No active Fiscal Period found for date: {transaction_date}")

            # 3. Create Entry
            entry = JournalEntry.objects.create(
                organization=organization,
                transaction_date=transaction_date,
                description=description,
                reference=reference or f"JRN-{uuid.uuid4().hex[:8].upper()}",
                fiscal_year=fiscal_period.fiscal_year,
                fiscal_period=fiscal_period,
                status=status,
                scope=scope,
                site_id=site_id
            )

            # 4. Create Lines
            for line_data in lines:
                JournalEntryLine.objects.create(
                    organization=organization,
                    journal_entry=entry,
                    account_id=line_data['account_id'],
                    debit=line_data['debit'],
                    credit=line_data['credit'],
                    description=line_data.get('description', description)
                )

            # 5. If POSTED, Update Balances
            if status == 'POSTED':
                LedgerService.post_journal_entry(entry)

            return entry

    @staticmethod
    def post_journal_entry(entry):
        """
        Finalizes a journal entry and updates COA balances.
        """
        if entry.status == 'POSTED' and entry.posted_at:
            return # Already posted

        with transaction.atomic():
            for line in entry.lines.all():
                net_change = line.debit - line.credit
                account = line.account
                
                account.balance += net_change
                account.save()

            entry.status = 'POSTED'
            entry.posted_at = timezone.now()
            entry.save()
            
    @staticmethod
    def reverse_journal_entry(organization, entry_id):
        from .models import JournalEntry
        """
        Creates a mirrored entry to cancel out the original and marks it as REVERSED.
        """
        with transaction.atomic():
            original = JournalEntry.objects.get(id=entry_id, organization=organization)
            
            if original.status != 'POSTED':
                raise ValidationError("Only posted entries can be reversed")

            # 1. Prepare reversal lines (swap debit/credit)
            reversal_lines = []
            for line in original.lines.all():
                reversal_lines.append({
                    "account_id": line.account_id,
                    "debit": line.credit,
                    "credit": line.debit,
                    "description": f"Reversal of Entry #{original.id}"
                })

            # 2. Create the Reversal Entry
            LedgerService.create_journal_entry(
                organization=organization,
                transaction_date=timezone.now(),
                description=f"Reversal of Entry #{original.id} ({original.reference})",
                reference=f"REV-{original.id}",
                lines=reversal_lines,
                status='POSTED',
                scope=original.scope,
                site_id=original.site_id
            )

            # 3. Mark original as REVERSED
            original.status = 'REVERSED'
            original.save()
            
    @staticmethod
    def update_journal_entry(organization, entry_id, transaction_date=None, description=None, lines=None, status=None):
        from .models import JournalEntry, JournalEntryLine
        """
        Updates an existing journal entry. If moving from DRAFT to POSTED, triggers balance update.
        """
        with transaction.atomic():
            entry = JournalEntry.objects.get(id=entry_id, organization=organization)
            
            if entry.status == 'POSTED' and status != 'REVERSED':
                # Generally, posted entries shouldn't be edited. Use reversals.
                # But we might allow minor description updates if needed.
                if lines or transaction_date:
                    raise ValidationError("Cannot edit lines or date of a POSTED entry. Please reverse and recreate.")

            if transaction_date:
                entry.transaction_date = transaction_date
            if description:
                entry.description = description
            
            if status:
                entry.status = status

            entry.save()

            if lines is not None:
                # 1. Clear existing lines
                entry.lines.all().delete()
                
                # 2. Add new lines
                for line_data in lines:
                    JournalEntryLine.objects.create(
                        organization=organization,
                        journal_entry=entry,
                        account_id=line_data['account_id'],
                        debit=line_data['debit'],
                        credit=line_data['credit'],
                        description=line_data.get('description', entry.description)
                    )
                
                # 3. Validation
                total_debit = sum(Decimal(str(l['debit'])) for l in lines)
                total_credit = sum(Decimal(str(l['credit'])) for l in lines)
                if abs(total_debit - total_credit) > Decimal('0.001'):
                    raise ValidationError("Out of Balance")

            # 4. If moving to POSTED, update balances
            if status == 'POSTED' and not entry.posted_at:
                LedgerService.post_journal_entry(entry)

            return entry

    @staticmethod
    def get_chart_of_accounts(organization, scope='INTERNAL', include_inactive=False):
        from .models import ChartOfAccount
        """
        Returns flat list of accounts with rollup balances.
        """
        accounts_qs = ChartOfAccount.objects.filter(organization=organization)
        if not include_inactive:
            accounts_qs = accounts_qs.filter(is_active=True)
        
        accounts = list(accounts_qs.order_by('code'))
        
        balance_attr = 'balance_official' if scope == 'OFFICIAL' else 'balance'
        
        # Build Map
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts:
            acc.temp_balance = getattr(acc, balance_attr)
            acc.temp_children = []

        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map:
                account_map[acc.parent_id].temp_children.append(acc)
            else:
                roots.append(acc)

        def rollup(node):
            child_sum = sum(rollup(child) for child in node.temp_children)
            node.rollup_balance = node.temp_balance + child_sum
            return node.rollup_balance

        for root in roots:
            rollup(root)
            
        return accounts

    @staticmethod
    def get_account_statement(organization, account_id, start_date=None, end_date=None, scope='INTERNAL'):
        from .models import ChartOfAccount, JournalEntryLine
        from django.db.models import Sum
        account = ChartOfAccount.objects.get(id=account_id, organization=organization)
        
        lines_qs = JournalEntryLine.objects.filter(
            account=account,
            journal_entry__status='POSTED'
        )
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
            
        opening_balance = Decimal('0')
        if start_date:
            opening_agg = lines_qs.filter(journal_entry__transaction_date__lt=start_date).aggregate(
                total_debit=Sum('debit'),
                total_credit=Sum('credit')
            )
            opening_balance = (opening_agg['total_debit'] or Decimal('0')) - (opening_agg['total_credit'] or Decimal('0'))
            lines_qs = lines_qs.filter(journal_entry__transaction_date__gte=start_date)
            
        if end_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=end_date)
            
        return {
            "account": account,
            "opening_balance": opening_balance,
            "lines": lines_qs.select_related('journal_entry').order_by('journal_entry__transaction_date')
        }

    @staticmethod
    def get_trial_balance(organization, as_of_date=None, scope='INTERNAL'):
        from .models import ChartOfAccount, JournalEntryLine
        from django.db.models import Sum
        accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True).order_by('code')
        
        lines_qs = JournalEntryLine.objects.filter(organization=organization, journal_entry__status='POSTED')
        if as_of_date:
            lines_qs = lines_qs.filter(journal_entry__transaction_date__lte=as_of_date)
        if scope == 'OFFICIAL':
            lines_qs = lines_qs.filter(journal_entry__scope='OFFICIAL')
            
        balances = lines_qs.values('account_id').annotate(
            net=Sum('debit') - Sum('credit')
        )
        balance_map = {b['account_id']: b['net'] for b in balances}
        
        # Rollup logic
        account_map = {acc.id: acc for acc in accounts}
        for acc in accounts:
            acc.temp_balance = balance_map.get(acc.id, Decimal('0'))
            acc.temp_children = []

        roots = []
        for acc in accounts:
            if acc.parent_id and acc.parent_id in account_map:
                account_map[acc.parent_id].temp_children.append(acc)
            else:
                roots.append(acc)

        def rollup(node):
            child_sum = sum(rollup(child) for child in node.temp_children)
            node.rollup_balance = node.temp_balance + child_sum
            return node.rollup_balance

        for root in roots:
            rollup(root)
            
        return accounts

    @staticmethod
    def recalculate_balances(organization):
        from .models import ChartOfAccount, JournalEntryLine
        """
        Wipes COA balances and rebuilds them from POSTED lines.
        """
        with transaction.atomic():
            # 1. Reset all balances
            ChartOfAccount.objects.filter(organization=organization).update(
                balance=Decimal('0'),
                balance_official=Decimal('0')
            )
            
            # 2. Get all POSTED lines
            lines = JournalEntryLine.objects.filter(
                organization=organization,
                journal_entry__status='POSTED'
            ).select_related('journal_entry', 'account')
            
            for line in lines:
                net = line.debit - line.credit
                acc = line.account
                acc.balance += net
                if line.journal_entry.scope == 'OFFICIAL':
                    acc.balance_official += net
                acc.save()
        return True

    @staticmethod
    def clear_all_data(organization):
        from .models import JournalEntry, InventoryMovement, Transaction, ChartOfAccount
        """
        DANGER: Wipes all transactional data for an organization.
        """
        with transaction.atomic():
            JournalEntry.objects.filter(organization=organization).delete()
            InventoryMovement.objects.filter(organization=organization).delete()
            Transaction.objects.filter(organization=organization).delete()
            # Reset balances
            ChartOfAccount.objects.filter(organization=organization).update(
                balance=Decimal('0'),
                balance_official=Decimal('0')
            )
        return True

class FinancialAccountService:
    @staticmethod
    def create_account(organization, name, type, currency, site_id=None):
        from .models import ChartOfAccount, FinancialAccount
        """
        Creates a FinancialAccount and its corresponding ChartOfAccount (Ledger).
        """
        # 1. Find Parent COA by sub_type
        parent = ChartOfAccount.objects.filter(
            organization=organization,
            sub_type=type
        ).first()

        if not parent:
            raise ValidationError(
                f"Accounting System Error: No Chart of Account found with sub_type '{type}'. "
                f"Please ensure a root account exists with this sub_type."
            )

        parent_code = parent.code

        with transaction.atomic():
            # 2. Sequential Code Generation (e.g. 5700.001)
            last_child = ChartOfAccount.objects.filter(
                organization=organization,
                code__startswith=f"{parent_code}."
            ).order_by('-code').first()

            next_suffix = 1
            if last_child:
                try:
                    parts = last_child.code.split('.')
                    last_num = int(parts[-1])
                    next_suffix = last_num + 1
                except (ValueError, IndexError):
                    next_suffix = 1
            
            next_code = f"{parent_code}.{str(next_suffix).zfill(3)}"

            # 3. Create Ledger Account
            ledger_account = ChartOfAccount.objects.create(
                organization=organization,
                code=next_code,
                name=name,
                type='ASSET',
                parent=parent,
                is_system_only=True,
                is_active=True,
                balance=0
            )

            # 4. Create Financial Account
            financial_account = FinancialAccount.objects.create(
                organization=organization,
                name=name,
                type=type,
                currency=currency,
                site_id=site_id,
                ledger_account=ledger_account
            )

            return financial_account
