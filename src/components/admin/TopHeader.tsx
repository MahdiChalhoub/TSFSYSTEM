'use client';

import { useAdmin } from '@/context/AdminContext';
import { Bell, Search, User, Menu } from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationBell } from './NotificationBell';

export function TopHeader({ sites, organizations = [], currentSlug, user }: { sites: any[], organizations?: any[], currentSlug?: string, user?: any }) {
    const { toggleSidebar } = useAdmin();

    return (
        <header className="h-20 glass sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 shrink-0 transition-all border-b border-gray-100">
            <div className="flex items-center gap-1.5 md:gap-4 flex-1">
                <button
                    onClick={toggleSidebar}
                    suppressHydrationWarning={true}
                    className="p-2.5 hover:bg-gray-100/50 hover:scale-105 active:scale-95 rounded-xl text-gray-600 transition-all duration-200"
                >
                    <Menu size={22} className="text-gray-700" />
                </button>

                {/* Switchers - Handle visibility based on screen size */}
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                    <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} user={user} />

                    {/* Currency & Industry Display */}
                    {currentSlug !== 'saas' && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 rounded-xl border border-gray-200/50">
                            {(() => {
                                const activeOrg = organizations.find((o: any) => o.slug === currentSlug);
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
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Vector</span>
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

                {/* Search - Full width on desktop, hidden on mobile (will move to actions if needed) */}
                <div className="flex-1 max-w-xl mx-4 lg:mx-8 hidden lg:block">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={18} />
                        <input
                            type="text"
                            suppressHydrationWarning={true}
                            placeholder="Type to search (Ctrl+K)"
                            className="w-full pl-12 pr-4 py-3 bg-gray-100/30 border border-transparent focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl text-sm outline-none transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl text-gray-400">
                    <Search size={22} />
                </button>

                <NotificationBell />

                <div className="h-8 w-px bg-gray-200/60 hidden sm:block"></div>

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-1 cursor-pointer group p-1.5 hover:bg-white/50 rounded-2xl border border-transparent hover:border-gray-200/50 transition-all">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-gray-800 group-hover:text-emerald-800 transition-colors truncate max-w-[120px]">
                            {user?.first_name ? `${user.first_name}` : (user?.username || 'User')}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            {user?.is_superuser ? 'Commander' : 'Staff'}
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all shrink-0">
                        <User size={20} />
                    </div>
                </div>
            </div>
        </header>
    );
}
