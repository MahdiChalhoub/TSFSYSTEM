// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { ArrowUpDown, Search, CheckCircle, Clock, XCircle, User, Calendar, DollarSign } from 'lucide-react'

export default function PriceChangeRequestsPage() {
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/price-change-requests/')
            setRequests(Array.isArray(res) ? res : res?.results || [])
        } catch { setRequests([]) }
        setLoading(false)
    }

    const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

    const statusBadge = (s: string) => {
        const map: Record<string, { bg: string; color: string; icon: any }> = {
            PENDING: { bg: 'var(--app-warning)', color: 'var(--app-warning)', icon: Clock },
            APPROVED: { bg: 'var(--app-success)', color: 'var(--app-success)', icon: CheckCircle },
            REJECTED: { bg: 'var(--app-danger)', color: 'var(--app-danger)', icon: XCircle },
        }
        const cfg = map[s] || map.PENDING
        const Icon = cfg.icon
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${cfg.bg} 15%, transparent)`, color: cfg.color }}><Icon size={10} />{s}</span>
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
                    style={{ background: 'linear-gradient(135deg, var(--app-danger), var(--app-warning))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-danger) 30%, transparent)' }}>
                    <ArrowUpDown className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Price Governance</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Price Change <span style={{ color: 'var(--app-primary)' }}>Requests</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
                {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ background: filter === f ? 'var(--app-primary)' : 'var(--app-surface)', color: filter === f ? '#fff' : 'var(--app-foreground)', border: `1px solid ${filter === f ? 'var(--app-primary)' : 'var(--app-border)'}` }}>
                        {f === 'all' ? 'All' : f}
                    </button>
                ))}
                <span className="ml-auto text-xs font-bold text-app-muted-foreground">{filtered.length} requests</span>
            </div>

            <div className="space-y-2">
                {filtered.map((req, i) => (
                    <div key={req.id || i} className="rounded-xl px-4 py-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-app-foreground">{req.product_name || `Product #${req.product}`}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="inline-flex items-center gap-1 text-xs text-app-muted-foreground">
                                        <DollarSign size={11} />
                                        <span className="text-red-400 line-through">{req.old_price ?? '—'}</span>
                                        <span className="mx-1">→</span>
                                        <span className="text-app-success font-bold">{req.new_price ?? '—'}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-app-muted-foreground"><User size={9} />{req.requested_by_name || req.requested_by || 'System'}</span>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-app-muted-foreground"><Calendar size={9} />{req.created_at ? new Date(req.created_at).toLocaleDateString() : '—'}</span>
                                </div>
                                {req.reason && <p className="text-[10px] text-app-muted-foreground mt-1 italic">{req.reason}</p>}
                            </div>
                            {statusBadge(req.status || 'PENDING')}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-16">
                        <ArrowUpDown size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                        <p className="text-sm font-bold text-app-muted-foreground">No price change requests</p>
                        <p className="text-xs text-app-muted-foreground">Price changes requiring approval will appear here</p>
                    </div>
                )}
            </div>
        </div>
    )
}
