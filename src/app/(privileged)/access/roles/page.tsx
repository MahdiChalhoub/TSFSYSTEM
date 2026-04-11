'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    Shield, Search, Loader2, Save, Plus, X, Check,
    Lock, ShieldAlert, RefreshCw, Maximize2, Minimize2,
    Trash2, Users, ChevronDown, ChevronRight, Edit3,
    CheckCircle, XCircle, Hash, UserPlus, Info, Layers,
    ToggleLeft, ToggleRight, Filter, Zap
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type RoleItem = {
    id: number; name: string; description?: string
    permissions: number[]; user_count?: number; is_system_role?: boolean
}
type PermissionItem = {
    id: number; code: string; name: string; description?: string
}
type RoleUser = {
    id: number; username: string; first_name?: string; last_name?: string
    email?: string; is_superuser?: boolean
}

// ═══════════════════════════════════════════════════════════
// Module Colors
// ═══════════════════════════════════════════════════════════

const MODULE_COLORS: Record<string, string> = {
    pos: 'var(--app-success, #22c55e)',
    finance: 'var(--app-info, #3b82f6)',
    inventory: '#8b5cf6',
    crm: 'var(--app-warning, #f59e0b)',
    hr: '#ec4899',
    purchases: '#14b8a6',
    sales: 'var(--app-success, #22c55e)',
    core: 'var(--app-primary)',
    delivery: '#f97316',
    ecommerce: '#06b6d4',
    mcp: '#a855f7',
}

