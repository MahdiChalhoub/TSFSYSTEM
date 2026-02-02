'use client';

import { useState, useEffect, useTransition } from 'react';
import { Building2, ChevronDown, Check, Globe } from 'lucide-react';
import { setCurrentSite, getCurrentSiteId } from '@/app/actions/context';
import clsx from 'clsx';

export function SiteSwitcher({ sites }: { sites: any[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentId, setCurrentId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getCurrentSiteId().then(id => setCurrentId(id));
    }, []);

    const selectedSite = sites.find(s => s.id === currentId) || sites[0];

    const handleSwitch = (id: number) => {
        startTransition(async () => {
            await setCurrentSite(id);
            setCurrentId(id);
            setIsOpen(false);
            window.location.reload(); // Force full reload to update all server components
        });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-gray-800/40 border border-gray-700 hover:bg-gray-800 transition-all group"
            >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                    <Building2 size={16} />
                </div>
                <div className="text-left hidden lg:block">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-0.5">Active Site</div>
                    <div className="text-sm font-bold text-white leading-none truncate max-w-[120px]">
                        {selectedSite?.name || 'Global View'}
                    </div>
                </div>
                <ChevronDown size={16} className={clsx("text-gray-500 transition-transform duration-300", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-3 w-72 bg-[#1E293B] border border-gray-700 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Select Branch</h4>
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto">
                            {sites.map(site => (
                                <button
                                    key={site.id}
                                    onClick={() => handleSwitch(site.id)}
                                    disabled={isPending}
                                    className={clsx(
                                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all group mb-1",
                                        site.id === currentId ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "hover:bg-gray-700/50 text-gray-400 hover:text-white"
                                    )}
                                >
                                    <div className="flex items-center gap-3 text-left">
                                        <div className={clsx("w-2 h-2 rounded-full", site.isActive ? "bg-emerald-500" : "bg-gray-500")}></div>
                                        <div>
                                            <div className="text-sm font-bold">{site.name}</div>
                                            <div className={clsx("text-[10px] font-mono", site.id === currentId ? "text-indigo-200" : "text-gray-500")}>
                                                {site.code || `SITE-${site.id}`}
                                            </div>
                                        </div>
                                    </div>
                                    {site.id === currentId && <Check size={18} className="text-white" />}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 bg-gray-900/50 border-t border-gray-700">
                            <button
                                onClick={() => handleSwitch(-1)}
                                className={clsx(
                                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-700 text-gray-500 hover:text-indigo-400 hover:border-indigo-400 transition-all text-[10px] font-black uppercase tracking-widest",
                                    currentId === null && "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                                )}
                            >
                                <Globe size={14} /> Global Enterprise View
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
