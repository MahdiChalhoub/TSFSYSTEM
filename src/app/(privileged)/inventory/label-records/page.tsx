'use client'

import { useState, useEffect } from 'react'
import { getLabelRecords } from '@/app/actions/plm-governance'
import { FileText, Search, Printer, Calendar } from 'lucide-react'

type LabelRecord = {
    id?: number | string
    product_name?: string
    product?: string
    barcode?: string
    label_type?: string
    type?: string
    quantity?: number
    copies?: number
    created_at?: string
}

export default function LabelRecordsPage() {
    const [records, setRecords] = useState<LabelRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const res = await getLabelRecords()
        if (res.success) {
            const data = res.data
            const rows = Array.isArray(data)
                ? data
                : (data && typeof data === 'object' && 'results' in data && Array.isArray((data as { results?: unknown[] }).results))
                    ? (data as { results: unknown[] }).results
                    : []
            setRecords(rows as LabelRecord[])
        }
        setLoading(false)
    }

    const filtered = records.filter(r =>
        !search || (r.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.barcode || '').includes(search)
    )

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-info))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Print History</p>
                        <h1>
                            Label <span style={{ color: 'var(--app-primary)' }}>Records</span>
                        </h1>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by product or barcode..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} records</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Product</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Barcode</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Type</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Printed</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r, i) => (
                            <tr key={r.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all">
                                <td className="px-4 py-3 font-medium text-app-foreground">{r.product_name || r.product || '—'}</td>
                                <td className="px-4 py-3 font-mono text-xs text-app-muted-foreground">{r.barcode || '—'}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>{r.label_type || r.type || 'SHELF'}</span></td>
                                <td className="px-4 py-3 text-app-foreground flex items-center gap-1"><Printer size={12} className="text-app-muted-foreground" />{r.quantity || r.copies || 1}</td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground flex items-center gap-1"><Calendar size={12} />{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No label records found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
