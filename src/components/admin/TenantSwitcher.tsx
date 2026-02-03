'use client';

import { useState, useTransition } from 'react';
import { Building, ChevronDown, Check, DoorOpen, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

export function TenantSwitcher({ organizations, forcedSlug, user }: { organizations: any[], forcedSlug?: string, user?: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Helper to get current subdomain/slug
    const currentSlug = forcedSlug || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '');
    const activeOrg = organizations.find(o => o.slug === currentSlug);

    // Only show Master Panel to authorized SaaS Staff (Superusers)
    // We allow Superusers to access the Master Panel even if they are currently inside a specific tenant context.
    const showMasterPanel = user?.is_superuser || user?.is_staff;

    const handleSwitch = (slug: string) => {
        startTransition(() => {
            // Redirect to the subdomain version
            const protocol = window.location.protocol;
            const port = window.location.port;
            const hostname = window.location.hostname.replace(/^(saas\.|[a-z0-9-]+\.)/i, '');
            const newUrl = `${protocol}//${slug}.${hostname}${port ? `:${port}` : ''}`;
            window.location.href = newUrl;
        });
    };

    // Locked mode: Single Org and No Master Access
    const isLocked = organizations.length <= 1 && !showMasterPanel;

    return (
        <div className="relative">
            <button
                onClick={() => !isLocked && setIsOpen(!isOpen)}
                suppressHydrationWarning={true}
                className={clsx(
                    "flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all group",
                    isLocked
                        ? "bg-transparent border-transparent cursor-default"
                        : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
                )}
            >
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                    <Building size={16} />
                </div>
                <div className="text-left hidden lg:block">
                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-0.5">
                        {showMasterPanel ? 'Control Plane' : 'Workspace'}
                    </div>
                    <div className="text-sm font-bold text-gray-800 leading-none truncate max-w-[140px]">
                        {activeOrg?.name || 'Platform Root'}
                    </div>
                </div>
                {!isLocked && (
                    <ChevronDown size={16} className={clsx("text-gray-400 transition-transform duration-300", isOpen && "rotate-180")} />
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-3 w-80 bg-white border border-gray-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest text-[10px]">Select Managed Version</h4>
                            {showMasterPanel && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold rounded-full uppercase tracking-tighter shadow-sm">Super Admin</span>
                            )}
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto">
                            {organizations.length === 0 && (
                                <div className="p-6 text-center text-gray-400 text-sm italic font-medium">No organizations found</div>
                            )}
                            {organizations.map(org => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSwitch(org.slug)}
                                    disabled={isPending}
                                    className={clsx(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all group mb-1",
                                        org.slug === currentSlug ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                                    )}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className={clsx("w-2 h-2 rounded-full", org.isActive ? "bg-emerald-400" : "bg-gray-300")}></div>
                                        <div>
                                            <div className="text-sm font-bold">{org.name}</div>
                                            <div className={clsx("text-[10px] font-mono opacity-60")}>
                                                {org.slug}.localhost
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {org.slug === currentSlug && <Check size={18} />}
                                        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </button>
                            ))}
                        </div>
                        {showMasterPanel && (
                            <div className="p-3 bg-gray-50/80 border-t border-gray-100">
                                <button
                                    onClick={() => window.location.href = 'http://saas.localhost:3000/admin/saas/dashboard'}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-white transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                                >
                                    <DoorOpen size={14} /> Master Panel
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
