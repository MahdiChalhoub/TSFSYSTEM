'use client'

/**
 * SalesAuditTimeline — V2 themed rebuild
 * Uses --app-* CSS variables for full theme compatibility.
 */

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

// Maps action types to --app-* color semantic tokens (via inline style).
// We use the primary/success/danger palette from the active theme.
const ACTION_ACCENT: Record<string, string> = {
 ORDER_CONFIRMED: 'var(--app-primary)',
 ORDER_CLOSED: 'var(--app-muted-foreground)',
 ORDER_CANCELLED: '#f43f5e',
 DELIVERY_DELIVERED: 'var(--app-info)',
 DELIVERY_PARTIAL: '#38bdf8',
 DELIVERY_RETURNED: '#fb923c',
 PAYMENT_PAID: 'var(--app-primary)',
 PAYMENT_PARTIAL: 'var(--app-primary)',
 PAYMENT_WRITTEN_OFF: '#f43f5e',
 INVOICE_GENERATED: '#818cf8',
 INVOICE_SENT: '#a5b4fc',
 STOCK_RESERVED: 'var(--app-warning)',
 STOCK_RELEASED: '#fcd34d',
 STOCK_DEDUCTED: '#d97706',
 FIELD_CHANGE: 'var(--app-muted-foreground)',
 WORKFLOW_TRANSITION: 'var(--app-muted-foreground)',
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
 <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--app-muted-foreground)' }}>
 <Loader2 size={14} className="animate-spin" />
 Loading audit trail…
 </div>
 )
 }

 if (!entries.length) {
 return (
 <div className="flex flex-col items-center gap-2 py-6">
 <ShieldCheck size={22} style={{ color: 'var(--app-muted-foreground)' }} />
 <p className="text-xs italic" style={{ color: 'var(--app-muted-foreground)' }}>
 No audit entries yet for this order.
 </p>
 </div>
 )
 }

 return (
 <div className="relative pl-4">
 {/* Vertical rail */}
 <div
 className="absolute left-[1.35rem] top-2 bottom-2 w-0.5 rounded-full"
 style={{ background: 'var(--app-border)' }}
 />

 <ol className="space-y-4">
 {entries.map((entry) => {
 const accent = ACTION_ACCENT[entry.action_type] ?? 'var(--app-muted-foreground)'
 const hasDiff = entry.diff && Object.keys(entry.diff).length > 0
 return (
 <li key={entry.id} className="relative flex items-start gap-3">
 {/* Dot */}
 <div
 className="relative z-10 mt-1 w-3 h-3 rounded-full flex-shrink-0"
 style={{
 background: accent,
 boxShadow: `0 0 0 2px var(--app-background)`,
 }}
 />

 <div
 className="flex-1 min-w-0 rounded-xl p-3"
 style={{
 background: 'var(--app-surface-2)',
 border: '1px solid var(--app-border)',
 }}
 >
 <div className="flex items-start justify-between gap-2">
 <div>
 <span className="text-xs font-black" style={{ color: 'var(--app-foreground)' }}>
 {formatLabel(entry.action_type)}
 </span>
 {entry.actor_name && (
 <span className="text-[10px] ml-2" style={{ color: 'var(--app-muted-foreground)' }}>
 by {entry.actor_name}
 </span>
 )}
 </div>
 <time className="text-[10px] flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--app-muted-foreground)' }}>
 {new Date(entry.created_at).toLocaleString('fr-FR', {
 day: '2-digit', month: '2-digit',
 hour: '2-digit', minute: '2-digit'
 })}
 </time>
 </div>

 {entry.summary && (
 <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
 {entry.summary}
 </p>
 )}

 {/* Diff pills */}
 {hasDiff && (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {Object.entries(entry.diff).map(([field, delta]) => (
 <span
 key={field}
 className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5"
 style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
 >
 <span className="font-mono" style={{ color: 'var(--app-muted-foreground)' }}>{field}</span>
 <span className="line-through" style={{ color: '#f43f5e' }}>{delta.before ?? '—'}</span>
 <span style={{ color: 'var(--app-muted-foreground)' }}>→</span>
 <span className="font-bold" style={{ color: 'var(--app-primary)' }}>{delta.after ?? '—'}</span>
 </span>
 ))}
 </div>
 )}

 {/* 4-axis snapshot badges */}
 <div className="mt-2 flex flex-wrap gap-1">
 {[
 ['Order', entry.order_status_snap],
 ['Delivery', entry.delivery_status_snap],
 ['Payment', entry.payment_status_snap],
 ].filter(([, v]) => v).map(([label, val]) => (
 <span
 key={label}
 className="text-[9px] font-mono rounded px-1.5 py-0.5"
 style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}
 >
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
