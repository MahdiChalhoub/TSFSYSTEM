'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useRef, memo } from 'react';
import {
    Bell, Search, User, Menu, Settings, LogOut, HelpCircle,
    Palette, Sun, Moon, ChevronDown, PanelLeft, Rows3,
    Building2, Globe, X, ChevronRight, Eye, EyeOff,
    LayoutGrid, Zap,
} from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';
import { useAppTheme } from '@/components/app/AppThemeProvider';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Mega-menu dropdown ────────────────────────────────────────────────────────

function MegaMenuDropdown({ item, onClose }: { item: MenuItem; onClose: () => void }) {
    const { openTab } = useAdmin();
    const cols = item.children ?? [];
    const colCount = Math.min(cols.length, 4);

    if (!cols.length) return null;

    return (
        <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                width: `${colCount * 210}px`,
                maxWidth: '92vw',
            }}
        >
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                {item.icon && <item.icon size={13} style={{ color: 'var(--app-primary)' }} />}
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{item.title}</span>
            </div>
            <div className="grid gap-px p-2" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                {cols.map((group) => (
                    <div key={group.title} className="p-1">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5">
                            {group.icon && <group.icon size={11} style={{ color: 'var(--app-primary)' }} />}
                            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>{group.title}</span>
                        </div>
                        {group.children?.map((page) => (
                            <button
                                key={page.path}
                                onClick={() => { openTab(page.title, page.path!); onClose(); }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-100"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                            >
                                <ChevronRight size={9} className="opacity-40 flex-shrink-0" />
                                <span className="truncate text-xs font-medium">{page.title}</span>
                            </button>
                        ))}
                        {!group.children && group.path && (
                            <button
                                onClick={() => { openTab(group.title, group.path!); onClose(); }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-100"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
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

// ── Top-nav item ──────────────────────────────────────────────────────────────

const TopNavItem = memo(function TopNavItem({ item }: { item: MenuItem }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { openTab } = useAdmin();

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const hasChildren = !!item.children?.length;

    if (!hasChildren && item.path) {
        return (
            <button
                onClick={() => openTab(item.title, item.path!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all"
                style={{ color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
            >
                {item.icon && <item.icon size={13} />}
                {item.title}
            </button>
        );
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                onMouseEnter={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all"
                style={{ background: open ? 'var(--app-surface-2)' : 'transparent', color: open ? 'var(--app-text)' : 'var(--app-text-muted)' }}
            >
                {item.icon && <item.icon size={13} />}
                {item.title}
                {hasChildren && <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
            </button>
            {open && hasChildren && <MegaMenuDropdown item={item} onClose={() => setOpen(false)} />}
        </div>
    );
});

// ── Icon button helper ─────────────────────────────────────────────────────────

function IconBtn({ onClick, title, children, active }: { onClick?: () => void; title?: string; children: React.ReactNode; active?: boolean }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 flex-shrink-0"
            style={{
                background: active ? 'var(--app-primary-light)' : 'transparent',
                color: active ? 'var(--app-primary)' : 'var(--app-text-muted)',
            }}
            onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text)'; } }}
            onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; } }}
        >
            {children}
        </button>
    );
}

// ── Theme picker panel ─────────────────────────────────────────────────────────

function ThemePanel({ onClose }: { onClose: () => void }) {
    const { currentTheme, allThemes, isLoading, setTheme } = useAppTheme();
    const themeSlug = currentTheme?.slug || 'midnight-pro';

    return (
        <div
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
        >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>UI Theme</p>
                {isLoading && <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-primary)', borderTopColor: 'transparent' }} />}
            </div>
            <div className="p-2 grid gap-0.5 max-h-80 overflow-y-auto custom-scrollbar">
                {allThemes.length === 0 && !isLoading && (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--app-text-faint)' }}>No themes available.</p>
                )}
                {allThemes.map((t) => {
                    const isActive = themeSlug === t.slug;
                    const primary = t.presetData?.colors?.dark?.primary || '#888';
                    const bg = t.presetData?.colors?.dark?.bg || '#0a0e1a';
                    const surface = t.presetData?.colors?.dark?.surface || '#111';
                    return (
                        <button
                            key={t.slug || t.id}
                            onClick={() => { setTheme(t.slug); onClose(); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full"
                            style={{ background: isActive ? 'var(--app-primary-light)' : 'transparent', border: isActive ? '1px solid var(--app-primary)' : '1px solid transparent' }}
                        >
                            <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: bg }}>
                                <div className="w-full h-1/2" style={{ background: surface }} />
                                <div className="w-2/3 h-1/2 ml-auto" style={{ background: primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate" style={{ color: 'var(--app-text)' }}>{t.name}</p>
                                <p className="text-[9px] truncate" style={{ color: 'var(--app-text-faint)' }}>{t.description || t.category || 'Custom theme'}</p>
                            </div>
                            {isActive && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--app-primary)' }} />}
                            {!t.isSystem && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>Custom</span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                <p className="text-[9px] font-medium" style={{ color: 'var(--app-text-faint)' }}>{allThemes.length} themes · Auto-saved</p>
            </div>
        </div>
    );
}

// ── User menu panel ────────────────────────────────────────────────────────────

function UserPanel({ user, viewScope, canToggleScope, mounted, onClose }: {
    user?: Record<string, any>;
    viewScope: 'OFFICIAL' | 'INTERNAL';
    canToggleScope: boolean;
    mounted: boolean;
    onClose: () => void;
}) {
    const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || (user?.username?.[0] || 'U').toUpperCase();

    return (
        <div
            className="absolute right-0 top-full mt-2 w-60 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
        >
            {/* Identity block */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                        style={{ background: 'var(--app-primary)', color: '#fff' }}
                    >
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>
                            {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User'}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--app-text-faint)' }}>
                            {user?.email || user?.username}
                        </p>
                    </div>
                </div>
                {/* Role + scope badges */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                    >
                        <Zap size={8} />
                        {user?.is_superuser ? 'Admin' : 'Member'}
                    </span>
                    {canToggleScope && mounted && (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                            style={{
                                background: viewScope === 'OFFICIAL' ? 'rgba(16,185,129,0.12)' : 'var(--app-surface-2)',
                                color: viewScope === 'OFFICIAL' ? '#10b981' : 'var(--app-text-faint)',
                            }}
                        >
                            {viewScope === 'OFFICIAL' ? <Eye size={8} /> : <EyeOff size={8} />}
                            {viewScope}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="p-1.5">
                {[
                    { icon: Settings, label: 'Settings', href: '/settings' },
                    { icon: HelpCircle, label: 'Help & Support', href: '/help' },
                ].map(({ icon: Icon, label, href }) => (
                    <button
                        key={href}
                        onClick={() => { onClose(); window.location.href = href; }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>
            <div className="p-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                <form action="/api/auth/logout" method="POST">
                    <button
                        type="submit"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all"
                        style={{ color: 'var(--app-error, #ef4444)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Divider ────────────────────────────────────────────────────────────────────

function VDivider() {
    return <div className="h-5 w-px flex-shrink-0 mx-0.5" style={{ background: 'var(--app-border)' }} />;
}

// ── Main TopHeader ─────────────────────────────────────────────────────────────

export function TopHeader({ sites, organizations = [], currentSlug, user }: TopHeaderProps) {
    const {
        toggleSidebar, sidebarOpen,
        viewScope, setViewScope, canToggleScope,
        navLayout, setNavLayout,
    } = useAdmin();

    const [profileOpen, setProfileOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const themeRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
            if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const { currentTheme, isDark, toggleColorMode, activeColors } = useAppTheme();
    const isTopnav = navLayout === 'topnav';
    const activeOrg = organizations.find((o) => o.slug === currentSlug);
    const userInitials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || (user?.username?.[0] || 'U').toUpperCase();

    return (
        <header
            className="sticky top-0 z-40 shrink-0 flex flex-col"
            style={{
                background: mounted
                    ? (isDark ? 'rgba(8,12,24,0.90)' : 'rgba(248,250,252,0.92)')
                    : 'rgba(8,12,24,0.90)',
                backdropFilter: 'blur(20px) saturate(200%)',
                WebkitBackdropFilter: 'blur(20px) saturate(200%)',
                borderBottom: '1px solid var(--app-border)',
                boxShadow: '0 1px 0 0 var(--app-border)',
            }}
            suppressHydrationWarning
        >
            {/* ══════════════════════════════════════════════════════════ */}
            {/* ── Main bar (48px) ──────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════ */}
            <div className="flex items-center h-12 px-3 gap-1.5">

                {/* ── LEFT ZONE ───────────────────────────────── */}
                <div className="flex items-center gap-1 flex-shrink-0">

                    {/* Layout mode toggle */}
                    <button
                        onClick={() => setNavLayout(isTopnav ? 'sidebar' : 'topnav')}
                        title={isTopnav ? 'Switch to Sidebar' : 'Switch to Top Navigation'}
                        className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 flex-shrink-0"
                        style={{ background: 'var(--app-surface-2)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                    >
                        {isTopnav ? <PanelLeft size={14} /> : <Rows3 size={14} />}
                    </button>

                    {/* Hamburger — sidebar mode */}
                    {!isTopnav && (
                        <IconBtn onClick={toggleSidebar} title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
                            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
                        </IconBtn>
                    )}

                    {/* Brand chip — topnav mode */}
                    {isTopnav && (
                        <div
                            className="hidden md:flex items-center gap-2 px-2.5 h-8 rounded-xl flex-shrink-0"
                            style={{ background: 'var(--app-primary)', gap: '6px' }}
                        >
                            <div className="w-3.5 h-3.5 rounded-md bg-white/20" />
                            <span className="text-[11px] font-black tracking-tight text-white">TSF</span>
                        </div>
                    )}
                </div>

                {/* ── CENTER ZONE ─────────────────────────────── */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">

                    {/* Topnav items row (topnav mode only) */}
                    {isTopnav && (
                        <nav className="hidden lg:flex items-center gap-0.5 overflow-hidden flex-1">
                            {MENU_ITEMS.map((item) => (
                                <TopNavItem key={item.title} item={item as MenuItem} />
                            ))}
                        </nav>
                    )}

                    {/* Context: tenant + site + currency (sidebar mode) */}
                    {!isTopnav && (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                            <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                            {currentSlug !== 'saas' && activeOrg?.currency_code && (
                                <div
                                    className="hidden xl:flex items-center gap-1.5 px-2 h-7 rounded-lg flex-shrink-0 text-[10px] font-bold"
                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}
                                >
                                    <Globe size={10} />
                                    {activeOrg.currency_code}
                                    {activeOrg.business_type_name && (
                                        <span className="hidden 2xl:inline pl-1.5 font-medium" style={{ borderLeft: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)', color: 'var(--app-primary)', opacity: 0.7 }}>
                                            {activeOrg.business_type_name}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="hidden md:block flex-shrink-0">
                                <SiteSwitcher sites={sites} />
                            </div>

                            {/* Search bar */}
                            <button
                                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                className="hidden lg:flex flex-1 max-w-xs items-center gap-2 h-8 px-3 rounded-xl transition-all cursor-text"
                                style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-text-faint)'; }}
                            >
                                <Search size={12} />
                                <span className="flex-1 text-left text-[11px]">Search...</span>
                                <kbd
                                    className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold rounded"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                                >
                                    ⌃K
                                </kbd>
                            </button>
                        </div>
                    )}

                    {/* Search in topnav mode */}
                    {isTopnav && (
                        <button
                            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                            className="hidden xl:flex items-center gap-2 h-8 px-3 rounded-xl transition-all cursor-text flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)', minWidth: '160px' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
                        >
                            <Search size={12} />
                            <span className="flex-1 text-left text-[11px]">Search...</span>
                            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold rounded" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>⌃K</kbd>
                        </button>
                    )}
                </div>

                {/* ── RIGHT ZONE ──────────────────────────────── */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-auto">

                    {/* Mobile search */}
                    <IconBtn
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        title="Search"
                    >
                        <Search size={15} className="lg:hidden" />
                    </IconBtn>

                    {/* Official / Internal scope toggle */}
                    {canToggleScope && mounted && (
                        <div
                            className="hidden sm:flex items-center h-8 rounded-xl overflow-hidden flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', padding: '2px' }}
                        >
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                className="flex items-center gap-1.5 px-2.5 h-full rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150"
                                style={
                                    viewScope === 'OFFICIAL'
                                        ? { background: '#10b981', color: '#fff', boxShadow: '0 1px 6px rgba(16,185,129,0.4)' }
                                        : { color: 'var(--app-text-faint)' }
                                }
                            >
                                <Eye size={9} />
                                <span className="hidden md:inline">Official</span>
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                className="flex items-center gap-1.5 px-2.5 h-full rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150"
                                style={
                                    viewScope === 'INTERNAL'
                                        ? { background: 'var(--app-surface)', color: 'var(--app-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                                        : { color: 'var(--app-text-faint)' }
                                }
                            >
                                <EyeOff size={9} />
                                <span className="hidden md:inline">Internal</span>
                            </button>
                        </div>
                    )}

                    <VDivider />

                    {/* Notifications */}
                    <NotificationBell />

                    {/* Dark / Light */}
                    <IconBtn
                        onClick={toggleColorMode}
                        title={mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle theme'}
                    >
                        {mounted ? (isDark ? <Sun size={15} /> : <Moon size={15} />) : <Moon size={15} />}
                    </IconBtn>

                    {/* Theme picker */}
                    <div className="relative flex-shrink-0" ref={themeRef}>
                        <button
                            onClick={() => setThemeOpen(!themeOpen)}
                            title={mounted ? `Theme: ${currentTheme?.name}` : 'Theme'}
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl transition-all duration-150 flex-shrink-0"
                            style={{
                                background: themeOpen ? 'var(--app-primary-light)' : 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-text-muted)',
                            }}
                            suppressHydrationWarning
                        >
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ background: mounted ? activeColors.primary : 'var(--app-primary)' }}
                                suppressHydrationWarning
                            />
                            <Palette size={12} />
                        </button>
                        {themeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                                <ThemePanel onClose={() => setThemeOpen(false)} />
                            </>
                        )}
                    </div>

                    <VDivider />

                    {/* User profile */}
                    <div className="relative flex-shrink-0" ref={profileRef}>
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-xl transition-all duration-150"
                            style={{
                                background: profileOpen ? 'var(--app-surface-2)' : 'transparent',
                                border: `1px solid ${profileOpen ? 'var(--app-border)' : 'transparent'}`,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
                            onMouseLeave={(e) => { if (!profileOpen) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; } }}
                        >
                            {/* Avatar with initials */}
                            <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: 'var(--app-primary)', color: '#fff' }}
                            >
                                {userInitials}
                            </div>
                            <span className="hidden sm:block text-xs font-semibold truncate max-w-[72px]" style={{ color: 'var(--app-text)' }}>
                                {user?.first_name || user?.username || 'User'}
                            </span>
                            <ChevronDown
                                size={11}
                                style={{
                                    color: 'var(--app-text-faint)',
                                    transform: profileOpen ? 'rotate(180deg)' : 'none',
                                    transition: 'transform .15s',
                                }}
                            />
                        </button>

                        {profileOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                                <UserPanel
                                    user={user}
                                    viewScope={viewScope}
                                    canToggleScope={canToggleScope}
                                    mounted={mounted}
                                    onClose={() => setProfileOpen(false)}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* ── Topnav context row (topnav mode only) ─────────────── */}
            {/* ══════════════════════════════════════════════════════════ */}
            {isTopnav && (
                <div
                    className="flex items-center gap-2 h-9 px-4 overflow-x-auto"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}
                >
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />
                    {currentSlug !== 'saas' && activeOrg?.currency_code && (
                        <div
                            className="flex items-center gap-1.5 px-2 h-6 rounded-lg flex-shrink-0 text-[10px] font-bold"
                            style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                        >
                            <Globe size={9} />
                            {activeOrg.currency_code}
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
