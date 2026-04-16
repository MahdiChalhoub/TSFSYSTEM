'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, PlayCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updatePeriodStatus } from '@/app/actions/finance/fiscal-year'

export function PeriodWarningBanner() {
    const [warning, setWarning] = useState<{
        periodId: number; periodName: string; status: string
        startDate: string; endDate: string
    } | null>(null)
    const [loading, setLoading] = useState(false)

    const checkPeriod = useCallback(async () => {
        try {
            const { erpFetch } = await import('@/lib/erp-api')
            const data = await erpFetch('fiscal-years/', { cache: 'no-store' })
            const years = Array.isArray(data) ? data : (data?.results || [])
            const today = new Date()
            for (const y of years) {
                for (const p of (y.periods || [])) {
                    const start = new Date(p.start_date)
                    const end = new Date(p.end_date)
                    if (today >= start && today <= end) {
                        const status = p.status || (p.is_closed ? 'CLOSED' : 'OPEN')
                        if (status !== 'OPEN') {
                            setWarning({ periodId: p.id, periodName: p.name, status, startDate: start.toLocaleDateString(), endDate: end.toLocaleDateString() })
                        } else {
                            setWarning(null)
                        }
                        return
                    }
                }
            }
            setWarning(null)
        } catch { /* silent */ }
    }, [])

    useEffect(() => { checkPeriod() }, [checkPeriod])
    useEffect(() => { const i = setInterval(checkPeriod, 30000); return () => clearInterval(i) }, [checkPeriod])

    async function handleOpen() {
        if (!warning || loading) return
        const w = { ...warning }
        setLoading(true)
        try {
            await updatePeriodStatus(w.periodId, 'OPEN')
            toast.success(`${w.periodName} opened`)
            setWarning(null)
        } catch {
            // The PATCH may return 500 due to audit log conflict but the
            // data is actually saved. Re-check the real status.
            await checkPeriod()
        } finally {
            setLoading(false)
        }
    }

    if (!warning) return null

    return (
        <div className="flex items-center gap-3 px-4 py-1.5 text-[11px]"
            style={{
                background: 'color-mix(in srgb, var(--app-warning) 8%, var(--app-bg))',
                borderBottom: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)',
            }}>
            <AlertTriangle size={13} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />
            <span className="font-bold flex-1" style={{ color: 'var(--app-foreground)' }}>
                Period <strong>{warning.periodName}</strong> is {warning.status} — transactions blocked
            </span>
            <span className="font-medium hidden sm:inline" style={{ color: 'var(--app-muted-foreground)' }}>
                {warning.startDate} — {warning.endDate}
            </span>
            <button onClick={handleOpen} disabled={loading}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0 disabled:opacity-50"
                style={{ background: 'var(--app-primary)', color: 'white' }}>
                {loading ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />} Open Period
            </button>
        </div>
    )
}
