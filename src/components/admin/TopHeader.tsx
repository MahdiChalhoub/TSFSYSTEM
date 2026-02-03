'use client';

import { useAdmin } from '@/context/AdminContext';
import { Bell, Search, User, Menu } from 'lucide-react';
import { SiteSwitcher } from './SiteSwitcher';
import { TenantSwitcher } from './TenantSwitcher';

export function TopHeader({ sites, organizations = [], currentSlug }: { sites: any[], organizations?: any[], currentSlug?: string }) {
    const { toggleSidebar } = useAdmin();

    return (
        <header className="h-20 glass sticky top-0 z-40 flex items-center justify-between px-8 shrink-0 transition-all">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    suppressHydrationWarning={true}
                    className="p-2.5 hover:bg-gray-100/50 hover:scale-105 active:scale-95 rounded-xl text-gray-600 transition-all duration-200"
                >
                    <Menu size={22} className="text-gray-700" />
                </button>
                <TenantSwitcher organizations={organizations} forcedSlug={currentSlug} />
                <div className="h-8 w-px bg-gray-200/60 hidden lg:block mx-1"></div>
                <SiteSwitcher sites={sites} />
            </div>

            <div className="flex-1 max-w-xl mx-8 hidden sm:block">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={18} />
                    <input
                        type="text"
                        suppressHydrationWarning={true}
                        placeholder="Search products, orders, or customers (Ctrl+K)"
                        className="w-full pl-12 pr-4 py-3 bg-gray-100/50 border border-transparent focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl text-sm outline-none transition-all placeholder:text-gray-400"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    suppressHydrationWarning={true}
                    className="p-2.5 relative hover:bg-gray-100/50 rounded-xl text-gray-500 hover:text-emerald-600 transition-colors"
                >
                    <Bell size={22} />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                </button>

                <div className="h-8 w-px bg-gray-200/60 hidden sm:block"></div>

                <div className="flex items-center gap-3 pl-1 cursor-pointer group p-1.5 hover:bg-white/50 rounded-2xl border border-transparent hover:border-gray-200/50 transition-all">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-gray-800 group-hover:text-emerald-800 transition-colors">John Doe</div>
                        <div className="text-xs text-gray-400 font-medium">Store Manager</div>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 text-emerald-700 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                        <User size={20} />
                    </div>
                </div>
            </div>
        </header>
    );
}
