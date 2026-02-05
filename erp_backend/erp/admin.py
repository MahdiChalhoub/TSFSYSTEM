from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Organization, Site, Role, Permission,
    TransactionSequence, 
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
