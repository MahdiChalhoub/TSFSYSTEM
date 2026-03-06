"""
eCommerce — Models
==================
Proxy models for eCommerce functionality.
The actual tables live in client_portal — these proxies provide
a clean import path under the ecommerce namespace.
"""
from apps.client_portal.models import (
    ClientPortalConfig,
    ClientOrder,
    ClientOrderLine,
)


class StorefrontConfig(ClientPortalConfig):
    """Proxy: eCommerce storefront configuration (backed by client_portal_config table)."""

    class Meta:
        proxy = True
        verbose_name = 'Storefront Configuration'
        verbose_name_plural = 'Storefront Configurations'


class Order(ClientOrder):
    """Proxy: eCommerce order (backed by client_order table)."""

    class Meta:
        proxy = True
        verbose_name = 'eCommerce Order'
        verbose_name_plural = 'eCommerce Orders'


class OrderLine(ClientOrderLine):
    """Proxy: eCommerce order line item (backed by client_order_line table)."""

    class Meta:
        proxy = True
        verbose_name = 'Order Line'
        verbose_name_plural = 'Order Lines'