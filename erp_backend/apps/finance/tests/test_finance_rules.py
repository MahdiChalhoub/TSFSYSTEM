from django.test import TestCase
from django.core.exceptions import ValidationError
from decimal import Decimal
from erp.models import Organization
from apps.finance.models import ChartOfAccount, FiscalYear, FiscalPeriod
from apps.finance.services import LedgerService
import datetime

class FinanceRulesTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Rules Test Org", slug="rules-test")
        self.fy = FiscalYear.objects.create(
            organization=self.org,
            name="FY-2026",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 12, 31)
        )
        self.fp = FiscalPeriod.objects.create(
            organization=self.org,
            fiscal_year=self.fy,
            name="P01-2026",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 1, 31)
        )
        # Add a full-year period to cover any timezone.now() calls during tests
        self.fp_full = FiscalPeriod.objects.create(
            organization=self.org,
            fiscal_year=self.fy,
            name="FY2026-ALL",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 12, 31)
        )

        
        # Regular Asset Account
        self.cash = ChartOfAccount.objects.create(
            organization=self.org,
            code="1000",
            name="Cash",
            type="ASSET"
        )
        
        # System-Only Account
        self.sys_acc = ChartOfAccount.objects.create(
            organization=self.org,
            code="9000",
            name="System Suspense",
            type="EQUITY",
            is_system_only=True
        )
        
        # Zero-Balance Control Account
        self.control_acc = ChartOfAccount.objects.create(
            organization=self.org,
            code="9001",
            name="Stock Adjustment",
            type="EXPENSE",
            requires_zero_balance=True
        )

    def test_manual_posting_to_system_account_fails(self):
        """Manual journal entry to a system-only account should fail."""
        lines = [
            {"account_id": self.cash.id, "debit": Decimal("100.00"), "credit": Decimal("0.00")},
            {"account_id": self.sys_acc.id, "debit": Decimal("0.00"), "credit": Decimal("100.00")}
        ]
        
        with self.assertRaises(ValidationError) as cm:
            LedgerService.create_journal_entry(
                organization=self.org,
                transaction_date=datetime.date(2026, 1, 15),
                description="Manual test to system account",
                lines=lines,
                status="POSTED"
            )
        self.assertIn("Manual posting to system-only accounts is forbidden", str(cm.exception))

    def test_internal_bypass_to_system_account_succeeds(self):
        """Prohibiting manual posting should NOT block internal system services using internal_bypass."""
        lines = [
            {"account_id": self.cash.id, "debit": Decimal("100.00"), "credit": Decimal("0.00")},
            {"account_id": self.sys_acc.id, "debit": Decimal("0.00"), "credit": Decimal("100.00")}
        ]
        
        entry = LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 15),
            description="System internal posting",
            lines=lines,
            status="POSTED",
            internal_bypass=True
        )
        self.assertEqual(entry.status, "POSTED")
        
        # Refresh from DB to check balances
        self.sys_acc.refresh_from_db()
        self.assertEqual(self.sys_acc.balance, Decimal("-100.00"))

    def test_closure_validation_fails_for_non_zero_control_account(self):
        """Closing should fail if a requires_zero_balance account is non-zero."""
        # Post a transaction to make it non-zero
        lines = [
            {"account_id": self.cash.id, "debit": Decimal("50.00"), "credit": Decimal("0.00")},
            {"account_id": self.control_acc.id, "debit": Decimal("0.00"), "credit": Decimal("50.00")}
        ]
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 15),
            description="Control account imbalance",
            lines=lines,
            status="POSTED"
        )
        
        with self.assertRaises(ValidationError) as cm:
            LedgerService.validate_closure(self.org, fiscal_period=self.fp)
        self.assertIn("must have zero balance before closure", str(cm.exception))

    def test_closure_validation_succeeds_for_zero_control_account(self):
        """Closing should succeed if all control accounts are at zero."""
        # No transactions or balanced transactions
        result = LedgerService.validate_closure(self.org, fiscal_period=self.fp)
        self.assertTrue(result)

    def test_tax_report_generation(self):
        """Verify TaxService report generation for MICRO and REGULAR companies."""
        from apps.finance.services import TaxService
        from apps.pos.models import Order, OrderLine
        from apps.inventory.models import Product, Category
        from erp.services import ConfigurationService
        
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date(2026, 12, 31)

        # 1. Setup global settings for MICRO
        ConfigurationService.save_global_settings(self.org, {
            'companyType': 'MICRO',
            'microTaxPercentage': 5.0
        })
        
        # Create a Sale Order
        Order.objects.create(
            organization=self.org,
            type='SALE',
            scope='OFFICIAL',
            total_amount=Decimal('1000.00'),
            status='COMPLETED'
        )
        
        report = TaxService.get_declared_report(self.org, start_date, end_date)
        self.assertEqual(report['type'], 'MICRO')
        self.assertEqual(report['sales_revenue'], Decimal('1000.00'))
        self.assertEqual(report['tax_due'], Decimal('50.00')) # 5% of 1000
        
        # 2. Setup for STANDARD (REGULAR)
        ConfigurationService.save_global_settings(self.org, {
            'companyType': 'REGULAR'
        })
        
        cat = Category.objects.create(organization=self.org, name="Default")
        prod = Product.objects.create(organization=self.org, name="Item", category=cat, sku="SKU1")
        
        po = Order.objects.create(
            organization=self.org,
            type='PURCHASE',
            scope='OFFICIAL',
            status='DRAFT'
        )
        OrderLine.objects.create(
            organization=self.org,
            order=po,
            product=prod,
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
            tax_rate=Decimal('0.10'),
            subtotal=Decimal('1100.00')
        )
        # Transition to completed after adding lines to bypass immutability validation
        po.status = 'COMPLETED'
        po.save()
        
        report = TaxService.get_declared_report(self.org, start_date, end_date)
        self.assertEqual(report['type'], 'STANDARD_RECLASSIFIED')
        self.assertEqual(report['purchases_ht'], Decimal('1000.00')) # 10 * 100
        self.assertEqual(report['vat_recoverable'], Decimal('100.00')) # 10% of 1000

    def test_vat_settlement_refund_receivable(self):
        """
        VAT REFUND RECEIVABLE: when TVA Récupérable > TVA Collectée,
        settlement must post to VAT Refund Receivable account (not Bank).
        """
        from apps.finance.services.vat_settlement_service import VATSettlementService
        from erp.services import ConfigurationService
        import datetime

        # Create sales tax (TVA Collectée) account and purchases tax (TVA Récupérable)
        vat_collected_acc = ChartOfAccount.objects.create(
            organization=self.org, code='4000', name='TVA Collectée', type='LIABILITY'
        )
        vat_recoverable_acc = ChartOfAccount.objects.create(
            organization=self.org, code='1200', name='TVA Récupérable', type='ASSET'
        )
        refund_receivable_acc = ChartOfAccount.objects.create(
            organization=self.org, code='1201', name='VAT Refund Receivable', type='ASSET'
        )
        bank_acc = ChartOfAccount.objects.create(
            organization=self.org, code='5000', name='Bank', type='ASSET'
        )

        # Configure posting rules with new standardized key names
        rules = ConfigurationService.get_posting_rules(self.org)
        if 'sales' not in rules:
            rules['sales'] = {}
        if 'purchases' not in rules:
            rules['purchases'] = {}
        if 'tax' not in rules:
            rules['tax'] = {}
        rules['sales']['vat_collected'] = vat_collected_acc.id
        rules['purchases']['vat_recoverable'] = vat_recoverable_acc.id
        rules['tax']['vat_refund_receivable'] = refund_receivable_acc.id
        rules['tax']['vat_payable'] = bank_acc.id  # re-use bank_acc as dummy vat_payable for setup
        ConfigurationService.save_posting_rules(self.org, rules)

        period_start = datetime.date(2026, 1, 1)
        period_end = datetime.date(2026, 1, 31)

        # Post some TVA Récupérable (purchases): 500 debit on vat_recoverable_acc
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 15),
            description='Input VAT on purchases',
            lines=[
                {'account_id': vat_recoverable_acc.id, 'debit': Decimal('500.00'), 'credit': Decimal('0')},
                {'account_id': self.cash.id, 'debit': Decimal('0'), 'credit': Decimal('500.00')},
            ],
            status='POSTED',
            internal_bypass=True,
        )

        # Post a smaller TVA Collectée (sales): 200 credit on vat_collected_acc
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 20),
            description='Output VAT on sales',
            lines=[
                {'account_id': self.cash.id, 'debit': Decimal('200.00'), 'credit': Decimal('0')},
                {'account_id': vat_collected_acc.id, 'debit': Decimal('0'), 'credit': Decimal('200.00')},
            ],
            status='POSTED',
            internal_bypass=True,
        )

        # Preview: net_due should be < 0 (DGI owes us 300)
        report = VATSettlementService.calculate_settlement(self.org, period_start, period_end)
        self.assertEqual(report['vat_collected'], Decimal('200.00'))
        self.assertEqual(report['vat_recoverable'], Decimal('500.00'))
        self.assertEqual(report['net_due'], Decimal('-300.00'))

        # Post netting entry (Step 1) — no bank_account_id needed
        result = VATSettlementService.post_settlement(
            organization=self.org,
            period_start=period_start,
            period_end=period_end,
            user=None,
        )

        je_id = result['journal_entry_id']
        from apps.finance.models import JournalEntry
        je = JournalEntry.objects.get(id=je_id)
        je_lines = je.lines.all()

        # There should be a debit on refund_receivable_acc for 300
        rr_line = je_lines.filter(account_id=refund_receivable_acc.id).first()
        self.assertIsNotNone(rr_line, "VAT Refund Receivable line must be posted")
        self.assertEqual(rr_line.debit, Decimal('300.00'))

        # Bank account must NOT appear in netting entry (Step 2 only)
        bank_line = je_lines.filter(account_id=bank_acc.id, debit__gt=0).first()
        self.assertIsNone(bank_line, "Bank must not appear in netting entry (that's Step 2)")

        print("[OK] VAT settlement refund: netting posts to VAT Refund Receivable, not Bank.")

    def test_vat_settlement_payable(self):
        """
        VAT PAYABLE: when TVA Collectée > TVA Récupérable, netting entry
        must post net_due to tax.vat_payable (not Bank directly).
        """
        from apps.finance.services.vat_settlement_service import VATSettlementService
        from erp.services import ConfigurationService
        import datetime

        vat_collected_acc = ChartOfAccount.objects.create(
            organization=self.org, code='4001', name='TVA Collectée B', type='LIABILITY'
        )
        vat_recoverable_acc = ChartOfAccount.objects.create(
            organization=self.org, code='1202', name='TVA Récupérable B', type='ASSET'
        )
        vat_payable_acc = ChartOfAccount.objects.create(
            organization=self.org, code='2300', name='VAT Payable', type='LIABILITY'
        )

        rules = ConfigurationService.get_posting_rules(self.org)
        if 'sales' not in rules:
            rules['sales'] = {}
        if 'purchases' not in rules:
            rules['purchases'] = {}
        if 'tax' not in rules:
            rules['tax'] = {}
        rules['sales']['vat_collected'] = vat_collected_acc.id
        rules['purchases']['vat_recoverable'] = vat_recoverable_acc.id
        rules['tax']['vat_payable'] = vat_payable_acc.id
        ConfigurationService.save_posting_rules(self.org, rules)

        period_start = datetime.date(2026, 1, 1)
        period_end = datetime.date(2026, 1, 31)

        # Post TVA Collectée 800, TVA Récupérable 300 → net_due = +500
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 10),
            description='Output VAT',
            lines=[
                {'account_id': self.cash.id, 'debit': Decimal('800'), 'credit': Decimal('0')},
                {'account_id': vat_collected_acc.id, 'debit': Decimal('0'), 'credit': Decimal('800')},
            ],
            status='POSTED', internal_bypass=True,
        )
        LedgerService.create_journal_entry(
            organization=self.org,
            transaction_date=datetime.date(2026, 1, 12),
            description='Input VAT',
            lines=[
                {'account_id': vat_recoverable_acc.id, 'debit': Decimal('300'), 'credit': Decimal('0')},
                {'account_id': self.cash.id, 'debit': Decimal('0'), 'credit': Decimal('300')},
            ],
            status='POSTED', internal_bypass=True,
        )

        report = VATSettlementService.calculate_settlement(self.org, period_start, period_end)
        self.assertEqual(report['net_due'], Decimal('500.00'))

        result = VATSettlementService.post_settlement(
            organization=self.org,
            period_start=period_start,
            period_end=period_end,
            user=None,
        )

        from apps.finance.models import JournalEntry
        je = JournalEntry.objects.get(id=result['journal_entry_id'])
        je_lines = je.lines.all()

        # net_due > 0 → CR VAT Payable
        vp_line = je_lines.filter(account_id=vat_payable_acc.id).first()
        self.assertIsNotNone(vp_line, "VAT Payable line must be posted for net_due > 0")
        self.assertEqual(vp_line.credit, Decimal('500.00'))

        print("[OK] VAT settlement payable: netting posts to VAT Payable control account.")