function getModColor(mod: string) {
    return MODULE_COLORS[mod.toLowerCase()] || 'var(--app-primary)'
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

export default function AccessRolesPage() {
    const [roles, setRoles] = useState<RoleItem[]>([])
    const [permissions, setPermissions] = useState<PermissionItem[]>([])
    const [roleUsers, setRoleUsers] = useState<RoleUser[]>([])
    const [loading, setLoading] = useState(true)
    const [focusMode, setFocusMode] = useState(false)
    const [search, setSearch] = useState('')
    const [roleSearch, setRoleSearch] = useState('')
    const [moduleFilter, setModuleFilter] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Selection
    const [activeRoleId, setActiveRoleId] = useState<number | null>(null)
    const [edits, setEdits] = useState<Set<number> | null>(null) // null = no edits
    const [isSaving, setIsSaving] = useState(false)

    // Create role
    const [isCreating, setIsCreating] = useState(false)
    const [newRoleName, setNewRoleName] = useState('')
    const [newRoleDesc, setNewRoleDesc] = useState('')

    // Collapsed modules
    const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())

    // ── Data Loading ──
    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [rolesData, permsData] = await Promise.all([
                erpFetch('roles/').catch(e => { console.error('[Roles] Load failed:', e); return [] }),
                erpFetch('permissions/').catch(e => { console.error('[Permissions] Load failed:', e); return [] }),
            ])
            const r = Array.isArray(rolesData) ? rolesData : rolesData?.results ?? []
            setRoles(r)
            const p = Array.isArray(permsData) ? permsData : permsData?.results ?? []
            setPermissions(p)
            console.log(`[AccessRoles] Loaded ${r.length} roles, ${p.length} permissions`)
            if (!activeRoleId && r.length > 0) setActiveRoleId(r[0].id)
        } catch (e) {
            console.error('[AccessRoles] Critical load failure:', e)
            toast.error('Failed to load roles & permissions')
        }
        setLoading(false)
    }, [activeRoleId])

    useEffect(() => { load() }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ── Active Role ──
    const activeRole = roles.find(r => r.id === activeRoleId)
    const activePermSet = useMemo(() => {
        if (edits) return edits
        if (!activeRole) return new Set<number>()
        return new Set(activeRole.permissions || [])
    }, [activeRole, edits])

    // ── Module Grouping ──
    const modules = useMemo(() => {
        const mods: Record<string, PermissionItem[]> = {}
        permissions.forEach(p => {
            const mod = p.code?.split('.')[0] || 'core'
            if (!mods[mod]) mods[mod] = []
            mods[mod].push(p)
        })
        return mods
    }, [permissions])

    const sortedModules = useMemo(() =>
        Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)),
        [modules]
    )

    // ── Permission Toggle ──
    const togglePerm = (permId: number) => {
        if (!activeRole) return
        const current = edits || new Set(activeRole.permissions || [])
        const next = new Set(current)
        if (next.has(permId)) next.delete(permId); else next.add(permId)
        setEdits(next)
    }

    const toggleModule = (modName: string) => {
        if (!activeRole) return
        const modPerms = modules[modName] || []
        const current = edits || new Set(activeRole.permissions || [])
        const next = new Set(current)
        const allSelected = modPerms.every(p => next.has(p.id))
        modPerms.forEach(p => {
            if (allSelected) next.delete(p.id); else next.add(p.id)
        })
        setEdits(next)
    }

    const toggleCollapseModule = (mod: string) => {
        setCollapsedModules(prev => {
            const next = new Set(prev)
            if (next.has(mod)) next.delete(mod); else next.add(mod)
            return next
        })
    }

    const collapseAll = () => setCollapsedModules(new Set(Object.keys(modules)))
    const expandAll = () => setCollapsedModules(new Set())

    // Global select / deselect all permissions
    const selectAllPerms = () => {
        if (!activeRole) return
        const all = new Set(permissions.map(p => p.id))
        setEdits(all)
    }
    const deselectAllPerms = () => {
        if (!activeRole) return
        setEdits(new Set())
    }
    const allSelected = activePermSet.size === permissions.length && permissions.length > 0
    const noneSelected = activePermSet.size === 0

    const hasEdits = edits !== null

    // ── Save ──
    const handleSave = async () => {
        if (!activeRole || !edits) return
        setIsSaving(true)
        try {
            await erpFetch(`roles/${activeRole.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ permissions: Array.from(edits) }),
                headers: { 'Content-Type': 'application/json' }
            })
            toast.success(`"${activeRole.name}" updated — ${edits.size} permissions`)
            setEdits(null); load()
        } catch { toast.error('Failed to save') }
        setIsSaving(false)
    }

    const discardEdits = () => setEdits(null)

    // ── Create / Delete ──
    const handleCreate = async () => {
        if (!newRoleName.trim()) return
        setIsSaving(true)
        try {
            const res = await erpFetch('roles/', {
                method: 'POST',
                body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDesc.trim(), permissions: [] }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res?.id) setActiveRoleId(res.id)
            toast.success('Role created')
            setNewRoleName(''); setNewRoleDesc(''); setIsCreating(false); load()
        } catch { toast.error('Failed') }
        setIsSaving(false)
    }

    const handleDelete = async (id: number) => {
        const r = roles.find(x => x.id === id)
        if (!confirm(`Delete role "${r?.name}"? Users assigned to it may lose access.`)) return
        try {
            await erpFetch(`roles/${id}/`, { method: 'DELETE' })
            toast.success(`Role "${r?.name}" deleted`)
            if (activeRoleId === id) setActiveRoleId(roles.find(x => x.id !== id)?.id || null)
            load()
        } catch (e: any) {
            const msg = e?.message || String(e)
            console.error('[AccessRoles] Delete failed:', msg)
            toast.error(`Delete failed: ${msg}`)
        }
    }

    // ── Select role ──
    const selectRole = (id: number) => {
        if (hasEdits && !confirm('Discard unsaved changes?')) return
        setEdits(null)
        setActiveRoleId(id)
    }

    // ── KPIs ──
    const kpis = [
        { label: 'Roles', value: roles.length, color: 'var(--app-primary)', icon: <Shield size={11} /> },
        { label: 'Permissions', value: permissions.length, color: '#8b5cf6', icon: <Lock size={11} /> },
        { label: 'Modules', value: Object.keys(modules).length, color: 'var(--app-success, #22c55e)', icon: <Layers size={11} /> },
        { label: 'Assigned', value: activePermSet.size, color: 'var(--app-info, #3b82f6)', icon: <Check size={11} /> },
    ]

    // ── Filtering ──
    const filteredModules = useMemo(() => {
        let result = sortedModules
        if (moduleFilter) result = result.filter(([mod]) => mod === moduleFilter)
        if (search) {
            const q = search.toLowerCase()
            result = result.map(([mod, perms]) => {
                const filtered = perms.filter(p =>
                    p.code.toLowerCase().includes(q) ||
                    p.name.toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q)
                )
                return [mod, filtered] as [string, PermissionItem[]]
            }).filter(([, perms]) => perms.length > 0)
        }
        return result
    }, [sortedModules, search, moduleFilter])

    const filteredRoles = useMemo(() => {
        if (!roleSearch) return roles
        const q = roleSearch.toLowerCase()
        return roles.filter(r => r.name.toLowerCase().includes(q))
    }, [roles, roleSearch])

    const totalFiltered = filteredModules.reduce((s, [, p]) => s + p.length, 0)

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-app-primary" />
        </div>
    )

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ═══ HEADER ═══ */}
            <div className={`flex-shrink-0 space-y-3 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-3'}`}>
                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <Shield size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">
                                {activeRole?.name || 'Roles'}
                            </span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">
                                {activePermSet.size}/{permissions.length}
                            </span>
                        </div>
                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search permissions..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all" />
                        </div>
                        {hasEdits && (
                            <button onClick={handleSave} disabled={isSaving}
                                className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                <span className="hidden sm:inline">Save</span>
                            </button>
                        )}
                        <button onClick={() => setFocusMode(false)}
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (<>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon bg-app-primary"
                                style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                <Shield size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                    Roles & Permissions
                                </h1>
                                <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {roles.length} Roles · {permissions.length} Permissions · {Object.keys(modules).length} Modules
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <button onClick={load}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <RefreshCw size={13} /><span className="hidden md:inline">Refresh</span>
                            </button>
                            {hasEdits && (<>
                                <button onClick={discardEdits}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <X size={13} /> Discard
                                </button>
                                <button onClick={handleSave} disabled={isSaving}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all animate-in fade-in duration-200"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Deploy ({activePermSet.size})
                                </button>
                            </>)}
                            <button onClick={() => setFocusMode(true)}
                                className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* KPI Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (
                            <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl text-left"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                    {s.icon}
                                </div>
                                <div><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>)}
            </div>

            {/* ═══ MAIN LAYOUT ═══ */}
            <div className="flex-1 min-h-0 flex gap-3">

                {/* ── LEFT: ROLE LIST ── */}
                <div className="w-56 lg:w-64 flex-shrink-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-app-border/50 flex-shrink-0">
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Roles</span>
                        <button onClick={() => setIsCreating(true)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-app-primary hover:bg-app-primary/10 transition-all"
                            title="Create Role">
                            <Plus size={14} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Role Search */}
                    <div className="px-2 py-1.5 border-b border-app-border/30 flex-shrink-0">
                        <div className="relative">
                            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
                                placeholder="Find role..."
                                className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-transparent border border-app-border/30 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary/40 transition-all" />
                        </div>
                    </div>

                    {/* Create Inline */}
                    {isCreating && (
                        <div className="p-2.5 border-b border-app-border/30 animate-in slide-in-from-top-1 duration-150 flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                            <input autoFocus placeholder="Role name *" value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                className="w-full text-[11px] font-bold px-2 py-1.5 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none mb-1.5" />
                            <input placeholder="Description (optional)" value={newRoleDesc}
                                onChange={e => setNewRoleDesc(e.target.value)}
                                className="w-full text-[10px] px-2 py-1 bg-app-bg border border-app-border/50 rounded-lg text-app-foreground outline-none mb-2" />
                            <div className="flex gap-1">
                                <button onClick={() => { setIsCreating(false); setNewRoleName(''); setNewRoleDesc('') }}
                                    className="flex-1 text-[9px] font-bold py-1 rounded-lg text-app-muted-foreground hover:bg-app-border/30 transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleCreate} disabled={isSaving || !newRoleName.trim()}
                                    className="flex-1 text-[9px] font-bold py-1 rounded-lg text-white disabled:opacity-40 transition-all"
                                    style={{ background: 'var(--app-primary)' }}>
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Role List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                        {filteredRoles.map(r => {
                            const sel = activeRoleId === r.id
                            const permCount = r.permissions?.length || 0
                            return (
                                <button key={r.id} onClick={() => selectRole(r.id)}
                                    className="group w-full text-left p-2 rounded-xl flex items-center gap-2 transition-all"
                                    style={sel ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    } : { border: '1px solid transparent' }}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: sel ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            color: sel ? 'white' : 'var(--app-muted-foreground)',
                                            boxShadow: sel ? '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'none',
                                        }}>
                                        <Shield size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[11px] font-bold truncate ${sel ? 'text-app-primary' : 'text-app-foreground'}`}>
                                            {r.name}
                                        </div>
                                        <div className="text-[9px] font-bold text-app-muted-foreground flex items-center gap-2">
                                            <span>{permCount} perms</span>
                                            {r.user_count != null && <span>· {r.user_count} users</span>}
                                        </div>
                                    </div>
                                    {!r.is_system_role && (
                                        <button onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-app-muted-foreground hover:text-app-error transition-all"
                                            title="Delete">
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </button>
                            )
                        })}
                        {filteredRoles.length === 0 && (
                            <div className="text-center py-6">
                                <Shield size={24} className="text-app-muted-foreground mx-auto mb-2 opacity-30" />
                                <p className="text-[11px] font-bold text-app-muted-foreground">
                                    {roleSearch ? 'No matching roles' : 'No roles yet'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CENTER: PERMISSIONS ── */}
                {activeRole ? (
                    <div className="flex-1 min-w-0 flex flex-col gap-3">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                    <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder={`Search ${permissions.length} permissions... (Ctrl+K)`}
                                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                </div>
                            </div>

                            {/* Module Filter Pills */}
                            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-shrink-0">
                                <button onClick={() => setModuleFilter(null)}
                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                                    style={!moduleFilter ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    } : {
                                        color: 'var(--app-muted-foreground)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    }}>
                                    All ({permissions.length})
                                </button>
                                {sortedModules.map(([mod, perms]) => {
                                    const mc = getModColor(mod)
                                    const isActive = moduleFilter === mod
                                    return (
                                        <button key={mod} onClick={() => setModuleFilter(isActive ? null : mod)}
                                            className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all whitespace-nowrap"
                                            style={isActive ? {
                                                background: `color-mix(in srgb, ${mc} 12%, transparent)`,
                                                color: mc,
                                                border: `1px solid color-mix(in srgb, ${mc} 25%, transparent)`,
                                            } : {
                                                color: 'var(--app-muted-foreground)',
                                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                            }}>
                                            {mod} ({perms.length})
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex gap-1 flex-shrink-0">
                                <button onClick={allSelected ? deselectAllPerms : selectAllPerms}
                                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
                                    style={allSelected ? {
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    } : {
                                        color: 'var(--app-muted-foreground)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                    title={allSelected ? 'Deselect All Permissions' : 'Select All Permissions'}>
                                    {allSelected ? <><XCircle size={11} /> Deselect All</> : <><CheckCircle size={11} /> Select All</>}
                                </button>
                                <button onClick={expandAll} className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface border border-app-border/50 transition-all" title="Expand All">
                                    <ChevronDown size={13} />
                                </button>
                                <button onClick={collapseAll} className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface border border-app-border/50 transition-all" title="Collapse All">
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>

                        {/* Permission Modules */}
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {filteredModules.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <Search size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                    <p className="text-sm font-bold text-app-muted-foreground">No permissions match "{search}"</p>
                                </div>
                            ) : (
                                filteredModules.map(([mod, perms]) => {
                                    const mc = getModColor(mod)
                                    const isCollapsed = collapsedModules.has(mod)
                                    const selectedCount = perms.filter(p => activePermSet.has(p.id)).length
                                    const allSelected = selectedCount === perms.length
                                    const someSelected = selectedCount > 0 && !allSelected

                                    return (
                                        <div key={mod} className="rounded-2xl border overflow-hidden transition-all"
                                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

                                            {/* Module Header */}
                                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                                                style={{
                                                    background: `color-mix(in srgb, ${mc} 4%, var(--app-surface))`,
                                                    borderBottom: isCollapsed ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                                }}>
                                                <button onClick={() => toggleCollapseModule(mod)}
                                                    className="p-0.5 rounded text-app-muted-foreground hover:text-app-foreground transition-all">
                                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                                    style={{ background: `color-mix(in srgb, ${mc} 12%, transparent)`, color: mc }}>
                                                    <Shield size={11} />
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-widest flex-1 cursor-pointer" style={{ color: mc }}
                                                    onClick={() => toggleCollapseModule(mod)}>
                                                    {mod}
                                                </span>
                                                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                    {selectedCount}/{perms.length}
                                                </span>
                                                <button onClick={() => toggleModule(mod)}
                                                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-all"
                                                    style={allSelected ? {
                                                        background: `color-mix(in srgb, ${mc} 10%, transparent)`,
                                                        color: mc,
                                                    } : {
                                                        color: 'var(--app-muted-foreground)',
                                                    }}
                                                    title={allSelected ? 'Deselect All' : 'Select All'}>
                                                    {allSelected ? <><Check size={10} /> All</> : someSelected ? 'Partial' : 'None'}
                                                </button>
                                            </div>

                                            {/* Permission Grid */}
                                            {!isCollapsed && (
                                                <div className="p-2 animate-in fade-in slide-in-from-top-1 duration-150"
                                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px' }}>
                                                        {perms.map(perm => {
                                                            const sel = activePermSet.has(perm.id)
                                                            const shortName = perm.name || perm.code.split('.')[1]?.replace(/_/g, ' ') || perm.code
                                                            return (
                                                                <button key={perm.id} onClick={() => togglePerm(perm.id)}
                                                                    className="group text-left p-2 rounded-xl border transition-all flex items-center gap-2"
                                                                    style={sel ? {
                                                                        background: `color-mix(in srgb, ${mc} 6%, transparent)`,
                                                                        borderColor: `color-mix(in srgb, ${mc} 20%, transparent)`,
                                                                    } : {
                                                                        borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                                    }}>
                                                                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                                                        style={sel ? {
                                                                            background: mc, color: 'white',
                                                                        } : {
                                                                            border: '1.5px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                                                                        }}>
                                                                        {sel && <Check size={10} strokeWidth={4} />}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-[11px] font-bold text-app-foreground truncate capitalize">
                                                                            {shortName}
                                                                        </div>
                                                                        <div className="text-[9px] font-mono text-app-muted-foreground truncate">
                                                                            {perm.code}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Users assigned to this role (compact strip) */}
                        {roleUsers.length > 0 && (
                            <div className="flex-shrink-0 rounded-xl px-3 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                <Users size={12} className="text-app-muted-foreground flex-shrink-0" />
                                <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex-shrink-0">
                                    {roleUsers.length} Users:
                                </span>
                                {roleUsers.slice(0, 20).map(u => (
                                    <span key={u.id} className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 whitespace-nowrap"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                                        {u.first_name ? `${u.first_name} ${u.last_name?.[0] || ''}`.trim() : u.username}
                                    </span>
                                ))}
                                {roleUsers.length > 20 && (
                                    <span className="text-[10px] font-bold text-app-muted-foreground flex-shrink-0">
                                        +{roleUsers.length - 20} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                        <Shield size={48} className="text-app-muted-foreground mb-4 opacity-20" />
                        <p className="text-sm font-bold text-app-muted-foreground">Select a role to configure</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1 font-bold">
                            Choose from the left panel or create a new role.
                        </p>
                    </div>
                )}
            </div>

            {/* Unsaved Changes Banner */}
            {hasEdits && (
                <div className="flex-shrink-0 mt-2 flex items-center gap-3 px-4 py-2 rounded-xl animate-in slide-in-from-bottom-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                    }}>
                    <Zap size={14} style={{ color: 'var(--app-primary)' }} />
                    <span className="text-[11px] font-bold text-app-foreground flex-1">
                        Unsaved changes to <strong>{activeRole?.name}</strong> — {activePermSet.size} permissions selected
                    </span>
                    <button onClick={discardEdits}
                        className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1 rounded-lg hover:bg-app-border/30 transition-all">
                        Discard
                    </button>
                    <button onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-1 text-[10px] font-bold text-white px-3 py-1 rounded-lg transition-all"
                        style={{ background: 'var(--app-primary)' }}>
                        {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Deploy
                    </button>
                </div>
            )}
        </div>
    )
}
