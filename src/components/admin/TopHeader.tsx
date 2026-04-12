'use client';

import { useAdmin } from '@/context/AdminContext';
import { useState, useEffect } from 'react';
import { Bell, Search, User, Menu, Settings, LogOut, HelpCircle, Palette, Sun, Moon } from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';
import { useAppTheme } from '@/components/app/AppThemeProvider';

export function TopHeader({ sites, organizations = [], currentSlug, user }: { sites: Record<string, any>[], organizations?: Record<string, any>[], currentSlug?: string, user?: Record<string, any> }) {
    const { toggleSidebar } = useAdmin();
    const [profileOpen, setProfileOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
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

    return (
        <header
            className="h-20 sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 shrink-0 transition-all backdrop-blur-md"
            style={{
                background: mounted ? (isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.70)') : 'rgba(15, 23, 42, 0.75)',
                borderBottom: `1px solid var(--app-border)`,
            }}
            suppressHydrationWarning
        >
            <div className="flex items-center gap-1.5 md:gap-4 flex-1">
                <button
                    onClick={toggleSidebar}
                    suppressHydrationWarning={true}
                    className="p-2.5 rounded-xl transition-all duration-200"
                    style={{ color: 'var(--app-text-muted)' }}
                >
                    <Menu size={22} />
                </button>

                {/* Switchers */}
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                    {/* Currency & Industry Display */}
                    {currentSlug !== 'saas' && (
                        <div
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{
                                background: 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                            }}
                        >
                            {(() => {
                                const activeOrg = organizations.find((o: Record<string, any>) => o.slug === currentSlug);
                                return (
                                    <>
                                        {activeOrg?.currency_code && (
                                            <div className="flex items-center gap-1.5 pr-2" style={{ borderRight: '1px solid var(--app-border)' }}>
                                                <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--app-text-faint)' }}>Currency</span>
                                                <span className="text-xs font-bold" style={{ color: 'var(--app-primary)' }}>{activeOrg.currency_code} ({activeOrg.currency_symbol})</span>
                                            </div>
                                        )}
                                        {activeOrg?.business_type_name && (
                                            <div className="flex items-center gap-1.5 pl-1">
                                                <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--app-text-faint)' }}>Industry</span>
                                                <span className="text-xs font-bold truncate max-w-[100px]" style={{ color: 'var(--app-text-muted)' }}>{activeOrg.business_type_name}</span>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div className="h-8 w-px hidden xl:block mx-1" style={{ background: 'var(--app-border)' }}></div>
                    <div className="hidden md:block">
                        <SiteSwitcher sites={sites} />
                    </div>
                </div>

                {/* Search Trigger — opens Command Palette (Ctrl+K) */}
                <div className="flex-1 max-w-xl mx-4 lg:mx-8 hidden lg:block">
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="w-full flex items-center gap-3 pl-4 pr-4 py-3 rounded-2xl text-sm transition-all group cursor-text"
                        style={{
                            background: 'var(--app-surface-2)',
                            border: '1px solid transparent',
                            color: 'var(--app-text-faint)',
                        }}
                    >
                        <Search size={18} style={{ color: 'var(--app-text-faint)' }} />
                        <span className="flex-1 text-left" style={{ color: 'var(--app-text-faint)' }}>Search pages, settings, reports...</span>
                        <kbd
                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold rounded-lg"
                            style={{
                                color: 'var(--app-text-faint)',
                                background: 'var(--app-surface-2)',
                                border: '1px solid var(--app-border)',
                            }}
                        >
                            Ctrl+K
                        </kbd>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="lg:hidden p-2.5 rounded-xl"
                    style={{ color: 'var(--app-text-faint)' }}
                >
                    <Search size={22} />
                </button>

                <NotificationBell />

                {/* ── Dark/Light Toggle ── */}
                <button
                    onClick={toggleColorMode}
                    className="p-2.5 rounded-xl transition-all duration-200 hover:scale-[1.05]"
                    style={{
                        background: 'var(--app-surface-2)',
                        color: 'var(--app-text-muted)',
                        border: '1px solid var(--app-border)',
                    }}
                    title={mounted ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle color mode'}
                    suppressHydrationWarning
                >
                    {mounted ? (isDark ? <Sun size={16} /> : <Moon size={16} />) : <Moon size={16} />}
                </button>

                {/* ── Theme Switcher ── */}
                <div className="relative">
                    <button
                        onClick={() => setThemeOpen(!themeOpen)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-[1.02]"
                        style={{
                            background: 'var(--app-surface-2)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                        title={`Theme: ${themeName}`}
                    >
                        <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-inner" style={{ background: activeColors.primary }} />
                        <span className="text-xs font-bold hidden sm:inline truncate max-w-[80px]">{themeName}</span>
                        <Palette size={14} style={{ color: 'var(--app-text-muted)' }} />
                    </button>

                    {/* Theme Dropdown — loads from Django DB */}
                    {themeOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                            <div
                                className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
                                        UI Theme
                                    </p>
                                    {isLoading && (
                                        <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--app-primary)', borderTopColor: 'transparent' }} />
                                    )}
                                </div>
                                <div className="p-2 grid gap-1 max-h-[400px] overflow-y-auto">
                                    {allThemes.length === 0 && !isLoading && (
                                        <p className="text-xs text-center py-4" style={{ color: 'var(--app-text-faint)' }}>
                                            No themes available. Check backend connection.
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
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 w-full"
                                                style={{
                                                    background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                    border: isActive ? '1px solid var(--app-primary)' : '1px solid transparent',
                                                }}
                                            >
                                                <div
                                                    className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${previewBg} 0%, ${previewSurface} 50%, ${previewColor} 100%)`,
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate" style={{ color: 'var(--app-text)' }}>{t.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--app-text-muted)' }}>
                                                        {t.description || t.category || 'Custom theme'}
                                                    </p>
                                                </div>
                                                {isActive && (
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--app-primary)' }} />
                                                )}
                                                {!t.isSystem && (
                                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                                        Custom
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="p-3 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                                    <p className="text-[10px] font-medium" style={{ color: 'var(--app-text-faint)' }}>
                                        {allThemes.length} themes • Saved automatically
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="h-8 w-px hidden sm:block" style={{ background: 'var(--app-border)' }}></div>

                {/* User Profile with Dropdown */}
                <div className="relative">
                    <div
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-3 pl-1 cursor-pointer group p-1.5 rounded-2xl transition-all"
                        style={{ border: '1px solid transparent' }}
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold transition-colors truncate max-w-[120px]" style={{ color: 'var(--app-text)' }}>
                                {user?.first_name ? `${user.first_name}` : (user?.username || 'User')}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--app-text-faint)' }}>
                                {user?.is_superuser ? 'Admin' : 'Member'}
                            </div>
                        </div>
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all shrink-0"
                            style={{
                                background: 'var(--app-primary-light)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-primary)',
                            }}
                        >
                            <User size={20} />
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    {profileOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                            <div
                                className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                }}
                            >
                                <div className="p-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <p className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{user?.first_name} {user?.last_name}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--app-text-faint)' }}>{user?.email || user?.username}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/settings'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-colors"
                                        style={{ color: 'var(--app-text-muted)' }}
                                    >
                                        <Settings size={16} /> Settings
                                    </button>
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/help'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-colors"
                                        style={{ color: 'var(--app-text-muted)' }}
                                    >
                                        <HelpCircle size={16} /> Help & Support
                                    </button>
                                </div>
                                <div className="p-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                                    <form action="/api/auth/logout" method="POST">
                                        <button
                                            type="submit"
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-colors"
                                            style={{ color: 'var(--app-error)' }}
                                        >
                                            <LogOut size={16} /> Log Out
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
