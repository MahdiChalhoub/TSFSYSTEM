'use client'

import { useState } from 'react'
import {
    ShieldCheck, X, AlertTriangle, Lock, Plus, TrendingUp, TrendingDown,
    ArrowRight, CheckCircle2, Loader2, FlaskConical,
} from 'lucide-react'
import { toast } from 'sonner'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import {
    previewCloseFiscalYear,
    type ClosePreview,
    type DryRunClosePreview,
} from '@/app/actions/finance/fiscal-year'

export type CloseStep = 'preview' | 'result' | null

interface YearEndCloseModalProps {
    closeStep: Exclude<CloseStep, null>
    closePreview: ClosePreview
    yearId: number
    closeResult: string | null
    closeConfirmText: string
    setCloseConfirmText: (v: string) => void
    isPending: boolean
    onClose: () => void
    onDone: () => void
    onExecute: (isPartial: boolean) => void
}

export function YearEndCloseModal({
    closeStep, closePreview, yearId, closeResult, closeConfirmText, setCloseConfirmText,
    isPending, onClose, onDone, onExecute,
}: YearEndCloseModalProps) {
    const dismiss = useModalDismiss(true, onClose)
    const [dryRunning, setDryRunning] = useState(false)
    const [dryResult, setDryResult] = useState<
        { ok: true; preview: DryRunClosePreview } | { ok: false; error: string } | null
    >(null)

    const today = new Date()
    const yearEnd = new Date(closePreview.year.end_date)
    const isPartial = today < yearEnd

    const runDryClose = async () => {
        setDryRunning(true)
        setDryResult(null)
        try {
            // Match the real-close payload: pass close_date when partial so
            // the dry-run exercises the *same* code path the user is about
            // to commit. Without this, a partial-close preview silently
            // simulates a full close and reports the wrong invariants.
            let closeDate: string | undefined
            if (isPartial) {
                const d = new Date(); d.setDate(d.getDate() - 1)
                closeDate = d.toISOString().split('T')[0]
            }
            const r = await previewCloseFiscalYear(yearId, closeDate)
            if (r.success) {
                setDryResult({ ok: true, preview: r.preview })
                if (r.preview.invariants_passed) {
                    toast.success('Dry-run passed — safe to proceed with real close')
                }
            } else {
                setDryResult({ ok: false, error: r.error })
                toast.error('Dry-run caught an invariant violation — inspect before proceeding')
            }
        } finally {
            setDryRunning(false)
        }
    }
    const confirmed = !isPartial || closeConfirmText.trim() === closePreview.year.name
    const lastClosedDay = new Date(today); lastClosedDay.setDate(lastClosedDay.getDate() - 1)
    const lastClosedStr = lastClosedDay.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]
    const remainderStart = new Date(today)
    const sm = remainderStart.toLocaleDateString('en', { month: 'short' })
    const em = yearEnd.toLocaleDateString('en', { month: 'short' })
    const remainderName = `FY ${remainderStart.getFullYear()} (${sm}-${em})`

    return (
        <div {...dismiss.backdropProps} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div {...dismiss.contentProps} className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="px-5 py-4 flex justify-between items-center"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)' }}>
                            <ShieldCheck size={18} style={{ color: 'var(--app-error, #ef4444)' }} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                {closeStep === 'preview' ? (isPartial ? 'Partial Year-End Close' : 'Year-End Close') : 'Close Complete'}
                            </h2>
                            <p className="text-tp-xs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {closePreview.year.name} · {closePreview.year.start_date} — {closePreview.year.end_date}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg transition-all" style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {closeStep === 'preview' ? (
                    <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {isPartial && (
                            <div className="rounded-xl p-3 space-y-2"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <span className="text-tp-sm font-bold uppercase tracking-wider" style={{ color: 'var(--app-warning, #f59e0b)' }}>Partial Year Close</span>
                                </div>
                                <div className="text-tp-sm font-medium leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                                    Today ({todayStr}) is before the year end ({closePreview.year.end_date}). The year will be split:
                                </div>
                                <div className="space-y-1 pl-2">
                                    <div className="flex items-center gap-2 text-tp-sm" style={{ color: 'var(--app-foreground)' }}>
                                        <Lock size={10} style={{ color: 'var(--app-error, #ef4444)' }} />
                                        <span><strong>{closePreview.year.name}</strong> truncated to {closePreview.year.start_date} — {lastClosedStr} and locked</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-tp-sm" style={{ color: 'var(--app-foreground)' }}>
                                        <Plus size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                        <span>New year <strong>FY {remainderStart.getFullYear()} ({sm}-{em})</strong> auto-created from {todayStr}, posting stays open today</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {closePreview.blockers.length > 0 && (
                            <div className="rounded-xl p-3 space-y-2"
                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} style={{ color: 'var(--app-error, #ef4444)' }} />
                                    <span className="text-tp-sm font-bold uppercase tracking-wider" style={{ color: 'var(--app-error, #ef4444)' }}>Blockers</span>
                                </div>
                                {closePreview.blockers.map((b, i) => (
                                    <div key={i} className="text-tp-sm font-medium flex items-start gap-2" style={{ color: 'var(--app-error, #ef4444)' }}>
                                        <X size={12} className="flex-shrink-0 mt-0.5" /> {b}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Periods</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[
                                    { label: 'Open', value: closePreview.periods.open, color: 'var(--app-success, #22c55e)' },
                                    { label: 'Closed', value: closePreview.periods.closed, color: 'var(--app-muted-foreground)' },
                                    { label: 'Future', value: closePreview.periods.future, color: 'var(--app-info, #3b82f6)' },
                                ].map(s => (
                                    <div key={s.label} className="text-center">
                                        <div className="text-[16px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                                        <div className="text-tp-xxs font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries</div>
                            <div className="flex items-center gap-4">
                                <span className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>{closePreview.journal_entries.posted} posted</span>
                                {closePreview.journal_entries.draft > 0 && (
                                    <span className="text-tp-md font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>{closePreview.journal_entries.draft} draft</span>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Profit & Loss Closing</div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-tp-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--app-success, #22c55e)' }}><TrendingUp size={12} /> Revenue</span>
                                    <span className="text-tp-md font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>{closePreview.pnl.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-tp-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--app-error, #ef4444)' }}><TrendingDown size={12} /> Expenses</span>
                                    <span className="text-tp-md font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>{closePreview.pnl.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between pt-1.5 mt-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                                    <span className="text-tp-sm font-bold uppercase" style={{ color: 'var(--app-foreground)' }}>Net {closePreview.pnl.net_income >= 0 ? 'Income' : 'Loss'}</span>
                                    <span className="text-tp-lg font-bold tabular-nums" style={{ color: closePreview.pnl.net_income >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                        {closePreview.pnl.net_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>What will happen</div>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>
                                        {closePreview.periods.open > 0 ? `${closePreview.periods.open} open periods will be auto-closed, then all` : 'All'} Income & Expense accounts will be zeroed out
                                    </span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>
                                        Net {closePreview.pnl.net_income >= 0 ? 'income' : 'loss'} transferred to{' '}
                                        <strong>{closePreview.retained_earnings ? `${closePreview.retained_earnings.code} — ${closePreview.retained_earnings.name}` : 'Retained Earnings (not found!)'}</strong>
                                    </span>
                                </div>
                                {isPartial ? (
                                    <div className="flex items-start gap-2">
                                        <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>Remainder fiscal year auto-created with monthly open periods, opening balances carried forward</span>
                                    </div>
                                ) : closePreview.next_year ? (
                                    <div className="flex items-start gap-2">
                                        <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>{closePreview.opening_balances_count} opening balances generated for <strong>{closePreview.next_year.name}</strong></span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-warning, #f59e0b)' }}>No next fiscal year found — opening balances will NOT be generated. Create the next year first.</span>
                                    </div>
                                )}
                                <div className="flex items-start gap-2">
                                    <Lock size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-error, #ef4444)' }} />
                                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>This fiscal year will be permanently locked. This cannot be undone.</span>
                                </div>
                            </div>
                        </div>

                        {closePreview.opening_preview && closePreview.opening_preview.length > 0 && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Opening Balances Preview ({closePreview.opening_balances_count} accounts)
                                </div>
                                <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                                    {closePreview.opening_preview.map(ob => (
                                        <div key={ob.code} className="flex items-center justify-between text-tp-xs py-0.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono font-bold flex-shrink-0" style={{ color: 'var(--app-primary)', minWidth: '40px' }}>{ob.code}</span>
                                                <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{ob.name}</span>
                                            </div>
                                            <span className="font-bold tabular-nums flex-shrink-0 ml-2" style={{ color: ob.balance >= 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>
                                                {ob.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {closePreview.opening_balances_count > 30 && (
                                    <div className="text-tp-xxs font-bold mt-1" style={{ color: 'var(--app-muted-foreground)' }}>... and {closePreview.opening_balances_count - 30} more accounts</div>
                                )}
                            </div>
                        )}

                        {isPartial && (
                            <div className="rounded-xl p-3 space-y-2"
                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                                <div className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-error, #ef4444)' }}>Confirm Permanent Action</div>
                                <div className="text-tp-xs font-medium" style={{ color: 'var(--app-foreground)' }}>
                                    This locks <strong>{closePreview.year.name}</strong> permanently and splits the year. To proceed, type the year name below.
                                </div>
                                <input
                                    type="text"
                                    value={closeConfirmText}
                                    onChange={e => setCloseConfirmText(e.target.value)}
                                    placeholder={closePreview.year.name}
                                    className="w-full px-3 py-2 text-tp-sm font-mono rounded-lg outline-none"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                />
                            </div>
                        )}

                        {/* Dry-run result panel (only visible after a dry-run attempt) */}
                        {dryResult && (
                            <div className="rounded-xl p-3 space-y-2"
                                style={{
                                    background: dryResult.ok && dryResult.preview.invariants_passed
                                        ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)'
                                        : 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                                    border: `1px solid ${dryResult.ok && dryResult.preview.invariants_passed ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)'}`,
                                }}>
                                <div className="flex items-center gap-1.5 text-tp-xs font-bold"
                                    style={{ color: dryResult.ok && dryResult.preview.invariants_passed ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)' }}>
                                    <FlaskConical size={12} />
                                    {dryResult.ok && dryResult.preview.invariants_passed
                                        ? 'DRY-RUN PASSED · all invariants clean · no changes persisted'
                                        : 'DRY-RUN CAUGHT AN ISSUE · fix before proceeding'}
                                </div>
                                {dryResult.ok ? (
                                    <div className="text-tp-xs space-y-0.5 font-mono"
                                        style={{ color: 'var(--app-foreground)' }}>
                                        {dryResult.preview.closing_jes.map((je, i) => (
                                            <div key={`c${i}`}>
                                                Closing JE [{je.scope}]: {je.lines} lines · Dr {je.total_debit} / Cr {je.total_credit}
                                                {je.pnl_net && ` · P&L net=${je.pnl_net}`}
                                            </div>
                                        ))}
                                        {dryResult.preview.opening_jes.map((je, i) => (
                                            <div key={`o${i}`}>
                                                Opening JE [{je.scope}] → {je.target_year}: {je.lines} lines · Dr {je.total_debit} / Cr {je.total_credit}
                                            </div>
                                        ))}
                                        {dryResult.preview.messages?.map((m, i) => (
                                            <div key={`m${i}`} style={{ color: 'var(--app-muted-foreground)' }}>· {m}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-tp-xs" style={{ color: 'var(--app-foreground)' }}>
                                        {dryResult.error}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 text-tp-sm font-bold rounded-xl border transition-all"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                Cancel
                            </button>
                            <button onClick={() => void runDryClose()} disabled={dryRunning || isPending}
                                className="flex-1 py-2.5 text-tp-sm font-bold rounded-xl border transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                                {dryRunning ? <><Loader2 size={12} className="animate-spin" /> Simulating...</> : <><FlaskConical size={12} /> Dry-Run Close</>}
                            </button>
                            <button disabled={!closePreview.can_close || isPending || !confirmed}
                                onClick={() => onExecute(isPartial)}
                                className="flex-1 py-2.5 text-tp-sm font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                                style={{ background: closePreview.can_close ? 'var(--app-error, #ef4444)' : 'var(--app-muted)', color: 'white' }}>
                                {isPending ? <><Loader2 size={12} className="animate-spin" /> Closing...</> : <><ShieldCheck size={12} /> {isPartial ? 'Execute Partial Close & Split Year' : 'Execute Year-End Close'}</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Result Report ── */
                    <div className="p-5 space-y-4">
                        <div className="flex flex-col items-center py-4">
                            {closeResult?.startsWith('Error') ? (
                                <AlertTriangle size={36} style={{ color: 'var(--app-error, #ef4444)' }} />
                            ) : (
                                <CheckCircle2 size={36} style={{ color: 'var(--app-success, #22c55e)' }} />
                            )}
                            <p className="text-tp-lg font-bold mt-3 text-center" style={{ color: 'var(--app-foreground)' }}>
                                {closeResult?.startsWith('Error') ? 'Year-End Close Failed' : 'Year-End Close Complete'}
                            </p>
                            <p className="text-tp-sm font-medium mt-2 text-center leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                                {closeResult}
                            </p>
                        </div>

                        {!closeResult?.startsWith('Error') && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-tp-xxs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Summary</div>
                                <div className="space-y-1.5 text-tp-sm" style={{ color: 'var(--app-foreground)' }}>
                                    <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> P&L closed into Retained Earnings</div>
                                    <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> Net {closePreview.pnl.net_income >= 0 ? 'income' : 'loss'}: {closePreview.pnl.net_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    {isPartial ? (
                                        <div className="flex items-center gap-2"><Plus size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> Remainder year <strong>{remainderName}</strong> auto-created with opening balances</div>
                                    ) : closePreview.next_year && (
                                        <div className="flex items-center gap-2"><CheckCircle2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} /> Opening balances → {closePreview.next_year.name}</div>
                                    )}
                                    <div className="flex items-center gap-2"><Lock size={11} style={{ color: 'var(--app-error, #ef4444)' }} /> {closePreview.year.name} permanently locked</div>
                                </div>
                            </div>
                        )}

                        <button onClick={onDone}
                            className="w-full py-2.5 text-tp-sm font-bold rounded-xl transition-all"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
