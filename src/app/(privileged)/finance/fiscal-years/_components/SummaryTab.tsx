import { Loader2 } from 'lucide-react'
import type { YearSummary } from '@/app/actions/finance/fiscal-year'
import { YoyComparisonCard } from './YoyComparisonCard'

interface SummaryTabProps {
    summary: YearSummary | undefined
    fiscalYearId?: number
}

export function SummaryTab({ summary, fiscalYearId }: SummaryTabProps) {
    if (!summary) return <div className="p-8 text-center flex flex-col items-center gap-2">
        <Loader2 size={24} className="animate-spin text-(--app-primary)" />
        <span className="text-[11px] font-bold text-(--app-muted-foreground)">Calculating year-end totals...</span>
    </div>

    const s = summary
    return (
        <div className="flex flex-col min-h-0">
            {/* YoY comparison area */}
            {fiscalYearId && (
                <div className="p-4 border-b border-(--app-border)/40">
                    <YoyComparisonCard fiscalYearId={fiscalYearId} />
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Financial Sections Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-(--app-border)/40 border-b border-(--app-border)/40">
                    {/* P&L */}
                    <div className="p-5 bg-(--app-bg)">
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] mb-4 text-(--app-muted-foreground)">Performance Snapshot</div>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Revenue', value: s.pnl.revenue, color: 'var(--app-success, #22c55e)' },
                                { label: 'Expenses', value: s.pnl.expenses, color: 'var(--app-error, #ef4444)' },
                                { label: s.pnl.net_income >= 0 ? 'Net Income' : 'Net Loss', value: s.pnl.net_income, color: s.pnl.net_income >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' },
                            ].map(v => (
                                <div key={v.label}>
                                    <div className="text-[15px] font-black tabular-nums tracking-tight" style={{ color: v.color }}>{v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wide opacity-50">{v.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Balance Sheet */}
                    <div className="p-5 bg-(--app-bg)">
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] mb-4 text-(--app-muted-foreground)">Position Snapshot</div>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Assets', value: s.balance_sheet.assets, color: 'var(--app-info, #3b82f6)' },
                                { label: 'Liabilities', value: s.balance_sheet.liabilities, color: 'var(--app-error, #ef4444)' },
                                { label: 'Equity', value: s.balance_sheet.equity, color: 'var(--app-primary)' },
                            ].map(v => (
                                <div key={v.label}>
                                    <div className="text-[15px] font-black tabular-nums tracking-tight" style={{ color: v.color }}>{v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wide opacity-50">{v.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Secondary data area */}
                <div className="p-6 space-y-8">
                    {/* Journal Entry Stats */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.1em] mb-3 text-(--app-muted-foreground)">Activity Record</div>
                        <div className="flex gap-6">
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-(--app-foreground)">{s.journal_entries.total}</span>
                                <span className="text-[9px] font-bold uppercase opacity-50">Total JEs</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[14px] font-bold text-(--app-success, #22c55e)">{s.journal_entries.posted}</span>
                                <span className="text-[9px] font-bold uppercase opacity-50">Posted</span>
                            </div>
                            {s.journal_entries.draft > 0 && (
                                <div className="flex flex-col">
                                    <span className="text-[14px] font-bold text-(--app-warning, #f59e0b)">{s.journal_entries.draft}</span>
                                    <span className="text-[9px] font-bold uppercase opacity-50">Draft</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Closing Entry */}
                    {s.closing_entry && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-(--app-muted-foreground)">Closing Entry Detail</div>
                                <a href={`/finance/ledger/${s.closing_entry.id}`}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded border border-current hover:bg-current hover:text-white transition-all font-mono"
                                    style={{ color: 'var(--app-error, #ef4444)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                    {s.closing_entry.reference}
                                </a>
                            </div>
                            <div className="max-h-[160px] overflow-y-auto custom-scrollbar border rounded-lg border-(--app-border)/40">
                                {s.closing_entry.lines.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between text-[11px] px-3 py-1.5 border-b border-(--app-border)/30 last:border-0 hover:bg-(--app-surface)/30 transition-all">
                                        <div className="truncate pr-4 flex items-center gap-2">
                                            <span className="font-mono opacity-50 tracking-tighter">{l.code}</span>
                                            <span className="font-bold text-(--app-foreground)">{l.name}</span>
                                        </div>
                                        <div className="flex gap-4 flex-shrink-0 tabular-nums font-black text-[12px]">
                                            <span className="w-20 text-right" style={{ color: l.debit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: l.debit > 0 ? 1 : 0.2 }}>{l.debit > 0 ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
                                            <span className="w-20 text-right" style={{ color: l.credit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', opacity: l.credit > 0 ? 1 : 0.2 }}>{l.credit > 0 ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Opening Balances Analysis */}
                    {(s.opening_balances_received?.length > 0 || s.opening_balances?.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                            {/* Carried In */}
                            {s.opening_balances_received?.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-(--app-success, #22c55e)">Opening (Carried In)</div>
                                        <div className="flex gap-1">
                                            {(s.opening_entries_received || []).map(je => (
                                                <a key={je.id} href={`/finance/ledger/${je.id}`}
                                                    className="text-[9px] font-bold px-1.5 py-0.25 rounded border border-current hover:bg-current hover:text-white transition-all font-mono"
                                                    style={{ color: 'var(--app-success, #22c55e)', borderColor: 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' }}>
                                                    {je.reference}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar border rounded-lg border-(--app-border)/40">
                                        {s.opening_balances_received.map((ob, i) => (
                                            <div key={i} className="flex items-center justify-between text-[11px] px-3 py-1.5 border-b border-(--app-border)/30 last:border-0 hover:bg-(--app-surface)/30 transition-all">
                                                <div className="truncate pr-4 flex items-center gap-2">
                                                    <span className="font-mono opacity-50 tracking-tighter">{ob.code}</span>
                                                    <span className="font-bold text-(--app-foreground)">{ob.name}</span>
                                                </div>
                                                <span className="font-black tabular-nums text-[11px] text-right" style={{ color: ob.debit > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-foreground)' }}>
                                                    {ob.debit > 0 ? `DR ${ob.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `CR ${ob.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Carried Forward */}
                            {s.opening_balances?.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-(--app-muted-foreground)">Opening (Carried Forward)</div>
                                        <div className="flex gap-1">
                                            {(s.opening_entries || []).map(je => (
                                                <a key={je.id} href={`/finance/ledger/${je.id}`}
                                                    className="text-[9px] font-bold px-1.5 py-0.25 rounded border border-current hover:bg-current hover:text-white transition-all font-mono"
                                                    style={{ color: 'var(--app-primary)', borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                                    {je.reference}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar border rounded-lg border-(--app-border)/40">
                                        {s.opening_balances.map((ob, i) => (
                                            <div key={i} className="flex items-center justify-between text-[11px] px-3 py-1.5 border-b border-(--app-border)/30 last:border-0 hover:bg-(--app-surface)/30 transition-all">
                                                <div className="truncate pr-4 flex items-center gap-2">
                                                    <span className="font-mono opacity-50 tracking-tighter">{ob.code}</span>
                                                    <span className="font-bold text-(--app-foreground)">{ob.name}</span>
                                                </div>
                                                <span className="font-black tabular-nums text-[11px] text-right" style={{ color: ob.debit > 0 ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                                    {ob.debit > 0 ? `DR ${ob.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `CR ${ob.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

