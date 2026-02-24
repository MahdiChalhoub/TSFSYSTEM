"""
Dashboard API Tests
===================
Tests for the DashboardViewSet including the new realtime_kpis endpoint.
"""
from decimal import Decimal
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from erp.models import Organization, User, Site
from apps.inventory.models import Product, Inventory, Warehouse
from apps.crm.models import Contact
from apps.finance.models import FinancialAccount, Transaction, JournalEntry, JournalEntryLine, ChartOfAccount

class DashboardAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Dashboard Org", slug="dash")
        self.site = Site.objects.create(organization=self.org, name="Main", code="MN")
        self.admin = User.objects.create_user(
            username="dashadmin", password="password123", 
            email="admin@dash.com", organization=self.org
        )
        from rest_framework.authtoken.models import Token
        self.token = Token.objects.create(user=self.admin)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)
        
        # Add tenant header (Middleware expects X-Tenant-Id as UUID)
        self.client.defaults['HTTP_X_TENANT_ID'] = str(self.org.id)

    def test_realtime_kpis_smoke(self):
        """realtime_kpis should return 200 and expected structure."""
        # Create some data
        p = Product.objects.create(organization=self.org, name="KPI Product", cost_price=Decimal("10.00"), is_active=True)
        w = Warehouse.objects.create(organization=self.org, name="W1", site=self.site)
        Inventory.objects.create(organization=self.org, product=p, warehouse=w, quantity=5) # Low stock
        
        Contact.objects.create(organization=self.org, name="KPI Customer", type="CUSTOMER")
        
        acc = FinancialAccount.objects.create(organization=self.org, name="KPI AR", type="RECEIVABLE")
        acc.balance = Decimal("1000.00")
        acc.save()

        url = reverse('dashboard-realtime-kpis')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('salesVelocity', data)
        self.assertIn('inventoryHealth', data)
        self.assertIn('engagement', data)
        self.assertIn('financialRunway', data)
        
        # Check specific values
        self.assertEqual(data['inventoryHealth']['lowStockCount'], 1)
        self.assertEqual(data['engagement']['newCustomersThisMonth'], 1)
        self.assertEqual(data['financialRunway']['ar'], 1000.0)

    def test_financial_stats_ar_ap(self):
        """financial_stats should now return real AR/AP values."""
        FinancialAccount.objects.create(organization=self.org, name="AR", type="RECEIVABLE", balance=500).save()
        FinancialAccount.objects.create(organization=self.org, name="AP", type="PAYABLE", balance=200).save()
        
        url = reverse('dashboard-financial-stats')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['totalAR'], 500.0)
        self.assertEqual(response.data['totalAP'], 200.0)
