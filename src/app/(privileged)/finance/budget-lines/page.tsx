'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { ListTree, Search, Plus, Pencil, Trash2, X, Save, RefreshCw, DollarSign, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

export default function BudgetLinesPage() {
    const [lines, setLines] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/finance/budget-lines/')
            setLines(Array.isArray(res) ? res : res?.results || [])
        } catch { setLines([]) }
        setLoading(false)
    }

    const fmtCurrency = (v: any) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'

    const filtered = lines.filter(l =>
        !search || (l.account_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.budget_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.description || '').toLowerCase().includes(search.toLowerCase())
    )

    const totalBudget = filtered.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    const totalActual = filtered.reduce((s, l) => s + (Number(l.actual_amount) || 0), 0)

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-info))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <ListTree className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Financial Planning</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Budget <span style={{ color: 'var(--app-primary)' }}>Lines</span>
                    </h1>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Total Budget</p>
                    <p className="text-lg font-black font-mono text-app-foreground">{fmtCurrency(totalBudget)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Total Actual</p>
                    <p className="text-lg font-black font-mono" style={{ color: totalActual > totalBudget ? 'var(--app-danger)' : 'var(--app-success)' }}>{fmtCurrency(totalActual)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Variance</p>
                    <p className="text-lg font-black font-mono flex items-center gap-1" style={{ color: totalBudget - totalActual >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                        {totalBudget - totalActual >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {fmtCurrency(Math.abs(totalBudget - totalActual))}
                    </p>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by account or budget..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} lines</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Budget</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Account</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Period</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Budget</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Actual</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Variance</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((l, i) => {
                            const variance = (Number(l.amount) || 0) - (Number(l.actual_amount) || 0)
                            const pct = l.amount ? ((Number(l.actual_amount) || 0) / Number(l.amount) * 100).toFixed(0) : '—'
                            return (
                                <tr key={l.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all">
                                    <td className="px-4 py-3 font-medium text-app-foreground">{l.budget_name || `Budget #${l.budget}`}</td>
                                    <td className="px-4 py-3 text-app-foreground">{l.account_name || l.account || '—'}</td>
                                    <td className="px-4 py-3 text-xs text-app-muted-foreground">{l.period_name || l.period || '—'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-app-foreground">{fmtCurrency(l.amount)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-app-foreground">{fmtCurrency(l.actual_amount)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs font-bold" style={{ color: variance >= 0 ? 'var(--app-success)' : 'var(--app-danger)' }}>
                                        {variance >= 0 ? '+' : ''}{fmtCurrency(variance)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 rounded-full bg-app-surface overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                                <div className="h-full rounded-full" style={{ width: `${Math.min(Number(pct) || 0, 100)}%`, background: Number(pct) > 100 ? 'var(--app-danger)' : 'var(--app-primary)' }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-app-muted-foreground">{pct}%</span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No budget lines found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
