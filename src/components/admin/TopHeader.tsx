'use client';

import { useAdmin } from '@/context/AdminContext';
import { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, Menu, ChevronDown, Settings, LogOut, HelpCircle } from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';
import { logoutAction } from '@/app/actions/auth';

export function TopHeader({ sites, organizations = [], currentSlug, user }: { sites: Record<string, any>[], organizations?: Record<string, any>[], currentSlug?: string, user?: Record<string, any> }) {
    const { toggleSidebar } = useAdmin();
    const [profileOpen, setProfileOpen] = useState(false);

    return (
        <header className="h-16 sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 shrink-0 transition-all border-b" style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-1.5 md:gap-4 flex-1">
                <button
                    onClick={toggleSidebar}
                    suppressHydrationWarning={true}
                    className="p-2 rounded-lg text-app-text-muted hover:bg-app-surface-2 active:scale-95 transition-all duration-200"
                >
                    <Menu size={18} className="text-app-text-muted" />
                </button>

                {/* Switchers - Handle visibility based on screen size */}
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                    {/* Currency & Industry Display */}
                    {currentSlug !== 'saas' && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border" style={{ background: 'var(--app-surface-2)', borderColor: 'var(--app-border)' }}>
                            {(() => {
                                const orgList = Array.isArray(organizations) ? organizations : [];
                                const activeOrg = orgList.find((o: Record<string, any>) => o.slug === currentSlug);
                                return (
                                    <>
                                        {activeOrg?.currency_code && (
                                            <div className="flex items-center gap-1.5 pr-2 border-r border-app-border">
                                                <span className="text-[10px] font-black text-app-text-faint uppercase tracking-tighter">Currency</span>
                                                <span className="text-xs font-bold text-app-primary">{activeOrg.currency_code} ({activeOrg.currency_symbol})</span>
                                            </div>
                                        )}
                                        {activeOrg?.business_type_name && (
                                            <div className="flex items-center gap-1.5 pl-1">
                                                <span className="text-[10px] font-black text-app-text-faint uppercase tracking-tighter">Industry</span>
                                                <span className="text-xs font-bold text-app-text-muted truncate max-w-[100px]">{activeOrg.business_type_name}</span>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div className="h-6 w-px hidden xl:block mx-1" style={{ background: 'var(--app-border)' }}></div>
                    <div className="hidden md:block">
                        <SiteSwitcher sites={sites} />
                    </div>
                </div>

                {/* Search Trigger — opens Command Palette (Ctrl+K) */}
                <div className="flex-1 max-w-xl mx-4 lg:mx-8 hidden lg:block">
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-all group cursor-text" style={{ background: 'var(--app-surface-2)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' } as React.CSSProperties}
                    >
                        <Search size={16} className="text-app-text-faint group-hover:text-app-primary transition-colors" />
                        <span className="flex-1 text-left text-app-text-faint">Search pages, settings, reports...</span>
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold text-app-text-faint bg-app-surface-2 rounded-lg border border-app-border">
                            Ctrl+K
                        </kbd>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="lg:hidden p-2.5 hover:bg-app-surface-2 rounded-xl text-app-text-faint"
                >
                    <Search size={22} />
                </button>

                <NotificationBell />

                <div className="h-6 w-px hidden sm:block" style={{ background: 'var(--app-border)' }}></div>

                {/* User Profile with Dropdown */}
                <div className="relative">
                    <div
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md border border-transparent hover:border-app-border transition-all" style={{ ['--tw-bg-opacity' as string]: '1' } as React.CSSProperties} onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-app-text group-hover:text-app-success transition-colors truncate max-w-[100px]">
                                {user?.first_name ? `${user.first_name}` : (user?.username || 'User')}
                            </div>
                            <div className="text-[9px] text-app-text-faint font-bold uppercase tracking-tighter">
                                {user?.is_superuser ? 'Admin' : 'Member'}
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-all" style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)', border: '1px solid var(--app-border)' }}>
                            <User size={16} />
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    {profileOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-app-surface rounded-2xl shadow-xl border border-app-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-app-border">
                                    <p className="text-sm font-bold text-app-text">{user?.first_name} {user?.last_name}</p>
                                    <p className="text-xs text-app-text-faint truncate">{user?.email || user?.username}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/settings'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-app-text-muted hover:bg-app-bg rounded-xl transition-colors"
                                    >
                                        <Settings size={16} /> Settings
                                    </button>
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/help'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-app-text-muted hover:bg-app-bg rounded-xl transition-colors"
                                    >
                                        <HelpCircle size={16} /> Help & Support
                                    </button>
                                </div>
                                <div className="p-2 border-t border-app-border">
                                    <form action={logoutAction}>
                                        <button
                                            type="submit"
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors" style={{ color: 'var(--app-error)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-error-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}
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
