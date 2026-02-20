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
    ChevronDown,
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
    Eye
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { logoutAction } from "@/app/actions/auth";
import { PLATFORM_CONFIG } from '@/lib/saas_config';

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
    Trophy
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
                    { title: 'Order History', path: '/sales/history' },
                    { title: 'Sales Analytics', path: '/sales/analytics' },
                    { title: 'Quotations', path: '/sales/quotations' },
                    { title: 'Deliveries', path: '/sales/deliveries' },
                    { title: 'Discount Rules', path: '/sales/discounts' },
                    { title: 'Consignment', path: '/sales/consignment' },
                    { title: 'Delivery Zones', path: '/sales/delivery-zones' },
                    { title: 'Sales Returns', path: '/sales/returns' },
                    { title: 'Import Sales', path: '/sales/import' },
                ]
            },
            {
                title: 'Purchasing',
                icon: Wallet,
                children: [
                    { title: 'Procurement Center', path: '/purchases' },
                    { title: 'Purchase Dashboard', path: '/purchases/dashboard' },
                    { title: 'New RFQ / Order', path: '/purchases/new-order' },
                    { title: 'Quick Purchase', path: '/purchases/new' },
                    { title: 'Purchase Returns', path: '/purchases/returns' },
                    { title: 'Supplier Sourcing', path: '/purchases/sourcing' },
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
                    { title: 'Product Master', path: '/products' },
                    { title: 'Product Analytics', path: '/inventory/analytics' },
                    { title: 'Combo & Bundles', path: '/inventory/combo' },
                    { title: 'Label Printing', path: '/inventory/labels' },
                    { title: 'Product Groups', path: '/products?view=grouped' },
                    { title: 'New Product Group', path: '/products/create-group' },
                ]
            },
            {
                title: 'Warehousing',
                icon: Warehouse,
                children: [
                    { title: 'Warehouses & Zones', path: '/inventory/warehouses' },
                    { title: 'Stock Adjustments', path: '/inventory/adjustments' },
                    { title: 'Global Inventory', path: '/inventory/global' },
                    { title: 'Barcode Configuration', path: '/inventory/barcode' },
                    { title: 'Expiry Alerts', path: '/inventory/expiry-alerts' },
                    { title: 'Low Stock Alerts', path: '/inventory/low-stock' },
                    { title: 'Stock Movements', path: '/inventory/movements' },
                    { title: 'Inventory Alerts', path: '/inventory/alerts' },
                    { title: 'Serial Numbers', path: '/inventory/serials' },
                    { title: 'Stock Count', path: '/inventory/stock-count' },
                ]
            },
            {
                title: 'Stock Orders',
                icon: ClipboardList,
                children: [
                    { title: 'Adjustment Orders', path: '/inventory/adjustment-orders' },
                    { title: 'Transfer Orders', path: '/inventory/transfer-orders' },
                    { title: 'Operational Requests', path: '/inventory/requests' },
                    { title: 'Stock Valuation', path: '/inventory/valuation' },
                ]
            },
            {
                title: 'Catalog Setup',
                icon: FolderTree,
                children: [
                    { title: 'Categories', path: '/inventory/categories' },
                    { title: 'Categories Audit', path: '/inventory/categories/maintenance' },
                    { title: 'Units & Packaging', path: '/inventory/units' },
                    { title: 'Brands', path: '/inventory/brands' },
                    { title: 'Countries', path: '/inventory/countries' },
                    { title: 'Attributes', path: '/inventory/attributes' },
                ]
            },
            {
                title: 'System Maintenance',
                icon: Wrench,
                children: [
                    { title: 'Maintenance Dashboard', path: '/inventory/maintenance' },
                    { title: 'Data Quality', path: '/inventory/maintenance/data-quality' },
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
            {
                title: 'Accounts & Ledger',
                icon: BookOpen,
                children: [
                    { title: 'Accounts & Drawers', path: '/finance/accounts' },
                    { title: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
                    { title: 'COA Templates', path: '/finance/chart-of-accounts/templates' },
                    { title: 'Migration Tool', path: '/finance/chart-of-accounts/migrate' },
                    { title: 'General Ledger', path: '/finance/ledger' },
                    { title: 'Opening Balances', path: '/finance/ledger/opening' },
                ]
            },
            {
                title: 'Operations',
                icon: ClipboardList,
                children: [
                    { title: 'Invoices', path: '/finance/invoices' },
                    { title: 'Payments', path: '/finance/payments' },
                    { title: 'Vouchers', path: '/finance/vouchers' },
                    { title: 'Expenses', path: '/finance/expenses' },
                    { title: 'Deferred Expenses', path: '/finance/deferred-expenses' },
                    { title: 'Assets & Depreciation', path: '/finance/assets' },
                    { title: 'Purchase Returns', path: '/finance/purchase-returns' },
                    { title: 'Sales Returns', path: '/finance/sales-returns' },
                ]
            },
            {
                title: 'Reports',
                icon: TrendingUp,
                children: [
                    { title: 'Account Statement', path: '/finance/reports/statement' },
                    { title: 'Trial Balance', path: '/finance/reports/trial-balance' },
                    { title: 'Profit & Loss', path: '/finance/reports/pnl' },
                    { title: 'Balance Sheet', path: '/finance/reports/balance-sheet' },
                    { title: 'Aging Report', path: '/finance/aging' },
                    { title: 'Audit Trail', path: '/finance/audit-trail' },
                    { title: 'Cash Register', path: '/finance/cash-register' },
                    { title: 'Bank Reconciliation', path: '/finance/bank-reconciliation' },
                    { title: 'Period Statements', path: '/finance/statements' },
                    { title: 'Tax Reports', path: '/finance/tax-reports' },
                    { title: 'Budget Overview', path: '/finance/budget' },
                    { title: 'Profit Centers', path: '/finance/profit-centers' },
                    { title: 'Revenue Breakdown', path: '/finance/revenue' },

                ]
            },
            {
                title: 'Fiscal & Periods',
                icon: Calendar,
                children: [
                    { title: 'Fiscal Years', path: '/finance/fiscal-years' },
                    { title: 'Profit Distribution', path: '/finance/profit-distribution' },
                ]
            },
            {
                title: 'Loans & Pricing',
                icon: DollarSign,
                children: [
                    { title: 'Loan Contracts', path: '/finance/loans' },
                    { title: 'Pricing Engine', path: '/finance/pricing' },
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
            { title: 'Financial Settings', path: '/finance/settings', icon: Settings },

        ]
    },
    {
        title: 'CRM',
        icon: Users,
        module: 'crm',
        children: [
            { title: 'Contact Center', path: '/crm/contacts' },
            { title: 'Client Pricing', path: '/crm/pricing', icon: Tag },
            { title: 'Supplier Performance', path: '/crm/supplier-performance' },
            { title: 'Customer Insights', path: '/crm/insights' },
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
            { title: 'Storefront Dashboard', path: '/workspace/portal-config', icon: Settings },
            { title: 'eCommerce Orders', path: '/workspace/client-orders', icon: ShoppingCart },
            { title: 'Client Access', path: '/workspace/client-access', icon: Users },
            { title: 'Client Tickets', path: '/workspace/client-tickets', icon: ClipboardList },
        ]
    },
    {
        title: 'HR & Teams',
        icon: ShieldCheck,
        module: 'hr',
        children: [
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
            { title: 'Performance', path: '/workspace/performance', icon: Trophy },
        ]
    },
    {
        title: 'Import from Third Party',
        icon: Globe,
        path: '/migration',
    },
    {
        title: 'SaaS Control',
        icon: ShieldCheck,
        visibility: 'saas',
        children: [
            { title: 'SaaS Dashboard', path: '/dashboard', icon: Globe },
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
                title: 'Infrastructure',
                icon: Shield,
                children: [
                    { title: 'Platform Health', path: '/health' },
                    { title: 'Kernel Updates', path: '/updates' },
                    { title: 'Global Registry', path: '/modules' },
                    { title: 'Currencies', path: '/currencies' },
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
                    {
                        title: 'MCP AI',
                        icon: Bot,
                        children: [
                            { title: 'MCP Dashboard', path: '/mcp' },
                            { title: 'MCP Chat', path: '/mcp/chat' },
                            { title: 'Conversations', path: '/mcp/conversations' },
                            { title: 'Providers', path: '/mcp/providers' },
                            { title: 'Tools', path: '/mcp/tools' },
                            { title: 'Usage', path: '/mcp/usage' },
                            { title: 'MCP Settings', path: '/mcp/settings' },
                        ]
                    },
                    { title: 'AES-256 Encryption', path: '/encryption' },
                ]
            },
        ]
    },
    {
        title: 'System Settings',
        icon: Settings,
        module: 'core',
        children: [
            { title: 'Cloud Storage', path: '/storage', icon: Cloud },
            { title: 'Sites & Branches', path: '/settings/sites', visibility: 'saas' },
            { title: 'Roles & Permissions', path: '/settings/roles' },
            { title: 'Security Settings', path: '/settings/security', icon: Shield },
            { title: 'Notifications', path: '/settings/notifications', icon: Bell },
            { title: 'Billing & Subscription', path: '/subscription', icon: CreditCard },
        ]
    },
];

export function Sidebar({
    isSaas = false,
    isSuperuser = false,
    dualViewEnabled = false
}: {
    isSaas?: boolean;
    isSuperuser?: boolean;
    dualViewEnabled?: boolean;
}) {
    const { sidebarOpen, toggleSidebar, openTab, activeTab, viewScope, setViewScope, canToggleScope, scopeAccess } = useAdmin();
    const [installedModules, setInstalledModules] = useState<Set<string>>(new Set(['core']));
    const [dynamicItems, setDynamicItems] = useState<SidebarDynamicItem[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [modules, sidebarData] = await Promise.all([
                    getSaaSModules(),
                    getDynamicSidebar()
                ]);

                if (Array.isArray(modules)) {
                    setInstalledModules(new Set(modules.map((m: Record<string, unknown>) => m.code as string)));
                }

                if (Array.isArray(sidebarData)) {
                    // Convert icon strings to Components and prefix paths for isolation
                    const parsed = sidebarData.map(item => {
                        const moduleCode = item.module || 'core';
                        const prefix = moduleCode !== 'core' ? `/m/${moduleCode}` : '';

                        return {
                            ...item,
                            icon: getIcon(item.icon),
                            path: item.path && !item.path.startsWith('/saas') ? `/saas${prefix}${item.path}` : item.path,
                            children: item.children?.map((c: SidebarDynamicItem) => ({
                                ...c,
                                icon: c.icon ? getIcon(c.icon) : undefined,
                                path: c.path && !c.path.startsWith('/saas') ? `/saas${prefix}${c.path}` : c.path,
                            }))
                        };
                    });
                    setDynamicItems(parsed);
                }
            } catch (e) {
                console.error("Failed to fetch sidebar data", e);
            }
        }
        fetchData();
    }, []);

    // Merge hardcoded core with dynamic
    const allItems = [...MENU_ITEMS, ...dynamicItems];

    const processedItems = allItems.filter(item => {
        // 1. Filter by SaaS Panel visibility logic
        if (!isSaas && item.visibility === 'saas') return false;

        // 2. Filter by Installed Module
        if (item.module && item.module !== 'core' && !installedModules.has(String(item.module))) {
            return false;
        }
        return true;
    });

    // Pin SaaS Control to top if in SaaS context
    const filteredItems = isSaas
        ? [
            ...processedItems.filter(i => i.title === 'SaaS Control'),
            ...processedItems.filter(i => i.title !== 'SaaS Control')
        ]
        : processedItems;

    return (
        <React.Fragment>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <aside className={clsx(
                "fixed lg:relative inset-y-0 left-0 bg-[#0F172A] border-r border-gray-800 flex flex-col shrink-0 overflow-hidden h-full text-gray-300 shadow-2xl z-50 transition-all duration-300 transform",
                sidebarOpen
                    ? "w-72 md:w-80 translate-x-0 opacity-100"
                    : "-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none"
            )}>
                <div className="p-8 border-b border-gray-800/50 flex items-center gap-4 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white font-bold text-xl">
                        {PLATFORM_CONFIG.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight leading-none">{PLATFORM_CONFIG.name}</h1>
                        <p className="text-xs text-emerald-400 font-medium mt-1.5">{isSaas ? 'Platform Admin' : 'Workspace Admin'}</p>
                    </div>
                </div>

                {/* View Scope Switcher — only visible for full-access users */}
                {dualViewEnabled && canToggleScope && (
                    <div className="mx-6 mt-6 shrink-0">
                        <div className="p-1.5 bg-[#0B1120] rounded-2xl border border-gray-800 flex gap-1">
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                    viewScope === 'OFFICIAL'
                                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                                )}
                            >
                                <Layers size={14} />
                                Official
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                suppressHydrationWarning={true}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                                    viewScope === 'INTERNAL'
                                        ? "bg-gray-700 text-white shadow-lg"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                                )}
                            >
                                <BarChart3 size={14} />
                                Internal
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 px-3 mt-2">Main Menu</div>
                    {filteredItems.map((item, idx) => (
                        <MenuItem key={idx} item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                    ))}
                </div>

                <div className="p-6 border-t border-gray-800/50 bg-[#0B1120] shrink-0">
                    <button
                        onClick={() => logoutAction()}
                        suppressHydrationWarning={true}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl hover:bg-gray-800/50 text-gray-400 hover:text-white transition-all group"
                    >
                        <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
                        <span className="text-sm font-medium">Sign Out</span>
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
    openTab: Record<string, any>,
    activeTab: string,
    installedModules: Set<string>,
    level?: number
}) {
    // 1. Module & Visibility Filter
    if (item.module && item.module !== 'core' && !installedModules.has(item.module)) {
        return null;
    }

    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    // 2. Recursive Active State Detection
    const checkActive = (it: SidebarDynamicItem): boolean => {
        if (it.path === activeTab) return true;
        if (it.children) return it.children.some((c: SidebarDynamicItem) => checkActive(c));
        return false;
    };

    const isChildActive = hasChildren && item.children.some((child: SidebarDynamicItem) => checkActive(child));
    const isActive = activeTab === item.path;

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
        <div className={level > 0 ? "mt-1" : "mt-2"}>
            <div
                onClick={handleClick}
                className={clsx(
                    "flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer select-none transition-all duration-200 group relative overflow-hidden",
                    isActive || isChildActive
                        ? "bg-emerald-600/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20"
                        : "text-gray-400 hover:bg-gray-800/60 hover:text-white",
                    level > 0 && "py-2.5 rounded-xl text-[13px]"
                )}
            >
                {/* Active Indicator Strip */}
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                )}

                {Icon && (
                    <Icon size={level === 0 ? 22 : 18} className={clsx(isActive || isChildActive ? "text-emerald-400" : "group-hover:text-white transition-colors")} />
                )}

                <span className={clsx("flex-1 truncate", level === 0 ? "font-medium" : "font-normal")}>
                    {item.title}
                </span>

                {hasChildren && (
                    <div className={clsx("transition-transform duration-200 text-gray-500", expanded ? "rotate-90 text-emerald-500" : "")}>
                        <ChevronRight size={18} />
                    </div>
                )}
            </div>

            {hasChildren && expanded && (
                <div className="ml-6 pl-4 border-l border-gray-800/50 my-1.5 space-y-1">
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
