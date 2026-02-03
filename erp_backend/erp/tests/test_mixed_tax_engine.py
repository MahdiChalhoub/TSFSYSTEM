from rest_framework.test import APITestCase
from django.utils import timezone
from erp.models import Organization, ChartOfAccount, JournalEntry, Order, OrderLine, FinancialAccount
from erp.services import PurchaseService, ConfigurationService, ProvisioningService, TaxService
from decimal import Decimal
import datetime

class MixedTaxEngineTests(APITestCase):

    def setUp(self):
        self.org = ProvisioningService.provision_organization(name="MixCorp", slug="mix-corp")
        self.client.defaults['HTTP_X_TENANT_ID'] = str(self.org.id)
        
        # Configure as MIXED
        ConfigurationService.save_global_settings(self.org, {
            "companyType": "MIXED",
            "worksInTTC": True,
            "dualView": True
        })
        
        # Ensure Posting Rules
        # Provisioning sets them up, but let's ensure 'tax' account exists
        tax_acc = ChartOfAccount.objects.get(organization=self.org, code='2111')
        rules = ConfigurationService.get_posting_rules(self.org)
        rules['purchases']['tax'] = tax_acc.id
        ConfigurationService.save_posting_rules(self.org, rules)

        from erp.models import Product
        self.product = Product.objects.create(
            organization=self.org,
            name="Test Item",
            sku="TEST-SKU-001",
            selling_price_ht=Decimal('100'),
            tva_rate=Decimal('0.18')
        )
        
        from erp.models import Contact
        self.supplier = Contact.objects.create(
            organization=self.org,
            name="Supplier A",
            type="SUPPLIER"
        )
        
        from erp.models import Warehouse, Site
        self.site = Site.objects.get(organization=self.org, code="MAIN")
        self.warehouse = Warehouse.objects.get(organization=self.org, code="WH01")

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
            site_id=self.site.id,
            scope='OFFICIAL',
            invoice_price_type='HT_BASED',
            vat_recoverable=True, # Instruction: Frontend asks for recoverable, but Backend logic should override
            lines=lines,
            user=None
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
        ol = order.lines.first()
        self.assertEqual(ol.unit_cost_ht, Decimal('100.00'))
        self.assertEqual(ol.vat_amount, Decimal('18.00')) # Per unit
        self.assertEqual(ol.effective_cost, Decimal('118.00')) # Forced to TTC
        print("[OK] OrderLine Metadata preserved.")

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
