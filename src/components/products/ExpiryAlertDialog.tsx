'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { BellRing, X, Loader2, ExternalLink, AlertTriangle, Clock, Skull } from 'lucide-react'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import { createExpiryAlert } from '@/app/actions/inventory/expiry-alerts'

type Props = {
    open: boolean
    onClose: () => void
    productId: number
    productName: string
    productSku?: string | null
    onCreated?: (alertId: number) => void
}

const todayISO = () => new Date().toISOString().slice(0, 10)

function projectSeverity(expiryISO: string): { label: string; color: string; icon: typeof Clock } {
    if (!expiryISO) return { label: '—', color: 'var(--app-muted-foreground)', icon: Clock }
    const days = Math.floor((new Date(expiryISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days <= 0) return { label: `Expired (${Math.abs(days)}d ago)`, color: 'var(--app-error, #ef4444)', icon: Skull }
    if (days <= 30) return { label: `Critical (${days}d)`, color: 'var(--app-warning, #f59e0b)', icon: AlertTriangle }
    return { label: `Warning (${days}d)`, color: 'var(--app-info, #3b82f6)', icon: Clock }
}

export function ExpiryAlertDialog({ open, onClose, productId, productName, productSku, onCreated }: Props) {
    const { backdropProps, contentProps } = useModalDismiss(open, onClose)
    const [quantity, setQuantity] = useState<string>('1')
    const [expiryDate, setExpiryDate] = useState<string>('')
    const [batchNumber, setBatchNumber] = useState<string>('')
    const [notes, setNotes] = useState<string>('')
    const [pending, startTransition] = useTransition()

    useEffect(() => {
        if (!open) return
        // Reset form when reopening
        setQuantity('1')
        setExpiryDate('')
        setBatchNumber('')
        setNotes('')
    }, [open, productId])

    if (!open) return null

    const severity = projectSeverity(expiryDate)
    const SevIcon = severity.icon
    const qtyNum = Number(quantity)
    const validQty = !isNaN(qtyNum) && qtyNum > 0
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
    const canSubmit = validQty && validDate && !pending

    const submit = () => {
        if (!canSubmit) {
            if (!validQty) toast.error('Quantity must be > 0')
            else if (!validDate) toast.error('Pick an expiry date')
            return
        }
        startTransition(async () => {
            const r = await createExpiryAlert({
                productId,
                quantity: qtyNum,
                expiryDate,
                batchNumber: batchNumber.trim() || undefined,
                notes: notes.trim() || undefined,
            })
            if (r.success) {
                toast.success(
                    `Alert created (${r.severity || 'queued'})`,
                    {
                        description: `${qtyNum} pcs · expires ${expiryDate}`,
                        action: { label: 'View →', onClick: () => { window.location.href = `/inventory/expiry-alerts?product=${productId}` } },
                    },
                )
                onCreated?.(r.alert_id || 0)
                onClose()
            } else {
                toast.error(r.message || 'Failed to create alert')
            }
        })
    }

    const accent = 'var(--app-error, #ef4444)'

    return (
        <div
            {...backdropProps}
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        >
            <div
                {...contentProps}
                className="w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${accent} 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: accent, boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 30%, transparent)` }}>
                            <BellRing size={15} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-app-foreground">New Expiry Alert</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground truncate">
                                {productName}{productSku && ` · ${productSku}`}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0"
                        aria-label="Close">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Quantity expiring
                            </label>
                            <input
                                type="number"
                                min={0}
                                step="any"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="w-full text-[13px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40 tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Expiry date
                            </label>
                            <input
                                type="date"
                                value={expiryDate}
                                min={todayISO()}
                                onChange={e => setExpiryDate(e.target.value)}
                                className="w-full text-[13px] font-mono px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40"
                            />
                        </div>
                    </div>

                    {/* Severity preview */}
                    {validDate && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: `color-mix(in srgb, ${severity.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${severity.color} 25%, transparent)` }}>
                            <SevIcon size={14} style={{ color: severity.color }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: severity.color }}>
                                {severity.label}
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                            Batch number (optional)
                        </label>
                        <input
                            type="text"
                            value={batchNumber}
                            onChange={e => setBatchNumber(e.target.value)}
                            placeholder="Auto-generated if blank"
                            className="w-full text-[12px] font-mono px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                            Notes (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="What did you observe?"
                            className="w-full text-[12px] font-medium px-2.5 py-2 bg-app-bg border border-app-border/60 rounded-lg text-app-foreground outline-none focus:border-app-primary/40 resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between gap-2 flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)' }}>
                    <Link
                        href={`/inventory/expiry-alerts?product=${productId}`}
                        className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-colors"
                    >
                        <ExternalLink size={11} /> View existing alerts
                    </Link>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} disabled={pending}
                            className="text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50">
                            Cancel
                        </button>
                        <button type="button" onClick={submit} disabled={!canSubmit}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                            style={{ background: accent, boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 25%, transparent)` }}>
                            {pending ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                            {pending ? 'Saving…' : 'Create alert'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
