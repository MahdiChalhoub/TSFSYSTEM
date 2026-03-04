'use client';

import { memo } from 'react';
import clsx from 'clsx';
import { Monitor, Unlock, Lock, User, Clock } from 'lucide-react';
import type { Site, Register } from '../types';

export const RegisterStep = memo(function RegisterStep({ site, onSelect }: { site: Site; onSelect: (r: Register) => void }) {
    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--app-primary-light)] border border-[var(--app-primary-strong)]/20 mb-4">
                    <Monitor size={12} className="text-[var(--app-primary)]" />
                    <span className="text-[11px] font-black text-[var(--app-primary)] uppercase tracking-widest">{site.name}</span>
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Select Register</h2>
                <p className="text-[var(--app-text-muted)] text-sm">Choose your workstation</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {site.registers.map(reg => (
                    <button
                        key={reg.id}
                        onClick={() => onSelect(reg)}
                        className={clsx(
                            'group relative p-5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.97]',
                            reg.isOpen
                                ? 'bg-[var(--app-success-bg)] border-[var(--app-success)]/30 hover:border-[var(--app-success)]/60'
                                : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-primary-strong)]/50 hover:bg-[var(--app-primary-light)]'
                        )}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={clsx(
                                'w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                                reg.isOpen ? 'bg-[var(--app-success-bg)] text-[var(--app-success)]' : 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] group-hover:bg-indigo-400 group-hover:text-[var(--app-text)]'
                            )}>
                                <Monitor size={20} />
                            </div>
                            {reg.isOpen
                                ? <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--app-success-bg)] text-[var(--app-success)] text-[10px] font-black"><Unlock size={9} /> OPEN</span>
                                : <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[10px] font-black"><Lock size={9} /> CLOSED</span>
                            }
                        </div>
                        <h3 className="font-black text-[var(--app-text)] text-base">{reg.name}</h3>
                        {reg.isOpen && reg.currentSession && (
                            <div className="mt-2 space-y-0.5">
                                <p className="text-[var(--app-success)]/80 text-xs font-bold flex items-center gap-1"><User size={10} />{reg.currentSession.cashierName}</p>
                                <p className="text-[var(--app-text-faint)] text-[10px] flex items-center gap-1"><Clock size={10} />Since {new Date(reg.currentSession.openedAt).toLocaleTimeString()}</p>
                            </div>
                        )}
                        {reg.allowedAccounts.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                                {reg.allowedAccounts.slice(0, 3).map(a => (
                                    <span key={a.id} className="px-1.5 py-0.5 rounded bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[9px] font-bold">{a.name}</span>
                                ))}
                                {reg.allowedAccounts.length > 3 && <span className="px-1.5 py-0.5 rounded bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] text-[9px]">+{reg.allowedAccounts.length - 3}</span>}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {site.registers.length === 0 && (
                <div className="text-center py-16 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <Monitor size={40} className="text-[var(--app-text-faint)]/50 mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No registers at this site</p>
                </div>
            )}
        </div>
    );
});
