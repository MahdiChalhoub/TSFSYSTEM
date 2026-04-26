'use client'

import { useState, useMemo, useCallback } from 'react'
import { Calendar, Plus, Layers, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileYearRow } from './MobileYearRow'
import { MobileYearDetailSheet } from './MobileYearDetailSheet'
import { hardLockFiscalYear } from '@/app/actions/finance/fiscal-year'

interface YearShape {
    id: number
    name: string
    startDate: string
    endDate: string
    status?: string
    isHardLocked?: boolean
    periods?: Array<{ id: number; name: string; status?: string; start_date: string; end_date: string }>
}

export function MobileFiscalYearsClient({ initialYears }: { initialYears: YearShape[] }) {
    const router = useRouter()
    const [years] = useState<YearShape[]>(initialYears)
    const [sheetYear, setSheetYear] = useState<YearShape | null>(null)
    const [actionYear, setActionYear] = useState<YearShape | null>(null)

    // KPI computation
    const stats = useMemo(() => {
        const open = years.filter(y => !y.isHardLocked && (y.status || 'OPEN') === 'OPEN').length
        const closed = years.filter(y => (y.status || 'OPEN') === 'CLOSED').length
        const finalized = years.filter(y => y.isHardLocked || y.status === 'FINALIZED').length
        const totalPeriods = years.reduce((s, y) => s + (y.periods?.length ?? 0), 0)
        return { total: years.length, open, closed, finalized, totalPeriods }
    }, [years])

    // Find the period covering today, for the "current period" KPI
    const today = new Date()
    const currentPeriod = useMemo(() => {
        for (const y of years) {
            for (const p of (y.periods || [])) {
                if (!p.start_date || !p.end_date) continue
                const s = new Date(p.start_date)
                const e = new Date(p.end_date)
                if (today >= s && today <= e) return { year: y, period: p }
            }
        }
        return null
    }, [years, today])

    // Sort: most recent first
    const sortedYears = useMemo(
        () => [...years].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
        [years]
    )

    // Handlers
    const openYear = useCallback((y: YearShape) => setSheetYear(y), [])
    const longPressYear = useCallback((y: YearShape) => setActionYear(y), [])
    const closeSheet = useCallback(() => setSheetYear(null), [])

    const onYearEndClose = useCallback(async (y: YearShape) => {
        // Mobile: simplified flow — call backend directly with confirmation toast.
        // Desktop has the full preview/dry-run modal; mobile keeps it tight.
        if (!confirm(`Run Year-End Close on ${y.name}? This is permanent and locks the year.`)) return
        const today = new Date()
        const yearEnd = new Date(y.endDate)
        let closeDate: string | undefined
        if (today < yearEnd) {
            const d = new Date(today); d.setDate(d.getDate() - 1)
            closeDate = d.toISOString().split('T')[0]
        }
        const res = await hardLockFiscalYear(y.id, closeDate)
        if (res.success) {
            toast.success(`${y.name} closed.`)
            setSheetYear(null)
            setActionYear(null)
            router.refresh()
        } else {
            toast.error(res.error || `Failed to close ${y.name}.`)
        }
    }, [router])

    const actionItems = useMemo(() => {
        if (!actionYear) return []
        const status = actionYear.isHardLocked ? 'FINALIZED' : (actionYear.status || 'OPEN')
        return [
            {
                key: 'open',
                label: 'View details',
                icon: <Calendar size={16} />,
                variant: 'grid' as const,
                onClick: () => { setActionYear(null); openYear(actionYear) },
            },
            ...(status === 'OPEN' ? [{
                key: 'close',
                label: 'Year-End Close',
                hint: 'Permanent',
                icon: <ShieldCheck size={16} />,
                onClick: () => onYearEndClose(actionYear),
            }] : []),
        ] as any
    }, [actionYear, openYear, onYearEndClose])

    return (
        <MobileMasterPage
            config={{
                title: 'Fiscal Years',
                subtitle: currentPeriod
                    ? `Now: ${currentPeriod.period.name}`
                    : `${stats.total} ${stats.total === 1 ? 'year' : 'years'}`,
                icon: <Calendar size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search years…',
                primaryAction: {
                    label: 'New Year',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    // Wizard isn't mobile-yet — direct user back to desktop for create flow.
                    onClick: () => toast.info('Open this page on desktop to create a new fiscal year — the wizard is desktop-only.'),
                },
                kpis: [
                    { label: 'Years', value: stats.total, icon: <Layers size={13} />, color: 'var(--app-primary)' },
                    { label: 'Open', value: stats.open, icon: <BarChart3 size={13} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'Closed', value: stats.closed, icon: <AlertTriangle size={13} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Finalized', value: stats.finalized, icon: <ShieldCheck size={13} />, color: 'var(--app-error, #ef4444)' },
                    { label: 'Periods', value: stats.totalPeriods, icon: <Calendar size={13} />, color: 'var(--app-info, #3b82f6)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} {stats.total === 1 ? 'year' : 'years'}</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.totalPeriods} periods</span>
                    </>
                ),
                onRefresh: async () => {
                    router.refresh()
                    await new Promise(r => setTimeout(r, 600))
                },
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={actionYear !== null}
                        onClose={() => setActionYear(null)}
                        title={actionYear?.name}
                        subtitle={actionYear ? `${actionYear.startDate} → ${actionYear.endDate}` : undefined}
                        items={actionItems}
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetYear !== null}
                    onClose={closeSheet}
                    initialSnap="full">
                    {sheetYear && (
                        <MobileYearDetailSheet
                            year={sheetYear}
                            onClose={closeSheet}
                            onYearEndClose={() => onYearEndClose(sheetYear)}
                            onSoftClose={() => toast.info('Soft Close is desktop-only for now.')}
                        />
                    )}
                </MobileBottomSheet>
            }
        >
            {({ searchQuery }) => {
                const q = searchQuery.trim().toLowerCase()
                const filtered = q
                    ? sortedYears.filter(y =>
                        y.name.toLowerCase().includes(q) ||
                        (y.startDate || '').includes(q) ||
                        (y.endDate || '').includes(q)
                    )
                    : sortedYears

                if (filtered.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Calendar size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground mb-1">
                                {q ? 'No matching years' : 'No fiscal years yet'}
                            </p>
                            <p className="text-tp-md text-app-muted-foreground max-w-xs">
                                {q ? 'Try a different search.' : 'Open this page on desktop to create your first fiscal year.'}
                            </p>
                        </div>
                    )
                }

                return (
                    <div className="space-y-2">
                        {filtered.map(y => (
                            <MobileYearRow
                                key={y.id}
                                year={y}
                                onTap={() => openYear(y)}
                                onLongPress={() => longPressYear(y)}
                            />
                        ))}
                    </div>
                )
            }}
        </MobileMasterPage>
    )
}
