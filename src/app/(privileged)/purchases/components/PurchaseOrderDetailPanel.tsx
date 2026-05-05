'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
    X, Pencil, Bookmark, Layers, List, Truck, FileText, ExternalLink,
    Calendar, User, Hash, MapPin, CreditCard, Loader2, Package,
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { STATUS_CONFIG, type PurchaseOrderNode } from './PurchaseOrderRow'

/* ═══════════════════════════════════════════════════════════
 *  PO DETAIL PANEL — slots into TreeMasterPage's detailPanel.
 *  Tabs: Overview, Lines.
 *  Both opens in split / pinned / modal drawer automatically.
 * ═══════════════════════════════════════════════════════════ */

type Tab = 'overview' | 'lines'

function formatDate(iso?: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatMoney(v: number | string | null | undefined, currency = 'USD') {
    const n = Number(v || 0)
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)
    } catch {
        return `${n.toLocaleString()} ${currency}`
    }
}

interface DetailNode extends PurchaseOrderNode {
    purchase_sub_type?: string
    site_name?: string
}

interface PurchaseOrderDetailPanelProps {
    node: DetailNode
    initialTab?: Tab
    onClose: () => void
    onPin?: (node: DetailNode) => void
}

export function PurchaseOrderDetailPanel({
    node, initialTab, onClose, onPin,
}: PurchaseOrderDetailPanelProps) {
    const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'overview')
    useEffect(() => { setTab((initialTab as Tab) ?? 'overview') }, [node.id, initialTab])

    const status = STATUS_CONFIG[node.status] || { label: node.status, color: 'var(--app-muted-foreground)', icon: FileText }
    const StatusIcon = status.icon

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--app-surface)' }}>
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3"
                style={{
                    borderBottom: '1px solid var(--app-border)',
                    background: `color-mix(in srgb, ${status.color} 4%, var(--app-surface))`,
                }}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: status.color, boxShadow: `0 2px 8px color-mix(in srgb, ${status.color} 25%, transparent)` }}>
                        <StatusIcon size={13} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-tp-md truncate">
                            {node.po_number || `PO-${node.id}`}
                        </h3>
                        <p className="text-tp-xxs font-bold uppercase tracking-wider"
                            style={{ color: status.color }}>
                            {status.label}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/purchases/${node.id}`}
                        title="Open full page"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <ExternalLink size={12} />
                    </Link>
                    <Link href={`/purchases/${node.id}`} title="Edit"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <Pencil size={12} />
                    </Link>
                    {onPin && (
                        <button onClick={() => onPin(node)} title="Pin to sidebar"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-primary hover:bg-app-border/50 transition-all">
                            <Bookmark size={12} />
                        </button>
                    )}
                    <button onClick={onClose} title="Close"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                {[
                    { key: 'overview' as Tab, label: 'Overview', icon: <Layers size={11} /> },
                    { key: 'lines' as Tab, label: 'Lines', icon: <List size={11} /> },
                ].map(t => {
                    const active = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-tp-xxs font-bold uppercase tracking-wider transition-all"
                            style={active ? {
                                background: `color-mix(in srgb, ${status.color} 12%, transparent)`,
                                color: status.color,
                                border: `1px solid color-mix(in srgb, ${status.color} 30%, transparent)`,
                            } : {
                                background: 'transparent',
                                color: 'var(--app-muted-foreground)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            {t.icon}{t.label}
                        </button>
                    )
                })}
            </div>

            {/* Body */}
            {tab === 'overview' ? <OverviewTab node={node} /> : <LinesTab poId={node.id} currency={node.currency} />}
        </div>
    )
}

function OverviewTab({ node }: { node: DetailNode }) {
    const rows: [string, string | null | undefined, ReactNode][] = [
        ['Supplier',       node.supplier_display || node.supplier_name, <User size={11} />],
        ['Priority',       node.priority,                                <Hash size={11} />],
        ['Sub-type',       node.purchase_sub_type,                       <Layers size={11} />],
        ['Created',        formatDate(node.created_at),                  <Calendar size={11} />],
        ['Expected',       formatDate(node.expected_date),               <Truck size={11} />],
        ['Currency',       node.currency,                                <CreditCard size={11} />],
        ['Site',           node.site_name,                               <MapPin size={11} />],
    ]
    const visibleRows = rows.filter(([, v]) => v != null && v !== '')

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Amount tile */}
            <div className="rounded-2xl p-4"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                    border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                }}>
                <p className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>Total amount</p>
                <p className="font-black tabular-nums" style={{ fontSize: '26px', color: 'var(--app-foreground)' }}>
                    {formatMoney(node.total_amount, node.currency)}
                </p>
            </div>

            {visibleRows.map(([k, v, icon]) => (
                <div key={k} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        {icon}
                    </span>
                    <span className="text-tp-xxs font-bold uppercase tracking-wide w-20 flex-shrink-0"
                        style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                    <span className="text-tp-sm font-bold text-app-foreground flex-1 min-w-0 truncate">{v}</span>
                </div>
            ))}
        </div>
    )
}

interface POLine {
    id?: number
    product_name?: string
    name?: string
    sku?: string
    quantity?: number | string
    line_total?: number | string
    amount?: number | string
}

function LinesTab({ poId, currency }: { poId: number; currency?: string }) {
    const [lines, setLines] = useState<POLine[]>([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setErr(null)
        erpFetch(`purchase-orders/${poId}/`)
            .then((data: unknown) => {
                if (cancelled) return
                const obj = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {}
                const linesArr = Array.isArray(obj.lines) ? obj.lines : (Array.isArray(obj.items) ? obj.items : [])
                setLines(linesArr as POLine[])
                setLoading(false)
            })
            .catch((e: unknown) => {
                if (cancelled) return
                setErr(e instanceof Error ? e.message : 'Failed to load lines')
                setLoading(false)
            })
        return () => { cancelled = true }
    }, [poId])

    const total = useMemo(() => lines.reduce((s, l) => s + Number(l.line_total || l.amount || 0), 0), [lines])

    if (loading) return (
        <div className="flex-1 flex flex-col items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-app-primary mb-2" />
            <p className="text-tp-xs font-bold text-app-muted-foreground">Loading lines…</p>
        </div>
    )
    if (err) return (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-tp-sm font-bold" style={{ color: 'var(--app-error)' }}>{err}</p>
        </div>
    )
    if (lines.length === 0) return (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <Package size={22} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} className="mb-2" />
            <p className="text-tp-sm font-bold text-app-muted-foreground">No lines on this order.</p>
        </div>
    )

    return (
        <div className="flex-1 overflow-y-auto min-h-0">
            {lines.map((l, i) => (
                <div key={l.id || i}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-app-surface/60 transition-colors"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                        <Package size={11} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-tp-sm font-bold text-app-foreground truncate">
                            {l.product_name || l.name || `Item ${i + 1}`}
                        </p>
                        <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">
                            {l.sku || ''}{l.quantity != null && ` · Qty ${Number(l.quantity).toLocaleString()}`}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-tp-sm font-bold text-app-foreground tabular-nums">
                            {formatMoney(l.line_total || l.amount, currency)}
                        </p>
                    </div>
                </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 font-bold sticky bottom-0"
                style={{ background: 'var(--app-surface)', borderTop: '2px solid var(--app-border)' }}>
                <span className="text-tp-xxs uppercase tracking-wide text-app-muted-foreground">Total</span>
                <span className="text-tp-md tabular-nums text-app-foreground">{formatMoney(total, currency)}</span>
            </div>
        </div>
    )
}
