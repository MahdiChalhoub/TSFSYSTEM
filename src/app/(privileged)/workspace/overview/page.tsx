'use client'

/**
 * Manager Overview — Rich, Role-Aware Dashboard
 * =============================================
 * Three audiences (Me · Team · Company), each with real visualisations:
 *
 *   • Sparklines           — 14-day completion trend inline with KPIs
 *   • Activity heatmap     — 30-day grid (GitHub-style) for personal streak
 *   • Velocity chart       — 14-day stacked bars (created vs completed)
 *   • Progress rings       — weekly goal completion
 *   • Load distribution    — horizontal share bars per team member
 *
 * All rendered in plain SVG — no external chart library dependencies.
 *
 * Computed client-side from /api/tasks/. Role detection drives which tab is
 * the default: Owner → Company, Leader → Team, everyone else → Me.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
    Loader2, RefreshCcw, Flame, Clock, Calendar, Archive, CheckCircle2,
    UserX, Zap, User as UserIcon, ArrowRight, AlertTriangle, Users,
    Building2, Trophy, TrendingUp, TrendingDown, Minus, Flag, Target,
    Activity, Sparkles, LayoutDashboard,
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

type Task = {
    id: number; title: string; status: string; priority: string;
    due_date?: string; created_at: string; is_overdue?: boolean;
    assigned_to?: number | null; assigned_to_name?: string | null;
    assigned_by?: number | null; assigned_by_name?: string | null;
    category?: number | null; category_name?: string | null;
    completed_at?: string | null; source?: string; points?: number;
}
type UserRow = {
    id: number; username: string; email?: string;
    first_name?: string; last_name?: string;
    is_staff?: boolean; is_superuser?: boolean;
    leader?: number | null;
}
type Me = UserRow & { role?: string }

const fullName = (u?: UserRow | null) =>
    u ? ([u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username) : 'Unassigned'
const toIso = (d: Date) => d.toISOString().split('T')[0]
const shiftDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
}

type Lane = 'now' | 'today' | 'week' | 'later' | 'nodate'
const LANE_META: Record<Lane, { title: string; sub: string; color: string }> = {
    now:    { title: 'NOW',       sub: 'Fires + overdue',  color: 'var(--app-error, #ef4444)' },
    today:  { title: 'TODAY',     sub: 'Due today',         color: 'var(--app-warning, #f59e0b)' },
    week:   { title: 'THIS WEEK', sub: 'Next 7 days',       color: 'var(--app-info, #3b82f6)' },
    later:  { title: 'LATER',     sub: 'Beyond this week',  color: 'var(--app-success, #22c55e)' },
    nodate: { title: 'NO DATE',   sub: 'Need planning',     color: 'var(--app-muted-foreground)' },
}

function laneOf(t: Task, todayIso: string, weekIso: string): Lane | null {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return null
    if (t.is_overdue) return 'now'
    if (t.priority === 'URGENT') return 'now'
    if (!t.due_date) return 'nodate'
    const day = t.due_date.slice(0, 10)
    if (day <= todayIso) return 'today'
    if (day <= weekIso) return 'week'
    return 'later'
}

function relDue(iso: string | undefined, today: Date): string {
    if (!iso) return ''
    const d = new Date(iso)
    const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
    if (diff < -1) return `${Math.abs(diff)}d late`
    if (diff === -1) return '1d late'
    if (diff === 0) return 'today'
    if (diff === 1) return 'tomorrow'
    if (diff < 7) return `in ${diff}d`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

type Tab = 'me' | 'team' | 'company'

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Root page                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function RichOverviewPage() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [users, setUsers] = useState<UserRow[]>([])
    const [me, setMe] = useState<Me | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [tab, setTab] = useState<Tab>('me')
    const [tabManuallyChosen, setTabManuallyChosen] = useState(false)

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true)
        try {
            const [t, u, meRes] = await Promise.all([
                erpFetch('tasks/?page_size=500').catch(() => []),
                erpFetch('users/').catch(() => []),
                erpFetch('auth/me/').catch(() => null),
            ])
            setTasks(Array.isArray(t) ? t : (t as any)?.results ?? [])
            setUsers(Array.isArray(u) ? u : (u as any)?.results ?? [])
            if (meRes) setMe(meRes as Me)
        } finally { setLoading(false); setRefreshing(false) }
    }, [])
    useEffect(() => { load() }, [load])

    const today = new Date()
    const todayIso = toIso(today)
    const weekEnd = shiftDays(today, 7); const weekIso = toIso(weekEnd)
    const weekAgo = shiftDays(today, -7); const weekAgoIso = toIso(weekAgo)
    const twoWeeksAgo = shiftDays(today, -14); const twoWeeksAgoIso = toIso(twoWeeksAgo)

    const userMap = useMemo(() => {
        const m = new Map<number, UserRow>()
        for (const u of users) m.set(u.id, u); return m
    }, [users])

    // Role detection
    const role = useMemo(() => {
        const isOwner = !!(me?.is_superuser || (me as any)?.role === 'owner' || (me as any)?.role === 'admin')
        const hasReports = !!me && users.some(u => u.leader === me.id)
        const assignsWork = !!me && tasks.some(t => t.assigned_by === me.id && t.assigned_to !== me.id)
        const isLeader = !!(me?.is_staff || hasReports || assignsWork)
        return { isOwner, isLeader, isUser: true }
    }, [me, users, tasks])

    useEffect(() => {
        if (tabManuallyChosen || !me) return
        if (role.isOwner) setTab('company')
        else if (role.isLeader) setTab('team')
        else setTab('me')
    }, [role, me, tabManuallyChosen])

    // Scope tasks per tab
    const myTasks = useMemo(
        () => me ? tasks.filter(t => t.assigned_to === me.id) : [],
        [tasks, me]
    )
    const teamMemberIds = useMemo(() => {
        if (!me) return new Set<number>()
        const ids = new Set<number>([me.id])
        for (const u of users) if (u.leader === me.id) ids.add(u.id)
        return ids
    }, [me, users])
    const teamTasks = useMemo(
        () => tasks.filter(t => t.assigned_to && teamMemberIds.has(t.assigned_to)),
        [tasks, teamMemberIds]
    )
    const activeTasks = tab === 'me' ? myTasks : tab === 'team' ? teamTasks : tasks

    // Board slicing
    const board = useMemo(() => {
        const lanes: Record<Lane, Task[]> = { now: [], today: [], week: [], later: [], nodate: [] }
        for (const t of activeTasks) {
            const l = laneOf(t, todayIso, weekIso); if (l) lanes[l].push(t)
        }
        const rank = (p: string) => p === 'URGENT' ? 0 : p === 'HIGH' ? 1 : p === 'MEDIUM' ? 2 : 3
        for (const key of Object.keys(lanes) as Lane[]) {
            lanes[key].sort((a, b) => (rank(a.priority) - rank(b.priority)) || (a.due_date || '9999').localeCompare(b.due_date || '9999'))
        }
        return lanes
    }, [activeTasks, todayIso, weekIso])
    const totalOpen = board.now.length + board.today.length + board.week.length + board.later.length + board.nodate.length

    // 14-day completion sparkline — shared across tabs, scoped by activeTasks
    const sparkline14d = useMemo(() => {
        const series: { day: string; done: number; created: number }[] = []
        for (let i = 13; i >= 0; i--) {
            const d = shiftDays(today, -i); const iso = toIso(d)
            series.push({ day: iso, done: 0, created: 0 })
        }
        const idx = new Map(series.map((s, i) => [s.day, i]))
        for (const t of activeTasks) {
            if (t.status === 'COMPLETED' && t.completed_at) {
                const i = idx.get(t.completed_at.slice(0, 10)); if (i !== undefined) series[i].done++
            }
            if (t.created_at) {
                const i = idx.get(t.created_at.slice(0, 10)); if (i !== undefined) series[i].created++
            }
        }
        return series
    }, [activeTasks, today])

    const wow = useMemo(() => {
        let thisW = 0, prevW = 0
        for (const t of activeTasks) {
            if (t.status !== 'COMPLETED' || !t.completed_at) continue
            const d = t.completed_at.slice(0, 10)
            if (d >= weekAgoIso) thisW++
            else if (d >= twoWeeksAgoIso && d < weekAgoIso) prevW++
        }
        const diff = thisW - prevW
        const pct = prevW > 0 ? Math.round((diff / prevW) * 100) : (thisW > 0 ? 100 : 0)
        return { thisW, prevW, diff, pct }
    }, [activeTasks, weekAgoIso, twoWeeksAgoIso])

    // Me: 30-day activity heatmap
    const heatmap30d = useMemo(() => {
        const days: { iso: string; dow: number; count: number }[] = []
        for (let i = 29; i >= 0; i--) {
            const d = shiftDays(today, -i)
            days.push({ iso: toIso(d), dow: d.getDay(), count: 0 })
        }
        const idx = new Map(days.map((d, i) => [d.iso, i]))
        for (const t of myTasks) {
            if (t.status === 'COMPLETED' && t.completed_at) {
                const i = idx.get(t.completed_at.slice(0, 10)); if (i !== undefined) days[i].count++
            }
        }
        return days
    }, [myTasks, today])

    // Me: streak + today's agenda
    const meStats = useMemo(() => {
        if (!me) {
            // Fallback when auth lookup fails: zero-filled so the page still renders.
            const weeklyGoal = Math.max(10, Math.ceil(sparkline14d.slice(0, 7).reduce((s, d) => s + d.done, 0)) || 10)
            return { doneThisWeek: 0, pointsThisWeek: 0, streak: 0, delegatedByMe: 0, openCount: 0, weeklyGoal }
        }
        let doneThisWeek = 0, pointsThisWeek = 0, delegatedByMe = 0
        for (const t of tasks) {
            if (t.assigned_to === me.id && t.status === 'COMPLETED' && t.completed_at) {
                const day = t.completed_at.slice(0, 10)
                if (day >= weekAgoIso) { doneThisWeek++; pointsThisWeek += t.points || 1 }
            }
            if (t.assigned_by === me.id && t.assigned_to !== me.id
                && t.status !== 'COMPLETED' && t.status !== 'CANCELLED') {
                delegatedByMe++
            }
        }
        const byDay = new Set<string>()
        for (const t of tasks) {
            if (t.assigned_to === me.id && t.status === 'COMPLETED' && t.completed_at) byDay.add(t.completed_at.slice(0, 10))
        }
        let streak = 0
        for (let i = 0; i < 30; i++) {
            if (byDay.has(toIso(shiftDays(today, -i)))) streak++; else break
        }
        const openCount = myTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
        // Weekly goal: target = rolling average of last 4 weeks or 10
        const weeklyGoal = Math.max(10, Math.ceil(sparkline14d.slice(0, 7).reduce((s, d) => s + d.done, 0)) || 10)
        return { doneThisWeek, pointsThisWeek, streak, delegatedByMe, openCount, weeklyGoal }
    }, [tasks, me, weekAgoIso, today, myTasks, sparkline14d])

    // Me agenda: today's + tomorrow's tasks, sorted
    const agenda = useMemo(() => {
        const items = myTasks
            .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
            .filter(t => {
                if (t.is_overdue) return true
                if (!t.due_date) return false
                const d = t.due_date.slice(0, 10); return d <= todayIso
            })
            .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
        return items.slice(0, 6)
    }, [myTasks, todayIso])

    // Team: per-member load + team velocity
    const teamLoad = useMemo(() => {
        type Row = { user: UserRow; pending: number; overdue: number; done7d: number; points7d: number }
        const m = new Map<number, Row>()
        for (const uid of teamMemberIds) {
            const u = userMap.get(uid); if (!u) continue
            m.set(uid, { user: u, pending: 0, overdue: 0, done7d: 0, points7d: 0 })
        }
        for (const t of teamTasks) {
            if (!t.assigned_to) continue
            const row = m.get(t.assigned_to); if (!row) continue
            if (t.status === 'COMPLETED') {
                if (t.completed_at && t.completed_at.slice(0, 10) >= weekAgoIso) {
                    row.done7d++; row.points7d += t.points || 1
                }
            } else if (t.status !== 'CANCELLED') {
                row.pending++; if (t.is_overdue) row.overdue++
            }
        }
        return Array.from(m.values()).sort((a, b) =>
            (b.overdue - a.overdue) || (b.pending - a.pending) || (b.done7d - a.done7d)
        )
    }, [teamTasks, teamMemberIds, userMap, weekAgoIso])

    // Company-level aggregates
    const companyStats = useMemo(() => {
        let open = 0, overdue = 0, urgent = 0, unassigned = 0, auto = 0, manual = 0
        let doneThisWeek = 0, doneLastWeek = 0
        const byCategory = new Map<string, number>()
        const byAssignee = new Map<number, { user: UserRow | null; done: number; points: number; overdue: number; open: number }>()
        for (const t of tasks) {
            const isOpen = t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
            if (isOpen) {
                open++
                if (t.is_overdue) overdue++
                if (t.priority === 'URGENT') urgent++
                if (!t.assigned_to) unassigned++
                if (t.category_name) byCategory.set(t.category_name, (byCategory.get(t.category_name) || 0) + 1)
            }
            if (t.source === 'SYSTEM' || t.source === 'AUTO') auto++; else manual++
            if (t.status === 'COMPLETED' && t.completed_at) {
                const day = t.completed_at.slice(0, 10)
                if (day >= weekAgoIso) doneThisWeek++
                else if (day >= twoWeeksAgoIso && day < weekAgoIso) doneLastWeek++
            }
            const uid = t.assigned_to ?? 0
            if (!byAssignee.has(uid)) byAssignee.set(uid, { user: uid ? (userMap.get(uid) || null) : null, done: 0, points: 0, overdue: 0, open: 0 })
            const row = byAssignee.get(uid)!
            if (t.status === 'COMPLETED' && t.completed_at && t.completed_at.slice(0, 10) >= weekAgoIso) {
                row.done++; row.points += t.points || 1
            }
            if (isOpen) { row.open++; if (t.is_overdue) row.overdue++ }
        }
        const wowDiff = doneThisWeek - doneLastWeek
        const wowPct = doneLastWeek > 0 ? Math.round((wowDiff / doneLastWeek) * 100) : (doneThisWeek > 0 ? 100 : 0)
        const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        const leaderboard = Array.from(byAssignee.values())
            .filter(r => r.user !== null)
            .sort((a, b) => b.points - a.points || b.done - a.done)
            .slice(0, 6)
        const autoPct = (auto + manual) > 0 ? Math.round((auto / (auto + manual)) * 100) : 0
        // Health score: blend of on-time % + throughput vs last week + auto%
        const completedTotal = tasks.filter(t => t.status === 'COMPLETED').length
        const onTimeRate = completedTotal > 0
            ? tasks.filter(t => t.status === 'COMPLETED' && !t.is_overdue).length / completedTotal
            : 1
        const healthScore = Math.max(0, Math.min(100,
            Math.round(onTimeRate * 60 + Math.max(0, Math.min(1, wowPct / 100)) * 25 + (autoPct / 100) * 15)
        ))
        return { open, overdue, urgent, unassigned, doneThisWeek, doneLastWeek, wowDiff, wowPct, autoPct, topCategories, leaderboard, healthScore }
    }, [tasks, userMap, weekAgoIso, twoWeeksAgoIso])

    // Always expose all three lenses — role detection is best-effort and
    // we don't want missing flags to hide tabs the user clearly wants.
    const availableTabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
        { key: 'me', label: 'Me', Icon: UserIcon },
        { key: 'team', label: 'My team', Icon: Users },
        { key: 'company', label: 'Company', Icon: Building2 },
    ]

    /* ─────────────────────────────── render ─────────────────────────────── */

    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>
            <div className="flex items-center gap-3 mb-3 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6">
                <div className="page-header-icon bg-app-primary">
                    <LayoutDashboard size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">
                        {tab === 'me' ? `Hi, ${me?.first_name || me?.username || 'there'}`
                         : tab === 'team' ? 'Team Dashboard'
                         : 'Company Dashboard'}
                    </h1>
                    <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                        {today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                </div>

                {availableTabs.length > 1 && (
                    <div className="flex items-center gap-1 mx-auto p-1 rounded-xl border border-app-border bg-app-surface/50">
                        {availableTabs.map(t => {
                            const active = tab === t.key
                            return (
                                <button key={t.key} onClick={() => { setTab(t.key); setTabManuallyChosen(true) }}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-tp-xs md:text-tp-sm font-bold transition-all ${
                                            active
                                                ? 'text-app-primary bg-app-surface shadow-sm'
                                                : 'text-app-muted-foreground hover:text-app-foreground'
                                        }`}>
                                    <t.Icon size={13} /> {t.label}
                                </button>
                            )
                        })}
                    </div>
                )}

                <button onClick={() => load(true)} disabled={refreshing}
                        className="toolbar-btn text-app-muted-foreground disabled:opacity-50">
                    {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={13} />}
                    <span className="hidden sm:inline">Refresh</span>
                </button>
                <style jsx>{`
                    .toolbar-btn { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.6875rem; font-weight: 700; border: 1px solid var(--app-border); padding: 0.375rem 0.625rem; border-radius: 0.75rem; transition: all 0.2s; }
                    .toolbar-btn:hover { background: var(--app-surface); color: var(--app-foreground); }
                `}</style>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-6 pb-4 md:pb-6"
                     style={{
                         display: 'grid',
                         gridTemplateRows: 'auto auto minmax(0, 1fr)',
                         alignContent: 'start',
                         gap: '10px',
                     }}>

                    {/* ═════════════════ ME TAB ═════════════════ */}
                    {tab === 'me' && meStats && (
                        <>
                            {/* HERO — bold greeting band with gradient, no card */}
                            <div className="rounded-2xl px-5 py-4 flex items-center gap-5 flex-wrap"
                                 style={{
                                     background: `linear-gradient(135deg,
                                         color-mix(in srgb, var(--app-primary) 14%, var(--app-surface)),
                                         color-mix(in srgb, #8b5cf6 10%, var(--app-surface)) 60%,
                                         var(--app-surface))`,
                                     border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                 }}>
                                <ProgressRing size={72} stroke={8}
                                    value={meStats.doneThisWeek} max={meStats.weeklyGoal}
                                    color="var(--app-primary)" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-tp-xl md:text-tp-2xl font-bold leading-tight" style={{ color: 'var(--app-foreground)' }}>
                                        {meStats.doneThisWeek === 0
                                            ? `Let's make it a productive week, ${me?.first_name || 'friend'}.`
                                            : meStats.doneThisWeek >= meStats.weeklyGoal
                                                ? `You've crushed your weekly goal. 🔥`
                                                : `${meStats.doneThisWeek} down, ${meStats.weeklyGoal - meStats.doneThisWeek} to go.`}
                                    </div>
                                    <div className="text-tp-sm mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {meStats.streak > 0 && <span className="font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>🔥 {meStats.streak}-day streak · </span>}
                                        {meStats.openCount} open · {meStats.delegatedByMe} delegated
                                    </div>
                                </div>
                                {agenda.length > 0 && (
                                    <div className="px-3 py-2 rounded-xl flex items-center gap-2"
                                         style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                        <AlertTriangle size={14} />
                                        <span className="text-tp-sm font-bold">{agenda.length} need attention</span>
                                    </div>
                                )}
                            </div>

                            {/* 4 stat tiles — colorful, gradient-tinted, no uniform card look */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                                <StatWithSpark label="Open tasks" value={meStats.openCount}
                                    color="var(--app-foreground)" Icon={Target}
                                    series={sparkline14d.map(s => s.created)} />
                                <StatWithSpark label="Done · 7d" value={meStats.doneThisWeek}
                                    color="var(--app-success, #22c55e)" Icon={CheckCircle2}
                                    series={sparkline14d.map(s => s.done)}
                                    trend={{ diff: wow.diff, pct: wow.pct }} />
                                <StatWithSpark label="Streak" value={meStats.streak}
                                    color="var(--app-warning, #f59e0b)" Icon={Flame}
                                    sub={meStats.streak === 0 ? 'start today' : `day${meStats.streak === 1 ? '' : 's'}`} />
                                <StatWithSpark label="Delegated" value={meStats.delegatedByMe}
                                    color="var(--app-info, #3b82f6)" Icon={Users}
                                    sub="awaiting others" />
                            </div>

                            {/* Personal kanban board — fills remaining height */}
                            <div className="min-h-0">
                                <Board board={board} today={today} userMap={userMap} />
                            </div>
                        </>
                    )}

                    {/* ═════════════════ TEAM TAB ═════════════════ */}
                    {tab === 'team' && (
                        <>
                            {/* Hero: velocity chart + weekly comparison */}
                            <div className="p-5 rounded-2xl"
                                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="flex items-center gap-3 mb-4 flex-wrap">
                                    <TrendingUp size={14} style={{ color: 'var(--app-primary)' }} />
                                    <h2 className="text-tp-sm font-bold uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                                        Team velocity · 14 days
                                    </h2>
                                    <div className="flex items-center gap-4 ml-auto text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-success, #22c55e)' }} /> Completed</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-muted-foreground)' }} /> Created</span>
                                    </div>
                                </div>
                                <VelocityChart data={sparkline14d} />
                                <div className="flex items-center gap-4 mt-3 text-tp-xs flex-wrap" style={{ color: 'var(--app-muted-foreground)' }}>
                                    <span><strong style={{ color: 'var(--app-success, #22c55e)' }}>{wow.thisW}</strong> completed this week</span>
                                    <span><strong style={{ color: 'var(--app-muted-foreground)' }}>{wow.prevW}</strong> last week</span>
                                    <span className="flex items-center gap-1 font-bold" style={{ color: wow.diff > 0 ? 'var(--app-success, #22c55e)' : wow.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                        {wow.diff > 0 ? <TrendingUp size={11} /> : wow.diff < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                                        {wow.diff > 0 ? '+' : ''}{wow.pct}%
                                    </span>
                                </div>
                            </div>

                            {/* Stats strip — compact */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                <StatWithSpark label="Members" value={teamMemberIds.size} color="var(--app-foreground)" Icon={Users} />
                                <StatWithSpark label="Open" value={totalOpen} color="var(--app-info, #3b82f6)" Icon={Target} />
                                <StatWithSpark label="On fire" value={board.now.length} color="var(--app-error, #ef4444)" Icon={Flame} />
                                <StatWithSpark label="Done · 7d" value={wow.thisW} color="var(--app-success, #22c55e)" Icon={CheckCircle2}
                                    series={sparkline14d.map(s => s.done)} trend={{ diff: wow.diff, pct: wow.pct }} />
                            </div>

                            {/* Main row: board + team load side-by-side, fills remaining height */}
                            <div className="min-h-0" style={{ display: 'grid', gridTemplateColumns: teamLoad.length > 0 ? 'minmax(0, 3fr) minmax(240px, 1fr)' : '1fr', gap: '12px' }}>
                                <div className="min-h-0">
                                    <Board board={board} today={today} userMap={userMap} />
                                </div>
                                {teamLoad.length > 0 && (
                                    <div className="p-3 rounded-2xl flex flex-col min-h-0"
                                         style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                            <Users size={12} style={{ color: 'var(--app-primary)' }} />
                                            <h2 className="text-tp-xs font-bold uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                                                Team load
                                            </h2>
                                        </div>
                                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                                            <LoadDistribution rows={teamLoad} meId={me?.id} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ═════════════════ COMPANY TAB ═════════════════ */}
                    {tab === 'company' && (
                        <>
                            {/* BRIEFING CARD — one unified hero that tells the company story in plain English */}
                            <div className="relative overflow-hidden rounded-2xl p-5"
                                 style={{
                                     background: `linear-gradient(135deg,
                                         color-mix(in srgb, ${companyStats.healthScore >= 75 ? 'var(--app-success, #22c55e)' : companyStats.healthScore >= 50 ? 'var(--app-warning, #f59e0b)' : 'var(--app-error, #ef4444)'} 10%, var(--app-surface)),
                                         var(--app-surface) 55%,
                                         color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)))`,
                                     border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                 }}>
                                <div className="flex items-center gap-5 flex-wrap">
                                    <ProgressRing size={88} stroke={10}
                                        value={companyStats.healthScore} max={100}
                                        color={companyStats.healthScore >= 75 ? 'var(--app-success, #22c55e)'
                                            : companyStats.healthScore >= 50 ? 'var(--app-warning, #f59e0b)'
                                            : 'var(--app-error, #ef4444)'}
                                        label={`${companyStats.healthScore}`} sublabel="Health" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-tp-xl font-bold leading-tight" style={{ color: 'var(--app-foreground)' }}>
                                            {companyStats.healthScore >= 75 ? 'Operations running smoothly.'
                                             : companyStats.healthScore >= 50 ? 'Keeping an eye on things.'
                                             : 'Needs your attention.'}
                                        </div>
                                        <div className="text-tp-sm mt-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{companyStats.open}</span> task{companyStats.open === 1 ? '' : 's'} open
                                            {companyStats.overdue > 0 && <> · <span className="font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>{companyStats.overdue} overdue</span></>}
                                            {companyStats.urgent > 0 && <> · <span className="font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>{companyStats.urgent} urgent</span></>}
                                            {' · '}
                                            <span className="font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>{companyStats.doneThisWeek} shipped</span> this week
                                            {companyStats.wowPct !== 0 && (
                                                <span className="inline-flex items-center gap-0.5 ml-1 font-bold"
                                                      style={{ color: companyStats.wowDiff > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                                    ({companyStats.wowDiff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                    {companyStats.wowDiff > 0 ? '+' : ''}{companyStats.wowPct}%)
                                                </span>
                                            )}
                                            {' · '}
                                            <span className="font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>{companyStats.autoPct}%</span> automated
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <Sparkline values={sparkline14d.map(s => s.done)} color="var(--app-success, #22c55e)" width={160} height={44} />
                                        <div className="text-tp-xxs text-center mt-1" style={{ color: 'var(--app-muted-foreground)' }}>last 14 days</div>
                                    </div>
                                </div>
                            </div>

                            {/* Zero-aware stat strip — only show cards with value > 0 */}
                            {(companyStats.urgent > 0 || companyStats.unassigned > 0 || companyStats.overdue > 0) && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                    {companyStats.overdue > 0 && <MiniKPI label="Overdue" value={companyStats.overdue} color="var(--app-error, #ef4444)" />}
                                    {companyStats.urgent > 0 && <MiniKPI label="Urgent" value={companyStats.urgent} color="var(--app-warning, #f59e0b)" />}
                                    {companyStats.unassigned > 0 && <MiniKPI label="Unassigned" value={companyStats.unassigned} color="#8b5cf6" />}
                                </div>
                            )}

                            {/* Row fills — leaderboard + categories side-by-side lists */}
                            <div className="min-h-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                <section className="p-4 rounded-2xl flex flex-col min-h-0"
                                         style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                                        <Trophy size={14} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>Top performers</span>
                                        <span className="text-tp-xxs ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>last 7 days</span>
                                    </div>
                                    {companyStats.leaderboard.length === 0 ? (
                                        <div className="text-tp-sm py-4" style={{ color: 'var(--app-muted-foreground)' }}>No completions yet.</div>
                                    ) : (
                                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2.5">
                                            {companyStats.leaderboard.map((r, i) => {
                                                const maxPts = companyStats.leaderboard[0]?.points || 1
                                                const pct = (r.points / maxPts) * 100
                                                return (
                                                    <div key={r.user?.id ?? i}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-tp-xxs font-bold tabular-nums w-5 text-center"
                                                                  style={{ color: i === 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' }}>#{i + 1}</span>
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-tp-xxs font-bold flex-shrink-0"
                                                                 style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                                                {fullName(r.user).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0 text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                                {fullName(r.user)}
                                                            </div>
                                                            <span className="text-tp-xs tabular-nums font-bold" style={{ color: 'var(--app-foreground)' }}>
                                                                {r.points} pts · {r.done} done
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full overflow-hidden ml-7"
                                                             style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                            <div className="h-full rounded-full"
                                                                 style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #8b5cf6))' }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </section>

                                <section className="p-4 rounded-2xl flex flex-col min-h-0"
                                         style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                                        <Target size={14} style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>Biggest categories</span>
                                        <span className="text-tp-xxs ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>open tasks</span>
                                    </div>
                                    {companyStats.topCategories.length === 0 ? (
                                        <div className="text-tp-sm py-4" style={{ color: 'var(--app-muted-foreground)' }}>No categorised work yet.</div>
                                    ) : (
                                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2.5">
                                            {companyStats.topCategories.map(([name, count]) => {
                                                const pct = companyStats.open > 0 ? (count / companyStats.open) * 100 : 0
                                                return (
                                                    <div key={name}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{name}</span>
                                                            <span className="text-tp-xxs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                                {count} · {pct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full overflow-hidden"
                                                             style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                            <div className="h-full rounded-full"
                                                                 style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #8b5cf6))' }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </>
                    )}

                </div>
            )}
        </div>
    )
}

/* ───────────────────────────── Subcomponents ───────────────────────────── */

function MiniKPI({ label, value, color, trend }: {
    label: string; value: number | string; color: string;
    trend?: { diff: number; pct: number };
}) {
    return (
        <div className="relative px-3 py-2 rounded-xl overflow-hidden"
             style={{
                 background: `linear-gradient(135deg, color-mix(in srgb, ${color} 10%, var(--app-surface)), var(--app-surface))`,
                 border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
             }}>
            <div className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            <div className="flex items-baseline gap-1.5">
                <div className="text-tp-xl font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
                {trend && (
                    <span className="text-tp-xxs font-bold flex items-center gap-0.5"
                          style={{ color: trend.diff > 0 ? 'var(--app-success, #22c55e)' : trend.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                        {trend.diff > 0 ? <TrendingUp size={9} /> : trend.diff < 0 ? <TrendingDown size={9} /> : <Minus size={9} />}
                        {trend.diff > 0 ? '+' : ''}{trend.pct}%
                    </span>
                )}
            </div>
        </div>
    )
}

function Sparkline({ values, color, height = 28, width = 100 }: {
    values: number[]; color: string; height?: number; width?: number;
}) {
    if (values.length === 0) return null
    const max = Math.max(1, ...values)
    const step = values.length > 1 ? width / (values.length - 1) : 0
    const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`).join(' ')
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polyline fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" points={points} />
            {values.map((v, i) => {
                const x = i * step
                const y = height - (v / max) * (height - 2) - 1
                return <circle key={i} cx={x} cy={y} r={v === max && v > 0 ? 2 : 0} fill={color} />
            })}
        </svg>
    )
}

function StatWithSpark({ label, value, color, Icon, series, sub, trend }: {
    label: string; value: number | string; color: string;
    Icon: React.ComponentType<{ size?: number }>;
    series?: number[]; sub?: string;
    trend?: { diff: number; pct: number };
}) {
    return (
        <div className="relative px-4 py-3 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5"
             style={{
                 background: `linear-gradient(135deg, color-mix(in srgb, ${color} 8%, var(--app-surface)), var(--app-surface) 70%)`,
                 border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
             }}>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full"
                 style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }} />
            <div className="relative flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: color, color: 'white', boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)` }}>
                    <Icon size={14} />
                </div>
                <div className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                {trend && (
                    <span className="ml-auto flex items-center gap-0.5 text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                          style={{
                              background: `color-mix(in srgb, ${trend.diff > 0 ? 'var(--app-success, #22c55e)' : trend.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)'} 15%, transparent)`,
                              color: trend.diff > 0 ? 'var(--app-success, #22c55e)' : trend.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)',
                          }}>
                        {trend.diff > 0 ? <TrendingUp size={10} /> : trend.diff < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                        {trend.diff > 0 ? '+' : ''}{trend.pct}%
                    </span>
                )}
            </div>
            <div className="relative flex items-end justify-between gap-2">
                <div>
                    <div className="text-tp-3xl font-bold tabular-nums leading-none" style={{ color: 'var(--app-foreground)' }}>{value}</div>
                    {sub && <div className="text-tp-xxs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>{sub}</div>}
                </div>
                {series && series.length > 0 && <Sparkline values={series} color={color} />}
            </div>
        </div>
    )
}

function HeroStat({ label, value, color, Icon, sub, trend }: {
    label: string; value: number | string; color: string;
    Icon: React.ComponentType<{ size?: number }>; sub?: string;
    trend?: { diff: number; pct: number };
}) {
    return (
        <div className="p-5 rounded-2xl relative overflow-hidden"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full"
                 style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }} />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <div className="text-tp-xxs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-tp-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
                        {trend && (
                            <div className="flex items-center gap-0.5 text-tp-xs font-bold"
                                 style={{ color: trend.diff > 0 ? 'var(--app-success, #22c55e)' : trend.diff < 0 ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                {trend.diff > 0 ? <TrendingUp size={12} /> : trend.diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                {trend.diff > 0 ? '+' : ''}{trend.pct}%
                            </div>
                        )}
                    </div>
                    {sub && <div className="text-tp-xs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>{sub}</div>}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    )
}

function ProgressRing({ size, stroke, value, max, color, label, sublabel }: {
    size: number; stroke: number; value: number; max: number; color: string;
    label?: string; sublabel?: string;
}) {
    const pct = Math.max(0, Math.min(1, value / max))
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const offset = c * (1 - pct)
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke="color-mix(in srgb, var(--app-border) 60%, transparent)"
                        strokeWidth={stroke} />
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                        stroke={color} strokeWidth={stroke} strokeLinecap="round"
                        strokeDasharray={c} strokeDashoffset={offset}
                        transform={`rotate(-90 ${size/2} ${size/2})`}
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
                <div className="text-tp-3xl font-bold tabular-nums leading-none" style={{ color: 'var(--app-foreground)' }}>
                    {label ?? value}
                </div>
                <div className="text-tp-xs font-bold mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                    {sublabel ?? `of ${max}`}
                </div>
            </div>
        </div>
    )
}

function VelocityChart({ data }: { data: { day: string; done: number; created: number }[] }) {
    const maxVal = Math.max(1, ...data.map(d => Math.max(d.done, d.created)))
    const height = 120
    const barWidth = 100 / data.length
    return (
        <div>
            <div className="relative" style={{ height, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {data.map((d, i) => {
                    const doneH = (d.done / maxVal) * (height - 4)
                    const createdH = (d.created / maxVal) * (height - 4)
                    return (
                        <div key={i} className="relative flex-1 flex items-end justify-center group" style={{ height }}>
                            <div className="w-full flex items-end gap-0.5 justify-center">
                                <div style={{
                                    width: '42%', height: createdH || 1,
                                    background: 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)',
                                    borderRadius: 2,
                                }} title={`${d.created} created ${d.day}`} />
                                <div style={{
                                    width: '42%', height: doneH || 1,
                                    background: 'var(--app-success, #22c55e)',
                                    borderRadius: 2,
                                }} title={`${d.done} completed ${d.day}`} />
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex mt-1.5" style={{ gap: 4 }}>
                {data.map((d, i) => {
                    const date = new Date(d.day)
                    const isFirst = i === 0 || date.getDate() === 1 || i % 3 === 0
                    return (
                        <div key={i} className="flex-1 text-center text-tp-xxs tabular-nums"
                             style={{ color: 'var(--app-muted-foreground)' }}>
                            {isFirst ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function Heatmap30({ days }: { days: { iso: string; dow: number; count: number }[] }) {
    const max = Math.max(1, ...days.map(d => d.count))
    // Arrange into 5 rows × 6 cols approximation — simpler: single row with day labels below weekly groups
    return (
        <div className="flex items-center gap-1">
            {days.map(d => {
                const intensity = d.count === 0 ? 0 : d.count / max
                const bg = intensity === 0
                    ? 'color-mix(in srgb, var(--app-border) 60%, transparent)'
                    : `color-mix(in srgb, var(--app-success, #22c55e) ${Math.round(20 + intensity * 70)}%, transparent)`
                return (
                    <div key={d.iso}
                         title={`${d.iso}: ${d.count} completion${d.count === 1 ? '' : 's'}`}
                         style={{
                             width: 18, height: 18, borderRadius: 4, background: bg,
                             border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                             flex: '0 0 auto',
                         }} />
                )
            })}
        </div>
    )
}

function LoadDistribution({ rows, meId }: {
    rows: { user: UserRow; pending: number; overdue: number; done7d: number }[];
    meId?: number;
}) {
    const totalCapacity = Math.max(1, ...rows.map(r => r.pending + r.overdue + r.done7d))
    return (
        <div className="space-y-2.5">
            {rows.map(r => {
                const total = r.pending + r.overdue + r.done7d
                const ratio = total / totalCapacity
                return (
                    <div key={r.user.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-tp-sm font-bold flex-shrink-0"
                             style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                            {fullName(r.user).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 text-tp-sm">
                                <span className="font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                    {fullName(r.user)}{r.user.id === meId && ' (you)'}
                                </span>
                                <span className="tabular-nums font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {total}
                                </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)', width: `${Math.max(20, ratio * 100)}%` }}>
                                <div style={{ flex: r.pending || 0.0001, background: 'var(--app-muted-foreground)' }} title={`${r.pending} pending`} />
                                <div style={{ flex: r.overdue || 0.0001, background: 'var(--app-error, #ef4444)' }} title={`${r.overdue} overdue`} />
                                <div style={{ flex: r.done7d || 0.0001, background: 'var(--app-success, #22c55e)' }} title={`${r.done7d} done 7d`} />
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function Board({ board, today, userMap, compact }: {
    board: Record<Lane, Task[]>; today: Date; userMap: Map<number, UserRow>; compact?: boolean;
}) {
    return (
        <div className="h-full overflow-x-auto custom-scrollbar -mx-2 px-2">
            <div className="flex gap-3 h-full min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
                {(['now', 'today', 'week', 'later'] as Lane[]).map(lane => {
                    const meta = LANE_META[lane]; const items = board[lane]
                    return (
                        <div key={lane} className="w-[260px] lg:w-auto flex flex-col rounded-2xl overflow-hidden"
                             style={{
                                 background: `linear-gradient(180deg, color-mix(in srgb, ${meta.color} 4%, var(--app-bg)), var(--app-bg) 80%)`,
                                 border: `1px solid color-mix(in srgb, ${meta.color} 18%, transparent)`,
                             }}>
                            <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
                                 style={{ borderBottom: `1px solid color-mix(in srgb, ${meta.color} 15%, transparent)` }}>
                                <span className="w-1.5 h-5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px color-mix(in srgb, ${meta.color} 50%, transparent)` }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>{meta.title}</div>
                                    {!compact && <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>{meta.sub}</div>}
                                </div>
                                <span className="text-tp-sm font-bold tabular-nums"
                                      style={{ color: items.length > 0 ? meta.color : 'var(--app-muted-foreground)' }}>
                                    {items.length}
                                </span>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                                {items.length === 0 ? (
                                    <div className="text-center py-6 text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {lane === 'now' ? '🎉 Nothing on fire' : 'Nothing'}
                                    </div>
                                ) : (compact ? items.slice(0, 5) : items).map(t => {
                                    const pColor = PRIORITY_COLOR[t.priority] || 'var(--app-muted-foreground)'
                                    const assignee = t.assigned_to ? userMap.get(t.assigned_to) : null
                                    const name = assignee ? fullName(assignee) : (t.assigned_to_name || null)
                                    return (
                                        <Link key={t.id} href={`/workspace/tasks?focus=${t.id}`}
                                              className="block p-2.5 rounded-lg transition-all hover:-translate-y-0.5"
                                              style={{
                                                  background: 'var(--app-surface)', border: '1px solid var(--app-border)',
                                                  borderLeft: `3px solid ${pColor}`,
                                              }}>
                                            <div className="text-tp-sm font-bold leading-snug mb-1" style={{ color: 'var(--app-foreground)' }}>
                                                {t.title}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap text-tp-xxs">
                                                <span className="font-bold uppercase tracking-wider" style={{ color: pColor }}>
                                                    <Flag size={8} className="inline mb-0.5" /> {t.priority[0] + t.priority.slice(1).toLowerCase()}
                                                </span>
                                                {t.due_date && (
                                                    <span className="font-medium flex items-center gap-0.5"
                                                          style={{ color: t.is_overdue ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                        <Clock size={9} /> {relDue(t.due_date, today)}
                                                    </span>
                                                )}
                                                {name ? (
                                                    <span className="ml-auto font-medium truncate" style={{ color: 'var(--app-muted-foreground)', maxWidth: 90 }}>{name}</span>
                                                ) : (
                                                    <span className="ml-auto font-bold flex items-center gap-1" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                                        <UserX size={9} /> unassigned
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    )
                                })}
                                {compact && items.length > 5 && (
                                    <div className="text-center text-tp-xxs pt-1" style={{ color: 'var(--app-muted-foreground)' }}>+{items.length - 5} more</div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
