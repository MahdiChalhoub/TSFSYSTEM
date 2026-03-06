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
    list_display = ('code', 'name', 'short_name', 'type', )
    list_filter = ('type', )
    search_fields = ('code', 'name')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'short_name', 'parent', )
    list_filter = ()
    search_fields = ('name', 'code')
    raw_id_fields = ('parent',)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'created_at')
    list_filter = ()
    search_fields = ('name',)
    filter_horizontal = ('countries', 'categories')


@admin.register(Parfum)
class ParfumAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', )
    list_filter = ()
    search_fields = ('name',)
    filter_horizontal = ('categories',)


@admin.register(ProductGroup)
class ProductGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand', 'parfum', 'category', )
    list_filter = ('brand',)
    search_fields = ('name',)
    raw_id_fields = ('brand', 'parfum', 'category')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'brand', 'category', 'cost_price', 'selling_price_ttc', 'status', )
    list_filter = ('status', 'is_active', 'brand', 'category')
    search_fields = ('sku', 'barcode', 'name')
    raw_id_fields = ('category', 'brand', 'unit', 'country', 'parfum', 'product_group', 'size_unit')
    list_editable = ('status',)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'location_type', 'can_sell', 'is_active', )
    list_filter = ('location_type', 'is_active', )
    search_fields = ('name', 'code')


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'quantity', 'expiry_date', 'batch_number', )
    list_filter = ('warehouse',)
    search_fields = ('product__name', 'product__sku')
    raw_id_fields = ('product', 'warehouse')


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'type', 'quantity', 'cost_price', 'reference', 'created_at')
    list_filter = ('type', 'warehouse')
    search_fields = ('product__name', 'reference')
    raw_id_fields = ('product', 'warehouse')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'
