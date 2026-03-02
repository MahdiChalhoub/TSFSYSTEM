'use client';

/**
 * Sidebar — V2 Theme-Aware Rebuild
 * ─────────────────────────────────
 * All colors via --app-* CSS vars. No hardcoded hex.
 * Active state: glass pill with --app-primary glow ring.
 * Section labels: micro typography (10px uppercase tracking-widest).
 * Stagger animation on mount via CSS classes from app-animations.css.
 * Version badge in footer.
 */

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
    Paintbrush,
    Landmark,
    UserCheck,
    Store,
    PanelLeftClose,
    PanelLeftOpen,
    Palette,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";
import { PLATFORM_CONFIG } from '@/lib/saas_config';
import { getSaaSModules, getDynamicSidebar } from "@/app/actions/saas/modules";
import { useAppTheme } from '@/components/app/AppThemeProvider';
import { AppThemeSelector } from '@/components/app/AppThemeSelector';

// ── Icon map ──────────────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
    LayoutDashboard, ShoppingBag, Box, Users, Briefcase, FileText,
    ShieldCheck, Settings, Zap, Layers, BarChart3, ShoppingCart, Package,
    CreditCard, Bot, Sparkles, Cloud, MessageSquare, Wrench, BookOpen,
    TrendingUp, Calendar, DollarSign, Bell, Tag, Warehouse, FolderTree,
    ServerCog, Building2, Shield, ClipboardList, ScrollText, Wallet,
    Globe, ListChecks, Trophy, Star, History, Landmark, UserCheck, Store,
};

function getIcon(name: string) { return ICON_MAP[name] || Box; }

// ── Menu tree ─────────────────────────────────────────────────
export const MENU_ITEMS = [
    {
        title: 'Overview',
        icon: LayoutDashboard,
        module: 'core',
        children: [
            { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, badge: 'REVIEW' },
            { title: 'Dashboard (Legacy)', path: '/dashboard/legacy', icon: LayoutDashboard, badge: 'LOCKED' },
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
                    { title: 'Supermarché POS', path: '/sales/supermarche', badge: 'NEW' },
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
                    { title: 'Product Master', path: '/products', badge: 'REVIEW' },
                    { title: 'Product (Legacy)', path: '/products/legacy', badge: 'LOCKED' },
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
                    { title: 'Journal Entries', path: '/finance/ledger', badge: 'REVIEW' },
                    { title: 'Ledger (Legacy)', path: '/finance/ledger/legacy', badge: 'LOCKED' },
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
            { title: 'Contacts & Leads', path: '/crm/contacts', icon: UserCheck, badge: 'REVIEW' },
            { title: 'Contacts (Legacy)', path: '/crm/contacts/legacy', icon: UserCheck, badge: 'LOCKED' },
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
            { title: 'Appearance & Theme', path: '/settings/appearance', icon: Paintbrush },
            { title: 'Custom Domains', path: '/settings/domains', icon: Globe },
            { title: 'Postings (Rules)', path: '/finance/settings/posting-rules', icon: ListChecks },
            { title: 'System Audit Log', path: '/finance/events', icon: History },
            { title: 'Subscription Info', path: '/subscription', icon: CreditCard },
        ]
    },
];

// ── Badge helper ──────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
    NEW: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    PENDING: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    REVIEW: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
    LOCKED: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    FINAL: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
};

function getBadge(badge?: string) {
    if (!badge) return null;
    const key = badge.toUpperCase();
    return { text: key, cls: BADGE_COLORS[key] || 'bg-gray-500/10 text-gray-400 border border-gray-500/20' };
}

