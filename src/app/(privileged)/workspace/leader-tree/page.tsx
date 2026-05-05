'use client'

import { useEffect, useMemo, useState } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { Crown, Loader2, Search, ChevronRight, ChevronDown, Users as UsersIcon } from 'lucide-react'

type UserRow = { id: number; username: string; first_name?: string; last_name?: string; is_active?: boolean }
type HierarchyRow = { id: number; user: number; parent_user: number | null; user_name: string; parent_name: string | null }

const fullName = (u: UserRow) =>
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username

export default function LeaderTreePage() {
    const [users, setUsers] = useState<UserRow[]>([])
    const [rows, setRows] = useState<HierarchyRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [savingUserId, setSavingUserId] = useState<number | null>(null)
    const [expanded, setExpanded] = useState<Set<number>>(new Set())

    const load = async () => {
        setLoading(true)
        try {
            const [u, h] = await Promise.all([
                erpFetch('users/').catch(() => []),
                erpFetch('user-hierarchy/').catch(() => []),
            ])
            setUsers(Array.isArray(u) ? u : u?.results || [])
            setRows(Array.isArray(h) ? h : h?.results || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    // Build parent-of-user map (user_id → parent_user_id | null).
    const parentOf = useMemo(() => {
        const m = new Map<number, number | null>()
        for (const r of rows) m.set(r.user, r.parent_user)
        return m
    }, [rows])

    // Build children-of map (parent_user_id → user_id[])
    const childrenOf = useMemo(() => {
        const m = new Map<number, number[]>()
        for (const r of rows) {
            if (r.parent_user != null) {
                const arr = m.get(r.parent_user) || []
                arr.push(r.user)
                m.set(r.parent_user, arr)
            }
        }
        return m
    }, [rows])

    // Roots: users without a parent entry, or entry with parent=null.
    const roots = useMemo(() => {
        return users.filter(u => !parentOf.has(u.id) || parentOf.get(u.id) == null)
    }, [users, parentOf])

    const userMap = useMemo(() => {
        const m = new Map<number, UserRow>()
        for (const u of users) m.set(u.id, u)
        return m
    }, [users])

    // Save the parent for a user; row is created if it doesn't exist yet.
    const saveParent = async (userId: number, parentId: number | null) => {
        setSavingUserId(userId)
        try {
            const existing = rows.find(r => r.user === userId)
            if (existing) {
                await erpFetch(`user-hierarchy/${existing.id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parent_user: parentId }),
                })
            } else {
                await erpFetch('user-hierarchy/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: userId, parent_user: parentId }),
                })
            }
            toast.success('Leader updated')
            await load()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Save failed')
        } finally {
            setSavingUserId(null)
        }
    }

    const toggleExpand = (id: number) => setExpanded(p => {
        const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
    })

    const allowedParentOptions = (userId: number): UserRow[] => {
        // Can't pick self or any descendant (would create a cycle).
        const banned = new Set<number>([userId])
        const stack = [userId]
        while (stack.length) {
            const cur = stack.pop()!
            for (const child of (childrenOf.get(cur) || [])) {
                if (!banned.has(child)) { banned.add(child); stack.push(child) }
            }
        }
        return users.filter(u => !banned.has(u.id))
    }

    const filteredUsers = users.filter(u => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return u.username.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q)
    })

    const renderNode = (userId: number, depth: number, visitedAncestors: Set<number>): any => {
        if (visitedAncestors.has(userId)) return null // guard against cycles
        const u = userMap.get(userId)
        if (!u) return null
        if (search.trim() && !filteredUsers.some(x => x.id === userId)) {
            // Show if any descendant matches the search
            const hasMatchingDescendant = (pid: number): boolean => {
                const kids = childrenOf.get(pid) || []
                for (const k of kids) {
                    if (filteredUsers.some(x => x.id === k)) return true
                    if (hasMatchingDescendant(k)) return true
                }
                return false
            }
            if (!hasMatchingDescendant(userId)) return null
        }
        const kids = childrenOf.get(userId) || []
        const isExpanded = expanded.has(userId) || kids.length === 0 || search.trim() !== ''
        const isSaving = savingUserId === userId
        const opts = allowedParentOptions(userId)
        const currentParent = parentOf.get(userId) ?? null
        const nextVisited = new Set(visitedAncestors); nextVisited.add(userId)

        return (
            <div key={userId}>
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-app-surface/50 transition-all"
                     style={{ paddingLeft: `${12 + depth * 20}px`, borderLeft: depth > 0 ? '2px solid color-mix(in srgb, var(--app-primary) 18%, transparent)' : '2px solid transparent', marginLeft: depth > 0 ? `${depth * 4}px` : '0' }}>
                    <button onClick={() => kids.length > 0 && toggleExpand(userId)}
                            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                            style={{ color: 'var(--app-muted-foreground)', visibility: kids.length > 0 ? 'visible' : 'hidden' }}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: depth === 0 ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)' : 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                  color: depth === 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)' }}>
                        {depth === 0 ? <Crown size={12} /> : <UsersIcon size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-tp-md font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                            {fullName(u)}
                        </div>
                        <div className="text-tp-xs font-medium truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                            @{u.username} · {kids.length} direct report{kids.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>Reports to</span>
                        <select value={currentParent ?? ''} disabled={isSaving}
                                onChange={e => saveParent(userId, e.target.value ? Number(e.target.value) : null)}
                                className="text-tp-sm font-bold px-2 py-1 rounded-lg outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                            <option value="">— root (no leader) —</option>
                            {opts.map(p => (
                                <option key={p.id} value={p.id}>{fullName(p)}</option>
                            ))}
                        </select>
                        {isSaving && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--app-primary)' }} />}
                    </div>
                </div>
                {isExpanded && kids.map(cid => renderNode(cid, depth + 1, nextVisited))}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                <div className="page-header-icon bg-app-primary"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <Crown size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1>Team Structure</h1>
                    <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                        Who reports to whom · managers see their team's work
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filter by name…"
                        className="w-full pl-9 pr-3 py-2 text-tp-md bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface outline-none transition-all" />
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : roots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Crown size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No users</p>
                        </div>
                    ) : (
                        roots.map(u => renderNode(u.id, 0, new Set()))
                    )}
                </div>
            </div>
        </div>
    )
}
