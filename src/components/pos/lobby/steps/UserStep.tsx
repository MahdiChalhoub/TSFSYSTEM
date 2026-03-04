'use client';

import { memo } from 'react';
import { User, AlertCircle } from 'lucide-react';
import type { Register, RegisterUser } from '../types';

export const UserStep = memo(function UserStep({ register, onSelect }: { register: Register; onSelect: (u: RegisterUser) => void }) {
    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[var(--app-info-bg)] border border-[var(--app-info)]/30 text-[var(--app-info)] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-sm shadow-[var(--app-info)]/20">
                    <User size={36} />
                </div>
                <h2 className="text-3xl font-black text-[var(--app-text)] mb-1">Who&apos;s working?</h2>
                <p className="text-[var(--app-text-muted)] text-sm">{register.name} — tap your name to continue</p>
            </div>

            {register.authorizedUsers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {register.authorizedUsers.map(u => (
                        <button
                            key={u.id}
                            onClick={() => onSelect(u)}
                            className="group p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-info)]/50 hover:bg-[var(--app-info-bg)] transition-all duration-200 text-center active:scale-[0.97]"
                        >
                            <div className="w-16 h-16 rounded-full bg-[var(--app-info-bg)] text-[var(--app-info)] flex items-center justify-center mx-auto mb-3 font-black text-xl group-hover:bg-[var(--app-info)] group-hover:text-[var(--app-text)] transition-all shadow-lg">
                                {u.name?.substring(0, 2).toUpperCase()}
                            </div>
                            <p className="text-sm font-black text-[var(--app-text)]">{u.name}</p>
                            {!u.hasPin && (
                                <p className="text-[10px] text-[var(--app-warning)] mt-1.5 flex items-center justify-center gap-1">
                                    <AlertCircle size={9} /> No PIN set
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 border border-[var(--app-border)]/50 rounded-2xl bg-[var(--app-surface-2)]">
                    <AlertCircle size={36} className="text-[var(--app-text-faint)] mx-auto mb-3" />
                    <p className="text-[var(--app-text-muted)] font-bold">No cashiers assigned</p>
                    <p className="text-[var(--app-text-faint)] text-sm mt-1">Assign users in POS Configuration</p>
                </div>
            )}
        </div>
    );
});
