'use client';

import { useAdmin } from '@/context/AdminContext';
import { SidebarDynamicItem } from "@/types/erp";
import {
    ShoppingBag,
    Box,
    Users,
    Briefcase,
    FileText,
    ShieldCheck,
    ChevronRight,
    LayoutDashboard,
    Settings,
    LogOut,
    ShoppingCart,
    Layers,
    BarChart3,
    Zap,
    Package,
    CreditCard,
    Bot,
    Cloud,
    Wrench,
    BookOpen,
    TrendingUp,
    Calendar,
    DollarSign,
    Bell,
    Tag,
    Warehouse,
    FolderTree,
    ServerCog,
    Building2,
    Shield,
    ClipboardList,
    ScrollText,
    Wallet,
    Globe,
    ListChecks,
    Trophy,
    Eye,
    Truck,
    Network,
    UserCheck,
    GitBranch,
    Sparkles,
    MessageSquare,
    Database,
    Store,
    Star,
    Archive,
    Target,
    Map,
    Receipt,
    Percent,
    PanelLeft,
    Rows3,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

import { logoutAction } from "@/app/actions/auth";
import { PLATFORM_CONFIG } from '@/lib/saas_config';
import { useFavorites } from '@/context/FavoritesContext';

import { getSaaSModules, getDynamicSidebar } from "@/app/actions/saas/modules";

const ICON_MAP: Record<string, any> = {
    LayoutDashboard,
    ShoppingBag,
    Box,
    Users,
    Briefcase,
    FileText,
    ShieldCheck,
    Settings,
    Zap,
    Layers,
    BarChart3,
    ShoppingCart,
    Package,
    CreditCard,
    Bot,
    Sparkles,
    Cloud,
    MessageSquare,
    Wrench,
    BookOpen,
    TrendingUp,
    Calendar,
    DollarSign,
    Bell,
    Tag,
    Warehouse,
    FolderTree,
    ServerCog,
    Building2,
    Shield,
    ClipboardList,
    ScrollText,
    Wallet,
    Globe,
    ListChecks,
    Trophy,
    Eye,
    Truck,
    Network,
    Database,
    UserCheck,
    Store,
    GitBranch,
    Archive,
    Target,
    Map,
    Receipt,
    Percent
};

function getIcon(name: string) {
    return ICON_MAP[name] || Box;
}

// ─── Tree-Structured Menu ────────────────────────────────────────
// Module → Feature Group → Page
export const MENU_ITEMS = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        module: 'core'
    },
    // ── PRODUCTION-READY MODULES ─────────────────────────────────
    {
        title: 'Finance',
        icon: FileText,
        module: 'finance',
        stage: 'production',
        children: [
            {
                title: 'Settings',
                icon: Settings,
                children: [
                    { title: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
                    { title: 'COA Templates', path: '/finance/chart-of-accounts/templates' },
                ]
            },
        ]
    },
    {
        title: 'Commercial',
        icon: ShoppingBag,
        module: 'pos',
        children: [
            {
                title: 'Point of Sale',
                icon: ShoppingCart,
                children: [
                    { title: 'POS Terminal', path: '/sales' },
                    { title: 'POS Registers', path: '/sales/registers' },
                    { title: 'POS Tickets', path: '/pos/pos-tickets' },
                    { title: 'Order History', path: '/sales/history' },
                    { title: 'Sales Orders', path: '/sales/orders' },
                    { title: 'Sales Analytics', path: '/sales/analytics' },
                    { title: 'Sales Summary', path: '/sales/summary' },
                    { title: 'POS Sessions', path: '/sales/sessions' },
                    { title: 'Quotations', path: '/sales/quotations' },
                    { title: 'Deliveries', path: '/sales/deliveries' },
                    { title: 'Discount Rules', path: '/sales/discounts' },
                    { title: 'Consignment', path: '/sales/consignment' },
                    { title: 'Consignment Settlements', path: '/sales/consignment-settlements' },
                    { title: 'Delivery Zones', path: '/sales/delivery-zones' },
                    { title: 'Sales Returns', path: '/sales/returns' },
                    { title: 'Credit Notes', path: '/sales/credit-notes' },
                    { title: 'Drivers', path: '/sales/drivers' },
                    { title: 'Import Sales', path: '/sales/import' },
                    { title: 'Sales Audit', path: '/sales/audit' },
                    { title: 'Supermarché', path: '/sales/supermarche' },
                ]
            },
            {
                title: 'POS Settings & Audit',
                icon: Package,
                children: [
                    { title: 'POS Settings', path: '/sales/pos-settings' },
                    { title: 'POS Terminal (Alt)', path: '/pos/pos' },
                    { title: 'POS Registers', path: '/pos/pos-registers' },
                    { title: 'POS Settings (Alt)', path: '/pos/pos-settings' },
                    { title: 'POS Orders', path: '/pos/orders' },
                    { title: 'POS Deliveries', path: '/pos/deliveries' },
                    { title: 'POS Delivery Zones', path: '/pos/delivery-zones' },
                    { title: 'POS Discount Rules', path: '/pos/discount-rules' },
                    { title: 'POS Quotations', path: '/pos/quotations' },
                    { title: 'POS Consignment', path: '/pos/consignment-settlements' },
                    { title: 'POS Sales Returns', path: '/pos/sales-returns' },
                    { title: 'POS Credit Notes', path: '/pos/credit-notes' },
                    { title: 'POS Purchase', path: '/pos/purchase' },
                    { title: 'POS Purchase Returns', path: '/pos/purchase-returns' },
                    { title: 'Supplier Package Prices', path: '/pos/supplier-package-prices' },
                    { title: 'POS Audit Events', path: '/pos/pos-audit-events' },
                    { title: 'POS Audit Rules', path: '/pos/pos-audit-rules' },
                    { title: 'Supplier Pricing', path: '/pos/supplier-pricing' },
                    { title: 'Sourcing', path: '/pos/sourcing' },
                    { title: 'Purchase Orders', path: '/pos/purchase-orders' },
                    { title: 'PO Lines', path: '/pos/po-lines' },
                    { title: 'Address Book', path: '/pos/manager-address-book' },
                ]
            },
            {
                title: 'Purchasing',
                icon: Wallet,
                children: [
                    { title: 'Procurement Center', path: '/purchases' },
                    { title: 'Purchase Dashboard', path: '/purchases/dashboard' },
                    { title: 'New RFQ / Order', path: '/purchases/new-order' },
                    { title: 'New Order v2', path: '/purchases/new-order-v2' },
                    { title: 'Quick Purchase', path: '/purchases/new' },
                    { title: 'Purchase Orders', path: '/purchases/purchase-orders' },
                    { title: 'Quotations', path: '/purchases/quotations' },
                    { title: 'Receiving', path: '/purchases/receiving' },
                    { title: 'Receipts', path: '/purchases/receipts' },
                    { title: 'Invoicing', path: '/purchases/invoicing' },
                    { title: 'Invoice Verification', path: '/purchases/invoice-verification' },
                    { title: 'Consignments', path: '/purchases/consignments' },
                    { title: 'Approvals', path: '/purchases/approvals' },
                    { title: 'Purchase Returns', path: '/purchases/returns' },
                    { title: 'Credit Notes', path: '/purchases/credit-notes' },
                    { title: 'Supplier Sourcing', path: '/purchases/sourcing' },
                    { title: 'Invoices', path: '/purchases/invoices' },
                    { title: 'Verification', path: '/purchases/verification' },
                ]
            },
        ]
    },
    {
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
                ]
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
                ]
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
                ]
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
                ]
            },
            {
                title: 'Catalog Setup',
                icon: FolderTree,
                children: [
                    { title: 'Categories', path: '/inventory/categories' },
                    { title: 'Categories Audit', path: '/inventory/categories/maintenance' },
                    { title: 'Category Rules', path: '/inventory/category-rules' },
                    { title: 'Units & Packaging', path: '/inventory/units' },
                    { title: 'Packaging', path: '/inventory/packaging' },
                    { title: 'Brands', path: '/inventory/brands' },
                    { title: 'Countries', path: '/inventory/countries' },
                    { title: 'Attributes', path: '/inventory/attributes' },
                    { title: 'Fresh Produce', path: '/inventory/fresh' },
                    { title: 'Fresh Profiles', path: '/inventory/fresh-profiles' },
                ]
            },
            {
                title: 'Barcode & Labels',
                icon: Tag,
                children: [
                    { title: 'Barcode Configuration', path: '/inventory/barcode' },
                    { title: 'Barcode Policy', path: '/inventory/barcode-policy' },
                    { title: 'Label Policy', path: '/inventory/label-policy' },
                    { title: 'Label Records', path: '/inventory/label-records' },
                ]
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
                ]
            },
            {
                title: 'System Maintenance',
                icon: Wrench,
                children: [
                    { title: 'Maintenance Dashboard', path: '/inventory/maintenance' },
                    { title: 'Data Quality', path: '/inventory/maintenance/data-quality' },
                    { title: 'Listview Settings', path: '/inventory/listview-settings' },
                    { title: 'POS Settings', path: '/inventory/pos-settings' },
                ]
            },
        ]
    },
    {
        title: 'Finance',
        icon: FileText,
        module: 'finance',
        children: [
            { title: 'Performance Dashboard', path: '/finance/dashboard', icon: BarChart3 },
            { title: 'Financial Setup', path: '/finance/setup', icon: Settings },
            {
                title: 'Accounts & Ledger',
                icon: BookOpen,
                children: [
                    { title: 'Accounts & Drawers', path: '/finance/accounts' },
                    { title: 'Account Categories', path: '/finance/account-categories' },
                    { title: 'Account Book', path: '/finance/account-book' },
                    { title: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
                    { title: 'COA Templates', path: '/finance/chart-of-accounts/templates' },
                    { title: 'Migration Tool', path: '/finance/chart-of-accounts/migrate' },
                    { title: 'COA Management', path: '/finance/coa' },
                    { title: 'General Ledger', path: '/finance/ledger' },
                    { title: 'Opening Balances', path: '/finance/ledger/opening' },
                    { title: 'Opening Balance List', path: '/finance/ledger/opening/list' },
                    { title: 'CSV Import', path: '/finance/ledger/import' },
                    { title: 'Journal Entries', path: '/finance/journal' },
                    { title: 'Sequences', path: '/finance/sequences' },
                ]
            },
            {
                title: 'Balances',
                icon: Wallet,
                children: [
                    { title: 'Balances Overview', path: '/finance/balances' },
                    { title: 'Customer Balances', path: '/finance/customer-balances' },
                    { title: 'Supplier Balances', path: '/finance/supplier-balances' },
                ]
            },
            {
                title: 'Operations',
                icon: ClipboardList,
                children: [
                    { title: 'Invoices', path: '/finance/invoices' },
                    { title: 'Invoice Lines', path: '/finance/invoice-lines' },
                    { title: 'Payments', path: '/finance/payments' },
                    { title: 'Payment Allocations', path: '/finance/payment-allocations' },
                    { title: 'Payment Approvals', path: '/finance/payment-approvals' },
                    { title: 'Vouchers', path: '/finance/vouchers' },
                    { title: 'Expenses', path: '/finance/expenses' },
                    { title: 'Expense Approvals', path: '/finance/expense-approvals' },
                    { title: 'Deferred Expenses', path: '/finance/deferred-expenses' },
                    { title: 'Assets & Depreciation', path: '/finance/assets' },
                    { title: 'Purchase Returns', path: '/finance/purchase-returns' },
                    { title: 'Sales Returns', path: '/finance/sales-returns' },
                    { title: 'Financial Events', path: '/finance/financial-events' },
                ]
            },
            {
                title: 'Tax & Compliance',
                icon: ShieldCheck,
                children: [
                    { title: 'Tax Groups', path: '/finance/tax-groups' },
                    { title: 'Tax Policy', path: '/finance/tax-policy' },
                    { title: 'Org Tax Policies', path: '/finance/org-tax-policies' },
                    { title: 'Custom Tax Rules', path: '/finance/custom-tax-rules' },
                    { title: 'Counterparty Tax Profiles', path: '/finance/counterparty-tax-profiles' },
                    { title: 'Withholding Tax Rules', path: '/finance/withholding-tax-rules' },
                    { title: 'VAT Return', path: '/finance/vat-return' },
                    { title: 'VAT Settlement', path: '/finance/vat-settlement' },
                    { title: 'VAT Rate History', path: '/finance/vat-rate-history' },
                    { title: 'Periodic Tax', path: '/finance/periodic-tax' },
                    { title: 'Advance Payment VAT', path: '/finance/advance-payment-vat' },
                    { title: 'Bad Debt VAT Claims', path: '/finance/bad-debt-vat-claims' },
                    { title: 'Credit Note VAT', path: '/finance/credit-note-vat' },
                    { title: 'Gift & Sample VAT', path: '/finance/gift-sample-vat' },
                    { title: 'Intra-Branch VAT', path: '/finance/intra-branch-vat' },
                    { title: 'Reverse Charge', path: '/finance/reverse-charge' },
                    { title: 'Self-Supply VAT', path: '/finance/self-supply-vat' },
                    { title: 'Margin Scheme', path: '/finance/margin-scheme' },
                    { title: 'Import Declarations', path: '/finance/import-declarations' },
                    { title: 'E-Invoicing', path: '/finance/einvoicing' },
                    { title: 'E-Invoice', path: '/finance/einvoice' },
                ]
            },
            {
                title: 'Reports',
                icon: TrendingUp,
                children: [
                    { title: 'Reports Dashboard', path: '/finance/reports/dashboard' },
                    { title: 'Report Builder', path: '/finance/reports/builder' },
                    { title: 'All Reports', path: '/finance/reports' },
                    { title: 'Account Statement', path: '/finance/reports/statement' },
                    { title: 'Trial Balance', path: '/finance/reports/trial-balance' },
                    { title: 'Profit & Loss', path: '/finance/reports/pnl' },
                    { title: 'Balance Sheet', path: '/finance/reports/balance-sheet' },
                    { title: 'Cash Flow', path: '/finance/reports/cash-flow' },
                    { title: 'Aging Report', path: '/finance/reports/aging' },
                    { title: 'Aging Overview', path: '/finance/aging' },
                    { title: 'Audit Trail', path: '/finance/audit-trail' },
                    { title: 'Cash Register', path: '/finance/cash-register' },
                    { title: 'Bank Reconciliation', path: '/finance/bank-reconciliation' },
                    { title: 'Reconciliation Sessions', path: '/finance/reconciliation-sessions' },
                    { title: 'Bank Statements', path: '/finance/bank-statements' },
                    { title: 'Period Statements', path: '/finance/statements' },
                    { title: 'Tax Reports', path: '/finance/tax-reports' },
                    { title: 'Revenue Breakdown', path: '/finance/revenue' },
                    { title: 'Audit', path: '/finance/audit' },
                    { title: 'Audit Logs', path: '/finance/audit-logs' },
                ]
            },
            {
                title: 'Budget & Planning',
                icon: BarChart3,
                children: [
                    { title: 'Budgets', path: '/finance/budgets' },
                    { title: 'Budget Alerts', path: '/finance/budgets/alerts' },
                    { title: 'Budget Lines', path: '/finance/budget-lines' },
                    { title: 'Budget Overview', path: '/finance/budget' },
                    { title: 'Profit Centers', path: '/finance/profit-centers' },
                    { title: 'Profit Distribution', path: '/finance/profit-distribution' },
                ]
            },
            {
                title: 'Fiscal & Periods',
                icon: Calendar,
                children: [
                    { title: 'Fiscal Years', path: '/finance/fiscal-years' },
                    { title: 'Fiscal Periods', path: '/finance/fiscal-periods' },
                ]
            },
            {
                title: 'Loans & Gateway',
                icon: DollarSign,
                children: [
                    { title: 'Loan Contracts', path: '/finance/loans' },
                    { title: 'Pricing Engine', path: '/finance/pricing' },
                    { title: 'Payment Gateway', path: '/finance/gateway' },
                    { title: 'Gateway Configs', path: '/finance/gateway-configs' },
                ]
            },
            {
                title: 'Events & Automation',
                icon: Bell,
                children: [
                    { title: 'Financial Events', path: '/finance/events' },
                    { title: 'Posting Rules', path: '/finance/settings/posting-rules' },
                ]
            },
            {
                title: 'Finance Settings',
                icon: Settings,
                children: [
                    { title: 'General Settings', path: '/finance/settings' },
                    { title: 'Payment Methods', path: '/finance/settings/payment-methods' },
                    { title: 'Barcode Settings', path: '/finance/settings/barcode' },
                    { title: 'Form Definitions', path: '/finance/settings/form-definitions' },
                ]
            },
        ]
    },
    {
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
                ]
            },
            {
                title: 'Supplier Gate',
                icon: Briefcase,
                children: [
                    { title: 'Supplier Access', path: '/workspace/supplier-access' },
                    { title: 'Proforma Review', path: '/workspace/proformas' },
                    { title: 'Price Requests', path: '/workspace/price-requests' },
                    { title: 'Gate Preview', path: '/crm/supplier-gate-preview', icon: Eye },
                ]
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
                ]
            },
        ]
    },
    {
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
        ]
    },
    {
        title: 'HR & Teams',
        icon: ShieldCheck,
        module: 'hr',
        children: [
            { title: 'HR Overview', path: '/hr/overview' },
            { title: 'Employee Manager', path: '/hr/employees' },
            { title: 'Departments', path: '/hr/departments' },
            { title: 'Shifts', path: '/hr/shifts' },
            { title: 'Attendance', path: '/hr/attendance' },
            { title: 'Leave Requests', path: '/hr/leaves' },
            { title: 'Payroll Summary', path: '/hr/payroll' },
            { title: 'Pending Approvals', path: '/users/approvals' },
        ]
    },
    {
        title: 'Workspace',
        icon: ClipboardList,
        module: 'workspace',
        children: [
            { title: 'TaskBoard', path: '/workspace/tasks', icon: ClipboardList },
            { title: 'Checklists', path: '/workspace/checklists', icon: ListChecks },
            { title: 'Checklist Templates', path: '/workspace/checklist-templates' },
            { title: 'Performance', path: '/workspace/performance', icon: Trophy },
            { title: 'Evaluations', path: '/workspace/evaluations' },
            { title: 'KPI Config', path: '/workspace/kpi-config' },
            { title: 'Scores', path: '/workspace/scores' },
            { title: 'Tenders', path: '/workspace/tenders' },
            { title: 'Requests', path: '/workspace/requests' },
            { title: 'Checklist Items', path: '/workspace/checklist-items' },
            { title: 'Comments', path: '/workspace/comments' },
            { title: 'Client Portal', path: '/workspace/client-portal' },
            { title: 'Supplier Portal', path: '/workspace/supplier-portal' },
            {
                title: 'Automation',
                icon: Zap,
                children: [
                    { title: 'Auto Rules', path: '/workspace/auto-rules' },
                    { title: 'Auto Task Rules', path: '/workspace/auto-task-rules' },
                    { title: 'Auto Task Settings', path: '/workspace/auto-task-settings' },
                    { title: 'WISE Console', path: '/workspace/wise-console' },
                    { title: 'WISE Rules', path: '/workspace/wise-rules' },
                    { title: 'WISE Adjustments', path: '/workspace/wise-adjustments' },
                ]
            },
            {
                title: 'Config',
                icon: Settings,
                children: [
                    { title: 'Workspace Config', path: '/workspace/config' },
                    { title: 'Categories', path: '/workspace/categories' },
                    { title: 'Templates', path: '/workspace/templates' },
                    { title: 'Questionnaires', path: '/workspace/questionnaires' },
                    { title: 'Questions', path: '/workspace/questions' },
                ]
            },
        ]
    },
    {
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
        ]
    },
    {
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
        ]
    },
    {
        title: 'Import & Migration',
        icon: GitBranch,
        children: [
            { title: 'Migration Overview', path: '/migration' },
            { title: 'Migration Audit', path: '/migration/audit' },
            { title: 'Migration Jobs', path: '/migration/jobs' },
            { title: 'Migration v2', path: '/migration_v2' },
            { title: 'Migration v2 Jobs', path: '/migration_v2/jobs' },
        ]
    },
    {
        title: 'SaaS Control',
        icon: ShieldCheck,
        visibility: 'saas',
        children: [
            { title: 'SaaS Home', path: '/saas-home', icon: Globe },
            { title: 'SaaS Dashboard', path: '/dashboard', icon: BarChart3 },
            {
                title: 'Organizations',
                icon: Building2,
                children: [
                    { title: 'Organizations', path: '/organizations' },
                    { title: 'Registrations', path: '/organizations/registrations' },
                    { title: 'Instance Switcher', path: '/switcher' },
                    { title: 'Subscription Plans', path: '/subscription-plans' },
                ]
            },
            {
                title: 'Reference Data',
                icon: Globe,
                children: [
                    { title: 'Countries & Regions', path: '/countries' },
                    { title: 'Currencies', path: '/currencies' },
                    { title: 'Country Tax Templates', path: '/country-tax-templates' },
                    { title: 'E-Invoice Standards', path: '/e-invoice-standards' },
                    { title: 'Listview Policies', path: '/listview-policies' },
                ]
            },
            {
                title: 'Infrastructure',
                icon: Shield,
                children: [
                    { title: 'Platform Health', path: '/health' },
                    { title: 'Kernel Manager', path: '/kernel' },
                    { title: 'Kernel Updates', path: '/updates' },
                    { title: 'Global Registry', path: '/modules' },
                    { title: 'AES-256 Encryption', path: '/encryption' },
                    {
                        title: 'Connector',
                        icon: ServerCog,
                        children: [
                            { title: 'Connector Control', path: '/connector' },
                            { title: 'Connector Buffer', path: '/connector/buffer' },
                            { title: 'Connector Logs', path: '/connector/logs' },
                            { title: 'Connector Policies', path: '/connector/policies' },
                        ]
                    },
                ]
            },
            {
                title: 'AI & Automation',
                icon: Bot,
                children: [
                    { title: 'MCP Dashboard', path: '/mcp' },
                    { title: 'MCP Chat', path: '/mcp/chat' },
                    { title: 'Conversations', path: '/mcp/conversations' },
                    { title: 'Agents', path: '/mcp/agents' },
                    { title: 'Agent Logs', path: '/mcp/agent-logs' },
                    { title: 'Providers', path: '/mcp/providers' },
                    { title: 'Tools', path: '/mcp/tools' },
                    { title: 'Usage', path: '/mcp/usage' },
                    { title: 'MCP Settings', path: '/mcp/settings' },
                ]
            },
            {
                title: 'Developer',
                icon: Wrench,
                children: [
                    { title: 'Theme Demo', path: '/theme-demo' },
                    { title: 'UI Kit', path: '/ui-kit' },
                ]
            },
        ]
    },
    {
        title: 'Users & Access',
        icon: UserCheck,
        module: 'core',
        children: [
            { title: 'Users', path: '/users' },
            { title: 'All Users', path: '/access/users' },
            { title: 'Access Roles', path: '/access/roles' },
            { title: 'Client Access', path: '/access/client-access' },
            { title: 'Supplier Access', path: '/access/supplier-access' },
            { title: 'Supplier Dashboard', path: '/access/supplier-dashboard' },
            { title: 'Approvals', path: '/approvals' },
            { title: 'Access Approvals', path: '/access/approvals' },
        ]
    },
    {
        title: 'System Settings',
        icon: Settings,
        module: 'core',
        children: [
            { title: 'Cloud Storage', path: '/storage', icon: Cloud },
            { title: 'Storage Files', path: '/storage/files' },
            { title: 'Storage Packages', path: '/storage/packages' },
            { title: 'Sites & Branches', path: '/settings/sites', visibility: 'saas' },
            { title: 'Roles & Permissions', path: '/settings/roles' },
            { title: 'Security Settings', path: '/settings/security', icon: Shield },
            { title: 'Notifications', path: '/settings/notifications', icon: Bell },
            { title: 'Billing & Subscription', path: '/subscription', icon: CreditCard },
            { title: 'Appearance', path: '/settings/appearance' },
            { title: 'Domains', path: '/settings/domains' },
            { title: 'E-Invoicing Monitor', path: '/settings/e-invoicing' },
            { title: 'E-Invoicing Live Monitor', path: '/settings/e-invoicing/monitor' },
            { title: 'Features', path: '/settings/features' },
            { title: 'Payment Terms', path: '/settings/payment-terms' },
            { title: 'POS Settings', path: '/settings/pos-settings' },
            { title: 'Purchase Analytics', path: '/settings/purchase-analytics' },
            { title: 'Regional Settings', path: '/settings/regional' },
            { title: 'Sequences', path: '/settings/sequences' },
            { title: 'WhatsApp', path: '/settings/whatsapp' },
            {
                title: 'Integrations',
                icon: Network,
                children: [
                    { title: 'Webhooks', path: '/integrations/webhooks' },
                ]
            },
        ]
    },
    {
        title: 'Products',
        icon: Tag,
        module: 'inventory',
        children: [
            { title: 'Product Master', path: '/products' },
            { title: 'Create Group', path: '/products/create-group' },
        ]
    },
    { title: 'Marketplace', icon: ShoppingBag, path: '/marketplace', module: 'core' },
    { title: 'Platform Dashboard', icon: LayoutDashboard, path: '/platform-dashboard', module: 'core' },
    { title: 'AI Agents', icon: Bot, path: '/agents', module: 'core' },
    { title: 'Delivery', icon: Truck, path: '/delivery', module: 'core' },
    { title: 'Setup Wizard', icon: Wrench, path: '/setup-wizard', module: 'core' },
];

