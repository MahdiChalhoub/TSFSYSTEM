'use client'

import React from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, PlayCircle, Bell, FileText, Ban } from 'lucide-react'
import {
    approveProcurementRequest, rejectProcurementRequest,
    executeProcurementRequest, cancelProcurementRequest,
    convertProcurementRequestToPO, bumpProcurementRequest,
    type ProcurementRequestRecord,
} from '@/app/actions/inventory/procurement-requests'
import type { DajingoMenuItem } from '@/components/common/DajingoListView'
import { runTimed } from '@/lib/perf-timing'

type AsyncAction = (id: number) => Promise<{ success: boolean; message?: string }>

export function makeRunAction(
    startTransition: (fn: () => void | Promise<void>) => void,
    refresh: () => void,
) {
    return (id: number, action: AsyncAction, verb: string) => {
        startTransition(async () => {
            const r = await runTimed(
                `inventory.requests:${verb.toLowerCase()}`,
                () => action(id),
            )
            if (r.success) { toast.success(`${verb} successful`); refresh() }
            else toast.error(r.message || `${verb} failed`)
        })
    }
}

export function makeBulkAction(
    label: string,
    action: AsyncAction,
    startTransition: (fn: () => void | Promise<void>) => void,
    setSelectedIds: (s: Set<number>) => void,
    refresh: () => void,
) {
    return (ids: Iterable<number>) => {
        startTransition(async () => {
            const list = Array.from(ids)
            const results = await runTimed(
                `inventory.requests:bulk-${label.toLowerCase()}`,
                () => Promise.all(list.map(id => action(id))),
                { count: list.length },
            )
            const ok = results.filter(r => r.success).length
            const fail = results.length - ok
            if (ok > 0) toast.success(`${label} ${ok}`)
            if (fail > 0) toast.error(`${fail} failed`)
            setSelectedIds(new Set())
            refresh()
        })
    }
}

export function buildMenuActions(
    r: ProcurementRequestRecord,
    runAction: ReturnType<typeof makeRunAction>,
    startTransition: (fn: () => void | Promise<void>) => void,
    refresh: () => void,
): DajingoMenuItem[] {
    const items: DajingoMenuItem[] = []
    if (r.status === 'PENDING') {
        items.push({ label: 'Approve', icon: <CheckCircle2 size={12} className="text-app-info" />, onClick: () => runAction(r.id, approveProcurementRequest, 'Approve') })
        items.push({ label: 'Reject', icon: <XCircle size={12} className="text-app-error" />, onClick: () => runAction(r.id, rejectProcurementRequest, 'Reject') })
    }
    if (r.status === 'APPROVED' && r.request_type === 'PURCHASE') {
        items.push({
            label: 'Create PO', icon: <FileText size={12} className="text-app-primary" />,
            onClick: () => startTransition(async () => {
                const out = await convertProcurementRequestToPO(r.id)
                if (out.success) { toast.success('Draft PO created'); if (out.po_url) window.location.href = out.po_url }
                else toast.error(out.message || 'Convert failed')
            }),
        })
    }
    if (r.status === 'APPROVED') {
        items.push({ label: 'Execute', icon: <PlayCircle size={12} className="text-app-success" />, onClick: () => runAction(r.id, executeProcurementRequest, 'Execute') })
    }
    if ((r.status === 'PENDING' || r.status === 'APPROVED') && r.priority !== 'URGENT') {
        items.push({
            label: 'Bump priority', icon: <Bell size={12} style={{ color: 'var(--app-accent)' }} />,
            onClick: () => startTransition(async () => {
                const out = await runTimed(
                    'inventory.requests:bump',
                    () => bumpProcurementRequest({ requestId: r.id }),
                )
                if (out.success) {
                    toast.success(out.message || 'Bumped', {
                        description: out.po_hint,
                        duration: out.po_hint ? 6000 : 3000,
                    })
                    refresh()
                }
                else toast.error(out.message || 'Bump failed')
            }),
        })
    }
    if (r.status === 'PENDING' || r.status === 'APPROVED') {
        items.push({ label: 'Cancel', icon: <Ban size={12} className="text-app-muted-foreground" />, onClick: () => runAction(r.id, cancelProcurementRequest, 'Cancel'), separator: true })
    }
    return items
}

export const bulkBumpAll = (ids: Iterable<number>, startTransition: (fn: () => void | Promise<void>) => void, setSelectedIds: (s: Set<number>) => void, refresh: () => void) => {
    startTransition(async () => {
        const list = Array.from(ids)
        const results = await Promise.all(list.map(id => bumpProcurementRequest({ requestId: id })))
        const ok = results.filter(r => r.success).length
        const fail = results.length - ok
        if (ok > 0) toast.success(`Bumped ${ok} request${ok === 1 ? '' : 's'}`)
        if (fail > 0) toast.error(`${fail} failed`)
        setSelectedIds(new Set())
        refresh()
    })
}

export const bulkCancelAll = (ids: Iterable<number>, startTransition: (fn: () => void | Promise<void>) => void, setSelectedIds: (s: Set<number>) => void, refresh: () => void) => {
    startTransition(async () => {
        const list = Array.from(ids)
        const results = await Promise.all(list.map(id => cancelProcurementRequest(id)))
        const ok = results.filter(r => r.success).length
        const fail = results.length - ok
        if (ok > 0) toast.success(`Cancelled ${ok}`)
        if (fail > 0) toast.error(`${fail} failed`)
        setSelectedIds(new Set())
        refresh()
    })
}
