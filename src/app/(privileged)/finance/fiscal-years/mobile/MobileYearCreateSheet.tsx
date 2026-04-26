'use client'

import { useState, useMemo } from 'react'
import { Calendar, ShieldCheck, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createFiscalYear } from '@/app/actions/finance/fiscal-year'

type Frequency = 'MONTHLY' | 'QUARTERLY'
type DefaultStatus = 'OPEN' | 'FUTURE' | 'LOCKED'

function isoToday(): string {
    return new Date().toISOString().split('T')[0]
}

function nextYearEnd(start: string): string {
    if (!start) return ''
    const d = new Date(start)
    d.setFullYear(d.getFullYear() + 1)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
}

function defaultName(start: string): string {
    if (!start) return ''
    return `FY ${new Date(start).getFullYear()}`
}

interface Props {
    onClose: () => void
}

export function MobileYearCreateSheet({ onClose }: Props) {
    const router = useRouter()
    const [start, setStart] = useState<string>(() => {
        // Default: 1st of current month, ISO
        const d = new Date(); d.setDate(1)
        return d.toISOString().split('T')[0]
    })
    const [end, setEnd] = useState<string>(() => nextYearEnd(isoToday()))
    const [name, setName] = useState<string>(() => defaultName(isoToday()))
    const [frequency, setFrequency] = useState<Frequency>('MONTHLY')
    const [periodStatus, setPeriodStatus] = useState<DefaultStatus>('FUTURE')
    const [includeAudit, setIncludeAudit] = useState<boolean>(true)
    const [submitting, setSubmitting] = useState(false)

    // Auto-derive end + name when start changes (unless user already touched them)
    const onStartChange = (v: string) => {
        setStart(v)
        // Heuristic: if end is empty OR matches the previous derivation, re-derive.
        const derivedEnd = nextYearEnd(v)
        if (!end || end === nextYearEnd(start)) setEnd(derivedEnd)
        if (!name || name === defaultName(start)) setName(defaultName(v))
    }

    const periodPreviewCount = useMemo(() => {
        if (!start || !end) return 0
        const s = new Date(start), e = new Date(end)
        const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
        const base = frequency === 'MONTHLY' ? months : Math.ceil(months / 3)
        return base + (includeAudit ? 1 : 0)
    }, [start, end, frequency, includeAudit])

    const canSubmit = name.trim() && start && end && new Date(end) > new Date(start) && !submitting

    const onSubmit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const res = await createFiscalYear({
                name: name.trim(),
                startDate: new Date(start),
                endDate: new Date(end),
                frequency,
                defaultPeriodStatus: periodStatus,
                includeAuditPeriod: includeAudit,
            })
            if (res.success) {
                toast.success(`${name} created with ${periodPreviewCount} periods.`)
                onClose()
                router.refresh()
            } else {
                toast.error(res.error || 'Failed to create fiscal year.')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-app-border/50">
                <div className="flex items-center gap-2">
                    <Calendar size={18} style={{ color: 'var(--app-primary)' }} />
                    <h2 className="font-bold text-tp-lg">New Fiscal Year</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-app-muted/50"
                    aria-label="Close">
                    <X size={18} />
                </button>
            </div>

            {/* Form body — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Name */}
                <label className="block">
                    <div className="text-tp-sm font-bold text-app-muted-foreground mb-1.5">
                        Name
                    </div>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-app-border bg-app-background text-app-foreground text-tp-md"
                        placeholder="FY 2026"
                    />
                </label>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                        <div className="text-tp-sm font-bold text-app-muted-foreground mb-1.5">
                            Start
                        </div>
                        <input
                            type="date"
                            value={start}
                            onChange={(e) => onStartChange(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-app-border bg-app-background text-app-foreground text-tp-md"
                        />
                    </label>
                    <label className="block">
                        <div className="text-tp-sm font-bold text-app-muted-foreground mb-1.5">
                            End
                        </div>
                        <input
                            type="date"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg border border-app-border bg-app-background text-app-foreground text-tp-md"
                        />
                    </label>
                </div>

                {/* Frequency */}
                <div>
                    <div className="text-tp-sm font-bold text-app-muted-foreground mb-1.5">
                        Period frequency
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {(['MONTHLY', 'QUARTERLY'] as Frequency[]).map(f => {
                            const active = frequency === f
                            return (
                                <button
                                    key={f}
                                    onClick={() => setFrequency(f)}
                                    className="px-3 py-2.5 rounded-lg border text-tp-md font-bold"
                                    style={{
                                        borderColor: active ? 'var(--app-primary)' : 'var(--app-border)',
                                        background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                        color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                    }}>
                                    {f === 'MONTHLY' ? 'Monthly (12)' : 'Quarterly (4)'}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Default period status */}
                <div>
                    <div className="text-tp-sm font-bold text-app-muted-foreground mb-1.5">
                        New periods start as
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {(['OPEN', 'FUTURE', 'LOCKED'] as DefaultStatus[]).map(s => {
                            const active = periodStatus === s
                            return (
                                <button
                                    key={s}
                                    onClick={() => setPeriodStatus(s)}
                                    className="px-2 py-2 rounded-lg border text-tp-sm font-bold"
                                    style={{
                                        borderColor: active ? 'var(--app-primary)' : 'var(--app-border)',
                                        background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                        color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                    }}>
                                    {s}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Audit period toggle */}
                <button
                    onClick={() => setIncludeAudit(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-app-border">
                    <div className="flex items-center gap-2.5 text-left">
                        <ShieldCheck size={16} style={{ color: 'var(--app-primary)' }} />
                        <div>
                            <div className="text-tp-md font-bold">Include 13th audit period</div>
                            <div className="text-tp-sm text-app-muted-foreground">
                                Adjustments after soft close
                            </div>
                        </div>
                    </div>
                    <div
                        className="w-10 h-6 rounded-full transition-colors relative"
                        style={{ background: includeAudit ? 'var(--app-primary)' : 'var(--app-border)' }}>
                        <div
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                            style={{ left: includeAudit ? '20px' : '2px' }} />
                    </div>
                </button>

                {/* Preview */}
                <div
                    className="px-3 py-2 rounded-lg text-tp-sm"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
                    Will create <strong>{periodPreviewCount}</strong> {periodPreviewCount === 1 ? 'period' : 'periods'}
                    {includeAudit && periodPreviewCount > 0 ? ' (incl. audit)' : ''}.
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-app-border/50 p-3 bg-app-background sticky bottom-0">
                <button
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    className="w-full py-3 rounded-lg font-bold text-tp-md flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-primary-foreground, white)' }}>
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    {submitting ? 'Creating…' : 'Create Fiscal Year'}
                </button>
            </div>
        </div>
    )
}
