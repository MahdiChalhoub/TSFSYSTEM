"""
ListViewPolicy API — serves SaaS-level column/filter governance to frontend.
"""
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers
from django.db import models
from erp.models_listview_policy import ListViewPolicy


class ListViewPolicySerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True, default='GLOBAL')

    class Meta:
        model = ListViewPolicy
        fields = '__all__'


class ListViewPolicyViewSet(ModelViewSet):
    serializer_class = ListViewPolicySerializer
    queryset = ListViewPolicy.objects.select_related('organization', 'created_by').all()

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, 'organization', None)

        # SaaS admins see all policies
        if getattr(self.request, 'is_saas_context', False):
            return qs

        # Normal org users: only see policies affecting their org
        if org:
            return qs.filter(
                models.Q(organization=org) | models.Q(organization__isnull=True),
                is_active=True,
            )
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='resolve/(?P<view_key>[\\w_*]+)')
    def resolve(self, request, view_key=None):
        """
        GET /api/listview-policies/resolve/<view_key>/
        Returns the effective merged policy for the current organization.
        Used by frontend useListViewSettings hook.
        """
        org = getattr(request, 'organization', None)
        org_id = org.id if org else None
        policy = ListViewPolicy.get_effective_policy(org_id, view_key)
        return Response(policy)

    @action(detail=False, methods=['get'], url_path='resolve-bulk')
    def resolve_bulk(self, request):
        """
        GET /api/listview-policies/resolve-bulk/?keys=inventory_products,crm_contacts
        Returns policies for multiple view keys at once.
        """
        keys = request.query_params.get('keys', '').split(',')
        keys = [k.strip() for k in keys if k.strip()]
        org = getattr(request, 'organization', None)
        org_id = org.id if org else None

        result = {}
        for key in keys:
            result[key] = ListViewPolicy.get_effective_policy(org_id, key)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='model-fields/(?P<model_key>[\\w_]+)')
    def model_fields(self, request, model_key=None):
        """
        GET /api/listview-policies/model-fields/<model_key>/
        Returns all field names + labels for a Django model, so the frontend
        can render toggle switches for column/filter governance.
        """
        from django.apps import apps

        MODEL_MAP = {
            'inventory_products': ('inventory', 'Product'),
            'inventory_movements': ('inventory', 'InventoryMovement'),
            'inventory_transfers': ('inventory', 'StockTransfer'),
            'inventory_warehouses': ('inventory', 'Warehouse'),
            'inventory_categories': ('inventory', 'Category'),
            'inventory_brands': ('inventory', 'Brand'),
            'inventory_units': ('inventory', 'Unit'),
            'crm_contacts': ('crm', 'Contact'),
            'finance_ledger': ('finance', 'JournalEntry'),
            'finance_invoices': ('finance', 'Invoice'),
            'finance_payments': ('finance', 'Payment'),
            'finance_vouchers': ('finance', 'Voucher'),
            'finance_expenses': ('finance', 'Expense'),
            'finance_assets': ('finance', 'Asset'),
            'finance_loans': ('finance', 'Loan'),
            'pos_orders': ('pos', 'Order'),
            'pos_tickets': ('pos', 'Order'),
            'hr_employees': ('hr', 'Employee'),
            'hr_attendance': ('hr', 'Attendance'),
            'sales_quotations': ('pos', 'Quotation'),
            'purchases_orders': ('pos', 'PurchaseOrder'),
            'ecommerce_orders': ('ecommerce', 'StoreOrder'),
        }

        if model_key not in MODEL_MAP:
            return Response({'error': f'Unknown model key: {model_key}', 'available': list(MODEL_MAP.keys())}, status=400)

        app_label, model_name = MODEL_MAP[model_key]
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            return Response({'error': f'Model {app_label}.{model_name} not found'}, status=404)

        fields = []
        for f in Model._meta.get_fields():
            if not hasattr(f, 'verbose_name'):
                continue
            field_type = type(f).__name__
            # Skip internal fields
            if f.name in ('organization', 'organization_id', 'id'):
                continue
            fields.append({
                'key': f.name,
                'label': str(f.verbose_name).title(),
                'type': field_type,
                'is_relation': field_type in ('ForeignKey', 'OneToOneField', 'ManyToManyField'),
            })

        return Response({
            'model_key': model_key,
            'model_name': model_name,
            'app_label': app_label,
            'fields': sorted(fields, key=lambda x: x['key']),
            'total': len(fields),
        })

    @action(detail=False, methods=['get'], url_path='available-models')
    def available_models(self, request):
        """Returns the list of model keys that can be queried for fields."""
        MODEL_MAP = {
            'inventory_products': 'Products',
            'inventory_movements': 'Stock Movements',
            'inventory_transfers': 'Stock Transfers',
            'inventory_warehouses': 'Warehouses',
            'inventory_categories': 'Categories',
            'inventory_brands': 'Brands',
            'inventory_units': 'Units',
            'crm_contacts': 'CRM Contacts',
            'finance_ledger': 'Journal Entries',
            'finance_invoices': 'Invoices',
            'finance_payments': 'Payments',
            'finance_vouchers': 'Vouchers',
            'finance_expenses': 'Expenses',
            'finance_assets': 'Assets',
            'finance_loans': 'Loans',
            'pos_orders': 'POS Orders',
            'pos_tickets': 'POS Tickets',
            'hr_employees': 'Employees',
            'hr_attendance': 'Attendance',
            'sales_quotations': 'Quotations',
            'purchases_orders': 'Purchase Orders',
            'ecommerce_orders': 'eCommerce Orders',
        }
        return Response([
            {'key': k, 'label': v} for k, v in sorted(MODEL_MAP.items(), key=lambda x: x[1])
        ])
