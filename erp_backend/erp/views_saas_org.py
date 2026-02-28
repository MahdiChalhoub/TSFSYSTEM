from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.conf import settings
from django.db import models as models
from .models import SystemModule, Organization, OrganizationModule, SystemUpdate
from .module_manager import ModuleManager
from .kernel_manager import KernelManager
import logging

logger = logging.getLogger(__name__)



from .views_saas_org_modules import OrgSaasModulesMixin
from .views_saas_org_billing import OrgSaasBillingMixin
from .views_saas_org_users import OrgSaasUsersMixin
from .views_saas_org_sites import OrgSaasSitesMixin

class OrgModuleViewSet(OrgSaasModulesMixin, OrgSaasBillingMixin, OrgSaasUsersMixin, OrgSaasSitesMixin, viewsets.GenericViewSet):

    """Management of modules for a specific Organization (SaaS View)"""

    permission_classes = [permissions.IsAdminUser]

    # Default feature definitions for modules whose manifests lack a 'features' key
    DEFAULT_FEATURES = {
        'finance': [
            {'code': 'chart_of_accounts', 'name': 'Chart of Accounts'},
            {'code': 'journal_entries', 'name': 'Journal Entries'},
            {'code': 'fiscal_years', 'name': 'Fiscal Years'},
            {'code': 'loans', 'name': 'Loans & Installments'},
            {'code': 'financial_reports', 'name': 'Financial Reports'},
        ],
        'inventory': [
            {'code': 'products', 'name': 'Product Management'},
            {'code': 'warehouses', 'name': 'Warehouses'},
            {'code': 'stock_movements', 'name': 'Stock Movements'},
            {'code': 'brands', 'name': 'Brands & Categories'},
            {'code': 'barcode', 'name': 'Barcode System'},
        ],
        'pos': [
            {'code': 'sales', 'name': 'Sales & Orders'},
            {'code': 'returns', 'name': 'Returns & Refunds'},
            {'code': 'receipts', 'name': 'Receipt Printing'},
            {'code': 'cash_register', 'name': 'Cash Register'},
            {'code': 'pos_terminal', 'name': 'POS Terminal'},
        ],
        'crm': [
            {'code': 'contacts', 'name': 'Contact Management'},
            {'code': 'leads', 'name': 'Leads & Pipelines'},
        ],
        'hr': [
            {'code': 'employees', 'name': 'Employee Management'},
            {'code': 'payroll', 'name': 'Payroll'},
            {'code': 'attendance', 'name': 'Attendance Tracking'},
        ],
        'core': [
            {'code': 'organizations', 'name': 'Organizations'},
            {'code': 'sites', 'name': 'Sites / Locations'},
            {'code': 'users', 'name': 'User Management'},
            {'code': 'roles', 'name': 'Roles & Permissions'},
        ],
        'coreplatform': [
            {'code': 'modules', 'name': 'Module Registry'},
            {'code': 'system_updates', 'name': 'System Updates'},
            {'code': 'platform_settings', 'name': 'Platform Settings'},
        ],
    }
