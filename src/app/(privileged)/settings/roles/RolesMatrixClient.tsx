'use client'

import { useState } from 'react'
import { updateRolePermissions } from '@/app/actions/settings/roles'
import { toast } from 'sonner'
import { Save, ShieldAlert, CheckCircle2, Lock } from 'lucide-react'

interface RoleData {
    available_permissions: Record<string, string>
    users: {
        id: number
        username: string
        is_superuser: boolean
        role_name: string | null
        permissions: string[]
    }[]
}

export function RolesMatrixClient({ data }: { data: RoleData }) {
    const [pendingChanges, setPendingChanges] = useState<Record<number, string[]>>({})
    const [isSaving, setIsSaving] = useState(false)

    // Group permissions into display modules
    const modules: Record<string, string[]> = {}
    Object.keys(data.available_permissions).forEach(code => {
        const mod = code.split('.')[0]
        if (!modules[mod]) modules[mod] = []
        modules[mod].push(code)
    })

    const handleToggle = (userId: number, code: string, currentPerms: string[]) => {
        setPendingChanges(prev => {
            const next = { ...prev }
            const activePerms = next[userId] || currentPerms

            if (activePerms.includes(code)) {
                next[userId] = activePerms.filter(p => p !== code)
            } else {
                next[userId] = [...activePerms, code]
            }
            return next
        })
    }

    const handleSave = async () => {
        if (Object.keys(pendingChanges).length === 0) return
        setIsSaving(true)

        try {
            const promises = Object.entries(pendingChanges).map(([userId, perms]) =>
                updateRolePermissions(Number(userId), perms)
            )
            await Promise.all(promises)
            toast.success("Role permissions updated successfully!")
            setPendingChanges({})
        } catch (error) {
            toast.error("Failed to update some permissions.")
        } finally {
            setIsSaving(false)
        }
    }

    const hasChanges = Object.keys(pendingChanges).length > 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-app-foreground tracking-tight">Access Control Matrix</h2>
                    <p className="text-sm text-app-muted-foreground mt-1">Granularly assign or override permissions per user</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="flex items-center gap-2 px-6 h-11 bg-app-primary hover:bg-app-primary text-app-primary-foreground font-bold rounded-xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    {isSaving ? 'Saving...' : 'Deploy Changes'}
                </button>
            </div>

            <div className="bg-app-surface/60 backdrop-blur-md rounded-[2rem] shadow-2xl border border-app-border/40 overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 bg-app-background/50 border-b border-r border-app-border/50 sticky left-0 z-10 w-64 min-w-[250px]">
                                <div className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Users</div>
                            </th>
                            {Object.entries(modules).map(([modName, codes]) => (
                                <th key={modName} colSpan={codes.length} className="p-4 bg-app-background/50 border-b border-app-border/50 text-center border-r last:border-0 border-r-app-border/50">
                                    <div className="text-xs font-black uppercase text-app-foreground tracking-widest">{modName}</div>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            <th className="p-4 bg-app-surface border-b border-r border-app-border/50 sticky left-0 z-10"></th>
                            {Object.entries(modules).flatMap(([_, codes]) =>
                                codes.map(code => (
                                    <th key={code} className="p-3 bg-app-surface border-b border-r border-app-border/50 text-center min-w-[140px] last:border-r-0">
                                        <div className="text-[9px] font-bold text-app-muted-foreground break-words leading-tight" title={data.available_permissions[code]}>
                                            {code.split('.')[1].replace(/_/g, ' ')}
                                        </div>
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/30">
                        {data.users.map(user => {
                            const activePerms = pendingChanges[user.id] || user.permissions
                            const isChanged = user.id in pendingChanges

                            return (
                                <tr key={user.id} className={`hover:bg-app-background/30 transition-colors ${isChanged ? 'bg-app-primary/5/5' : ''}`}>
                                    <td className="p-4 border-r border-app-border/30 sticky left-0 bg-app-surface z-10 flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-sm text-app-foreground">{user.username}</div>
                                            <div className="text-[10px] font-semibold text-app-muted-foreground uppercase font-mono mt-0.5">
                                                {user.is_superuser ? 'Superuser' : (user.role_name || 'No Role')}
                                            </div>
                                        </div>
                                        {user.is_superuser && <ShieldAlert size={14} className="text-app-error" />}
                                    </td>

                                    {Object.entries(modules).flatMap(([_, codes]) =>
                                        codes.map(code => {
                                            const hasPerm = activePerms.includes(code)
                                            return (
                                                <td key={`${user.id}-${code}`} className="p-3 border-r border-app-border/30 text-center last:border-r-0">
                                                    {user.is_superuser ? (
                                                        <div className="flex justify-center text-app-error">
                                                            <Lock size={16} />
                                                        </div>
                                                    ) : (
                                                        <label className="flex items-center justify-center cursor-pointer w-full h-full p-2 group">
                                                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${hasPerm
                                                                ? 'bg-app-primary text-app-primary-foreground shadow-md shadow-indigo-500/30'
                                                                : 'bg-app-background border border-app-border group-hover:border-app-primary/30 group-hover:bg-app-primary/5'
                                                                }`}>
                                                                {hasPerm && <CheckCircle2 size={12} strokeWidth={4} />}
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only"
                                                                checked={hasPerm}
                                                                onChange={() => handleToggle(user.id, code, user.permissions)}
                                                            />
                                                        </label>
                                                    )}
                                                </td>
                                            )
                                        })
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
