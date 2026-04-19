import {
    Globe,
    Settings,
    Layers,
    ShoppingCart,
    Tag,
    BarChart3,
    Store,
    CreditCard,
    UserCheck,
    Heart,
} from 'lucide-react';
import type { MenuItem } from './types';

export const ecommerce: MenuItem = {
    title: 'eCommerce',
    icon: Globe,
    module: 'ecommerce',
    children: [
        { title: 'Storefront Overview', path: '/ecommerce/dashboard', icon: BarChart3 },
        { title: 'Storefront Settings', path: '/ecommerce/settings', icon: Settings },
        { title: 'Storefront Config', path: '/ecommerce/storefront-config' },
        { title: 'Theme Manager', path: '/ecommerce/themes', icon: Layers },
        { title: 'Online Orders', path: '/ecommerce/orders', icon: ShoppingCart },
        { title: 'Product Catalog', path: '/ecommerce/catalog', icon: Tag },
        { title: 'Catalog Reviews', path: '/ecommerce/catalog/reviews' },
        { title: 'Coupons', path: '/ecommerce/coupons' },
        { title: 'Promotions', path: '/ecommerce/promotions' },
        { title: 'Quotes', path: '/ecommerce/quotes' },
        { title: 'Shipping', path: '/ecommerce/shipping' },
        { title: 'Webhooks', path: '/ecommerce/webhooks' },
    ],
};

export const store: MenuItem = {
    title: 'Store',
    icon: Store,
    module: 'ecommerce',
    children: [
        { title: 'Storefront Home', path: '/store', icon: Globe },
        { title: 'Catalog', path: '/store/catalog', icon: Tag },
        { title: 'Cart', path: '/store/cart', icon: ShoppingCart },
        { title: 'Checkout', path: '/store/checkout', icon: CreditCard },
        { title: 'Account', path: '/store/account', icon: UserCheck },
        { title: 'Wishlist', path: '/store/wishlist', icon: Heart },
        { title: 'Login', path: '/store/login' },
        { title: 'Register', path: '/store/register' },
    ],
};
