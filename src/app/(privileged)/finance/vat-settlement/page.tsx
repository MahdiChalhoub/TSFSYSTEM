'use client'

import { useState, useEffect, useCallback } from 'react'
import { calculateVatSettlement, postVatSettlement, getPeriodicTaxAccruals, runPeriodicTaxAccrual } from '@/app/actions/finance/tax-engine'
import { getFinancialAccounts } from '@/app/actions/finance/financial-accounts'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import {
    Scale, RefreshCw, CheckCircle, AlertCircle, Send,
    TrendingUp, TrendingDown, ReceiptText, Clock, Loader2
} from 'lucide-react'

export default function VatSettlementPage() {
    const { fmt } = useCurrency()

    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    type VATPreview = {
        net_vat_due?: number | string;
        total_output?: number | string;
        total_input?: number | string;
        adjustments?: number | string;
        [key: string]: unknown;
    } | null
    type FinancialAccountLite = { id: number; name: string; account_number?: string;[key: string]: unknown }
    type Accrual = { id: number; tax_type?: string; amount?: number | string; period_start?: string; period_end?: string; created_at?: string; status?: string;[key: string]: unknown }

    const [periodStart, setPeriodStart] = useState(firstDay)
    const [periodEnd, setPeriodEnd] = useState(todayStr)
    const [preview, setPreview] = useState<VATPreview>(null)
    const [bankAccountId, setBankAccountId] = useState('')
    const [accruals, setAccruals] = useState<Accrual[]>([])
    const [accounts, setAccounts] = useState<FinancialAccountLite[]>([])
    const [loading, setLoading] = useState(false)
    const [posting, setPosting] = useState(false)
    const [runningAccrual, setRunningAccrual] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const [accs, acc] = await Promise.all([getFinancialAccounts(), getPeriodicTaxAccruals()])
                setAccounts(Array.isArray(accs) ? accs : accs?.results || [])
                setAccruals(Array.isArray(acc) ? acc : acc?.results || [])
            } catch { }
        }
        load()
    }, [])

    const handlePreview = useCallback(async () => {
        if (!periodStart || !periodEnd) return
        setLoading(true); setPreview(null)
        try {
            const res = await calculateVatSettlement(periodStart + 'T00:00:00', periodEnd + 'T23:59:59')
            if (res?.error || res?.detail) throw new Error(res.error || res.detail)
            setPreview(res)
        } catch (e: unknown) { const m = e instanceof Error ? e.message : null; toast.error(m || 'Could not calculate VAT settlement') }
        finally { setLoading(false) }
    }, [periodStart, periodEnd])

    const handlePost = async () => {
        if (!bankAccountId) { toast.error('Select a bank account first'); return }
        if (!preview) { toast.error('Run preview first'); return }
        setPosting(true)
        try {
            await postVatSettlement({ period_start: periodStart + 'T00:00:00', period_end: periodEnd + 'T23:59:59', bank_account_id: bankAccountId })
            toast.success('VAT settlement posted to ledger'); setPreview(null)
        } catch (e: unknown) { const m = e instanceof Error ? e.message : null; toast.error(m || 'Failed to post settlement') }
        finally { setPosting(false) }
    }

    const handleRunAccrual = async () => {
        setRunningAccrual(true)
        try {
            const res = await runPeriodicTaxAccrual({ period_start: periodStart + 'T00:00:00', period_end: periodEnd + 'T23:59:59' })
            toast.success(`Accrual run: ${res?.accruals?.length ?? 0} entries created`)
            const acc = await getPeriodicTaxAccruals()
            setAccruals(Array.isArray(acc) ? acc : acc?.results || [])
        } catch (e: unknown) { const m = e instanceof Error ? e.message : null; toast.error(m || 'Failed to run accrual') }
        finally { setRunningAccrual(false) }
    }

    const n = (v?: unknown) => parseFloat(String(v ?? '0')) || 0
    const netDue = n(preview?.net_vat_due)
    const isRefund = netDue < 0

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all max-h-[calc(100vh-8rem)]">
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Scale size={20} className="text-white" />
                    </div>
                    <div>
                        <h1>VAT Settlement</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Calculate · Preview · Post to Ledger
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Period + Config ── */}
            <div className="flex-shrink-0 mb-4 p-4 border rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderColor: 'var(--app-border)', borderLeft: '3px solid var(--app-primary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', alignItems: 'end' }}>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Period Start</label>
                        <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                            className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Period End</label>
                        <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                            className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Bank / Settlement Account</label>
                        <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
                            className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                            <option value="">Select account…</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={String(a.id)}>{a.name} {a.account_number ? `(${a.account_number})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={handlePreview} disabled={loading}
                        className="flex items-center justify-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Calculating…' : 'Preview'}
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                ) : preview ? (
                    <>
                        {/* ── KPI Strip ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                            {[
                                { label: 'TVA Collectée', value: fmt(n(preview.vat_collected)), color: 'var(--app-success, #22c55e)', icon: <TrendingUp size={14} /> },
                                { label: 'TVA Récupérable', value: fmt(n(preview.vat_recoverable)), color: 'var(--app-info, #3b82f6)', icon: <TrendingDown size={14} /> },
                                { label: 'Net Due', value: fmt(Math.abs(netDue)), sub: isRefund ? 'Refund ← from state' : 'Payable → to state', color: isRefund ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)', icon: <Scale size={14} /> },
                            ].map(s => (
                                <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                        {'sub' in s && <div className="text-[9px] font-bold text-app-muted-foreground">{s.sub}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Post Action ── */}
                        <div className="rounded-2xl px-4 py-3"
                            style={{
                                background: isRefund ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)' : 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)',
                                border: `1px solid color-mix(in srgb, ${isRefund ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'} 20%, transparent)`,
                                borderLeft: `3px solid ${isRefund ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'}`,
                            }}>
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    {isRefund ? <ReceiptText size={18} style={{ color: 'var(--app-warning, #f59e0b)' }} /> : <AlertCircle size={18} style={{ color: 'var(--app-error, #ef4444)' }} />}
                                    <div>
                                        <p className="text-[13px] font-black text-app-foreground">
                                            {isRefund ? `Refund of ${fmt(Math.abs(netDue))} — receivable` : `${fmt(netDue)} — VAT Payable → Bank`}
                                        </p>
                                        <p className="text-[10px] font-bold text-app-muted-foreground">Journal entry: scope=OFFICIAL, status=POSTED</p>
                                    </div>
                                </div>
                                <button onClick={handlePost} disabled={posting || !bankAccountId}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <Send size={14} />
                                    {posting ? 'Posting…' : 'Post Settlement'}
                                </button>
                            </div>
                        </div>
                    </>
                ) : null}

                {/* ── Periodic Tax Accrual ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
                        <div className="flex items-center gap-2">
                            <Clock size={13} className="text-app-muted-foreground" />
                            <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">Periodic Tax Accruals</span>
                        </div>
                        <button onClick={handleRunAccrual} disabled={runningAccrual}
                            className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                            <RefreshCw size={11} className={runningAccrual ? 'animate-spin' : ''} />
                            {runningAccrual ? 'Running…' : 'Run Accrual'}
                        </button>
                    </div>

                    {accruals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Clock size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No periodic accruals yet</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">Run accrual to generate entries for MICRO/ON_TURNOVER orgs</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                        <th className="text-left px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Period</th>
                                        <th className="text-left px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Type</th>
                                        <th className="text-right px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Base</th>
                                        <th className="text-right px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Rate</th>
                                        <th className="text-right px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Amount</th>
                                        <th className="text-center px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accruals.map((a) => (
                                        <tr key={a.id} className="hover:bg-app-surface/40 transition-colors" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                            <td className="px-4 py-2 font-mono text-[11px] font-bold text-app-muted-foreground tabular-nums">{a.period_start?.slice(0, 10)} → {a.period_end?.slice(0, 10)}</td>
                                            <td className="px-4 py-2">
                                                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-foreground)' }}>{a.tax_type}</span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-bold text-app-foreground font-mono tabular-nums">{fmt(n(a.base_amount))}</td>
                                            <td className="px-4 py-2 text-right font-mono font-bold tabular-nums">{(n(a.rate) * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-2 text-right font-black font-mono tabular-nums" style={{ color: 'var(--app-accent)' }}>{fmt(n(a.accrual_amount))}</td>
                                            <td className="px-4 py-2 text-center">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: a.status === 'POSTED' ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)' : 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                                                        color: a.status === 'POSTED' ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                                                    }}>
                                                    {a.status === 'POSTED' && <CheckCircle size={10} />}
                                                    {a.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
