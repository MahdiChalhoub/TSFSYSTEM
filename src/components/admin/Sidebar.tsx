'use client';

import { useAdmin } from '@/context/AdminContext';
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
    Zap
} from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { logoutAction } from "@/app/actions/auth";
import { getSaaSModules } from "@/app/actions/saas/modules";

// Data Structure for the Recursive Menu
const MENU_ITEMS = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/admin',
        module: 'core'
    },
    {
        title: 'Commercial',
        icon: ShoppingBag,
        module: 'pos',
        children: [
            { title: 'POS Terminal', path: '/admin/sales' },
            { title: 'Purchase Registry', path: '/admin/purchases' },
            { title: 'New PO Invoice', path: '/admin/purchases/new' },
        ]
    },
    {
        title: 'Inventory',
        icon: Box,
        module: 'inventory',
        children: [
            { title: 'Product Master', path: '/admin/products' },
            { title: 'Product Groups', path: '/admin/products?view=grouped' },
            { title: 'New Product Group', path: '/admin/products/create-group' },
            { title: 'Barcode Configuration', path: '/admin/inventory/barcode', module: 'inventory' },
            { title: 'Warehouses & Zones', path: '/admin/inventory/warehouses' },
            { title: 'Stock Adjustments', path: '/admin/inventory/adjustments' },
            { title: 'Global Inventory', path: '/admin/inventory/global' },
            { title: 'Categories', path: '/admin/inventory/categories' },
            { title: 'Categories Audit', path: '/admin/inventory/categories/maintenance' },
            { title: 'Units & Packaging', path: '/admin/inventory/units' },
            { title: 'Brands', path: '/admin/inventory/brands' },
            { title: 'Countries', path: '/admin/inventory/countries' },
            { title: 'Attributes', path: '/admin/inventory/attributes' },
            { title: 'System Maintenance', path: '/admin/inventory/maintenance' },
        ]
    },
    {
        title: 'Finance',
        icon: FileText,
        module: 'finance',
        children: [
            { title: 'Performance Dashboard', path: '/admin/finance/dashboard' },
            { title: 'Accounts & Drawers', path: '/admin/finance/accounts' },
            { title: 'Chart of Accounts', path: '/admin/finance/chart-of-accounts' },
            { title: 'COA Templates', path: '/admin/finance/chart-of-accounts/templates' },
            { title: 'Migration Tool', path: '/admin/finance/chart-of-accounts/migrate' },
            { title: 'General Ledger', path: '/admin/finance/ledger' },
            { title: 'Opening Balances', path: '/admin/finance/ledger/opening' },
            { title: 'Account Statement', path: '/admin/finance/reports/statement' },
            { title: 'Trial Balance', path: '/admin/finance/reports/trial-balance' },
            { title: 'Profit & Loss', path: '/admin/finance/reports/pnl' },
            { title: 'Balance Sheet', path: '/admin/finance/reports/balance-sheet' },
            { title: 'Fiscal Years', path: '/admin/finance/fiscal-years' },
            { title: 'Pricing Engine', path: '/admin/finance/pricing' },
            { title: 'Loan Contracts', path: '/admin/finance/loans' },
            { title: 'Financial Events', path: '/admin/finance/events' },
            { title: 'Posting Rules', path: '/admin/finance/settings/posting-rules' },
            { title: 'Financial Settings', path: '/admin/finance/settings' },
        ]
    },
    {
        title: 'CRM',
        icon: Users,
        module: 'crm',
        children: [
            { title: 'Contact Center', path: '/admin/crm/contacts' },
            { title: 'Customer Loyalty', path: '/admin/crm/loyalty' },
            { title: 'Supplier Portals', path: '/admin/crm/suppliers' },
        ]
    },
    {
        title: 'HR & Teams',
        icon: ShieldCheck,
        module: 'hr',
        children: [
            { title: 'Employee Manager', path: '/admin/hr/employees' },
            { title: 'Payroll & Accruals', path: '/admin/hr/payroll' },
            { title: 'Enlistment Approvals', path: '/admin/users/approvals' },
            { title: 'Access Control (Roles)', path: '/admin/hr/roles' },
        ]
    },
    {
        title: 'System Settings',
        icon: Settings,
        module: 'core',
        children: [
            { title: 'Sites & Branches', path: '/admin/settings/sites' },
        ]
    },
    {
        title: 'Demo Feature',
        icon: Box,
        module: 'demo',
        path: '/admin/saas/demo'
    },
    {
        title: 'Vantage Voyager',
        icon: Zap,
        module: 'test_vantage',
        path: '/admin/saas/test_vantage'
    },
    {
        title: 'SaaS Panel',
        icon: Briefcase,
        module: 'core',
        children: [
            { title: 'Master Dashboard', path: '/admin/saas/dashboard' },
            { title: 'Organizations', path: '/admin/saas/organizations' },
            { title: 'Module Management', path: '/admin/saas/modules' },
            { title: 'Instance Switcher', path: '/admin/saas/switcher' },
            { title: 'Platform Health', path: '/admin/saas/health' },
        ]
    },
];

