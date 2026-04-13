'use client';

import { useState, useEffect, useTransition } from 'react';
import { ChevronDown, Check, Globe, MapPin } from 'lucide-react';
import { setCurrentSite, getCurrentSiteId } from '@/app/actions/context';

export function SiteSwitcher({ sites }: { sites: Record<string, any>[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentId, setCurrentId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getCurrentSiteId().then(id => setCurrentId(id));
    }, []);

    const selectedSite = sites.find(s => s.id === currentId) || null;
    const isGlobal = selectedSite === null;

    const handleSwitch = (id: number) => {
        startTransition(async () => {
            await setCurrentSite(id);
            setCurrentId(id);
            setIsOpen(false);
            window.location.reload();
        });
    };

    if (!sites || sites.length === 0) return null;

    return (
        <div className="relative flex-shrink-0">

            {/* ── Trigger ─────────────────────────────────────────── */}
            <button
                onClick={() => setIsOpen(v => !v)}
                suppressHydrationWarning
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg transition-colors duration-150"
                style={{
                    background: isOpen ? 'var(--app-surface-2)' : 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--app-text)',
                }}
                onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'var(--app-surface-2)';
                    el.style.borderColor = 'var(--app-border)';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'transparent';
                        el.style.borderColor = 'transparent';
                    }
                }}
            >
                {/* Icon */}
                <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isGlobal ? 'var(--app-surface-2)' : 'var(--app-primary-light)',
                        color: isGlobal ? 'var(--app-text-faint)' : 'var(--app-primary)',
                        border: '1px solid var(--app-border)',
                    }}
                >
                    {isGlobal ? <Globe size={10} /> : <MapPin size={10} />}
                </div>

                <span className="hidden sm:block text-sm font-semibold truncate max-w-[110px]">
                    {selectedSite?.name || 'Global View'}
                </span>

                <ChevronDown
                    size={13}
                    className="flex-shrink-0"
                    style={{
                        color: 'var(--app-text-faint)',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform var(--app-transition-fast)',
                    }}
                />
            </button>

            {/* ── Dropdown ────────────────────────────────────────── */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute top-full left-0 mt-1.5 rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '220px',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center gap-2 px-3 py-2.5"
                            style={{ borderBottom: '1px solid var(--app-border)' }}
                        >
                            <MapPin size={11} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                                Sites
                            </span>
                            <span
                                className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--app-surface-2)', color: 'var(--app-text-faint)' }}
                            >
                                {sites.length}
                            </span>
                        </div>

                        {/* Site list */}
                        <div className="p-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                            {sites.map(site => {
                                const isActive = site.id === currentId;
                                return (
                                    <button
                                        key={site.id}
                                        onClick={() => handleSwitch(site.id)}
                                        disabled={isPending}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150"
                                        style={{
                                            background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                            color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                                        }}
                                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        {/* Status dot */}
                                        <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ background: site.isActive ? 'var(--app-success)' : 'var(--app-text-faint)' }}
                                        />

                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-xs font-semibold truncate">{site.name}</p>
                                            <p className="text-[9px] font-mono opacity-50 truncate">
                                                {site.code || `SITE-${site.id}`}
                                            </p>
                                        </div>

                                        {isActive && <Check size={13} className="flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Global view */}
                        <div className="p-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <button
                                onClick={() => handleSwitch(-1)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150 text-xs font-medium"
                                style={{
                                    background: isGlobal ? 'var(--app-primary-light)' : 'transparent',
                                    color: isGlobal ? 'var(--app-primary)' : 'var(--app-text-faint)',
                                }}
                                onMouseEnter={(e) => { if (!isGlobal) { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text-muted)'; } }}
                                onMouseLeave={(e) => { if (!isGlobal) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; } }}
                            >
                                <Globe size={13} className="flex-shrink-0" />
                                Global Enterprise View
                                {isGlobal && <Check size={12} className="flex-shrink-0 ml-auto" />}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
