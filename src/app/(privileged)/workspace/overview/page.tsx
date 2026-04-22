'use client'

/**
 * Manager Overview — Role-Targeted Dashboard
 * ==========================================
 * One page, three audiences. The active tab auto-defaults to the role that
 * best fits the logged-in user:
 *
 *   • ME       — "What do I personally need to do today?"
 *                Shown to every user. Personal kanban + streak.
 *   • TEAM     — "How is my team doing? Who's behind? Who needs help?"
 *                Shown when the user is a leader (has direct reports OR is
 *                assignee on category.leader OR is_staff/manager role).
 *   • COMPANY  — "How is the whole operation running?"
 *                Shown to owner / admin / superuser. Org-wide signals and
 *                team comparison.
 *
 * Philosophy: same data source (/api/tasks/) sliced three ways. The ME view
 * is always accessible so every employee has a home; escalating privileges
 * unlock broader lenses.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
    Loader2, RefreshCcw, Flame, Clock, Calendar, Archive, CheckCircle2, UserX,
    Zap, User as UserIcon, ArrowRight, AlertTriangle, Users, Building2, Trophy,
    TrendingUp, TrendingDown, Minus, Flag, Target,
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

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: 'var(--app-error, #ef4444)',
    HIGH: 'var(--app-warning, #f59e0b)',
    MEDIUM: 'var(--app-info, #3b82f6)',
    LOW: 'var(--app-muted-foreground)',
}

type Lane = 'now' | 'today' | 'week' | 'later' | 'nodate'
const LANE_META: Record<Lane, { title: string; sub: string; color: string; Icon: React.ComponentType<{ size?: number }> }> = {
    now:    { title: 'NOW',       sub: 'Fires + overdue',      color: 'var(--app-error, #ef4444)',   Icon: Flame },
    today:  { title: 'TODAY',     sub: 'Due today',             color: 'var(--app-warning, #f59e0b)', Icon: Clock },
    week:   { title: 'THIS WEEK', sub: 'Next 7 days',           color: 'var(--app-info, #3b82f6)',    Icon: Calendar },
    later:  { title: 'LATER',     sub: 'Beyond this week',      color: 'var(--app-success, #22c55e)', Icon: Archive },
    nodate: { title: 'NO DATE',   sub: 'Need planning',         color: 'var(--app-muted-foreground)', Icon: UserX },
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
    const diffDays = Math.round((b.getTime() - a.getTime()) / 86_400_000)
    if (diffDays < -1) return `${Math.abs(diffDays)}d late`
    if (diffDays === -1) return '1d late'
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'tomorrow'
    if (diffDays < 7) return `in ${diffDays}d`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function relDone(iso: string | undefined, now: Date): string {
    if (!iso) return ''
    const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000))
    if (mins < 60) return `${Math.max(1, mins)}m`
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / (60 * 24))}d`
}

type Tab = 'me' | 'team' | 'company'

export default function RoleAwareOverviewPage() {
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
                erpFetch('users/me/').catch(() => null),
            ])
            setTasks(Array.isArray(t) ? t : (t as any)?.results ?? [])
            setUsers(Array.isArray(u) ? u : (u as any)?.results ?? [])
            if (meRes) setMe(meRes as Me)
        } finally { setLoading(false); setRefreshing(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const today = new Date()
    const todayIso = toIso(today)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    const weekIso = toIso(weekEnd)
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoIso = toIso(weekAgo)

    const userMap = useMemo(() => {
        const m = new Map<number, UserRow>()
        for (const u of users) m.set(u.id, u)
        return m
    }, [users])

    // ── Role detection ───────────────────────────────────────────────────
    // Owner = explicit role OR is_superuser. Leader = is_staff OR has any
    // user reporting to them (user.leader === me.id) OR assigned_by any task
    // they didn't self-assign. Every user always sees Me.
    const role = useMemo(() => {
        const isOwner = !!(me?.is_superuser || (me as any)?.role === 'owner' || (me as any)?.role === 'admin')
        const hasReports = !!me && users.some(u => u.leader === me.id)
        const assignsWork = !!me && tasks.some(t => t.assigned_by === me.id && t.assigned_to !== me.id)
        const isLeader = !!(me?.is_staff || hasReports || assignsWork)
        return { isOwner, isLeader, isUser: true }
    }, [me, users, tasks])

    // Default tab = the highest-privilege tab the user qualifies for.
    useEffect(() => {
        if (tabManuallyChosen || !me) return
        if (role.isOwner) setTab('company')
        else if (role.isLeader) setTab('team')
        else setTab('me')
    }, [role, me, tabManuallyChosen])

    // ── Task slices per tab ──────────────────────────────────────────────
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
    const companyTasks = tasks

    const activeTasks = tab === 'me' ? myTasks : tab === 'team' ? teamTasks : companyTasks

    // ── Common board computation — reused for Me and Team tabs ──────────
    const board = useMemo(() => {
        const lanes: Record<Lane, Task[]> = { now: [], today: [], week: [], later: [], nodate: [] }
        for (const t of activeTasks) {
            const l = laneOf(t, todayIso, weekIso)
            if (l) lanes[l].push(t)
        }
        const rank = (p: string) => p === 'URGENT' ? 0 : p === 'HIGH' ? 1 : p === 'MEDIUM' ? 2 : 3
        for (const key of Object.keys(lanes) as Lane[]) {
            lanes[key].sort((a, b) => {
                const r = rank(a.priority) - rank(b.priority)
                if (r !== 0) return r
                return (a.due_date || '9999').localeCompare(b.due_date || '9999')
            })
        }
        return lanes
    }, [activeTasks, todayIso, weekIso])

    const totalOpen = board.now.length + board.today.length + board.week.length + board.later.length + board.nodate.length

    // ── Me-specific stats: streak + done this week ──────────────────────
    const meStats = useMemo(() => {
        if (!me) return null
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
        // Simple streak: count consecutive days with ≥1 completion, ending today
        const byDay = new Set<string>()
        for (const t of tasks) {
            if (t.assigned_to === me.id && t.status === 'COMPLETED' && t.completed_at) {
                byDay.add(t.completed_at.slice(0, 10))
            }
        }
        let streak = 0
        for (let i = 0; i < 30; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i)
            if (byDay.has(toIso(d))) streak++; else break
        }
        return { doneThisWeek, pointsThisWeek, streak, delegatedByMe }
    }, [tasks, me, weekAgoIso, today])

    // ── Team view: per-member load breakdown ────────────────────────────
    const teamLoad = useMemo(() => {
        type Row = { user: UserRow; pending: number; overdue: number; completed7d: number; points7d: number }
        const m = new Map<number, Row>()
        for (const uid of teamMemberIds) {
            const u = userMap.get(uid); if (!u) continue
            m.set(uid, { user: u, pending: 0, overdue: 0, completed7d: 0, points7d: 0 })
        }
        for (const t of teamTasks) {
            if (!t.assigned_to) continue
            const row = m.get(t.assigned_to); if (!row) continue
            if (t.status === 'COMPLETED') {
                if (t.completed_at && t.completed_at.slice(0, 10) >= weekAgoIso) {
                    row.completed7d++; row.points7d += t.points || 1
                }
            } else if (t.status !== 'CANCELLED') {
                row.pending++; if (t.is_overdue) row.overdue++
            }
        }
        return Array.from(m.values()).sort((a, b) =>
            (b.overdue - a.overdue) || (b.pending - a.pending) || (b.completed7d - a.completed7d)
        )
    }, [teamTasks, teamMemberIds, userMap, weekAgoIso])

    // ── Company view: org-wide comparative stats ────────────────────────
    const companyStats = useMemo(() => {
        let open = 0, overdue = 0, urgent = 0, unassigned = 0, auto = 0, manual = 0
        let doneThisWeek = 0, doneLastWeek = 0
        const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
        const twoWeeksAgoIso = toIso(twoWeeksAgo)
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
        const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        const leaderboard = Array.from(byAssignee.values())
            .filter(r => r.user !== null)
            .sort((a, b) => b.points - a.points || b.done - a.done)
            .slice(0, 5)
        const autoPct = (auto + manual) > 0 ? Math.round((auto / (auto + manual)) * 100) : 0
        return { open, overdue, urgent, unassigned, doneThisWeek, doneLastWeek, wowDiff, wowPct, autoPct, topCategories, leaderboard }
    }, [tasks, userMap, weekAgoIso, today])

    // ── Header tabs that the user can see ───────────────────────────────
    const availableTabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
        { key: 'me', label: 'Me', Icon: UserIcon },
        ...(role.isLeader ? [{ key: 'team' as Tab, label: 'My team', Icon: Users }] : []),
        ...(role.isOwner ? [{ key: 'company' as Tab, label: 'Company', Icon: Building2 }] : []),
    ]

    return (
        <div className="flex flex-col h-full">
            {/* ── Top bar: title + tabs + refresh ── */}
            <header className="flex-shrink-0 px-5 md:px-8 pt-4 pb-0 border-b"
                    style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <div className="flex items-center gap-4 flex-wrap mb-3">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl md:text-2xl font-black" style={{ color: 'var(--app-foreground)' }}>
                            {tab === 'me' ? `Hi, ${me?.first_name || me?.username || 'there'}`
                             : tab === 'team' ? 'Team dashboard'
                             : 'Company dashboard'}
                        </h1>
                        <span className="text-tp-sm hidden md:inline" style={{ color: 'var(--app-muted-foreground)' }}>
                            {today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                    <button onClick={() => load(true)} disabled={refreshing}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-tp-sm font-bold transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                        {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                        Refresh
                    </button>
                </div>

                {/* Tabs — only shown if user qualifies for more than one */}
                {availableTabs.length > 1 && (
                    <div className="flex items-center gap-1">
                        {availableTabs.map(t => {
                            const active = tab === t.key
                            return (
                                <button key={t.key}
                                        onClick={() => { setTab(t.key); setTabManuallyChosen(true) }}
                                        className="flex items-center gap-1.5 px-3 py-2 text-tp-sm font-bold transition-all"
                                        style={{
                                            color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                            borderBottom: `2px solid ${active ? 'var(--app-primary)' : 'transparent'}`,
                                            marginBottom: '-1px',
                                        }}>
                                    <t.Icon size={13} />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            </header>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 md:px-8 py-5 space-y-6">

                    {/* ═══════════════════════ ME TAB ═══════════════════════ */}
                    {tab === 'me' && (
                        <>
                            {/* Personal stats strip */}
                            {meStats && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                    <StatCard label="Open tasks" value={myTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length} color="var(--app-foreground)" Icon={Target} />
                                    <StatCard label="Done · 7d" value={meStats.doneThisWeek} color="var(--app-success, #22c55e)" Icon={CheckCircle2} sub={`${meStats.pointsThisWeek} pts`} />
                                    <StatCard label="Streak" value={meStats.streak} color="var(--app-warning, #f59e0b)" Icon={Flame} sub={meStats.streak === 0 ? 'start today' : `day${meStats.streak === 1 ? '' : 's'} in a row`} />
                                    <StatCard label="Delegated" value={meStats.delegatedByMe} color="var(--app-info, #3b82f6)" Icon={Users} sub="awaiting others" />
                                </div>
                            )}

                            {/* Personal kanban board */}
                            <Board board={board} today={today} userMap={userMap} />

                            {/* Total counter */}
                            <div className="text-tp-xs text-center" style={{ color: 'var(--app-muted-foreground)' }}>
                                {totalOpen === 0 ? "You're clear. Enjoy the calm." : `${totalOpen} open task${totalOpen === 1 ? '' : 's'} on your board`}
                            </div>
                        </>
                    )}

                    {/* ═══════════════════════ TEAM TAB ═══════════════════════ */}
                    {tab === 'team' && (
                        <>
                            {/* Team at-a-glance */}
                            <div className="flex items-center gap-3 text-tp-sm flex-wrap" style={{ color: 'var(--app-muted-foreground)' }}>
                                <span><strong style={{ color: 'var(--app-foreground)' }}>{teamMemberIds.size}</strong> member{teamMemberIds.size === 1 ? '' : 's'}</span>
                                <span><strong style={{ color: 'var(--app-foreground)' }}>{totalOpen}</strong> open</span>
                                {board.now.length > 0 && <span><strong style={{ color: 'var(--app-error, #ef4444)' }}>{board.now.length}</strong> on fire</span>}
                            </div>

                            {/* Team-wide kanban */}
                            <Board board={board} today={today} userMap={userMap} />

                            {/* Member load */}
                            {teamLoad.length > 0 && (
                                <section>
                                    <h2 className="text-tp-sm font-black uppercase tracking-widest mb-3"
                                        style={{ color: 'var(--app-foreground)' }}>
                                        <Users size={13} className="inline mb-0.5 mr-1.5" style={{ color: 'var(--app-muted-foreground)' }} />
                                        Team load
                                    </h2>
                                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                        {teamLoad.map((row, i) => {
                                            const busy = row.overdue > 0 ? 'behind'
                                                : row.pending >= 5 ? 'heavy' : row.pending > 0 ? 'steady' : 'free'
                                            const color = row.overdue > 0 ? 'var(--app-error, #ef4444)'
                                                : row.pending >= 5 ? 'var(--app-warning, #f59e0b)'
                                                : row.pending > 0 ? 'var(--app-foreground)' : 'var(--app-success, #22c55e)'
                                            return (
                                                <Link key={row.user.id}
                                                      href={`/workspace/tasks?assignee=${row.user.id}`}
                                                      className="flex items-center gap-4 px-4 py-3 transition-all hover:bg-app-surface/60"
                                                      style={{ borderTop: i === 0 ? undefined : '1px solid var(--app-border)' }}>
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-black text-tp-md"
                                                         style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                        {fullName(row.user).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                            {fullName(row.user)}{row.user.id === me?.id && ' (you)'}
                                                        </div>
                                                        <div className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                                            {row.pending} open · {row.completed7d} done · {row.points7d} pts
                                                        </div>
                                                    </div>
                                                    <span className="text-tp-xs font-black uppercase tracking-wider px-2 py-0.5 rounded"
                                                          style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
                                                        {busy}
                                                    </span>
                                                    {row.overdue > 0 && (
                                                        <span className="text-tp-xs font-bold tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                            {row.overdue} late
                                                        </span>
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {/* ═══════════════════════ COMPANY TAB ═══════════════════════ */}
                    {tab === 'company' && (
                        <>
                            {/* Org-wide KPIs — big, colored, proud */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                <HeroStat label="Open tasks" value={companyStats.open} color="var(--app-foreground)" Icon={Target} />
                                <HeroStat label="Overdue" value={companyStats.overdue} color="var(--app-error, #ef4444)" Icon={AlertTriangle} />
                                <HeroStat label="Done · 7d" value={companyStats.doneThisWeek} color="var(--app-success, #22c55e)" Icon={CheckCircle2}
                                          trend={{ diff: companyStats.wowDiff, pct: companyStats.wowPct }} />
                                <HeroStat label="Automated" value={`${companyStats.autoPct}%`} color="var(--app-info, #3b82f6)" Icon={Zap} sub="of tasks" />
                            </div>

                            {/* Secondary row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                <StatCard label="Urgent open" value={companyStats.urgent} color="var(--app-warning, #f59e0b)" Icon={Flame} />
                                <StatCard label="Unassigned" value={companyStats.unassigned} color="#8b5cf6" Icon={UserX} />
                            </div>

                            {/* Leaderboard + Categories in two columns */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                                {/* Top performers */}
                                {companyStats.leaderboard.length > 0 && (
                                    <section className="p-5 rounded-2xl"
                                             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                        <h2 className="text-tp-sm font-black uppercase tracking-widest mb-4 flex items-center gap-1.5"
                                            style={{ color: 'var(--app-foreground)' }}>
                                            <Trophy size={13} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                            Top performers · 7d
                                        </h2>
                                        <div className="space-y-3">
                                            {companyStats.leaderboard.map((r, i) => (
                                                <div key={r.user?.id ?? i} className="flex items-center gap-3">
                                                    <span className="w-6 text-tp-xs font-black tabular-nums text-center"
                                                          style={{ color: i === 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' }}>
                                                        #{i + 1}
                                                    </span>
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-tp-sm font-black"
                                                         style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                        {fullName(r.user).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                            {fullName(r.user)}
                                                        </div>
                                                        <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                                            {r.done} done · {r.points} pts
                                                        </div>
                                                    </div>
                                                    {r.overdue > 0 && (
                                                        <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                                            {r.overdue} late
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Top categories */}
                                {companyStats.topCategories.length > 0 && (
                                    <section className="p-5 rounded-2xl"
                                             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                        <h2 className="text-tp-sm font-black uppercase tracking-widest mb-4 flex items-center gap-1.5"
                                            style={{ color: 'var(--app-foreground)' }}>
                                            <Target size={13} style={{ color: 'var(--app-primary)' }} />
                                            Biggest categories
                                        </h2>
                                        <div className="space-y-3">
                                            {companyStats.topCategories.map(([name, count]) => {
                                                const pct = companyStats.open > 0 ? (count / companyStats.open) * 100 : 0
                                                return (
                                                    <div key={name}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                                                {name}
                                                            </span>
                                                            <span className="text-tp-xs font-black tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                                {count}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 rounded-full overflow-hidden"
                                                             style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                            <div className="h-full rounded-full"
                                                                 style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #8b5cf6))' }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>

                            {/* Company-wide kanban at the bottom */}
                            <section>
                                <h2 className="text-tp-sm font-black uppercase tracking-widest mb-3" style={{ color: 'var(--app-foreground)' }}>
                                    Company board
                                </h2>
                                <Board board={board} today={today} userMap={userMap} compact />
                            </section>
                        </>
                    )}

                    {/* ── Footer jumps ── */}
                    <div className="pt-4 flex items-center gap-5 flex-wrap text-tp-sm border-t"
                         style={{ borderColor: 'var(--app-border)' }}>
                        <Link href="/workspace/tasks" className="font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--app-primary)' }}>
                            All tasks <ArrowRight size={12} />
                        </Link>
                        {(role.isLeader || role.isOwner) && (
                            <Link href="/workspace/auto-task-rules" className="font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--app-primary)' }}>
                                <Zap size={12} /> Automations
                            </Link>
                        )}
                        {role.isOwner && (
                            <Link href="/workspace/leader-tree" className="font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--app-primary)' }}>
                                <Users size={12} /> Team structure
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Subcomponents                                                            */
/* ─────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value, color, Icon, sub }: {
    label: string; value: number | string; color: string;
    Icon: React.ComponentType<{ size?: number }>; sub?: string;
}) {
    return (
        <div className="px-4 py-3 rounded-2xl flex items-center gap-3"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <div className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                <div className="text-xl font-black tabular-nums leading-tight" style={{ color: 'var(--app-foreground)' }}>{value}</div>
                {sub && <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>{sub}</div>}
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
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full"
                 style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }} />
            <div className="relative flex items-start justify-between">
                <div>
                    <div className="text-tp-xxs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
                        {trend && (typeof value === 'number' ? value > 0 : true) && (
                            <div className="flex items-center gap-0.5 text-tp-xs font-black"
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

function Board({ board, today, userMap, compact }: {
    board: Record<Lane, Task[]>;
    today: Date;
    userMap: Map<number, UserRow>;
    compact?: boolean;
}) {
    return (
        <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
            <div className="flex gap-3 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
                {(['now', 'today', 'week', 'later'] as Lane[]).map(lane => {
                    const meta = LANE_META[lane]
                    const items = board[lane]
                    return (
                        <div key={lane} className="w-[260px] lg:w-auto flex flex-col rounded-xl"
                             style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-b"
                                 style={{ borderColor: 'var(--app-border)' }}>
                                <span className="w-1.5 h-5 rounded-full" style={{ background: meta.color }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-foreground)' }}>
                                        {meta.title}
                                    </div>
                                    {!compact && (
                                        <div className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {meta.sub}
                                        </div>
                                    )}
                                </div>
                                <span className="text-tp-sm font-black tabular-nums"
                                      style={{ color: items.length > 0 ? meta.color : 'var(--app-muted-foreground)' }}>
                                    {items.length}
                                </span>
                            </div>
                            <div className="flex-1 p-2 space-y-1.5 min-h-[80px]">
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
                                                <span className="font-black uppercase tracking-wider" style={{ color: pColor }}>
                                                    <Flag size={8} className="inline mb-0.5" /> {t.priority[0] + t.priority.slice(1).toLowerCase()}
                                                </span>
                                                {t.due_date && (
                                                    <span className="font-medium flex items-center gap-0.5"
                                                          style={{ color: t.is_overdue ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                        <Clock size={9} /> {relDue(t.due_date, today)}
                                                    </span>
                                                )}
                                                {name ? (
                                                    <span className="ml-auto font-medium truncate" style={{ color: 'var(--app-muted-foreground)', maxWidth: 90 }}>
                                                        {name}
                                                    </span>
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
                                    <div className="text-center text-tp-xxs pt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        +{items.length - 5} more
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
