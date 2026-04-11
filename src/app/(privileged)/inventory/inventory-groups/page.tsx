'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    Layers, Plus, Pencil, Trash2, X, Save, RefreshCw,
    Package, Search, ChevronDown, ChevronRight, MapPin,
    TrendingUp, AlertTriangle, Star, ArrowRight,
    BarChart3, Globe, Tag, Zap, Shield, Eye
} from 'lucide-react'
import { toast } from 'sonner'

/* ─── TYPES ──────────────────────────────────────────────────────────── */

const GROUP_TYPES = [
    { value: 'EXACT', label: 'Exact Twins', desc: 'Same product, different origin/supplier', icon: '🔗', color: '--app-primary' },
    { value: 'SIMILAR', label: 'Similar Substitutes', desc: 'Commercially interchangeable', icon: '🔄', color: '--app-warning' },
    { value: 'FAMILY', label: 'Product Family', desc: 'Broader grouping for analytics', icon: '📊', color: '--app-info' },
]

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PRIMARY: { label: 'Primary', color: '--app-success', icon: Star },
    TWIN: { label: 'Twin', color: '--app-primary', icon: Zap },
    SUBSTITUTE: { label: 'Substitute', color: '--app-warning', icon: ArrowRight },
    NOT_SUB: { label: 'Analytics', color: '--app-text-muted', icon: BarChart3 },
}

/* ─── HELPERS ─────────────────────────────────────────────────────────── */

function badge(cssVar: string, label: string) {
    return (
        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, var(${cssVar}) 15%, transparent)`, color: `var(${cssVar})` }}>
            {label}
        </span>
    )
}

function statCard(icon: any, label: string, value: string | number, cssVar: string) {
    const Icon = icon
    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: `color-mix(in srgb, var(${cssVar}) 8%, transparent)`, border: `1px solid color-mix(in srgb, var(${cssVar}) 15%, transparent)` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, var(${cssVar}) 20%, transparent)` }}>
                <Icon size={13} style={{ color: `var(${cssVar})` }} />
            </div>
            <div>
                <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-sm font-black text-app-foreground">{value}</p>
            </div>
        </div>
    )
}

/* ─── EXPANDED GROUP DETAIL ───────────────────────────────────────────── */

