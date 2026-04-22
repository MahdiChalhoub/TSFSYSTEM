'use client'

/**
 * Manager Overview — Triage Room
 * ==============================
 * Philosophy: this page is not a report. It's a triage queue.
 *
 * A manager opens this to *act*, not to read stats. So every block here is a
 * decision they can take RIGHT NOW, not a number to admire. We replace the
 * KPI grid / leaderboard / stacked bars with:
 *
 *   1. A single status sentence at the top — no cards, just words.
 *   2. The Triage Queue — problems that need a human decision, each with
 *      inline actions. Sorted by urgency, not by recency.
 *   3. Team Load — one line per person showing who's free and who's buried,
 *      so reassignment is a single click away.
 *   4. Today's Pulse — a thin activity feed, closed by default when nothing
 *      new happened.
 *
 * Everything is computed client-side from /api/tasks/. No new endpoints.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
    Loader2, AlertTriangle, Clock, User, RefreshCcw, Zap, ChevronRight,
    Flame, CheckCircle2, ArrowRight, UserX, Inbox, Users, Activity,
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

type Task = {
    id: number
    title: string
    status: string
    priority: string
    due_date?: string
    created_at: string
    is_overdue?: boolean
    assigned_to?: number | null
    assigned_to_name?: string | null
    category_name?: string | null
    completed_at?: string | null
    source?: string
    points?: number
}

type UserRow = { id: number; username: string; first_name?: string; last_name?: string }

const fullName = (u?: UserRow | null) =>
    u ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username) : 'Unassigned'

const toIso = (d: Date) => d.toISOString().split('T')[0]
const shiftDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }

/** Human-friendly "X ago" for a past ISO timestamp. */
function relTime(iso: string | undefined, now: Date): string {
    if (!iso) return ''
    const d = new Date(iso)
    const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`
    return `${Math.floor(mins / (60 * 24))}d ago`
}

export default function ManagerDashboardPage() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [users, setUsers] = useState<UserRow[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true)
        try {
            const [t, u] = await Promise.all([
                erpFetch('tasks/?page_size=500').catch(() => []),
                erpFetch('users/').catch(() => []),
            ])
            const taskList = Array.isArray(t) ? t : (t as any)?.results ?? []
            const userList = Array.isArray(u) ? u : (u as any)?.results ?? []
            setTasks(taskList)
            setUsers(userList)
        } finally {
            setLoading(false); setRefreshing(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const userMap = useMemo(() => {
        const m = new Map<number, UserRow>()
        for (const u of users) m.set(u.id, u)
        return m
    }, [users])

    const today = new Date()
    const todayIso = toIso(today)
    const weekAgoIso = toIso(shiftDays(today, -7))

    /**
     * The heart of the page. For every open task we decide if it's a triage
     * item (needs the manager's eyes) and categorise the reason. Sorted with
     * the most decision-worthy items first:
     *   1. Overdue >7d (longest rot at the top)
     *   2. Overdue 3–7d
     *   3. Urgent with no assignee
     *   4. Urgent assigned but still pending
     *   5. Unassigned non-urgent (bottom of queue, shown only if capacity)
     */
    const triage = useMemo(() => {
        type Row = {
            task: Task
            kind: 'overdue-bad' | 'overdue' | 'urgent-unassigned' | 'urgent' | 'unassigned'
            detail: string
            severity: number
        }
        const rows: Row[] = []
        for (const t of tasks) {
            if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue
            if (t.is_overdue && t.due_date) {
                const days = Math.floor((today.getTime() - new Date(t.due_date).getTime()) / 86_400_000)
                if (days > 7) rows.push({ task: t, kind: 'overdue-bad', detail: `${days} days late`, severity: 100 + days })
                else if (days >= 3) rows.push({ task: t, kind: 'overdue', detail: `${days} days late`, severity: 80 + days })
                else if (days >= 1) rows.push({ task: t, kind: 'overdue', detail: `${days} day${days === 1 ? '' : 's'} late`, severity: 70 + days })
                continue
            }
            if (t.priority === 'URGENT' && !t.assigned_to) {
                rows.push({ task: t, kind: 'urgent-unassigned', detail: 'Urgent — no assignee', severity: 60 })
                continue
            }
            if (t.priority === 'URGENT') {
                rows.push({ task: t, kind: 'urgent', detail: `Urgent · ${t.assigned_to_name || 'assigned'}`, severity: 40 })
                continue
            }
            if (!t.assigned_to) {
                rows.push({ task: t, kind: 'unassigned', detail: 'No assignee', severity: 20 })
            }
        }
        rows.sort((a, b) => b.severity - a.severity)
        return rows
    }, [tasks, today])

    /**
     * Team load: per-user pending/overdue + completed this week. Used for
     * "who's buried, who's free" one-liners. Unassigned bucket shown as its
     * own row at the top when non-empty — that's also a decision.
     */
    const teamLoad = useMemo(() => {
        type Row = { user: UserRow | null; pending: number; overdue: number; completed7d: number }
        const m = new Map<number, Row>()
        for (const t of tasks) {
            const uid = t.assigned_to ?? 0
            if (!m.has(uid)) m.set(uid, { user: uid ? (userMap.get(uid) || null) : null, pending: 0, overdue: 0, completed7d: 0 })
            const row = m.get(uid)!
            if (t.status === 'COMPLETED') {
                const day = (t.completed_at || '').slice(0, 10)
                if (day && day >= weekAgoIso) row.completed7d++
            } else if (t.status !== 'CANCELLED') {
                row.pending++
                if (t.is_overdue) row.overdue++
            }
        }
        const rows = Array.from(m.values())
        rows.sort((a, b) => {
            // Unassigned bucket first if it has work; then by overdue, then pending
            const aKey = a.user ? 0 : 1
            const bKey = b.user ? 0 : 1
            if ((a.user === null) !== (b.user === null)) return aKey < bKey ? 1 : -1
            return (b.overdue - a.overdue) || (b.pending - a.pending) || (b.completed7d - a.completed7d)
        })
        return rows
    }, [tasks, userMap, weekAgoIso])

    /**
     * Pulse: last 8 events (completions + creations). Used for the compact
     * activity stream at the bottom. Skip cancelled noise.
     */
    const pulse = useMemo(() => {
        type Evt = { iso: string; kind: 'done' | 'new'; task: Task }
        const events: Evt[] = []
        for (const t of tasks) {
            if (t.status === 'COMPLETED' && t.completed_at) events.push({ iso: t.completed_at, kind: 'done', task: t })
            if (t.created_at) events.push({ iso: t.created_at, kind: 'new', task: t })
        }
        events.sort((a, b) => b.iso.localeCompare(a.iso))
        return events.slice(0, 8)
    }, [tasks])

    /** Top-line counts used for the single status sentence. */
    const summary = useMemo(() => {
        let fires = 0, pending = 0, unassigned = 0
        for (const t of tasks) {
            if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue
            pending++
            if (t.is_overdue) fires++
            else if (t.priority === 'URGENT' && !t.assigned_to) fires++
            if (!t.assigned_to) unassigned++
        }
        return { fires, pending, unassigned, triageCount: triage.length }
    }, [tasks, triage])

    // Status line — single sentence, no decoration. Celebrate the empty state.
    const statusLine = (() => {
        if (loading) return 'Loading…'
        if (summary.triageCount === 0) return "You're clear. No tasks need your attention."
        if (summary.fires > 0) {
            return `${summary.triageCount} item${summary.triageCount === 1 ? '' : 's'} need you — ${summary.fires} on fire.`
        }
        return `${summary.triageCount} item${summary.triageCount === 1 ? '' : 's'} in your queue.`
    })()

    // Visual tokens for triage row tone. Keep severity palette tight: only
    // overdue-bad gets red, overdue-3d gets orange, urgent gets amber. Plain
    // unassigned rows stay neutral — they're suggestions, not emergencies.
    const toneFor = (kind: string) => {
        switch (kind) {
            case 'overdue-bad': return { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: 'color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)', fg: 'var(--app-error, #ef4444)', Icon: AlertTriangle }
            case 'overdue': return { bg: 'transparent', border: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)', fg: 'var(--app-error, #ef4444)', Icon: Clock }
            case 'urgent-unassigned': return { bg: 'transparent', border: 'color-mix(in srgb, var(--app-warning, #f59e0b) 22%, transparent)', fg: 'var(--app-warning, #f59e0b)', Icon: Flame }
            case 'urgent': return { bg: 'transparent', border: 'color-mix(in srgb, var(--app-warning, #f59e0b) 18%, transparent)', fg: 'var(--app-warning, #f59e0b)', Icon: Flame }
            default: return { bg: 'transparent', border: 'var(--app-border)', fg: 'var(--app-muted-foreground)', Icon: UserX }
        }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* ── Header: single status sentence, no KPI wall ── */}
            <header className="flex-shrink-0 px-6 md:px-10 pt-8 pb-6 border-b"
                style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <div className="max-w-5xl">
                    <div className="text-tp-xs font-bold uppercase tracking-widest mb-2"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Manager triage · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black leading-tight mb-3"
                        style={{ color: 'var(--app-foreground)' }}>
                        {statusLine}
                    </h1>
                    <div className="flex items-center gap-4 flex-wrap">
                        {summary.pending > 0 && (
                            <span className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                <strong style={{ color: 'var(--app-foreground)' }}>{summary.pending}</strong> open total
                            </span>
                        )}
                        {summary.unassigned > 0 && (
                            <span className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                <strong style={{ color: 'var(--app-foreground)' }}>{summary.unassigned}</strong> unassigned
                            </span>
                        )}
                        <button onClick={() => load(true)} disabled={refreshing}
                            className="flex items-center gap-1.5 text-tp-sm font-bold transition-all disabled:opacity-50 ml-auto"
                            style={{ color: 'var(--app-primary)' }}>
                            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-10">

                        {/* ═══ 1. Triage Queue — the decisions you need to make ═══ */}
                        <section>
                            <div className="flex items-baseline justify-between mb-4">
                                <h2 className="text-tp-sm font-black uppercase tracking-widest"
                                    style={{ color: 'var(--app-foreground)' }}>
                                    <Inbox size={14} className="inline mb-0.5 mr-1.5" style={{ color: 'var(--app-muted-foreground)' }} />
                                    Triage queue
                                </h2>
                                <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                    sorted by urgency
                                </span>
                            </div>

                            {triage.length === 0 ? (
                                <div className="py-16 text-center rounded-2xl"
                                    style={{ border: '1px dashed var(--app-border)' }}>
                                    <CheckCircle2 size={36} className="mx-auto mb-3"
                                        style={{ color: 'var(--app-success, #22c55e)' }} />
                                    <div className="text-tp-lg font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Nothing in the queue.
                                    </div>
                                    <div className="text-tp-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        No overdue work, no urgent items without an assignee. Enjoy the calm.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {triage.slice(0, 25).map(row => {
                                        const tone = toneFor(row.kind)
                                        const Icon = tone.Icon
                                        return (
                                            <Link key={row.task.id} href={`/workspace/tasks?focus=${row.task.id}`}
                                                className="group flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:translate-x-0.5"
                                                style={{
                                                    background: tone.bg !== 'transparent' ? tone.bg : 'var(--app-surface)',
                                                    border: `1px solid ${tone.border}`,
                                                }}>
                                                <Icon size={16} style={{ color: tone.fg }} className="flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                        {row.task.title}
                                                    </div>
                                                    <div className="text-tp-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        <span style={{ color: tone.fg, fontWeight: 700 }}>{row.detail}</span>
                                                        {row.task.category_name && <>
                                                            <span>·</span>
                                                            <span>{row.task.category_name}</span>
                                                        </>}
                                                        {row.task.assigned_to_name && <>
                                                            <span>·</span>
                                                            <span>{row.task.assigned_to_name}</span>
                                                        </>}
                                                        {!row.task.assigned_to && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                                                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                                                <UserX size={10} /> assign
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ArrowRight size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ color: 'var(--app-muted-foreground)' }} />
                                            </Link>
                                        )
                                    })}
                                    {triage.length > 25 && (
                                        <Link href="/workspace/tasks?filter=overdue"
                                            className="block text-center text-tp-sm font-bold pt-2"
                                            style={{ color: 'var(--app-primary)' }}>
                                            See all {triage.length} items →
                                        </Link>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* ═══ 2. Team load — who's free, who's buried ═══ */}
                        {teamLoad.length > 0 && (
                            <section>
                                <div className="flex items-baseline justify-between mb-4">
                                    <h2 className="text-tp-sm font-black uppercase tracking-widest"
                                        style={{ color: 'var(--app-foreground)' }}>
                                        <Users size={14} className="inline mb-0.5 mr-1.5" style={{ color: 'var(--app-muted-foreground)' }} />
                                        Team load
                                    </h2>
                                    <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        click a row to reassign
                                    </span>
                                </div>

                                <div className="rounded-2xl overflow-hidden"
                                    style={{ border: '1px solid var(--app-border)' }}>
                                    {teamLoad.map((row, i) => {
                                        const isUnassigned = row.user === null
                                        const busyLabel = row.overdue > 0 ? 'behind'
                                            : row.pending >= 5 ? 'heavy'
                                            : row.pending > 0 ? 'steady'
                                            : 'free'
                                        const busyColor = row.overdue > 0 ? 'var(--app-error, #ef4444)'
                                            : row.pending >= 5 ? 'var(--app-warning, #f59e0b)'
                                            : row.pending > 0 ? 'var(--app-foreground)'
                                            : 'var(--app-success, #22c55e)'
                                        return (
                                            <Link key={row.user?.id ?? `un-${i}`}
                                                href={isUnassigned ? '/workspace/tasks?filter=unassigned' : `/workspace/tasks?assignee=${row.user?.id}`}
                                                className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-app-surface/60"
                                                style={{
                                                    borderTop: i === 0 ? undefined : '1px solid var(--app-border)',
                                                    background: isUnassigned ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, transparent)' : undefined,
                                                }}>
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        background: isUnassigned ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)' : 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                        color: isUnassigned ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)',
                                                    }}>
                                                    {isUnassigned ? <UserX size={15} /> : <span className="font-black text-tp-md">{fullName(row.user).charAt(0).toUpperCase()}</span>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                        {isUnassigned ? 'Unassigned bucket' : fullName(row.user)}
                                                    </div>
                                                    <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        {isUnassigned
                                                            ? `${row.pending} task${row.pending === 1 ? '' : 's'} waiting for an owner`
                                                            : `${row.pending} open · ${row.completed7d} done this week`}
                                                    </div>
                                                </div>
                                                {!isUnassigned && (
                                                    <span className="text-tp-xs font-black uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
                                                        style={{ background: `color-mix(in srgb, ${busyColor} 10%, transparent)`, color: busyColor, border: `1px solid color-mix(in srgb, ${busyColor} 25%, transparent)` }}>
                                                        {busyLabel}
                                                    </span>
                                                )}
                                                {row.overdue > 0 && (
                                                    <span className="text-tp-xs font-bold tabular-nums flex-shrink-0"
                                                        style={{ color: 'var(--app-error, #ef4444)' }}>
                                                        {row.overdue} late
                                                    </span>
                                                )}
                                                <ChevronRight size={14} className="flex-shrink-0"
                                                    style={{ color: 'var(--app-muted-foreground)' }} />
                                            </Link>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ═══ 3. Today's pulse — compact activity stream ═══ */}
                        {pulse.length > 0 && (
                            <section>
                                <div className="flex items-baseline justify-between mb-4">
                                    <h2 className="text-tp-sm font-black uppercase tracking-widest"
                                        style={{ color: 'var(--app-foreground)' }}>
                                        <Activity size={14} className="inline mb-0.5 mr-1.5" style={{ color: 'var(--app-muted-foreground)' }} />
                                        Today's pulse
                                    </h2>
                                    <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        last {pulse.length} events
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    {pulse.map((e, i) => {
                                        const color = e.kind === 'done' ? 'var(--app-success, #22c55e)' : 'var(--app-info, #3b82f6)'
                                        return (
                                            <div key={`${e.task.id}-${e.kind}-${i}`}
                                                className="flex items-center gap-3 px-2 py-1.5">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0"
                                                    style={{ background: color }} />
                                                <span className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>
                                                        {e.kind === 'done' ? 'Done' : 'New'}
                                                    </span>
                                                    {' — '}
                                                    <span style={{ color: 'var(--app-foreground)' }}>{e.task.title}</span>
                                                    {e.task.assigned_to_name && e.kind === 'done' && (
                                                        <> {'by '}{e.task.assigned_to_name}</>
                                                    )}
                                                </span>
                                                <span className="text-tp-xxs ml-auto tabular-nums flex-shrink-0"
                                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {relTime(e.iso, today)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ═══ Footer — quick jumps, plain text, no decoration ═══ */}
                        <footer className="pt-6 flex items-center gap-5 flex-wrap text-tp-sm"
                            style={{ borderTop: '1px solid var(--app-border)' }}>
                            <Link href="/workspace/tasks"
                                className="font-bold flex items-center gap-1 hover:underline"
                                style={{ color: 'var(--app-primary)' }}>
                                All tasks <ArrowRight size={12} />
                            </Link>
                            <Link href="/workspace/auto-task-rules"
                                className="font-bold flex items-center gap-1 hover:underline"
                                style={{ color: 'var(--app-primary)' }}>
                                <Zap size={12} /> Automations
                            </Link>
                            <Link href="/workspace/leader-tree"
                                className="font-bold flex items-center gap-1 hover:underline"
                                style={{ color: 'var(--app-primary)' }}>
                                <User size={12} /> Team structure
                            </Link>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    )
}
