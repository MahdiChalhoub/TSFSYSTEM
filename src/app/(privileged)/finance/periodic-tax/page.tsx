'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Search, Clock, X, Loader2,
    Maximize2, Minimize2, Eye, Pencil, Layers, Activity,
    Percent, Calendar
} from 'lucide-react'
import { useCurrency } from '@/lib/utils/currency'

type PeriodicTax = Record<string, any>

function TaxRow({ item, onView, fmt }: { item: PeriodicTax; onView: (id: number) => void; fmt: (n: number) => string }) {
    const n = (v?: any) => parseFloat(String(v ?? '0')) || 0
    return (
        <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            onClick={() => onView(item.id)}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                <Clock size={13} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="truncate text-[13px] font-bold text-app-foreground">{item.tax_type || 'Periodic'}</span>
                <span className="text-[10px] font-mono font-bold text-app-muted-foreground tabular-nums flex-shrink-0">
                    {item.period_start?.slice(0, 10)} → {item.period_end?.slice(0, 10)}
                </span>
            </div>
            <div className="hidden sm:block w-20 text-right flex-shrink-0 font-mono text-[12px] font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                {fmt(n(item.base_amount))}
            </div>
            <div className="hidden sm:block w-14 text-right flex-shrink-0 font-mono text-[11px] font-bold tabular-nums text-app-muted-foreground">
                {item.rate != null ? `${(n(item.rate) * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="hidden md:block w-20 text-right flex-shrink-0 font-mono text-[12px] font-bold tabular-nums" style={{ color: '#8b5cf6' }}>
                {fmt(n(item.accrual_amount))}
            </div>
            <div className="hidden md:flex w-16 flex-shrink-0">
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                    style={{
                        background: item.status === 'POSTED' ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)' : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                        color: item.status === 'POSTED' ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                    }}>{item.status}</span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onView(item.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"><Eye size={12} /></button>
            </div>
        </div>
    )
}

export default function PeriodicTaxListPage() {
    const router = useRouter()
    const { fmt } = useCurrency()
    const [items, setItems] = useState<PeriodicTax[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadData() }, [])
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    async function loadData() {
        try { setLoading(true); const data = await erpFetch('finance/periodic-tax-accruals/'); setItems(Array.isArray(data) ? data : (data?.results || [])) }
        catch (e) { console.error('Failed to load:', e) } finally { setLoading(false) }
    }

    const { filtered, stats } = useMemo(() => {
        let f = items
        if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = f.filter(i => i.tax_type?.toLowerCase().includes(q) || i.status?.toLowerCase().includes(q)) }
        return { filtered: f, stats: { total: items.length, filtered: f.length, posted: items.filter(i => i.status === 'POSTED').length, pending: items.filter(i => i.status !== 'POSTED').length } }
    }, [items, searchQuery])

    const kpis = [
        { label: 'Accruals', value: stats.total, icon: <Clock size={11} />, color: 'var(--app-primary)' },
        { label: 'Posted', value: stats.posted, icon: <Activity size={11} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Pending', value: stats.pending, icon: <Calendar size={11} />, color: 'var(--app-warning, #f59e0b)' },
        { label: 'Showing', value: stats.filtered, icon: <Layers size={11} />, color: '#8b5cf6' },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0"><div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"><Clock size={14} className="text-white" /></div><span className="text-[12px] font-black text-app-foreground hidden sm:inline">Periodic Tax</span><span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span></div>
                        <div className="flex-1 relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" /></div>
                        <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"><Minimize2 size={13} /></button>
                    </div>
                ) : (<>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><Clock size={20} className="text-white" /></div>
                            <div><h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Periodic Tax Accruals</h1><p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">{stats.total} Accruals · MICRO · On Turnover</p></div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><Maximize2 size={13} /></button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (<div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div><div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div></div></div>))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search accruals by type, status... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" /></div>
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}><X size={13} /></button>}
                    </div>
                </>)}
            </div>
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-7 flex-shrink-0" /><div className="flex-1 min-w-0">Period</div><div className="hidden sm:block w-20 text-right flex-shrink-0">Base</div><div className="hidden sm:block w-14 text-right flex-shrink-0">Rate</div><div className="hidden md:block w-20 text-right flex-shrink-0">Amount</div><div className="hidden md:block w-16 flex-shrink-0">Status</div><div className="w-10 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                        : filtered.length > 0 ? filtered.map(item => <TaxRow key={item.id} item={item} onView={id => router.push(`/finance/periodic-tax/${id}`)} fmt={fmt} />)
                            : <div className="flex flex-col items-center justify-center py-20 px-4 text-center"><Clock size={36} className="text-app-muted-foreground mb-3 opacity-40" /><p className="text-sm font-bold text-app-muted-foreground">No accruals found</p><p className="text-[11px] text-app-muted-foreground mt-1">{searchQuery ? 'Try a different search term.' : 'Run an accrual from the VAT Settlement page.'}</p></div>}
                </div>
            </div>
        </div>
    )
}
