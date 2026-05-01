from rest_framework.test import APITestCase
from django.urls import reverse
from erp.models import User, Organization
from apps.finance.invoice_models import Invoice, InvoiceLine
from kernel.lifecycle.constants import LifecycleStatus
from decimal import Decimal
from kernel.tenancy.context import tenant_context

class InvoiceLifecycleTests(APITestCase):
    def setUp(self):
        self.organization, _ = Organization.objects.get_or_create(
            name="Test Org", 
            defaults={'slug': 'test-org'}
        )
        with tenant_context(self.organization):
            self.user, _ = User.objects.get_or_create(
                username="tester", 
                defaults={'is_staff': True, 'is_superuser': True}
            )
            self.user.set_password("password")
            self.user.organization = self.organization
            self.user.save()
            
            from rest_framework.authtoken.models import Token
            self.token, _ = Token.objects.get_or_create(user=self.user)
            self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

            # Seed Fiscal Year and Period
            from apps.finance.models import FiscalYear, FiscalPeriod
            fy, _ = FiscalYear.objects.get_or_create(
                organization=self.organization,
                name='FY2026',
                defaults={'start_date': '2026-01-01', 'end_date': '2026-12-31', 'is_closed': False}
            )
            FiscalPeriod.objects.get_or_create(
                fiscal_year=fy,
                name='P3-2026',
                defaults={'organization': self.organization, 'start_date': '2026-03-01', 'end_date': '2026-03-31', 'status': 'OPEN'}
            )
        
        from apps.finance.models import ChartOfAccount
        from erp.services import ConfigurationService
        with tenant_context(self.organization):
            self.acc_receivable, _ = ChartOfAccount.objects.get_or_create(id=1, defaults={'organization': self.organization, 'name': 'Receivable', 'code': '1200', 'type': 'ASSET'})
            self.acc_income, _ = ChartOfAccount.objects.get_or_create(id=2, defaults={'organization': self.organization, 'name': 'Income', 'code': '4000', 'type': 'REVENUE'})
            self.acc_tax, _ = ChartOfAccount.objects.get_or_create(id=3, defaults={'organization': self.organization, 'name': 'VAT Payable', 'code': '2200', 'type': 'LIABILITY'})

            ConfigurationService.save_posting_rules(self.organization, {
                'sales': {
                    'receivable': self.acc_receivable.id, 
                    'revenue': self.acc_income.id,
                    'income': self.acc_income.id,
                    'vat_collected': self.acc_tax.id,
                    'tax': self.acc_tax.id
                },
                'purchases': {
                    'payable': 4,
                    'inventory': 5,
                    'vat_recoverable': 6,
                    'tax': 6
                }
            })
            
            # Seed Approval Policy for Invoices
            from kernel.lifecycle.models import ApprovalPolicy, ApprovalPolicyStep
            policy, _ = ApprovalPolicy.objects.get_or_create(
                organization=self.organization,
                txn_type='SALES_INVOICE',
                defaults={'min_level_required': 1}
            )
            # Use role_id='ADMIN' and required=True as per model
            ApprovalPolicyStep.objects.get_or_create(policy=policy, level=1, defaults={'role_id': 'ADMIN', 'required': True})

    def test_full_sales_lifecycle(self):
        with tenant_context(self.organization):
            # 1. Create Invoice
            from erp.connector_registry import connector
            Contact = connector.require('crm.contacts.get_model', org_id=self.organization.id)
            if Contact is None:
                self.skipTest("CRM module unavailable")
            contact = Contact.objects.create(organization=self.organization, name="Customer", type="CUSTOMER")
            
            invoice = Invoice.objects.create(
                organization=self.organization,
                contact=contact,
                type='SALES',
                issue_date='2026-03-01',
                status=LifecycleStatus.DRAFT,
                created_by=self.user
            )
            InvoiceLine.objects.create(
                organization=self.organization,
                invoice=invoice,
                description="Item 1",
                quantity=1,
                unit_price=Decimal('100.00'),
                tax_rate=15
            )
            invoice.recalculate_totals()
            
            # 2. Submit
            headers = {'HTTP_X_TENANT_ID': str(self.organization.id)}
            url = f"/api/erp/finance/invoices/{invoice.pk}/submit/"
            print(f"DEBUG: Final Submit URL: {url}")
            response = self.client.post(url, **headers)
            self.assertEqual(response.status_code, 200)
            invoice.refresh_from_db()
            self.assertEqual(invoice.status, LifecycleStatus.SUBMITTED)
            
            # 3. Verify (L1)
            url = f"/api/erp/finance/invoices/{invoice.pk}/verify/"
            response = self.client.post(url, {'level': 1}, **headers)
            self.assertEqual(response.status_code, 200)
            invoice.refresh_from_db()
            self.assertEqual(invoice.status, LifecycleStatus.VERIFIED)
            
            # 4. Approve (L1)
            url = f"/api/erp/finance/invoices/{invoice.pk}/approve/"
            response = self.client.post(url, {'level': 1}, **headers)
            self.assertEqual(response.status_code, 200)
            invoice.refresh_from_db()
            self.assertEqual(invoice.status, LifecycleStatus.APPROVED)
            
            # 5. Post (Generates GL)
            url = f"/api/erp/finance/invoices/{invoice.pk}/post_txn/"
            response = self.client.post(url, **headers)
            print(f"DEBUG: Post response: {getattr(response, 'data', response.content)}")
            self.assertEqual(response.status_code, 200)
            invoice.refresh_from_db()
            self.assertEqual(invoice.status, LifecycleStatus.POSTED)
            self.assertIsNotNone(invoice.journal_entry)
            
            # 6. Verify Journal Entry Lines
            from apps.finance.models import JournalEntryLine
            lines = JournalEntryLine.objects.filter(journal_entry=invoice.journal_entry)
            # Correct double entry for 100 + 15 VAT = 115 Total
            # DR Receivable 115, CR Income 100, CR VAT 15
            self.assertEqual(lines.count(), 3)