function GroupDetail({ group, onMemberRemoved }: { group: any; onMemberRemoved: () => void }) {
    const [summary, setSummary] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadSummary()
    }, [group.id])

    async function loadSummary() {
        setLoading(true)
        try {
            const res = await erpFetch(`/inventory/inventory-groups/${group.id}/summary/`)
            setSummary(res)
        } catch { setSummary(null) }
        setLoading(false)
    }

    async function handleRemoveMember(memberId: number) {
        if (!confirm('Remove this product from the group?')) return
        try {
            await erpFetch(`/inventory/inventory-group-members/${memberId}/`, { method: 'DELETE' })
            toast.success('Product removed from group')
            loadSummary()
            onMemberRemoved()
        } catch { toast.error('Failed to remove') }
    }

    if (loading) return (
        <div className="py-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    if (!summary) return (
        <div className="py-6 text-center text-sm text-app-muted-foreground">Failed to load group details</div>
    )

    const variants = summary.variants || []

    return (
        <div className="px-4 pb-4 space-y-3">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {statCard(Package, 'Total Stock', summary.total_stock?.toLocaleString() ?? 0, '--app-success')}
                {statCard(Globe, 'Countries', summary.country_count ?? 0, '--app-info')}
                {statCard(AlertTriangle, 'Low Stock', summary.low_stock_variants ?? 0, '--app-error')}
                {statCard(TrendingUp, 'Avg Cost', `$${summary.avg_cost ?? 0}`, '--app-warning')}
            </div>

            {/* Intelligence insights */}
            {(summary.cheapest_source || summary.best_margin_source) && (
                <div className="flex flex-wrap gap-2">
                    {summary.cheapest_source && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                            <TrendingUp size={10} /> Cheapest: {summary.cheapest_source}
                        </div>
                    )}
                    {summary.best_margin_source && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                            <Star size={10} /> Best Margin: {summary.best_margin_source}
                        </div>
                    )}
                    {summary.countries?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                            <Globe size={10} /> {summary.countries.join(', ')}
                        </div>
                    )}
                </div>
            )}

            {/* Members table */}
            {variants.length > 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ background: 'var(--app-background)', borderBottom: '1px solid var(--app-border)' }}>
                                <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Product</th>
                                <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Origin</th>
                                <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Role</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Stock</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Cost</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Sell</th>
                                <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Margin</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {variants.map((v: any, i: number) => {
                                const roleCfg = ROLE_CONFIG[v.substitution_role] || ROLE_CONFIG.TWIN
                                const RoleIcon = roleCfg.icon
                                return (
                                    <tr key={v.product_id || i}
                                        className="hover:bg-app-surface-hover transition-colors"
                                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <Package size={12} className="text-app-muted-foreground shrink-0" />
                                                <div>
                                                    <p className="font-bold text-app-foreground text-[11px] leading-tight">{v.product_name}</p>
                                                    <p className="text-[9px] text-app-muted-foreground font-mono">{v.product_sku}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                {v.country && <MapPin size={10} className="text-app-info shrink-0" />}
                                                <span className="text-[11px] text-app-foreground">{v.origin_label || v.country || '—'}</span>
                                                {v.size && <span className="text-[9px] text-app-muted-foreground">({v.size}{v.size_unit || ''})</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1">
                                                <RoleIcon size={10} style={{ color: `var(${roleCfg.color})` }} />
                                                {badge(roleCfg.color, roleCfg.label)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className={`font-bold text-[11px] ${v.is_low_stock ? 'text-app-error' : 'text-app-foreground'}`}>
                                                {v.stock_qty?.toLocaleString() ?? 0}
                                            </span>
                                            {v.is_low_stock && <AlertTriangle size={9} className="inline ml-1 text-app-error" />}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-app-muted-foreground">{v.cost_price?.toFixed(2)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] font-bold text-app-foreground">{v.selling_price_ttc?.toFixed(2)}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className={`font-bold text-[11px] ${(v.margin_pct || 0) < 0 ? 'text-app-error' : (v.margin_pct || 0) > 30 ? 'text-app-success' : 'text-app-foreground'}`}>
                                                {(v.margin_pct || 0).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-1 py-2.5">
                                            <button onClick={() => {
                                                // Need member id — find it from group.members
                                                const member = group.members?.find((m: any) => m.product === v.product_id)
                                                if (member) handleRemoveMember(member.id)
                                                else toast.error('Could not find member reference')
                                            }}
                                                className="p-1 rounded-lg hover:bg-app-error/10 transition-colors">
                                                <Trash2 size={11} className="text-app-muted-foreground hover:text-app-error" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="py-6 text-center text-sm text-app-muted-foreground">
                    No products in this group yet. Add products via the product detail page.
                </div>
            )}
        </div>
    )
}

/* ─── ADD MEMBER MODAL ───────────────────────────────────────────────── */

function AddMemberModal({ groupId, onClose, onAdded }: { groupId: number; onClose: () => void; onAdded: () => void }) {
    const [search, setSearch] = useState('')
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState<number | null>(null)
    const [role, setRole] = useState('TWIN')
    const [priority, setPriority] = useState(10)

    useEffect(() => {
        if (search.length >= 2) searchProducts()
    }, [search])

    async function searchProducts() {
        setLoading(true)
        try {
            const res = await erpFetch(`/inventory/products/?search=${encodeURIComponent(search)}&page_size=15`)
            setProducts(Array.isArray(res) ? res : res?.results || [])
        } catch { setProducts([]) }
        setLoading(false)
    }

    async function handleAdd(productId: number) {
        setAdding(productId)
        try {
            await erpFetch('/inventory/inventory-group-members/', {
                method: 'POST',
                body: JSON.stringify({
                    group: groupId,
                    product: productId,
                    substitution_role: role,
                    substitution_priority: priority,
                })
            })
            toast.success('Product added to group')
            onAdded()
            onClose()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add product')
        }
        setAdding(null)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                onClick={e => e.stopPropagation()}>

                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, black))' }}>
                            <Plus size={14} className="text-white" />
                        </div>
                        <h3 className="text-sm font-black text-app-foreground">Add Product to Group</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface-hover"><X size={16} className="text-app-muted-foreground" /></button>
                </div>

                <div className="p-4 space-y-3">
                    {/* Role & Priority */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Substitution Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-[12px] font-semibold outline-none"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="PRIMARY">Primary Reference</option>
                                <option value="TWIN">Exact Twin</option>
                                <option value="SUBSTITUTE">Acceptable Substitute</option>
                                <option value="NOT_SUB">Analytics Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Priority</label>
                            <input type="number" min={1} max={99} value={priority} onChange={e => setPriority(parseInt(e.target.value) || 10)}
                                className="w-full px-3 py-2 rounded-xl text-[12px] font-mono outline-none"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <p className="text-[8px] text-app-muted-foreground mt-0.5">Lower = more preferred</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" placeholder="Search products by name or SKU..."
                            value={search} onChange={e => setSearch(e.target.value)} autoFocus
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[12px] outline-none"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>

                    {/* Results */}
                    <div className="max-h-60 overflow-y-auto rounded-xl" style={{ border: '1px solid var(--app-border)' }}>
                        {loading && (
                            <div className="py-6 flex justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                            </div>
                        )}
                        {!loading && products.length === 0 && search.length >= 2 && (
                            <div className="py-6 text-center text-[11px] text-app-muted-foreground">No products found</div>
                        )}
                        {!loading && search.length < 2 && (
                            <div className="py-6 text-center text-[11px] text-app-muted-foreground">Type at least 2 characters to search</div>
                        )}
                        {products.map(p => (
                            <div key={p.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-app-surface-hover transition-colors cursor-pointer"
                                style={{ borderBottom: '1px solid var(--app-border)' }}
                                onClick={() => handleAdd(p.id)}>
                                <div className="flex items-center gap-2.5">
                                    <Package size={14} className="text-app-muted-foreground" />
                                    <div>
                                        <p className="text-[11px] font-bold text-app-foreground">{p.name}</p>
                                        <p className="text-[9px] text-app-muted-foreground font-mono">{p.sku || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.cost_price && <span className="text-[9px] font-mono text-app-muted-foreground">${parseFloat(p.cost_price).toFixed(2)}</span>}
                                    {adding === p.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                                    ) : (
                                        <Plus size={14} style={{ color: 'var(--app-primary)' }} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─── GROUP FORM MODAL ────────────────────────────────────────────────── */

function GroupFormModal({ group, onClose, onSaved }: { group?: any; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({
        name: group?.name || '',
        group_type: group?.group_type || 'EXACT',
        commercial_size_label: group?.commercial_size_label || '',
        description: group?.description || '',
    })
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        if (!form.name.trim()) { toast.error('Group name is required'); return }
        setSaving(true)
        try {
            if (group?.id) {
                await erpFetch(`/inventory/inventory-groups/${group.id}/`, { method: 'PATCH', body: JSON.stringify(form) })
            } else {
                await erpFetch('/inventory/inventory-groups/', { method: 'POST', body: JSON.stringify(form) })
            }
            toast.success(group?.id ? 'Group updated' : 'Group created')
            onSaved()
            onClose()
        } catch (e: any) { toast.error(e?.message || 'Failed to save') }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                onClick={e => e.stopPropagation()}>

                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <h3 className="text-sm font-black text-app-foreground">{group?.id ? 'Edit Group' : 'New Substitution Group'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface-hover"><X size={16} className="text-app-muted-foreground" /></button>
                </div>

                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Group Name *</label>
                        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold outline-none"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                            placeholder='e.g. "Persil Small" or "Rice 5kg Equivalent"' autoFocus />
                    </div>

                    <div>
                        <label className="block text-[9px] font-bold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Group Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {GROUP_TYPES.map(gt => (
                                <label key={gt.value}
                                    className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-all text-center ${form.group_type === gt.value ? 'ring-2' : ''}`}
                                    style={{
                                        background: form.group_type === gt.value ? `color-mix(in srgb, var(${gt.color}) 10%, transparent)` : 'var(--app-surface)',
                                        borderColor: form.group_type === gt.value ? `var(${gt.color})` : 'var(--app-border)',
                                        boxShadow: form.group_type === gt.value ? `0 0 0 2px color-mix(in srgb, var(${gt.color}) 25%, transparent)` : undefined,
                                    }}>
                                    <input type="radio" className="sr-only" checked={form.group_type === gt.value}
                                        onChange={() => setForm({ ...form, group_type: gt.value })} />
                                    <span className="text-lg">{gt.icon}</span>
                                    <span className="text-[10px] font-bold text-app-foreground">{gt.label}</span>
                                    <span className="text-[8px] text-app-muted-foreground leading-tight">{gt.desc}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Size Label</label>
                            <input type="text" value={form.commercial_size_label} onChange={e => setForm({ ...form, commercial_size_label: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl text-[12px] outline-none"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                placeholder="Small / Medium / Large" />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-app-muted-foreground mb-1 uppercase tracking-widest">Description</label>
                            <input type="text" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl text-[12px] outline-none"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                placeholder="Optional notes..." />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 flex gap-2 justify-end" style={{ borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] font-bold border transition-all"
                        style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving || !form.name.trim()}
                        className="px-6 py-2 rounded-xl text-[12px] font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all"
                        style={{ background: 'var(--app-primary)' }}>
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {group?.id ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── MAIN PAGE ───────────────────────────────────────────────────────── */

export default function InventoryGroupsPage() {
    const [groups, setGroups] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('')
    const [expanded, setExpanded] = useState<number | null>(null)
    const [formGroup, setFormGroup] = useState<any | null>(null)
    const [addMemberGroup, setAddMemberGroup] = useState<number | null>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filter) params.set('group_type', filter)
            const res = await erpFetch(`/inventory/inventory-groups/?${params.toString()}`)
            setGroups(Array.isArray(res) ? res : res?.results || [])
        } catch { setGroups([]) }
        setLoading(false)
    }, [filter])

    useEffect(() => { loadData() }, [loadData])

    async function handleDelete(id: number) {
        if (!confirm('Delete this group? All member associations will be removed.')) return
        try {
            await erpFetch(`/inventory/inventory-groups/${id}/`, { method: 'DELETE' })
            toast.success('Group deleted')
            loadData()
        } catch { toast.error('Failed to delete') }
    }

    const filtered = groups.filter(g =>
        !search || g.name?.toLowerCase().includes(search.toLowerCase()) || g.brand_name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, black))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Product Intelligence</p>
                        <h1 className="text-2xl font-black tracking-tight text-app-foreground">
                            Substitution <span style={{ color: 'var(--app-primary)' }}>Groups</span>
                        </h1>
                        <p className="text-[10px] text-app-muted-foreground mt-0.5">
                            Group identical products from different origins, track stock across variants, and identify cheapest sources.
                        </p>
                    </div>
                </div>
                <button onClick={() => setFormGroup({})}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[12px] font-bold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, black))' }}>
                    <Plus className="h-4 w-4" /> New Group
                </button>
            </div>

            {/* ─── Filters ──────────────────────────────────────────── */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <div className="flex items-center gap-1.5">
                    {[{ value: '', label: 'All' }, ...GROUP_TYPES].map(gt => (
                        <button key={gt.value}
                            onClick={() => setFilter(gt.value)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                            style={{
                                background: filter === gt.value ? 'var(--app-primary)' : 'var(--app-surface)',
                                color: filter === gt.value ? 'white' : 'var(--app-muted-foreground)',
                                border: `1px solid ${filter === gt.value ? 'var(--app-primary)' : 'var(--app-border)'}`,
                            }}>
                            {gt.label}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-app-muted-foreground ml-auto">{filtered.length} group{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* ─── Loading ──────────────────────────────────────────── */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                </div>
            )}

            {/* ─── Groups List ──────────────────────────────────────── */}
            {!loading && (
                <div className="space-y-2.5">
                    {filtered.map(g => {
                        const typeCfg = GROUP_TYPES.find(t => t.value === g.group_type) || GROUP_TYPES[0]
                        const isOpen = expanded === g.id

                        return (
                            <div key={g.id} className="rounded-xl overflow-hidden transition-all"
                                style={{ background: 'var(--app-surface)', border: `1px solid ${isOpen ? `var(${typeCfg.color})` : 'var(--app-border)'}` }}>

                                {/* Group header */}
                                <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-app-surface-hover transition-colors"
                                    onClick={() => setExpanded(isOpen ? null : g.id)}>
                                    <div className="flex items-center gap-3">
                                        <button className="p-0.5 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>
                                            <ChevronRight size={14} className="text-app-muted-foreground" />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{typeCfg.icon}</span>
                                                <h3 className="text-sm font-black text-app-foreground">{g.name}</h3>
                                                {badge(typeCfg.color, typeCfg.label)}
                                                {g.commercial_size_label && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-app-background text-app-muted-foreground">{g.commercial_size_label}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-app-muted-foreground flex items-center gap-1">
                                                    <Package size={9} /> {g.member_count ?? 0} product{(g.member_count ?? 0) !== 1 ? 's' : ''}
                                                </span>
                                                {g.brand_name && (
                                                    <span className="text-[10px] text-app-muted-foreground flex items-center gap-1">
                                                        <Tag size={9} /> {g.brand_name}
                                                    </span>
                                                )}
                                                {(g.country_count ?? 0) > 0 && (
                                                    <span className="text-[10px] text-app-muted-foreground flex items-center gap-1">
                                                        <Globe size={9} /> {g.country_count} {g.country_count === 1 ? 'country' : 'countries'}
                                                    </span>
                                                )}
                                                {(g.low_stock_variants ?? 0) > 0 && (
                                                    <span className="text-[10px] text-app-error flex items-center gap-1 font-bold">
                                                        <AlertTriangle size={9} /> {g.low_stock_variants} low stock
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => setAddMemberGroup(g.id)} title="Add product"
                                            className="p-2 rounded-lg hover:bg-app-surface-hover transition-colors">
                                            <Plus size={14} style={{ color: 'var(--app-primary)' }} />
                                        </button>
                                        <button onClick={() => setFormGroup(g)} title="Edit group"
                                            className="p-2 rounded-lg hover:bg-app-surface-hover transition-colors">
                                            <Pencil size={13} className="text-app-muted-foreground" />
                                        </button>
                                        <button onClick={() => handleDelete(g.id)} title="Delete group"
                                            className="p-2 rounded-lg hover:bg-app-error/10 transition-colors">
                                            <Trash2 size={13} className="text-app-muted-foreground hover:text-app-error" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <GroupDetail group={g} onMemberRemoved={loadData} />
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {filtered.length === 0 && (
                        <div className="py-16 text-center">
                            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                <Layers size={28} style={{ color: 'var(--app-primary)', opacity: 0.5 }} />
                            </div>
                            <p className="text-sm font-bold text-app-foreground">No substitution groups yet</p>
                            <p className="text-xs text-app-muted-foreground mt-1 max-w-sm mx-auto">
                                Create groups to track the same product from different origins — see which source is cheapest, which has best margins, and aggregate stock across variants.
                            </p>
                            <button onClick={() => setFormGroup({})}
                                className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[12px] font-bold shadow-lg"
                                style={{ background: 'var(--app-primary)' }}>
                                <Plus size={14} /> Create First Group
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Modals ──────────────────────────────────────────── */}
            {formGroup !== null && (
                <GroupFormModal group={formGroup.id ? formGroup : undefined} onClose={() => setFormGroup(null)} onSaved={loadData} />
            )}
            {addMemberGroup !== null && (
                <AddMemberModal groupId={addMemberGroup} onClose={() => setAddMemberGroup(null)} onAdded={loadData} />
            )}
        </div>
    )
}
