'use client'

import { useEffect, useMemo, useState } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    Users, Plus, Pencil, Trash2, Crown, Loader2, Search, X, Check, UserPlus,
} from 'lucide-react'

type UserRow = { id: number; username: string; first_name?: string; last_name?: string; is_active?: boolean }
type GroupRow = {
    id: number
    name: string
    description?: string | null
    is_active: boolean
    members: number[]
    leader: number | null
    leader_name?: string | null
    member_count: number
}

type EditState = {
    id?: number
    name: string
    description: string
    members: number[]
    leader: number | null
    is_active: boolean
}

const emptyEdit = (): EditState => ({
    name: '', description: '', members: [], leader: null, is_active: true,
})

const fullName = (u: UserRow) =>
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username

export default function UserGroupsPage() {
    const [groups, setGroups] = useState<GroupRow[]>([])
    const [users, setUsers] = useState<UserRow[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<EditState | null>(null)
    const [memberSearch, setMemberSearch] = useState('')
    const [listSearch, setListSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const load = async () => {
        setLoading(true)
        try {
            const [g, u] = await Promise.all([
                erpFetch('user-groups/').catch(() => []),
                erpFetch('erp/users/').catch(() => []),
            ])
            setGroups(Array.isArray(g) ? g : g?.results || [])
            setUsers(Array.isArray(u) ? u : u?.results || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const filteredGroups = useMemo(() => {
        if (!listSearch.trim()) return groups
        const q = listSearch.toLowerCase()
        return groups.filter(g => g.name.toLowerCase().includes(q)
            || (g.description || '').toLowerCase().includes(q))
    }, [groups, listSearch])

    const filteredUsers = useMemo(() => {
        if (!memberSearch.trim()) return users
        const q = memberSearch.toLowerCase()
        return users.filter(u => u.username.toLowerCase().includes(q)
            || fullName(u).toLowerCase().includes(q))
    }, [users, memberSearch])

    const startEdit = (g: GroupRow) => setEditing({
        id: g.id,
        name: g.name,
        description: g.description || '',
        members: g.members || [],
        leader: g.leader ?? null,
        is_active: g.is_active,
    })

    const toggleMember = (uid: number) => {
        if (!editing) return
        const has = editing.members.includes(uid)
        const next = has ? editing.members.filter(x => x !== uid) : [...editing.members, uid]
        // If leader was removed from members, clear leader.
        const nextLeader = has && editing.leader === uid ? null : editing.leader
        setEditing({ ...editing, members: next, leader: nextLeader })
    }

    const save = async () => {
        if (!editing) return
        if (!editing.name.trim()) { toast.error('Group name is required'); return }
        setSaving(true)
        try {
            const payload = {
                name: editing.name.trim(),
                description: editing.description.trim() || null,
                is_active: editing.is_active,
                members: editing.members,
                leader: editing.leader,
            }
            if (editing.id) {
                await erpFetch(`user-groups/${editing.id}/`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                toast.success('Group updated')
            } else {
                await erpFetch('user-groups/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                toast.success('Group created')
            }
            setEditing(null)
            load()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (g: GroupRow) => {
        if (!confirm(`Delete user group "${g.name}"? This will also remove it from any auto-task rules.`)) return
        try {
            await erpFetch(`user-groups/${g.id}/`, { method: 'DELETE' })
            toast.success('Group deleted')
            load()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Delete failed')
        }
    }

    const nameById = (id: number | null | undefined) => {
        if (!id) return null
        const u = users.find(x => x.id === id)
        return u ? fullName(u) : `#${id}`
    }

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                <div className="page-header-icon bg-app-primary"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <Users size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Teams</h1>
                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                        {groups.length} Teams · Assign work to a group of people at once
                    </p>
                </div>
                <button
                    onClick={() => setEditing(emptyEdit())}
                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                >
                    <Plus size={14} /> <span className="hidden sm:inline">New Group</span>
                </button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 mb-3">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                        placeholder="Search groups…"
                        className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface outline-none transition-all" />
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Group</div>
                    <div className="hidden md:block w-40 flex-shrink-0">Leader</div>
                    <div className="w-20 text-center flex-shrink-0">Members</div>
                    <div className="w-16 text-center flex-shrink-0">Active</div>
                    <div className="w-20 text-right flex-shrink-0">Actions</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Users size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">
                                {groups.length === 0 ? 'No user groups yet' : 'No matching groups'}
                            </p>
                            {groups.length === 0 && (
                                <button onClick={() => setEditing(emptyEdit())}
                                    className="mt-3 flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl">
                                    <UserPlus size={13} /> Create first group
                                </button>
                            )}
                        </div>
                    ) : filteredGroups.map(g => (
                        <div key={g.id}
                            className={`group flex items-center gap-2 border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3 ${!g.is_active ? 'opacity-60' : ''}`}
                            style={{ borderLeft: '3px solid var(--app-primary)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                <Users size={13} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="truncate text-[13px] font-bold text-app-foreground">{g.name}</div>
                                {g.description && (
                                    <div className="truncate text-[11px] font-medium text-app-muted-foreground">{g.description}</div>
                                )}
                            </div>
                            <div className="hidden md:flex w-40 flex-shrink-0 items-center gap-1.5">
                                {g.leader ? (
                                    <>
                                        <Crown size={11} style={{ color: '#f59e0b' }} />
                                        <span className="text-[11px] font-bold text-app-foreground truncate">{g.leader_name || nameById(g.leader)}</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-app-muted-foreground">— none —</span>
                                )}
                            </div>
                            <div className="w-20 flex justify-center flex-shrink-0">
                                <span className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {g.member_count ?? g.members?.length ?? 0}
                                </span>
                            </div>
                            <div className="w-16 flex justify-center flex-shrink-0">
                                <span className="w-2 h-2 rounded-full" style={{ background: g.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-border)' }} />
                            </div>
                            <div className="w-20 flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEdit(g)} title="Edit"
                                    className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
                                    <Pencil size={12} />
                                </button>
                                <button onClick={() => remove(g)} title="Delete"
                                    className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                                    style={{ color: 'var(--app-error, #ef4444)' }}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200 p-4"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget && !saving) setEditing(null) }}>
                    <div className="w-full max-w-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <Users size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-app-foreground">{editing.id ? 'Edit Group' : 'New User Group'}</h3>
                                    <p className="text-[10px] font-bold text-app-muted-foreground">Team · members · leader</p>
                                </div>
                            </div>
                            <button onClick={() => !saving && setEditing(null)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Name *</label>
                                    <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                                        placeholder="e.g. Finance Approvers"
                                        className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all" />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Description</label>
                                    <input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                                        placeholder="What is this group for?"
                                        className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                        Members · {editing.members.length} selected
                                    </label>
                                    <div className="relative w-56">
                                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                            placeholder="Filter users…"
                                            className="w-full pl-7 pr-2 py-1 text-[11px] bg-app-bg border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none" />
                                    </div>
                                </div>
                                <div className="rounded-xl max-h-64 overflow-y-auto custom-scrollbar"
                                    style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    {filteredUsers.length === 0 ? (
                                        <div className="p-4 text-[11px] text-center text-app-muted-foreground">No users match.</div>
                                    ) : filteredUsers.map(u => {
                                        const checked = editing.members.includes(u.id)
                                        const isLeader = editing.leader === u.id
                                        return (
                                            <div key={u.id}
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-app-surface/40 transition-all border-b border-app-border/20 last:border-b-0">
                                                <button onClick={() => toggleMember(u.id)}
                                                    className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                                                    style={{ borderColor: checked ? 'var(--app-primary)' : 'var(--app-border)', background: checked ? 'var(--app-primary)' : 'transparent' }}>
                                                    {checked && <Check size={10} className="text-white" />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[12px] font-bold text-app-foreground truncate">{fullName(u)}</div>
                                                    <div className="text-[10px] text-app-muted-foreground truncate">@{u.username}</div>
                                                </div>
                                                {checked && (
                                                    <button onClick={() => setEditing({ ...editing, leader: isLeader ? null : u.id })}
                                                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all"
                                                        style={{
                                                            background: isLeader ? 'color-mix(in srgb, #f59e0b 15%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                            color: isLeader ? '#f59e0b' : 'var(--app-muted-foreground)',
                                                        }}
                                                        title={isLeader ? 'Unset leader' : 'Make leader'}>
                                                        <Crown size={10} /> {isLeader ? 'Leader' : 'Make leader'}
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <div>
                                    <p className="text-[12px] font-bold text-app-foreground">Active</p>
                                    <p className="text-[10px] font-medium text-app-muted-foreground">Inactive groups can't receive new tasks.</p>
                                </div>
                                <button onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                                    className={`w-11 h-6 rounded-full relative transition-all ${editing.is_active ? 'bg-app-primary' : 'bg-app-border'}`}>
                                    <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow ${editing.is_active ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-bg))', borderTop: '1px solid var(--app-border)' }}>
                            <button onClick={() => !saving && setEditing(null)}
                                className="text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                Cancel
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                                {saving ? 'Saving…' : 'Save Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
