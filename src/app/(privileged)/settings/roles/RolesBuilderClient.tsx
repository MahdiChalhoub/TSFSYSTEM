'use client'

import { useState, useMemo } from 'react'
import { updateRolePermissions, createRole } from '@/app/actions/settings/roles'
import { toast } from 'sonner'
import { Save, Shield, Plus, Check, Search, AlertCircle } from 'lucide-react'

export interface Permission {
    id: number
    code: string
    name: string
    description?: string
    module?: string
}

export interface Role {
    id: number
    name: string
    description?: string
    permissions: number[]
    is_system_role?: boolean
}

export function RolesBuilderClient({ initialRoles, permissions }: { initialRoles: Role[], permissions: Permission[] }) {
    const [roles, setRoles] = useState<Role[]>(initialRoles);

    // Map current edits for each role. format: Record<roleId, Set<permId>>
    const [edits, setEdits] = useState<Record<number, Set<number>>>({})
    const [activeRoleId, setActiveRoleId] = useState<number | null>(roles[0]?.id || null)

    // UI state
    const [search, setSearch] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newRoleName, setNewRoleName] = useState('')

    // Group permissions into modules
    const modules = useMemo(() => {
        const mods: Record<string, Permission[]> = {}
        permissions.forEach(p => {
            const modName = p.module || p.code.split('.')[0] || 'core'
            if (!mods[modName]) mods[modName] = []
            mods[modName].push(p)
        })
        return mods
    }, [permissions])

    const tabs = Object.keys(modules).sort()
    const [activeTab, setActiveTab] = useState<string>(tabs[0] || '')

    const activeRole = roles.find(r => r.id === activeRoleId)
    const activePermSet = useMemo(() => {
        if (!activeRole) return new Set<number>()
        if (edits[activeRole.id]) return edits[activeRole.id]
        return new Set(activeRole.permissions)
    }, [activeRole, edits])

    const handleTogglePermission = (permId: number) => {
        if (!activeRole) return

        setEdits(prev => {
            const next = { ...prev }
            if (!next[activeRole.id]) {
                next[activeRole.id] = new Set(activeRole.permissions)
            }

            const roleEdits = next[activeRole.id]
            if (roleEdits.has(permId)) {
                roleEdits.delete(permId)
            } else {
                roleEdits.add(permId)
            }

            return next
        })
    }

    const handleSave = async () => {
        if (!activeRole || !edits[activeRole.id]) return

        setIsSaving(true)
        try {
            const newArray = Array.from(edits[activeRole.id])
            await updateRolePermissions(activeRole.id, newArray)
            toast.success("Role permissions updated successfully!")

            // update local state
            setRoles(prev => prev.map(r => r.id === activeRole.id ? { ...r, permissions: newArray } : r))

            // clear edits for this role
            setEdits(prev => {
                const next = { ...prev }
                delete next[activeRole.id]
                return next
            })
        } catch (error) {
            toast.error("Failed to update role.")
        } finally {
            setIsSaving(false)
        }
    }

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoleName.trim()) return

        setIsSaving(true)
        try {
            const res = await createRole(newRoleName.trim(), 'Custom Role')
            if (res.error) throw new Error(res.error)

            // Assume the API returns the created role. 
            // In a real setup, we might need to re-fetch, but typically POST returns the object.
            const created = res.id ? res : null // very loose fallback
            if (created) {
                setRoles([...roles, created])
                setActiveRoleId(created.id)
            }

            toast.success("Role created!")
            setNewRoleName('')
            setIsCreating(false)
        } catch (error) {
            toast.error("Failed to create role.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[600px]">
            {/* LEFT SIDEBAR: ROLES */}
            <div className="w-full lg:w-80 flex shrink-0 flex-col gap-4 bg-app-surface/60 backdrop-blur-md border border-app-border/40 p-4 rounded-[2rem] overflow-hidden">
                <div className="flex items-center justify-between pb-2">
                    <h2 className="uppercase px-2">Access Roles</h2>
                    <button onClick={() => setIsCreating(true)} className="w-8 h-8 rounded-full bg-app-primary/10 text-app-primary flex items-center justify-center hover:bg-app-primary/20 transition-colors">
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>

                {isCreating && (
                    <form onSubmit={handleCreateRole} className="p-3 bg-app-background/50 rounded-2xl border border-app-primary/20 mb-2 fade-in">
                        <input
                            autoFocus
                            placeholder="Role Name"
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            className="w-full bg-transparent text-sm font-bold placeholder:text-app-muted-foreground focus:outline-none text-app-foreground pb-2"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="text-[10px] font-bold uppercase text-app-muted-foreground px-2 py-1">Cancel</button>
                            <button disabled={isSaving || !newRoleName.trim()} type="submit" className="text-[10px] font-bold uppercase text-app-primary px-3 py-1 bg-app-primary/10 rounded-full">Create</button>
                        </div>
                    </form>
                )}

                <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 custom-scrollbar">
                    {roles.map(role => {
                        const isSelected = activeRoleId === role.id
                        const hasEdits = !!edits[role.id]
                        return (
                            <button
                                key={role.id}
                                onClick={() => setActiveRoleId(role.id)}
                                className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${isSelected
                                        ? 'bg-app-primary/10 border border-app-primary/20 shadow-sm'
                                        : 'hover:bg-app-background/50 border border-transparent'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-app-primary text-app-primary-foreground shadow-md shadow-indigo-500/20' : 'bg-app-background text-app-muted-foreground'
                                    }`}>
                                    <Shield size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-app-primary' : 'text-app-foreground'}`}>
                                        {role.name}
                                    </h3>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-app-muted-foreground truncate opacity-70">
                                        {role.permissions?.length || 0} permissions
                                    </p>
                                </div>
                                {hasEdits && (
                                    <div className="w-2 h-2 rounded-full bg-app-error animate-pulse" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* RIGHT SIDEBAR: PERMISSION BUILDER */}
            {activeRole ? (
                <div className="flex-1 flex flex-col min-w-0 bg-app-surface/60 backdrop-blur-md border border-app-border/40 rounded-[2rem] overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-app-border/40 flex items-center justify-between shrink-0 bg-app-background/30">
                        <div>
                            <h2 className="flex items-center gap-3">
                                {activeRole.name}
                                {activeRole.is_system_role && <span className="bg-app-error/10 text-app-error text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">System</span>}
                            </h2>
                            <p className="text-sm text-app-muted-foreground mt-1">Configure permissions for this role across all modules.</p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!edits[activeRole.id] || isSaving}
                            className={`flex items-center gap-2 px-6 h-11 font-bold rounded-xl transition-all ${edits[activeRole.id]
                                    ? 'bg-app-primary hover:bg-app-primary/90 text-app-primary-foreground shadow-xl shadow-indigo-600/20'
                                    : 'bg-app-background/50 text-app-muted-foreground cursor-not-allowed opacity-50'
                                }`}
                        >
                            {isSaving ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" /> : <Save size={16} />}
                            {isSaving ? 'Saving...' : 'Deploy Changes'}
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex border-b border-app-border/30 overflow-x-auto custom-scrollbar shrink-0 bg-app-background/10">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 h-14 font-black uppercase tracking-widest text-xs whitespace-nowrap border-b-2 transition-colors ${activeTab === tab
                                        ? 'border-app-primary text-app-primary bg-app-primary/5'
                                        : 'border-transparent text-app-muted-foreground hover:text-app-foreground hover:bg-app-background/50'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Search inside Tab */}
                    <div className="p-4 border-b border-app-border/20 shrink-0">
                        <div className="flex items-center gap-3 px-4 h-11 bg-app-background/50 rounded-xl border border-app-border/50 focus-within:border-app-primary/50 transition-colors">
                            <Search size={16} className="text-app-muted-foreground" />
                            <input
                                placeholder={`Search permissions in ${activeTab}...`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-bold w-full text-app-foreground placeholder:text-app-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Permissions Grid */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {modules[activeTab]
                                ?.filter(p => search === '' || p.code.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()))
                                .map(perm => {
                                    const isSelected = activePermSet.has(perm.id)

                                    return (
                                        <button
                                            key={perm.id}
                                            onClick={() => handleTogglePermission(perm.id)}
                                            className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${isSelected
                                                    ? 'bg-app-primary/5 border-app-primary/30 shadow-sm'
                                                    : 'bg-app-background/40 border-app-border/40 hover:border-app-primary/20 hover:bg-app-background/80'
                                                }`}
                                        >
                                            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${isSelected
                                                    ? 'bg-app-primary text-white shadow-md shadow-indigo-500/20'
                                                    : 'bg-app-surface border border-app-border/60'
                                                }`}>
                                                {isSelected && <Check size={12} strokeWidth={4} />}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-sm ${isSelected ? 'text-app-foreground' : 'text-app-foreground/80'}`}>
                                                    {perm.name || perm.code.split('.')[1].replace(/_/g, ' ')}
                                                </h4>
                                                <p className="text-[10px] font-mono mt-1 text-app-muted-foreground opacity-70">
                                                    {perm.code}
                                                </p>
                                                {perm.description && (
                                                    <p className="text-xs text-app-muted-foreground mt-2 leading-relaxed">
                                                        {perm.description}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-app-surface/30 backdrop-blur-sm border border-app-border/30 rounded-[2rem]">
                    <Shield className="w-24 h-24 text-app-muted-foreground/30 mb-6 stroke-1" />
                    <h2>No Role Selected</h2>
                    <p className="text-app-muted-foreground mt-2 text-sm text-center max-w-sm">
                        Select a role from the left sidebar to configure its permissions across all active modules.
                    </p>
                </div>
            )}
        </div>
    )
}
