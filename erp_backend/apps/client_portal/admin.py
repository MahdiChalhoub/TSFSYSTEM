"""
Client Portal — Django Admin
"""
from django.contrib import admin
from .models import (
    ClientPortalConfig, ClientPortalAccess, ClientWallet, WalletTransaction,
    ClientOrder, ClientOrderLine, ClientTicket,
)


class ClientOrderLineInline(admin.TabularInline):
    model = ClientOrderLine
    extra = 0
    fields = ('product', 'product_name', 'quantity', 'unit_price', 'tax_rate', 'line_total')
    readonly_fields = ('line_total', 'tax_amount')


class WalletTransactionInline(admin.TabularInline):
    model = WalletTransaction
    extra = 0
    readonly_fields = ('transaction_type', 'amount', 'balance_after', 'reason', 'created_at')
    can_delete = False


@admin.register(ClientPortalConfig)
class ClientPortalConfigAdmin(admin.ModelAdmin):
    list_display = ('organization', 'loyalty_enabled', 'loyalty_earn_rate',
                    'loyalty_redemption_ratio', 'wallet_currency', 'ecommerce_enabled')
    fieldsets = (
        ('Loyalty', {
            'fields': ('loyalty_enabled', 'loyalty_earn_rate', 'loyalty_redemption_ratio',
                       'loyalty_min_redeem', 'loyalty_max_redeem_percent'),
        }),
        ('Wallet', {
            'fields': ('wallet_enabled', 'wallet_currency', 'wallet_auto_create', 'wallet_max_balance'),
        }),
        ('Delivery', {
            'fields': ('default_delivery_fee', 'free_delivery_threshold'),
        }),
        ('Tickets', {
            'fields': ('tickets_enabled', 'enabled_ticket_types',
                       'auto_assign_tickets', 'default_ticket_assignee'),
        }),
        ('eCommerce', {
            'fields': ('ecommerce_enabled', 'min_order_amount', 'allow_wallet_payment'),
        }),
    )


@admin.register(ClientPortalAccess)
class ClientPortalAccessAdmin(admin.ModelAdmin):
    list_display = ('contact', 'user', 'status', 'barcode', 'granted_at', 'last_login')
    list_filter = ('status',)
    search_fields = ('contact__name', 'user__email', 'barcode')
    readonly_fields = ('granted_at', 'last_login')


@admin.register(ClientWallet)
class ClientWalletAdmin(admin.ModelAdmin):
    list_display = ('contact', 'balance', 'loyalty_points', 'lifetime_points', 'currency', 'is_active')
    search_fields = ('contact__name',)
    readonly_fields = ('balance', 'loyalty_points', 'lifetime_points', 'created_at', 'updated_at')
    inlines = [WalletTransactionInline]


@admin.register(ClientOrder)
class ClientOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'contact', 'status', 'payment_status', 'total_amount', 'placed_at')
    list_filter = ('status', 'payment_status')
    search_fields = ('order_number', 'contact__name')
    readonly_fields = ('order_number', 'placed_at', 'delivered_at', 'created_at', 'updated_at')
    inlines = [ClientOrderLineInline]


@admin.register(ClientTicket)
class ClientTicketAdmin(admin.ModelAdmin):
    list_display = ('ticket_number', 'contact', 'ticket_type', 'status', 'priority', 'created_at')
    list_filter = ('ticket_type', 'status', 'priority')
    search_fields = ('ticket_number', 'contact__name', 'subject')
    readonly_fields = ('ticket_number', 'resolved_at', 'created_at', 'updated_at')
