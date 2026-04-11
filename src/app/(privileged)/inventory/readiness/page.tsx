// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { getReadinessSummary, getReadinessRecords, refreshReadiness } from '@/app/actions/plm-governance'
import {
    ShieldCheck, ScanBarcode, Tag, MapPin, Truck, BarChart3,
    RefreshCw, CheckCircle2, AlertTriangle, XCircle, Image, Search
} from 'lucide-react'

const DIMENSIONS = [
    { key: 'scan_ready', label: 'Scan Ready', icon: ScanBarcode, desc: 'Has valid barcode' },
    { key: 'label_ready', label: 'Label Ready', icon: Tag, desc: 'Valid label printed' },
    { key: 'shelf_ready', label: 'Shelf Ready', icon: MapPin, desc: 'Location assigned' },
    { key: 'purchase_ready', label: 'Purchase Ready', icon: Truck, desc: 'Active supplier linked' },
    { key: 'replenishment_ready', label: 'Replenishment', icon: BarChart3, desc: 'Rules configured' },
    { key: 'catalog_ready', label: 'Catalog Ready', icon: Image, desc: 'Image + description + approved' },
]

function StatusBadge({ status }: { status: string }) {
    if (status === 'READY') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700"><CheckCircle2 size={10} />Ready</span>
    if (status === 'PARTIAL') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700"><AlertTriangle size={10} />Partial</span>
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700"><XCircle size={10} />Not Ready</span>
}

export default function ProductReadinessPage() {
    const [summary, setSummary] = useState<any>(null)
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState<number | null>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'ready' | 'partial' | 'not_ready'>('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const [sumRes, recRes] = await Promise.all([getReadinessSummary(), getReadinessRecords()])
        if (sumRes.success) setSummary(sumRes.data)
        if (recRes.success) setRecords(recRes.data)
        setLoading(false)
    }

    async function handleRefresh(productId: number) {
        setRefreshing(productId)
        const res = await refreshReadiness(productId)
        if (res.success) {
            setRecords(prev => prev.map(r => r.product === productId ? res.data : r))
        }
        setRefreshing(null)
    }

    const filtered = records.filter(r => {
        if (filter === 'ready' && r.status !== 'READY') return false
        if (filter === 'partial' && r.status !== 'PARTIAL') return false
        if (filter === 'not_ready' && r.status !== 'NOT_READY') return false
        if (search) {
            const s = search.toLowerCase()
            return String(r.product).includes(s)
        }
        return true
    })

    if (loading) {
        return (
            <div className="min-h-screen layout-container-padding flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
            </div>
        )
    }

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-info))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Product <span style={{ color: 'var(--app-primary)' }}>Readiness</span>
                        </h1>
                    </div>
                </div>
                <p className="text-sm text-app-muted-foreground">Operational readiness assessment across 6 dimensions</p>
            </div>

            {/* Summary KPIs */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Total</p>
                        <p className="text-2xl font-black text-app-foreground">{summary.total}</p>
                    </div>
                    {DIMENSIONS.map(d => (
                        <div key={d.key} className="p-3 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-1.5 mb-1">
                                <d.icon size={11} style={{ color: 'var(--app-primary)' }} />
                                <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">{d.label}</p>
                            </div>
                            <p className="text-xl font-black" style={{ color: 'var(--app-primary)' }}>{summary[d.key]}</p>
                            <p className="text-[9px] text-app-muted-foreground">{summary.total > 0 ? Math.round(summary[d.key] / summary.total * 100) : 0}%</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Fully Ready highlight */}
            {summary && (
                <div className="mb-6 p-4 rounded-2xl flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-success, #10b981) 10%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))', border: '1px solid color-mix(in srgb, var(--app-success, #10b981) 20%, transparent)' }}>
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={24} style={{ color: 'var(--app-success, #10b981)' }} />
                        <div>
                            <p className="text-sm font-black text-app-foreground">Fully Operational</p>
                            <p className="text-xs text-app-muted-foreground">Products meeting all 6 readiness dimensions</p>
                        </div>
                    </div>
                    <p className="text-3xl font-black" style={{ color: 'var(--app-success, #10b981)' }}>
                        {summary.fully_ready}<span className="text-sm text-app-muted-foreground ml-1">/ {summary.total}</span>
                    </p>
                </div>
            )}

            {/* Filters + Search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product ID..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <div className="flex gap-1.5">
                    {[
                        { value: 'all', label: 'All' },
                        { value: 'ready', label: '✅ Ready' },
                        { value: 'partial', label: '⚠️ Partial' },
                        { value: 'not_ready', label: '❌ Not Ready' },
                    ].map(f => (
                        <button key={f.value} onClick={() => setFilter(f.value as any)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                                background: filter === f.value ? 'var(--app-primary)' : 'var(--app-surface)',
                                color: filter === f.value ? 'white' : 'var(--app-muted-foreground)',
                                border: '1px solid var(--app-border)',
                            }}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Records Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(r => (
                    <div key={r.id} className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-4 py-3 flex items-center justify-between"
                            style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div>
                                <p className="text-sm font-bold text-app-foreground">Product #{r.product}</p>
                                <StatusBadge status={r.status} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black" style={{ color: 'var(--app-primary)' }}>{r.score}/6</span>
                                <button onClick={() => handleRefresh(r.product)}
                                    disabled={refreshing === r.product}
                                    className="p-1.5 rounded-lg hover:bg-app-surface-hover transition-all"
                                    title="Refresh readiness">
                                    <RefreshCw size={14} className={`text-app-muted-foreground ${refreshing === r.product ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        <div className="p-3 grid grid-cols-3 gap-2">
                            {DIMENSIONS.map(d => {
                                const ready = r[`is_${d.key}`]
                                return (
                                    <div key={d.key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
                                        style={{ background: ready ? 'color-mix(in srgb, var(--app-success, #10b981) 8%, transparent)' : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)' }}>
                                        <d.icon size={11} style={{ color: ready ? 'var(--app-success, #10b981)' : 'var(--app-error, #ef4444)' }} />
                                        <span className="text-[10px] font-bold" style={{ color: ready ? 'var(--app-success, #10b981)' : 'var(--app-error, #ef4444)' }}>{d.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                        {r.missing && r.missing.length > 0 && (
                            <div className="px-4 pb-3">
                                <p className="text-[10px] text-app-muted-foreground">Missing: {r.missing.join(', ')}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16">
                    <ShieldCheck size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                    <p className="text-sm font-bold text-app-muted-foreground">No readiness records found</p>
                    <p className="text-xs text-app-muted-foreground">Run the PLM rollout command to generate readiness assessments</p>
                </div>
            )}
        </div>
    )
}
