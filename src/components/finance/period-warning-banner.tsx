'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, PlayCircle, Loader2 } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

export function notifyPeriodChange() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('tsf:period-change'))
}

export function PeriodWarningBanner() {
    const [info, setInfo] = useState<{ id: number; name: string; status: string; dates: string } | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        erpFetch('fiscal-years/', { cache: 'no-store' })
            .then(data => {
                const years = Array.isArray(data) ? data : (data?.results || [])
                const now = new Date()
                for (const y of years) {
                    for (const p of (y.periods || [])) {
                        const s = new Date(p.start_date), e = new Date(p.end_date)
                        if (now >= s && now <= e) {
                            const st = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                            if (st !== 'OPEN') {
                                setInfo({ id: p.id, name: p.name, status: st, dates: `${s.toLocaleDateString()} — ${e.toLocaleDateString()}` })
                            }
                            return
                        }
                    }
                }
            })
            .catch(() => {})
    }, [])

    if (!info) return null

    return (
        <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]"
            style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, var(--app-bg))', borderBottom: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
            <AlertTriangle size={13} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />
            <span className="font-bold flex-1" style={{ color: 'var(--app-foreground)' }}>
                Period <strong>{info.name}</strong> is {info.status} — transactions blocked
            </span>
            <span className="font-medium hidden sm:inline" style={{ color: 'var(--app-muted-foreground)' }}>{info.dates}</span>
            <button disabled={busy} onClick={async () => {
                setBusy(true)
                try {
                    await erpFetch(`fiscal-periods/${info.id}/`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'OPEN', is_closed: false }),
                    })
                } catch (e) {
                    console.error('[BANNER] PATCH error:', e)
                }
                window.location.reload()
            }}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
                style={{ background: 'var(--app-primary)', color: 'white' }}>
                {busy ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />} Open Period
            </button>
        </div>
    )
}
