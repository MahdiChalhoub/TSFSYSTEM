"""
Serializers for the Printing Center — sessions, templates, and printer config.
Enterprise-grade with workflow metadata, rich snapshots, and audit fields.
"""
from rest_framework import serializers
from apps.inventory.models import (
    PrintSession, PrintSessionItem, LabelTemplate, PrinterConfig,
)


# ── LabelTemplate ──────────────────────────────────────────────────────────
class LabelTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabelTemplate
        fields = [
            'id', 'name', 'label_type', 'description',
            'html_template', 'css_template', 'variables_schema',
            'version', 'template_schema_version',
            'is_system', 'is_default', 'is_active',
            # Dimensions
            'label_width_mm', 'label_height_mm', 'orientation', 'dpi',
            # Page layout
            'columns', 'rows',
            'gap_horizontal_mm', 'gap_vertical_mm',
            'margin_top_mm', 'margin_right_mm', 'margin_bottom_mm', 'margin_left_mm',
            # Capabilities
            'supports_barcode', 'supports_qr', 'default_font_size', 'preview_image',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_system']


class LabelTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight for list views."""
    class Meta:
        model = LabelTemplate
        fields = [
            'id', 'name', 'label_type', 'description', 'version',
            'is_system', 'is_default', 'is_active',
            'label_width_mm', 'label_height_mm', 'orientation',
            'columns', 'rows',
            'supports_barcode', 'supports_qr',
            'preview_image', 'created_at',
        ]


# ── PrinterConfig ──────────────────────────────────────────────────────────
class PrinterConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrinterConfig
        fields = [
            'id', 'name', 'device_identifier', 'model_name', 'location',
            'printer_type', 'connection_type', 'address',
            # Capabilities
            'dpi', 'paper_width_mm', 'driver_name',
            'supports_pdf', 'supports_zpl', 'supports_epl', 'supports_escpos',
            'supported_label_types', 'default_label_type',
            # State
            'is_default', 'is_active',
            'last_seen_at', 'last_tested_at', 'test_status', 'test_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'last_seen_at', 'test_status', 'test_message']


# ── PrintSessionItem ──────────────────────────────────────────────────────
class PrintSessionItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = PrintSessionItem
        fields = [
            'id', 'product_id', 'quantity',
            # Core snapshot
            'snapshot_name', 'snapshot_sku', 'snapshot_barcode',
            'snapshot_price', 'snapshot_category', 'snapshot_supplier',
            'snapshot_unit', 'snapshot_currency', 'snapshot_product_ref',
            'snapshot_tax_mode',
            # Packaging snapshot
            'snapshot_packaging_name', 'snapshot_packaging_barcode',
            'snapshot_packaging_ratio',
            # Variant/template
            'snapshot_variant_summary', 'snapshot_template_version',
            # Status
            'is_printed', 'printed_at',
        ]
        read_only_fields = [
            'snapshot_name', 'snapshot_sku', 'snapshot_barcode', 'snapshot_price',
            'snapshot_category', 'snapshot_supplier', 'snapshot_unit', 'snapshot_currency',
            'snapshot_product_ref', 'snapshot_tax_mode',
            'snapshot_packaging_name', 'snapshot_packaging_barcode', 'snapshot_packaging_ratio',
            'snapshot_variant_summary', 'snapshot_template_version',
            'printed_at',
        ]


class PrintSessionItemCreateSerializer(serializers.Serializer):
    """Input serializer for adding items to a session."""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)


# ── PrintSession ───────────────────────────────────────────────────────────
class PrintSessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    printer_name = serializers.CharField(source='printer.name', read_only=True, default='')

    class Meta:
        model = PrintSession
        fields = [
            'id', 'session_code', 'title', 'label_type', 'status',
            'trigger', 'source_context', 'output_method', 'copies',
            'is_reprint', 'reprint_mode',
            'total_products', 'total_labels',
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name',
            'template_name', 'printer_name',
            'queued_at', 'started_at', 'completed_at',
            'approved_at', 'cancelled_at',
            'failure_reason',
            'created_at', 'updated_at',
        ]

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        if u:
            return f'{u.first_name} {u.last_name}'.strip() or u.username
        return ''

    def get_created_by_name(self, obj):
        u = obj.created_by
        if u:
            return f'{u.first_name} {u.last_name}'.strip() or u.username
        return ''


class PrintSessionDetailSerializer(serializers.ModelSerializer):
    """Full detail with nested items + workflow metadata."""
    items = PrintSessionItemSerializer(many=True, read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    printer_name = serializers.CharField(source='printer.name', read_only=True, default='')
    original_session_code = serializers.CharField(
        source='original_session.session_code', read_only=True, default='')

    class Meta:
        model = PrintSession
        fields = [
            'id', 'session_code', 'title', 'label_type', 'status',
            'trigger', 'source_context', 'output_method', 'copies',
            # Reprint
            'is_reprint', 'reprint_mode', 'original_session', 'original_session_code',
            # Template & printer
            'template', 'template_name', 'printer', 'printer_name',
            # Assignment & workflow
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'cancelled_by', 'cancelled_by_name', 'cancelled_at',
            # Timestamps
            'queued_at', 'started_at', 'completed_at',
            'failure_reason', 'notes',
            # Output artifacts
            'output_path', 'output_checksum', 'page_count',
            'render_context_hash', 'job_reference',
            # Aggregates
            'total_products', 'total_labels',
            # Items
            'items',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'session_code', 'total_products', 'total_labels',
            'output_checksum', 'render_context_hash',
            'created_at', 'updated_at',
        ]

    def _user_name(self, user):
        if user:
            return f'{user.first_name} {user.last_name}'.strip() or user.username
        return ''

    def get_assigned_to_name(self, obj):
        return self._user_name(obj.assigned_to)

    def get_created_by_name(self, obj):
        return self._user_name(obj.created_by)

    def get_approved_by_name(self, obj):
        return self._user_name(obj.approved_by)

    def get_cancelled_by_name(self, obj):
        return self._user_name(obj.cancelled_by)


class PrintSessionCreateSerializer(serializers.Serializer):
    """Input serializer for creating a session from the queue UI."""
    title = serializers.CharField(required=False, default='', allow_blank=True)
    label_type = serializers.ChoiceField(
        choices=['SHELF', 'BARCODE', 'PACKAGING', 'FRESH', 'CUSTOM'],
        default='SHELF')
    output_method = serializers.ChoiceField(
        choices=['PDF', 'THERMAL', 'BROWSER'], default='PDF')
    source_context = serializers.ChoiceField(
        choices=['PRODUCT_LIST', 'RECEIVING', 'STOCK_COUNT', 'STOCK_TRANSFER',
                 'PACKAGING', 'PRICE_UPDATE', 'BARCODE_GEN', 'SCHEDULER'],
        default='PRODUCT_LIST')
    template_id = serializers.IntegerField(required=False, allow_null=True)
    printer_id = serializers.IntegerField(required=False, allow_null=True)
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)
    copies = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(required=False, default='', allow_blank=True)
    items = PrintSessionItemCreateSerializer(many=True)
