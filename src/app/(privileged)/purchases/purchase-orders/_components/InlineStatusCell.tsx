'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Loader2, X, Check, ArrowRightCircle } from 'lucide-react'
import { submitPO, approvePO, cancelPO, sendToSupplier, completePO, revertToDraft, rejectPO, transitionPO, type PORejectCategory } from '@/app/actions/pos/purchases'
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

export function InlineStatusCell({ po, onRefresh, onLocalUpdate }: {
    po: PO
    onRefresh?: () => void
    /** Patch a single PO in the parent list without a full refetch.
     *  Saves N network roundtrips when the user transitions multiple
     *  rows in quick succession — the chip updates from `setLiveStatus`
     *  here, the parent row updates from this hook, no GET needed. */
    onLocalUpdate?: (id: number | string, patch: Record<string, any>) => void
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [rejectOpen, setRejectOpen] = useState(false)
    /* Locally-tracked status — starts from the row's snapshot but lets us
     * re-sync from a fresh fetch when the dropdown opens or after a stale-
     * state error. Without this, the dropdown could keep building transitions
     * from a status the DB has already advanced past. */
    const [liveStatus, setLiveStatus] = useState<string>(po.status)
    useEffect(() => { setLiveStatus(po.status) }, [po.status])
    const ref = useRef<HTMLDivElement>(null)
    const sc = STATUS_CONFIG[liveStatus] || { label: liveStatus, color: 'var(--app-muted-foreground)' }
    const transitions = VALID_TRANSITIONS[liveStatus] || []

    /* Pull the latest status when the user opens the dropdown. Cheap (single
     * GET, no payload mutation) and prevents the "I clicked CONFIRMED→TRANSIT
     * but the row had already moved to PARTIALLY_RECEIVED" trap. */
    const refreshStatus = async () => {
        try {
            const { erpFetch } = await import('@/lib/erp-api')
            const fresh: any = await erpFetch(`purchase-orders/${po.id}/`)
            if (fresh?.status && fresh.status !== liveStatus) {
                setLiveStatus(fresh.status)
            }
        } catch { /* keep current state on failure */ }
    }
    const openDropdown = () => {
        if (transitions.length === 0) return
        setOpen(true)
        refreshStatus()
    }

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
                    /* Prefer the dedicated endpoint if one exists — those carry
                     * richer side effects (number promotion on submit, supplier
                     * notification on send, etc.). For the in-the-middle stages
                     * that lack a dedicated action (CONFIRMED, IN_TRANSIT,
                     * PARTIALLY_RECEIVED, RECEIVED, INVOICED), use the generic
                     * `transitionPO` which routes through the model's
                     * VALID_TRANSITIONS validator and per-stage book-keeping. */
                    const action = STATUS_ACTIONS[t]
                    if (action) return action(po.id)
                    return transitionPO(po.id, t)
                },
            )
            toast.success(`${po.po_number || `PO-${po.id}`} → ${(STATUS_CONFIG[t]?.label || t)}`)
            setLiveStatus(t)
            // Prefer a local patch — no roundtrip, instant. Fall back to
            // a full refetch only if the parent didn't wire onLocalUpdate
            // (legacy callers).
            if (onLocalUpdate) {
                onLocalUpdate(po.id, { status: t })
            } else {
                onRefresh?.()
            }
        } catch (e: any) {
            /* Stale-state recovery: backend returns `current_status` in the
             * 400 payload. If our cached state was wrong, sync silently and
             * tell the operator the row has advanced — much cleaner than
             * the raw "Cannot transition from X to Y" error. */
            const actual: string | undefined =
                e?.body?.current_status ||
                e?.response?.current_status ||
                e?.data?.current_status
            if (actual && actual !== liveStatus) {
                setLiveStatus(actual)
                toast.info(
                    `${po.po_number || `PO-${po.id}`} has advanced to ${(STATUS_CONFIG[actual]?.label || actual)}`,
                    { description: 'Status was out of sync — refreshed to the live value.' },
                )
                onRefresh?.()
            } else {
                toast.error(e?.message || 'Transition failed')
            }
        }
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
                onClick={() => open ? setOpen(false) : openDropdown()}
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
