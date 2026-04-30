'use client'
/**
 * Revaluations sub-tab — period board with preview/approve/reverse/catchup.
 *
 * Lifted out of FxRedesigned.tsx as part of the maintainability split.
 * Owns all state for the preview drawer + reject modal + exposure card.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    Coins, RefreshCcw, TrendingUp, TrendingDown, Play, Wand2, AlertTriangle,
    Check, X, Eye, RotateCcw, Layers, ThumbsUp, ThumbsDown, AlertCircle, Activity,
} from 'lucide-react'
import {
    previewRevaluation, runRevaluation,
    approveRevaluation, rejectRevaluation,
    reverseRevaluationAtNextPeriod, catchupRevaluations, getFxExposure,
    getRealizedFxIntegrity,
    type CurrencyRevaluation, type RevaluationPreview, type FxExposureReport,
    type RealizedFxIntegrityReport,
} from '@/app/actions/finance/currency'
import {
    Period, Field, Th, Td, Pill, Kpi, ActionBtn, SectionHeader, NumericSparkline,
    INPUT_CLS, INPUT_STYLE, grad, soft, FG_PRIMARY,
} from './_shared'

export function RevaluationsView({ periods, revals, selectedPeriod, setSelectedPeriodId, onRefresh }: {
    periods: Period[]
    revals: CurrencyRevaluation[]
    selectedPeriod: Period | null
    setSelectedPeriodId: (id: number | null) => void
    onRefresh: () => Promise<void>
}) {
    const [previewState, setPreviewState] = useState<{
        periodId: number
        periodName: string
        data: RevaluationPreview | null
        loading: boolean
        excluded: Set<number>
        autoReverse: boolean
        forcePost: boolean
        committing: boolean
        error?: string
    } | null>(null)
    const [reverseBusy, setReverseBusy] = useState<number | null>(null)
    const [approveBusy, setApproveBusy] = useState<number | null>(null)
    const [rejectingId, setRejectingId] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [catchupBusy, setCatchupBusy] = useState(false)
    const [smartClassifyBusy, setSmartClassifyBusy] = useState(false)
    const [exposure, setExposure] = useState<FxExposureReport | null>(null)
    const [exposureLoading, setExposureLoading] = useState(false)
    const [integrity, setIntegrity] = useState<RealizedFxIntegrityReport | null>(null)

    /** All revaluations for a period that aren't rejected — picks the most
     *  recent POSTED, then the most recent PENDING_APPROVAL, then DRAFT. */
    const periodReval = (periodId: number) => {
        const list = revals.filter(r => r.fiscal_period === periodId && r.status !== 'REJECTED')
        const order = ['POSTED', 'PENDING_APPROVAL', 'DRAFT', 'REVERSED']
        return list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0] ?? null
    }
    const pendingApprovalReval = (periodId: number) =>
        revals.find(r => r.fiscal_period === periodId && r.status === 'PENDING_APPROVAL') ?? null

    async function openPreview(periodId: number, periodName: string) {
        setPreviewState({
            periodId, periodName, data: null, loading: true,
            excluded: new Set(), autoReverse: true, forcePost: false, committing: false,
        })
        const r = await previewRevaluation({ fiscalPeriodId: periodId, scope: 'OFFICIAL' })
        setPreviewState(s => s && {
            ...s, loading: false,
            data: r.success ? r.data ?? null : null,
            error: r.success ? undefined : (r.error || 'Preview failed'),
        })
    }
    async function refreshPreview(state: NonNullable<typeof previewState>) {
        setPreviewState(s => s && { ...s, loading: true })
        const r = await previewRevaluation({
            fiscalPeriodId: state.periodId, scope: 'OFFICIAL',
            excludedAccountIds: Array.from(state.excluded),
        })
        setPreviewState(s => s && {
            ...s, loading: false,
            data: r.success ? r.data ?? null : null,
            error: r.success ? undefined : (r.error || 'Preview failed'),
        })
    }
    async function commitPreview() {
        if (!previewState) return
        setPreviewState(s => s && { ...s, committing: true })
        const r = await runRevaluation({
            fiscalPeriodId: previewState.periodId, scope: 'OFFICIAL',
            excludedAccountIds: Array.from(previewState.excluded),
            autoReverse: previewState.autoReverse,
            forcePost: previewState.forcePost,
        })
        if (!r.success) {
            toast.error(r.error || 'Commit failed')
            setPreviewState(s => s && { ...s, committing: false })
            return
        }
        if (r.data === null) {
            toast.info(r.detail || 'Nothing to revalue')
        } else if (r.data?.status === 'PENDING_APPROVAL') {
            toast.info('Revaluation parked for approval — net impact above the materiality threshold.')
        } else {
            const sign = Number(r.data?.net_impact ?? 0) >= 0 ? '+' : ''
            toast.success(`Posted · net ${sign}${r.data?.net_impact} · ${r.data?.accounts_processed} acct${r.data?.accounts_processed === 1 ? '' : 's'}`)
        }
        setPreviewState(null)
        await onRefresh()
    }

    async function handleApprove(revId: number) {
        setApproveBusy(revId)
        const r = await approveRevaluation(revId)
        setApproveBusy(null)
        if (!r.success) { toast.error(r.error || 'Approve failed'); return }
        toast.success('Revaluation posted')
        await onRefresh()
    }
    async function handleReject(revId: number, reason: string) {
        const r = await rejectRevaluation(revId, reason)
        if (!r.success) { toast.error(r.error || 'Reject failed'); return }
        toast.success('Revaluation rejected')
        setRejectingId(null); setRejectReason('')
        await onRefresh()
    }
    async function handleReverse(revId: number) {
        setReverseBusy(revId)
        const r = await reverseRevaluationAtNextPeriod(revId)
        setReverseBusy(null)
        if (!r.success) { toast.error(r.error || 'Reversal failed'); return }
        toast.success(r.reversalJeId ? 'Reversing JE posted on day 1 of next period' : 'Reversal recorded')
        await onRefresh()
    }
    async function handleSmartClassify() {
        if (!confirm('Auto-classify every active account using IAS 21 / ASC 830 defaults? This sets monetary_classification + revaluation_required based on account type and role. You can override individual accounts afterwards.')) return
        setSmartClassifyBusy(true)
        const { bulkClassifyAccounts } = await import('@/app/actions/finance/accounts')
        const r = await bulkClassifyAccounts({ scope: 'smart' })
        setSmartClassifyBusy(false)
        if (!r.success) { toast.error(r.error || 'Classify failed'); return }
        toast.success(`Classified ${r.updated} account${r.updated === 1 ? '' : 's'}${r.skipped ? ` · ${r.skipped} unchanged` : ''}`)
        await onRefresh()
    }
    async function handleCatchup() {
        if (!selectedPeriod) return
        if (!confirm(`Run revaluation for every fiscal period through ${selectedPeriod.name}? Each period that's already posted will be skipped (and prior periods auto-reversed if not already).`)) return
        setCatchupBusy(true)
        const r = await catchupRevaluations({ throughPeriodId: selectedPeriod.id, scope: 'OFFICIAL' })
        setCatchupBusy(false)
        if (!r.success) { toast.error(r.error || 'Catchup failed'); return }
        const ran = (r.results ?? []).filter(x => x.revaluation_id).length
        const skipped = (r.results ?? []).filter(x => x.skipped_reason).length
        const errors = (r.results ?? []).filter(x => x.error)
        if (errors.length) {
            const sample = errors.slice(0, 3).map(e => `${e.period_name}: ${e.error}`).join('\n')
            const more = errors.length > 3 ? `\n…and ${errors.length - 3} more` : ''
            toast.error(`Catchup completed with ${errors.length} error${errors.length === 1 ? '' : 's'}\n${sample}${more}`, {
                duration: 12000,
            })
        }
        if (ran || skipped) {
            toast.success(`Catchup · ${ran} new · ${skipped} skipped${errors.length ? ` · ${errors.length} errors` : ''}`)
        }
        await onRefresh()
    }
    async function loadExposure() {
        setExposureLoading(true)
        const r = await getFxExposure({ scope: 'OFFICIAL' })
        setExposureLoading(false)
        if (!r.success) { toast.error(r.error || 'Exposure load failed'); return }
        setExposure(r.data ?? null)
    }
    async function loadIntegrity() {
        const r = await getRealizedFxIntegrity()
        if (r.success) setIntegrity(r.data ?? null)
    }
    useEffect(() => {
        void loadExposure()
        void loadIntegrity()
    }, [])  // eslint-disable-line react-hooks/exhaustive-deps

    const yearTotals = revals.reduce((acc, r) => {
        if (r.status !== 'POSTED') return acc
        acc.gain += Number(r.total_gain || 0)
        acc.loss += Number(r.total_loss || 0)
        acc.net += Number(r.net_impact || 0)
        return acc
    }, { gain: 0, loss: 0, net: 0 })
    const pendingCount = revals.filter(r => r.status === 'PENDING_APPROVAL').length

    return (
        <div className="space-y-3">
            {/* KPI summary */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 p-2.5 grid gap-2"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <Kpi label="Open periods" value={periods.filter(p => p.status === 'OPEN').length} tone="--app-success" icon={<Play size={12} />} />
                <Kpi label="Reval'd"       value={revals.filter(r => r.status === 'POSTED').length} tone="--app-info"   icon={<Check size={12} />} />
                <Kpi label="Pending"       value={pendingCount} tone="--app-warning" icon={<AlertCircle size={12} />} />
                <Kpi label="Total gain"    value={yearTotals.gain.toFixed(2)} tone="--app-success" icon={<TrendingUp size={12} />} />
                <Kpi label="Total loss"    value={yearTotals.loss.toFixed(2)} tone="--app-error"   icon={<TrendingDown size={12} />} />
                <Kpi label="Net YTD"       value={(yearTotals.net >= 0 ? '+' : '') + yearTotals.net.toFixed(2)} tone={yearTotals.net >= 0 ? '--app-success' : '--app-error'} icon={<Coins size={12} />} />
            </div>

            {/* Realized-FX integrity banner — surfaces fully-paid FC invoices
                that don't have a realized-FX adjustment JE. Hidden when clean. */}
            {integrity && !integrity.clean && integrity.missing_realized_fx.length > 0 && (
                <RealizedFxIntegrityBanner data={integrity} onRefresh={loadIntegrity} />
            )}

            {/* FX Exposure card */}
            <FxExposureCard data={exposure} loading={exposureLoading} onRefresh={loadExposure} />

            <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(280px, 360px) 1fr' }}>
                {/* ── Period list ── */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    <SectionHeader icon={<Coins size={13} style={{ color: 'var(--app-warning)' }} />}
                        title="Fiscal Periods" subtitle={`${periods.length} period${periods.length === 1 ? '' : 's'}`} />
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[600px]">
                        {periods.length === 0 ? (
                            <p className="text-[10px] text-app-muted-foreground italic px-2 py-3">No fiscal periods configured. Create a fiscal year first.</p>
                        ) : periods.map(p => {
                            const r = periodReval(p.id)
                            const isSel = selectedPeriod?.id === p.id
                            const tone = r?.status === 'POSTED'
                                ? (r.reversal_journal_entry ? '--app-info' : '--app-success')
                                : r?.status === 'PENDING_APPROVAL' ? '--app-warning'
                                : p.status === 'OPEN' ? '--app-info'
                                : '--app-muted-foreground'
                            const pillLabel = r?.status === 'POSTED'
                                ? (r.reversal_journal_entry ? '↺ REVERSED' : "✓ REVAL'D")
                                : r?.status === 'PENDING_APPROVAL' ? '⚠ PENDING'
                                : p.status
                            return (
                                <button key={p.id} onClick={() => setSelectedPeriodId(p.id)}
                                    className="w-full text-left rounded-lg px-3 py-2 transition-all"
                                    style={isSel
                                        ? { ...soft('--app-warning', 10), border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }
                                        : { background: 'transparent', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black truncate" style={{ fontSize: 12, color: 'var(--app-foreground)' }}>{p.name}</span>
                                        <Pill tone={tone}>{pillLabel}</Pill>
                                    </div>
                                    <div className="font-mono mt-0.5" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                        {p.start_date} → {p.end_date}
                                    </div>
                                    {r && (
                                        <div className="font-mono font-bold tabular-nums mt-1 flex items-center gap-1.5" style={{ fontSize: 10, color: Number(r.net_impact) >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                            net {Number(r.net_impact) >= 0 ? '+' : ''}{r.net_impact}
                                            {Number(r.materiality_pct) > 0 && (
                                                <span className="font-normal" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                                    · {Number(r.materiality_pct).toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ── Selected-period detail ── */}
                <div className="bg-app-surface rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
                    {!selectedPeriod ? (
                        <div className="p-8 flex items-center justify-center text-app-muted-foreground italic" style={{ fontSize: 11 }}>
                            Pick a period on the left to see details.
                        </div>
                    ) : (() => {
                        const r = periodReval(selectedPeriod.id)
                        const pending = pendingApprovalReval(selectedPeriod.id)
                        const canRun = selectedPeriod.status === 'OPEN' && !pending
                        return (
                            <>
                                <SectionHeader
                                    icon={<Play size={13} style={{ color: 'var(--app-warning)' }} />}
                                    title={selectedPeriod.name}
                                    subtitle={`${selectedPeriod.start_date} → ${selectedPeriod.end_date} · ${selectedPeriod.status}`}
                                    action={
                                        <div className="flex items-center gap-1.5">
                                            <ActionBtn icon={<Wand2 size={11} />} tone="--app-info"
                                                disabled={smartClassifyBusy} onClick={handleSmartClassify}
                                                title="Auto-set monetary classification on every account using IAS 21 / ASC 830 defaults">
                                                {smartClassifyBusy ? 'Classifying…' : 'Smart classify'}
                                            </ActionBtn>
                                            <ActionBtn icon={<Layers size={11} />} tone="--app-info"
                                                disabled={catchupBusy} onClick={handleCatchup}>
                                                {catchupBusy ? 'Catching up…' : 'Catchup'}
                                            </ActionBtn>
                                            <ActionBtn icon={<Eye size={11} />} tone="--app-warning" filled
                                                disabled={!canRun}
                                                onClick={() => openPreview(selectedPeriod.id, selectedPeriod.name)}>
                                                {r ? 'Re-preview' : 'Preview revaluation'}
                                            </ActionBtn>
                                        </div>
                                    } />
                                <div className="p-4 space-y-3 overflow-y-auto">
                                    {pending && (
                                        <div className="rounded-xl p-3 space-y-2"
                                            style={{ ...soft('--app-warning', 8), border: '1px solid color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-black inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--app-warning)' }}>
                                                    <AlertCircle size={13} /> Pending approval
                                                </div>
                                                <span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                                    materiality {Number(pending.materiality_pct).toFixed(2)}%
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                                Net impact <strong className="font-mono">{Number(pending.net_impact) >= 0 ? '+' : ''}{pending.net_impact}</strong> across {pending.accounts_processed} account{pending.accounts_processed === 1 ? '' : 's'} crossed the materiality threshold and is waiting for review.
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => handleApprove(pending.id)} disabled={approveBusy === pending.id}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50"
                                                    style={{ ...grad('--app-success'), color: FG_PRIMARY, fontSize: 11 }}>
                                                    <ThumbsUp size={11} /> {approveBusy === pending.id ? 'Approving…' : 'Approve & post'}
                                                </button>
                                                <button onClick={() => { setRejectingId(pending.id); setRejectReason('') }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border"
                                                    style={{ borderColor: 'color-mix(in srgb, var(--app-error) 35%, transparent)', color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', fontSize: 11 }}>
                                                    <ThumbsDown size={11} /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {r && r.status === 'POSTED' ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            <Kpi label="Gain" value={r.total_gain} tone="--app-success" icon={<TrendingUp size={12} />} />
                                            <Kpi label="Loss" value={r.total_loss} tone="--app-error" icon={<TrendingDown size={12} />} />
                                            <Kpi label="Net" value={(Number(r.net_impact) >= 0 ? '+' : '') + r.net_impact}
                                                tone={Number(r.net_impact) >= 0 ? '--app-success' : '--app-error'}
                                                icon={<Coins size={12} />} />
                                        </div>
                                    ) : !pending ? (
                                        <div className="rounded-lg p-3 text-[10px]"
                                            style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)', color: 'var(--app-foreground)' }}>
                                            <strong className="font-black uppercase tracking-widest" style={{ color: 'var(--app-info)', fontSize: 9 }}>How it works</strong>
                                            {' — '}revaluation marks every foreign-currency monetary account at the closing rate (or average for income/expense accounts). Click Preview to see the breakdown before posting; runs above the materiality threshold are parked for approval. Catchup runs missed periods in chronological order.
                                        </div>
                                    ) : null}

                                    {r && r.status === 'POSTED' && !r.reversal_journal_entry && r.auto_reverse_at_period_start && (
                                        <div className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                                            style={{ ...soft('--app-info', 6), border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                                <RotateCcw size={11} className="inline -mt-0.5 mr-1" style={{ color: 'var(--app-info)' }} />
                                                Auto-reversal pending — post a reversing JE on day 1 of the next period.
                                            </div>
                                            <button onClick={() => handleReverse(r.id)} disabled={reverseBusy === r.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border disabled:opacity-50"
                                                style={{ borderColor: 'color-mix(in srgb, var(--app-info) 35%, transparent)', color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', fontSize: 10 }}>
                                                {reverseBusy === r.id ? 'Reversing…' : 'Reverse now'}
                                            </button>
                                        </div>
                                    )}
                                    {r && r.reversal_journal_entry && (
                                        <div className="rounded-xl px-3 py-2 flex items-center gap-2"
                                            style={{ ...soft('--app-success', 6), border: '1px solid color-mix(in srgb, var(--app-success) 18%, transparent)', fontSize: 11, color: 'var(--app-foreground)' }}>
                                            <Check size={11} style={{ color: 'var(--app-success)' }} />
                                            Auto-reversal posted{r.reversal_je_reference ? ` · JE ${r.reversal_je_reference}` : ''}.
                                        </div>
                                    )}

                                    {/* All revaluations for this period (history) */}
                                    {(() => {
                                        const all = revals.filter(rv => rv.fiscal_period === selectedPeriod.id)
                                        if (all.length === 0) return null
                                        // Net-impact mini chart across this period's reval runs.
                                        const netSeries = [...all]
                                            .filter(rv => rv.status === 'POSTED')
                                            .sort((a, b) => a.revaluation_date.localeCompare(b.revaluation_date))
                                            .map(rv => Number(rv.net_impact))
                                        return (
                                            <div className="rounded-lg overflow-hidden border border-app-border/50">
                                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center justify-between gap-2"
                                                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                                    <span>History</span>
                                                    {netSeries.length >= 2 && (
                                                        <span className="text-[9px] font-bold normal-case tracking-normal text-app-muted-foreground">
                                                            net-impact trend
                                                        </span>
                                                    )}
                                                </div>
                                                {netSeries.length >= 2 && (
                                                    <div className="px-3 pt-2">
                                                        <NumericSparkline values={netSeries} />
                                                    </div>
                                                )}
                                                <table className="w-full">
                                                    <tbody>
                                                        {all.map(rv => (
                                                            <tr key={rv.id} className="border-t border-app-border/30">
                                                                <Td><span className="font-mono" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.revaluation_date}</span></Td>
                                                                <Td><Pill tone={rv.scope === 'OFFICIAL' ? '--app-success' : '--app-info'}>{rv.scope}</Pill></Td>
                                                                <Td align="right"><span className="font-mono font-bold tabular-nums" style={{ fontSize: 10, color: Number(rv.net_impact) >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                                    {Number(rv.net_impact) >= 0 ? '+' : ''}{rv.net_impact}
                                                                </span></Td>
                                                                <Td><span style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.accounts_processed} accts</span></Td>
                                                                <Td><span className="font-mono" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{rv.je_reference ?? '—'}</span></Td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </>
                        )
                    })()}
                </div>
            </div>

            {previewState && (
                <RevaluationPreviewDrawer
                    state={previewState}
                    onClose={() => setPreviewState(null)}
                    onToggleAccount={(id) => setPreviewState(s => {
                        if (!s) return s
                        const next = new Set(s.excluded)
                        if (next.has(id)) next.delete(id); else next.add(id)
                        return { ...s, excluded: next }
                    })}
                    onSetAutoReverse={(v) => setPreviewState(s => s && { ...s, autoReverse: v })}
                    onSetForcePost={(v) => setPreviewState(s => s && { ...s, forcePost: v })}
                    onRefresh={() => previewState && refreshPreview(previewState)}
                    onCommit={commitPreview}
                />
            )}

            {rejectingId !== null && (
                <RejectRevaluationModal
                    reason={rejectReason}
                    setReason={setRejectReason}
                    onCancel={() => { setRejectingId(null); setRejectReason('') }}
                    onConfirm={() => handleReject(rejectingId, rejectReason)}
                />
            )}
        </div>
    )
}

function FxExposureCard({ data, loading, onRefresh }: {
    data: FxExposureReport | null
    loading: boolean
    onRefresh: () => void
}) {
    const [open, setOpen] = useState(false)
    if (!data && !loading) {
        return (
            <div className="bg-app-surface rounded-2xl border border-app-border/50 px-4 py-2.5 flex items-center justify-between">
                <div className="font-black inline-flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                    <Activity size={11} /> FX Exposure unavailable
                </div>
                <button onClick={onRefresh} className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: 'var(--app-info)' }}>
                    <RefreshCcw size={10} /> Retry
                </button>
            </div>
        )
    }
    const totalBase = data?.currencies.reduce((acc, c) => acc + Math.abs(Number(c.total_base)), 0) ?? 0
    return (
        <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-app-background/30">
                <div className="flex items-center gap-2">
                    <Activity size={13} style={{ color: 'var(--app-info)' }} />
                    <div>
                        <div className="font-black" style={{ fontSize: 12, color: 'var(--app-foreground)' }}>FX Exposure</div>
                        <div className="font-mono" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            {loading ? 'loading…' : `${data?.currencies.length ?? 0} ccy · base ${data?.base_currency ?? '?'} · as of ${data?.as_of ?? '—'}`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-mono font-black tabular-nums" style={{ fontSize: 13, color: 'var(--app-foreground)' }}>
                        {totalBase.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="font-bold uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                        {open ? '▴ collapse' : '▾ expand'}
                    </span>
                </div>
            </button>
            {open && data && (
                <div className="border-t border-app-border/40">
                    {data.currencies.length === 0 ? (
                        <p className="px-4 py-3 italic" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                            No foreign-currency exposure as of {data.as_of}.
                        </p>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr style={{ background: 'color-mix(in srgb, var(--app-background) 30%, transparent)' }}>
                                    <Th>Ccy</Th>
                                    <Th align="right">Balance (FC)</Th>
                                    <Th align="right">Rate</Th>
                                    <Th align="right">Base value</Th>
                                    {data.sensitivity_bands.map(b => (
                                        <Th key={b} align="right">{Number(b) >= 0 ? '+' : ''}{b}%</Th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.currencies.map(c => (
                                    <tr key={c.currency} className="border-t border-app-border/30">
                                        <Td><span className="font-mono font-black" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>{c.currency}</span></Td>
                                        <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>{Number(c.total_fc).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></Td>
                                        <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{Number(c.rate).toFixed(6)}</span></Td>
                                        <Td align="right"><span className="font-mono tabular-nums font-bold" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>{Number(c.total_base).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></Td>
                                        {data.sensitivity_bands.map(b => {
                                            const v = Number(c.sensitivity[b])
                                            const delta = v - Number(c.total_base)
                                            return (
                                                <Td key={b} align="right">
                                                    <span className="font-mono tabular-nums" style={{ fontSize: 10, color: delta >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                        {delta >= 0 ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                </Td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}

function RevaluationPreviewDrawer({ state, onClose, onToggleAccount, onSetAutoReverse, onSetForcePost, onRefresh, onCommit }: {
    state: {
        periodId: number; periodName: string
        data: RevaluationPreview | null; loading: boolean
        excluded: Set<number>
        autoReverse: boolean; forcePost: boolean
        committing: boolean; error?: string
    }
    onClose: () => void
    onToggleAccount: (id: number) => void
    onSetAutoReverse: (v: boolean) => void
    onSetForcePost: (v: boolean) => void
    onRefresh: () => void
    onCommit: () => void
}) {
    const d = state.data
    const includedLines = (d?.lines ?? []).filter(l => !state.excluded.has(l.account_id))
    const totalGainShown = includedLines.reduce((acc, l) => acc + Math.max(0, Number(l.difference)), 0)
    const totalLossShown = includedLines.reduce((acc, l) => acc + Math.max(0, -Number(l.difference)), 0)
    const netShown = totalGainShown - totalLossShown
    const tripped = !!d && d.requires_approval && !state.forcePost

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !state.committing) onClose() }}>
            <div className="w-full max-w-2xl flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>
                <div className="px-5 py-4 flex items-start justify-between gap-3"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div>
                        <div className="font-black inline-flex items-center gap-1.5" style={{ fontSize: 14, color: 'var(--app-foreground)' }}>
                            <Eye size={13} /> Revaluation preview
                        </div>
                        <p className="font-bold uppercase tracking-widest mt-0.5"
                            style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            {state.periodName} · OFFICIAL scope
                        </p>
                    </div>
                    <button onClick={() => !state.committing && onClose()}
                        className="p-1.5 rounded-lg hover:bg-app-border/40 -m-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {state.loading && (
                        <div className="rounded-xl p-4 inline-flex items-center gap-2"
                            style={{ ...soft('--app-info', 6), color: 'var(--app-info)', fontSize: 12 }}>
                            <RefreshCcw size={12} className="animate-spin" /> Computing preview…
                        </div>
                    )}
                    {state.error && !state.loading && (
                        <div className="rounded-xl p-3" style={{ ...soft('--app-error', 8), border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                            <div className="font-black inline-flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--app-error)' }}>
                                <AlertTriangle size={12} /> Preview failed
                            </div>
                            <p className="mt-1 font-mono" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>{state.error}</p>
                        </div>
                    )}
                    {d && !state.loading && (
                        <>
                            <div className="grid grid-cols-4 gap-2">
                                <Kpi label="Lines" value={includedLines.length} tone="--app-info" icon={<Layers size={12} />} />
                                <Kpi label="Gain" value={totalGainShown.toFixed(2)} tone="--app-success" icon={<TrendingUp size={12} />} />
                                <Kpi label="Loss" value={totalLossShown.toFixed(2)} tone="--app-error" icon={<TrendingDown size={12} />} />
                                <Kpi label="Net" value={(netShown >= 0 ? '+' : '') + netShown.toFixed(2)}
                                    tone={netShown >= 0 ? '--app-success' : '--app-error'} icon={<Coins size={12} />} />
                            </div>

                            <div className="rounded-xl p-3"
                                style={{ ...soft(tripped ? '--app-warning' : '--app-info', 6),
                                    border: `1px solid color-mix(in srgb, var(${tripped ? '--app-warning' : '--app-info'}) 22%, transparent)` }}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-black inline-flex items-center gap-1.5" style={{ fontSize: 11, color: tripped ? 'var(--app-warning)' : 'var(--app-info)' }}>
                                        {tripped ? <AlertCircle size={12} /> : <Check size={12} />}
                                        Materiality {Number(d.materiality_pct).toFixed(2)}% (threshold {Number(d.materiality_threshold).toFixed(2)}%)
                                    </div>
                                    <span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                        revalued base · {Number(d.revalued_base_total).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <p className="mt-1 leading-relaxed" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                                    {tripped
                                        ? 'Net impact exceeds the org materiality threshold. The run will be parked as PENDING_APPROVAL — a reviewer must approve it before the JE posts.'
                                        : 'Net impact is below the materiality threshold. The run will post directly when committed.'}
                                </p>
                            </div>

                            {includedLines.length === 0 ? (
                                <p className="text-app-muted-foreground italic" style={{ fontSize: 11 }}>
                                    No accounts to revalue (all excluded or no FC activity).
                                </p>
                            ) : (
                                <div className="rounded-xl overflow-hidden border border-app-border/50">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ background: 'color-mix(in srgb, var(--app-background) 30%, transparent)' }}>
                                                <Th>&nbsp;</Th>
                                                <Th>Account</Th>
                                                <Th>Class</Th>
                                                <Th>Rate type</Th>
                                                <Th align="right">Balance (FC)</Th>
                                                <Th align="right">Old rate</Th>
                                                <Th align="right">New rate</Th>
                                                <Th align="right">Δ base</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {d.lines.map(l => {
                                                const ex = state.excluded.has(l.account_id)
                                                const diff = Number(l.difference)
                                                return (
                                                    <tr key={l.account_id} className="border-t border-app-border/30"
                                                        style={ex ? { opacity: 0.4 } : {}}>
                                                        <Td>
                                                            <input type="checkbox" checked={!ex}
                                                                onChange={() => onToggleAccount(l.account_id)}
                                                                className="cursor-pointer" />
                                                        </Td>
                                                        <Td>
                                                            <div className="font-mono font-black" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                                                {l.account_code}
                                                            </div>
                                                            <div style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{l.account_name}</div>
                                                        </Td>
                                                        <Td><Pill tone={l.classification === 'MONETARY' ? '--app-success' : '--app-info'}>{l.classification.replace('_', ' ')}</Pill></Td>
                                                        <Td><Pill tone="--app-muted-foreground">{l.rate_type_used}</Pill></Td>
                                                        <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                                                            {Number(l.balance_in_currency).toLocaleString(undefined, { maximumFractionDigits: 2 })} {l.currency_code}
                                                        </span></Td>
                                                        <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>
                                                            {Number(l.old_rate).toFixed(6)}
                                                        </span></Td>
                                                        <Td align="right"><span className="font-mono tabular-nums font-bold" style={{ fontSize: 10, color: 'var(--app-foreground)' }}>
                                                            {Number(l.new_rate).toFixed(6)}
                                                        </span></Td>
                                                        <Td align="right"><span className="font-mono tabular-nums font-black" style={{ fontSize: 11, color: diff >= 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                                                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                                                        </span></Td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {d.skipped.length > 0 && (
                                <div className="rounded-xl p-3" style={{ ...soft('--app-muted-foreground', 6), border: '1px solid var(--app-border)' }}>
                                    <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                                        Skipped ({d.skipped.length})
                                    </div>
                                    <ul className="space-y-0.5" style={{ fontSize: 10 }}>
                                        {d.skipped.map(s => (
                                            <li key={s.account_id} className="flex items-center gap-2">
                                                <span className="font-mono font-black" style={{ color: 'var(--app-foreground)' }}>{s.code}</span>
                                                <span style={{ color: 'var(--app-muted-foreground)' }}>{s.currency} · {s.reason}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="rounded-xl p-3 space-y-1.5"
                                style={{ ...soft('--app-info', 4), border: '1px solid var(--app-border)' }}>
                                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                    <input type="checkbox" checked={state.autoReverse} onChange={e => onSetAutoReverse(e.target.checked)} />
                                    Auto-reverse on day 1 of next period <span className="text-app-muted-foreground" style={{ fontSize: 10 }}>(standard accounting practice for unrealized gains)</span>
                                </label>
                                {tripped && (
                                    <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 11, color: 'var(--app-foreground)' }}>
                                        <input type="checkbox" checked={state.forcePost} onChange={e => onSetForcePost(e.target.checked)} />
                                        Bypass approval gate (post immediately) <span className="text-app-muted-foreground" style={{ fontSize: 10 }}>(use only with explicit authorization)</span>
                                    </label>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        {state.committing ? 'Committing…' : `${includedLines.length} included · ${state.excluded.size} excluded`}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onRefresh} disabled={state.loading || state.committing}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)', background: 'var(--app-surface)', fontSize: 11 }}>
                            <RefreshCcw size={11} /> Re-preview
                        </button>
                        <button onClick={onClose} disabled={state.committing}
                            className="px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-foreground)', background: 'var(--app-surface)', fontSize: 11 }}>
                            Cancel
                        </button>
                        <button onClick={onCommit} disabled={state.committing || state.loading || !d || includedLines.length === 0}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold disabled:opacity-50"
                            style={state.committing || !d || includedLines.length === 0
                                ? { background: 'var(--app-border)', color: 'var(--app-muted-foreground)', fontSize: 11 }
                                : { ...grad(tripped ? '--app-warning' : '--app-success'), color: FG_PRIMARY, fontSize: 11 }}>
                            {state.committing ? 'Committing…' : tripped ? 'Submit for approval' : 'Post revaluation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function RejectRevaluationModal({ reason, setReason, onCancel, onConfirm }: {
    reason: string
    setReason: (v: string) => void
    onCancel: () => void
    onConfirm: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-error) 30%, var(--app-border))' }}>
                <div className="px-5 pt-5 pb-3">
                    <div className="font-black inline-flex items-center gap-2" style={{ fontSize: 14, color: 'var(--app-error)' }}>
                        <ThumbsDown size={14} /> Reject revaluation
                    </div>
                    <p className="mt-1" style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                        The lines are kept for audit but no JE will be posted.
                    </p>
                </div>
                <div className="px-5 pb-4">
                    <Field label="Reason (optional)">
                        <textarea value={reason} onChange={e => setReason(e.target.value)}
                            rows={3} className={INPUT_CLS} style={{ ...INPUT_STYLE, fontFamily: 'inherit' }}
                            placeholder="e.g. Materiality justified, will revisit at year-end…" />
                    </Field>
                </div>
                <div className="px-4 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                    <button onClick={onCancel}
                        className="px-3.5 py-1.5 rounded-xl font-bold border"
                        style={{ fontSize: 11, color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold"
                        style={{ ...grad('--app-error'), color: FG_PRIMARY, fontSize: 11 }}>
                        <ThumbsDown size={11} /> Reject
                    </button>
                </div>
            </div>
        </div>
    )
}


function RealizedFxIntegrityBanner({ data, onRefresh }: {
    data: RealizedFxIntegrityReport
    onRefresh: () => void
}) {
    const [open, setOpen] = useState(false)
    const count = data.missing_realized_fx.length
    return (
        <div className="rounded-2xl overflow-hidden"
            style={{ ...soft('--app-warning', 8), border: '1px solid color-mix(in srgb, var(--app-warning) 28%, transparent)' }}>
            <button onClick={() => setOpen(o => !o)}
                className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={13} style={{ color: 'var(--app-warning)' }} />
                    <div>
                        <div className="font-black" style={{ fontSize: 12, color: 'var(--app-warning)' }}>
                            Realized FX integrity · {count} invoice{count === 1 ? '' : 's'} missing FX adjustment
                        </div>
                        <div className="font-mono" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                            Fully-paid foreign-currency invoices without a realized-FX JE — usually means the payment was recorded without supplying payment_amount_foreign + payment_rate.
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onRefresh() }}
                        className="text-[10px] font-bold inline-flex items-center gap-1"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <RefreshCcw size={10} /> Recheck
                    </button>
                    <span className="font-bold uppercase tracking-widest" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>
                        {open ? '▴ collapse' : '▾ expand'}
                    </span>
                </div>
            </button>
            {open && (
                <div className="border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-warning) 18%, transparent)' }}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)' }}>
                                <Th>Invoice</Th>
                                <Th>Currency</Th>
                                <Th align="right">Amount</Th>
                                <Th align="right">Booking rate</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.missing_realized_fx.slice(0, 25).map(row => (
                                <tr key={row.invoice_id} className="border-t border-app-border/30">
                                    <Td><span className="font-mono font-black" style={{ fontSize: 11 }}>#{row.invoice_id}</span></Td>
                                    <Td><Pill tone="--app-warning">{row.currency}</Pill></Td>
                                    <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 10 }}>{Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></Td>
                                    <Td align="right"><span className="font-mono tabular-nums" style={{ fontSize: 10, color: 'var(--app-muted-foreground)' }}>{Number(row.booking_rate).toFixed(6)}</span></Td>
                                </tr>
                            ))}
                            {count > 25 && (
                                <tr><td colSpan={4} className="px-3 py-2 text-[10px] italic text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                    … {count - 25} more not shown
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
