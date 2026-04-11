'use client';

import { memo } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Building2, MapPin, AlertCircle } from 'lucide-react';
import type { Site } from '../types';

export const SiteStep = memo(function SiteStep({ sites, onSelect }: { sites: Site[]; onSelect: (s: Site) => void }) {
    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/20 mb-4">
                    <MapPin size={12} className="text-[var(--app-primary)]" />
                    <span className="text-[11px] font-black text-[var(--app-primary)] uppercase tracking-widest">Select Location</span>
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Where are you working?</h2>
                <p className="text-[var(--app-text-muted)] text-sm">Choose the site for this session</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sites.map((site: Site) => {
                    const hasRegs = site.registers.length > 0;
                    const hasActive = site.registers.some(r => r.isOpen);
                    return (
                        <button
                            key={site.id}
                            onClick={() => hasRegs ? onSelect(site) : toast.info(`"${site.name}" has no registers.`)}
                            className={clsx(
                                'group relative p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.97]',
                                hasRegs
                                    ? 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-primary-strong)]/50 hover:bg-[var(--app-primary-light)]'
                                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)]/50 opacity-50 cursor-default'
                            )}
                        >
                            {hasRegs && <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--app-primary)]/0 to-[var(--app-primary-glow)]/0 group-hover:from-[var(--app-primary)]/10 group-hover:to-[var(--app-primary-glow)]/10 transition-all duration-300" />}
                            <div className="relative">
                                <div className={clsx(
                                    'w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-all',
                                    hasRegs ? 'bg-[var(--app-primary-light)] text-[var(--app-primary)] group-hover:bg-[var(--app-primary)] group-hover:text-white' : 'bg-[var(--app-surface-hover)] text-[var(--app-text-faint)]'
                                )}>
                                    <Building2 size={20} />
                                </div>
                                <h3 className="font-black text-[var(--app-text)] text-base leading-tight">{site.name}</h3>
                                {site.code && <p className="text-[var(--app-text-faint)] text-xs font-mono mt-0.5">{site.code}</p>}
                                {site.address && <p className="text-[var(--app-text-faint)] text-xs mt-1 line-clamp-1">{site.address}</p>}
                                <div className="flex items-center gap-2 mt-3">
                                    {hasRegs ? (
                                        <>
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] text-[10px] font-bold">
                                                {site.registers.length} register{site.registers.length !== 1 ? 's' : ''}
                                            </span>
                                            {hasActive && (
                                                <span className="px-2 py-0.5 rounded-full bg-[var(--app-success-bg)] text-[var(--app-success)] text-[10px] font-black animate-pulse">
                                                    ● Live
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--app-warning-bg)] text-[var(--app-warning)]/60 text-[10px] font-bold">No registers</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {sites.length === 0 && (
                <div className="text-center py-16 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <AlertCircle size={40} className="text-[var(--app-text-faint)]/50 mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No sites configured</p>
                    <p className="text-[var(--app-text-faint)] text-sm mt-1">Create sites in POS Settings</p>
                </div>
            )}
        </div>
    );
});
