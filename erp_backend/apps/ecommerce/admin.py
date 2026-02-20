from django.contrib import admin
from .models import StorefrontConfig, Order, OrderLine


@admin.register(StorefrontConfig)
class StorefrontConfigAdmin(admin.ModelAdmin):
    list_display = ('organization', 'store_mode', 'storefront_theme', 'ecommerce_enabled')
    list_filter = ('store_mode', 'storefront_theme')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'contact', 'status', 'total', 'placed_at')
    list_filter = ('status',)
    search_fields = ('order_number',)


@admin.register(OrderLine)
class OrderLineAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'unit_price', 'line_total')