export function Sidebar({ isSaas = false }: { isSaas?: boolean }) {
    const { sidebarOpen, openTab, activeTab, viewScope, setViewScope } = useAdmin();
    const [installedModules, setInstalledModules] = useState<Set<string>>(new Set(['core'])); // Default core

    useEffect(() => {
        // Fetch active modules to filter sidebar
        async function fetchModules() {
            try {
                // If we are in SaaS context, we might want to show EVERYTHING? 
                // No, the user wants the sidebar to reflect the *installed* system modules.
                // Even for SaaS Admin, if 'inventory' is deleted, it shouldn't be in the menu.
                const modules = await getSaaSModules();
                if (Array.isArray(modules)) {
                    setInstalledModules(new Set(modules.map((m: any) => m.code)));
                }
            } catch (e) {
                console.error("Failed to fetch sidebar modules", e);
            }
        }
        fetchModules();
    }, []);

    const filteredItems = MENU_ITEMS.filter(item => {
        // 1. Filter by SaaS Panel visibility logic
        if (!isSaas && item.title === 'SaaS Panel') return false;

        // 2. Filter by Installed Module
        // If the item has a 'module' property, check if it's installed.
        // We always allow 'core'
        if (item.module && item.module !== 'core' && !installedModules.has(item.module)) {
            return false;
        }
        return true;
    });

    if (!sidebarOpen) return null;

    return (
        <aside className="w-80 bg-[#0F172A] border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto h-full text-gray-300 shadow-2xl relative z-30 transition-all duration-300">
            <div className="p-8 border-b border-gray-800/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white font-bold text-xl">
                    T
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-none">TSF City</h1>
                    <p className="text-xs text-emerald-400 font-medium mt-1.5">{isSaas ? 'Federation Admin' : 'Workspace Admin'}</p>
                </div>
            </div>

            {/* View Scope Switcher */}
            <div className="mx-6 mt-6 p-1.5 bg-[#0B1120] rounded-2xl border border-gray-800 flex gap-1">
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
                    Declared
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
                    Both
                </button>
            </div>

            <div className="p-6 space-y-2 flex-1">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 px-3 mt-2">Main Menu</div>
                {filteredItems.map((item, idx) => (
                    <MenuItem key={idx} item={item} openTab={openTab} activeTab={activeTab} installedModules={installedModules} />
                ))}
            </div>

            <div className="p-6 border-t border-gray-800/50 bg-[#0B1120]">
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
    );
}

function MenuItem({ item, openTab, activeTab, installedModules }: { item: any, openTab: any, activeTab: string, installedModules: Set<string> }) {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    // Check if any child is active
    const isChildActive = hasChildren && item.children.some((child: any) => child.path === activeTab);

    // Initialize state based on if child is active
    const [expanded, setExpanded] = useState(isChildActive);

    // Update expansion when route changes
    useEffect(() => {
        if (isChildActive) setExpanded(true);
    }, [activeTab, isChildActive]);

    const isActive = activeTab === item.path;

    const handleClick = () => {
        if (hasChildren) {
            setExpanded(!expanded);
        } else {
            openTab(item.title, item.path);
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                className={clsx(
                    "flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer select-none transition-all duration-200 group relative overflow-hidden",
                    isActive || isChildActive
                        ? "bg-emerald-600/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20"
                        : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                )}
            >
                {/* Active Indicator Strip */}
                {(isActive || isChildActive) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                )}

                <Icon size={22} className={clsx(isActive || isChildActive ? "text-emerald-400" : "group-hover:text-white transition-colors")} />
                <span className="flex-1 text-sm font-medium tracking-wide">{item.title}</span>
                {hasChildren && (
                    <div className={clsx("transition-transform duration-200 text-gray-500", expanded ? "rotate-90 text-emerald-500" : "")}>
                        <ChevronRight size={18} />
                    </div>
                )}
            </div>

            {hasChildren && expanded && (
                <div className="ml-6 pl-5 border-l border-gray-800 my-2 space-y-1.5">
                    {item.children.map((child: any, idx: number) => {
                        // Skip if child is module-bound and module not installed
                        if (child.module && child.module !== 'core' && !installedModules.has(child.module)) {
                            return null;
                        }

                        const isCurrentChild = activeTab === child.path;
                        return (
                            <div
                                key={idx}
                                onClick={() => openTab(child.title, child.path)}
                                className={clsx(
                                    "text-sm py-2.5 px-4 rounded-xl cursor-pointer block truncate transition-all",
                                    isCurrentChild
                                        ? "text-emerald-400 font-medium bg-emerald-900/10"
                                        : "text-gray-500 hover:text-gray-200 hover:translate-x-1"
                                )}
                            >
                                {child.title}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
