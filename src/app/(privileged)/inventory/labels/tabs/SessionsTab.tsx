'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import type { ComponentType } from 'react'
import { toast } from 'sonner'
import {
    History, Search, FileText, Clock, Printer, CheckCircle2, XCircle, Square,
    RotateCcw, Zap, User, Loader2, ShieldCheck, RefreshCw,
} from 'lucide-react'
import {
    cancelPrintSession, retryPrintSession, reprintExact, reprintRegenerate,
    approvePrintSession, listPrintSessions,
    type PrintSession, type PrintSessionActionResult,
} from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })

type SessionRow = PrintSession & {
    title?: string
    is_reprint?: boolean
    reprint_mode?: string
    trigger?: string
    total_products?: number
    assigned_to_name?: string
}

type SessionAction =
    | 'approve' | 'cancel' | 'retry' | 'reprint_exact' | 'reprint_regenerate'

interface Props {
    initialSessions: SessionRow[]
    onRefresh: () => void
}

export default function SessionsTab({ initialSessions, onRefresh }: Props) {
    const [isPending, startTransition] = useTransition()
    const [sessions, setSessions] = useState<SessionRow[]>(initialSessions)
    const [sessionSearch, setSessionSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const filtered = useMemo(() => {
        let list = sessions
        if (statusFilter) list = list.filter(s => s.status === statusFilter)
        if (sessionSearch) {
            const q = sessionSearch.toLowerCase()
            list = list.filter(s =>
                s.session_code?.toLowerCase().includes(q) ||
                s.title?.toLowerCase().includes(q))
        }
        return list
    }, [sessions, statusFilter, sessionSearch])

    const refreshSessions = useCallback(async () => {
        const res = await listPrintSessions()
        setSessions((res ?? []) as SessionRow[])
        onRefresh()
    }, [onRefresh])

    const doAction = useCallback((action: SessionAction, sessionId: number) => {
        startTransition(async () => {
            try {
                let res: PrintSessionActionResult | undefined
                switch (action) {
                    case 'approve': res = await approvePrintSession(sessionId); break
                    case 'cancel': res = await cancelPrintSession(sessionId); break
                    case 'retry': res = await retryPrintSession(sessionId); break
                    case 'reprint_exact': res = await reprintExact(sessionId); break
                    case 'reprint_regenerate': res = await reprintRegenerate(sessionId); break
                }
                if (res?.id || res?.session_code) {
                    toast.success(`${res.session_code} → ${res.status}`)
                    await refreshSessions()
                } else {
                    toast.error(res?.error || 'Action failed')
                }
            } catch { toast.error('Action failed') }
        })
    }, [refreshSessions])

    const statusBadge = (status: string | undefined) => {
        const map: Record<string, { color: string; icon: ComponentType<{ size?: number }>; label: string }> = {
            DRAFT: { color: '--app-muted-foreground', icon: FileText, label: 'Draft' },
            APPROVED: { color: '--app-info', icon: ShieldCheck, label: 'Approved' },
            QUEUED: { color: '--app-info', icon: Clock, label: 'Queued' },
            PRINTING: { color: '--app-warning', icon: Printer, label: 'Printing' },
            COMPLETED: { color: '--app-success', icon: CheckCircle2, label: 'Completed' },
            FAILED: { color: '--app-error', icon: XCircle, label: 'Failed' },
            CANCELLED: { color: '--app-muted-foreground', icon: Square, label: 'Cancelled' },
        }
        const m = (status ? map[status] : undefined) ?? map.DRAFT
        const Icon = m.icon
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                style={{ color: v(m.color), borderColor: `color-mix(in srgb, ${v(m.color)} 30%, transparent)`, ...soft(m.color, 8) }}>
                <Icon size={10} /> {m.label}
            </span>
        )
    }

    const triggerBadge = (trigger: string | undefined) => {
        if (trigger === 'MANUAL') return <span className="inline-flex items-center gap-1 text-[9px] font-bold text-app-muted-foreground"><User size={10} /> Manual</span>
        return <span className="inline-flex items-center gap-1 text-[9px] font-bold" style={{ color: v('--app-warning') }}><Zap size={10} /> Auto</span>
    }

    const statuses = ['', 'DRAFT', 'APPROVED', 'QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED']

    return (
        <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-app-border/50 bg-app-background shrink-0 flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-black text-app-foreground">Print Sessions</h3>
                <div className="flex items-center gap-2">
                    {/* Status chips */}
                    <div className="flex items-center gap-1">
                        {statuses.map(s => (
                            <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${statusFilter === s ? 'text-app-foreground' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                                style={statusFilter === s ? { ...soft('--app-primary', 12), color: v('--app-primary') } : {}}>
                                {s || 'All'}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted-foreground" />
                        <input type="text" value={sessionSearch} onChange={e => setSessionSearch(e.target.value)}
                            placeholder="Search..."
                            className="pl-8 pr-3 h-8 rounded-lg border border-app-border bg-app-surface text-[10px] font-semibold text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/20 outline-none w-[160px]" />
                    </div>
                </div>
            </div>

            {/* Column headers */}
            <div className="px-4 py-2 border-b border-app-border/30 flex items-center gap-3 text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider shrink-0">
                <span className="w-[110px]">Session</span>
                <span className="w-[50px] text-center">Trigger</span>
                <span className="w-[120px]">Date</span>
                <span className="w-[50px] text-center">Items</span>
                <span className="w-[70px] text-center">Labels</span>
                <span className="flex-1">Assigned</span>
                <span className="w-[90px] text-center">Status</span>
                <span className="w-[120px] text-center">Actions</span>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <History size={32} className="mx-auto text-app-muted-foreground opacity-20" />
                        <p className="text-[11px] text-app-muted-foreground mt-2">No sessions found</p>
                    </div>
                ) : filtered.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-app-border/20 hover:bg-app-background/50 transition-colors">
                        <div className="w-[110px]">
                            <span className="text-[11px] font-mono font-bold text-app-foreground block">{s.session_code}</span>
                            {s.is_reprint && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ ...soft('--app-warning', 10), color: v('--app-warning') }}>{s.reprint_mode === 'EXACT' ? 'EXACT' : 'REGEN'}</span>}
                        </div>
                        <span className="w-[50px] text-center">{triggerBadge(s.trigger)}</span>
                        <span className="w-[120px] text-[10px] text-app-muted-foreground">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                            <br /><span className="text-[9px]">{s.created_at ? new Date(s.created_at).toLocaleTimeString() : ''}</span>
                        </span>
                        <span className="w-[50px] text-center text-[12px] font-bold text-app-foreground">{s.total_products}</span>
                        <span className="w-[70px] text-center text-[11px] font-bold text-app-foreground">
                            {s.status === 'COMPLETED' ? `${s.total_labels}/${s.total_labels}` : `0/${s.total_labels}`}
                        </span>
                        <span className="flex-1 text-[10px] text-app-muted-foreground truncate">{s.assigned_to_name || '—'}</span>
                        <span className="w-[90px] text-center">{statusBadge(s.status)}</span>
                        <div className="w-[120px] flex items-center justify-center gap-1">
                            {s.status === 'DRAFT' && (
                                <button onClick={() => doAction('approve', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-info/10" title="Approve"><ShieldCheck size={13} style={{ color: v('--app-info') }} /></button>
                            )}
                            {s.status === 'FAILED' && <>
                                <button onClick={() => doAction('retry', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-warning/10" title="Retry"><RefreshCw size={13} style={{ color: v('--app-warning') }} /></button>
                                <button onClick={() => doAction('reprint_exact', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-primary/10" title="Exact Reprint"><RotateCcw size={13} style={{ color: v('--app-primary') }} /></button>
                            </>}
                            {s.status === 'COMPLETED' && <>
                                <button onClick={() => doAction('reprint_exact', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-primary/10" title="Exact Reprint"><RotateCcw size={13} style={{ color: v('--app-primary') }} /></button>
                                <button onClick={() => doAction('reprint_regenerate', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-warning/10" title="Regenerate"><RefreshCw size={13} style={{ color: v('--app-warning') }} /></button>
                            </>}
                            {s.status && !['COMPLETED', 'CANCELLED'].includes(s.status) && <button onClick={() => doAction('cancel', s.id)} disabled={isPending} className="p-1.5 rounded-lg hover:bg-app-error/10" title="Cancel"><XCircle size={13} className="text-app-error" /></button>}
                        </div>
                    </div>
                ))}
            </div>

            {isPending && <div className="px-4 py-2 border-t border-app-border/50 bg-app-background shrink-0 flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground"><Loader2 size={12} className="animate-spin" /> Processing...</div>}
        </div>
    )
}
