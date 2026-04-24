'use client';

/**
 * BulkDialog — one modal, three modes:
 *   - move    → pick a target parent, PATCH each selected to that parent
 *   - prefix  → set one barcode_prefix on all selected (warning first)
 *   - delete  → confirm then DELETE each
 *
 * Uses the existing /api/inventory/categories/<id>/ endpoint for PATCH,
 * DELETE for delete. No new backend endpoint required — bulk is just
 * N serial PATCHes. For small N (<50) that's plenty; above that we'd
 * want a dedicated bulk endpoint (future).
 */

import { useState } from 'react';
import { X, Loader2, FolderTree, Hash, Trash2, AlertTriangle } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import type { CategoryNode } from './types';

interface Props {
    mode: 'move' | 'prefix' | 'delete';
    selectedIds: number[];
    allCategories: CategoryNode[];
    busy: boolean;
    onClose: () => void;
    onDone: () => void;
}

export function BulkDialog({ mode, selectedIds, allCategories, busy, onClose, onDone }: Props) {
    const [newParent, setNewParent] = useState<number | ''>('');
    const [newPrefix, setNewPrefix] = useState('');
    const [running, setRunning] = useState(false);
    const selected = allCategories.filter(c => selectedIds.includes(c.id));

    const run = async () => {
        setRunning(true);
        let ok = 0, fail = 0;
        for (const id of selectedIds) {
            try {
                if (mode === 'delete') {
                    await erpFetch(`inventory/categories/${id}/`, { method: 'DELETE' });
                } else {
                    const body: any = {};
                    if (mode === 'move') body.parent = newParent || null;
                    else if (mode === 'prefix') body.barcode_prefix = newPrefix;
                    await erpFetch(`inventory/categories/${id}/`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                }
                ok++;
            } catch {
                fail++;
            }
        }
        setRunning(false);
        if (fail === 0) toast.success(`${ok} categor${ok === 1 ? 'y' : 'ies'} updated`);
        else toast.warning(`${ok} updated, ${fail} failed`);
        onDone();
    };

    const title = mode === 'move' ? 'Move to parent'
                : mode === 'prefix' ? 'Set barcode prefix'
                : 'Delete categories';
    const Icon = mode === 'move' ? FolderTree : mode === 'prefix' ? Hash : Trash2;
    const color = mode === 'delete' ? 'var(--app-error, #ef4444)' : 'var(--app-primary)';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between"
                     style={{ background: `color-mix(in srgb, ${color} 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: color, color: 'white' }}>
                            <Icon size={15} />
                        </div>
                        <div>
                            <h3 className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>{title}</h3>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                {selectedIds.length} categor{selectedIds.length === 1 ? 'y' : 'ies'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="p-1.5 rounded-lg transition-all hover:bg-app-border/30"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Preview chip list of what'll be affected */}
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selected.map(c => (
                            <span key={c.id} className="text-tp-xs font-bold px-2 py-0.5 rounded"
                                  style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {c.name}
                            </span>
                        ))}
                    </div>

                    {mode === 'move' && (
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                New parent
                            </label>
                            <select value={newParent}
                                    onChange={e => setNewParent(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2 rounded-xl text-tp-md font-bold outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="">— Make them root categories —</option>
                                {allCategories
                                    .filter(c => !selectedIds.includes(c.id))
                                    .map(c => <option key={c.id} value={c.id}>{c.full_path || c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {mode === 'prefix' && (
                        <div>
                            <label className="text-tp-xxs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>
                                New barcode prefix
                            </label>
                            <input value={newPrefix}
                                   onChange={e => setNewPrefix(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                   placeholder="e.g. 0410"
                                   className="w-full px-3 py-2 rounded-xl text-tp-md font-mono font-bold outline-none"
                                   style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-xl"
                                 style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                <p className="text-tp-xs" style={{ color: 'var(--app-foreground)' }}>
                                    Prefixes must be unique per category. The server will reject the operation for every row where this prefix is already taken by a different category.
                                </p>
                            </div>
                        </div>
                    )}

                    {mode === 'delete' && (
                        <div className="p-3 rounded-xl"
                             style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                            <p className="text-tp-sm font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                This will permanently delete {selectedIds.length} categor{selectedIds.length === 1 ? 'y' : 'ies'}. Rows with products or sub-categories will fail and remain untouched.
                            </p>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 flex justify-end gap-2"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <button onClick={onClose} disabled={running || busy}
                            className="px-4 py-2 rounded-xl text-tp-sm font-bold transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        Cancel
                    </button>
                    <button onClick={run} disabled={running || busy || (mode === 'prefix' && !newPrefix)}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-sm font-bold text-white transition-all disabled:opacity-50"
                            style={{ background: color, boxShadow: `0 4px 12px color-mix(in srgb, ${color} 35%, transparent)` }}>
                        {running ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                        {mode === 'delete' ? 'Delete all' : 'Apply to all'}
                    </button>
                </div>
            </div>
        </div>
    );
}
