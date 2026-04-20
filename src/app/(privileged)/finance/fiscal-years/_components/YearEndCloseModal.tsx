'use client'

import {
    ShieldCheck, X, AlertTriangle, Lock, Plus, TrendingUp, TrendingDown,
    ArrowRight, CheckCircle2, Loader2,
} from 'lucide-react'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import type { ClosePreview } from '@/app/actions/finance/fiscal-year'

export type CloseStep = 'preview' | 'result' | null

interface YearEndCloseModalProps {
    closeStep: Exclude<CloseStep, null>
    closePreview: ClosePreview
    closeResult: string | null
    closeConfirmText: string
    setCloseConfirmText: (v: string) => void
    isPending: boolean
    onClose: () => void
    onDone: () => void
    onExecute: (isPartial: boolean) => void
}

export function YearEndCloseModal({
    closeStep, closePreview, closeResult, closeConfirmText, setCloseConfirmText,
    isPending, onClose, onDone, onExecute,
}: YearEndCloseModalProps) {
    const dismiss = useModalDismiss(true, onClose)

    const today = new Date()
    const yearEnd = new Date(closePreview.year.end_date)
    const isPartial = today < yearEnd
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
                            <h2 className="text-[14px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                {closeStep === 'preview' ? (isPartial ? 'Partial Year-End Close' : 'Year-End Close') : 'Close Complete'}
                            </h2>
                            <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
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
                                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--app-warning, #f59e0b)' }}>Partial Year Close</span>
                                </div>
                                <div className="text-[11px] font-medium leading-relaxed" style={{ color: 'var(--app-foreground)' }}>
                                    Today ({todayStr}) is before the year end ({closePreview.year.end_date}). The year will be split:
                                </div>
                                <div className="space-y-1 pl-2">
                                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-foreground)' }}>
                                        <Lock size={10} style={{ color: 'var(--app-error, #ef4444)' }} />
                                        <span><strong>{closePreview.year.name}</strong> truncated to {closePreview.year.start_date} — {lastClosedStr} and locked</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-foreground)' }}>
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
                                    <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--app-error, #ef4444)' }}>Blockers</span>
                                </div>
                                {closePreview.blockers.map((b, i) => (
                                    <div key={i} className="text-[11px] font-medium flex items-start gap-2" style={{ color: 'var(--app-error, #ef4444)' }}>
                                        <X size={12} className="flex-shrink-0 mt-0.5" /> {b}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Periods</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[
                                    { label: 'Open', value: closePreview.periods.open, color: 'var(--app-success, #22c55e)' },
                                    { label: 'Closed', value: closePreview.periods.closed, color: 'var(--app-muted-foreground)' },
                                    { label: 'Future', value: closePreview.periods.future, color: 'var(--app-info, #3b82f6)' },
                                ].map(s => (
                                    <div key={s.label} className="text-center">
                                        <div className="text-[16px] font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
                                        <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries</div>
                            <div className="flex items-center gap-4">
                                <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>{closePreview.journal_entries.posted} posted</span>
                                {closePreview.journal_entries.draft > 0 && (
                                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>{closePreview.journal_entries.draft} draft</span>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Profit & Loss Closing</div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-success, #22c55e)' }}><TrendingUp size={12} /> Revenue</span>
                                    <span className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{closePreview.pnl.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--app-error, #ef4444)' }}><TrendingDown size={12} /> Expenses</span>
                                    <span className="text-[12px] font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{closePreview.pnl.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between pt-1.5 mt-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                                    <span className="text-[11px] font-black uppercase" style={{ color: 'var(--app-foreground)' }}>Net {closePreview.pnl.net_income >= 0 ? 'Income' : 'Loss'}</span>
                                    <span className="text-[13px] font-black tabular-nums" style={{ color: closePreview.pnl.net_income >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                        {closePreview.pnl.net_income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>What will happen</div>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                        {closePreview.periods.open > 0 ? `${closePreview.periods.open} open periods will be auto-closed, then all` : 'All'} Income & Expense accounts will be zeroed out
                                    </span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                        Net {closePreview.pnl.net_income >= 0 ? 'income' : 'loss'} transferred to{' '}
                                        <strong>{closePreview.retained_earnings ? `${closePreview.retained_earnings.code} — ${closePreview.retained_earnings.name}` : 'Retained Earnings (not found!)'}</strong>
                                    </span>
                                </div>
                                {isPartial ? (
                                    <div className="flex items-start gap-2">
                                        <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>Remainder fiscal year auto-created with monthly open periods, opening balances carried forward</span>
                                    </div>
                                ) : closePreview.next_year ? (
                                    <div className="flex items-start gap-2">
                                        <ArrowRight size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-[11px] font-medium" style={{ color: 'var(--app-foreground)' }}>{closePreview.opening_balances_count} opening balances generated for <strong>{closePreview.next_year.name}</strong></span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                        <span className="text-[11px] font-medium" style={{ color: 'var(--app-warning, #f59e0b)' }}>No next fiscal year found — opening balances will NOT be generated. Create the next year first.</span>
                                    </div>
                                )}
                                <div className="flex items-start gap-2">
                                    <Lock size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-error, #ef4444)' }} />
                                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>This fiscal year will be permanently locked. This cannot be undone.</span>
                                </div>
                            </div>
                        </div>

                        {closePreview.opening_preview && closePreview.opening_preview.length > 0 && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Opening Balances Preview ({closePreview.opening_balances_count} accounts)
                                </div>
                                <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                                    {closePreview.opening_preview.map(ob => (
                                        <div key={ob.code} className="flex items-center justify-between text-[10px] py-0.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono font-bold flex-shrink-0" style={{ color: 'var(--app-primary)', minWidth: '40px' }}>{ob.code}</span>
                                                <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{ob.name}</span>
                                            </div>
                                            <span className="font-black tabular-nums flex-shrink-0 ml-2" style={{ color: ob.balance >= 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>
                                                {ob.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {closePreview.opening_balances_count > 30 && (
                                    <div className="text-[9px] font-bold mt-1" style={{ color: 'var(--app-muted-foreground)' }}>... and {closePreview.opening_balances_count - 30} more accounts</div>
                                )}
                            </div>
                        )}

                        {isPartial && (
                            <div className="rounded-xl p-3 space-y-2"
                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-error, #ef4444)' }}>Confirm Permanent Action</div>
                                <div className="text-[10px] font-medium" style={{ color: 'var(--app-foreground)' }}>
                                    This locks <strong>{closePreview.year.name}</strong> permanently and splits the year. To proceed, type the year name below.
                                </div>
                                <input
                                    type="text"
                                    value={closeConfirmText}
                                    onChange={e => setCloseConfirmText(e.target.value)}
                                    placeholder={closePreview.year.name}
                                    className="w-full px-3 py-2 text-[11px] font-mono rounded-lg outline-none"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                />
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 text-[11px] font-bold rounded-xl border transition-all"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                Cancel
                            </button>
                            <button disabled={!closePreview.can_close || isPending || !confirmed}
                                onClick={() => onExecute(isPartial)}
                                className="flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
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
                            <p className="text-[13px] font-bold mt-3 text-center" style={{ color: 'var(--app-foreground)' }}>
                                {closeResult?.startsWith('Error') ? 'Year-End Close Failed' : 'Year-End Close Complete'}
                            </p>
                            <p className="text-[11px] font-medium mt-2 text-center leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                                {closeResult}
                            </p>
                        </div>

                        {!closeResult?.startsWith('Error') && (
                            <div className="rounded-xl p-3" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Summary</div>
                                <div className="space-y-1.5 text-[11px]" style={{ color: 'var(--app-foreground)' }}>
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
                            className="w-full py-2.5 text-[11px] font-bold rounded-xl transition-all"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
