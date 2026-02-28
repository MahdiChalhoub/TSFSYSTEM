'use client';

import { useAdmin } from '@/context/AdminContext';
import { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, Menu, ChevronDown, Settings, LogOut, HelpCircle } from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';

export function TopHeader({ sites, organizations = [], currentSlug, user }: { sites: Record<string, any>[], organizations?: Record<string, any>[], currentSlug?: string, user?: Record<string, any> }) {
    const { toggleSidebar } = useAdmin();
    const [profileOpen, setProfileOpen] = useState(false);

    return (
        <header className="h-11 glass sticky top-0 z-40 flex items-center justify-between px-3 md:px-5 shrink-0 transition-all border-b border-gray-100">
            <div className="flex items-center gap-1.5 md:gap-4 flex-1">
                <button
                    onClick={toggleSidebar}
                    suppressHydrationWarning={true}
                    className="p-1 px-1.5 hover:bg-gray-100/50 hover:scale-105 active:scale-95 rounded-lg text-gray-600 transition-all duration-200"
                >
                    <Menu size={18} className="text-gray-700" />
                </button>

                {/* Switchers - Handle visibility based on screen size */}
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                    {/* Currency & Industry Display */}
                    {currentSlug !== 'saas' && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 rounded-xl border border-gray-200/50">
                            {(() => {
                                const orgList = Array.isArray(organizations) ? organizations : [];
                                const activeOrg = orgList.find((o: Record<string, any>) => o.slug === currentSlug);
                                return (
                                    <>
                                        {activeOrg?.currency_code && (
                                            <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Currency</span>
                                                <span className="text-xs font-bold text-emerald-600">{activeOrg.currency_code} ({activeOrg.currency_symbol})</span>
                                            </div>
                                        )}
                                        {activeOrg?.business_type_name && (
                                            <div className="flex items-center gap-1.5 pl-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Industry</span>
                                                <span className="text-xs font-bold text-gray-600 truncate max-w-[100px]">{activeOrg.business_type_name}</span>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <div className="h-8 w-px bg-gray-200/60 hidden xl:block mx-1"></div>
                    <div className="hidden md:block">
                        <SiteSwitcher sites={sites} />
                    </div>
                </div>

                {/* Search Trigger — opens Command Palette (Ctrl+K) */}
                <div className="flex-1 max-w-xl mx-4 lg:mx-8 hidden lg:block">
                    <button
                        type="button"
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                        className="w-full flex items-center gap-3 pl-3 pr-3 py-1.5 bg-gray-100/30 border border-transparent hover:bg-white hover:border-gray-200 rounded-xl text-xs transition-all group cursor-text"
                    >
                        <Search size={16} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                        <span className="flex-1 text-left text-gray-400">Search pages, settings, reports...</span>
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold text-gray-400 bg-gray-100 rounded-lg border border-gray-200">
                            Ctrl+K
                        </kbd>
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                    className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl text-gray-400"
                >
                    <Search size={22} />
                </button>

                <NotificationBell />

                <div className="h-8 w-px bg-gray-200/60 hidden sm:block"></div>

                {/* User Profile with Dropdown */}
                <div className="relative">
                    <div
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="flex items-center gap-2 pl-1 cursor-pointer group p-1 hover:bg-white/50 rounded-xl border border-transparent hover:border-gray-200/50 transition-all"
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-gray-800 group-hover:text-emerald-800 transition-colors truncate max-w-[100px]">
                                {user?.first_name ? `${user.first_name}` : (user?.username || 'User')}
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                {user?.is_superuser ? 'Admin' : 'Member'}
                            </div>
                        </div>
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 text-emerald-700 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all shrink-0">
                            <User size={16} />
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    {profileOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-gray-100">
                                    <p className="text-sm font-bold text-gray-800">{user?.first_name} {user?.last_name}</p>
                                    <p className="text-xs text-gray-400 truncate">{user?.email || user?.username}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/settings'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                                    >
                                        <Settings size={16} /> Settings
                                    </button>
                                    <button
                                        onClick={() => { setProfileOpen(false); window.location.href = '/help'; }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                                    >
                                        <HelpCircle size={16} /> Help & Support
                                    </button>
                                </div>
                                <div className="p-2 border-t border-gray-100">
                                    <form action="/api/auth/logout" method="POST">
                                        <button
                                            type="submit"
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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
