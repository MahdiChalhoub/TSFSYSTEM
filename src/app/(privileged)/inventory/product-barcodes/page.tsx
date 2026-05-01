'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Barcode, Search, QrCode, Copy } from 'lucide-react'
import { toast } from 'sonner'

type BarcodeRow = {
    id?: number | string
    product?: number | string
    product_name?: string
    barcode?: string
    barcode_type?: string
    is_primary?: boolean
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function ProductBarcodesPage() {
    const [barcodes, setBarcodes] = useState<BarcodeRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/product-barcodes/')
            setBarcodes(asArray(res) as BarcodeRow[])
        } catch { setBarcodes([]) }
        setLoading(false)
    }

    const filtered = barcodes.filter(b =>
        !search || (b.barcode || '').includes(search) || (b.product_name || '').toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-info), var(--app-primary))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                    <QrCode className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Barcode Registry</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Product <span style={{ color: 'var(--app-primary)' }}>Barcodes</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by barcode or product..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} barcodes</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Product</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Barcode</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Type</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Primary</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((b, i) => (
                            <tr key={b.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all">
                                <td className="px-4 py-3 font-medium text-app-foreground">{b.product_name || b.product || '—'}</td>
                                <td className="px-4 py-3 font-mono text-xs text-app-foreground flex items-center gap-2">
                                    <Barcode size={14} className="text-app-muted-foreground" />
                                    {b.barcode}
                                    <button onClick={() => { navigator.clipboard.writeText(b.barcode || ''); toast.success('Copied!') }} className="p-1 rounded hover:bg-app-surface-hover"><Copy size={10} /></button>
                                </td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>{b.barcode_type || 'EAN-13'}</span></td>
                                <td className="px-4 py-3">{b.is_primary ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-app-success-bg text-app-success">PRIMARY</span> : <span className="text-[10px] text-app-muted-foreground">Alt</span>}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No barcodes found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
