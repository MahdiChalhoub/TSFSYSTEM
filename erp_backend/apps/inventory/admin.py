"""
Inventory Module Admin Registration
Provides Django Admin access to all inventory models.
"""
from django.contrib import admin
from apps.inventory.models import (
    Product, Unit, Category, Brand, Parfum,
    ProductGroup, Warehouse, Inventory, InventoryMovement
)


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'short_name', 'type', 'organization')
    list_filter = ('type', 'organization')
    search_fields = ('code', 'name')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'short_name', 'parent', 'organization')
    list_filter = ('organization',)
    search_fields = ('name', 'code')
    raw_id_fields = ('parent',)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'organization', 'created_at')
    list_filter = ('organization',)
    search_fields = ('name',)
    filter_horizontal = ('countries', 'categories')


@admin.register(Parfum)
class ParfumAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'organization')
    list_filter = ('organization',)
    search_fields = ('name',)
    filter_horizontal = ('categories',)


@admin.register(ProductGroup)
class ProductGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand', 'parfum', 'category', 'organization')
    list_filter = ('organization', 'brand')
    search_fields = ('name',)
    raw_id_fields = ('brand', 'parfum', 'category')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'brand', 'category', 'cost_price', 'selling_price_ttc', 'status', 'organization')
    list_filter = ('status', 'is_active', 'organization', 'brand', 'category')
    search_fields = ('sku', 'barcode', 'name')
    raw_id_fields = ('category', 'brand', 'unit', 'country', 'parfum', 'product_group', 'size_unit')
    list_editable = ('status',)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'can_sell', 'is_active', 'organization')
    list_filter = ('is_active', 'organization')
    search_fields = ('name', 'code')


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'quantity', 'expiry_date', 'batch_number', 'organization')
    list_filter = ('organization', 'warehouse')
    search_fields = ('product__name', 'product__sku')
    raw_id_fields = ('product', 'warehouse')


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'type', 'quantity', 'cost_price', 'reference', 'created_at')
    list_filter = ('type', 'organization', 'warehouse')
    search_fields = ('product__name', 'reference')
    raw_id_fields = ('product', 'warehouse')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'
