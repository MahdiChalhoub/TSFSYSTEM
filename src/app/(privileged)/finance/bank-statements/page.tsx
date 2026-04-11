// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { FileUp, Search, Calendar, DollarSign, CheckCircle, Clock, Upload, Eye, Hash } from 'lucide-react'

export default function BankStatementsPage() {
    const [statements, setStatements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/finance/bank-statements/')
            setStatements(Array.isArray(res) ? res : res?.results || [])
        } catch { setStatements([]) }
        setLoading(false)
    }

    const filtered = statements.filter(s =>
        !search || (s.account_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.reference || '').includes(search)
    )

    const fmtCurrency = (v: any) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-info), var(--app-primary))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                        <FileUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Bank Reconciliation</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Bank <span style={{ color: 'var(--app-primary)' }}>Statements</span>
                        </h1>
                    </div>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))' }}>
                    <Upload className="h-4 w-4" /> Import Statement
                </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by account or reference..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} statements</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Account</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Period</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Reference</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Opening</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Closing</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Lines</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((s, i) => (
                            <tr key={s.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all cursor-pointer">
                                <td className="px-4 py-3 font-medium text-app-foreground">{s.account_name || s.bank_account || '—'}</td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground flex items-center gap-1">
                                    <Calendar size={10} />
                                    {s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'} — {s.end_date ? new Date(s.end_date).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-app-muted-foreground">{s.reference || '—'}</td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-app-foreground">{fmtCurrency(s.opening_balance)}</td>
                                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-app-foreground">{fmtCurrency(s.closing_balance)}</td>
                                <td className="px-4 py-3 text-xs text-app-foreground flex items-center gap-1"><Hash size={10} className="text-app-muted-foreground" />{s.line_count ?? s.total_lines ?? '—'}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                                        style={{ background: `color-mix(in srgb, var(--app-${s.status === 'RECONCILED' ? 'success' : s.status === 'PARTIAL' ? 'warning' : 'info'}) 15%, transparent)`, color: `var(--app-${s.status === 'RECONCILED' ? 'success' : s.status === 'PARTIAL' ? 'warning' : 'info'})` }}>
                                        {s.status === 'RECONCILED' ? <CheckCircle size={10} /> : <Clock size={10} />} {s.status || 'IMPORTED'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No bank statements found. Import a statement to begin reconciliation.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
