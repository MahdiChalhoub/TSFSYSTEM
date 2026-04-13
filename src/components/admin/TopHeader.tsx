'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useRef, memo } from 'react';
import {
    Search, Menu, Settings, LogOut, HelpCircle,
    Palette, Sun, Moon, ChevronDown, PanelLeft, Rows3,
    Globe, X, ChevronRight, Eye, EyeOff, Zap,
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
    children?: MenuItem[];
}

interface TopHeaderProps {
    sites: Record<string, any>[];
    organizations?: Record<string, any>[];
    currentSlug?: string;
    user?: Record<string, any>;
}

// ── Shared hover helpers (inline style swap — avoids class-based bg leaks) ────

function onHover(enter: boolean, el: HTMLElement, bg = 'var(--app-surface-hover)', color = 'var(--app-text)') {
    el.style.background = enter ? bg : 'transparent';
    el.style.color = enter ? color : 'var(--app-text-muted)';
}

// ── Vertical divider ──────────────────────────────────────────────────────────

function VDivider() {
    return <div className="h-5 w-px mx-1 flex-shrink-0" style={{ background: 'var(--app-border)' }} />;
}

// ── Compact icon button ───────────────────────────────────────────────────────

function IconBtn({ onClick, title, children, active }: {
    onClick?: () => void; title?: string; children: React.ReactNode; active?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors duration-150 flex-shrink-0"
            style={{
                background: active ? 'var(--app-primary-light)' : 'transparent',
                color: active ? 'var(--app-primary)' : 'var(--app-text-muted)',
            }}
            onMouseEnter={(e) => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; } }}
            onMouseLeave={(e) => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; } }}
        >
            {children}
        </button>
    );
}

// ── Mega-menu dropdown ────────────────────────────────────────────────────────

