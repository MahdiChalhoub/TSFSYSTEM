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
    LogOut
} from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';

// Data Structure for the Recursive Menu
const MENU_ITEMS = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/admin'
    },
    {
        title: 'POS System',
        icon: ShoppingBag,
        path: '/admin/sales'
    },
    {
        title: 'Inventory',
        icon: Box,
        children: [
            { title: 'Units & Packaging', path: '/admin/inventory/units' },
            { title: 'Countries', path: '/admin/inventory/countries' },
            { title: 'Categories', path: '/admin/inventory/categories' },
            { title: 'Brands', path: '/admin/inventory/brands' },
            { title: 'Attributes', path: '/admin/inventory/attributes' },
            { title: 'Product Master', path: '/admin/products' },
            { title: 'Stock Adjustment', path: '/admin/inventory/adjust' },
            { title: 'Stock Transfer', path: '/admin/inventory/transfer' },
            { title: 'Stock Movement Report', path: '/admin/reports/stock' },
            { title: 'Expiry Date Alert', path: '/admin/inventory/expiry' },
            { title: 'Printing Labels', path: '/admin/inventory/labels' },
        ]
    },
    {
        title: 'Purchases',
        icon: Briefcase,
        children: [
            { title: 'Purchase Request', path: '/admin/purchases/request' },
            { title: 'Purchase Order', path: '/admin/purchases/order' },
            { title: 'Goods Received', path: '/admin/purchases/grn' },
        ]
    },
    {
        title: 'HR & Users',
        icon: Users,
        children: [
            { title: 'Employees', path: '/admin/hr/employees' },
            { title: 'Tasks Management', path: '/admin/hr/tasks' },
        ]
    },
    {
        title: 'Finance',
        icon: FileText,
        children: [
            { title: 'Accounts', path: '/admin/finance/accounts' },
            { title: 'Expenses', path: '/admin/finance/expenses' },
            { title: 'Profit & Loss', path: '/admin/finance/pl' },
        ]
    },
];

export function Sidebar() {
    const { sidebarOpen, openTab, activeTab } = useAdmin();

    if (!sidebarOpen) return null;

    return (
        <aside className="w-80 bg-[#0F172A] border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto h-full text-gray-300 shadow-2xl relative z-30 transition-all duration-300">
            {/* Logo Section */}
            <div className="p-8 border-b border-gray-800/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white font-bold text-xl">
                    T
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-none">TSF City</h1>
                    <p className="text-xs text-emerald-400 font-medium mt-1.5">Marcory Branch</p>
                </div>
            </div>

            <div className="p-6 space-y-2 flex-1">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 px-3 mt-2">Main Menu</div>
                {MENU_ITEMS.map((item, idx) => (
                    <MenuItem key={idx} item={item} openTab={openTab} activeTab={activeTab} />
                ))}
            </div>

            <div className="p-6 border-t border-gray-800/50 bg-[#0B1120]">
                <button className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl hover:bg-gray-800/50 text-gray-400 hover:text-white transition-all group">
                    <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}

function MenuItem({ item, openTab, activeTab }: { item: any, openTab: any, activeTab: string }) {
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
