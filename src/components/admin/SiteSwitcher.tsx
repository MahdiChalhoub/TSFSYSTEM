'use client';

import { useState, useEffect, useTransition } from 'react';
import { ChevronDown, Check, Globe, MapPin, Loader2 } from 'lucide-react';
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

    const displayName = selectedSite?.name || 'Global View';

    return (
        <div className="relative flex-shrink-0">

            {/* ── Trigger ── */}
            <button
                onClick={() => setIsOpen(v => !v)}
                suppressHydrationWarning
                className="flex items-center gap-2 h-8 px-2 rounded-lg transition-all duration-150"
                style={{
                    background: isOpen ? 'var(--app-surface)' : 'transparent',
                    border: `1px solid ${isOpen ? 'var(--app-border)' : 'transparent'}`,
                    cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = 'var(--app-surface)';
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
                {/* Icon avatar */}
                <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isGlobal ? 'var(--app-surface-2)' : 'var(--app-primary-light)',
                        color: isGlobal ? 'var(--app-muted-foreground)' : 'var(--app-primary)',
                        border: '1px solid var(--app-border)',
                    }}
                >
                    {isGlobal ? <Globe size={11} /> : <MapPin size={11} />}
                </div>

                {/* Name */}
                <span
                    className="hidden sm:block text-[13px] font-semibold leading-none truncate max-w-[110px]"
                    style={{ color: 'var(--app-foreground)' }}
                >
                    {displayName}
                </span>

                {/* Chevron */}
                <ChevronDown
                    size={12}
                    className="flex-shrink-0 opacity-40 transition-transform duration-200"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        color: 'var(--app-foreground)',
                    }}
                />
            </button>

            {/* ── Dropdown ── */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute top-full left-0 mt-1 z-50 overflow-hidden rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '240px',
                        }}
                    >
                        {/* Title row */}
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                            <span
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                Switch Site
                            </span>
                            <span
                                className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--app-surface-2)', color: 'var(--app-muted-foreground)' }}
                            >
                                {sites.length}
                            </span>
                        </div>

                        {/* Site list */}
                        <div className="px-1.5 pb-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                            {sites.map(site => {
                                const isActive = site.id === currentId;
                                return (
                                    <button
                                        key={site.id}
                                        onClick={() => handleSwitch(site.id)}
                                        disabled={isPending}
                                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                        style={{
                                            background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                            borderLeft: isActive ? '2px solid var(--app-primary)' : '2px solid transparent',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                        }}
                                    >
                                        {/* Status dot */}
                                        <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ background: site.isActive ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}
                                        />

                                        <div className="flex-1 min-w-0 text-left">
                                            <p
                                                className="text-xs font-semibold truncate leading-tight"
                                                style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-foreground)' }}
                                            >
                                                {site.name}
                                            </p>
                                            <p
                                                className="text-[9px] font-mono truncate leading-tight mt-0.5"
                                                style={{ color: 'var(--app-muted-foreground)' }}
                                            >
                                                {site.code || `SITE-${site.id}`}
                                            </p>
                                        </div>

                                        <div className="flex-shrink-0">
                                            {isPending
                                                ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                                : isActive
                                                    ? <Check size={13} style={{ color: 'var(--app-primary)' }} />
                                                    : null
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Global view */}
                        <div
                            className="px-1.5 pb-1.5 pt-1"
                            style={{ borderTop: '1px solid var(--app-border)' }}
                        >
                            <button
                                onClick={() => handleSwitch(-1)}
                                disabled={isPending}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-100 text-xs"
                                style={{
                                    background: isGlobal ? 'var(--app-primary-light)' : 'transparent',
                                    borderLeft: isGlobal ? '2px solid var(--app-primary)' : '2px solid transparent',
                                    color: isGlobal ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isGlobal) {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'var(--app-surface-2)';
                                        el.style.color = 'var(--app-foreground)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isGlobal) {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'transparent';
                                        el.style.color = 'var(--app-muted-foreground)';
                                    }
                                }}
                            >
                                <Globe size={13} className="flex-shrink-0" />
                                <span className="font-medium">Global Enterprise View</span>
                                {isGlobal && (
                                    <Check size={12} className="flex-shrink-0 ml-auto" />
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
