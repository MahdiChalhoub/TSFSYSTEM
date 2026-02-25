from rest_framework import serializers
from apps.finance.invoice_models import Invoice, InvoiceLine

class InvoiceLineSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    product_name = serializers.ReadOnlyField(source='product.name')
    product_sku = serializers.ReadOnlyField(source='product.sku')
    class Meta:
        model = InvoiceLine
        fields = '__all__'
        read_only_fields = ['organization', 'line_total_ht', 'tax_amount', 'line_total_ttc']

class InvoiceSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    lines = InvoiceLineSerializer(many=True, read_only=True)
    contact_display = serializers.ReadOnlyField(source='contact.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    site_name = serializers.ReadOnlyField(source='site.name')
    line_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    zatca_qr_code_data = serializers.SerializerMethodField()
    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = [
            'organization', 'invoice_number', 'paid_amount', 'balance_due',
            'total_in_functional_currency', 'paid_at',
            'fne_status', 'fne_reference', 'fne_token', 'fne_error', 'fne_raw_response',
            'previous_invoice_hash', 'invoice_hash',
            'zatca_signed_xml', 'zatca_clearance_id',
        ]
    def get_line_count(self, obj):
        return obj.lines.count()
    def get_is_overdue(self, obj):
        if obj.status in ('SENT', 'PARTIAL_PAID') and obj.due_date:
            from django.utils import timezone
            return obj.due_date < timezone.now().date()
        return False
    def get_zatca_qr_code_data(self, obj):
        try:
            if obj.invoice_hash or (obj.fne_status and obj.fne_status != 'NONE'):
                from apps.finance.einvoicing_service import ZATCAService
                service = ZATCAService(str(obj.organization_id))
                return service.generate_qr_code_data(obj)
        except Exception:
            pass
        return None
