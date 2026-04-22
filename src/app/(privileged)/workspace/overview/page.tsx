'use client'

/**
 * Manager Dashboard (overview page)
 * ==================================
 * One screen that answers the three questions every operations manager asks:
 *   1. What must be done today?
 *   2. What's slipping (overdue)?
 *   3. Who on my team is on top of it, and who isn't?
 *
 * Everything is computed from the existing /api/tasks/ endpoint — no new
 * backend work needed. Re-fetches on mount and exposes a manual refresh.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
    LayoutDashboard, Loader2, AlertTriangle, Clock, CheckCircle2, Calendar,
    Flame, User, RefreshCcw, TrendingUp, TrendingDown, Zap, ChevronRight,
    Trophy, Lightbulb, Activity, Hash, Target, Minus,
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
    const twoWeeksAgoIso = toIso(shiftDays(today, -14))

    const stats = useMemo(() => {
        let dueToday = 0, overdue = 0, completedThisWeek = 0, unassigned = 0, urgent = 0, autoTasks = 0
        const daysOverdueBuckets = { '1-2': 0, '3-7': 0, '>7': 0 }
        for (const t of tasks) {
            const isOpen = t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
            if (isOpen) {
                if (t.due_date && t.due_date.slice(0, 10) === todayIso) dueToday++
                if (t.is_overdue && t.due_date) {
                    overdue++
                    const ms = today.getTime() - new Date(t.due_date).getTime()
                    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
                    if (days <= 2) daysOverdueBuckets['1-2']++
                    else if (days <= 7) daysOverdueBuckets['3-7']++
                    else daysOverdueBuckets['>7']++
                }
                if (t.priority === 'URGENT') urgent++
                if (!t.assigned_to) unassigned++
                if (t.source === 'SYSTEM' || t.source === 'AUTO') autoTasks++
            } else if (t.status === 'COMPLETED' && t.completed_at) {
                const doneDay = t.completed_at.slice(0, 10)
                if (doneDay >= weekAgoIso && doneDay <= todayIso) completedThisWeek++
            }
        }
        return { dueToday, overdue, completedThisWeek, unassigned, urgent, autoTasks, daysOverdueBuckets }
    }, [tasks, todayIso, weekAgoIso, today])

    // Week-over-week delta: how completed-this-week compares to previous-week.
    const wowDelta = useMemo(() => {
        let thisWeek = 0, prevWeek = 0
        for (const t of tasks) {
            if (t.status !== 'COMPLETED' || !t.completed_at) continue
            const day = t.completed_at.slice(0, 10)
            if (day >= weekAgoIso && day <= todayIso) thisWeek++
            else if (day >= twoWeeksAgoIso && day < weekAgoIso) prevWeek++
        }
        const diff = thisWeek - prevWeek
        const pct = prevWeek > 0 ? Math.round((diff / prevWeek) * 100) : (thisWeek > 0 ? 100 : 0)
        return { thisWeek, prevWeek, diff, pct }
    }, [tasks, todayIso, weekAgoIso, twoWeeksAgoIso])

    // Category breakdown — open tasks grouped by category with counts + percentage.
    const categoryBreakdown = useMemo(() => {
        const m = new Map<string, number>()
        let total = 0
        for (const t of tasks) {
            if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue
            const name = t.category_name || 'Uncategorized'
            m.set(name, (m.get(name) || 0) + 1)
            total++
        }
        const entries = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        return { entries, total }
    }, [tasks])

    // Recent completions — last 5 closed tasks for the activity feed.
    const recentCompletions = useMemo(() => {
        return tasks
            .filter(t => t.status === 'COMPLETED' && t.completed_at)
            .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
            .slice(0, 5)
    }, [tasks])

    // Priority distribution of open tasks — for a small horizontal stacked bar.
    const priorityMix = useMemo(() => {
        const counts = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
        for (const t of tasks) {
            if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue
            const key = (t.priority || 'MEDIUM').toUpperCase() as keyof typeof counts
            if (key in counts) counts[key]++
        }
        const total = counts.URGENT + counts.HIGH + counts.MEDIUM + counts.LOW
        return { counts, total }
    }, [tasks])

    // Per-user breakdown: pending / overdue / completed this week + points-based score
    const teamRows = useMemo(() => {
        const m = new Map<number, { user: UserRow | null; pending: number; overdue: number; completed7d: number; points7d: number; score: number }>()
        for (const t of tasks) {
            const uid = t.assigned_to ?? 0
            if (!m.has(uid)) m.set(uid, { user: uid ? (userMap.get(uid) || null) : null, pending: 0, overdue: 0, completed7d: 0, points7d: 0, score: 0 })
            const row = m.get(uid)!
            if (t.status === 'COMPLETED') {
                const doneDay = (t.completed_at || '').slice(0, 10)
                if (doneDay && doneDay >= weekAgoIso) {
                    row.completed7d++
                    row.points7d += t.points || 1
                }
            } else if (t.status !== 'CANCELLED') {
                row.pending++
                if (t.is_overdue) row.overdue++
            }
        }
        // Score: each completed point = +1, each overdue task = −2, each pending = 0.
        // Lightweight but captures "shipping vs slipping" — the manager can always
        // drill into the raw columns next to it.
        for (const row of m.values()) {
            row.score = row.points7d * 1 - row.overdue * 2
        }
        const rows = Array.from(m.values())
        rows.sort((a, b) => (b.overdue - a.overdue) || (b.pending - a.pending) || (b.completed7d - a.completed7d))
        return rows
    }, [tasks, userMap, weekAgoIso])

    // Leaderboard view — top scorers over the last 7 days. Separate from the
    // team table so it ranks by performance (completed points), not by what's
    // slipping. Exclude the unassigned bucket.
    const leaderboard = useMemo(() => {
        return teamRows.filter(r => r.user !== null)
            .slice().sort((a, b) => (b.score - a.score) || (b.points7d - a.points7d))
            .slice(0, 5)
    }, [teamRows])

    // Plain-English insights auto-computed from the same task list. No AI —
    // just aggregate signals a manager should notice at a glance. Nulls out
    // insights that wouldn't say anything interesting (zero counts).
    const insights = useMemo(() => {
        const out: { kind: 'warn' | 'good' | 'info'; text: string }[] = []
        // Overdue age trend
        const overdueAges: number[] = []
        const completionAges: number[] = []
        let autoCount = 0, manualCount = 0
        const byCategory = new Map<string, number>()
        for (const t of tasks) {
            const isOpen = t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
            if (t.source === 'SYSTEM' || t.source === 'AUTO') autoCount++; else manualCount++
            if (t.category_name) byCategory.set(t.category_name, (byCategory.get(t.category_name) || 0) + 1)
            if (isOpen && t.is_overdue && t.due_date) {
                const days = Math.floor((today.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24))
                if (days > 0) overdueAges.push(days)
            } else if (t.status === 'COMPLETED' && t.completed_at && t.created_at) {
                const ms = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()
                if (ms > 0) completionAges.push(Math.round(ms / (1000 * 60 * 60 * 24) * 10) / 10)
            }
        }
        if (overdueAges.length > 0) {
            const median = [...overdueAges].sort((a, b) => a - b)[Math.floor(overdueAges.length / 2)]
            out.push({
                kind: 'warn',
                text: `${overdueAges.length} task${overdueAges.length === 1 ? ' is' : 's are'} overdue — median age ${median} day${median === 1 ? '' : 's'}.`,
            })
        }
        if (completionAges.length >= 3) {
            const avg = completionAges.reduce((a, b) => a + b, 0) / completionAges.length
            out.push({
                kind: 'info',
                text: `Average time from creation to done: ${avg.toFixed(1)} day${avg === 1 ? '' : 's'} across ${completionAges.length} completed task${completionAges.length === 1 ? '' : 's'}.`,
            })
        }
        if (leaderboard.length > 0 && leaderboard[0].points7d > 0) {
            const top = leaderboard[0]
            out.push({
                kind: 'good',
                text: `Top performer this week: ${fullName(top.user)} — ${top.completed7d} task${top.completed7d === 1 ? '' : 's'} · ${top.points7d} point${top.points7d === 1 ? '' : 's'}.`,
            })
        }
        if (byCategory.size > 0) {
            const [topCat, topCount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]
            if (topCount >= 3) {
                out.push({
                    kind: 'info',
                    text: `Most active category: ${topCat} (${topCount} task${topCount === 1 ? '' : 's'}).`,
                })
            }
        }
        if (autoCount > 0 && (autoCount + manualCount) > 0) {
            const pct = Math.round((autoCount / (autoCount + manualCount)) * 100)
            out.push({
                kind: pct >= 50 ? 'good' : 'info',
                text: `${pct}% of tasks are auto-created by rules — the rest are entered manually.`,
            })
        }
        if (stats.unassigned >= 3) {
            out.push({
                kind: 'warn',
                text: `${stats.unassigned} task${stats.unassigned === 1 ? '' : 's'} ha${stats.unassigned === 1 ? 's' : 've'} no assignee. Route them to a person or team so nothing stalls.`,
            })
        }
        return out.slice(0, 6)
    }, [tasks, leaderboard, stats, today])

    // Alerts — anything that genuinely needs a manager's eyes right now.
    const alerts = useMemo(() => {
        const out: { kind: 'overdue' | 'unassigned' | 'urgent'; task: Task; detail: string }[] = []
        for (const t of tasks) {
            if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue
            if (t.is_overdue && t.due_date) {
                const days = Math.floor((today.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24))
                if (days >= 3) out.push({ kind: 'overdue', task: t, detail: `${days} days overdue` })
            } else if (t.priority === 'URGENT' && !t.assigned_to) {
                out.push({ kind: 'unassigned', task: t, detail: 'Urgent task has no assignee' })
            } else if (t.priority === 'URGENT') {
                out.push({ kind: 'urgent', task: t, detail: `Urgent — ${t.assigned_to_name || 'assigned'}` })
            }
        }
        return out.slice(0, 20)
    }, [tasks, today])

    const kpis = [
        { label: 'Due today', value: stats.dueToday, color: 'var(--app-primary)', icon: <Calendar size={14} /> },
        { label: 'Overdue', value: stats.overdue, color: 'var(--app-error, #ef4444)', icon: <AlertTriangle size={14} /> },
        { label: 'Urgent', value: stats.urgent, color: 'var(--app-warning, #f59e0b)', icon: <Flame size={14} /> },
        { label: 'Unassigned', value: stats.unassigned, color: 'var(--app-info)', icon: <User size={14} /> },
        { label: 'Auto-created', value: stats.autoTasks, color: 'var(--app-info, #3b82f6)', icon: <Zap size={14} /> },
        { label: 'Done · 7d', value: stats.completedThisWeek, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} /> },
    ]

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            {/* ── Hero header ── */}
            <div className="flex items-center justify-between gap-3 flex-shrink-0 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 75%, #8b5cf6))',
                            boxShadow: '0 6px 18px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                        }}>
                        <LayoutDashboard size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>Today at a glance</h1>
                        <p className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                            {loading ? 'Loading…'
                                : stats.overdue === 0 && stats.unassigned === 0 && stats.urgent === 0
                                    ? '✅ Everything on track — no fires to fight right now.'
                                    : `${stats.overdue + stats.unassigned + stats.urgent} item${(stats.overdue + stats.unassigned + stats.urgent) === 1 ? '' : 's'} need${(stats.overdue + stats.unassigned + stats.urgent) === 1 ? 's' : ''} attention.`}
                        </p>
                    </div>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                    className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                    {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-app-primary" />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6">
                    {/* ═══ Hero KPIs — three headline numbers, large + airy ═══ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                        {/* Due today */}
                        <div className="p-6 rounded-3xl relative overflow-hidden"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 4px 20px color-mix(in srgb, #000 5%, transparent)' }}>
                            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }} />
                            <div className="relative flex items-start justify-between">
                                <div>
                                    <div className="text-tp-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Due today</div>
                                    <div className="text-5xl font-black tabular-nums leading-none" style={{ color: stats.dueToday > 0 ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                                        {stats.dueToday}
                                    </div>
                                    <div className="text-tp-sm font-medium mt-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {stats.dueToday === 0 ? "Nothing scheduled today" : stats.dueToday === 1 ? 'task to wrap up' : 'tasks to wrap up'}
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Calendar size={22} />
                                </div>
                            </div>
                        </div>

                        {/* Overdue */}
                        <div className="p-6 rounded-3xl relative overflow-hidden"
                            style={{
                                background: stats.overdue > 0
                                    ? 'linear-gradient(135deg, color-mix(in srgb, var(--app-error, #ef4444) 6%, var(--app-surface)), var(--app-surface))'
                                    : 'var(--app-surface)',
                                border: `1px solid ${stats.overdue > 0 ? 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' : 'var(--app-border)'}`,
                                boxShadow: '0 4px 20px color-mix(in srgb, #000 5%, transparent)',
                            }}>
                            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                                style={{ background: `color-mix(in srgb, var(--app-error, #ef4444) ${stats.overdue > 0 ? 10 : 3}%, transparent)` }} />
                            <div className="relative flex items-start justify-between">
                                <div>
                                    <div className="text-tp-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Overdue</div>
                                    <div className="text-5xl font-black tabular-nums leading-none" style={{ color: stats.overdue > 0 ? 'var(--app-error, #ef4444)' : 'var(--app-foreground)' }}>
                                        {stats.overdue}
                                    </div>
                                    <div className="text-tp-sm font-medium mt-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {stats.overdue === 0 ? "Nothing past its deadline" : `${stats.daysOverdueBuckets['>7']} over a week late`}
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                    <AlertTriangle size={22} />
                                </div>
                            </div>
                        </div>

                        {/* Completed this week (with trend) */}
                        <div className="p-6 rounded-3xl relative overflow-hidden"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 4px 20px color-mix(in srgb, #000 5%, transparent)' }}>
                            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' }} />
                            <div className="relative flex items-start justify-between">
                                <div>
                                    <div className="text-tp-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Done this week</div>
                                    <div className="flex items-baseline gap-3">
                                        <div className="text-5xl font-black tabular-nums leading-none" style={{ color: 'var(--app-foreground)' }}>
                                            {wowDelta.thisWeek}
                                        </div>
                                        {(wowDelta.prevWeek > 0 || wowDelta.thisWeek > 0) && (
                                            <div className="flex items-center gap-0.5 text-tp-sm font-black"
                                                style={{ color: wowDelta.diff > 0 ? 'var(--app-success, #22c55e)' : wowDelta.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                {wowDelta.diff > 0 ? <TrendingUp size={14} /> : wowDelta.diff < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                                                {wowDelta.diff > 0 ? '+' : ''}{wowDelta.pct}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-tp-sm font-medium mt-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                        vs {wowDelta.prevWeek} last week
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                    <CheckCircle2 size={22} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Secondary metrics strip ═══ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                        {[
                            { label: 'Urgent open', value: stats.urgent, color: 'var(--app-warning, #f59e0b)', icon: <Flame size={16} /> },
                            { label: 'Unassigned', value: stats.unassigned, color: '#8b5cf6', icon: <User size={16} /> },
                            { label: 'Auto-created', value: stats.autoTasks, color: 'var(--app-info, #3b82f6)', icon: <Zap size={16} /> },
                            { label: 'Open total', value: priorityMix.total, color: 'var(--app-muted-foreground)', icon: <Hash size={16} /> },
                        ].map(k => (
                            <div key={k.label} className="px-4 py-3 rounded-2xl flex items-center gap-3 transition-all"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color }}>
                                    {k.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                    <div className="text-2xl font-black tabular-nums leading-tight" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ═══ Priority distribution — slim stacked bar (only if we have open tasks) ═══ */}
                    {priorityMix.total > 0 && (
                        <div className="p-5 rounded-3xl"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Target size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                                <span className="text-tp-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>Open tasks by priority</span>
                                <span className="text-tp-xxs font-medium ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>{priorityMix.total} total</span>
                            </div>
                            <div className="flex h-3 rounded-full overflow-hidden mb-3"
                                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                {([
                                    { key: 'URGENT', color: 'var(--app-error, #ef4444)' },
                                    { key: 'HIGH', color: 'var(--app-warning, #f59e0b)' },
                                    { key: 'MEDIUM', color: 'var(--app-info, #3b82f6)' },
                                    { key: 'LOW', color: 'var(--app-muted-foreground)' },
                                ] as const).map(p => {
                                    const n = priorityMix.counts[p.key as 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW']
                                    if (n === 0) return null
                                    const pct = (n / priorityMix.total) * 100
                                    return <div key={p.key} style={{ width: `${pct}%`, background: p.color }} title={`${p.key}: ${n} (${pct.toFixed(0)}%)`} />
                                })}
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                                {([
                                    { key: 'URGENT', label: 'Urgent', color: 'var(--app-error, #ef4444)' },
                                    { key: 'HIGH', label: 'High', color: 'var(--app-warning, #f59e0b)' },
                                    { key: 'MEDIUM', label: 'Medium', color: 'var(--app-info, #3b82f6)' },
                                    { key: 'LOW', label: 'Low', color: 'var(--app-muted-foreground)' },
                                ] as const).map(p => {
                                    const n = priorityMix.counts[p.key as 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW']
                                    return (
                                        <div key={p.key} className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                            <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{n}</span>
                                            <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>{p.label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═══ Category + Activity — two-column rich detail ═══ */}
                    {(categoryBreakdown.entries.length > 0 || recentCompletions.length > 0) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                            {/* Category breakdown */}
                            {categoryBreakdown.entries.length > 0 && (
                                <div className="p-5 rounded-3xl"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                            <Target size={15} />
                                        </div>
                                        <div>
                                            <div className="text-tp-sm font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>Open tasks by category</div>
                                            <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>{categoryBreakdown.total} total open</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {categoryBreakdown.entries.map(([name, count]) => {
                                            const pct = categoryBreakdown.total > 0 ? (count / categoryBreakdown.total) * 100 : 0
                                            return (
                                                <div key={name}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{name}</span>
                                                        <span className="text-tp-xs font-black tabular-nums flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>
                                                            {count} <span className="opacity-60">· {pct.toFixed(0)}%</span>
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full overflow-hidden"
                                                        style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                        <div className="h-full rounded-full transition-all"
                                                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #8b5cf6))' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Recent completions feed */}
                            {recentCompletions.length > 0 && (
                                <div className="p-5 rounded-3xl"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                            <Activity size={15} />
                                        </div>
                                        <div>
                                            <div className="text-tp-sm font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>Recently completed</div>
                                            <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>What just got done</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        {recentCompletions.map(t => {
                                            const when = t.completed_at ? new Date(t.completed_at) : null
                                            const ago = when ? Math.max(0, Math.floor((today.getTime() - when.getTime()) / 60000)) : 0
                                            const agoText = !when ? '' : ago < 1 ? 'just now'
                                                : ago < 60 ? `${ago} min ago`
                                                : ago < 1440 ? `${Math.floor(ago / 60)} h ago`
                                                : `${Math.floor(ago / 1440)} d ago`
                                            return (
                                                <div key={t.id} className="flex items-start gap-2.5">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                                                        style={{ background: 'var(--app-success, #22c55e)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                            {t.title}
                                                        </div>
                                                        <div className="text-tp-xs flex items-center gap-2" style={{ color: 'var(--app-muted-foreground)' }}>
                                                            <span>{t.assigned_to_name || 'Unassigned'}</span>
                                                            <span>·</span>
                                                            <span>{agoText}</span>
                                                            {t.category_name && <>
                                                                <span>·</span>
                                                                <span className="truncate">{t.category_name}</span>
                                                            </>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Insights — plain-English signals computed from the task list */}
                    {insights.length > 0 && (
                        <div className="rounded-2xl overflow-hidden"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5"
                                style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>
                                <Lightbulb size={13} style={{ color: 'var(--app-info, #3b82f6)' }} />
                                <span className="text-tp-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-foreground)' }}>Insights</span>
                                <span className="text-tp-xxs font-bold ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>signals worth noticing</span>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {insights.map((ins, i) => {
                                    const c = ins.kind === 'warn' ? 'var(--app-error, #ef4444)'
                                        : ins.kind === 'good' ? 'var(--app-success, #22c55e)'
                                        : 'var(--app-info, #3b82f6)'
                                    const emoji = ins.kind === 'warn' ? '⚠️' : ins.kind === 'good' ? '✅' : 'ℹ️'
                                    return (
                                        <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-xl"
                                            style={{ background: 'var(--app-surface)', border: `1px solid color-mix(in srgb, ${c} 20%, transparent)` }}>
                                            <span className="text-sm flex-shrink-0" style={{ width: 20, textAlign: 'center' }}>{emoji}</span>
                                            <span className="text-tp-sm font-bold leading-relaxed" style={{ color: 'var(--app-foreground)' }}>{ins.text}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Leaderboard — podium for top 3, row for 4-5 */}
                    {leaderboard.length > 0 && leaderboard.some(r => r.points7d > 0 || r.completed7d > 0) && (() => {
                        const top3 = leaderboard.slice(0, 3)
                        const rest = leaderboard.slice(3)
                        const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]]
                            : top3.length === 2 ? [top3[1], top3[0]]
                            : top3
                        const podiumHeights = top3.length >= 3 ? ['70px', '110px', '55px']
                            : top3.length === 2 ? ['70px', '100px']
                            : ['90px']
                        const rankColors = ['#f59e0b', '#94a3b8', '#d97706']
                        const medals = ['🥇', '🥈', '🥉']
                        return (
                            <div className="rounded-2xl overflow-hidden"
                                style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-warning, #f59e0b) 7%, var(--app-surface)), var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)' }}>
                                <div className="flex items-center gap-2 px-4 py-3"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' }}>
                                    <Trophy size={15} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <span className="text-tp-sm font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>This week's top performers</span>
                                    <span className="text-tp-xxs font-medium ml-auto hidden sm:inline" style={{ color: 'var(--app-muted-foreground)' }}>score = points − (overdue × 2)</span>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-end justify-center gap-3 md:gap-5">
                                        {podiumOrder.map((r, i) => {
                                            if (!r) return null
                                            const actualRank = top3.indexOf(r)
                                            const rankColor = rankColors[actualRank] || 'var(--app-muted-foreground)'
                                            return (
                                                <div key={r.user?.id ?? actualRank} className="flex flex-col items-center gap-2 flex-1 max-w-[200px]">
                                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${rankColor}, color-mix(in srgb, ${rankColor} 70%, #fff))`,
                                                            color: 'white',
                                                            boxShadow: `0 4px 14px color-mix(in srgb, ${rankColor} 35%, transparent)`,
                                                            border: `3px solid color-mix(in srgb, ${rankColor} 40%, transparent)`,
                                                        }}>
                                                        {fullName(r.user).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="text-tp-md font-black truncate max-w-full text-center" style={{ color: 'var(--app-foreground)' }}>
                                                        {fullName(r.user)}
                                                    </div>
                                                    <div className="text-tp-xs font-medium text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        {r.completed7d} done · {r.points7d} pts
                                                    </div>
                                                    <div className="relative w-full rounded-t-xl flex items-center justify-center"
                                                        style={{
                                                            height: podiumHeights[i],
                                                            background: `linear-gradient(180deg, color-mix(in srgb, ${rankColor} 22%, var(--app-surface)), color-mix(in srgb, ${rankColor} 8%, var(--app-surface)))`,
                                                            border: `1px solid color-mix(in srgb, ${rankColor} 35%, transparent)`,
                                                            borderBottom: 'none',
                                                        }}>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className="text-2xl md:text-3xl">{medals[actualRank]}</span>
                                                            <span className="text-tp-lg font-black tabular-nums"
                                                                style={{ color: r.score > 0 ? 'var(--app-success, #22c55e)' : r.score < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                                {r.score > 0 ? '+' : ''}{r.score}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {rest.length > 0 && (
                                        <div className="mt-5 pt-4 flex flex-wrap gap-2 justify-center"
                                            style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                            {rest.map((r, i) => (
                                                <div key={r.user?.id ?? `r-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                                    <span className="text-tp-xxs font-black" style={{ color: 'var(--app-muted-foreground)' }}>#{4 + i}</span>
                                                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{fullName(r.user)}</span>
                                                    <span className="text-tp-xs font-bold" style={{ color: r.score > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                                        {r.score > 0 ? '+' : ''}{r.score}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    {/* Overdue breakdown */}
                    {stats.overdue > 0 && (
                        <div className="p-3 rounded-2xl"
                            style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={13} style={{ color: 'var(--app-error, #ef4444)' }} />
                                <span className="text-tp-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-error, #ef4444)' }}>Overdue breakdown</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { label: '1–2 days late', value: stats.daysOverdueBuckets['1-2'], color: 'var(--app-warning)' },
                                    { label: '3–7 days late', value: stats.daysOverdueBuckets['3-7'], color: 'var(--app-warning)' },
                                    { label: '> 7 days late', value: stats.daysOverdueBuckets['>7'], color: 'var(--app-error, #ef4444)' },
                                ]).map(b => (
                                    <div key={b.label} className="px-3 py-2 rounded-xl"
                                        style={{ background: 'var(--app-surface)', border: `1px solid color-mix(in srgb, ${b.color} 30%, transparent)` }}>
                                        <div className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{b.label}</div>
                                        <div className="text-base font-bold tabular-nums" style={{ color: b.color }}>{b.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Team performance */}
                        <div className="rounded-2xl overflow-hidden"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                <TrendingUp size={13} style={{ color: 'var(--app-primary)' }} />
                                <span className="text-tp-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-foreground)' }}>Team performance</span>
                                <span className="text-tp-xxs font-bold ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>sorted by overdue · last 7 days</span>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-2 px-3 py-2 text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)', background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)' }}>
                                <div>User</div>
                                <div className="text-center">Pending</div>
                                <div className="text-center">Overdue</div>
                                <div className="text-center">Done 7d</div>
                            </div>
                            <div>
                                {teamRows.length === 0 ? (
                                    <div className="p-5 text-tp-sm text-center" style={{ color: 'var(--app-muted-foreground)' }}>No assignable tasks yet.</div>
                                ) : teamRows.map((row, i) => (
                                    <div key={row.user?.id ?? `un-${i}`}
                                        className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px] gap-2 px-3 py-2 items-center"
                                        style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: row.user ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: row.user ? 'var(--app-primary)' : 'var(--app-info)' }}>
                                                <User size={11} />
                                            </div>
                                            <span className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                {fullName(row.user)}
                                            </span>
                                        </div>
                                        <div className="text-center text-tp-md font-bold tabular-nums" style={{ color: row.pending > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{row.pending}</div>
                                        <div className="text-center text-tp-md font-bold tabular-nums" style={{ color: row.overdue > 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>{row.overdue}</div>
                                        <div className="text-center text-tp-md font-bold tabular-nums" style={{ color: row.completed7d > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>{row.completed7d}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Alerts */}
                        <div className="rounded-2xl overflow-hidden"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5"
                                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                <AlertTriangle size={13} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                <span className="text-tp-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-foreground)' }}>Alerts</span>
                                <span className="text-tp-xxs font-bold ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>top {alerts.length}</span>
                            </div>
                            <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                                {alerts.length === 0 ? (
                                    <div className="p-5 text-tp-sm text-center" style={{ color: 'var(--app-muted-foreground)' }}>Nothing urgent — you're caught up. 🎉</div>
                                ) : alerts.map(a => {
                                    const c = a.kind === 'overdue' ? 'var(--app-error, #ef4444)'
                                        : a.kind === 'unassigned' ? 'var(--app-info)'
                                        : 'var(--app-warning, #f59e0b)'
                                    const Icon = a.kind === 'overdue' ? Clock : a.kind === 'unassigned' ? User : Flame
                                    return (
                                        <Link key={a.task.id} href={`/workspace/tasks`}
                                            className="flex items-start gap-2 px-3 py-2 transition-all hover:bg-app-surface/50"
                                            style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
                                                <Icon size={11} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{a.task.title}</div>
                                                <div className="text-tp-xs font-medium truncate" style={{ color: c }}>{a.detail}</div>
                                            </div>
                                            <ChevronRight size={13} className="flex-shrink-0 mt-1" style={{ color: 'var(--app-muted-foreground)' }} />
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl p-3 flex items-center gap-2 flex-wrap"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>
                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-foreground)' }}>
                            Want to act on something?
                        </span>
                        <Link href="/workspace/tasks" className="text-tp-sm font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
                            → Open Tasks
                        </Link>
                        <Link href="/workspace/auto-task-rules?module=finance" className="text-tp-sm font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
                            → Configure Automations
                        </Link>
                        <Link href="/workspace/leader-tree" className="text-tp-sm font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
                            → Manage Team Structure
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
