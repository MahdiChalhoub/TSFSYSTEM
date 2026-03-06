from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Organization, Site, Role, Permission,
    PlanCategory, SubscriptionPlan, SubscriptionPayment
)

# TransactionSequence lives in the finance module which may not be installed
try:
    from .models import TransactionSequence
    _has_transaction_sequence = True
except ImportError:
    _has_transaction_sequence = False

# User — show organization for tenant isolation visibility
class TenantUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'organization', 'is_staff', 'is_superuser', 'is_active')
    list_filter = ('organization', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')

admin.site.register(User, TenantUserAdmin)

# Core / Tenants
@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'created_at')
    search_fields = ('name', 'slug')

@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active')
    search_fields = ('name', 'code')

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant')
    list_filter = ('tenant',)

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')
    search_fields = ('code', 'name')

if _has_transaction_sequence:
    @admin.register(TransactionSequence)
    class TransactionSequenceAdmin(admin.ModelAdmin):
        list_display = ('type', 'prefix', 'next_number', 'organization')
        list_filter = ('organization', 'type')

# Subscription
@admin.register(PlanCategory)
class PlanCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'country')

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'monthly_price', 'annual_price')
    list_filter = ('category',)

@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(admin.ModelAdmin):
    list_display = ('organization', 'plan', 'amount', 'status', 'created_at')
    list_filter = ('status',)
