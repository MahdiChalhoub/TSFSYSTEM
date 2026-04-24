'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Square, Loader2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCloseChecklist,
    toggleCloseChecklistItem,
    type CloseChecklistItem,
    type CloseChecklistReport,
} from '@/app/actions/finance/fiscal-year'

const CATEGORY_COLORS: Record<string, { bg: string, fg: string }> = {
    RECONCILIATION: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 14%, transparent)', fg: 'var(--app-info, #3b82f6)' },
    ACCRUALS:       { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 14%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
    INVENTORY:      { bg: 'color-mix(in srgb, var(--app-primary) 14%, transparent)', fg: 'var(--app-primary)' },
    FX:             { bg: 'color-mix(in srgb, #8b5cf6 14%, transparent)', fg: '#8b5cf6' },
    TAX:            { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 14%, transparent)', fg: 'var(--app-error, #ef4444)' },
    DEPRECIATION:   { bg: 'color-mix(in srgb, #06b6d4 14%, transparent)', fg: '#06b6d4' },
    REVIEW:         { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 14%, transparent)', fg: 'var(--app-success, #22c55e)' },
    OTHER:          { bg: 'color-mix(in srgb, var(--app-muted-foreground) 14%, transparent)', fg: 'var(--app-muted-foreground)' },
}

export function CloseChecklistPanel({ fiscalYearId }: { fiscalYearId: number }) {
    const [report, setReport] = useState<CloseChecklistReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<number | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setReport(await getCloseChecklist(fiscalYearId))
        } finally {
            setLoading(false)
        }
    }, [fiscalYearId])

    useEffect(() => { void load() }, [load])

    const toggle = async (item: CloseChecklistItem) => {
        setToggling(item.state_id)
        try {
            const res = await toggleCloseChecklistItem(fiscalYearId, item.state_id, !item.is_complete)
            if (!res.success) {
                toast.error(res.error || 'Toggle failed')
                return
            }
            // Optimistic update — refresh to pick up run status change
            await load()
            if (res.ready_to_close) {
                toast.success('All required items complete — ready to close')
            }
        } finally {
            setToggling(null)
        }
    }

    if (loading && !report) {
        return (
            <div className="p-6 text-center">
                <Loader2 size={18} className="animate-spin mx-auto" style={{ color: 'var(--app-muted-foreground)' }} />
            </div>
        )
    }

    if (!report) {
        return (
            <div className="p-6 text-center text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                Unable to load checklist.
            </div>
        )
    }

    const pct = report.total_items > 0 ? Math.round((report.completed_items / report.total_items) * 100) : 0

    return (
        <div className="p-3 space-y-3">
            {/* Header: progress + status + refresh */}
            <div className="rounded-xl p-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                        <div className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                            {report.template_name}
                        </div>
                        <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                            {report.completed_items}/{report.total_items} items · {report.required_missing} required remaining
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-tp-xxs font-bold"
                            style={{
                                background: report.ready_to_close
                                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 18%, transparent)'
                                    : 'color-mix(in srgb, var(--app-warning, #f59e0b) 18%, transparent)',
                                color: report.ready_to_close ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
                            }}>
                            {report.ready_to_close ? 'READY' : report.status}
                        </span>
                        <button onClick={() => void load()} disabled={loading}
                            className="p-1 rounded hover:opacity-70 disabled:opacity-30" title="Re-run auto-checks">
                            <RefreshCw size={14} style={{ color: 'var(--app-muted-foreground)' }}
                                className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-border)' }}>
                    <div className="h-full transition-all duration-300" style={{
                        width: `${pct}%`,
                        background: report.ready_to_close ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                    }} />
                </div>
            </div>

            {/* Items */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                {report.items.map((item, idx) => {
                    const cat = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER
                    const isLast = idx === report.items.length - 1
                    return (
                        <div key={item.state_id}
                            className="flex items-center gap-3 p-3 transition-colors"
                            style={{ borderBottom: isLast ? 'none' : '1px solid var(--app-border)' }}>
                            <button onClick={() => toggle(item)} disabled={toggling === item.state_id}
                                className="flex-shrink-0 disabled:opacity-50">
                                {toggling === item.state_id ? (
                                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--app-muted-foreground)' }} />
                                ) : item.is_complete ? (
                                    <CheckSquare size={18} style={{ color: 'var(--app-success, #22c55e)' }} />
                                ) : (
                                    <Square size={18} style={{ color: 'var(--app-muted-foreground)' }} />
                                )}
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-tp-xxs font-bold flex-shrink-0"
                                        style={{ background: cat.bg, color: cat.fg }}>
                                        {item.category}
                                    </span>
                                    <span className="text-tp-sm font-medium truncate"
                                        style={{
                                            color: item.is_complete ? 'var(--app-muted-foreground)' : 'var(--app-foreground)',
                                            textDecoration: item.is_complete ? 'line-through' : 'none',
                                        }}>
                                        {item.name}
                                    </span>
                                    {item.is_required && (
                                        <span className="text-tp-xxs font-bold flex-shrink-0"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>*</span>
                                    )}
                                </div>
                                {item.is_complete && item.completed_by && (
                                    <div className="text-tp-xxs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {item.auto_checked && <Sparkles size={9} className="inline -mt-0.5 mr-1" />}
                                        {item.auto_checked ? 'auto' : `by ${item.completed_by}`}
                                        {item.completed_at && ` · ${new Date(item.completed_at).toLocaleDateString()}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer guidance */}
            <div className="flex items-start gap-2 text-tp-xs px-1" style={{ color: 'var(--app-muted-foreground)' }}>
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                <div>
                    Items marked with <span style={{ color: 'var(--app-error, #ef4444)' }} className="font-bold">*</span> are required —
                    the fiscal-year close gate will refuse to finalize until every required item is checked.
                    Items with <Sparkles size={10} className="inline -mt-0.5" /> auto auto-tick when the system detects the underlying
                    state (e.g. FX revaluation posted, deferred-revenue release run).
                </div>
            </div>
        </div>
    )
}
