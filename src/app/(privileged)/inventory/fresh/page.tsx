'use client'

import { useState, useEffect } from 'react'
import { getWeightPolicy, updateWeightPolicy, getFreshProfiles } from '@/app/actions/plm-governance'
import {
    Scale, Leaf, Thermometer, AlertTriangle, Save, RefreshCw,
    Apple, Search
} from 'lucide-react'
import { toast } from 'sonner'

type WeightPolicyState = {
    id?: number
    encoding_mode?: string
    scale_unit?: string
    prefix?: string
    default_tare_grams?: number
    default_shelf_life_days?: number
    label_template?: string
    [key: string]: unknown
}

type FreshProfileRow = {
    id: number
    product?: number
    product_name?: string
    plu_code?: string
    net_weight_grams?: number
    price_per_kg?: number | string
    shelf_life_days?: number
    estimated_unit_price?: number | string
    allergens?: string
    ingredients?: string
}

export default function FreshProductsPage() {
    const [policy, setPolicy] = useState<WeightPolicyState | null>(null)
    const [profiles, setProfiles] = useState<FreshProfileRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tab, setTab] = useState<'profiles' | 'policy'>('profiles')
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const [polRes, profRes] = await Promise.all([getWeightPolicy(), getFreshProfiles()])
        if (polRes.success) setPolicy((polRes.data as WeightPolicyState) || null)
        if (profRes.success) setProfiles((profRes.data as FreshProfileRow[]) || [])
        setLoading(false)
    }

    async function handleSavePolicy() {
        if (!policy) return
        setSaving(true)
        const res = await updateWeightPolicy({ id: policy.id ?? 'current', ...policy })
        if (res.success) toast.success('Weight policy saved')
        else toast.error(res.error)
        setSaving(false)
    }

    const filtered = profiles.filter(p => {
        if (!search) return true
        const s = search.toLowerCase()
        return (p.product_name || '').toLowerCase().includes(s) ||
            (p.plu_code || '').includes(s)
    })

    if (loading) {
        return (
            <div className="min-h-screen layout-container-padding flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
            </div>
        )
    }

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                        <Leaf className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Fresh <span style={{ color: 'var(--app-primary)' }}>Products</span>
                        </h1>
                    </div>
                </div>
                <p className="text-sm text-app-muted-foreground">Variable-weight, perishable, and fresh product management</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-6">
                {[
                    { value: 'profiles', label: 'Fresh Profiles', icon: Apple },
                    { value: 'policy', label: 'Weight Policy', icon: Scale },
                ].map(t => (
                    <button key={t.value} onClick={() => setTab(t.value as any)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                            background: tab === t.value ? 'var(--app-primary)' : 'var(--app-surface)',
                            color: tab === t.value ? 'white' : 'var(--app-muted-foreground)',
                            border: '1px solid var(--app-border)',
                        }}>
                        <t.icon size={13} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Profiles Tab */}
            {tab === 'profiles' && (
                <>
                    <div className="relative max-w-md mb-4">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product name or PLU..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(p => (
                            <div key={p.id} className="rounded-xl p-4"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-bold text-app-foreground">{p.product_name || `Product #${p.product}`}</p>
                                    {p.plu_code && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-app-success-bg text-app-success">PLU: {p.plu_code}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                        <Scale size={11} className="text-app-muted-foreground" />
                                        <span className="text-app-muted-foreground">Weight:</span>
                                        <span className="font-bold text-app-foreground">{p.net_weight_grams}g</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-app-muted-foreground">Price/kg:</span>
                                        <span className="font-bold" style={{ color: 'var(--app-primary)' }}>{Number(p.price_per_kg || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Thermometer size={11} className="text-app-muted-foreground" />
                                        <span className="text-app-muted-foreground">Shelf life:</span>
                                        <span className="font-bold text-app-foreground">{p.shelf_life_days}d</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-app-muted-foreground">Est. price:</span>
                                        <span className="font-bold" style={{ color: 'var(--app-success, #10b981)' }}>{Number(p.estimated_unit_price || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {(p.allergens || p.ingredients) && (
                                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                                        {p.allergens && (
                                            <div className="flex items-center gap-1 text-[10px]">
                                                <AlertTriangle size={10} className="text-app-warning" />
                                                <span className="text-app-warning font-bold">Allergens:</span>
                                                <span className="text-app-muted-foreground truncate">{p.allergens}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <div className="text-center py-16">
                            <Leaf size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                            <p className="text-sm font-bold text-app-muted-foreground">No fresh product profiles</p>
                            <p className="text-xs text-app-muted-foreground">Products with type FRESH will appear here once profiles are created</p>
                        </div>
                    )}
                </>
            )}

            {/* Policy Tab */}
            {tab === 'policy' && policy && (
                <div className="max-w-2xl space-y-6">
                    <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-4">Barcode Encoding</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Encoding Mode</label>
                                <select value={policy.encoding_mode} onChange={e => setPolicy({ ...policy, encoding_mode: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="PRICE_EMBEDDED">Price embedded in barcode</option>
                                    <option value="WEIGHT_EMBEDDED">Weight embedded in barcode</option>
                                    <option value="PLU">PLU code lookup</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Scale Unit</label>
                                <select value={policy.scale_unit} onChange={e => setPolicy({ ...policy, scale_unit: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="GRAMS">Grams (max 99999g)</option>
                                    <option value="CENTIGRAMS">Centigrams (max 999.99g)</option>
                                    <option value="PRICE_CENTS">Price in cents</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">EAN Prefix</label>
                                <input type="text" value={policy.prefix} onChange={e => setPolicy({ ...policy, prefix: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Default Tare (g)</label>
                                <input type="number" value={policy.default_tare_grams} onChange={e => setPolicy({ ...policy, default_tare_grams: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <h3 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-4">Shelf Life & Label</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Default Shelf Life (days)</label>
                                <input type="number" value={policy.default_shelf_life_days} onChange={e => setPolicy({ ...policy, default_shelf_life_days: parseInt(e.target.value) || 3 })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Label Template</label>
                                <input type="text" value={policy.label_template} onChange={e => setPolicy({ ...policy, label_template: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                            {[
                                { key: 'require_best_before', label: 'Best-before date' },
                                { key: 'require_use_by', label: 'Use-by date' },
                                { key: 'require_tare_entry', label: 'Require tare' },
                                { key: 'show_price_per_kg', label: 'Show price/kg' },
                                { key: 'show_ingredients', label: 'Show ingredients' },
                                { key: 'show_allergens', label: 'Show allergens' },
                            ].map(f => (
                                <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <input type="checkbox" checked={!!policy[f.key]}
                                        onChange={e => setPolicy({ ...policy, [f.key]: e.target.checked })} className="rounded" />
                                    <span className="text-[10px] font-medium text-app-foreground">{f.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button onClick={handleSavePolicy} disabled={saving}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
                            style={{ background: 'var(--app-primary)' }}>
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Policy
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
