'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
    Inbox, Search, ShoppingCart, ArrowRightLeft,
    Clock, CheckCircle2, XCircle, PlayCircle,
    Maximize2, Minimize2, Loader2, RefreshCw,
} from 'lucide-react'
import {
    listProcurementRequests,
    type ProcurementRequestRecord,
    type ProcurementRequestStatus,
    type ProcurementRequestType,
} from '@/app/actions/inventory/procurement-requests'
import { TYPE_META } from './_lib/meta'
import { RequestRow } from './_components/RequestRow'

type StatusFilter = 'ALL' | ProcurementRequestStatus
type TypeFilter = 'ALL' | ProcurementRequestType

export default function ProcurementRequestsPage() {
    const [requests, setRequests] = useState<ProcurementRequestRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
    const [focusMode, setFocusMode] = useState(false)
    const [pending, startTransition] = useTransition()
    const searchRef = useRef<HTMLInputElement>(null)

    const refresh = () => {
        setLoading(true)
        listProcurementRequests().then(data => { setRequests(data); setLoading(false) })
    }
    useEffect(() => { refresh() }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(v => !v) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const counts = useMemo(() => {
        const c: Record<ProcurementRequestStatus, number> & { ALL: number } = {
            ALL: requests.length, PENDING: 0, APPROVED: 0, EXECUTED: 0, REJECTED: 0, CANCELLED: 0,
        }
        for (const r of requests) c[r.status]++
        return c
    }, [requests])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return requests.filter(r => {
            if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
            if (typeFilter !== 'ALL' && r.request_type !== typeFilter) return false
            if (!q) return true
            return (
                (r.product_name || '').toLowerCase().includes(q) ||
                (r.product_sku || '').toLowerCase().includes(q) ||
                (r.supplier_name || '').toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q)
            )
        })
    }, [requests, search, statusFilter, typeFilter])

    const runAction = (id: number, action: (id: number) => Promise<{ success: boolean; message?: string }>, verb: string) => {
        startTransition(async () => {
            const r = await action(id)
            if (r.success) { toast.success(`${verb} successful`); refresh() }
            else toast.error(r.message || `${verb} failed`)
        })
    }

    const kpis: { key: StatusFilter; label: string; value: number; color: string; icon: typeof Inbox }[] = [
        { key: 'ALL',      label: 'All Requests', value: counts.ALL,      color: 'var(--app-primary)',          icon: Inbox },
        { key: 'PENDING',  label: 'Pending',      value: counts.PENDING,  color: 'var(--app-warning, #f59e0b)', icon: Clock },
        { key: 'APPROVED', label: 'Approved',     value: counts.APPROVED, color: 'var(--app-info, #3b82f6)',    icon: CheckCircle2 },
        { key: 'EXECUTED', label: 'Executed',     value: counts.EXECUTED, color: 'var(--app-success, #22c55e)', icon: PlayCircle },
        { key: 'REJECTED', label: 'Rejected',     value: counts.REJECTED, color: 'var(--app-error, #ef4444)',   icon: XCircle },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Inbox size={20} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Procurement Requests</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {filtered.length} of {counts.ALL} · purchase &amp; transfer queue
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={refresh} disabled={loading}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden md:inline">Refresh</span>
                    </button>
                    <button onClick={() => setFocusMode(v => !v)}
                        className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                        title={focusMode ? 'Exit focus (Ctrl+Q)' : 'Focus mode (Ctrl+Q)'}>
                        {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>

            {/* ── KPI strip (filter mode) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }} className="mb-3 flex-shrink-0">
                {kpis.map(k => {
                    const Icon = k.icon
                    const active = statusFilter === k.key
                    return (
                        <button key={k.key} onClick={() => setStatusFilter(active ? 'ALL' : k.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left ${active ? 'ring-2 shadow-md scale-[1.02]' : ''}`}
                            style={{
                                background: active
                                    ? `color-mix(in srgb, ${k.color} 15%, transparent)`
                                    : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: `1px solid color-mix(in srgb, ${k.color} ${active ? '50' : '20'}%, transparent)`,
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                                <Icon size={14} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by product, SKU, supplier, reason... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                </div>
                <div className="flex gap-1 p-1 rounded-xl border border-app-border/50" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                    {(['ALL', 'PURCHASE', 'TRANSFER'] as TypeFilter[]).map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                            style={{
                                background: typeFilter === t ? 'var(--app-primary)' : 'transparent',
                                color: typeFilter === t ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            {t === 'ALL' ? 'All' : TYPE_META[t].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── List body ── */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 grid items-center gap-2 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                    style={{ gridTemplateColumns: '120px 1fr 90px 110px 110px 130px 200px' }}>
                    <div>Type</div>
                    <div>Product</div>
                    <div className="text-right">Quantity</div>
                    <div>Priority</div>
                    <div>Status</div>
                    <div>Requested</div>
                    <div className="text-right">Actions</div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Inbox size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No procurement requests</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                                    ? 'No matches for the current filters'
                                    : 'Open the products list and click "Request Purchase" or "Request Transfer" to create one.'}
                            </p>
                        </div>
                    ) : filtered.map(r => <RequestRow key={r.id} r={r} pending={pending} runAction={runAction} />)}
                </div>
            </div>
        </div>
    )
}
