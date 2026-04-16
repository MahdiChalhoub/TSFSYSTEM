'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, PlayCircle, Plus, Loader2, Lock } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { useRouter } from 'next/navigation'

export function notifyPeriodChange() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsf:period-change'))
}

type BannerState =
    | { type: 'period_closed'; id: number; name: string; status: string; dates: string; yearLocked: boolean }
    | { type: 'no_period'; message: string }
    | null

export function PeriodWarningBanner() {
    const router = useRouter()
    const [state, setState] = useState<BannerState>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        erpFetch('fiscal-years/', { cache: 'no-store' })
            .then(data => {
                const years = Array.isArray(data) ? data : (data?.results || [])
                const now = new Date()
                let foundPeriod = false

                for (const y of years) {
                    for (const p of (y.periods || [])) {
                        const s = new Date(p.start_date), e = new Date(p.end_date)
                        if (now >= s && now <= e) {
                            foundPeriod = true
                            const st = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                            if (st !== 'OPEN') {
                                setState({
                                    type: 'period_closed', id: p.id, name: p.name, status: st,
                                    dates: `${s.toLocaleDateString()} — ${e.toLocaleDateString()}`,
                                    yearLocked: !!y.is_hard_locked,
                                })
                            }
                            return
                        }
                    }
                }

                // No period covers today — check if it's a partial year close
                if (!foundPeriod && years.length > 0) {
                    setState({
                        type: 'no_period',
                        message: 'No fiscal period covers the current date. Create a new fiscal year to continue posting transactions.',
                    })
                }
            })
            .catch(() => {})
    }, [])

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

    // ── Period exists but is closed/future ──
    const color = state.yearLocked ? 'var(--app-error)' : 'var(--app-warning)'

    return (
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
            ) : (
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
            )}
        </div>
    )
}
