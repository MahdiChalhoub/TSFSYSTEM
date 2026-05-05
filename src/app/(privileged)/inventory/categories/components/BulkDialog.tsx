'use client';

/**
 * BulkDialog — two modes:
 *   - move    → pick a target parent, PATCH each selected to that parent
 *   - delete  → type-to-confirm guard + safe/blocked split preview
 *
 * The delete flow pre-analyses each selected category so the user sees
 * *exactly* what will happen before typing DELETE:
 *   - Safe    — no products, no sub-categories → will be deleted
 *   - Blocked — has products or sub-categories → will be skipped
 *
 * Bulk "Set prefix" was removed: barcode prefixes must be unique per
 * category, so that op promised something it couldn't deliver.
 */

import { useMemo, useState } from 'react';
import { X, Loader2, FolderTree, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import type { CategoryNode } from './types';

interface Props {
    mode: 'move' | 'delete';
    selectedIds: number[];
    allCategories: CategoryNode[];
    busy: boolean;
    onClose: () => void;
    onDone: () => void;
}

type DeletePlan = { safe: CategoryNode[]; blocked: { node: CategoryNode; reason: string }[] };

function analyseDelete(selected: CategoryNode[], all: CategoryNode[]): DeletePlan {
    const childrenByParent = new Map<number, number>();
    all.forEach(c => {
        if (c.parent != null) {
            childrenByParent.set(c.parent, (childrenByParent.get(c.parent) || 0) + 1);
        }
    });
    const safe: CategoryNode[] = [];
    const blocked: { node: CategoryNode; reason: string }[] = [];
    selected.forEach(c => {
        const reasons: string[] = [];
        if ((c.product_count || 0) > 0) {
            reasons.push(`${c.product_count} product${c.product_count === 1 ? '' : 's'}`);
        }
        const kids = childrenByParent.get(c.id) || 0;
        if (kids > 0) {
            reasons.push(`${kids} sub-categor${kids === 1 ? 'y' : 'ies'}`);
        }
        if (reasons.length) blocked.push({ node: c, reason: reasons.join(' + ') });
        else safe.push(c);
    });
    return { safe, blocked };
}

export function BulkDialog({ mode, selectedIds, allCategories, busy, onClose, onDone }: Props) {
    const [newParent, setNewParent] = useState<number | ''>('');
    const [confirmText, setConfirmText] = useState('');
    const [running, setRunning] = useState(false);
    const selected = useMemo(
        () => allCategories.filter(c => selectedIds.includes(c.id)),
        [allCategories, selectedIds]
    );
    const plan = useMemo(
        () => mode === 'delete' ? analyseDelete(selected, allCategories) : null,
        [mode, selected, allCategories]
    );
    const CONFIRM_WORD = 'DELETE';
    const canDelete = mode === 'delete'
        && plan !== null
        && plan.safe.length > 0
        && confirmText.trim().toUpperCase() === CONFIRM_WORD;

    const run = async () => {
        setRunning(true);
        let ok = 0, fail = 0;
        const idsToProcess = mode === 'delete' && plan
            ? plan.safe.map(c => c.id)
            : selectedIds;
        for (const id of idsToProcess) {
            try {
                if (mode === 'delete') {
                    await erpFetch(`inventory/categories/${id}/`, { method: 'DELETE' });
                } else {
                    await erpFetch(`inventory/categories/${id}/`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parent: newParent || null }),
                    });
                }
                ok++;
            } catch {
                fail++;
            }
        }
        setRunning(false);
        const blockedCount = plan?.blocked.length || 0;
        if (fail === 0 && blockedCount === 0) {
            toast.success(mode === 'delete'
                ? `${ok} categor${ok === 1 ? 'y' : 'ies'} deleted`
                : `${ok} categor${ok === 1 ? 'y' : 'ies'} moved`);
        } else if (mode === 'delete') {
            toast.warning(`${ok} deleted${blockedCount > 0 ? `, ${blockedCount} blocked` : ''}${fail > 0 ? `, ${fail} failed` : ''}`);
        } else {
            toast.warning(`${ok} updated, ${fail} failed`);
        }
        onDone();
    };

    const title = mode === 'move' ? 'Move to parent' : 'Delete categories';
    const Icon = mode === 'move' ? FolderTree : Trash2;
    const color = mode === 'delete' ? 'var(--app-error, #ef4444)' : 'var(--app-primary)';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg max-h-[92vh] rounded-2xl overflow-hidden flex flex-col"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ background: `color-mix(in srgb, ${color} 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: color, boxShadow: `0 4px 12px color-mix(in srgb, ${color} 30%, transparent)` }}>
                            <Icon size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-app-foreground">{title}</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">
                                {selectedIds.length} categor{selectedIds.length === 1 ? 'y' : 'ies'} selected
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {mode === 'move' && (
                        <>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {selected.map(c => (
                                    <span key={c.id} className="text-tp-xs font-bold px-2 py-0.5 rounded"
                                          style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        {c.name}
                                    </span>
                                ))}
                            </div>
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
                        </>
                    )}

                    {mode === 'delete' && plan && (
                        <>
                            {/* Summary chips — counts at a glance */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-xl flex items-center gap-2"
                                     style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 25%, transparent)' }}>
                                    <CheckCircle2 size={16} style={{ color: 'var(--app-success, #22c55e)' }} />
                                    <div>
                                        <p className="text-tp-lg font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                                            {plan.safe.length}
                                        </p>
                                        <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Will delete
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl flex items-center gap-2"
                                     style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                    <ShieldAlert size={16} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <div>
                                        <p className="text-tp-lg font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                            {plan.blocked.length}
                                        </p>
                                        <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Blocked (kept)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed lists */}
                            {plan.safe.length > 0 && (
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="px-3 py-1.5 text-tp-xxs font-bold uppercase tracking-widest flex items-center gap-1.5"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        <CheckCircle2 size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                        To delete ({plan.safe.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 p-2 max-h-24 overflow-y-auto custom-scrollbar">
                                        {plan.safe.map(c => (
                                            <span key={c.id} className="text-tp-xs font-bold px-2 py-0.5 rounded"
                                                  style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                                {c.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {plan.blocked.length > 0 && (
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="px-3 py-1.5 text-tp-xxs font-bold uppercase tracking-widest flex items-center gap-1.5"
                                         style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        <ShieldAlert size={10} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                        Protected — not deleted ({plan.blocked.length})
                                    </div>
                                    <div className="p-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                        {plan.blocked.map(({ node, reason }) => (
                                            <div key={node.id} className="flex items-center gap-2 text-tp-xs">
                                                <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{node.name}</span>
                                                <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>has {reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Type-to-confirm guard */}
                            {plan.safe.length > 0 ? (
                                <div>
                                    <label className="text-tp-xs font-bold block mb-1" style={{ color: 'var(--app-foreground)' }}>
                                        Type <code className="px-1 py-0.5 rounded font-mono font-bold"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                            {CONFIRM_WORD}
                                        </code> to confirm permanent deletion
                                    </label>
                                    <input
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder={CONFIRM_WORD}
                                        autoComplete="off"
                                        className="w-full px-3 py-2 rounded-xl text-tp-md font-mono font-bold outline-none transition-all"
                                        style={{
                                            background: 'var(--app-background)',
                                            border: `1px solid ${canDelete ? 'var(--app-error, #ef4444)' : 'var(--app-border)'}`,
                                            color: 'var(--app-foreground)',
                                        }}
                                    />
                                    <p className="text-tp-xxs font-bold mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        This action cannot be undone.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 rounded-xl"
                                     style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                    <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Nothing to delete — every selected category has products or sub-categories. Move the products first, then try again.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {mode === 'delete' && plan
                            ? (plan.safe.length > 0
                                ? `Will remove ${plan.safe.length} · keep ${plan.blocked.length}`
                                : 'Nothing will change')
                            : `Moving ${selectedIds.length} row${selectedIds.length === 1 ? '' : 's'}`}
                    </div>
                    <button onClick={onClose} disabled={running || busy}
                            className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        Cancel
                    </button>
                    <button onClick={run}
                            disabled={running || busy || (mode === 'delete' ? !canDelete : false)}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: color, boxShadow: `0 2px 8px color-mix(in srgb, ${color} 25%, transparent)` }}>
                        {running ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                        {mode === 'delete'
                            ? (plan && plan.safe.length > 0 ? `Delete ${plan.safe.length}` : 'Nothing to delete')
                            : 'Apply'}
                    </button>
                </div>
            </div>
        </div>
    );
}