// ── Sidebar root ──────────────────────────────────────────────
export function Sidebar({
    isSaas = false,
    isSuperuser = false,
    dualViewEnabled = false
}: {
    isSaas?: boolean;
    isSuperuser?: boolean;
    dualViewEnabled?: boolean;
}) {
    const { sidebarOpen, toggleSidebar, openTab, activeTab, viewScope, setViewScope, canToggleScope } = useAdmin();
    const { isDark } = useAppTheme();
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    const ALL_KNOWN_MODULES = ['core', 'pos', 'finance', 'inventory', 'crm', 'hr', 'purchases', 'ecommerce', 'mcp'];
    const [installedModules, setInstalledModules] = useState<Set<string>>(
        new Set(isSaas ? ['core', 'mcp'] : ALL_KNOWN_MODULES)
    );
    const [dynamicItems, setDynamicItems] = useState<SidebarDynamicItem[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [modules, sidebarData] = await Promise.all([getSaaSModules(), getDynamicSidebar()]);
                if (Array.isArray(modules)) {
                    setInstalledModules(new Set(modules.map((m: Record<string, unknown>) => m.code as string)));
                }
                if (Array.isArray(sidebarData)) {
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
            } catch (e) { console.error('Failed to fetch sidebar data', e); }
        }
        fetchData();
    }, []);

    const allItems = [...MENU_ITEMS, ...dynamicItems];
    const uniqueMap = new Map<string, any>();
    allItems.forEach((item: any) => {
        if (!item?.title) return;
        const key = String(item.title).toLowerCase().trim();
        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
    });

    const processedItems = Array.from(uniqueMap.values()).filter((item: any) => {
        if (!isSaas && item.visibility === 'saas') return false;
        if (item.module && item.module !== 'core' && !installedModules.has(String(item.module))) return false;
        return true;
    });

    const filteredItems = isSaas
        ? [
            ...processedItems.filter((i: any) => i.title === 'SaaS Control'),
            ...processedItems.filter((i: any) => i.title !== 'SaaS Control'),
        ]
        : processedItems;

    return (
        <React.Fragment>
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 lg:hidden"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={toggleSidebar}
                />
            )}

            <aside
                className={clsx(
                    'fixed lg:relative inset-y-0 left-0 flex flex-col shrink-0 overflow-hidden h-full z-50',
                    'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                    sidebarOpen
                        ? 'w-72 md:w-80 translate-x-0 opacity-100'
                        : 'w-0 -translate-x-full lg:translate-x-0 lg:w-[4.5rem] opacity-0 lg:opacity-100'
                )}
                style={{
                    background: 'var(--app-sidebar-bg)',
                    borderRight: '1px solid var(--app-sidebar-border)',
                    boxShadow: 'var(--app-shadow-lg)',
                    color: 'var(--app-sidebar-text)',
                    fontFamily: 'var(--app-font)',
                }}
            >
                {/* ── Logo ─────────────────────────────── */}
                <div
                    className="h-[3.25rem] flex items-center px-4 shrink-0"
                    style={{
                        borderBottom: '1px solid var(--app-sidebar-border)',
                        background: 'var(--app-sidebar-bg)',
                    }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Brand mark */}
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 14px var(--app-primary-glow)',
                            }}
                        >
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        {sidebarOpen && (
                            <span
                                className="text-base font-black tracking-tight truncate"
                                style={{ color: 'var(--app-text)' }}
                            >
                                TSF<span style={{ color: 'var(--app-primary)' }}> CORE</span>
                            </span>
                        )}
                    </div>
                    {/* Collapse toggle — visible when open */}
                    {sidebarOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="ml-auto shrink-0 p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    )}
                    {!sidebarOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="p-1.5 rounded-lg transition-colors mx-auto"
                            style={{ color: 'var(--app-sidebar-muted)' }}
                            title="Expand sidebar"
                        >
                            <PanelLeftOpen size={16} />
                        </button>
                    )}
                </div>

                {/* ── Scope Switcher (superuser) ─────── */}
                {sidebarOpen && (isSuperuser || dualViewEnabled) && canToggleScope && (
                    <div
                        className="px-3 py-2.5 shrink-0"
                        style={{ borderBottom: '1px solid var(--app-sidebar-border)' }}
                    >
                        <div
                            className="flex p-1 rounded-xl gap-1"
                            style={{ background: 'var(--app-surface-2)' }}
                        >
                            {(['INTERNAL', 'OFFICIAL'] as const).map((scope) => (
                                <button
                                    key={scope}
                                    onClick={() => setViewScope(scope)}
                                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200"
                                    style={viewScope === scope ? {
                                        background: 'var(--app-primary)',
                                        color: '#fff',
                                        boxShadow: '0 2px 8px var(--app-primary-glow)',
                                    } : {
                                        color: 'var(--app-sidebar-muted)',
                                    }}
                                >
                                    {scope === 'INTERNAL' ? <Shield className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                                    {scope.charAt(0) + scope.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Navigation ───────────────────────── */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-0.5 sidebar-nav">
                    {filteredItems.map((item, idx) => (
                        <MenuItem
                            key={idx}
                            item={item}
                            openTab={openTab}
                            activeTab={activeTab}
                            installedModules={installedModules}
                            sidebarOpen={sidebarOpen}
                            animDelay={idx * 30}
                        />
                    ))}
                </nav>

                {/* ── Footer ───────────────────────────── */}
                <div
                    className="shrink-0 p-3 space-y-2"
                    style={{ borderTop: '1px solid var(--app-sidebar-border)' }}
                >
                    {/* Theme selector trigger */}
                    {sidebarOpen && (
                        <button
                            onClick={() => setShowThemeSelector(!showThemeSelector)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 group"
                            style={{
                                color: 'var(--app-sidebar-muted)',
                                background: showThemeSelector ? 'var(--app-primary-light)' : 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-sidebar-surface)')}
                            onMouseLeave={e => (e.currentTarget.style.background = showThemeSelector ? 'var(--app-primary-light)' : 'transparent')}
                        >
                            <Palette size={16} />
                            <span className="text-xs font-semibold">Appearance</span>
                        </button>
                    )}

                    {/* Inline theme selector panel */}
                    {showThemeSelector && sidebarOpen && (
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{ border: '1px solid var(--app-border)' }}
                        >
                            <AppThemeSelector onClose={() => setShowThemeSelector(false)} />
                        </div>
                    )}

                    {/* Version badge */}
                    {sidebarOpen ? (
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-center"
                            style={{ color: 'var(--app-sidebar-muted)' }}>
                            V{PLATFORM_CONFIG.version}
                        </div>
                    ) : (
                        <div className="text-[9px] font-black text-center" style={{ color: 'var(--app-sidebar-muted)' }}>
                            {PLATFORM_CONFIG.version}
                        </div>
                    )}
                </div>
            </aside>
        </React.Fragment>
    );
}

// ── MenuItem (recursive) ──────────────────────────────────────
function MenuItem({
    item,
    openTab,
    activeTab,
    installedModules,
    sidebarOpen,
    level = 0,
    animDelay = 0,
}: {
    item: Record<string, any>;
    openTab: (title: string, path: string) => void;
    activeTab: string;
    installedModules: Set<string>;
    sidebarOpen: boolean;
    level?: number;
    animDelay?: number;
}) {
    if (item.module && item.module !== 'core' && !installedModules.has(item.module)) return null;

    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;

    const checkActive = (it: SidebarDynamicItem): boolean => {
        if (it.path === activeTab) return true;
        if (it.children) return it.children.some((c: SidebarDynamicItem) => checkActive(c));
        return false;
    };

    const isChildActive = hasChildren && item.children.some((c: SidebarDynamicItem) => checkActive(c));
    const isActive = activeTab === item.path;

    const [expanded, setExpanded] = useState(isChildActive);
    useEffect(() => {
        if (isChildActive) setExpanded(true);
    }, [activeTab, isChildActive]);

    const handleClick = () => {
        if (hasChildren) setExpanded(!expanded);
        else if (item.path) openTab(item.title, item.path);
    };

    const badge = getBadge(item.badge);
    const iconSize = level === 0 ? 18 : 15;

    // Top-level: larger pill rows
    // Nested: smaller, indented
    const isTopLevel = level === 0;

    return (
        <div
            className="animate-stagger-item"
            style={{ animationDelay: `${animDelay}ms` }}
        >
            <div
                onClick={handleClick}
                title={!sidebarOpen ? item.title : undefined}
                className={clsx(
                    'flex items-center gap-2.5 cursor-pointer select-none relative overflow-hidden rounded-xl group transition-all duration-150',
                    isTopLevel ? 'px-3 py-2' : 'px-2.5 py-1.5',
                )}
                style={isActive || isChildActive ? {
                    background: 'var(--app-sidebar-active)',
                    color: 'var(--app-primary)',
                    boxShadow: isActive ? 'inset 0 0 0 1px var(--app-primary-glow), 0 2px 12px var(--app-primary-glow)' : 'none',
                } : {
                    color: 'var(--app-sidebar-text)',
                }}
                onMouseEnter={e => {
                    if (!isActive && !isChildActive) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--app-sidebar-surface)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--app-text)';
                    }
                }}
                onMouseLeave={e => {
                    if (!isActive && !isChildActive) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--app-sidebar-text)';
                    }
                }}
            >
                {/* Active left accent strip */}
                {isActive && (
                    <div
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{ background: 'var(--app-primary)' }}
                    />
                )}

                {Icon && (
                    <Icon
                        size={iconSize}
                        className="shrink-0 transition-none"
                        style={isActive || isChildActive ? { color: 'var(--app-primary)' } : { color: 'var(--app-sidebar-muted)' }}
                    />
                )}

                {(sidebarOpen || level > 0) && (
                    <>
                        <span
                            className={clsx(
                                'flex-1 truncate',
                                isTopLevel ? 'text-sm font-semibold' : 'text-xs font-medium',
                            )}
                        >
                            {item.title}
                        </span>

                        {badge && (
                            <span className={clsx('text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md', badge.cls)}>
                                {badge.text}
                            </span>
                        )}

                        {hasChildren && (
                            <ChevronRight
                                size={14}
                                className={clsx('shrink-0 transition-transform duration-200', expanded && 'rotate-90')}
                                style={{ color: 'var(--app-sidebar-muted)' }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Children */}
            {hasChildren && expanded && sidebarOpen && (
                <div
                    className="ml-7 pl-3 my-1 space-y-0.5"
                    style={{ borderLeft: '1px dashed var(--app-sidebar-border)' }}
                >
                    {item.children.map((child: Record<string, any>, idx: number) => (
                        <MenuItem
                            key={idx}
                            item={child}
                            openTab={openTab}
                            activeTab={activeTab}
                            installedModules={installedModules}
                            sidebarOpen={sidebarOpen}
                            level={level + 1}
                            animDelay={idx * 20}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