// Converts raw dynamic sidebar items from server into renderable format
function parseDynamicItems(raw: SidebarDynamicItem[]): SidebarDynamicItem[] {
    return raw.map(item => {
        const moduleCode = item.module || 'core';
        const prefix = moduleCode !== 'core' ? `/m/${moduleCode}` : '';
        return {
            ...item,
            icon: getIcon(item.icon as string),
            path: item.path && !item.path.startsWith('/saas') ? `/saas${prefix}${item.path}` : item.path,
            children: item.children?.map((c: SidebarDynamicItem) => ({
                ...c,
                icon: c.icon ? getIcon(c.icon as string) : undefined,
                path: c.path && !c.path.startsWith('/saas') ? `/saas${prefix}${c.path}` : c.path,
            }))
        };
    });
}

export function Sidebar({
    isSaas = false,
    isSuperuser = false,
    dualViewEnabled = false,
    initialModuleCodes = [],
    initialDynamicItems = [],
}: {
    isSaas?: boolean;
    isSuperuser?: boolean;
    dualViewEnabled?: boolean;
    /** Pre-fetched by the server layout — sidebar renders fully on first paint */
    initialModuleCodes?: string[];
    initialDynamicItems?: SidebarDynamicItem[];
}) {
    const { sidebarOpen, toggleSidebar, openTab, activeTab, viewScope, setViewScope, canToggleScope, navLayout, setNavLayout, tabLayout, setTabLayout } = useAdmin();

    // ── All hooks MUST be declared before any conditional returns (React rules-of-hooks) ──
    // Initialise from server-passed props so the sidebar is fully populated on first paint
    // with no useEffect flicker. Falls back to null (show everything) when not provided.
    const [installedModules, setInstalledModules] = useState<Set<string> | null>(
        initialModuleCodes.length > 0 ? new Set(initialModuleCodes) : null
    );
    const [dynamicItems, setDynamicItems] = useState<SidebarDynamicItem[]>(
        () => parseDynamicItems(initialDynamicItems)
    );
    const [devSectionOpen, setDevSectionOpen] = useState(true);
    const { favorites, removeFavorite } = useFavorites();
    const [favOpen, setFavOpen] = useState(true);

    // Only fetch client-side if the layout didn't provide data (e.g. direct navigation
    // to a page that bypasses the privileged layout, or empty initial props)
    useEffect(() => {
        if (initialModuleCodes.length > 0 && initialDynamicItems.length === 0) return;
        if (installedModules !== null && dynamicItems.length > 0) return; // already hydrated

        async function fetchData() {
            try {
                const [modules, sidebarData] = await Promise.all([
                    getSaaSModules(),
                    getDynamicSidebar()
                ]);
                if (Array.isArray(modules) && modules.length > 0) {
                    setInstalledModules(new Set(modules.map((m: Record<string, unknown>) => m.code as string)));
                }
                if (Array.isArray(sidebarData)) {
                    setDynamicItems(parseDynamicItems(sidebarData));
                }
            } catch (e) {
                console.error("Failed to fetch sidebar data", e);
            }
        }
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // In topnav mode the sidebar is hidden — navigation lives in the header
    // (placed AFTER hooks to comply with React rules-of-hooks)
    if (navLayout === 'topnav') return null;

    // Merge hardcoded core with dynamic
    const allItems = [...MENU_ITEMS, ...dynamicItems];

    const processedItems = allItems.filter(item => {
        // 1. Filter by SaaS Panel visibility — superusers ALWAYS see SaaS Control
        if (!isSaas && !isSuperuser && item.visibility === 'saas') return false;

        // 2. Filter by Installed Module (only when modules have been loaded from server)
        if (installedModules !== null && item.module && item.module !== 'core' && !installedModules.has(String(item.module))) {
            return false;
        }
        return true;
    });

    // Pin SaaS Control to top if in SaaS or superuser context
    const filteredItems = (isSaas || isSuperuser)
        ? [
            ...processedItems.filter(i => i.title === 'SaaS Control'),
            ...processedItems.filter(i => i.title !== 'SaaS Control')
        ]
        : processedItems;

    // ── Split items by stage: production (finished) vs development (in progress) ──
    // To promote an item to production, add  stage: 'production'  to it in MENU_ITEMS
    const productionItems = filteredItems.filter((i: any) => i.stage === 'production');
    const developmentItems = filteredItems.filter((i: any) => i.stage !== 'production');

    return (
        <React.Fragment>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <aside className="fixed md:relative inset-y-0 left-0 shrink-0 overflow-hidden z-50"
            style={{
                // All layout-critical values are HARDCODED — never read from CSS vars
                // (CSS vars like --nav-width can be overridden by theme engines to 100%,
                //  breaking the layout entirely)
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: sidebarOpen ? '240px' : '0px',
                minWidth: sidebarOpen ? '240px' : '0px',
                opacity: sidebarOpen ? 1 : 0,
                pointerEvents: sidebarOpen ? 'auto' : 'none',
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                background: 'var(--app-sidebar-bg)',
                borderRight: '1px solid var(--app-sidebar-border)',
                color: 'var(--app-sidebar-text)',
                boxShadow: sidebarOpen ? '4px 0 24px -8px rgba(0,0,0,0.15)' : 'none',
            }}>
                {/* ── Branding ── */}
                <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-sidebar-border) 50%, transparent)',
                }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm"
                        style={{
                            background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-dark, var(--app-primary)))',
                            boxShadow: '0 2px 8px var(--app-primary-glow, rgba(0,0,0,0.2))',
                        }}>
                        {PLATFORM_CONFIG.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-black tracking-tight leading-none truncate" style={{ color: 'var(--app-sidebar-text)' }}>
                            {PLATFORM_CONFIG.name}
                        </h1>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--app-primary)' }}>
                            {isSaas ? 'Platform Admin' : 'Workspace'}
                        </p>
                    </div>
                </div>

                {/* ── Scope Switcher ── */}
                {dualViewEnabled && canToggleScope && (
                    <div className="mx-4 mt-3 shrink-0">
                        <div className="p-1 rounded-xl flex gap-0.5" style={{
                            background: 'color-mix(in srgb, var(--app-sidebar-border) 30%, transparent)',
                        }}>
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewScope === 'OFFICIAL'
                                        ? "text-white"
                                        : "hover:bg-[var(--app-sidebar-active)]"
                                )}
                                style={viewScope === 'OFFICIAL' ? {
                                    background: 'var(--app-primary)',
                                    color: 'white',
                                    boxShadow: '0 2px 6px var(--app-primary-glow, rgba(0,0,0,0.2))',
                                } : { color: 'var(--app-sidebar-muted)' }}
                            >
                                <Layers size={12} />
                                Official
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                    viewScope === 'INTERNAL'
                                        ? ""
                                        : "hover:bg-[var(--app-sidebar-active)]"
                                )}
                                style={viewScope === 'INTERNAL' ? {
                                    background: 'var(--app-sidebar-surface, var(--app-sidebar-active))',
                                    color: 'var(--app-sidebar-text)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                } : { color: 'var(--app-sidebar-muted)' }}
                            >
                                <BarChart3 size={12} />
                                Internal
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Menu ── */}
                <div className="overflow-y-auto custom-scrollbar px-3 py-3 space-y-0.5" style={{ flex: '1 1 0', minHeight: 0 }}>

                    {/* ── FAVORITES SECTION ── */}
                    {favorites.length > 0 && (
                        <>
                            <div
                                className="mb-1 mx-1 flex items-center gap-1.5 cursor-pointer select-none"
                                onClick={() => setFavOpen(v => !v)}
                            >
                                <Star size={10} fill="currentColor" style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.85 }}>
                                    Favorites
                                </span>
                                <span className="text-[8px] font-bold px-1 rounded ml-0.5" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                                    {favorites.length}
                                </span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' }} />
                                <ChevronRight
                                    size={11}
                                    className={clsx('transition-transform duration-200', favOpen ? 'rotate-90' : '')}
                                    style={{ color: 'var(--app-primary)', opacity: 0.5 }}
                                />
                            </div>
                            {favOpen && (
                                <div className="space-y-0.5 mb-3">
                                    {favorites.map((fav, idx) => (
                                        <div
                                            key={`${fav.path}-${idx}`}
                                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                                            onClick={() => openTab(fav.title, fav.path)}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-sidebar-active)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <Star size={10} fill="currentColor" style={{ color: 'var(--app-primary)', flexShrink: 0 }} />
                                            <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--app-sidebar-text)' }}>
                                                {fav.title}
                                            </span>
                                            <button
                                                title="Remove from favorites"
                                                onClick={(e) => { e.stopPropagation(); removeFavorite(fav.path); }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                                                style={{ color: 'var(--app-sidebar-muted)' }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-error, #ef4444)'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--app-sidebar-muted)'; }}
                                            >
                                                <Star size={9} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="my-2 mx-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-sidebar-border) 60%, transparent)' }} />
                        </>
                    )}

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* ── PRODUCTION SECTION ── Finished, polished pages    */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {productionItems.length > 0 && (
                        <>
                            <div className="mb-2 mx-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success, #22c55e)' }} />
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success, #22c55e)', opacity: 0.85 }}>Production</span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' }} />
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)', opacity: 0.6 }}>{productionItems.length}</span>
                            </div>
                            {productionItems.map((item, idx) => (
                                <React.Fragment key={`prod-${idx}`}>
                                    {idx > 0 && item.visibility === 'saas' && (
                                        <div className="my-2 mx-2 flex items-center gap-2">
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Platform</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                        </div>
                                    )}
                                    <MenuItem item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                                </React.Fragment>
                            ))}
                        </>
                    )}

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* ── DEVELOPMENT SECTION ── Work in progress pages     */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {developmentItems.length > 0 && (
                        <>
                            <div
                                className="my-3 mx-2 flex items-center gap-2 cursor-pointer select-none group"
                                onClick={() => setDevSectionOpen(!devSectionOpen)}
                            >
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-warning, #f59e0b)' }} />
                                <span className="text-[9px] font-black uppercase tracking-widest transition-colors" style={{ color: 'var(--app-warning, #f59e0b)', opacity: 0.85 }}>
                                    Development ({developmentItems.length})
                                </span>
                                <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }} />
                                <ChevronRight
                                    size={12}
                                    className={clsx("transition-transform duration-200", devSectionOpen ? "rotate-90" : "")}
                                    style={{ color: 'var(--app-warning, #f59e0b)', opacity: 0.6 }}
                                />
                            </div>
                            {devSectionOpen && developmentItems.map((item, idx) => (
                                <React.Fragment key={`dev-${idx}`}>
                                    {idx > 0 && item.visibility === 'saas' && (
                                        <div className="my-2 mx-2 flex items-center gap-2">
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)', opacity: 0.6 }}>Platform</span>
                                            <div className="flex-1 h-px" style={{ background: 'var(--app-sidebar-border)' }} />
                                        </div>
                                    )}
                                    <MenuItem item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-3 py-3 shrink-0 space-y-1" style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-sidebar-border) 50%, transparent)',
                }}>
                    {/* Layout toggles row */}
                    <div className="flex items-center gap-1 px-1 pb-1">
                        {/* Nav layout toggle: sidebar ↔ topnav */}
                        <button
                            onClick={() => setNavLayout(navLayout === 'sidebar' ? 'topnav' : 'sidebar')}
                            title={navLayout === 'sidebar' ? 'Switch to top navigation' : 'Switch to sidebar navigation'}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-sidebar-active)'; e.currentTarget.style.color = 'var(--app-sidebar-text)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--app-sidebar-muted)'; }}
                        >
                            <PanelLeft size={15} />
                        </button>

                        {/* Tab layout toggle: horizontal ↔ vertical */}
                        <button
                            onClick={() => setTabLayout(tabLayout === 'horizontal' ? 'vertical' : 'horizontal')}
                            title={tabLayout === 'horizontal' ? 'Switch to vertical tabs' : 'Switch to horizontal tabs'}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-sidebar-active)'; e.currentTarget.style.color = 'var(--app-sidebar-text)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--app-sidebar-muted)'; }}
                        >
                            <Rows3 size={15} />
                        </button>
                    </div>

                    {/* Sign out */}
                    <button
                        onClick={() => logoutAction()}
                        suppressHydrationWarning={true}
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-all group"
                        style={{ color: 'var(--app-sidebar-muted)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)';
                            e.currentTarget.style.color = 'var(--app-error, #ef4444)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--app-sidebar-muted)';
                        }}
                    >
                        <LogOut size={16} />
                        <span className="text-xs font-bold">Sign Out</span>
                    </button>
                </div>
            </aside>
        </React.Fragment>
    );
}

