import {
    Users,
    Briefcase,
    Tag,
    Settings,
    Eye,
} from 'lucide-react';
import type { MenuItem } from './types';

export const crm: MenuItem = {
    title: 'CRM',
    icon: Users,
    module: 'crm',
    children: [
        { title: 'CRM Dashboard', path: '/crm/dashboard' },
        { title: 'Contact Center', path: '/crm/contacts' },
        { title: 'Follow-ups', path: '/crm/followups' },
        { title: 'Client Pricing', path: '/crm/pricing', icon: Tag },
        { title: 'Price Groups', path: '/crm/price-groups' },
        { title: 'Price Rules', path: '/crm/price-rules' },
        { title: 'Supplier Performance', path: '/crm/supplier-performance' },
        { title: 'Customer Insights', path: '/crm/insights' },
        {
            title: 'CRM Settings',
            icon: Settings,
            children: [
                { title: 'CRM Settings', path: '/crm/settings' },
                { title: 'Contact Tags', path: '/crm/settings/tags' },
            ],
        },
        {
            title: 'Supplier Gate',
            icon: Briefcase,
            children: [
                { title: 'Supplier Access', path: '/workspace/supplier-access' },
                { title: 'Proforma Review', path: '/workspace/proformas' },
                { title: 'Price Requests', path: '/workspace/price-requests' },
                { title: 'Gate Preview', path: '/crm/supplier-gate-preview', icon: Eye },
            ],
        },
        {
            title: 'Client Gate',
            icon: Users,
            children: [
                { title: 'Portal Config', path: '/workspace/portal-config' },
                { title: 'Client Access', path: '/workspace/client-access' },
                { title: 'Client Orders', path: '/workspace/client-orders' },
                { title: 'Client Tickets', path: '/workspace/client-tickets' },
                { title: 'Quote Inbox', path: '/workspace/quote-inbox' },
                { title: 'Gate Preview', path: '/crm/client-gate-preview', icon: Eye },
            ],
        },
    ],
};

export const clientPortal: MenuItem = {
    title: 'Client Portal',
    icon: Users,
    module: 'crm',
    children: [
        { title: 'Dashboard', path: '/client_portal/dashboard' },
        { title: 'Client Access', path: '/client_portal/client-access' },
        { title: 'Admin Orders', path: '/client_portal/admin-orders' },
        { title: 'My Orders', path: '/client_portal/my-orders' },
        { title: 'Admin Tickets', path: '/client_portal/admin-tickets' },
        { title: 'My Tickets', path: '/client_portal/my-tickets' },
        { title: 'Admin Wallets', path: '/client_portal/admin-wallets' },
        { title: 'My Wallet', path: '/client_portal/my-wallet' },
        { title: 'Coupons', path: '/client_portal/coupons' },
        { title: 'Cart Promotions', path: '/client_portal/cart-promotions' },
        { title: 'Shipping Rates', path: '/client_portal/shipping-rates' },
        { title: 'Quote Requests', path: '/client_portal/quote-requests' },
        { title: 'Order Lines', path: '/client_portal/order-lines' },
        { title: 'Reviews', path: '/client_portal/reviews' },
        { title: 'Wishlist', path: '/client_portal/wishlist' },
        { title: 'Portal Config', path: '/client_portal/config' },
    ],
};

export const supplierPortal: MenuItem = {
    title: 'Supplier Portal',
    icon: Briefcase,
    module: 'crm',
    children: [
        { title: 'Dashboard', path: '/supplier_portal/dashboard' },
        { title: 'Portal Config', path: '/supplier_portal/config' },
        { title: 'Portal Access', path: '/supplier_portal/portal-access' },
        { title: 'Admin Proformas', path: '/supplier_portal/admin-proformas' },
        { title: 'Proforma Lines', path: '/supplier_portal/proforma-lines' },
        { title: 'Admin Price Requests', path: '/supplier_portal/admin-price-requests' },
        { title: 'My Orders', path: '/supplier_portal/my-orders' },
        { title: 'My Stock', path: '/supplier_portal/my-stock' },
        { title: 'My Proformas', path: '/supplier_portal/my-proformas' },
        { title: 'My Price Requests', path: '/supplier_portal/my-price-requests' },
        { title: 'Notifications', path: '/supplier_portal/my-notifications' },
    ],
};
