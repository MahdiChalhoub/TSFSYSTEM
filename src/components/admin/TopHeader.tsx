'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell, Search, User, Menu, Settings, LogOut, HelpCircle,
    Palette, Sun, Moon, ChevronDown, LayoutTemplate,
    PanelLeft, Rows3, Building2, Globe, X, ChevronRight,
    Eye, EyeOff
} from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';
import { useAppTheme } from '@/components/app/AppThemeProvider';

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
    title: string;
    icon?: any;
    path?: string;
    module?: string;
    children?: MenuItem[];
}

interface TopHeaderProps {
    sites: Record<string, any>[];
    organizations?: Record<string, any>[];
    currentSlug?: string;
    user?: Record<string, any>;
}

// ── Mega-Menu Dropdown ────────────────────────────────────────────────────────

function MegaMenuDropdown({
    item,
    onClose,
}: {
    item: MenuItem;
    onClose: () => void;
}) {
    const router = useRouter();
    const { openTab } = useAdmin();

    const navigate = (path: string, title: string) => {
        openTab(title, path);
        onClose();
    };

    if (!item.children) return null;

    // Split children into columns (max 3 columns)
    const cols = item.children;
    const colCount = Math.min(cols.length, 4);

    return (
        <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                minWidth: '240px',
                width: `${colCount * 220}px`,
                maxWidth: '90vw',
            }}
        >
            {/* Header */}
            <div
                className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}
            >
                {item.icon && <item.icon size={14} style={{ color: 'var(--app-primary)' }} />}
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                    {item.title}
                </span>
            </div>

            {/* Columns */}
            <div className={`grid gap-px p-2`} style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                {cols.map((group) => (
                    <div key={group.title} className="p-1">
                        {/* Group header */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5">
                            {group.icon && <group.icon size={12} style={{ color: 'var(--app-primary)' }} />}
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>
                                {group.title}
                            </span>
                        </div>

                        {/* Pages */}
                        {group.children?.map((page) => (
                            <button
                                key={page.path}
                                onClick={() => navigate(page.path!, page.title)}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-100 group"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
                                }}
                            >
                                <ChevronRight size={10} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                <span className="truncate text-xs font-medium">{page.title}</span>
                            </button>
                        ))}

                        {/* If no children (direct links) */}
                        {!group.children && group.path && (
                            <button
                                onClick={() => navigate(group.path!, group.title)}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-100"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
                                }}
                            >
                                <span className="truncate text-xs font-medium">{group.title}</span>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Top Nav Item ──────────────────────────────────────────────────────────────

function TopNavItem({ item }: { item: MenuItem }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { openTab } = useAdmin();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const hasChildren = !!item.children?.length;

    if (!hasChildren && item.path) {
        return (
            <button
                onClick={() => openTab(item.title, item.path!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap"
                style={{ color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)';
                }}
            >
                {item.icon && <item.icon size={14} />}
                {item.title}
            </button>
        );
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                onMouseEnter={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap"
                style={{
                    background: open ? 'var(--app-surface-2)' : 'transparent',
                    color: open ? 'var(--app-text)' : 'var(--app-text-muted)',
                }}
            >
                {item.icon && <item.icon size={14} />}
                {item.title}
                {hasChildren && (
                    <ChevronDown
                        size={11}
                        style={{
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                        }}
                    />
                )}
            </button>

            {open && hasChildren && (
                <MegaMenuDropdown item={item} onClose={() => setOpen(false)} />
            )}
        </div>
    );
}

// ── Main TopHeader ────────────────────────────────────────────────────────────

export function TopHeader({ sites, organizations = [], currentSlug, user }: TopHeaderProps) {
    const {
        toggleSidebar,
        sidebarOpen,
        viewScope,
        setViewScope,
        canToggleScope,
        navLayout,
        setNavLayout,
    } = useAdmin();

    const [profileOpen, setProfileOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const themeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
            if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const {
        currentTheme,
        allThemes,
        isLoading,
        isDark,
        setTheme,
        toggleColorMode,
        activeColors,
    } = useAppTheme();

    const themeName = currentTheme?.name || 'Default';
    const themeSlug = currentTheme?.slug || 'midnight-pro';
    const isTopnav = navLayout === 'topnav';

    // Active org for currency/industry display
    const activeOrg = organizations.find((o) => o.slug === currentSlug);

    return (
        <header
            className="sticky top-0 z-40 shrink-0 flex flex-col"
            style={{
                background: mounted
                    ? (isDark ? 'rgba(10,14,26,0.85)' : 'rgba(255,255,255,0.88)')
                    : 'rgba(10,14,26,0.85)',
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                borderBottom: '1px solid var(--app-border)',
            }}
            suppressHydrationWarning
        >
            {/* ── Main Bar ── */}
            <div className="flex items-center h-14 px-3 md:px-5 gap-2">

                {/* ─── LEFT: Mode toggle + hamburger/logo + topnav items ─── */}
                <div className="flex items-center gap-1 flex-shrink-0">

                    {/* Layout mode toggle */}
                    <button
                        onClick={() => setNavLayout(isTopnav ? 'sidebar' : 'topnav')}
                        title={isTopnav ? 'Switch to Sidebar Navigation' : 'Switch to Top Navigation'}
                        className="p-2 rounded-xl transition-all duration-200 flex-shrink-0"
                        style={{
                            background: 'var(--app-surface-2)',
                            color: 'var(--app-primary)',
                            border: '1px solid var(--app-border)',
                        }}
                    >
                        {isTopnav
                            ? <PanelLeft size={15} />
                            : <Rows3 size={15} />
                        }
                    </button>

                    {/* Hamburger (sidebar mode only) */}
                    {!isTopnav && (
                        <button
                            onClick={toggleSidebar}
                            className="p-2 rounded-xl transition-all duration-200 flex-shrink-0"
                            style={{ color: 'var(--app-text-muted)' }}
                        >
                            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    )}

                    {/* Brand mark (topnav mode only) */}
                    {isTopnav && (
                        <div
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl mr-1 flex-shrink-0"
                            style={{ background: 'var(--app-primary-light)' }}
                        >
                            <div className="w-5 h-5 rounded-lg flex-shrink-0" style={{ background: 'var(--app-primary)' }} />
                            <span className="text-xs font-black tracking-tight" style={{ color: 'var(--app-primary)' }}>TSF</span>
                        </div>
                    )}
                </div>

                {/* ─── TOP NAV ITEMS (topnav mode) ─── */}
                {isTopnav && (
                    <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-hidden">
                        {MENU_ITEMS.map((item) => (
                            <TopNavItem key={item.title} item={item as MenuItem} />
                        ))}
                    </nav>
                )}

                {/* ─── CENTER: Switchers + search (sidebar mode) ─── */}
                {!isTopnav && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                        {/* Currency / Industry */}
                        {currentSlug !== 'saas' && activeOrg && (
                            <div
                                className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                                style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
                            >
                                {activeOrg.currency_code && (
                                    <div className="flex items-center gap-1.5 pr-2" style={{ borderRight: '1px solid var(--app-border)' }}>
                                        <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: 'var(--app-text-faint)' }}>CCY</span>
                                        <span className="text-xs font-bold" style={{ color: 'var(--app-primary)' }}>
                                            {activeOrg.currency_code}
                                        </span>
                                    </div>
                                )}
                                {activeOrg.business_type_name && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-medium truncate max-w-[90px]" style={{ color: 'var(--app-text-muted)' }}>
                                            {activeOrg.business_type_name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="hidden lg:block">
                            <SiteSwitcher sites={sites} />
                        </div>

                        {/* Search */}
                        <button
                            type="button"
                            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                            className="hidden lg:flex flex-1 max-w-sm items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all cursor-text"
                            style={{
                                background: 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-text-faint)',
                            }}
                        >
                            <Search size={14} />
                            <span className="flex-1 text-left text-xs">Search...</span>
                            <kbd
                                className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}
                            >
                                ⌃K
                            </kbd>
                        </button>
                    </div>
                )}

                {/* Search in topnav mode (center) */}
                {isTopnav && (
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="hidden xl:flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all cursor-text flex-shrink-0"
                        style={{
                            background: 'var(--app-surface-2)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text-faint)',
                            minWidth: '180px',
                        }}
                    >
                        <Search size={14} />
                        <span className="flex-1 text-left text-xs">Search...</span>
                        <kbd
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}
                        >
                            ⌃K
                        </kbd>
                    </button>
                )}

                {/* ─── RIGHT: Actions ─── */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">

                    {/* Mobile search */}
                    <button
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="xl:hidden p-2 rounded-xl transition-all"
                        style={{ color: 'var(--app-text-faint)' }}
                    >
                        <Search size={17} />
                    </button>

                    {/* Official / Internal scope toggle */}
                    {canToggleScope && mounted && (
                        <div
                            className="hidden sm:flex items-center p-0.5 rounded-xl gap-0.5 flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
                        >
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150"
                                style={
                                    viewScope === 'OFFICIAL'
                                        ? { background: 'var(--app-primary)', color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }
                                        : { color: 'var(--app-text-faint)' }
                                }
                            >
                                <Eye size={10} />
                                Official
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150"
                                style={
                                    viewScope === 'INTERNAL'
                                        ? { background: 'var(--app-surface)', color: 'var(--app-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                                        : { color: 'var(--app-text-faint)' }
                                }
                            >
                                <EyeOff size={10} />
                                Internal
                            </button>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="hidden sm:block h-6 w-px mx-0.5 flex-shrink-0" style={{ background: 'var(--app-border)' }} />

                    {/* Notifications */}
                    <NotificationBell />

                    {/* Dark / Light toggle */}
                    <button
                        onClick={toggleColorMode}
                        className="p-2 rounded-xl transition-all duration-200 flex-shrink-0"
                        style={{
                            background: 'var(--app-surface-2)',
                            color: 'var(--app-text-muted)',
                            border: '1px solid var(--app-border)',
                        }}
                        title={mounted ? (isDark ? 'Light Mode' : 'Dark Mode') : 'Toggle'}
                        suppressHydrationWarning
                    >
                        {mounted ? (isDark ? <Sun size={15} /> : <Moon size={15} />) : <Moon size={15} />}
                    </button>

                    {/* Theme picker */}
                    <div className="relative flex-shrink-0" ref={themeRef}>
                        <button
                            onClick={() => setThemeOpen(!themeOpen)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200"
                            style={{
                                background: 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-text-muted)',
                            }}
                            title={mounted ? `Theme: ${themeName}` : 'Theme'}
                            suppressHydrationWarning
                        >
                            <div
                                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                style={{ background: mounted ? activeColors.primary : 'var(--app-primary)' }}
                                suppressHydrationWarning
                            />
                            <span className="text-[11px] font-bold hidden md:inline truncate max-w-[70px]" suppressHydrationWarning>
                                {mounted ? themeName : ''}
                            </span>
                            <Palette size={12} />
                        </button>

                        {themeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                                <div
                                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                                >
                                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>UI Theme</p>
                                        {isLoading && (
                                            <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-primary)', borderTopColor: 'transparent' }} />
                                        )}
                                    </div>
                                    <div className="p-2 grid gap-1 max-h-80 overflow-y-auto">
                                        {allThemes.length === 0 && !isLoading && (
                                            <p className="text-xs text-center py-4" style={{ color: 'var(--app-text-faint)' }}>
                                                No themes available.
                                            </p>
                                        )}
                                        {allThemes.map((t) => {
                                            const isActive = themeSlug === t.slug;
                                            const previewColor = t.presetData?.colors?.dark?.primary || t.presetData?.colors?.light?.primary || '#888';
                                            const previewBg = t.presetData?.colors?.dark?.bg || '#000';
                                            const previewSurface = t.presetData?.colors?.dark?.surface || '#111';
                                            return (
                                                <button
                                                    key={t.slug || t.id}
                                                    onClick={() => { setTheme(t.slug); setThemeOpen(false); }}
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full"
                                                    style={{
                                                        background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                        border: isActive ? '1px solid var(--app-primary)' : '1px solid transparent',
                                                    }}
                                                >
                                                    <div
                                                        className="w-7 h-7 rounded-lg flex-shrink-0"
                                                        style={{ background: `linear-gradient(135deg, ${previewBg} 0%, ${previewSurface} 50%, ${previewColor} 100%)` }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{t.name}</p>
                                                        <p className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                                                            {t.description || t.category || 'Custom theme'}
                                                        </p>
                                                    </div>
                                                    {isActive && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--app-primary)' }} />}
                                                    {!t.isSystem && (
                                                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                                            Custom
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                                            {allThemes.length} themes · Auto-saved
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block h-6 w-px mx-0.5 flex-shrink-0" style={{ background: 'var(--app-border)' }} />

                    {/* User profile */}
                    <div className="relative flex-shrink-0" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-all"
                            style={{ border: '1px solid transparent' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                            >
                                <User size={16} />
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-xs font-bold leading-tight truncate max-w-[90px]" style={{ color: 'var(--app-text)' }}>
                                    {user?.first_name || user?.username || 'User'}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-tight" style={{ color: 'var(--app-text-faint)' }}>
                                    {user?.is_superuser ? 'Admin' : 'Member'}
                                </p>
                            </div>
                            <ChevronDown size={12} style={{ color: 'var(--app-text-faint)' }} />
                        </button>

                        {profileOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                                <div
                                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                                >
                                    {/* User info */}
                                    <div className="p-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                                            >
                                                <User size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>
                                                    {user?.first_name} {user?.last_name}
                                                </p>
                                                <p className="text-[10px] truncate" style={{ color: 'var(--app-text-faint)' }}>
                                                    {user?.email || user?.username}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Scope pill */}
                                        {canToggleScope && mounted && (
                                            <div
                                                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                                                style={{
                                                    background: viewScope === 'OFFICIAL' ? 'var(--app-primary)' : 'var(--app-surface-2)',
                                                    color: viewScope === 'OFFICIAL' ? '#fff' : 'var(--app-text-muted)',
                                                }}
                                            >
                                                {viewScope === 'OFFICIAL' ? <Eye size={9} /> : <EyeOff size={9} />}
                                                {viewScope} View
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => { setProfileOpen(false); window.location.href = '/settings'; }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all"
                                            style={{ color: 'var(--app-text-muted)' }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <Settings size={14} /> Settings
                                        </button>
                                        <button
                                            onClick={() => { setProfileOpen(false); window.location.href = '/help'; }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all"
                                            style={{ color: 'var(--app-text-muted)' }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <HelpCircle size={14} /> Help & Support
                                        </button>
                                    </div>
                                    <div className="p-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <form action="/api/auth/logout" method="POST">
                                            <button
                                                type="submit"
                                                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all"
                                                style={{ color: 'var(--app-error)' }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                            >
                                                <LogOut size={14} /> Sign Out
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Topnav mode: Tenant / Site row ── */}
            {isTopnav && (
                <div
                    className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}
                >
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />
                    {currentSlug !== 'saas' && activeOrg?.currency_code && (
                        <div
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg flex-shrink-0"
                            style={{ background: 'var(--app-primary-light)', border: '1px solid var(--app-border)' }}
                        >
                            <Globe size={10} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-[10px] font-bold" style={{ color: 'var(--app-primary)' }}>
                                {activeOrg.currency_code}
                            </span>
                        </div>
                    )}
                    {currentSlug !== 'saas' && activeOrg?.business_type_name && (
                        <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--app-text-faint)' }}>
                            {activeOrg.business_type_name}
                        </span>
                    )}
                    <div className="flex-shrink-0">
                        <SiteSwitcher sites={sites} />
                    </div>
                </div>
            )}
        </header>
    );
}
