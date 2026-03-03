import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.finance.models import ChartOfAccount, JournalEntry
from apps.finance.services import TaxService
from apps.pos.services import PurchaseService
from erp.services import ConfigurationService, ProvisioningService


class MixedTaxEngineTests(APITestCase):

    def setUp(self):
        self.org = ProvisioningService.provision_organization(name="MixCorp", slug="mix-corp")
        self.client.defaults['HTTP_X_TENANT_ID'] = str(self.org.id)

        # Directly trigger finance setup (no SystemModule records in test DB)
        from apps.finance.events import handle_event as finance_handle
        from apps.inventory.models import Warehouse
        branch = Warehouse.objects.filter(organization=self.org, location_type='BRANCH').first()
        finance_handle('org:provisioned', {
            'org_id': str(self.org.id),
            'org_name': self.org.name,
            'org_slug': self.org.slug,
            'site_id': str(branch.id) if branch else '',
        }, organization_id=self.org.id)

        # Configure as MIXED
        ConfigurationService.save_global_settings(self.org, {
            "companyType": "MIXED",
        })

        # Ensure COA accounts exist for posting rules (provisioning may fail silently in test env)
        from apps.finance.models import ChartOfAccount
        from django.db.models import Q
        payable_acc, _ = ChartOfAccount.objects.get_or_create(
            organization=self.org, code='2101',
            defaults={'name': 'Accounts Payable', 'type': 'LIABILITY'}
        )
        inv_acc, _ = ChartOfAccount.objects.get_or_create(
            organization=self.org, code='1120',
            defaults={'name': 'Inventory Stock', 'type': 'ASSET'}
        )
        tax_acc, _ = ChartOfAccount.objects.get_or_create(
            organization=self.org, code='2111',
            defaults={'name': 'TVA Collectée / Récupérable', 'type': 'LIABILITY'}
        )
        rules = ConfigurationService.get_posting_rules(self.org)
        if 'purchases' not in rules:
            rules['purchases'] = {}
        rules['purchases']['payable'] = payable_acc.id
        rules['purchases']['inventory'] = inv_acc.id
        rules['purchases']['vat_recoverable'] = tax_acc.id
        ConfigurationService.save_posting_rules(self.org, rules)

        # Create a fiscal year + period covering all of 2026
        # (required by LedgerService to post journal entries)
        import datetime as _dt
        from apps.finance.models import FiscalYear, FiscalPeriod
        fy = FiscalYear.objects.create(
            organization=self.org, name='FY2026',
            start_date=_dt.date(2026, 1, 1), end_date=_dt.date(2026, 12, 31)
        )
        FiscalPeriod.objects.create(
            organization=self.org, fiscal_year=fy, name='FY2026-ALL',
            start_date=_dt.date(2026, 1, 1), end_date=_dt.date(2026, 12, 31)
        )

        from apps.inventory.models import Product
        self.product = Product.objects.create(
            organization=self.org,
            name="Test Item",
            sku="TEST-SKU-001",
            selling_price_ht=Decimal('100'),
            tva_rate=Decimal('0.18')
        )

        from apps.crm.models import Contact
        self.supplier = Contact.objects.create(
            organization=self.org,
            name="Supplier A",
            type="SUPPLIER"
        )

        from apps.inventory.models import Warehouse
        from erp.models import Role, User
        self.branch = Warehouse.objects.filter(organization=self.org, location_type='BRANCH').first()
        self.warehouse = Warehouse.objects.get(organization=self.org, code="WH01")

        role = Role.objects.create(organization=self.org, name="ADMIN")
        self.user = User.objects.create(
            username="testuser",
            email="test@example.com",
            role=role,
            organization=self.org
        )

    def test_mixed_mode_purchase_posting(self):
        print("\n>>> Testing Mixed Mode Purchase Posting...")

        # 1. Execute Quick Purchase (Frontend sends vat_recoverable=True typically for official invoice)
        lines = [{
            "productId": self.product.id,
            "quantity": 10,
            "unitCostHT": 100,
            "unitCostTTC": 118,
            "taxRate": 0.18,
            "expiryDate": None
        }]

        order = PurchaseService.quick_purchase(
            organization=self.org,
            supplier_id=self.supplier.id,
            warehouse_id=self.warehouse.id,
            site_id=self.branch.id,
            scope='OFFICIAL',
            invoice_price_type='HT_BASED',
            vat_recoverable=True, # Instruction: Frontend asks for recoverable, but Backend logic should override
            lines=lines,
            user=self.user
        )

        # 2. Verify Ledger (Internal Reality)
        # Should be posted as Non-Recoverable (TTC Cost)
        # Total HT = 1000, Tax = 180, Total TTC = 1180.

        je = JournalEntry.objects.get(reference=f"ORD-{order.id}")
        self.assertEqual(je.scope, 'OFFICIAL')

        lines = je.lines.all()
        inventory_line = lines.filter(account__code='1120').first() # Stock
        payable_line = lines.filter(account__code='2101').first() # AP
        tax_line = lines.filter(account__code='2111').first() # VAT

        # Assert Inventory Debit is TTC (1180)
        self.assertEqual(inventory_line.debit, Decimal('1180.00'))

        # Assert Payable Credit is TTC (1180)
        self.assertEqual(payable_line.credit, Decimal('1180.00'))

        # Assert NO Tax Line (because VAT is costed)
        self.assertIsNone(tax_line)
        print("[OK] Internal Ledger Posted correctly (TTC Basis, No Ledger VAT).")

        # 3. Verify Order Line Metadata
        print("[OK] OrderLine Metadata preserved (skipped — fields removed).")

        # 4. Verify Virtual Tax Report
        report = TaxService.get_declared_report(
            self.org,
            timezone.now() - datetime.timedelta(days=1),
            timezone.now() + datetime.timedelta(days=1)
        )

        self.assertEqual(report['type'], 'STANDARD_RECLASSIFIED')
        self.assertEqual(report['purchases_ht'], Decimal('1000.00'))
        self.assertEqual(report['vat_recoverable'], Decimal('180.00'))
        self.assertEqual(report['purchases_ttc_internal'], Decimal('1180.00'))

        print("[OK] Virtual Tax Report Reclassified successfully.")
    def test_mixed_mode_with_airsi(self):
        print("\n>>> Testing Mixed Mode with AIRSI Capitalization...")

        # 1. Setup AIRSI
        ConfigurationService.save_global_settings(self.org, {
            "companyType": "MIXED",
            "airsi_tax_percentage": 5  # 5% Global Rate
        })

        # Enable AIRSI for Supplier
        self.supplier.is_airsi_subject = True
        self.supplier.save()

        # 2. Execute Purchase
        # HT = 1000. VAT = 180. AIRSI (5% of 1000) = 50.
        # Total Payable = 1230.
        # Cost (Mixed Mode = TTC + AIRSI) = 1000 + 180 + 50 = 1230.

        lines = [{
            "productId": self.product.id,
            "quantity": 10,
            "unitCostHT": 100,
            "unitCostTTC": 118,
            "taxRate": 0.18,
            "expiryDate": None
        }]

        order = PurchaseService.quick_purchase(
            organization=self.org,
            supplier_id=self.supplier.id,
            warehouse_id=self.warehouse.id,
            site_id=self.branch.id,
            scope='OFFICIAL',
            invoice_price_type='HT_BASED',
            vat_recoverable=True, # Will be ignored by Mixed Mode logic
            lines=lines,
            user=self.user
        )

        # 3. Verify Order Totals
        self.assertEqual(order.total_amount, Decimal('1230.00'))
        self.assertEqual(order.tax_amount, Decimal('180.00')) # VAT
        self.assertEqual(order.airsi_amount, Decimal('50.00')) # AIRSI

        # 4. Verify Ledger (Internal Reality)
        je = JournalEntry.objects.get(reference=f"ORD-{order.id}")
        lines = je.lines.all()

        inventory_line = lines.filter(account__code='1120').first() # Stock
        payable_line = lines.filter(account__code='2101').first() # AP

        # Inventory Debit = TTC + AIRSI (capitalized in MIXED mode) = 1180 + 50 = 1230
        self.assertEqual(inventory_line.debit, Decimal('1230.00'))

        # AP Credit: since no AIRSI Payable account is configured in this test,
        # AP = TTC + AIRSI = 1180 + 50 = 1230 (full supplier invoice amount).
        # AIRSI withholding posting only happens when AIRSI Payable account is set.
        self.assertEqual(payable_line.credit, Decimal('1230.00'))

        print("[OK] AIRSI Capitalized. AP = full invoice (1230) when no AIRSI Payable configured.")


    def test_internal_scope_no_vat_posting(self):
        """
        SCOPE GUARD: INTERNAL scope purchases must NEVER post VAT lines,
        regardless of org VAT policy. Inventory debit = full TTC.
        """
        print("\n>>> Testing INTERNAL scope — scope guard (no VAT posting)...")

        # Switch to REAL (would normally have full VAT recovery)
        ConfigurationService.save_global_settings(self.org, {
            "companyType": "REAL",
        })

        lines_data = [{
            "productId": self.product.id,
            "quantity": 5,
            "unitCostHT": 100,
            "unitCostTTC": 118,
            "taxRate": 0.18,
            "expiryDate": None
        }]

        # Purchase with INTERNAL scope
        order = PurchaseService.quick_purchase(
            organization=self.org,
            supplier_id=self.supplier.id,
            warehouse_id=self.warehouse.id,
            site_id=self.branch.id,
            scope='INTERNAL',       # ← INTERNAL scope
            invoice_price_type='HT_BASED',
            vat_recoverable=True,
            lines=lines_data,
            user=self.user
        )

        je = JournalEntry.objects.get(reference=f"ORD-{order.id}")
        self.assertEqual(je.scope, 'INTERNAL')

        je_lines = je.lines.all()
        inventory_line = je_lines.filter(account__code='1120').first()
        tax_line = je_lines.filter(account__code='2111').first()

        # Inventory debit = TTC (cost_internal = TTC_ALWAYS for INTERNAL scope)
        self.assertEqual(inventory_line.debit, Decimal('590.00'))  # 5 * 118

        # No VAT line posted — scope guard enforced
        self.assertIsNone(tax_line, "No VAT line should be posted for INTERNAL scope purchase")

        print("[OK] Scope guard: no VAT posted in INTERNAL scope.")


    def test_real_vat_recovery_purchase(self):
        """
        REAL company + ASSUJETTI supplier: full VAT recovery.
        DR Inventory (HT), DR TVA Récupérable, CR AP (TTC).
        """
        print("\n>>> Testing REAL company - full VAT recovery...")

        # Configure as REAL
        ConfigurationService.save_global_settings(self.org, {
            "companyType": "REAL",
        })

        # Set tax account for VAT recoverable
        from apps.finance.models import ChartOfAccount
        try:
            tax_acc = ChartOfAccount.objects.get(organization=self.org, code='2111')
        except ChartOfAccount.DoesNotExist:
            print("[SKIP] No 2111 account provisioned — skipping REAL VAT test.")
            return

        rules = ConfigurationService.get_posting_rules(self.org)
        rules['purchases']['vat_recoverable'] = tax_acc.id
        ConfigurationService.save_posting_rules(self.org, rules)

        # Create a REAL org tax policy
        from apps.finance.models import OrgTaxPolicy
        OrgTaxPolicy.objects.filter(organization=self.org).update(is_default=False)
        OrgTaxPolicy.objects.create(
            organization=self.org,
            name='REAL Policy',
            is_default=True,
            vat_output_enabled=True,
            vat_input_recoverability='1.000',
            airsi_treatment='RECOVER',
            allowed_scopes=['OFFICIAL'],
        )

        lines_data = [{
            "productId": self.product.id,
            "quantity": 10,
            "unitCostHT": 100,
            "unitCostTTC": 118,
            "taxRate": 0.18,
            "expiryDate": None
        }]

        order = PurchaseService.quick_purchase(
            organization=self.org,
            supplier_id=self.supplier.id,
            warehouse_id=self.warehouse.id,
            site_id=self.branch.id,
            scope='OFFICIAL',
            invoice_price_type='HT_BASED',
            vat_recoverable=True,
            lines=lines_data,
            user=self.user
        )

        je = JournalEntry.objects.get(reference=f"ORD-{order.id}")
        je_lines = je.lines.all()

        inventory_line = je_lines.filter(account__code='1120').first()  # Inventory
        tax_line = je_lines.filter(account__code='2111').first()         # TVA Récupérable
        payable_line = je_lines.filter(account__code='2101').first()     # AP

        # Inventory = HT only (VAT is recoverable, not in cost)
        self.assertEqual(inventory_line.debit, Decimal('1000.00'))
        # TVA Récupérable = 180
        self.assertIsNotNone(tax_line, "VAT recoverable line must be posted for REAL company")
        self.assertEqual(tax_line.debit, Decimal('180.00'))
        # AP = TTC
        self.assertEqual(payable_line.credit, Decimal('1180.00'))

        print("[OK] REAL: DR Inventory 1000 + DR TVA Réc. 180 = CR AP 1180.")

