'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Users, Search, Trash2, Package } from 'lucide-react'
import { toast } from 'sonner'

type GroupMember = {
    id: number
    group?: number | string
    group_name?: string
    warehouse?: number | string
    warehouse_name?: string
    role?: string
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function InventoryGroupMembersPage() {
    const [members, setMembers] = useState<GroupMember[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/inventory/inventory-group-members/')
            setMembers(asArray(res) as GroupMember[])
        } catch { setMembers([]) }
        setLoading(false)
    }

    async function handleRemove(id: number) {
        if (!confirm('Remove this member from the group?')) return
        try { await erpFetch(`/inventory/inventory-group-members/${id}/`, { method: 'DELETE' }); toast.success('Member removed'); loadData() }
        catch { toast.error('Failed to remove') }
    }

    const filtered = members.filter(m =>
        !search || (m.warehouse_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.group_name || '').toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-info), var(--app-primary))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                    <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Inventory</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Group <span style={{ color: 'var(--app-primary)' }}>Members</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by group or warehouse..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} members</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Group</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Warehouse / Location</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Role</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((m, i) => (
                            <tr key={m.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all">
                                <td className="px-4 py-3 font-medium text-app-foreground">{m.group_name || `Group #${m.group}`}</td>
                                <td className="px-4 py-3 text-app-foreground flex items-center gap-2"><Package size={12} className="text-app-muted-foreground" />{m.warehouse_name || m.warehouse || '—'}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>{m.role || 'MEMBER'}</span></td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleRemove(m.id)} className="p-1.5 rounded-lg hover:bg-app-error-bg"><Trash2 size={13} className="text-red-400" /></button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No group members found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
