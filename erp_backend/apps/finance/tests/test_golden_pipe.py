"""
Golden Tests: Finance Pipe
==========================
Comprehensive validation of the hardened finance pipeline.
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from apps.finance.models import TransactionSequence, Invoice, Payment, ChartOfAccount, OrgTaxPolicy, JournalEntry, FinancialAccount, FiscalYear, FiscalPeriod
from apps.finance.services.accounting_engine import AccountingEngine
from apps.crm.models import Contact

class FinanceGoldenPipeTests(TestCase):

    def setUp(self):
        from erp.models import Organization, Warehouse
        self.org = Organization.objects.create(name="Golden Org", slug="golden")
        self.branch = Warehouse.objects.create(organization=self.org, name="Main", location_type="BRANCH")
        
        # Setup Fiscal Period (Required for GL posting)
        today = timezone.now().date()
        self.fy = FiscalYear.objects.create(
            organization=self.org, name=f"FY-{today.year}", 
            start_date=today.replace(month=1, day=1), end_date=today.replace(month=12, day=31)
        )
        self.fp = FiscalPeriod.objects.create(
            organization=self.org, fiscal_year=self.fy, name=f"FP-{today.strftime('%b-%Y')}",
            start_date=today.replace(day=1), end_date=today.replace(day=28) # Safe for all months
        )
        # Extend end_date slightly to cover today if it's late in the month
        if self.fp.end_date < today:
            self.fp.end_date = today.replace(day=31) if today.month in [1,3,5,7,8,10,12] else today.replace(day=30) if today.month != 2 else today.replace(day=29)
            self.fp.save()
        
        # Setup Default Tax Policy
        self.policy, _ = OrgTaxPolicy.objects.get_or_create(
            organization=self.org,
            defaults={
                'name': 'Default Policy',
                'is_default': True,
                'vat_output_enabled': True,
                'vat_input_recoverability': Decimal('1.000'),
                'official_vat_treatment': 'RECOVERABLE',
                'internal_vat_treatment': 'CAPITALIZE',
                'internal_sales_vat_mode': 'NONE'
            }
        )

        # Setup Chart of Accounts
        self.payable_acc = ChartOfAccount.objects.create(organization=self.org, code='2101', name='AP', type='LIABILITY')
        self.receivable_acc = ChartOfAccount.objects.create(organization=self.org, code='1110', name='AR', type='ASSET')
        self.inventory_acc = ChartOfAccount.objects.create(organization=self.org, code='1120', name='Inventory', type='ASSET')
        self.revenue_acc = ChartOfAccount.objects.create(organization=self.org, code='4100', name='Sales', type='INCOME')
        self.vat_rec_acc = ChartOfAccount.objects.create(organization=self.org, code='2111', name='VAT Rec', type='ASSET')
        self.vat_coll_acc = ChartOfAccount.objects.create(organization=self.org, code='2112', name='VAT Coll', type='LIABILITY')
        self.cash_acc = ChartOfAccount.objects.create(organization=self.org, code='1101', name='Cash', type='ASSET')

        # Setup Financial Account
        self.fin_acc = FinancialAccount.objects.create(
            organization=self.org, name="Main Cash", type="CASH", ledger_account=self.cash_acc
        )

        # Setup Posting Rules
        self.org.settings['finance_posting_rules'] = {
            'purchases': {
                'payable': self.payable_acc.id,
                'inventory': self.inventory_acc.id,
                'vat_recoverable': self.vat_rec_acc.id
            },
            'sales': {
                'receivable': self.receivable_acc.id,
                'revenue': self.revenue_acc.id,
                'vat_collected': self.vat_coll_acc.id
            }
        }
        self.org.save()

        # Contacts
        self.supplier = Contact.objects.create(organization=self.org, name="Global Supplier", type="SUPPLIER")
        self.customer = Contact.objects.create(organization=self.org, name="Standard Customer", type="CUSTOMER")

    def test_internal_purchase_vat_capitalization(self):
        """Phase 2.1: INTERNAL purchase VAT should be capitalized into inventory cost."""
        invoice = Invoice.objects.create(
            organization=self.org, type='PURCHASE', contact=self.supplier,
            display_mode='HT', scope='INTERNAL', issue_date=timezone.now().date(), total_amount=Decimal('111.00')
        )
        # Create a line with 11% VAT
        from apps.finance.invoice_models import InvoiceLine
        InvoiceLine.objects.create(
            organization=self.org,
            invoice=invoice, description="Internal Item", quantity=1, unit_price=Decimal('100.00'),
            tax_rate=Decimal('11.00')
        )
        invoice.recalculate_totals() # subtotal_ht=100, tax_amount=11, total=111

        AccountingEngine.post_purchase_invoice(invoice)

        # Verify JE
        je = invoice.journal_entry
        self.assertEqual(je.scope, 'INTERNAL')
        
        # Debits: Inventory should be 111 (HT 100 + VAT 11)
        inv_line = je.lines.get(account=self.inventory_acc)
        self.assertEqual(inv_line.debit, Decimal('111.00'))
        
        # Credits: AP should be 111
        ap_line = je.lines.get(account=self.payable_acc)
        self.assertEqual(ap_line.credit, Decimal('111.00'))
        
        # No VAT Recoverable line
        self.assertFalse(je.lines.filter(account=self.vat_rec_acc).exists())

    def test_official_purchase_vat_recoverability(self):
        """Phase 2.1: OFFICIAL purchase VAT should be recoverable."""
        invoice = Invoice.objects.create(
            organization=self.org, type='PURCHASE', contact=self.supplier,
            display_mode='HT', scope='OFFICIAL', issue_date=timezone.now().date(), total_amount=Decimal('111.00')
        )
        from apps.finance.invoice_models import InvoiceLine
        InvoiceLine.objects.create(
            organization=self.org,
            invoice=invoice, description="Official Item", quantity=1, unit_price=Decimal('100.00'),
            tax_rate=Decimal('11.00')
        )
        invoice.recalculate_totals()

        AccountingEngine.post_purchase_invoice(invoice)

        je = invoice.journal_entry
        
        # Debits: Inventory 100, VAT Rec 11
        self.assertEqual(je.lines.get(account=self.inventory_acc).debit, Decimal('100.00'))
        self.assertEqual(je.lines.get(account=self.vat_rec_acc).debit, Decimal('11.00'))
        
        # Credit: AP 111
        self.assertEqual(je.lines.get(account=self.payable_acc).credit, Decimal('111.00'))

    def test_internal_sales_vat_modes(self):
        """Phase 2.2: INTERNAL sales VAT display modes (NONE vs DISPLAY_ONLY)."""
        # 1. Mode = NONE
        self.policy.internal_sales_vat_mode = 'NONE'
        self.policy.save()

        invoice_none = Invoice.objects.create(
            organization=self.org, type='SALES', contact=self.customer,
            display_mode='HT', scope='INTERNAL', issue_date=timezone.now().date()
        )
        from apps.finance.invoice_models import InvoiceLine
        InvoiceLine.objects.create(organization=self.org, invoice=invoice_none, quantity=1, unit_price=Decimal('100.00'), tax_rate=11)
        invoice_none.recalculate_totals()

        AccountingEngine.post_sales_invoice(invoice_none)
        
        # Ledger should only show 100 in AR and Revenue
        self.assertEqual(invoice_none.journal_entry.lines.get(account=self.receivable_acc).debit, Decimal('100.00'))
        self.assertEqual(invoice_none.journal_entry.lines.get(account=self.revenue_acc).credit, Decimal('100.00'))

        # 2. Mode = DISPLAY_ONLY
        self.policy.internal_sales_vat_mode = 'DISPLAY_ONLY'
        self.policy.save()

        invoice_disp = Invoice.objects.create(
            organization=self.org, type='SALES', contact=self.customer,
            display_mode='HT', scope='INTERNAL', issue_date=timezone.now().date()
        )
        InvoiceLine.objects.create(organization=self.org, invoice=invoice_disp, quantity=1, unit_price=Decimal('100.00'), tax_rate=11)
        invoice_disp.recalculate_totals()

        AccountingEngine.post_sales_invoice(invoice_disp)
        
        # Ledger MUST still be 100 (HT only), even if UI shows 111 (via ttc/vat_display)
        self.assertEqual(invoice_disp.journal_entry.lines.get(account=self.receivable_acc).debit, Decimal('100.00'))
        self.assertEqual(invoice_disp.journal_entry.lines.get(account=self.revenue_acc).credit, Decimal('100.00'))
        self.assertFalse(invoice_disp.journal_entry.lines.filter(account=self.vat_coll_acc).exists())

    def test_payment_posting_and_scope_propagation(self):
        """Phase 3: Payment posting, status guard and scope propagation."""
        invoice = Invoice.objects.create(
            organization=self.org, type='PURCHASE', contact=self.supplier,
            display_mode='HT', scope='INTERNAL', issue_date=timezone.now().date()
        )
        from apps.finance.invoice_models import InvoiceLine
        InvoiceLine.objects.create(organization=self.org, invoice=invoice, quantity=1, unit_price=100, tax_rate=0)
        invoice.recalculate_totals()
        AccountingEngine.post_purchase_invoice(invoice)

        # Create DRAFT payment
        payment = Payment.objects.create(
            organization=self.org, type='SUPPLIER_PAYMENT', contact=self.supplier,
            amount=Decimal('100.00'), payment_date=timezone.now().date(),
            payment_account=self.fin_acc, invoice=invoice, scope='INTERNAL'
        )

        # Status guard check: cannot manual save to POSTED without JE
        payment.status = 'POSTED'
        with self.assertRaises(Exception): # ValidationError
            payment.save()
        
        payment.status = 'DRAFT'
        payment.save()

        # Correct way to post
        AccountingEngine.post_payment(payment)

        self.assertEqual(payment.status, 'POSTED')
        self.assertIsNotNone(payment.journal_entry)
        self.assertEqual(payment.journal_entry.scope, 'INTERNAL') # Scope propagated
        
        # Balances
        self.cash_acc.refresh_from_db()
        self.payable_acc.refresh_from_db()
        self.assertEqual(self.cash_acc.balance, Decimal('-100.00'))
        self.assertEqual(self.payable_acc.balance, Decimal('0.00')) # 100 credit from inv, 100 debit from payment

    def test_transaction_sequence_concurrency_robustness(self):
        """Phase 1.1: Verify TransactionSequence.next_value() behavior."""
        # Simple test to see if it even increments (real concurrency hard in unit tests)
        val1 = TransactionSequence.next_value(self.org, 'INV')
        val2 = TransactionSequence.next_value(self.org, 'INV')
        
        self.assertIn('000001', val1)
        self.assertIn('000002', val2)
        
        seq = TransactionSequence.objects.get(organization=self.org, type='INV')
        self.assertEqual(seq.next_number, 3)
