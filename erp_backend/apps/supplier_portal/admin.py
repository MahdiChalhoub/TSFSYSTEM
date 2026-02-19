"""
Supplier Portal — Django Admin
"""
from django.contrib import admin
from .models import (
    SupplierPortalAccess, SupplierProforma, ProformaLine,
    PriceChangeRequest, SupplierNotification,
)


class ProformaLineInline(admin.TabularInline):
    model = ProformaLine
    extra = 0
    fields = ('product', 'quantity', 'unit_price', 'tax_rate', 'discount_percent', 'line_total')
    readonly_fields = ('line_total',)


@admin.register(SupplierPortalAccess)
class SupplierPortalAccessAdmin(admin.ModelAdmin):
    list_display = ('contact', 'user', 'status', 'permissions', 'granted_at', 'last_login')
    list_filter = ('status',)
    search_fields = ('contact__name', 'user__email')
    readonly_fields = ('granted_at', 'last_login')


@admin.register(SupplierProforma)
class SupplierProformaAdmin(admin.ModelAdmin):
    list_display = ('proforma_number', 'supplier', 'status', 'total_amount', 'submitted_at', 'created_at')
    list_filter = ('status',)
    search_fields = ('proforma_number', 'supplier__name')
    readonly_fields = ('proforma_number', 'submitted_at', 'reviewed_at', 'created_at', 'updated_at')
    inlines = [ProformaLineInline]


@admin.register(PriceChangeRequest)
class PriceChangeRequestAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'product', 'request_type', 'current_price',
                    'proposed_price', 'status', 'created_at')
    list_filter = ('request_type', 'status')
    search_fields = ('supplier__name', 'product__name')
    readonly_fields = ('reviewed_at', 'created_at', 'updated_at')


@admin.register(SupplierNotification)
class SupplierNotificationAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'notification_type', 'title', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
    search_fields = ('supplier__name', 'title')
    readonly_fields = ('created_at',)
