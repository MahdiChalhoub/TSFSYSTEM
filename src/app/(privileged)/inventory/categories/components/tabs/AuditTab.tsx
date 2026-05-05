'use client';

/**
 * Audit Tab — last 50 changes for this category (create / update / delete).
 * Diff-style rendering: for UPDATE, shows field-level before → after pairs.
 * Entries come from /api/inventory/categories/<id>/audit/ which queries the
 * generic AuditLog table keyed by (table_name='Category', record_id=pk).
 */

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Clock, Link2, Unlink, FilterX } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import type { CategoryNode } from '../types';

interface Entry {
    id: string;
    timestamp: string;
    action: string;                   // CREATE / UPDATE / DELETE
    actor: string | null;
    old_value: Record<string, any> | null;
    new_value: Record<string, any> | null;
    description: string;
}

export function AuditTab({ node }: { node: CategoryNode }) {
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<Entry[]>([]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        erpFetch(`inventory/categories/${node.id}/audit/`)
            .then((res: any) => {
                if (cancelled) return;
                setEntries(Array.isArray(res?.results) ? res.results : []);
            })
            .catch(() => { if (!cancelled) setEntries([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [node.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="rounded-xl py-8 px-4 text-center"
                 style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)', border: '1px dashed var(--app-border)' }}>
                <Clock size={22} className="mx-auto mb-2" style={{ color: 'var(--app-muted-foreground)' }} />
                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>No audit trail yet.</p>
                <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                    Changes to this category will appear here once audit logging records them.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {entries.map(e => {
                // Same icon/tint mapping as the brand AuditTab — keep them
                // visually aligned so the audit story reads identically
                // across both side panels.
                const isLink = e.action === 'CREATE' || e.action.startsWith('LINK_') || e.action === 'SCOPE_VALUE'
                const isUnlink = e.action.startsWith('UNLINK_') || e.action === 'UNSCOPE_VALUE'
                const isClear = e.action.startsWith('CLEAR_') || e.action === 'UNSCOPE_ALL'
                const isDelete = e.action === 'DELETE'
                const Icon = isDelete ? Trash2
                    : isClear ? FilterX
                    : isUnlink ? Unlink
                    : isLink && e.action !== 'CREATE' ? Link2
                    : e.action === 'CREATE' ? Plus
                    : Pencil;
                const tint = isDelete ? 'var(--app-error, #ef4444)'
                    : isClear ? 'var(--app-error, #ef4444)'
                    : isUnlink ? 'var(--app-warning, #f59e0b)'
                    : isLink ? 'var(--app-success, #22c55e)'
                    : 'var(--app-primary)';
                // For UPDATE, diff the changed fields only
                const diff: { key: string; before: any; after: any }[] = [];
                if (e.action === 'UPDATE' && e.old_value && e.new_value) {
                    for (const k of Object.keys(e.new_value)) {
                        if (JSON.stringify(e.old_value[k]) !== JSON.stringify(e.new_value[k])) {
                            diff.push({ key: k, before: e.old_value[k], after: e.new_value[k] });
                        }
                    }
                }
                return (
                    <div key={e.id} className="p-3 rounded-xl"
                         style={{
                             background: 'var(--app-surface)',
                             border: '1px solid var(--app-border)',
                             borderLeft: `3px solid ${tint}`,
                         }}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <Icon size={12} style={{ color: tint }} />
                            <span className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: tint }}>
                                {e.action}
                            </span>
                            {e.actor && (
                                <span className="text-tp-xs font-medium" style={{ color: 'var(--app-foreground)' }}>
                                    {e.actor}
                                </span>
                            )}
                            <span className="text-tp-xxs ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                                {new Date(e.timestamp).toLocaleString()}
                            </span>
                        </div>
                        {e.description && (
                            <p className="text-tp-sm" style={{ color: 'var(--app-foreground)' }}>{e.description}</p>
                        )}
                        {diff.length > 0 && (
                            <div className="mt-2 space-y-0.5 text-tp-xs font-mono">
                                {diff.map(d => (
                                    <div key={d.key} className="flex items-start gap-2">
                                        <span className="font-bold uppercase tracking-widest"
                                              style={{ color: 'var(--app-muted-foreground)', minWidth: 90 }}>
                                            {d.key}
                                        </span>
                                        <span style={{ color: 'var(--app-error, #ef4444)', textDecoration: 'line-through' }}>
                                            {formatVal(d.before)}
                                        </span>
                                        <span style={{ color: 'var(--app-muted-foreground)' }}>→</span>
                                        <span style={{ color: 'var(--app-success, #22c55e)' }}>
                                            {formatVal(d.after)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function formatVal(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'string') return `"${v}"`;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
