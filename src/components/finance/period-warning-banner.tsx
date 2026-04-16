'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, PlayCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
            const { erpFetch } = await import('@/lib/erp-api')
            // Direct API call — no server action, no routing issues
            await erpFetch(`fiscal-periods/${w.periodId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'OPEN', is_closed: false }),
            })
            toast.success(`${w.periodName} opened`)
            setWarning(null)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.includes('403') || msg.includes('permission') || msg.includes('Forbidden')) {
                // No permission — send task request
                try {
                    const { erpFetch: fetch2 } = await import('@/lib/erp-api')
                    await fetch2('tasks/', {
                        method: 'POST',
                        body: JSON.stringify({
                            title: `Open fiscal period: ${w.periodName}`,
                            description: `Period "${w.periodName}" (${w.startDate} — ${w.endDate}) is ${w.status}. Transactions blocked.`,
                            priority: 'HIGH', category: 'FINANCE',
                        }),
                    })
                    toast.success('Request sent to finance manager')
                    setWarning(null)
                } catch {
                    toast.info(`Please ask your finance manager to open ${w.periodName}`)
                    setWarning(null)
                }
            } else {
                toast.error(`Failed to open period: ${msg}`)
                // Re-check to see if it actually opened
                await checkPeriod()
            }
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
