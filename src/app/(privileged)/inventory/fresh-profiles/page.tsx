'use client'

import { useState, useEffect } from 'react'
import { getFreshProfiles, createFreshProfile, updateFreshProfile } from '@/app/actions/plm-governance'
import { Leaf, Plus, Pencil, X, Save, RefreshCw, Thermometer, Clock } from 'lucide-react'
import { toast } from 'sonner'

type FreshProfile = {
    id?: number
    product?: number
    product_name?: string
    shelf_life_days?: number
    storage_temp_min?: number
    storage_temp_max?: number
    requires_lot_tracking?: boolean
    [key: string]: unknown
}

function asArray(d: unknown): unknown[] {
    if (Array.isArray(d)) return d
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r
    }
    return []
}

export default function FreshProfilesPage() {
    const [profiles, setProfiles] = useState<FreshProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<FreshProfile | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const res = await getFreshProfiles()
        if (res.success) setProfiles(asArray(res.data) as FreshProfile[])
        setLoading(false)
    }

    async function handleSave() {
        if (!editing) return
        setSaving(true)
        const res = editing.id
            ? await updateFreshProfile(editing.id, editing as Record<string, unknown>)
            : await createFreshProfile(editing as Record<string, unknown>)
        if (res.success) { toast.success(editing.id ? 'Profile updated' : 'Profile created'); setEditing(null); loadData() }
        else toast.error(res.error || 'Failed')
        setSaving(false)
    }

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-success), var(--app-accent))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-success) 30%, transparent)' }}>
                        <Leaf className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Fresh <span style={{ color: 'var(--app-primary)' }}>Profiles</span>
                        </h1>
                    </div>
                </div>
                <button onClick={() => setEditing({ shelf_life_days: 3, storage_temp_min: 2, storage_temp_max: 8, requires_lot_tracking: true })}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))' }}>
                    <Plus className="h-4 w-4" /> New Profile
                </button>
            </div>

            <div className="space-y-3">
                {profiles.map(p => (
                    <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-app-foreground">{p.product_name || `Product #${p.product}`}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground">
                                        <Clock size={10} /> Shelf life: {p.shelf_life_days || '—'} days
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground">
                                        <Thermometer size={10} /> {p.storage_temp_min ?? '—'}°C – {p.storage_temp_max ?? '—'}°C
                                    </span>
                                    {p.requires_lot_tracking && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-app-success-bg text-app-success">LOT</span>}
                                </div>
                            </div>
                            <button onClick={() => setEditing({ ...p })} className="p-2 rounded-lg hover:bg-app-surface-hover"><Pencil size={14} className="text-app-muted-foreground" /></button>
                        </div>
                    </div>
                ))}
                {profiles.length === 0 && !editing && (
                    <div className="text-center py-16">
                        <Leaf size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                        <p className="text-sm font-bold text-app-muted-foreground">No fresh profiles configured</p>
                        <p className="text-xs text-app-muted-foreground">Configure shelf life, storage temperatures, and lot tracking for perishable products</p>
                    </div>
                )}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditing(null)}>
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
                    <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }} onClick={e => e.stopPropagation()}>
                        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <h3 className="font-bold text-app-foreground">{editing.id ? 'Edit Profile' : 'New Fresh Profile'}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-app-surface-hover"><X size={16} className="text-app-muted-foreground" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Shelf Life (days)</label>
                                    <input type="number" value={editing.shelf_life_days || ''} onChange={e => setEditing({ ...editing, shelf_life_days: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Min Temp (°C)</label>
                                    <input type="number" step="0.5" value={editing.storage_temp_min ?? ''} onChange={e => setEditing({ ...editing, storage_temp_min: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Max Temp (°C)</label>
                                    <input type="number" step="0.5" value={editing.storage_temp_max ?? ''} onChange={e => setEditing({ ...editing, storage_temp_max: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <input type="checkbox" checked={!!editing.requires_lot_tracking} onChange={e => setEditing({ ...editing, requires_lot_tracking: e.target.checked })} className="rounded" />
                                <span className="text-xs font-bold text-app-foreground">Requires lot/batch tracking</span>
                            </label>
                        </div>
                        <div className="p-4 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2" style={{ background: 'var(--app-primary)' }}>
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {editing.id ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