function MegaMenuDropdown({ item, onClose }: { item: MenuItem; onClose: () => void }) {
    const { openTab } = useAdmin();
    const cols = item.children ?? [];
    const colCount = Math.min(cols.length, 4);
    if (!cols.length) return null;

    return (
        <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: 'var(--app-shadow-lg)',
                width: `${colCount * 210}px`,
                maxWidth: '92vw',
            }}
        >
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                {item.icon && <item.icon size={13} style={{ color: 'var(--app-primary)' }} />}
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{item.title}</span>
            </div>
            <div className="grid p-2" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                {cols.map((group) => (
                    <div key={group.title} className="p-1">
                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                            {group.icon && <group.icon size={11} style={{ color: 'var(--app-primary)' }} />}
                            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--app-text-faint)' }}>{group.title}</span>
                        </div>
                        {group.children?.map((page) => (
                            <button
                                key={page.path}
                                onClick={() => { openTab(page.title, page.path!); onClose(); }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors duration-100 text-xs font-medium"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-primary-light)'; el.style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}
                            >
                                <ChevronRight size={9} className="flex-shrink-0 opacity-40" />
                                <span className="truncate">{page.title}</span>
                            </button>
                        ))}
                        {!group.children && group.path && (
                            <button
                                onClick={() => { openTab(group.title, group.path!); onClose(); }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg transition-colors duration-100 text-xs font-medium truncate"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-primary-light)'; el.style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}
                            >
                                {group.title}
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors duration-150"
                style={{ color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors duration-150"
                style={{
                    background: open ? 'var(--app-surface-2)' : 'transparent',
                    color: open ? 'var(--app-text)' : 'var(--app-text-muted)',
                }}
            >
                {item.icon && <item.icon size={13} />}
                {item.title}
                {hasChildren && <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--app-transition-fast)' }} />}
            </button>
            {open && hasChildren && <MegaMenuDropdown item={item} onClose={() => setOpen(false)} />}
        </div>
    );
});

// ── Theme panel ───────────────────────────────────────────────────────────────

function ThemePanel({ onClose }: { onClose: () => void }) {
    const { currentTheme, allThemes, isLoading, setTheme } = useAppTheme();
    const themeSlug = currentTheme?.slug || '';

    return (
        <div
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}
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
                    const primary = t.presetData?.colors?.dark?.primary || 'var(--app-primary)';
                    const bg = t.presetData?.colors?.dark?.bg || 'var(--app-bg)';
                    const surface = t.presetData?.colors?.dark?.surface || 'var(--app-surface)';
                    return (
                        <button
                            key={t.slug || t.id}
                            onClick={() => { setTheme(t.slug); onClose(); }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 w-full"
                            style={{
                                background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                border: `1px solid ${isActive ? 'var(--app-primary)' : 'transparent'}`,
                            }}
                        >
                            {/* Swatch */}
                            <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: bg, border: '1px solid var(--app-border)' }}>
                                <div className="w-full h-1/2" style={{ background: surface }} />
                                <div className="w-2/3 h-1/2 ml-auto" style={{ background: primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate" style={{ color: 'var(--app-text)' }}>{t.name}</p>
                                <p className="text-[9px] truncate" style={{ color: 'var(--app-text-faint)' }}>{t.description || t.category || 'Theme'}</p>
                            </div>
                            {isActive && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--app-primary)' }} />}
                            {!t.isSystem && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                    Custom
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                <p className="text-[9px]" style={{ color: 'var(--app-text-faint)' }}>{allThemes.length} themes · Auto-saved</p>
            </div>
        </div>
    );
}

// ── User panel ────────────────────────────────────────────────────────────────

function UserPanel({ user, viewScope, canToggleScope, onClose }: {
    user?: Record<string, any>;
    viewScope: 'OFFICIAL' | 'INTERNAL';
    canToggleScope: boolean;
    onClose: () => void;
}) {
    const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
        || (user?.username?.[0] || 'U').toUpperCase();

    const menuItems = [
        { icon: Settings, label: 'Settings', href: '/settings' },
        { icon: HelpCircle, label: 'Help & Support', href: '/help' },
    ];

    return (
        <div
            className="absolute right-0 top-full mt-2 w-60 rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}
        >
            {/* Identity */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                        style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}
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
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                        <Zap size={8} />
                        {user?.is_superuser ? 'Admin' : 'Member'}
                    </span>
                    {canToggleScope && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                            style={{
                                background: viewScope === 'OFFICIAL' ? 'var(--app-success-bg)' : 'var(--app-surface-2)',
                                color: viewScope === 'OFFICIAL' ? 'var(--app-success)' : 'var(--app-text-faint)',
                            }}>
                            {viewScope === 'OFFICIAL' ? <Eye size={8} /> : <EyeOff size={8} />}
                            {viewScope}
                        </span>
                    )}
                </div>
            </div>

            {/* Nav items */}
            <div className="p-1.5">
                {menuItems.map(({ icon: Icon, label, href }) => (
                    <button key={href}
                        onClick={() => { onClose(); window.location.href = href; }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-colors duration-150"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}
                    >
                        <Icon size={14} />{label}
                    </button>
                ))}
            </div>
            <div className="p-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                <form action="/api/auth/logout" method="POST">
                    <button type="submit"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-colors duration-150"
                        style={{ color: 'var(--app-error)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-error-bg)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                        <LogOut size={14} />Sign Out
                    </button>
                </form>
            </div>
        </div>
    );
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
    const userInitials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
        || (user?.username?.[0] || 'U').toUpperCase();

    return (
        <header
            className="sticky top-0 z-40 shrink-0 flex flex-col"
            style={{
                background: 'var(--app-surface)',
                borderBottom: '1px solid var(--app-border)',
                boxShadow: 'var(--app-shadow-sm)',
            }}
        >
            {/* ── Main bar (48px) ────────────────────────────────────────── */}
            <div className="flex items-center h-12 px-3 gap-1.5">

                {/* LEFT ─────────────────────────────────────────────── */}
                <div className="flex items-center gap-1 flex-shrink-0">

                    {/* Layout toggle */}
                    <button
                        onClick={() => setNavLayout(isTopnav ? 'sidebar' : 'topnav')}
                        title={isTopnav ? 'Switch to Sidebar' : 'Switch to Top Navigation'}
                        className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors duration-150 flex-shrink-0"
                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-bg)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)'; }}
                    >
                        {isTopnav ? <PanelLeft size={14} /> : <Rows3 size={14} />}
                    </button>

                    {/* Hamburger (sidebar mode) */}
                    {!isTopnav && (
                        <IconBtn onClick={toggleSidebar} title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
                            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
                        </IconBtn>
                    )}

                    {/* Brand chip (topnav mode) */}
                    {isTopnav && (
                        <div className="hidden md:flex items-center gap-1.5 px-2.5 h-8 rounded-xl flex-shrink-0"
                            style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                            <div className="w-3 h-3 rounded-md" style={{ background: 'var(--app-bg)', opacity: 0.4 }} />
                            <span className="text-[11px] font-black tracking-tight">TSF</span>
                        </div>
                    )}
                </div>

                {/* CENTER ───────────────────────────────────────────── */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">

                    {/* Top-nav items (topnav mode) */}
                    {isTopnav && (
                        <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-hidden">
                            {MENU_ITEMS.map((item) => (
                                <TopNavItem key={item.title} item={item as MenuItem} />
                            ))}
                        </nav>
                    )}

                    {/* Context row (sidebar mode) */}
                    {!isTopnav && (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                            <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                            {currentSlug !== 'saas' && activeOrg?.currency_code && (
                                <div className="hidden xl:flex items-center gap-1.5 px-2 h-7 rounded-lg flex-shrink-0 text-[10px] font-bold"
                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}>
                                    <Globe size={10} />
                                    {activeOrg.currency_code}
                                    {activeOrg.business_type_name && (
                                        <span className="hidden 2xl:inline pl-1.5 font-medium opacity-70"
                                            style={{ borderLeft: '1px solid var(--app-border)' }}>
                                            {activeOrg.business_type_name}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="hidden md:block flex-shrink-0">
                                <SiteSwitcher sites={sites} />
                            </div>

                            {/* Search */}
                            <button
                                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                                className="hidden lg:flex flex-1 max-w-xs items-center gap-2 h-8 px-3 rounded-xl transition-colors duration-150 cursor-text"
                                style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}
                                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-primary)'; el.style.color = 'var(--app-text-muted)'; }}
                                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-border)'; el.style.color = 'var(--app-text-faint)'; }}
                            >
                                <Search size={12} />
                                <span className="flex-1 text-left text-[11px]">Search...</span>
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold rounded"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}>
                                    ⌃K
                                </kbd>
                            </button>
                        </div>
                    )}

                    {/* Search (topnav mode) */}
                    {isTopnav && (
                        <button
                            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                            className="hidden xl:flex items-center gap-2 h-8 px-3 rounded-xl transition-colors duration-150 cursor-text flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)', minWidth: '160px' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
                        >
                            <Search size={12} />
                            <span className="flex-1 text-left text-[11px]">Search...</span>
                            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold rounded"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}>
                                ⌃K
                            </kbd>
                        </button>
                    )}
                </div>

                {/* RIGHT ────────────────────────────────────────────── */}
                <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">

                    {/* Mobile search */}
                    <IconBtn onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} title="Search">
                        <Search size={15} className="lg:hidden" />
                    </IconBtn>

                    {/* Scope toggle */}
                    {canToggleScope && mounted && (
                        <div className="hidden sm:flex items-center h-8 rounded-xl overflow-hidden flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', padding: '2px', gap: '2px' }}>
                            <button
                                onClick={() => setViewScope('OFFICIAL')}
                                className="flex items-center gap-1.5 px-2.5 h-full rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors duration-150"
                                style={viewScope === 'OFFICIAL'
                                    ? { background: 'var(--app-success)', color: 'var(--app-bg)', boxShadow: '0 1px 6px var(--app-primary-glow)' }
                                    : { color: 'var(--app-text-faint)' }}
                            >
                                <Eye size={9} />
                                <span className="hidden md:inline">Official</span>
                            </button>
                            <button
                                onClick={() => setViewScope('INTERNAL')}
                                className="flex items-center gap-1.5 px-2.5 h-full rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors duration-150"
                                style={viewScope === 'INTERNAL'
                                    ? { background: 'var(--app-surface)', color: 'var(--app-text)', boxShadow: 'var(--app-shadow-sm)' }
                                    : { color: 'var(--app-text-faint)' }}
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
                    <IconBtn onClick={toggleColorMode} title={mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle'}>
                        {mounted ? (isDark ? <Sun size={15} /> : <Moon size={15} />) : <Moon size={15} />}
                    </IconBtn>

                    {/* Theme picker */}
                    <div className="relative flex-shrink-0" ref={themeRef}>
                        <button
                            onClick={() => setThemeOpen(!themeOpen)}
                            title={mounted ? `Theme: ${currentTheme?.name}` : 'Theme'}
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl transition-colors duration-150 flex-shrink-0"
                            style={{
                                background: themeOpen ? 'var(--app-primary-light)' : 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                                color: themeOpen ? 'var(--app-primary)' : 'var(--app-text-muted)',
                            }}
                            suppressHydrationWarning
                        >
                            <div className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ background: mounted ? activeColors.primary : 'var(--app-primary)' }}
                                suppressHydrationWarning />
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
                            className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-xl transition-colors duration-150"
                            style={{
                                background: profileOpen ? 'var(--app-surface-2)' : 'transparent',
                                border: `1px solid ${profileOpen ? 'var(--app-border)' : 'transparent'}`,
                            }}
                            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.borderColor = 'var(--app-border)'; }}
                            onMouseLeave={(e) => { if (!profileOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; } }}
                        >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                                {userInitials}
                            </div>
                            <span className="hidden sm:block text-xs font-semibold truncate max-w-[72px]" style={{ color: 'var(--app-text)' }}>
                                {user?.first_name || user?.username || 'User'}
                            </span>
                            <ChevronDown size={11} style={{
                                color: 'var(--app-text-faint)',
                                transform: profileOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform var(--app-transition-fast)',
                            }} />
                        </button>
                        {profileOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                                <UserPanel
                                    user={user}
                                    viewScope={viewScope}
                                    canToggleScope={canToggleScope}
                                    onClose={() => setProfileOpen(false)}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Topnav context row ──────────────────────────────────────── */}
            {isTopnav && (
                <div className="flex items-center gap-2 h-9 px-4 overflow-x-auto flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />
                    {currentSlug !== 'saas' && activeOrg?.currency_code && (
                        <div className="flex items-center gap-1.5 px-2 h-6 rounded-lg flex-shrink-0 text-[10px] font-bold"
                            style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}>
                            <Globe size={9} />{activeOrg.currency_code}
                        </div>
                    )}
                    {currentSlug !== 'saas' && activeOrg?.business_type_name && (
                        <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--app-text-faint)' }}>
                            {activeOrg.business_type_name}
                        </span>
                    )}
                    <div className="flex-shrink-0"><SiteSwitcher sites={sites} /></div>
                </div>
            )}
        </header>
    );
}
