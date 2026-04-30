'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Loader2, X, Check, ArrowRightCircle } from 'lucide-react'
import { submitPO, approvePO, cancelPO, sendToSupplier, completePO, revertToDraft, rejectPO, type PORejectCategory } from '@/app/actions/pos/purchases'
import type { PO } from '../_lib/types'
import { STATUS_CONFIG } from '../_lib/constants'
import { RejectPODialog } from './RejectPODialog'
import { runTimed } from '@/lib/perf-timing'

const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['SENT', 'CANCELLED'],
    REJECTED: ['DRAFT'],
    SENT: ['CONFIRMED', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
    CONFIRMED: ['IN_TRANSIT', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
    IN_TRANSIT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: ['INVOICED', 'COMPLETED'],
    INVOICED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
}

const STATUS_ACTIONS: Record<string, (id: number | string) => Promise<any>> = {
    SUBMITTED: submitPO,
    APPROVED: approvePO,
    SENT: sendToSupplier,
    CANCELLED: cancelPO,
    COMPLETED: completePO,
    DRAFT: revertToDraft,
}

export function InlineStatusCell({ po, onRefresh }: { po: PO; onRefresh?: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [rejectOpen, setRejectOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
    const transitions = VALID_TRANSITIONS[po.status] || []

    useEffect(() => {
        if (!open) return
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [open])

    async function handleTransition(t: string) {
        // REJECTED needs the structured category dialog so the auto-reissue
        // signal gets the right hint downstream.
        if (t === 'REJECTED') {
            setOpen(false)
            setRejectOpen(true)
            return
        }
        setLoading(true); setOpen(false)
        try {
            await runTimed(
                `purchases.po:transition-${t.toLowerCase()}`,
                async () => {
                    const action = STATUS_ACTIONS[t]
                    if (action) return action(po.id)
                    const { erpFetch } = await import('@/lib/erp-api')
                    return erpFetch(`purchase-orders/${po.id}/`, { method: 'PATCH', body: JSON.stringify({ status: t }) })
                },
            )
            toast.success(`${po.po_number || `PO-${po.id}`} → ${(STATUS_CONFIG[t]?.label || t)}`)
            onRefresh?.()
        } catch (e: any) { toast.error(e?.message || 'Transition failed') }
        finally { setLoading(false) }
    }

    async function handleReject(category: PORejectCategory, reason: string) {
        setLoading(true)
        try {
            const res: any = await runTimed(
                'purchases.po:reject',
                () => rejectPO(po.id, reason, category),
                { category },
            )
            if (res?._reverted_to_draft) {
                toast.success(`${po.po_number || `PO-${po.id}`} sent back to draft for revision`)
            } else {
                toast.success(`${po.po_number || `PO-${po.id}`} rejected (${category})`)
            }
            setRejectOpen(false)
            onRefresh?.()
        } catch (e: any) {
            toast.error(e?.message || 'Reject failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
            <button
                onClick={() => transitions.length > 0 && setOpen(!open)}
                disabled={transitions.length === 0 || loading}
                className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded transition-all"
                style={{
                    color: sc.color,
                    background: `color-mix(in srgb, ${sc.color} 10%, transparent)`,
                    cursor: transitions.length > 0 ? 'pointer' : 'default',
                    border: transitions.length > 0 ? `1px solid color-mix(in srgb, ${sc.color} 20%, transparent)` : 'none',
                }}
            >
                {loading ? <Loader2 size={8} className="animate-spin" /> : null}
                {sc.label}
                {transitions.length > 0 && <ChevronDown size={7} className="opacity-50" />}
            </button>
            {open && (
                <div className="absolute z-50 left-0 top-full mt-1 w-44 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-100"
                    style={{ background: 'var(--app-surface)' }}>
                    <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">Transition to</div>
                    {transitions.map(t => {
                        const tc = STATUS_CONFIG[t] || { label: t, color: 'var(--app-muted-foreground)' }
                        return (
                            <button key={t} onClick={() => handleTransition(t)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold hover:bg-app-surface-hover transition-colors"
                                style={{ color: t === 'CANCELLED' ? 'var(--app-error)' : 'var(--app-foreground)' }}>
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                                {tc.label}
                                {t === 'CANCELLED' && <X size={9} className="ml-auto opacity-50" />}
                                {t === 'COMPLETED' && <Check size={9} className="ml-auto opacity-50" style={{ color: 'var(--app-success)' }} />}
                                {t === 'SUBMITTED' && <ArrowRightCircle size={9} className="ml-auto opacity-50" />}
                            </button>
                        )
                    })}
                </div>
            )}
            <RejectPODialog
                open={rejectOpen}
                poNumber={po.po_number || `PO-${po.id}`}
                onClose={() => setRejectOpen(false)}
                onConfirm={handleReject}
            />
        </div>
    )
}
