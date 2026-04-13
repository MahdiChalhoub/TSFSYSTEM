'use client';

import { useAdmin } from '@/context/AdminContext';
import { MENU_ITEMS } from '@/components/admin/Sidebar';
import { useState, useEffect, useRef, memo } from 'react';
import {
    Search, Menu, Settings, LogOut, HelpCircle,
    Palette, Sun, Moon, ChevronDown,
    Globe, ChevronRight, Eye, EyeOff, Zap,
} from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { BranchLocationSwitcher } from './BranchSwitcher';
import { NotificationBell } from './NotificationBell';
import { useAppTheme } from '@/components/app/AppThemeProvider';

interface MenuItem {
    title: string; icon?: any; path?: string; children?: MenuItem[];
}
interface TopHeaderProps {
    sites: Record<string, any>[];
    organizations?: Record<string, any>[];
    currentSlug?: string;
    user?: Record<string, any>;
}

// ── Mega-menu ─────────────────────────────────────────────────────────────────

function MegaMenuDropdown({ item, onClose }: { item: MenuItem; onClose: () => void }) {
    const { openTab } = useAdmin();
    const cols = item.children ?? [];
    const colCount = Math.min(cols.length, 4);
    if (!cols.length) return null;
    return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)', width: `${colCount * 210}px`, maxWidth: '92vw' }}>
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
                            <button key={page.path} onClick={() => { openTab(page.title, page.path!); onClose(); }}
                                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors duration-100 text-xs font-medium"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-primary-light)'; el.style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}>
                                <ChevronRight size={9} className="flex-shrink-0 opacity-40" /><span className="truncate">{page.title}</span>
                            </button>
                        ))}
                        {!group.children && group.path && (
                            <button onClick={() => { openTab(group.title, group.path!); onClose(); }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg transition-colors duration-100 text-xs font-medium truncate"
                                style={{ color: 'var(--app-text-muted)' }}
                                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-primary-light)'; el.style.color = 'var(--app-primary)'; }}
                                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}>
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
            <button onClick={() => openTab(item.title, item.path!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors duration-150"
                style={{ color: 'var(--app-text-muted)' }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}>
                {item.icon && <item.icon size={13} />}{item.title}
            </button>
        );
    }
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} onMouseEnter={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors duration-150"
                style={{ background: open ? 'var(--app-surface-2)' : 'transparent', color: open ? 'var(--app-text)' : 'var(--app-text-muted)' }}>
                {item.icon && <item.icon size={13} />}{item.title}
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
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2">
                    <Palette size={13} style={{ color: 'var(--app-primary)' }} />
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-text)' }}>Appearance</span>
                </div>
                {isLoading && <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-primary)', borderTopColor: 'transparent' }} />}
            </div>

            {/* Theme list */}
            <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                {allThemes.length === 0 && !isLoading && (
                    <p className="text-xs text-center py-8" style={{ color: 'var(--app-text-faint)' }}>No themes available.</p>
                )}
                {allThemes.map((t) => {
                    const isActive = themeSlug === t.slug;
                    const primary = t.presetData?.colors?.dark?.primary || 'var(--app-primary)';
                    const bg = t.presetData?.colors?.dark?.bg || 'var(--app-bg)';
                    const surface = t.presetData?.colors?.dark?.surface || 'var(--app-surface)';
                    return (
                        <button key={t.slug || t.id} onClick={() => { setTheme(t.slug); onClose(); }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors duration-150"
                            style={{
                                background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                border: `1px solid ${isActive ? 'var(--app-primary)' : 'transparent'}`,
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                            {/* Mini preview swatch */}
                            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                <div className="w-full h-[55%]" style={{ background: bg }} />
                                <div className="flex h-[45%]">
                                    <div className="flex-1" style={{ background: surface }} />
                                    <div className="w-[45%]" style={{ background: primary }} />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>{t.name}</p>
                                <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{t.description || t.category || 'Theme'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {!t.isSystem && (
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                        Custom
                                    </span>
                                )}
                                {isActive && (
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--app-primary)' }}>
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path d="M2 5l2 2 4-4" stroke="var(--app-bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--app-border)' }}>
                <p className="text-[9px] font-medium" style={{ color: 'var(--app-text-faint)' }}>{allThemes.length} themes available</p>
                <p className="text-[9px] font-medium" style={{ color: 'var(--app-primary)', opacity: 0.8 }}>Auto-saved</p>
            </div>
        </div>
    );
}

// ── User panel ────────────────────────────────────────────────────────────────

function UserPanel({ user, viewScope, canToggleScope, onClose }: {
    user?: Record<string, any>; viewScope: 'OFFICIAL' | 'INTERNAL'; canToggleScope: boolean; onClose: () => void;
}) {
    const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase()
        || (user?.username?.[0] || 'U').toUpperCase();
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User';

    return (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}>

            {/* Identity hero */}
            <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-3">
                    {/* Large avatar */}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-base font-black"
                        style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--app-text)' }}>
                            {fullName}
                        </p>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                            {user?.email || user?.username}
                        </p>
                    </div>
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-1.5 mt-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider"
                        style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                        <Zap size={8} />
                        {user?.is_superuser ? 'Admin' : 'Member'}
                    </span>
                    {canToggleScope && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider"
                            style={{
                                background: viewScope === 'OFFICIAL' ? 'var(--app-success-bg)' : 'var(--app-surface-2)',
                                color: viewScope === 'OFFICIAL' ? 'var(--app-success)' : 'var(--app-text-faint)',
                                border: `1px solid ${viewScope === 'OFFICIAL' ? 'var(--app-success)' : 'var(--app-border)'}`,
                            }}>
                            {viewScope === 'OFFICIAL' ? <Eye size={8} /> : <EyeOff size={8} />}
                            {viewScope === 'OFFICIAL' ? 'Official' : 'Internal'}
                        </span>
                    )}
                </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
                {([
                    { icon: Settings, label: 'Account Settings', href: '/settings' },
                    { icon: HelpCircle, label: 'Help & Support', href: '/help' },
                ] as const).map(({ icon: Icon, label, href }) => (
                    <button key={href}
                        onClick={() => { onClose(); window.location.href = href; }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-colors duration-150"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-muted)'; }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--app-surface-2)' }}>
                            <Icon size={13} />
                        </div>
                        {label}
                    </button>
                ))}
            </div>

            {/* Sign out */}
            <div className="p-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                <form action="/api/auth/logout" method="POST">
                    <button type="submit"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-colors duration-150"
                        style={{ color: 'var(--app-error)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-error-bg)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--app-error-bg)' }}>
                            <LogOut size={13} />
                        </div>
                        Sign Out
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Main TopHeader ─────────────────────────────────────────────────────────────

export function TopHeader({ sites, organizations = [], currentSlug, user }: TopHeaderProps) {
    const { toggleSidebar, sidebarOpen, viewScope, canToggleScope, navLayout } = useAdmin();
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
    const userName = user?.first_name || user?.username || 'User';

    return (
        <header className="sticky top-0 z-40 shrink-0 flex flex-col"
            style={{
                background: 'var(--app-bg)',
                backdropFilter: 'var(--app-backdrop)',
                WebkitBackdropFilter: 'var(--app-backdrop)',
                borderBottom: '1px solid var(--app-border)',
            }}>

            {/* ════════════════════════════════════════════════════════
                MAIN BAR  ·  52px
            ════════════════════════════════════════════════════════ */}
            <div className="flex items-center h-[52px] px-4 gap-3">

                {/* ── SIDEBAR TOGGLE + LOGO (logo only when sidebar is hidden) ─── */}
                <div className="flex items-center gap-2 flex-shrink-0">

                    {/* Sidebar show/hide — always visible */}
                    <button
                        onClick={toggleSidebar}
                        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                        style={{ color: 'var(--app-text-faint)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface)'; el.style.color = 'var(--app-text)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; }}
                    >
                        <Menu size={16} />
                    </button>

                    {/* Logo — only shown when sidebar is collapsed (avoids duplication) */}
                    {!sidebarOpen && (
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                                style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                                T
                            </div>
                            <span className="hidden md:block text-sm font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                TSF
                            </span>
                        </div>
                    )}

                    <div className="h-5 w-px" style={{ background: 'var(--app-border)' }} />
                </div>

                {/* ── TOP-NAV ITEMS  (topnav mode only) ────────────── */}
                {isTopnav && (
                    <nav className="hidden lg:flex items-center gap-0.5 flex-shrink-0">
                        {MENU_ITEMS.map((item) => (
                            <TopNavItem key={item.title} item={item as MenuItem} />
                        ))}
                    </nav>
                )}

                {/* ── CONTEXT  (sidebar mode: org / site / branch / location) ── */}
                {!isTopnav && (
                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                        <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />
                        <SiteSwitcher sites={sites} />
                        <BranchLocationSwitcher />
                        {currentSlug !== 'saas' && activeOrg?.currency_code && (
                            <div className="hidden xl:flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold flex-shrink-0"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                                <Globe size={10} style={{ color: 'var(--app-primary)', opacity: 0.8 }} />
                                {activeOrg.currency_code}
                            </div>
                        )}
                    </div>
                )}

                {/* ── SEARCH  (flex-1, grows to fill available space) ─ */}
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="hidden lg:flex flex-1 items-center gap-2.5 h-9 px-4 rounded-xl transition-all duration-150 cursor-text min-w-0"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        color: 'var(--app-text-faint)',
                        maxWidth: '480px',
                    }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-primary)'; el.style.color = 'var(--app-text-muted)'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-border)'; el.style.color = 'var(--app-text-faint)'; }}
                >
                    <Search size={13} className="flex-shrink-0" />
                    <span className="flex-1 text-left text-xs">Search anything...</span>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded flex-shrink-0"
                        style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}>
                        ⌃K
                    </kbd>
                </button>

                {/* Push right zone to the end */}
                <div className="flex-1" />

                {/* ── ACTION BUTTONS  [bell · sun/moon · theme] ─────── */}
                <div className="flex items-center gap-0.5 flex-shrink-0">

                    {/* Notifications */}
                    <div className="flex items-center justify-center w-8 h-8">
                        <NotificationBell />
                    </div>

                    {/* Dark / Light */}
                    <button onClick={toggleColorMode}
                        title={mounted ? (isDark ? 'Light mode' : 'Dark mode') : 'Toggle'}
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                        style={{ color: 'var(--app-text-faint)' }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface)'; el.style.color = 'var(--app-text)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; }}
                        suppressHydrationWarning>
                        {mounted ? (isDark ? <Sun size={15} /> : <Moon size={15} />) : <Moon size={15} />}
                    </button>

                    {/* Theme */}
                    <div className="relative flex-shrink-0" ref={themeRef}>
                        <button onClick={() => setThemeOpen(!themeOpen)}
                            title={mounted ? `Theme: ${currentTheme?.name}` : 'Theme'}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
                            style={{ color: themeOpen ? 'var(--app-primary)' : 'var(--app-text-faint)', background: themeOpen ? 'var(--app-primary-light)' : 'transparent' }}
                            onMouseEnter={(e) => { if (!themeOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface)'; el.style.color = 'var(--app-text)'; } }}
                            onMouseLeave={(e) => { if (!themeOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; } }}
                            suppressHydrationWarning>
                            <div className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ background: mounted ? activeColors.primary : 'var(--app-primary)' }}
                                suppressHydrationWarning />
                        </button>
                        {themeOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                                <ThemePanel onClose={() => setThemeOpen(false)} />
                            </>
                        )}
                    </div>
                </div>

                {/* thin separator before user */}
                <div className="h-5 w-px flex-shrink-0" style={{ background: 'var(--app-border)' }} />

                {/* ── USER BUTTON ─────────────────────────────────────── */}
                <div className="relative flex-shrink-0" ref={profileRef}>
                    <button onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-2 h-9 pl-2 pr-3 rounded-xl transition-all duration-150"
                        style={{
                            background: profileOpen ? 'var(--app-surface)' : 'transparent',
                            border: `1px solid ${profileOpen ? 'var(--app-border)' : 'transparent'}`,
                        }}
                        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface)'; el.style.borderColor = 'var(--app-border)'; }}
                        onMouseLeave={(e) => { if (!profileOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; } }}>
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
                            style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                            {userInitials}
                        </div>
                        <span className="hidden sm:block text-xs font-semibold max-w-[80px] truncate" style={{ color: 'var(--app-text)' }}>
                            {userName}
                        </span>
                        <ChevronDown size={12} style={{
                            color: 'var(--app-text-faint)',
                            transform: profileOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform var(--app-transition-fast)',
                            flexShrink: 0,
                        }} />
                    </button>

                    {profileOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                            <UserPanel user={user} viewScope={viewScope} canToggleScope={canToggleScope} onClose={() => setProfileOpen(false)} />
                        </>
                    )}
                </div>

                {/* Mobile search icon */}
                <button className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-150"
                    style={{ color: 'var(--app-text-faint)' }}
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; }}>
                    <Search size={16} />
                </button>
            </div>

            {/* ════════════════════════════════════════════════════════
                TOPNAV CONTEXT ROW  (topnav mode only)
            ════════════════════════════════════════════════════════ */}
            {isTopnav && (
                <div className="flex items-center gap-2 h-9 px-4 overflow-x-auto"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />
                    <SiteSwitcher sites={sites} />
                    <BranchLocationSwitcher />
                    {currentSlug !== 'saas' && activeOrg?.currency_code && (
                        <div className="flex items-center gap-1.5 px-2 h-6 rounded-lg flex-shrink-0 text-[10px] font-bold"
                            style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}>
                            <Globe size={9} />{activeOrg.currency_code}
                        </div>
                    )}
                    {currentSlug !== 'saas' && activeOrg?.business_type_name && (
                        <span className="text-[10px] font-medium flex-shrink-0" style={{ color: 'var(--app-text-faint)' }}>{activeOrg.business_type_name}</span>
                    )}
                </div>
            )}
        </header>
    );
}
