'use client';
import React from 'react';
import { X } from 'lucide-react';
import type { DiffEntry } from '../hooks/useConfigDiff';

export function ConfigDiffModal({ entries, onClose }: {
    entries: DiffEntry[];
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-[520px] max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
                    <span className="text-[11px] font-black text-app-foreground">Unsaved Changes ({entries.length})</span>
                    <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground">
                        <X size={14} />
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[55vh] p-3 space-y-2">
                    {entries.length === 0 ? (
                        <p className="text-[10px] text-app-muted-foreground text-center py-6">No unsaved changes</p>
                    ) : entries.map((e, i) => (
                        <div key={i} className="rounded-lg border border-app-border/40 bg-app-background/50 p-2.5">
                            <div className="text-[10px] font-bold text-app-foreground mb-1.5">{e.field.replace(/_/g, ' ')}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-md bg-red-500/5 border border-red-500/10 px-2 py-1">
                                    <span className="text-[8px] font-bold text-red-500/60 uppercase">Before</span>
                                    <div className="text-[10px] text-red-600/80 font-mono mt-0.5 break-all">{JSON.stringify(e.oldVal)}</div>
                                </div>
                                <div className="rounded-md bg-emerald-500/5 border border-emerald-500/10 px-2 py-1">
                                    <span className="text-[8px] font-bold text-emerald-500/60 uppercase">After</span>
                                    <div className="text-[10px] text-emerald-600/80 font-mono mt-0.5 break-all">{JSON.stringify(e.newVal)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
