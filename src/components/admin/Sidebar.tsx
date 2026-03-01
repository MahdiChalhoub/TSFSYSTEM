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
    MessageCircle,
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
    FileCheck,
    Percent,
    Star,
    History,
    Landmark,
    UserCheck,
    Store
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";
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
    Trophy,
    Star,
    History,
    Landmark,
    UserCheck,
    Store
};

function getIcon(name: string) {
    return ICON_MAP[name] || Box;
}

// ─── Tree-Structured Menu ────────────────────────────────────────
// Module → Feature Group → Page
export const MENU_ITEMS = [
    {
        title: 'Overview',
        icon: LayoutDashboard,
        module: 'core',
        children: [
            { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { title: 'Setup Wizard', path: '/setup-wizard', icon: Sparkles },
            { title: 'TaskBoard & Performance', path: '/workspace/tasks', icon: ClipboardList },
            { title: 'Import (Migration)', path: '/migration', icon: Globe },
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
                    { title: 'POS Configuration', path: '/sales/pos-settings' },
                    { title: 'Register Sessions', path: '/sales/sessions' },
                    { title: 'Register Status', path: '/finance/cash-register' },
                    { title: 'Account Book (Audit)', path: '/finance/account-book' },
                    { title: 'Sales Audit', path: '/sales/audit' },
                    { title: 'Order History', path: '/sales/history' },
                    { title: 'Daily Summary', path: '/sales/summary' },
                    { title: 'Sales Analytics', path: '/sales/analytics' },
                ]
            },
            {
                title: 'Sales & Orders',
                icon: ShoppingBag,
                children: [
                    { title: 'Quotations', path: '/sales/quotations' },
                    { title: 'Deliveries', path: '/sales/deliveries' },
                    { title: 'Delivery Zones', path: '/sales/delivery-zones' },
                    { title: 'Drivers', path: '/sales/drivers' },
                    { title: 'Sales Returns', path: '/sales/returns' },
                    { title: 'Credit Notes', path: '/sales/credit-notes' },
                    { title: 'Discount Rules', path: '/sales/discounts' },
                    { title: 'Consignment', path: '/sales/consignment' },
                ]
            },
            {
                title: 'eCommerce',
                icon: Globe,
                children: [
                    { title: 'Storefront Settings', path: '/ecommerce/settings', icon: Settings },
                    { title: 'Theme Manager', path: '/ecommerce/themes', icon: Layers },
                    { title: 'Online Orders', path: '/ecommerce/orders', icon: ShoppingCart },
                    { title: 'Product Catalog', path: '/ecommerce/catalog', icon: Tag },
                ]
            },
        ]
    },
    {
        title: 'Supply Chain',
        icon: Warehouse,
        module: 'inventory',
        children: [
            {
                title: 'Purchasing',
                icon: Wallet,
                children: [
                    { title: 'Procurement Center', path: '/purchases' },
                    { title: 'Purchase Orders', path: '/purchases/purchase-orders' },
                    { title: 'Receipt Orders', path: '/purchases/receipts' },
                    { title: 'Purchase Invoices', path: '/purchases/invoices' },
                    { title: 'Purchase Returns', path: '/purchases/returns' },
                    { title: 'Supplier Sourcing', path: '/purchases/sourcing' },
                ]
            },
            {
                title: 'Products & Catalog',
                icon: Tag,
                children: [
                    { title: 'Product Master', path: '/products' },
                    { title: 'Categories', path: '/inventory/categories' },
                    { title: 'Brands', path: '/inventory/brands' },
                    { title: 'Units', path: '/inventory/units' },
                    { title: 'Attributes', path: '/inventory/attributes' },
                    { title: 'Combo & Bundles', path: '/inventory/combo' },
                    { title: 'Barcode Generation', path: '/inventory/barcode' },
                    { title: 'Label Printing', path: '/inventory/labels' },
                ]
            },
            {
                title: 'Warehousing & Stock',
                icon: Box,
                children: [
                    { title: 'Zones & Locations', path: '/inventory/warehouses' },
                    { title: 'Stock Movements', path: '/inventory/movements' },
                    { title: 'Stock Count', path: '/inventory/stock-count' },
                    { title: 'Transfer Orders', path: '/inventory/transfer-orders' },
                    { title: 'Serial Numbers', path: '/inventory/serials' },
                    { title: 'Operational Requests', path: '/inventory/requests' },
                    { title: 'Adjustment Orders', path: '/inventory/adjustment-orders' },
                    { title: 'Inventory Alerts', path: '/inventory/low-stock' },
                ]
            },
            {
                title: 'Supplier Portal',
                icon: Briefcase,
                children: [
                    { title: 'Supplier Access', path: '/workspace/supplier-access' },
                    { title: 'Proforma Review', path: '/workspace/proformas' },
                    { title: 'Price Requests', path: '/workspace/price-requests' },
                    { title: 'Portal Management', path: '/workspace/supplier-portal' },
                ]
            },
            {
                title: 'Audit & Maintenance',
                icon: Wrench,
                children: [
                    { title: 'Inventory Structure', path: '/inventory/maintenance' },
                    { title: 'Data Quality Audit', path: '/inventory/maintenance/data-quality' },
                    { title: 'POS Forensics & Audit', path: '/sales/audit' },
                ]
            },
        ]
    },
    {
        title: 'Performance',
        icon: BarChart3,
        module: 'finance',
        children: [
            {
                title: 'Accounting',
                icon: Landmark,
                children: [
                    { title: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
                    { title: 'Journal Entries', path: '/finance/ledger' },
                    { title: 'Audit Trail', path: '/finance/audit-trail' },
                    { title: 'Fiscal Years', path: '/finance/fiscal-years' },
                    { title: 'Financial Settings', path: '/finance/settings' },
                ]
            },
            {
                title: 'A/R & A/P',
                icon: FolderTree,
                children: [
                    { title: 'Invoices', path: '/finance/invoices' },
                    { title: 'Payments & Receipts', path: '/finance/payments' },
                    { title: 'Expenses & Procurement', path: '/finance/expenses' },
                    { title: 'Deferred Expenses', path: '/finance/deferred-expenses' },
                    { title: 'Revenue Accrual', path: '/finance/revenue' },
                    { title: 'Bank Reconciliation', path: '/finance/bank-reconciliation' },
                ]
            },
            {
                title: 'Financial Reports',
                icon: TrendingUp,
                children: [
                    { title: 'Trial Balance', path: '/finance/reports/trial-balance' },
                    { title: 'Profit & Loss', path: '/finance/reports/pnl' },
                    { title: 'Balance Sheet', path: '/finance/reports/balance-sheet' },
                    { title: 'Aging Report', path: '/finance/reports/aging' },
                    { title: 'Profit Centers', path: '/finance/profit-centers' },
                    { title: 'Budget Overview', path: '/finance/budget' },
                    { title: 'Tax (VAT) Reports', path: '/finance/tax-reports' },
                ]
            },
            {
                title: 'Cash & Assets',
                icon: DollarSign,
                children: [
                    { title: 'Cash Registers', path: '/finance/cash-register' },
                    { title: 'Bank Drawing', path: '/finance/accounts' },
                    { title: 'Assets & Depreciation', path: '/finance/assets' },
                    { title: 'Loan Contracts', path: '/finance/loans' },
                ]
            },
        ]
    },
    {
        title: 'Relationships',
        icon: Users,
        module: 'crm',
        children: [
            { title: 'Contacts & Leads', path: '/crm/contacts', icon: UserCheck },
            { title: 'Price Groups', path: '/crm/pricing', icon: Tag },
            { title: 'Customer Insights', path: '/crm/insights', icon: BarChart3 },
            {
                title: 'Client Portal',
                icon: Globe,
                children: [
                    { title: 'Portal Settings', path: '/workspace/portal-config' },
                    { title: 'Client Access', path: '/workspace/client-access' },
                    { title: 'Client Orders', path: '/workspace/client-orders' },
                    { title: 'Client Tickets', path: '/workspace/client-tickets' },
                    { title: 'Quote Inbox', path: '/workspace/quote-inbox' },
                    { title: 'Tender Inbox', path: '/workspace/tenders' },
                ]
            },
        ]
    },
    {
        title: 'HR & Teams',
        icon: ShieldCheck,
        module: 'hr',
        children: [
            { title: 'Employee Directory', path: '/hr/employees' },
            { title: 'Departments', path: '/hr/departments' },
            { title: 'Shifts & Attendance', path: '/hr/attendance' },
            { title: 'Payroll & Salaries', path: '/hr/payroll' },
            { title: 'Leave Management', path: '/hr/leaves' },
            { title: 'Pending Approvals', path: '/users/approvals' },
        ]
    },
    {
        title: 'Intelligence',
        icon: Bot,
        module: 'mcp',
        children: [
            { title: 'AI Assistant', path: '/mcp/chat', icon: Bot },
            { title: 'Virtual Employees', path: '/mcp/agents', icon: Sparkles },
            { title: 'Knowledge Base', path: '/mcp/conversations', icon: BookOpen },
            { title: 'Tool Registry', path: '/mcp/tools', icon: Wrench },
        ]
    },
    {
        title: 'SaaS Control',
        icon: ShieldCheck,
        visibility: 'saas',
        children: [
            { title: 'Platform Dashboard', path: '/dashboard', icon: Globe },
            {
                title: 'Organization Mgmt',
                icon: Building2,
                children: [
                    { title: 'Organizations List', path: '/organizations' },
                    { title: 'Domain Switcher', path: '/switcher' },
                    { title: 'Subscription Plans', path: '/subscription-plans' },
                ]
            },
            {
                title: 'Infrastructure',
                icon: Shield,
                children: [
                    { title: 'Platform Health', path: '/health' },
                    { title: 'Kernel Console', path: '/updates' },
                    { title: 'Module Registry', path: '/modules' },
                    { title: 'Currency Matrix', path: '/currencies' },
                    { title: 'Encryption Keyroom', path: '/encryption' },
                ]
            },
        ]
    },
    {
        title: 'Administration',
        icon: Settings,
        module: 'core',
        children: [
            { title: 'System Settings', path: '/settings', icon: Settings },
            { title: 'WhatsApp Push Alerts', path: '/settings/whatsapp', icon: MessageCircle },
            { title: 'Auto-Task Engine', path: '/workspace/auto-task-rules', icon: Zap },
            {
                title: 'Storage & Media',
                icon: Cloud,
                children: [
                    { title: 'File Browser', path: '/storage' },
                    { title: 'Package Manager', path: '/storage/packages' },
                ]
            },
            { title: 'Security & Roles', path: '/settings/roles', icon: Shield },
            { title: 'Custom Domains', path: '/settings/domains', icon: Globe },
            { title: 'Postings (Rules)', path: '/finance/settings/posting-rules', icon: ListChecks },
            { title: 'System Audit Log', path: '/finance/events', icon: History },
            { title: 'Subscription Info', path: '/subscription', icon: CreditCard },
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
    // Initialize with ALL known modules to prevent "flash of SaaS sidebar" on first render.
    const ALL_KNOWN_MODULES = ['core', 'pos', 'finance', 'inventory', 'crm', 'hr', 'purchases', 'ecommerce', 'mcp'];
    const [installedModules, setInstalledModules] = useState<Set<string>>(new Set(isSaas ? ['core', 'mcp'] : ALL_KNOWN_MODULES));
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

    // Deduplicate by title to prevent "2 system settings" (one from backend, one from frontend)
    const uniqueItemsMap = new Map<string, any>();
    allItems.forEach((item: any) => {
        // Normalize title for comparison
        if (!item?.title) return;
        const key = String(item.title).toLowerCase().trim();
        if (!uniqueItemsMap.has(key)) {
            uniqueItemsMap.set(key, item);
        }
    });

    const processedItems = Array.from(uniqueItemsMap.values()).filter((item: any) => {
        if (!isSaas && item.visibility === 'saas') return false;
        if (item.module && item.module !== 'core' && !installedModules.has(String(item.module))) {
            return false;
        }
        return true;
    });

    // Pin SaaS Control to top if in SaaS context
    const filteredItems = isSaas
        ? [
            ...processedItems.filter((i: any) => i.title === 'SaaS Control'),
            ...processedItems.filter((i: any) => i.title !== 'SaaS Control')
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
                    : "w-0 -translate-x-full lg:translate-x-0 lg:w-20 opacity-0 lg:opacity-100"
            )}>
                {/* Logo Section */}
                <div className="h-11 flex items-center px-4 border-b border-gray-800/50 bg-[#0F172A]/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        {sidebarOpen && (
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                TSF CORE
                            </span>
                        )}
                    </div>
                </div>

                {/* Scope Switcher (only for superusers or dual view enabled) */}
                {sidebarOpen && (isSuperuser || dualViewEnabled) && canToggleScope && (
                    <div className="px-4 py-3 border-b border-gray-800/30">
                        <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800/50">
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                                    viewScope === 'INTERNAL'
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                        : "text-gray-400 hover:text-gray-200"
                                )}
                            >
                                <Shield className="w-3.5 h-3.5 mr-1.5" />
                                Internal
                            </button>
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                                    viewScope === 'OFFICIAL'
                                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                                        : "text-gray-400 hover:text-gray-200"
                                )}
                            >
                                <Globe className="w-3.5 h-3.5 mr-1.5" />
                                Official
                            </button>
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2.5 space-y-1 custom-scrollbar">
                    {filteredItems.map((item, idx) => (
                        <MenuItem
                            key={idx}
                            item={item}
                            openTab={openTab}
                            activeTab={activeTab}
                            installedModules={installedModules}
                        />
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-4 border-t border-gray-800/50 bg-[#0F172A]/80">
                    <button
                        onClick={toggleSidebar}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200 group"
                    >
                        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                        {sidebarOpen && <span className="text-sm font-medium">Collapse Menu</span>}
                    </button>
                    <div className="text-[10px] text-gray-500 mt-2 text-center">
                        V{PLATFORM_CONFIG.version}
                    </div>
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
    openTab: (title: string, path: string) => void,
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
                    "flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all duration-200 group relative overflow-hidden",
                    isActive || isChildActive
                        ? "bg-emerald-600/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20"
                        : "text-gray-400 hover:bg-gray-800/60 hover:text-white",
                    level > 0 && "py-1.5 rounded-lg text-[12px]"
                )}
            >
                {/* Active Indicator Strip */}
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                )}

                {Icon && (
                    <Icon size={level === 0 ? 18 : 16} className={clsx(isActive || isChildActive ? "text-emerald-400" : "group-hover:text-white transition-colors")} />
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
