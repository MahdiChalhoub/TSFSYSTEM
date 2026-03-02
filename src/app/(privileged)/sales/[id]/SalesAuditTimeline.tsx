'use client'

import { useState, useEffect } from 'react'
import { getOrderAuditLog } from '@/app/actions/pos/sales-analytics'
import { ShieldCheck, Loader2 } from 'lucide-react'

interface AuditEntry {
    id: number
    action_type: string
    summary: string
    actor_name: string
    diff: Record<string, { before: string | null; after: string | null }>
    order_status_snap: string
    delivery_status_snap: string
    payment_status_snap: string
    invoice_status_snap: string
    extra: Record<string, unknown>
    created_at: string
}

const ACTION_COLORS: Record<string, string> = {
    ORDER_CONFIRMED: 'bg-emerald-500',
    ORDER_CLOSED: 'bg-gray-700',
    ORDER_CANCELLED: 'bg-rose-500',
    DELIVERY_DELIVERED: 'bg-blue-500',
    DELIVERY_PARTIAL: 'bg-sky-400',
    DELIVERY_RETURNED: 'bg-orange-400',
    PAYMENT_PAID: 'bg-violet-500',
    PAYMENT_PARTIAL: 'bg-violet-300',
    PAYMENT_WRITTEN_OFF: 'bg-rose-400',
    INVOICE_GENERATED: 'bg-indigo-500',
    INVOICE_SENT: 'bg-indigo-300',
    STOCK_RESERVED: 'bg-amber-400',
    STOCK_RELEASED: 'bg-amber-200',
    STOCK_DEDUCTED: 'bg-amber-500',
    FIELD_CHANGE: 'bg-gray-400',
    WORKFLOW_TRANSITION: 'bg-gray-500',
}

function formatLabel(s: string) {
    return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

export function SalesAuditTimeline({ orderId }: { orderId: string | number }) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getOrderAuditLog(orderId)
            .then(r => setEntries(r?.results ?? []))
            .catch(() => setEntries([]))
            .finally(() => setLoading(false))
    }, [orderId])

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader2 size={14} className="animate-spin" />
                Loading audit trail…
            </div>
        )
    }

    if (!entries.length) {
        return (
            <div className="text-xs text-gray-400 italic py-4 text-center">
                No audit entries yet for this order.
            </div>
        )
    }

    return (
        <div className="relative pl-4">
            {/* Vertical rail */}
            <div className="absolute left-[1.35rem] top-2 bottom-2 w-0.5 bg-gray-100 rounded-full" />

            <ol className="space-y-4">
                {entries.map((entry) => {
                    const dot = ACTION_COLORS[entry.action_type] ?? 'bg-gray-300'
                    const hasDiff = entry.diff && Object.keys(entry.diff).length > 0
                    return (
                        <li key={entry.id} className="relative flex items-start gap-3">
                            {/* Dot */}
                            <div className={`relative z-10 mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${dot} ring-2 ring-white`} />

                            <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="text-xs font-black text-gray-800">
                                            {formatLabel(entry.action_type)}
                                        </span>
                                        {entry.actor_name && (
                                            <span className="text-[10px] text-gray-400 ml-2">
                                                by {entry.actor_name}
                                            </span>
                                        )}
                                    </div>
                                    <time className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                                        {new Date(entry.created_at).toLocaleString('fr-FR', {
                                            day: '2-digit', month: '2-digit',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </time>
                                </div>

                                {entry.summary && (
                                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                        {entry.summary}
                                    </p>
                                )}

                                {/* Diff pills */}
                                {hasDiff && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {Object.entries(entry.diff).map(([field, delta]) => (
                                            <span
                                                key={field}
                                                className="inline-flex items-center gap-1 text-[10px] bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5"
                                            >
                                                <span className="font-mono text-gray-500">{field}</span>
                                                <span className="text-rose-400 line-through">{delta.before ?? '—'}</span>
                                                <span className="text-gray-300">→</span>
                                                <span className="text-emerald-600 font-bold">{delta.after ?? '—'}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* 4-axis snapshot badges (small) */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {[
                                        ['Order', entry.order_status_snap],
                                        ['Delivery', entry.delivery_status_snap],
                                        ['Payment', entry.payment_status_snap],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <span key={label} className="text-[9px] font-mono bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                                            {label}: {val}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
