'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
    ArrowRight, Loader2, Sparkles, RefreshCw, X, Check,
    ArrowUpDown, Zap, DollarSign, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getAllocationWorkbench, allocatePayment,
    type WorkbenchReport, type UnallocatedPayment, type UnpaidInvoice,
} from '@/app/actions/finance/allocation'

function fmtMoney(s: string): string {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type DraftAllocation = Record<number, string>  // invoice_id → amount string

export function AllocationWorkbenchClient({ initialReport }: { initialReport: WorkbenchReport | null }) {
    const [report, setReport] = useState<WorkbenchReport | null>(initialReport)
    const [direction, setDirection] = useState<'AR' | 'AP'>('AR')
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Selected payment + its draft allocation map
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
    const [drafts, setDrafts] = useState<DraftAllocation>({})

    const reload = useCallback(async (dir: 'AR' | 'AP' = direction) => {
        setLoading(true)
        try {
            setReport(await getAllocationWorkbench(dir))
            setSelectedPaymentId(null)
            setDrafts({})
        } finally { setLoading(false) }
    }, [direction])

    useEffect(() => { void reload(direction) }, [direction])  // eslint-disable-line react-hooks/exhaustive-deps

    const selectedPayment = useMemo(
        () => report?.unallocated_payments.find(p => p.id === selectedPaymentId) ?? null,
        [report, selectedPaymentId],
    )

    // Filter invoices to same contact as selected payment (default), fall back to all
    const relevantInvoices = useMemo(() => {
        if (!report) return []
        if (!selectedPayment) return report.unpaid_invoices
        const same = report.unpaid_invoices.filter(i => i.contact_id === selectedPayment.contact_id)
        return same.length ? same : report.unpaid_invoices
    }, [report, selectedPayment])

    const suggestion = useMemo(
        () => report?.auto_suggestions.find(s => s.payment_id === selectedPaymentId),
        [report, selectedPaymentId],
    )

    const draftTotal = useMemo(
        () => Object.values(drafts).reduce((s, v) => s + (Number(v) || 0), 0),
        [drafts],
    )
    const unallocated = Number(selectedPayment?.unallocated || 0)
    const remaining = unallocated - draftTotal

    const applySuggestion = () => {
        if (!suggestion || !selectedPayment) return
        if (suggestion.suggestion.id) {
            // single exact match
            const inv = relevantInvoices.find(i => i.id === suggestion.suggestion.id)
            if (inv) setDrafts({ [inv.id]: inv.balance_due })
        } else if (suggestion.suggestion.picks) {
            const newDrafts: DraftAllocation = {}
            for (const id of suggestion.suggestion.picks) {
                const inv = relevantInvoices.find(i => i.id === id)
                if (inv) newDrafts[id] = inv.balance_due
            }
            setDrafts(newDrafts)
        }
    }

    const autoFillFIFO = () => {
        if (!selectedPayment) return
        const sorted = [...relevantInvoices].sort((a, b) =>
            (a.due_date || '').localeCompare(b.due_date || '')
        )
        let remain = Number(selectedPayment.unallocated)
        const newDrafts: DraftAllocation = {}
        for (const inv of sorted) {
            if (remain <= 0.005) break
            const bal = Number(inv.balance_due)
            const apply = Math.min(bal, remain)
            newDrafts[inv.id] = apply.toFixed(2)
            remain -= apply
        }
        setDrafts(newDrafts)
    }

    const commit = () => {
        if (!selectedPayment) return
        const allocations = Object.entries(drafts)
            .filter(([, amt]) => Number(amt) > 0)
            .map(([invId, amt]) => ({ invoice_id: Number(invId), amount: String(amt) }))
        if (!allocations.length) { toast.error('Nothing to allocate'); return }
        startTransition(async () => {
            const r = await allocatePayment(selectedPayment.id, allocations)
            if (r.success) {
                toast.success(`Allocated ${r.total} across ${r.allocations.length} invoice(s)`)
                await reload()
            } else {
                toast.error(r.error)
            }
        })
    }

    if (!report) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col p-3 md:p-4 gap-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--app-foreground)' }}>
                        Payment Allocation Workbench
                    </h1>
                    <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                        Match unallocated payments to unpaid invoices
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--app-surface)' }}>
                        {(['AR', 'AP'] as const).map(d => (
                            <button key={d} onClick={() => setDirection(d)}
                                className="text-tp-xs font-bold px-3 py-1 rounded-md transition-all"
                                style={{
                                    background: direction === d ? 'var(--app-primary)' : 'transparent',
                                    color: direction === d ? 'white' : 'var(--app-muted-foreground)',
                                }}>
                                {d === 'AR' ? 'Receipts (AR)' : 'Disbursements (AP)'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => void reload()} disabled={loading}
                        className="flex items-center gap-1.5 text-tp-xs font-bold px-2 py-1 rounded-lg border"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
                    </button>
                </div>
            </div>

            {/* Totals strip */}
            <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-tp-xxs font-bold uppercase tracking-wide flex items-center gap-1"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <DollarSign size={11} /> Unallocated payments
                    </div>
                    <div className="text-tp-xl font-bold tabular-nums" style={{ color: 'var(--app-primary)' }}>
                        {fmtMoney(report.totals.unallocated_payments)}
                    </div>
                    <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {report.unallocated_payments.length} payments awaiting allocation
                    </div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-tp-xxs font-bold uppercase tracking-wide flex items-center gap-1"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <FileText size={11} /> Unpaid invoices
                    </div>
                    <div className="text-tp-xl font-bold tabular-nums" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                        {fmtMoney(report.totals.unpaid_invoices)}
                    </div>
                    <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {report.unpaid_invoices.length} invoices with balance due
                    </div>
                </div>
            </div>

            {/* Split pane: payments | invoices */}
            <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Payments (left) */}
                <div className="rounded-xl overflow-hidden flex flex-col"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="px-3 py-2 text-tp-xxs font-bold uppercase tracking-wide flex items-center justify-between"
                        style={{ color: 'var(--app-muted-foreground)', borderBottom: '1px solid var(--app-border)' }}>
                        <span>Unallocated payments ({report.unallocated_payments.length})</span>
                        {selectedPayment && <button onClick={() => { setSelectedPaymentId(null); setDrafts({}) }} className="text-tp-xxs">Clear</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {report.unallocated_payments.length === 0 ? (
                            <div className="p-6 text-center text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                No unallocated payments — everything is matched.
                            </div>
                        ) : report.unallocated_payments.map(p => {
                            const selected = selectedPaymentId === p.id
                            const hasSuggestion = report.auto_suggestions.some(s => s.payment_id === p.id)
                            return (
                                <button key={p.id}
                                    onClick={() => { setSelectedPaymentId(p.id); setDrafts({}) }}
                                    className="w-full text-left p-3 border-b transition-colors"
                                    style={{
                                        background: selected ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                        borderColor: selected ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                            {p.contact_name || <span style={{ color: 'var(--app-muted-foreground)' }}>(no contact)</span>}
                                        </span>
                                        <span className="text-tp-sm font-mono tabular-nums font-bold" style={{ color: 'var(--app-primary)' }}>
                                            {fmtMoney(p.unallocated)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-tp-xxs mt-0.5"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        <span>
                                            {p.payment_date} · {p.method}
                                            {p.reference && ` · ${p.reference}`}
                                        </span>
                                        <span>
                                            {hasSuggestion && (
                                                <span className="inline-flex items-center gap-1 font-bold"
                                                    style={{ color: 'var(--app-info, #3b82f6)' }}>
                                                    <Sparkles size={9} /> auto-match
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Invoices (right) */}
                <div className="rounded-xl overflow-hidden flex flex-col"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="px-3 py-2 flex items-center justify-between gap-2"
                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                        <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                            {selectedPayment
                                ? `Invoices for ${selectedPayment.contact_name} (${relevantInvoices.length})`
                                : `All unpaid invoices (${report.unpaid_invoices.length})`}
                        </div>
                        {selectedPayment && (
                            <div className="flex items-center gap-1">
                                {suggestion && (
                                    <button onClick={applySuggestion}
                                        className="text-tp-xxs font-bold flex items-center gap-1 px-2 py-1 rounded-md"
                                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                        <Sparkles size={10} /> Apply suggestion
                                    </button>
                                )}
                                <button onClick={autoFillFIFO}
                                    className="text-tp-xxs font-bold flex items-center gap-1 px-2 py-1 rounded-md"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                                    <Zap size={10} /> Auto-fill FIFO
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {relevantInvoices.length === 0 ? (
                            <div className="p-6 text-center text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                {selectedPayment ? 'No unpaid invoices for this contact.' : 'No unpaid invoices.'}
                            </div>
                        ) : relevantInvoices.map(inv => {
                            const draft = drafts[inv.id] || ''
                            const isAllocating = Number(draft) > 0
                            const disabled = !selectedPayment
                            return (
                                <div key={inv.id} className="p-3 border-b"
                                    style={{
                                        background: isAllocating ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' : 'transparent',
                                        borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                            {inv.invoice_number || `INV-${inv.id}`}
                                            {!selectedPayment && <span style={{ color: 'var(--app-muted-foreground)' }}> · {inv.contact_name}</span>}
                                        </span>
                                        <span className="text-tp-sm font-mono tabular-nums font-bold"
                                            style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                            {fmtMoney(inv.balance_due)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-tp-xxs"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        <span>due {inv.due_date || '—'}</span>
                                        {selectedPayment && (
                                            <div className="flex items-center gap-1">
                                                <input type="number" step="0.01" placeholder="0.00" disabled={disabled}
                                                    value={draft}
                                                    onChange={e => setDrafts(d => ({ ...d, [inv.id]: e.target.value }))}
                                                    className="w-24 text-tp-xs px-1.5 py-0.5 rounded-md outline-none text-right font-mono tabular-nums"
                                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                                <button onClick={() => setDrafts(d => ({ ...d, [inv.id]: inv.balance_due }))}
                                                    disabled={disabled}
                                                    className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-md"
                                                    style={{ background: 'var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                                    full
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Commit bar */}
            {selectedPayment && (
                <div className="p-3 rounded-xl flex items-center justify-between gap-3"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                        border: '1px solid var(--app-primary)',
                    }}>
                    <div className="flex items-center gap-4 text-tp-xs font-mono tabular-nums">
                        <span>payment: <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{fmtMoney(selectedPayment.unallocated)}</span></span>
                        <ArrowRight size={12} />
                        <span>allocating: <span className="font-bold" style={{ color: 'var(--app-primary)' }}>{fmtMoney(draftTotal.toFixed(2))}</span></span>
                        <span style={{ color: remaining < -0.005 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                            remaining: {fmtMoney(remaining.toFixed(2))}
                        </span>
                    </div>
                    <button onClick={commit} disabled={isPending || remaining < -0.005 || draftTotal === 0}
                        className="flex items-center gap-1.5 text-tp-sm font-bold px-4 py-1.5 rounded-xl disabled:opacity-40"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        {isPending ? <><Loader2 size={12} className="animate-spin" /> Allocating...</> : <><Check size={12} /> Commit allocation</>}
                    </button>
                </div>
            )}
        </div>
    )
}
