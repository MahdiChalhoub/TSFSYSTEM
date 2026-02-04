from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Product, ProductGroup, Brand, Category, Parfum, Warehouse, Inventory, InventoryMovement,
    Country, Unit, Contact, Employee, BarcodeSettings,
    PlanCategory, SubscriptionPlan, SubscriptionPayment
)

# User
admin.site.register(User, UserAdmin)

# Core / Tenants
@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    search_fields = ('name', 'slug')

@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'organization', 'city', 'is_active')
    list_filter = ('organization', 'is_active')
    search_fields = ('name', 'code')

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'created_at')
    list_filter = ('organization',)

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'description')
    search_fields = ('code', 'name')

@admin.register(TransactionSequence)
class TransactionSequenceAdmin(admin.ModelAdmin):
    list_display = ('type', 'prefix', 'suffix', 'next_number', 'padding', 'organization')
    list_filter = ('organization', 'type')

# Inventory
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'barcode', 'cost_price', 'selling_price_ttc', 'organization')
    list_filter = ('organization', 'category', 'brand')
    search_fields = ('name', 'sku', 'barcode')

@admin.register(ProductGroup)
class ProductGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'parent', 'organization')

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization')

@admin.register(Parfum)
class ParfumAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'organization')

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'site', 'is_active')

@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('product', 'warehouse', 'quantity')
    list_filter = ('warehouse',)

@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'type', 'quantity', 'warehouse', 'reference')
    list_filter = ('type', 'warehouse')

@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'organization')

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')

# HR / Contacts
@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'type', 'organization')
    list_filter = ('type', 'organization')

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'job_title', 'home_site', 'organization')

@admin.register(BarcodeSettings)
class BarcodeSettingsAdmin(admin.ModelAdmin):
    list_display = ('prefix', 'next_sequence', 'organization')

# Subscription
@admin.register(PlanCategory)
class PlanCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'country')
    list_filter = ('type',)

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'monthly_price', 'annual_price', 'is_active')
    list_filter = ('category', 'is_active')

@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ('organization', 'plan', 'amount', 'billing_cycle', 'status', 'created_at')
    list_filter = ('status', 'billing_cycle')
