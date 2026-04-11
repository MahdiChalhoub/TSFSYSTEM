// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { getCategoryRules, createCategoryRule, updateCategoryRule, deleteCategoryRule } from '@/app/actions/plm-governance'
import { erpFetch } from '@/lib/erp-api'
import {
    FolderCog, Plus, Pencil, Trash2, X, Save, RefreshCw,
    Barcode, Package, Image, Users, Tag, Check
} from 'lucide-react'
import { toast } from 'sonner'

export default function CategoryRulesPage() {
    const [rules, setRules] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<any>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const [rulesRes, catData] = await Promise.all([
            getCategoryRules(),
            erpFetch('inventory/categories/').then(d => Array.isArray(d) ? d : d.results || []).catch(() => [])
        ])
        if (rulesRes.success) setRules(rulesRes.data)
        setCategories(catData)
        setLoading(false)
    }

    async function handleSave() {
        if (!editing) return
        setSaving(true)
        const data = { ...editing }
        let res
        if (data.id) {
            res = await updateCategoryRule(data.id, data)
        } else {
            res = await createCategoryRule(data)
        }
        if (res.success) {
            toast.success(data.id ? 'Rule updated' : 'Rule created')
            setEditing(null)
            loadData()
        } else {
            toast.error(res.error)
        }
        setSaving(false)
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this rule?')) return
        const res = await deleteCategoryRule(id)
        if (res.success) {
            toast.success('Rule deleted')
            loadData()
        } else {
            toast.error(res.error)
        }
    }

    const usedCatIds = rules.map(r => r.category)
    const availableCategories = categories.filter(c => !usedCatIds.includes(c.id))

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
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-warning))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <FolderCog className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Category <span style={{ color: 'var(--app-primary)' }}>Rules</span>
                        </h1>
                    </div>
                </div>
                <button onClick={() => setEditing({ requires_barcode: false, requires_brand: false, requires_unit: true, requires_packaging: false, requires_photo: false, requires_supplier: false, barcode_prefix: '', barcode_mode_override: '', default_product_type: '', default_tva_rate: null, auto_create_packaging: false, packaging_template: [], auto_print_label: true, shelf_placement_required: true })}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                    <Plus className="h-4 w-4" /> New Rule
                </button>
            </div>

            {/* Rules List */}
            <div className="space-y-3">
                {rules.map(rule => (
                    <div key={rule.id} className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-app-foreground">{rule.category_name || `Category #${rule.category}`}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {rule.requires_barcode && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700"><Barcode size={9} />Barcode req.</span>}
                                    {rule.requires_brand && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700"><Tag size={9} />Brand req.</span>}
                                    {rule.requires_packaging && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700"><Package size={9} />Pkg req.</span>}
                                    {rule.requires_photo && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-700"><Image size={9} />Photo req.</span>}
                                    {rule.requires_supplier && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-700"><Users size={9} />Supplier req.</span>}
                                    {rule.auto_create_packaging && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700"><Check size={9} />Auto-pkg</span>}
                                    {rule.default_product_type && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">Default: {rule.default_product_type}</span>}
                                    {rule.barcode_mode_override && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-700"><Barcode size={9} />{rule.barcode_mode_override}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setEditing({ ...rule })}
                                    className="p-2 rounded-lg hover:bg-app-surface-hover transition-all" title="Edit">
                                    <Pencil size={14} className="text-app-muted-foreground" />
                                </button>
                                <button onClick={() => handleDelete(rule.id)}
                                    className="p-2 rounded-lg hover:bg-red-50 transition-all" title="Delete">
                                    <Trash2 size={14} className="text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {rules.length === 0 && !editing && (
                <div className="text-center py-16">
                    <FolderCog size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                    <p className="text-sm font-bold text-app-muted-foreground">No category rules configured</p>
                    <p className="text-xs text-app-muted-foreground mb-4">Define per-category product creation policies</p>
                </div>
            )}

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditing(null)}>
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
                    <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl"
                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 z-10 p-4 flex items-center justify-between"
                            style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--app-border)' }}>
                            <h3 className="font-bold text-app-foreground">{editing.id ? 'Edit Rule' : 'New Category Rule'}</h3>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-app-surface-hover">
                                <X size={16} className="text-app-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-4 space-y-6">
                            {/* Category selector */}
                            {!editing.id && (
                                <div>
                                    <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2">Category</label>
                                    <select value={editing.category || ''} onChange={e => setEditing({ ...editing, category: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="">Select a category...</option>
                                        {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Required Fields */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-3">Required Fields</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {[
                                        { key: 'requires_barcode', label: 'Barcode' },
                                        { key: 'requires_brand', label: 'Brand' },
                                        { key: 'requires_unit', label: 'Unit' },
                                        { key: 'requires_packaging', label: 'Packaging' },
                                        { key: 'requires_photo', label: 'Photo' },
                                        { key: 'requires_supplier', label: 'Supplier' },
                                    ].map(f => (
                                        <label key={f.key} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                                            style={{ background: editing[f.key] ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'var(--app-surface)', border: `1px solid ${editing[f.key] ? 'var(--app-primary)' : 'var(--app-border)'}` }}>
                                            <input type="checkbox" checked={editing[f.key] || false}
                                                onChange={e => setEditing({ ...editing, [f.key]: e.target.checked })}
                                                className="rounded" />
                                            <span className="text-xs font-bold text-app-foreground">{f.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Defaults */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-3">Defaults</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Product Type</label>
                                        <select value={editing.default_product_type || ''} onChange={e => setEditing({ ...editing, default_product_type: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            <option value="">Use form selection</option>
                                            <option value="STANDARD">Standard</option>
                                            <option value="COMBO">Combo</option>
                                            <option value="SERVICE">Service</option>
                                            <option value="BLANK">Blank / Internal</option>
                                            <option value="FRESH">Fresh / Variable Weight</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Barcode Mode Override</label>
                                        <select value={editing.barcode_mode_override || ''} onChange={e => setEditing({ ...editing, barcode_mode_override: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                            <option value="">Use org default</option>
                                            <option value="INTERNAL_AUTO">Always auto-generate</option>
                                            <option value="SUPPLIER">Supplier barcode required</option>
                                            <option value="MANUAL">Manual entry only</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Automation */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-3">Automation</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {[
                                        { key: 'auto_create_packaging', label: 'Auto-create packaging' },
                                        { key: 'auto_print_label', label: 'Auto-print label' },
                                        { key: 'shelf_placement_required', label: 'Shelf placement task' },
                                    ].map(f => (
                                        <label key={f.key} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                            <input type="checkbox" checked={editing[f.key] || false}
                                                onChange={e => setEditing({ ...editing, [f.key]: e.target.checked })} className="rounded" />
                                            <span className="text-xs font-medium text-app-foreground">{f.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="sticky bottom-0 p-4 flex gap-2 justify-end"
                            style={{ background: 'var(--app-bg)', borderTop: '1px solid var(--app-border)' }}>
                            <button onClick={() => setEditing(null)}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving || (!editing.id && !editing.category)}
                                className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
                                style={{ background: 'var(--app-primary)' }}>
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                {editing.id ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
