from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Organization, Site, Role, Permission,
    FiscalYear, FiscalPeriod, FinancialAccount, ChartOfAccount,
    JournalEntry, JournalEntryLine, TransactionSequence, FinancialEvent,
    Product, ProductGroup, Brand, Category, Parfum, Warehouse, Inventory, InventoryMovement,
    Country, Unit, Contact, Employee, Loan, LoanInstallment, BarcodeSettings, Transaction
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

# Finance
@admin.register(FiscalYear)
class FiscalYearAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'is_closed', 'organization')
    list_filter = ('organization', 'is_closed')
    search_fields = ('name',)

@admin.register(FiscalPeriod)
class FiscalPeriodAdmin(admin.ModelAdmin):
    list_display = ('name', 'fiscal_year', 'start_date', 'end_date')
    list_filter = ('fiscal_year',)
    ordering = ('fiscal_year', 'start_date')

@admin.register(ChartOfAccount)
class ChartOfAccountAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'type', 'sub_type', 'organization', 'is_active')
    list_filter = ('organization', 'type', 'is_active')
    search_fields = ('code', 'name')

@admin.register(FinancialAccount)
class FinancialAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'balance', 'site', 'organization')
    list_filter = ('organization', 'site')

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('reference', 'transaction_date', 'description', 'site', 'status')
    list_filter = ('site', 'status', 'transaction_date')
    search_fields = ('reference', 'description')

@admin.register(JournalEntryLine)
class JournalEntryLineAdmin(admin.ModelAdmin):
    list_display = ('journal_entry', 'account', 'debit', 'credit', 'description')

@admin.register(TransactionSequence)
class TransactionSequenceAdmin(admin.ModelAdmin):
    list_display = ('type', 'prefix', 'suffix', 'next_number', 'padding', 'organization')
    list_filter = ('organization', 'type')

@admin.register(FinancialEvent)
class FinancialEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'amount', 'status', 'reference', 'organization')
    list_filter = ('event_type', 'status')

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('reference_id', 'type', 'amount', 'scope', 'created_at')
    list_filter = ('type', 'scope')

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

@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ('contact', 'principal_amount', 'status', 'start_date')
    list_filter = ('status',)

@admin.register(LoanInstallment)
class LoanInstallmentAdmin(admin.ModelAdmin):
    list_display = ('loan', 'due_date', 'total_amount', 'status')

@admin.register(BarcodeSettings)
class BarcodeSettingsAdmin(admin.ModelAdmin):
    list_display = ('prefix', 'next_sequence', 'organization')