function MenuItem({
    item,
    openTab,
    activeTab,
    installedModules,
    level = 0
}: {
    item: Record<string, any>,
    openTab: (...args: any[]) => any,
    activeTab: string,
    installedModules: Set<string> | null,
    level?: number
}) {
    const { toggleFavorite, isFavorite } = useFavorites();

    // 1. Module & Visibility Filter (null = not loaded yet, show everything)
    if (installedModules !== null && item.module && item.module !== 'core' && !installedModules.has(item.module)) {
        return null;
    }

    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isLeaf = !!item.path;

    // 2. Recursive Active State Detection
    const checkActive = (it: SidebarDynamicItem): boolean => {
        if (it.path === activeTab) return true;
        if (it.children) return it.children.some((c: SidebarDynamicItem) => checkActive(c));
        return false;
    };

    const isChildActive = hasChildren && item.children.some((child: SidebarDynamicItem) => checkActive(child));
    const isActive = activeTab === item.path;
    const isFav = isLeaf ? isFavorite(item.path) : false;

    // 3. Expansion Logic
    const [expanded, setExpanded] = useState(isChildActive);
    useEffect(() => {
        if (isChildActive) setExpanded(true);
    }, [activeTab, isChildActive]);

    const handleClick = () => {
        if (hasChildren) {
            setExpanded(!expanded);
        } else if (item.path) {
            openTab(item.title, item.path);
        }
    };


    return (
        <div className={level > 0 ? "mt-0.5" : "mt-0.5"}>
            <div
                onClick={handleClick}
                className={clsx(
                    "flex items-center gap-2.5 px-3 cursor-pointer select-none transition-all duration-150 group relative overflow-hidden",
                    level === 0 ? "py-2 rounded-xl" : "py-1.5 rounded-lg",
                    isActive
                        ? "font-bold"
                        : isChildActive
                            ? ""
                            : "hover:bg-[var(--app-sidebar-active)]"
                )}
                style={
                    isActive ? {
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                    } : isChildActive ? {
                        background: 'color-mix(in srgb, var(--app-sidebar-active) 50%, transparent)',
                        color: 'var(--app-sidebar-text)',
                    } : {
                        color: 'var(--app-sidebar-muted)',
                    }
                }
            >
                {/* Active Accent Strip */}
                {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full" style={{ background: 'var(--app-primary)' }} />
                )}

                {Icon && (
                    <Icon size={level === 0 ? 18 : 15} style={
                        isActive || isChildActive
                            ? { color: 'var(--app-primary)' }
                            : undefined
                    } className={isActive || isChildActive ? "" : "group-hover:text-[var(--app-sidebar-text)] transition-colors"} />
                )}

                <span className={clsx(
                    "flex-1 truncate",
                    level === 0 ? "text-[13px] font-medium" : "text-[12px] font-normal"
                )}>
                    {item.title}
                </span>

                {/* Favorite Toggle (Leaf nodes only) */}
                {isLeaf && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item.title, item.path);
                        }}
                        className={clsx(
                            "opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-[var(--app-sidebar-muted)]/10 rounded-md",
                            isFav && "opacity-100"
                        )}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star 
                            size={12} 
                            style={{ 
                                fill: isFav ? '#f59e0b' : 'none', 
                                color: isFav ? '#f59e0b' : 'var(--app-sidebar-muted)' 
                            }} 
                        />
                    </button>
                )}

                {hasChildren && (
                    <div className={clsx("transition-transform duration-200", expanded ? "rotate-90" : "")}
                        style={{ color: expanded ? 'var(--app-primary)' : 'inherit', opacity: 0.5 }}>
                        <ChevronRight size={14} />
                    </div>
                )}
            </div>

            {hasChildren && expanded && (
                <div className="ml-5 pl-3 my-0.5 space-y-0" style={{
                    borderLeft: '1px solid color-mix(in srgb, var(--app-sidebar-border) 60%, transparent)',
                }}>
                    {item.children.map((child: Record<string, any>, idx: number) => (
                        <MenuItem
                            key={idx}
                            item={child}
                            openTab={openTab}
                            activeTab={activeTab}
                            installedModules={installedModules}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

