'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { History, Search, User, Calendar } from 'lucide-react'

type AuditEntry = {
    id?: number | string
    product?: number | string
    product_name?: string
    action?: string
    change_type?: string
    field_name?: string
    old_value?: string | number | boolean | null
    new_value?: string | number | boolean | null
    changed_by_name?: string
    user?: string
    created_at?: string
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function ProductAuditTrailPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/product-audit-trail/')
            setEntries(asArray(res) as AuditEntry[])
        } catch { setEntries([]) }
        setLoading(false)
    }

    const filtered = entries.filter(e =>
        !search || (e.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.field_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.changed_by_name || '').toLowerCase().includes(search.toLowerCase())
    )

    const getChangeColor = (action: string | undefined) => {
        if (action === 'CREATE' || action === 'create') return 'var(--app-success)'
        if (action === 'DELETE' || action === 'delete') return 'var(--app-danger)'
        return 'var(--app-warning)'
    }

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-warning), var(--app-danger))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                    <History className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Compliance</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Product <span style={{ color: 'var(--app-primary)' }}>Audit Trail</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by product, field, or user..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} entries</span>
            </div>

            <div className="space-y-2">
                {filtered.map((entry, i) => (
                    <div key={entry.id || i} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: getChangeColor(entry.action || entry.change_type) }} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-app-foreground">{entry.product_name || entry.product || '—'}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: `color-mix(in srgb, ${getChangeColor(entry.action)} 15%, transparent)`, color: getChangeColor(entry.action) }}>
                                    {entry.action || entry.change_type || 'UPDATE'}
                                </span>
                                {entry.field_name && <span className="text-[10px] text-app-muted-foreground font-mono">{entry.field_name}</span>}
                            </div>
                            {(entry.old_value || entry.new_value) && (
                                <div className="mt-1 text-xs">
                                    {entry.old_value && <span className="text-red-400 line-through mr-2">{String(entry.old_value).substring(0, 50)}</span>}
                                    {entry.new_value && <span className="text-app-success">{String(entry.new_value).substring(0, 50)}</span>}
                                </div>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] text-app-muted-foreground"><User size={9} />{entry.changed_by_name || entry.user || 'System'}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-app-muted-foreground"><Calendar size={9} />{entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-16">
                        <History size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                        <p className="text-sm font-bold text-app-muted-foreground">No audit trail entries</p>
                        <p className="text-xs text-app-muted-foreground">Changes to products will be recorded here</p>
                    </div>
                )}
            </div>
        </div>
    )
}
