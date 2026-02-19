"""
Client Portal — Django Admin
"""
from django.contrib import admin
from .models import (
    ClientPortalAccess, ClientWallet, WalletTransaction,
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
