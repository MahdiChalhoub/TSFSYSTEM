'use client';

import { useState, useEffect, useTransition } from 'react';
import { MapPin, ChevronDown, Check, Globe } from 'lucide-react';
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
            {/* ── Trigger ── */}
            <button
                onClick={() => setIsOpen(v => !v)}
                suppressHydrationWarning
                className="flex items-center gap-2.5 h-9 pl-2 pr-3 rounded-xl transition-colors duration-150"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
            >
                {/* Icon */}
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isGlobal ? 'var(--app-surface-2)' : 'var(--app-primary-light)',
                        color: isGlobal ? 'var(--app-text-faint)' : 'var(--app-primary)',
                        border: '1px solid var(--app-border)',
                    }}>
                    {isGlobal ? <Globe size={12} /> : <MapPin size={12} />}
                </div>

                {/* Labels */}
                <div className="hidden lg:flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: 'var(--app-text-faint)' }}>
                        Active Site
                    </span>
                    <span className="text-xs font-bold truncate max-w-[120px]"
                        style={{ color: 'var(--app-text)' }}>
                        {selectedSite?.name || 'Global View'}
                    </span>
                </div>

                <ChevronDown size={13} style={{
                    color: 'var(--app-text-faint)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform var(--app-transition-fast)',
                    flexShrink: 0,
                }} />
            </button>

            {/* ── Dropdown ── */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '240px',
                        }}>

                        {/* Header */}
                        <div className="flex items-center gap-2 px-4 py-3"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                            <MapPin size={12} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: 'var(--app-text-muted)' }}>
                                Select Site
                            </span>
                        </div>

                        {/* Site list */}
                        <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {sites.map(site => {
                                const isActive = site.id === currentId;
                                return (
                                    <button key={site.id}
                                        onClick={() => handleSwitch(site.id)}
                                        disabled={isPending}
                                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-150 mb-0.5"
                                        style={{
                                            background: isActive ? 'var(--app-primary)' : 'transparent',
                                            color: isActive ? 'var(--app-bg)' : 'var(--app-text-muted)',
                                        }}
                                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        <div className="flex items-center gap-3 text-left min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ background: site.isActive ? 'var(--app-success)' : 'var(--app-text-faint)' }} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{site.name}</p>
                                                <p className="text-[9px] font-mono opacity-60 truncate">
                                                    {site.code || `SITE-${site.id}`}
                                                </p>
                                            </div>
                                        </div>
                                        {isActive && <Check size={14} className="flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Global view option */}
                        <div className="p-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <button
                                onClick={() => handleSwitch(-1)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors duration-150 text-[10px] font-black uppercase tracking-widest"
                                style={{
                                    border: `1px dashed ${isGlobal ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    color: isGlobal ? 'var(--app-primary)' : 'var(--app-text-faint)',
                                    background: isGlobal ? 'var(--app-primary-light)' : 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isGlobal) {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.borderColor = 'var(--app-primary)';
                                        el.style.color = 'var(--app-primary)';
                                        el.style.background = 'var(--app-primary-light)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isGlobal) {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.borderColor = 'var(--app-border)';
                                        el.style.color = 'var(--app-text-faint)';
                                        el.style.background = 'transparent';
                                    }
                                }}
                            >
                                <Globe size={13} />
                                Global Enterprise View
                                {isGlobal && <Check size={12} />}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
