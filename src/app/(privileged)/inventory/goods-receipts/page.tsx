'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { PackageCheck, Search, Calendar, Truck, CheckCircle, Clock } from 'lucide-react'

type GoodsReceipt = {
    id?: number | string
    receipt_number?: string
    reference?: string
    supplier?: number | string
    supplier_name?: string
    purchase_order_number?: string
    po_reference?: string
    status?: string
    received_at?: string
    created_at?: string
    line_count?: number
    total_items?: number
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function GoodsReceiptsPage() {
    const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/goods-receipts/')
            setReceipts(asArray(res) as GoodsReceipt[])
        } catch { setReceipts([]) }
        setLoading(false)
    }

    const filtered = receipts.filter(r =>
        !search || (r.receipt_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.purchase_order_number || '').includes(search)
    )

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-success), var(--app-primary))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                    <PackageCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Procurement</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Goods <span style={{ color: 'var(--app-primary)' }}>Receipts</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by receipt #, supplier, or PO..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} receipts</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Receipt #</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Supplier</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">PO Ref</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Date</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Items</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r, i) => (
                            <tr key={r.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all cursor-pointer">
                                <td className="px-4 py-3 font-mono text-xs font-bold text-app-foreground">{r.receipt_number || r.reference || `GR-${r.id}`}</td>
                                <td className="px-4 py-3 font-medium text-app-foreground flex items-center gap-2"><Truck size={12} className="text-app-muted-foreground" />{r.supplier_name || r.supplier || '—'}</td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground font-mono">{r.purchase_order_number || r.po_reference || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                                        style={{ background: `color-mix(in srgb, var(--app-${r.status === 'COMPLETED' ? 'success' : r.status === 'PARTIAL' ? 'warning' : 'info'}) 15%, transparent)`, color: `var(--app-${r.status === 'COMPLETED' ? 'success' : r.status === 'PARTIAL' ? 'warning' : 'info'})` }}>
                                        {r.status === 'COMPLETED' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                        {r.status || 'PENDING'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground flex items-center gap-1"><Calendar size={10} />{(() => { const d = r.received_at || r.created_at; return d ? new Date(d).toLocaleDateString() : '—' })()}</td>
                                <td className="px-4 py-3 text-xs text-app-foreground font-bold">{r.line_count ?? r.total_items ?? '—'}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No goods receipts found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
