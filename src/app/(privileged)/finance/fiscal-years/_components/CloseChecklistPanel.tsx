'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Square, Loader2, RefreshCw, Sparkles, Plus, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCloseChecklist,
    toggleCloseChecklistItem,
    addCloseChecklistItem,
    type CloseChecklistItem,
    type CloseChecklistReport,
} from '@/app/actions/finance/fiscal-year'

const CATEGORIES = [
    { key: 'RECONCILIATION', label: 'Reconciliation', fg: 'var(--app-info, #3b82f6)' },
    { key: 'ACCRUALS', label: 'Accruals', fg: 'var(--app-warning, #f59e0b)' },
    { key: 'INVENTORY', label: 'Inventory', fg: 'var(--app-primary)' },
    { key: 'FX', label: 'FX', fg: '#8b5cf6' },
    { key: 'TAX', label: 'Tax', fg: 'var(--app-error, #ef4444)' },
    { key: 'DEPRECIATION', label: 'Depreciation', fg: '#06b6d4' },
    { key: 'REVIEW', label: 'Review', fg: 'var(--app-success, #22c55e)' },
    { key: 'OTHER', label: 'Other', fg: 'var(--app-muted-foreground)' },
] as const

const getCatColor = (cat: string) => CATEGORIES.find(c => c.key === cat)?.fg || 'var(--app-muted-foreground)'

export function CloseChecklistPanel({ fiscalYearId }: { fiscalYearId: number }) {
    const [report, setReport] = useState<CloseChecklistReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<number | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [newName, setNewName] = useState('')
    const [newCat, setNewCat] = useState('OTHER')
    const [newRequired, setNewRequired] = useState(false)
    const [adding, setAdding] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setReport(await getCloseChecklist(fiscalYearId))
        } finally {
            setLoading(false)
        }
    }, [fiscalYearId])

    useEffect(() => { void load() }, [load])

    const toggle = async (item: CloseChecklistItem) => {
        setToggling(item.state_id)
        try {
            const res = await toggleCloseChecklistItem(fiscalYearId, item.state_id, !item.is_complete)
            if (!res.success) { toast.error(res.error || 'Toggle failed'); return }
            await load()
            if (res.ready_to_close) toast.success('All required items complete — ready to close')
        } finally { setToggling(null) }
    }

    const handleAdd = async () => {
        if (!newName.trim()) return
        setAdding(true)
        try {
            const res = await addCloseChecklistItem(fiscalYearId, newName.trim(), newCat, newRequired)
            if (!res.success) { toast.error(res.error || 'Failed to add item'); return }
            toast.success('Item added')
            setNewName(''); setNewCat('OTHER'); setNewRequired(false); setShowAdd(false)
            await load()
        } finally { setAdding(false) }
    }

    if (loading && !report) {
        return (
            <div className="p-8 text-center">
                <Loader2 size={18} className="animate-spin mx-auto" style={{ color: 'var(--app-muted-foreground)' }} />
            </div>
        )
    }

    if (!report) {
        return (
            <div className="p-8 text-center text-[12px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                Unable to load checklist.
            </div>
        )
    }

    const pct = report.total_items > 0 ? Math.round((report.completed_items / report.total_items) * 100) : 0

    return (
        <div className="flex flex-col min-h-0">
            {/* ── Header ── */}
            <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: 'var(--app-muted-foreground)' }}>{report.template_name}</span>
                        <span className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{report.completed_items}/{report.total_items}</span>
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full border border-current"
                            style={{
                                background: report.ready_to_close
                                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                color: report.ready_to_close ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                            }}>
                            {report.ready_to_close ? 'READY' : report.status}
                        </span>
                        {report.required_missing > 0 && (
                            <span className="text-[10px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                · {report.required_missing} required remaining
                            </span>
                        )}
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="h-full transition-all duration-500 ease-out rounded-full" style={{
                            width: `${pct}%`,
                            background: report.ready_to_close ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                        }} />
                    </div>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} title="Add custom item"
                    className="p-1.5 rounded-lg border transition-all flex-shrink-0"
                    style={{ color: showAdd ? 'var(--app-primary)' : 'var(--app-muted-foreground)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    {showAdd ? <X size={13} /> : <Plus size={13} />}
                </button>
                <button onClick={() => void load()} disabled={loading}
                    className="p-1.5 rounded-lg border transition-all disabled:opacity-30 flex-shrink-0" title="Refresh"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} style={{ color: loading ? 'var(--app-primary)' : 'var(--app-muted-foreground)' }} />
                </button>
            </div>

            {/* ── Add Item Form ── */}
            {showAdd && (
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-bg))' }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Task name..."
                        className="flex-1 min-w-0 text-[12px] font-medium px-2.5 py-1.5 rounded-lg border bg-transparent outline-none focus:border-[var(--app-primary)]"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
                    <div className="relative">
                        <select value={newCat} onChange={e => setNewCat(e.target.value)}
                            className="text-[10px] font-bold uppercase pl-2 pr-5 py-1.5 rounded-lg border bg-transparent appearance-none cursor-pointer outline-none"
                            style={{ borderColor: 'var(--app-border)', color: getCatColor(newCat) }}>
                            {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-muted-foreground)' }} />
                    </div>
                    <label className="flex items-center gap-1 text-[10px] font-bold cursor-pointer whitespace-nowrap" style={{ color: 'var(--app-muted-foreground)' }}>
                        <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} className="rounded" />
                        Required
                    </label>
                    <button onClick={handleAdd} disabled={adding || !newName.trim()}
                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        {adding ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
                    </button>
                </div>
            )}

            {/* ── Items List ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {report.items.map((item) => {
                    const catColor = getCatColor(item.category)
                    return (
                        <div key={item.state_id}
                            className="flex items-center gap-3 px-5 py-2.5 transition-all group"
                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                            
                            <button onClick={() => toggle(item)} disabled={toggling === item.state_id}
                                className="flex-shrink-0 transition-transform active:scale-90 disabled:opacity-50">
                                {toggling === item.state_id ? (
                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                ) : item.is_complete ? (
                                    <CheckSquare size={16} style={{ color: 'var(--app-success, #22c55e)' }} />
                                ) : (
                                    <Square size={16} className="opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--app-muted-foreground)' }} />
                                )}
                            </button>

                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor, border: `1px solid color-mix(in srgb, ${catColor} 20%, transparent)` }}>
                                {item.category}
                            </span>

                            <div className="min-w-0 flex-1 flex items-center gap-2">
                                <span className="text-[12px] font-bold truncate"
                                    style={{
                                        color: item.is_complete ? 'var(--app-muted-foreground)' : 'var(--app-foreground)',
                                        textDecoration: item.is_complete ? 'line-through' : 'none',
                                        opacity: item.is_complete ? 0.5 : 1,
                                    }}>
                                    {item.name}
                                </span>
                                {item.is_required && !item.is_complete && (
                                    <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                                        REQUIRED
                                    </span>
                                )}
                            </div>

                            {item.is_complete && item.completed_by && (
                                <div className="text-[9px] font-bold flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {item.auto_checked && <Sparkles size={9} style={{ color: 'var(--app-primary)' }} />}
                                    <span>{item.auto_checked ? 'Auto' : item.completed_by}</span>
                                    {item.completed_at && (
                                        <span className="opacity-50 font-mono text-[8px]">
                                            {new Date(item.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
