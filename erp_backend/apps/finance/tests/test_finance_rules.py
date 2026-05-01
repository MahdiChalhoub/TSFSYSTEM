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
        from erp.connector_registry import connector
        Order = connector.require('pos.orders.get_model', org_id=self.org.id)
        OrderLine = connector.require('pos.order_lines.get_model', org_id=self.org.id)
        Product = connector.require('inventory.products.get_model', org_id=self.org.id)
        Category = connector.require('inventory.categories.get_model', org_id=self.org.id)
        if any(x is None for x in (Order, OrderLine, Product, Category)):
            self.skipTest("POS or Inventory module unavailable")
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
            status='COMPLETED'
        )
        OrderLine.objects.create(
            organization=self.org,
            order=po,
            product=prod,
            quantity=Decimal('10'),
            unit_price=Decimal('100.00'),
            unit_cost_ht=Decimal('90.00'),
            vat_amount=Decimal('10.00'),
            total=Decimal('1000.00')
        )
        
        report = TaxService.get_declared_report(self.org, start_date, end_date)
        self.assertEqual(report['type'], 'STANDARD_RECLASSIFIED')
        self.assertEqual(report['purchases_ht'], Decimal('900.00')) # 10 * 90
        self.assertEqual(report['vat_recoverable'], Decimal('100.00')) # 10 * 10
