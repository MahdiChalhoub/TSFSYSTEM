import { Loader2 } from 'lucide-react'
import type { YearSummary } from '@/app/actions/finance/fiscal-year'

interface SummaryTabProps {
    summary: YearSummary | undefined
}

export function SummaryTab({ summary }: SummaryTabProps) {
    if (!summary) return <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-app-muted-foreground" /></div>

    const s = summary
    return (
        <div className="p-4 space-y-3">
            {/* P&L */}
            <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Profit & Loss</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {[
                        { label: 'Revenue', value: s.pnl.revenue, color: 'var(--app-success, #22c55e)' },
                        { label: 'Expenses', value: s.pnl.expenses, color: 'var(--app-error, #ef4444)' },
                        { label: s.pnl.net_income >= 0 ? 'Net Income' : 'Net Loss', value: s.pnl.net_income, color: s.pnl.net_income >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' },
                    ].map(v => (
                        <div key={v.label} className="text-center">
                            <div className="text-[14px] font-black tabular-nums" style={{ color: v.color }}>{v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{v.label}</div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Balance Sheet */}
            <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Balance Sheet</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {[
                        { label: 'Assets', value: s.balance_sheet.assets, color: 'var(--app-info, #3b82f6)' },
                        { label: 'Liabilities', value: s.balance_sheet.liabilities, color: 'var(--app-error, #ef4444)' },
                        { label: 'Equity', value: s.balance_sheet.equity, color: '#8b5cf6' },
                    ].map(v => (
                        <div key={v.label} className="text-center">
                            <div className="text-[14px] font-black tabular-nums" style={{ color: v.color }}>{v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--app-muted-foreground)' }}>{v.label}</div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Journal Entry Stats */}
            <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries</div>
                <div className="flex gap-4">
                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>{s.journal_entries.total} total</span>
                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>{s.journal_entries.posted} posted</span>
                    {s.journal_entries.draft > 0 && <span className="text-[12px] font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>{s.journal_entries.draft} draft</span>}
                </div>
            </div>
            {/* Closing Entry */}
            {s.closing_entry && (
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                        Closing Entry — {s.closing_entry.reference}
                    </div>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                        {s.closing_entry.lines.map((l, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] py-0.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{l.code} — {l.name}</span>
                                <div className="flex gap-3 flex-shrink-0 ml-2 tabular-nums font-bold">
                                    <span style={{ color: l.debit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{l.debit > 0 ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</span>
                                    <span style={{ color: l.credit > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{l.credit > 0 ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Opening Balances Received */}
            {s.opening_balances_received && s.opening_balances_received.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-success, #22c55e)' }}>
                        Opening Balances ← Carried In ({s.opening_balances_received.length} accounts)
                    </div>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                        {s.opening_balances_received.map((ob, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] py-0.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{ob.code} — {ob.name}</span>
                                <span className="font-bold tabular-nums flex-shrink-0 ml-2" style={{ color: 'var(--app-foreground)' }}>
                                    {ob.debit > 0 ? `DR ${ob.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `CR ${ob.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Opening Balances Sent */}
            {s.opening_balances.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>
                        Opening Balances → {s.opening_balances_target || 'Next Year'} ({s.opening_balances.length} accounts)
                    </div>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                        {s.opening_balances.map((ob, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] py-0.5" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                <span className="font-medium truncate" style={{ color: 'var(--app-foreground)' }}>{ob.code} — {ob.name}</span>
                                <span className="font-bold tabular-nums flex-shrink-0 ml-2" style={{ color: 'var(--app-foreground)' }}>
                                    {ob.debit > 0 ? `DR ${ob.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `CR ${ob.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
