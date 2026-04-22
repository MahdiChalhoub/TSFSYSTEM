import {
    Box,
    Tag,
    Warehouse,
    ClipboardList,
    Bell,
    FolderTree,
    DollarSign,
    Wrench,
    Sparkles,
} from 'lucide-react';
import type { MenuItem } from './types';

export const inventoryInProgress: MenuItem = {
    title: 'Inventory',
    icon: Box,
    module: 'inventory',
    stage: 'in-progress',
    children: [
        { title: 'Categories', path: '/inventory/categories', icon: FolderTree },
        { title: 'Units & Packaging', path: '/inventory/units', icon: Warehouse },
        { title: 'Packages', path: '/inventory/packages', icon: Box },
        { title: 'Packaging Rules', path: '/inventory/packaging-suggestions', icon: Sparkles },
    ],
};

export const inventory: MenuItem = {
    title: 'Inventory',
    icon: Box,
    module: 'inventory',
    children: [
        {
            title: 'Products',
            icon: Tag,
            children: [
                { title: 'Product Master', path: '/inventory/products' },
                { title: 'Product Analytics', path: '/inventory/analytics' },
                { title: 'Product Explorer', path: '/inventory/product-explorer' },
                { title: 'Combo & Bundles', path: '/inventory/combo' },
                { title: 'Label Printing', path: '/inventory/labels' },
                { title: 'Product Groups', path: '/inventory/product-groups' },
                { title: 'Inventory Groups', path: '/inventory/inventory-groups' },
                { title: 'Inventory Group Members', path: '/inventory/inventory-group-members' },
                { title: 'Parfums', path: '/inventory/parfums' },
                { title: 'Barcodes', path: '/inventory/product-barcodes' },
                { title: 'Product Audit Trail', path: '/inventory/product-audit-trail' },
                { title: 'Product Tasks', path: '/inventory/product-tasks' },
            ],
        },
        {
            title: 'Warehousing',
            icon: Warehouse,
            children: [
                { title: 'Warehouses', path: '/inventory/warehouses' },
                { title: 'Zones', path: '/inventory/zones' },
                { title: 'Aisles', path: '/inventory/aisles' },
                { title: 'Racks', path: '/inventory/racks' },
                { title: 'Shelves', path: '/inventory/shelves' },
                { title: 'Bins', path: '/inventory/bins' },
                { title: 'Product Locations', path: '/inventory/product-locations' },
                { title: 'Global Inventory', path: '/inventory/global' },
                { title: 'Inventory', path: '/inventory/inventory' },
            ],
        },
        {
            title: 'Stock',
            icon: ClipboardList,
            children: [
                { title: 'Stock Adjustments', path: '/inventory/adjustments' },
                { title: 'Adjustment Orders', path: '/inventory/adjustment-orders' },
                { title: 'Stock Count', path: '/inventory/stock-count' },
                { title: 'Counting Sessions', path: '/inventory/counting-sessions' },
                { title: 'Transfer Orders', path: '/inventory/transfer-orders' },
                { title: 'Transfers', path: '/inventory/transfers' },
                { title: 'Stock Moves', path: '/inventory/stock-moves' },
                { title: 'Inventory Movements', path: '/inventory/inventory-movements' },
                { title: 'Stock Valuation', path: '/inventory/valuation' },
                { title: 'Stock Matrix', path: '/inventory/stock-matrix' },
                { title: 'Goods Receipts', path: '/inventory/goods-receipts' },
                { title: 'Internal Consumption', path: '/inventory/internal-consumption' },
                { title: 'Gift & Sample', path: '/inventory/gift-sample' },
                { title: 'Counting Lines', path: '/inventory/counting-lines' },
                { title: 'Operational Requests', path: '/inventory/requests' },
                { title: 'Import Declarations', path: '/procurement/import-declarations' },
            ],
        },
        {
            title: 'Alerts & Intelligence',
            icon: Bell,
            children: [
                { title: 'Inventory Alerts', path: '/inventory/alerts' },
                { title: 'Stock Alerts', path: '/inventory/stock-alerts' },
                { title: 'Low Stock Alerts', path: '/inventory/low-stock' },
                { title: 'Expiry Alerts', path: '/inventory/expiry-alerts' },
                { title: 'Serial Numbers', path: '/inventory/serials' },
                { title: 'Serial Logs', path: '/inventory/serial-logs' },
                { title: 'Intelligence', path: '/inventory/intelligence' },
                { title: 'Readiness', path: '/inventory/readiness' },
            ],
        },
        {
            title: 'Catalog Setup',
            icon: FolderTree,
            children: [
                { title: 'Categories Audit', path: '/inventory/categories/maintenance' },
                { title: 'Category Rules', path: '/inventory/category-rules' },
                { title: 'Packaging', path: '/inventory/packaging' },
                { title: 'Brands', path: '/inventory/brands' },
                { title: 'Countries', path: '/inventory/countries' },
                { title: 'Attributes', path: '/inventory/attributes' },
                { title: 'Fresh Produce', path: '/inventory/fresh' },
                { title: 'Fresh Profiles', path: '/inventory/fresh-profiles' },
            ],
        },
        {
            title: 'Barcode & Labels',
            icon: Tag,
            children: [
                { title: 'Barcode Configuration', path: '/inventory/barcode' },
                { title: 'Barcode Policy', path: '/inventory/barcode-policy' },
                { title: 'Label Policy', path: '/inventory/label-policy' },
                { title: 'Label Records', path: '/inventory/label-records' },
            ],
        },
        {
            title: 'Pricing & Policy',
            icon: DollarSign,
            children: [
                { title: 'Price Governance', path: '/inventory/price-governance' },
                { title: 'Price Change Requests', path: '/inventory/price-change-requests' },
                { title: 'Price Regulations', path: '/inventory/price-regulations' },
                { title: 'Stock Movements', path: '/inventory/movements' },
                { title: 'Weight Policy', path: '/inventory/weight-policy' },
                { title: 'Policies', path: '/inventory/policies' },
                { title: 'Sync', path: '/inventory/sync' },
            ],
        },
        {
            title: 'System Maintenance',
            icon: Wrench,
            children: [
                { title: 'Maintenance Dashboard', path: '/inventory/maintenance' },
                { title: 'Data Quality', path: '/inventory/maintenance/data-quality' },
                { title: 'Listview Settings', path: '/inventory/listview-settings' },
                { title: 'POS Settings', path: '/inventory/pos-settings' },
            ],
        },
    ],
};

export const products: MenuItem = {
    title: 'Products',
    icon: Tag,
    module: 'inventory',
    children: [
        { title: 'Product Master', path: '/products' },
        { title: 'Create Group', path: '/products/create-group' },
    ],
};
