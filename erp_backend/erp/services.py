from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum
import uuid
import json

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
