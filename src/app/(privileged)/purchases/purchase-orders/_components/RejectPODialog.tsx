'use client'

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { PORejectCategory } from '@/app/actions/pos/purchases'

const OPTIONS: { value: PORejectCategory; label: string; hint: string; tone: 'warn' | 'error' | 'info' }[] = [
    { value: 'PRICE_HIGH',      label: 'Price too high',      hint: 'Supplier quoted above target — auto-reissue will suggest renegotiation.', tone: 'warn' },
    { value: 'NO_STOCK',        label: 'Supplier has no stock', hint: 'Auto-reissue will suggest a different supplier.', tone: 'warn' },
    { value: 'EXPIRY_TOO_SOON', label: 'Expiry too close',   hint: 'Auto-reissue will request a fresher batch.', tone: 'warn' },
    { value: 'DAMAGED',         label: 'Damaged on receipt', hint: 'Auto-reissue will request replacement.', tone: 'error' },
    { value: 'NEEDS_REVISION',  label: 'Needs revision',     hint: 'Sends PO back to DRAFT — no reissue. Reviewer keeps editing this PO.', tone: 'info' },
    { value: 'OTHER',           label: 'Other',              hint: 'Describe in the note. Auto-reissue will fire with a generic hint.', tone: 'warn' },
]

export function RejectPODialog({
    open, poNumber, onClose, onConfirm,
}: {
    open: boolean
    poNumber?: string | null
    onClose: () => void
    onConfirm: (category: PORejectCategory, reason: string) => Promise<void> | void
}) {
    const [category, setCategory] = useState<PORejectCategory>('PRICE_HIGH')
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (!open) return null

    const opt = OPTIONS.find(o => o.value === category)!

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md mx-4 rounded-2xl border border-app-border shadow-2xl"
                 style={{ background: 'var(--app-surface)' }}
                 onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3 px-5 py-4 border-b border-app-border">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                         style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)' }}>
                        <AlertTriangle className="w-5 h-5" style={{ color: 'var(--app-error)' }} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-bold text-app-foreground">Reject {poNumber || 'Purchase Order'}</h2>
                        <p className="text-[11px] text-app-muted-foreground mt-0.5">
                            Choose a category — it drives whether the source request is auto-reissued.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-app-surface-hover">
                        <X className="w-4 h-4 text-app-muted-foreground" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1.5">
                            Reason category
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {OPTIONS.map(o => {
                                const active = o.value === category
                                return (
                                    <button key={o.value} type="button"
                                        onClick={() => setCategory(o.value)}
                                        className={`text-left px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                                            active
                                                ? 'border-app-primary bg-app-primary/10 text-app-foreground'
                                                : 'border-app-border bg-app-surface-hover/40 text-app-muted-foreground hover:text-app-foreground'
                                        }`}>
                                        {o.label}
                                    </button>
                                )
                            })}
                        </div>
                        <p className="mt-2 text-[10px] text-app-muted-foreground leading-relaxed">
                            {opt.hint}
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1.5">
                            Note {category === 'OTHER' ? '(required)' : '(optional)'}
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={3}
                            placeholder={
                                category === 'PRICE_HIGH' ? 'e.g. Quote was 18% above last accepted price'
                                : category === 'NEEDS_REVISION' ? 'What should the reviewer change?'
                                : 'Add context for whoever picks this up next'
                            }
                            className="w-full px-2.5 py-2 rounded-md border border-app-border bg-app-background text-[12px] text-app-foreground placeholder:text-app-muted-foreground/60 focus:outline-none focus:border-app-primary"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border">
                    <button onClick={onClose} disabled={submitting}
                            className="px-3 py-1.5 rounded-md text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface-hover">
                        Cancel
                    </button>
                    <button
                        disabled={submitting || (category === 'OTHER' && !reason.trim())}
                        onClick={async () => {
                            setSubmitting(true)
                            try { await onConfirm(category, reason.trim()) }
                            finally { setSubmitting(false) }
                        }}
                        className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-50"
                        style={{ background: 'var(--app-error)', color: 'white' }}>
                        {submitting ? 'Submitting…' : (category === 'NEEDS_REVISION' ? 'Send back to draft' : 'Reject')}
                    </button>
                </div>
            </div>
        </div>
    )
}
