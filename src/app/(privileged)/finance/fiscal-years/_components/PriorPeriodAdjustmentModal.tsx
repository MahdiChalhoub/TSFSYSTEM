'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    X, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2,
    ArrowRightLeft, Sparkles, FlaskConical, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import {
    previewPriorPeriodAdjustment,
    postPriorPeriodAdjustment,
    type PPAResult,
    type PPALineInput,
} from '@/app/actions/finance/fiscal-year'
import { getChartOfAccounts } from '@/app/actions/finance/accounts'

type EditableLine = {
    id: string  // client-side uuid for react keys
    account_id: number | null
    debit: string
    credit: string
    description: string
}

interface PriorPeriodAdjustmentModalProps {
    fiscalYearId: number
    fiscalYearName: string
    onClose: () => void
    onDone?: () => void
}

function makeLine(): EditableLine {
    return {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        account_id: null,
        debit: '',
        credit: '',
        description: '',
    }
}

export function PriorPeriodAdjustmentModal({
    fiscalYearId, fiscalYearName, onClose, onDone,
}: PriorPeriodAdjustmentModalProps) {
    const dismiss = useModalDismiss(true, onClose)

    const [accounts, setAccounts] = useState<Array<{ id: number; code: string; name: string; type: string }>>([])
    const [lines, setLines] = useState<EditableLine[]>([makeLine(), makeLine()])
    const [reason, setReason] = useState('')
    const [preview, setPreview] = useState<PPAResult | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [posting, setPosting] = useState(false)
    const [posted, setPosted] = useState<PPAResult | null>(null)

    // Load accounts for the dropdown
    useEffect(() => {
        void (async () => {
            const accs = await getChartOfAccounts()
            setAccounts((accs || []).map((a: Record<string, any>) => ({
                id: a.id, code: a.code, name: a.name, type: a.type,
            })))
        })()
    }, [])

    // Totals (client-side)
    const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    const balanced = Math.abs(totalDr - totalCr) < 0.005
    const canPreview = reason.trim().length > 0
        && lines.some(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))

    const updateLine = (id: string, patch: Partial<EditableLine>) =>
        setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
    const removeLine = (id: string) =>
        setLines(prev => prev.filter(l => l.id !== id))
    const addLine = () => setLines(prev => [...prev, makeLine()])

    const buildPayload = (): PPALineInput[] =>
        lines
            .filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
            .map(l => ({
                account_id: l.account_id!,
                debit: l.debit || '0',
                credit: l.credit || '0',
                description: l.description || undefined,
            }))

    const runPreview = useCallback(async () => {
        setLoadingPreview(true); setPreviewError(null); setPreview(null)
        try {
            const r = await previewPriorPeriodAdjustment(fiscalYearId, buildPayload(), reason)
            if (r.success) setPreview(r.preview)
            else setPreviewError(r.error)
        } finally {
            setLoadingPreview(false)
        }
    }, [fiscalYearId, lines, reason])  // eslint-disable-line react-hooks/exhaustive-deps

    const post = async () => {
        setPosting(true)
        try {
            const r = await postPriorPeriodAdjustment(fiscalYearId, buildPayload(), reason)
            if (r.success) {
                setPosted(r.result)
                toast.success(`PPA posted: JE ${r.result.journal_entry_reference ?? r.result.journal_entry_id}`)
                onDone?.()
            } else {
                toast.error(r.error)
            }
        } finally {
            setPosting(false)
        }
    }

    return (
        <div {...dismiss.backdropProps} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div {...dismiss.contentProps}
                className="rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="px-5 py-4 flex justify-between items-start"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, transparent)' }}>
                    <div>
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={16} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <h3 className="text-tp-lg font-bold" style={{ color: 'var(--app-foreground)' }}>
                                Prior Period Adjustment
                            </h3>
                        </div>
                        <p className="text-tp-xs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            Target: <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{fiscalYearName}</span>
                            {' '}(closed — will not reopen)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-app-surface/70">
                        <X size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                    </button>
                </div>

                {/* Body */}
                {posted ? (
                    <div className="p-6 flex flex-col items-center text-center gap-3">
                        <CheckCircle2 size={36} style={{ color: 'var(--app-success, #22c55e)' }} />
                        <div className="text-tp-lg font-bold" style={{ color: 'var(--app-foreground)' }}>
                            Adjustment posted
                        </div>
                        <div className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                            JE <span className="font-mono font-bold" style={{ color: 'var(--app-foreground)' }}>{posted.journal_entry_reference}</span>
                            {' '}· {posted.lines.length} lines · total Dr/Cr {Number(posted.total_debit).toFixed(2)}
                        </div>
                        {posted.redirected_count > 0 && (
                            <div className="text-tp-xs flex items-center gap-1"
                                style={{ color: 'var(--app-info, #3b82f6)' }}>
                                <Sparkles size={11} /> {posted.redirected_count} P&L line(s) auto-routed to Retained Earnings
                            </div>
                        )}
                        <button onClick={onClose}
                            className="mt-2 px-4 py-1.5 text-tp-sm font-bold rounded-xl"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Close
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                        {/* Reason */}
                        <div>
                            <label className="text-tp-xs font-bold uppercase tracking-wide block mb-1"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                Reason <span style={{ color: 'var(--app-error, #ef4444)' }}>*</span>
                            </label>
                            <textarea value={reason} onChange={e => setReason(e.target.value)}
                                rows={2} placeholder="e.g. Audit finding: Dec 2025 accrual understated by 12,500 — correcting..."
                                className="w-full px-3 py-2 text-tp-sm rounded-lg outline-none resize-none"
                                style={{ background: 'var(--app-surface-2, var(--app-surface))', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <div className="text-tp-xxs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                Required. Stamped onto the JE description AND the forensic audit log — it's the permanent breadcrumb for the correction.
                            </div>
                        </div>

                        {/* Lines */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-tp-xs font-bold uppercase tracking-wide"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Adjustment lines
                                </label>
                                <button onClick={addLine}
                                    className="text-tp-xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-md"
                                    style={{ color: 'var(--app-primary)' }}>
                                    <Plus size={11} /> Add line
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                {lines.map((l) => (
                                    <div key={l.id} className="flex items-center gap-1.5 p-1.5 rounded-lg"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                                        <select value={l.account_id ?? ''}
                                            onChange={e => updateLine(l.id, {
                                                account_id: e.target.value ? Number(e.target.value) : null,
                                            })}
                                            className="flex-1 text-tp-xs px-2 py-1 rounded-md outline-none font-mono"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            <option value="">— pick account —</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                                            ))}
                                        </select>
                                        <input type="number" step="0.01" placeholder="Dr"
                                            value={l.debit} onChange={e => updateLine(l.id, { debit: e.target.value })}
                                            className="w-24 text-tp-xs px-2 py-1 rounded-md outline-none text-right font-mono tabular-nums"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <input type="number" step="0.01" placeholder="Cr"
                                            value={l.credit} onChange={e => updateLine(l.id, { credit: e.target.value })}
                                            className="w-24 text-tp-xs px-2 py-1 rounded-md outline-none text-right font-mono tabular-nums"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <button onClick={() => removeLine(l.id)}
                                            disabled={lines.length <= 1}
                                            className="p-1 disabled:opacity-30">
                                            <Trash2 size={12} style={{ color: 'var(--app-error, #ef4444)' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="flex items-center justify-between mt-2 px-2 text-tp-xs font-mono tabular-nums">
                                <span style={{ color: 'var(--app-muted-foreground)' }}>Totals</span>
                                <span>
                                    <span style={{ color: 'var(--app-foreground)' }}>Dr {totalDr.toFixed(2)}</span>
                                    <span style={{ color: 'var(--app-muted-foreground)' }}>  ·  </span>
                                    <span style={{ color: 'var(--app-foreground)' }}>Cr {totalCr.toFixed(2)}</span>
                                    <span style={{
                                        color: balanced ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)',
                                        marginLeft: '8px',
                                    }}>
                                        {balanced ? '✓ balanced' : `Δ ${(totalDr - totalCr).toFixed(2)}`}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Preview result */}
                        {(preview || previewError) && (
                            <div className="rounded-lg p-3"
                                style={{
                                    background: preview
                                        ? 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)'
                                        : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                                    border: `1px solid ${preview ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)'}`,
                                }}>
                                {preview ? (
                                    <>
                                        <div className="text-tp-xs font-bold uppercase tracking-wide flex items-center gap-1 mb-1"
                                            style={{ color: 'var(--app-success, #22c55e)' }}>
                                            <FlaskConical size={12} /> DRY-RUN PASSED · not yet posted
                                        </div>
                                        <div className="text-tp-xs font-mono" style={{ color: 'var(--app-foreground)' }}>
                                            Will write {preview.lines.length} line(s) · total Dr {preview.total_debit} / Cr {preview.total_credit}
                                        </div>
                                        {preview.redirected_count > 0 && (
                                            <div className="text-tp-xxs mt-1 flex items-center gap-1"
                                                style={{ color: 'var(--app-info, #3b82f6)' }}>
                                                <Sparkles size={10} /> {preview.redirected_count} P&L line(s) will be auto-routed to Retained Earnings to keep {preview.target_fiscal_year} clean
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={14} style={{ color: 'var(--app-error, #ef4444)' }} className="flex-shrink-0 mt-0.5" />
                                        <div className="text-tp-xs" style={{ color: 'var(--app-foreground)' }}>{previewError}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer actions */}
                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose}
                                className="flex-1 py-2 text-tp-sm font-bold rounded-xl border"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                Cancel
                            </button>
                            <button onClick={() => void runPreview()} disabled={!canPreview || loadingPreview}
                                className="flex-1 py-2 text-tp-sm font-bold rounded-xl border transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                                {loadingPreview ? <><Loader2 size={12} className="animate-spin" /> Simulating...</> : <><FlaskConical size={12} /> Dry-Run</>}
                            </button>
                            <button onClick={() => void post()}
                                disabled={posting || !preview || !balanced || !canPreview}
                                className="flex-1 py-2 text-tp-sm font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                style={{ background: 'var(--app-warning, #f59e0b)', color: 'white' }}>
                                {posting ? <><Loader2 size={12} className="animate-spin" /> Posting...</> : <><ShieldCheck size={12} /> Post PPA</>}
                            </button>
                        </div>
                        {!preview && (
                            <div className="text-tp-xxs text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                Run dry-run first to unlock posting
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
