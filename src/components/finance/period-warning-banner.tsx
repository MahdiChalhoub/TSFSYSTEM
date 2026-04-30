'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, PlayCircle, Plus, Loader2, Lock, Send, X, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { useRouter } from 'next/navigation'
import { requestReopenPeriod } from '@/app/actions/finance/fiscal-year'
import { runTimed } from '@/lib/perf-timing'

export function notifyPeriodChange() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsf:period-change'))
}

type BannerState =
    | { type: 'period_closed'; id: number; name: string; status: string; dates: string; yearLocked: boolean }
    // FY exists and covers today, but no period inside the FY does — offer to fill.
    | { type: 'fy_missing_periods'; fyId: number; fyName: string; fyDates: string }
    // No FY at all (or none covers today) — must create a fresh FY.
    | { type: 'no_period'; message: string }
    | null

export function PeriodWarningBanner({ isSuperuser = false }: { isSuperuser?: boolean } = {}) {
    const router = useRouter()
    const [state, setState] = useState<BannerState>(null)
    const [busy, setBusy] = useState(false)
    const [showRequestDialog, setShowRequestDialog] = useState(false)
    const [reason, setReason] = useState('')
    const [submitStatus, setSubmitStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

    useEffect(() => {
        loadState()
    }, [])

    function loadState() {
        erpFetch('fiscal-years/', { cache: 'no-store' })
            .then(data => {
                const years = Array.isArray(data) ? data : (data?.results || [])
                // Compare date-only (YYYY-MM-DD) — fiscal periods are date-only
                // but new Date() includes time, causing end-of-month mismatches
                const todayStr = new Date().toISOString().slice(0, 10)

                // Pass 1 — period covering today (the happy path).
                for (const y of years) {
                    for (const p of (y.periods || [])) {
                        if (todayStr >= p.start_date && todayStr <= p.end_date) {
                            const st = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                            if (st !== 'OPEN') {
                                setState({
                                    type: 'period_closed', id: p.id, name: p.name, status: st,
                                    dates: `${p.start_date} — ${p.end_date}`,
                                    yearLocked: !!y.is_hard_locked,
                                })
                            } else {
                                setState(null)
                            }
                            return
                        }
                    }
                }

                // Pass 2 — no period covers today, but is there an OPEN fiscal
                // YEAR that covers today? That means periods are missing inside
                // an otherwise-fine FY (common when the FY was created with
                // partial period generation). Offer to fill them in-place.
                const fyCoveringToday = years.find((y: any) =>
                    !y.is_hard_locked
                    && y.start_date && y.end_date
                    && todayStr >= y.start_date && todayStr <= y.end_date
                )
                if (fyCoveringToday) {
                    setState({
                        type: 'fy_missing_periods',
                        fyId: fyCoveringToday.id,
                        fyName: fyCoveringToday.name,
                        fyDates: `${fyCoveringToday.start_date} — ${fyCoveringToday.end_date}`,
                    })
                    return
                }

                if (years.length > 0) {
                    setState({
                        type: 'no_period',
                        message: 'No fiscal year covers the current date. Create a new fiscal year to continue posting transactions.',
                    })
                } else {
                    setState(null)
                }
            })
            .catch(() => {})
    }

    async function handleFillPeriods(fyId: number) {
        setBusy(true)
        try {
            const res = await runTimed(
                'finance.fiscal-years:fill-missing-periods',
                () => erpFetch(`fiscal-years/${fyId}/fill-missing-periods/`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                }),
            )
            const n = res?.created_count ?? 0
            if (n > 0) {
                toast.success(`Generated ${n} missing period${n === 1 ? '' : 's'}`)
            } else {
                toast.info('No missing periods to generate.')
            }
            notifyPeriodChange()
            loadState()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to generate periods')
        } finally {
            setBusy(false)
        }
    }

    const handleSubmitRequest = async () => {
        if (!state || state.type !== 'period_closed') return
        const r = reason.trim()
        if (!r) { setSubmitStatus({ kind: 'err', text: 'Please enter a reason.' }); return }
        setBusy(true)
        setSubmitStatus(null)
        const res = await requestReopenPeriod(state.id, r)
        setBusy(false)
        if (res.success) {
            setSubmitStatus({
                kind: 'ok',
                text: res.tasksCreated && res.tasksCreated > 0
                    ? `Request sent — ${res.tasksCreated} approver${res.tasksCreated === 1 ? '' : 's'} notified.`
                    : 'Request sent, but no approver rule is configured. Ask an admin to add an auto-task rule for "Fiscal Period Reopen Requested".',
            })
            setReason('')
        } else {
            setSubmitStatus({ kind: 'err', text: res.error || 'Failed to send request.' })
        }
    }

    if (!state) return null

    // ── No period at all — need new fiscal year ──
    if (state.type === 'no_period') {
        return (
            <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]"
                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, var(--app-bg))', borderBottom: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--app-error)', flexShrink: 0 }} />
                <span className="font-bold flex-1" style={{ color: 'var(--app-foreground)' }}>
                    {state.message}
                </span>
                <button onClick={() => router.push('/finance/fiscal-years')}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                    <Plus size={10} /> Create Fiscal Year
                </button>
            </div>
        )
    }

    // ── FY exists & covers today, but its periods don't — offer to fill them ──
    if (state.type === 'fy_missing_periods') {
        return (
            <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]"
                style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, var(--app-bg))', borderBottom: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />
                <span className="font-bold flex-1" style={{ color: 'var(--app-foreground)' }}>
                    Fiscal year <strong>{state.fyName}</strong> is open but has no period covering today. Generate the missing periods to continue posting.
                </span>
                <span className="font-medium hidden sm:inline" style={{ color: 'var(--app-muted-foreground)' }}>{state.fyDates}</span>
                <button disabled={busy} onClick={() => handleFillPeriods(state.fyId)}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                    {busy ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                    Generate Missing Periods
                </button>
                <button onClick={() => router.push('/finance/fiscal-years')}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                    style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                    Open Fiscal Years
                </button>
            </div>
        )
    }

    // ── Period exists but is closed/future ──
    const color = state.yearLocked ? 'var(--app-error)' : 'var(--app-warning)'

    return (
        <>
            <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]"
                style={{ background: `color-mix(in srgb, ${color} 8%, var(--app-bg))`, borderBottom: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
                {state.yearLocked
                    ? <Lock size={13} style={{ color, flexShrink: 0 }} />
                    : <AlertTriangle size={13} style={{ color, flexShrink: 0 }} />
                }
                <span className="font-bold flex-1" style={{ color: 'var(--app-foreground)' }}>
                    {state.yearLocked
                        ? <>Period <strong>{state.name}</strong> — fiscal year permanently closed</>
                        : <>Period <strong>{state.name}</strong> is {state.status} — transactions blocked</>
                    }
                </span>
                <span className="font-medium hidden sm:inline" style={{ color: 'var(--app-muted-foreground)' }}>{state.dates}</span>

                {state.yearLocked ? (
                    <button onClick={() => router.push('/finance/fiscal-years')}
                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        <Plus size={10} /> Create New Year
                    </button>
                ) : isSuperuser ? (
                    <button disabled={busy} onClick={async () => {
                        setBusy(true)
                        try {
                            await erpFetch(`fiscal-periods/${state.id}/`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'OPEN', is_closed: false }),
                            })
                        } catch {}
                        await new Promise(r => setTimeout(r, 300))
                        window.location.reload()
                    }}
                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        {busy ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />} Open Period
                    </button>
                ) : (
                    <button onClick={() => { setShowRequestDialog(true); setSubmitStatus(null) }}
                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        <Send size={10} /> Request to Open
                    </button>
                )}
            </div>

            {showRequestDialog && state.type === 'period_closed' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => !busy && setShowRequestDialog(false)}>
                    <div onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-4 py-3 flex items-center justify-between"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)' }}>
                            <div className="flex items-center gap-2">
                                <Send size={15} style={{ color: 'var(--app-warning)' }} />
                                <span className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>Request period reopen</span>
                            </div>
                            <button onClick={() => !busy && setShowRequestDialog(false)}
                                className="p-1 rounded-lg" style={{ color: 'var(--app-muted-foreground)' }}>
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-[11px] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                                Period <strong style={{ color: 'var(--app-foreground)' }}>{state.name}</strong> is {state.status}.
                                Your request will go to the configured approvers as a task and notification.
                            </p>
                            <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>Reason</span>
                                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} autoFocus
                                    placeholder="Why does this period need to be reopened?"
                                    disabled={busy}
                                    className="mt-1 w-full text-[12px] px-3 py-2 rounded-lg outline-none resize-none disabled:opacity-60"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </label>
                            {submitStatus && (
                                <div className="text-[11px] font-medium rounded-lg px-3 py-2"
                                    style={{
                                        background: `color-mix(in srgb, ${submitStatus.kind === 'ok' ? 'var(--app-success)' : 'var(--app-error)'} 10%, transparent)`,
                                        color: submitStatus.kind === 'ok' ? 'var(--app-success)' : 'var(--app-error)',
                                    }}>
                                    {submitStatus.text}
                                </div>
                            )}
                        </div>
                        <div className="px-4 py-3 flex items-center justify-end gap-2"
                            style={{ borderTop: '1px solid var(--app-border)' }}>
                            <button onClick={() => setShowRequestDialog(false)} disabled={busy}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg"
                                style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                {submitStatus?.kind === 'ok' ? 'Close' : 'Cancel'}
                            </button>
                            {submitStatus?.kind !== 'ok' && (
                                <button onClick={handleSubmitRequest} disabled={busy || !reason.trim()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                    Send request
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
