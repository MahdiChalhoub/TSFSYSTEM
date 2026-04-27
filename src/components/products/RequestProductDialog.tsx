'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShoppingCart, ArrowRightLeft, X, Loader2, ExternalLink } from 'lucide-react'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import { createProcurementRequest, getSuggestedQuantity } from '@/app/actions/commercial/procurement-requests'
import { getPurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'

export type RequestableProduct = {
    id: number
    name: string
    sku?: string | null
    reorder_quantity?: number | string | null
    min_stock_level?: number | string | null
    procurement_status?: string | null
}

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

type Props = {
    open: boolean
    onClose: () => void
    requestType: 'PURCHASE' | 'TRANSFER'
    products: RequestableProduct[]
    onCreated?: () => void
}

const TYPE_META: Record<Props['requestType'], { label: string; verb: string; icon: typeof ShoppingCart; accent: string }> = {
    PURCHASE: { label: 'Purchase Request', verb: 'request to purchase', icon: ShoppingCart, accent: 'var(--app-info, #3b82f6)' },
    TRANSFER: { label: 'Transfer Request', verb: 'request to transfer', icon: ArrowRightLeft, accent: 'var(--app-warning, #f59e0b)' },
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
    { value: 'LOW', label: 'Low' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
]

function suggestQty(p: RequestableProduct, safetyMultiplier: number): number {
    const reorder = p.reorder_quantity != null ? Number(p.reorder_quantity) : NaN
    if (!isNaN(reorder) && reorder > 0) return Math.ceil(reorder)
    const min = p.min_stock_level != null ? Number(p.min_stock_level) : NaN
    if (!isNaN(min) && min > 0) return Math.ceil(min * safetyMultiplier)
    return 1
}

export function RequestProductDialog({ open, onClose, requestType, products, onCreated }: Props) {
    const meta = TYPE_META[requestType]
    const Icon = meta.icon
    const { backdropProps, contentProps } = useModalDismiss(open, onClose)
    const [quantities, setQuantities] = useState<Record<number, string>>({})
    const [priority, setPriority] = useState<Priority>('NORMAL')
    const [reason, setReason] = useState('')
    const [pending, startTransition] = useTransition()

    useEffect(() => {
        if (!open) return
        let cancelled = false
        ;(async () => {
            // Seed with placeholder formula immediately for fast first paint.
            const config = await getPurchaseAnalyticsConfig()
            if (cancelled) return
            const safety = Number(config.proposed_qty_safety_multiplier) || 1
            const seed: Record<number, string> = {}
            for (const p of products) seed[p.id] = String(suggestQty(p, safety))
            setQuantities(seed)

            // Refine each row with the honest formula from the backend.
            const refined = await Promise.all(
                products.map(p => getSuggestedQuantity(p.id).then(s => [p.id, s] as const)),
            )
            if (cancelled) return
            setQuantities(prev => {
                const next = { ...prev }
                for (const [id, s] of refined) {
                    if (s && s.suggested_qty > 0) next[id] = String(s.suggested_qty)
                }
                return next
            })
        })()
        return () => { cancelled = true }
    }, [open, products])

    if (!open) return null

    const submit = () => {
        const lines = products.map(p => ({ product: p, qty: Number(quantities[p.id]) || 0 })).filter(l => l.qty > 0)
        if (lines.length === 0) {
            toast.error('Set a quantity > 0 for at least one product')
            return
        }
        startTransition(async () => {
            let created = 0
            const failures: string[] = []
            for (const line of lines) {
                try {
                    await createProcurementRequest({
                        requestType,
                        productId: line.product.id,
                        quantity: line.qty,
                        priority,
                        reason: reason.trim() || undefined,
                    })
                    created++
                } catch (e: any) {
                    failures.push(`${line.product.name}: ${e?.message || 'failed'}`)
                }
            }
            if (created > 0) {
                toast.success(
                    `${created} ${requestType === 'PURCHASE' ? 'purchase' : 'transfer'} request${created === 1 ? '' : 's'} created`,
                    { description: 'Open requests list', action: { label: 'View →', onClick: () => { window.location.href = '/inventory/requests' } } }
                )
                onCreated?.()
                onClose()
            }
            if (failures.length > 0) {
                toast.error(`${failures.length} failed`, { description: failures.slice(0, 3).join('\n') })
            }
        })
    }

    return (
        <div
            {...backdropProps}
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        >
            <div
                {...contentProps}
                className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                <div
                    className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${meta.accent} 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: meta.accent, boxShadow: `0 4px 12px color-mix(in srgb, ${meta.accent} 30%, transparent)` }}
                        >
                            <Icon size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">{meta.label}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {products.length} product{products.length === 1 ? '' : 's'} · {meta.verb}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    <div
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: 'var(--app-border)' }}
                    >
                        <div
                            className="grid items-center gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                            style={{
                                gridTemplateColumns: '1fr 90px',
                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                color: 'var(--app-muted-foreground)',
                                borderBottom: '1px solid var(--app-border)',
                            }}
                        >
                            <div>Product</div>
                            <div className="text-right">Quantity</div>
                        </div>
                        {products.map((p, idx) => (
                            <div
                                key={p.id}
                                className="grid items-center gap-2 px-3 py-2"
                                style={{
                                    gridTemplateColumns: '1fr 90px',
                                    borderBottom: idx === products.length - 1 ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}
                            >
                                <div className="min-w-0">
                                    <div className="text-[12px] font-bold text-app-foreground truncate">{p.name}</div>
                                    {p.sku && <div className="text-[10px] font-mono text-app-muted-foreground truncate">{p.sku}</div>}
                                </div>
                                <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={quantities[p.id] ?? ''}
                                    onChange={e => setQuantities(q => ({ ...q, [p.id]: e.target.value }))}
                                    className="text-right tabular-nums w-full text-[12px] font-mono font-bold px-2.5 py-1.5 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40"
                                />
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Priority</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as Priority)}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40"
                            >
                                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Reason (optional)</label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={2}
                            placeholder="Why is this needed?"
                            className="w-full text-[12px] font-medium px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40 resize-none"
                        />
                    </div>
                </div>

                <div
                    className="px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)' }}
                >
                    <Link
                        href="/inventory/requests"
                        className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-colors"
                    >
                        <ExternalLink size={11} /> View existing requests
                    </Link>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={pending}
                            className="text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={pending}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            style={{
                                background: meta.accent,
                                boxShadow: `0 2px 8px color-mix(in srgb, ${meta.accent} 25%, transparent)`,
                            }}
                        >
                            {pending ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                            {pending ? 'Creating…' : `Create ${products.length === 1 ? 'request' : `${products.length} requests`}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
