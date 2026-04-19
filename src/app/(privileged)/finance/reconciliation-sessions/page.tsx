'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { GitMerge, Search, Calendar, CheckCircle, Clock, AlertCircle, DollarSign, ArrowRight } from 'lucide-react'

export default function ReconciliationSessionsPage() {
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/finance/reconciliation-sessions/')
            setSessions(Array.isArray(res) ? res : res?.results || [])
        } catch { setSessions([]) }
        setLoading(false)
    }

    const fmtCurrency = (v: any) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

    const statusCfg = (s: string) => {
        if (s === 'COMPLETED' || s === 'RECONCILED') return { color: 'var(--app-success)', icon: CheckCircle }
        if (s === 'IN_PROGRESS') return { color: 'var(--app-warning)', icon: Clock }
        if (s === 'FAILED' || s === 'DISCREPANCY') return { color: 'var(--app-danger)', icon: AlertCircle }
        return { color: 'var(--app-info)', icon: Clock }
    }

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-success))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <GitMerge className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Bank Reconciliation</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Reconciliation <span style={{ color: 'var(--app-primary)' }}>Sessions</span>
                    </h1>
                </div>
            </div>

            <div className="space-y-3">
                {sessions.map((s, i) => {
                    const cfg = statusCfg(s.status)
                    const Icon = cfg.icon
                    return (
                        <div key={s.id || i} className="rounded-xl px-5 py-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-app-foreground">{s.account_name || s.bank_account || `Session #${s.id}`}</h3>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                                        style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}>
                                        <Icon size={10} /> {s.status || 'PENDING'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-app-muted-foreground flex items-center gap-1">
                                    <Calendar size={10} /> {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg p-2.5" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Statement Lines</p>
                                    <p className="text-lg font-black text-app-foreground">{s.total_lines ?? s.statement_line_count ?? '—'}</p>
                                </div>
                                <div className="rounded-lg p-2.5" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Matched</p>
                                    <p className="text-lg font-black" style={{ color: 'var(--app-success)' }}>{s.matched_count ?? '—'}</p>
                                </div>
                                <div className="rounded-lg p-2.5" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Unmatched</p>
                                    <p className="text-lg font-black" style={{ color: 'var(--app-warning)' }}>{s.unmatched_count ?? '—'}</p>
                                </div>
                                <div className="rounded-lg p-2.5" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <p className="text-[9px] font-bold uppercase text-app-muted-foreground">Difference</p>
                                    <p className="text-lg font-black font-mono" style={{ color: s.difference && Number(s.difference) !== 0 ? 'var(--app-danger)' : 'var(--app-success)' }}>{fmtCurrency(s.difference)}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {sessions.length === 0 && (
                    <div className="text-center py-16">
                        <GitMerge size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                        <p className="text-sm font-bold text-app-muted-foreground">No reconciliation sessions</p>
                        <p className="text-xs text-app-muted-foreground">Import a bank statement to start a reconciliation session</p>
                    </div>
                )}
            </div>
        </div>
    )
}
