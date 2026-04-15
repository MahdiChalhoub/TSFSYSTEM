'use client'

import { useState, useEffect, useTransition } from 'react'
import { AlertTriangle, PlayCircle, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Global sticky banner — shows when the current fiscal period is not OPEN.
 * One button: "Open" if user has permission, "Request" if not.
 * Disappears after action without page refresh.
 */
export function PeriodWarningBanner() {
    const [warning, setWarning] = useState<{
        periodId: number; periodName: string; status: string
        startDate: string; endDate: string
    } | null>(null)
    const [isPending, startTransition] = useTransition()
    const [done, setDone] = useState(false)

    useEffect(() => {
        checkCurrentPeriod()
    }, [])

    async function checkCurrentPeriod() {
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
                            setWarning({
                                periodId: p.id, periodName: p.name, status,
                                startDate: start.toLocaleDateString(),
                                endDate: end.toLocaleDateString(),
                            })
                        }
                        return
                    }
                }
            }
        } catch {
            // Silent
        }
    }

    function handleAction() {
        if (!warning) return
        startTransition(async () => {
            // Try to open directly first
            try {
                const { updatePeriodStatus } = await import('@/app/actions/finance/fiscal-year')
                await updatePeriodStatus(warning.periodId, 'OPEN')
                toast.success(`${warning.periodName} opened`)
                setDone(true)
                setWarning(null)
                return
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err)
                // If permission denied, send a request instead
                if (msg.includes('403') || msg.includes('permission') || msg.includes('forbidden') || msg.includes('Forbidden')) {
                    try {
                        const { erpFetch } = await import('@/lib/erp-api')
                        await erpFetch('tasks/', {
                            method: 'POST',
                            body: JSON.stringify({
                                title: `Open fiscal period: ${warning.periodName}`,
                                description: `Period "${warning.periodName}" (${warning.startDate} — ${warning.endDate}) is ${warning.status}. Transactions are blocked. Requested by user.`,
                                priority: 'HIGH',
                                category: 'FINANCE',
                            }),
                        })
                        toast.success('Request sent to finance manager')
                    } catch {
                        toast.info(`Please ask your finance manager to open ${warning.periodName}`)
                    }
                    setDone(true)
                    return
                }
                toast.error(msg)
            }
        })
    }

    if (!warning || done) return null

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
            <button onClick={handleAction} disabled={isPending}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                style={{ background: 'var(--app-primary)', color: 'white' }}>
                {isPending ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />} Open Period
            </button>
        </div>
    )
}
