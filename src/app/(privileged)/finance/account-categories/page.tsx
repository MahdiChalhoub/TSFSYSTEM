// @ts-nocheck
'use client'

import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
    Plus, Trash2, Edit3, Settings2, Save, X, Loader2,
    Banknote, Building, Smartphone, Briefcase, PiggyBank,
    Globe2, Lock, TrendingUp, Wallet, Layers, CreditCard,
    ArrowLeft, GripVertical, FolderTree
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    getAccountCategories, createAccountCategory, updateAccountCategory,
    deleteAccountCategory, getChartOfAccounts
} from '../accounts/actions'

/* ── Icon Map ── */
const ICON_MAP: Record<string, any> = {
    banknote: Banknote, building: Building, smartphone: Smartphone,
    briefcase: Briefcase, 'piggy-bank': PiggyBank, 'globe-2': Globe2,
    lock: Lock, 'trending-up': TrendingUp, wallet: Wallet, layers: Layers,
    'credit-card': CreditCard,
}
const getIcon = (name: string) => ICON_MAP[name] || Wallet
const DEFAULT_COLOR = '#6366f1'

const ICON_OPTIONS = [
    { value: 'banknote', label: '💵 Banknote' },
    { value: 'building', label: '🏦 Building' },
    { value: 'smartphone', label: '📱 Smartphone' },
    { value: 'briefcase', label: '💼 Briefcase' },
    { value: 'piggy-bank', label: '🐷 Piggy Bank' },
    { value: 'globe-2', label: '🌍 Globe' },
    { value: 'lock', label: '🔒 Lock' },
    { value: 'trending-up', label: '📈 Trending Up' },
    { value: 'wallet', label: '👛 Wallet' },
    { value: 'credit-card', label: '💳 Credit Card' },
    { value: 'layers', label: '📚 Layers' },
]

const COLOR_PRESETS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4',
    '#ec4899', '#64748b', '#14b8a6', '#6366f1', '#ef4444',
    '#84cc16', '#f97316',
]

/* ── COA Cascading Picker ── */
function COATreePicker({ coaList, selectedId, onSelect }: {
    coaList: any[]; selectedId: string; onSelect: (id: string) => void
}) {
    // Track the chain of selected IDs at each level: [rootId, level1Id, level2Id, ...]
    const [chain, setChain] = useState<string[]>([])

    // Build children map
    const childrenMap = useMemo(() => {
        const map = new Map<string, any[]>()
        for (const n of coaList) {
            const pid = (n.parent_id || 'ROOT').toString()
            if (!map.has(pid)) map.set(pid, [])
            map.get(pid)!.push(n)
        }
        // Sort each group by code
        for (const [, children] of map) {
            children.sort((a: any, b: any) => a.code.localeCompare(b.code))
        }
        return map
    }, [coaList])

    const byId = useMemo(() => {
        const map = new Map<string, any>()
        for (const n of coaList) map.set(n.id.toString(), n)
        return map
    }, [coaList])

    // When selectedId changes externally (e.g. editing), rebuild the chain
    useEffect(() => {
        if (!selectedId) { setChain([]); return }
        // Walk up the tree to build the chain
        const path: string[] = []
        let current = byId.get(selectedId)
        while (current) {
            path.unshift(current.id.toString())
            current = current.parent_id ? byId.get(current.parent_id.toString()) : null
        }
        setChain(path)
    }, [selectedId, byId])

    const handleSelect = (level: number, value: string) => {
        const newChain = [...chain.slice(0, level), value]
        setChain(newChain)
        // The selected COA parent = the deepest level in the chain
        onSelect(value)
    }

    // Check if a node is a valid parent (not a leaf posting account, no balance)
    const isValidParent = (node: any) => {
        const children = childrenMap.get(node.id.toString()) || []
        const isLeaf = node.allow_posting === true && children.length === 0
        const hasBalance = parseFloat(node.balance || '0') !== 0
        return !isLeaf && !hasBalance
    }

    // Build the cascade levels
    const levels: { parentId: string; items: any[] }[] = []

    // Level 0: root accounts
    const roots = childrenMap.get('ROOT') || []
    if (roots.length > 0) {
        levels.push({ parentId: 'ROOT', items: roots })
    }

    // Add subsequent levels based on the chain
    for (let i = 0; i < chain.length; i++) {
        const children = childrenMap.get(chain[i]) || []
        if (children.length > 0) {
            levels.push({ parentId: chain[i], items: children })
        }
    }

    const TYPE_COLORS: Record<string, string> = {
        ASSET: '#10b981', LIABILITY: '#f59e0b', EQUITY: '#8b5cf6',
        INCOME: '#3b82f6', EXPENSE: '#ef4444',
    }

    return (
        <div className="space-y-2">
            {levels.map((level, idx) => {
                const selectedAtLevel = chain[idx] || ''
                const parentNode = level.parentId !== 'ROOT' ? byId.get(level.parentId) : null
                const label = idx === 0
                    ? 'Select Account Type'
                    : `${parentNode?.code} — ${parentNode?.name}`

                return (
                    <div key={`level-${idx}-${level.parentId}`} className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <label className="text-[9px] font-black uppercase tracking-wider text-app-text-faint block mb-1 flex items-center gap-1.5">
                            {idx > 0 && (
                                <span className="flex items-center gap-0.5">
                                    {'→'.repeat(idx)}
                                </span>
                            )}
                            {label}
                        </label>
                        <Select
                            value={selectedAtLevel}
                            onValueChange={(v) => handleSelect(idx, v)}
                        >
                            <SelectTrigger className="h-9 text-xs font-bold">
                                <SelectValue placeholder={idx === 0 ? "Choose a root account..." : "Choose sub-account..."} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {level.items.map((item: any) => {
                                    const children = childrenMap.get(item.id.toString()) || []
                                    const hasChildren = children.length > 0
                                    const valid = isValidParent(item)
                                    const typeColor = TYPE_COLORS[item.type] || '#64748b'

                                    return (
                                        <SelectItem
                                            key={item.id}
                                            value={item.id.toString()}
                                            disabled={!valid}
                                            className="text-xs"
                                        >
                                            <span className="flex items-center gap-2 w-full">
                                                <span className="font-mono text-[10px] opacity-50">{item.code}</span>
                                                <span className="font-medium flex-1">{item.name}</span>
                                                <span className="text-[8px] font-black px-1 py-0.5 rounded"
                                                    style={{ background: `${typeColor}15`, color: typeColor }}>
                                                    {item.type}
                                                </span>
                                                {hasChildren && (
                                                    <span className="text-[8px] text-app-text-faint">▸ {children.length}</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                )
            })}
        </div>
    )
}


export default function AccountCategoriesPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [coaList, setCoaList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
    const [form, setForm] = useState({
        name: '', code: '', icon: 'wallet', color: '#6366f1',
        description: '', coa_parent: '' as string, sort_order: 0
    })

    const load = async () => {
        try {
            const [cats, coa] = await Promise.all([
                getAccountCategories(),
                getChartOfAccounts(),
            ])
            setCategories(Array.isArray(cats) ? cats : [])
            setCoaList(Array.isArray(coa) ? coa : [])
        } catch { }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const resetForm = () => {
        setForm({ name: '', code: '', icon: 'wallet', color: '#6366f1', description: '', coa_parent: '', sort_order: 0 })
        setShowForm(false)
        setEditingId(null)
    }

    const startEdit = (cat: any) => {
        setForm({
            name: cat.name, code: cat.code, icon: cat.icon || 'wallet',
            color: cat.color || '#6366f1', description: cat.description || '',
            coa_parent: cat.coa_parent?.toString() || '', sort_order: cat.sort_order || 0
        })
        setEditingId(cat.id)
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.name || !form.code) { toast.error('Name and code are required'); return }
        setSaving(true)
        try {
            const payload: any = {
                name: form.name, code: form.code.toUpperCase(),
                icon: form.icon, color: form.color,
                description: form.description, sort_order: form.sort_order,
            }
            if (form.coa_parent) payload.coa_parent = parseInt(form.coa_parent)
            else payload.coa_parent = null

            if (editingId) {
                await updateAccountCategory(editingId, payload)
                toast.success('Category updated')
            } else {
                await createAccountCategory(payload)
                toast.success('Category created')
            }
            resetForm()
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Failed')
        }
        setSaving(false)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteAccountCategory(deleteTarget)
            toast.success('Category deleted')
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Cannot delete — has linked accounts')
        }
        setDeleteTarget(null)
    }

    const totalAccounts = categories.reduce((sum, c) => sum + (c.account_count || 0), 0)

    if (loading) return (
        <div className="app-page flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-primary)', opacity: 0.6 }} />
        </div>
    )

    return (
        <div className="app-page max-w-4xl mx-auto space-y-5 animate-in fade-in duration-300">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <Link href="/finance/accounts">
                        <button className="w-9 h-9 rounded-xl border border-app-border flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-app-surface transition-all">
                            <ArrowLeft size={16} />
                        </button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Settings2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-text tracking-tight">
                                Account <span style={{ color: 'var(--app-primary)' }}>Categories</span>
                            </h1>
                            <p className="text-[10px] font-bold text-app-text-faint uppercase tracking-widest">
                                {categories.length} categories · {totalAccounts} accounts linked
                            </p>
                        </div>
                    </div>
                </div>

                <Button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-xl gap-2">
                    <Plus size={14} /> New Category
                </Button>
            </div>

            {/* ── KPI Ribbon ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Categories', value: categories.length, color: 'var(--app-primary)' },
                    { label: 'Active', value: categories.filter(c => c.is_active).length, color: 'var(--app-success)' },
                    { label: 'With COA Link', value: categories.filter(c => c.coa_parent).length, color: 'var(--app-info)' },
                    { label: 'Total Accounts', value: totalAccounts, color: 'var(--app-warning)' },
                ].map(kpi => (
                    <div key={kpi.label} className="rounded-xl border border-app-border/50 px-4 py-3"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-text-faint">{kpi.label}</p>
                        <p className="text-xl font-black mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Form Modal ── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={e => { if (e.target === e.currentTarget) resetForm() }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', borderColor: 'color-mix(in srgb, var(--app-primary) 20%, var(--app-border))' }}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-app-text flex items-center gap-2">
                                {editingId ? <Edit3 size={14} style={{ color: 'var(--app-primary)' }} /> : <Plus size={14} style={{ color: 'var(--app-primary)' }} />}
                                {editingId ? 'Edit Category' : 'New Category'}
                            </h3>
                            <button onClick={resetForm} className="text-app-text-muted hover:text-app-text p-1 rounded-lg hover:bg-app-background transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Row 1: Name + Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Name *</label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Cash Drawers" className="text-sm font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Code *</label>
                                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. CASH" className="text-sm font-bold font-mono" />
                            </div>
                        </div>

                        {/* Row 2: Description */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Description</label>
                            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Physical cash registers, tills, and petty cash boxes" className="text-sm" />
                        </div>

                        {/* Row 3: Icon + Color + Sort Order */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Icon</label>
                                <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ICON_OPTIONS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                                        className="w-8 h-8 rounded-lg border border-app-border cursor-pointer shrink-0" />
                                    <div className="flex gap-1 flex-wrap">
                                        {COLOR_PRESETS.map(c => (
                                            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                                                className={`w-5 h-5 rounded-full border-2 transition-all ${form.color === c ? 'border-app-text scale-110' : 'border-transparent hover:scale-110'}`}
                                                style={{ background: c }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">Sort Order</label>
                                <Input type="number" value={form.sort_order}
                                    onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                                    className="text-sm font-bold" />
                            </div>
                        </div>

                        {/* Row 4: COA Parent — Tree Browser */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-app-text-faint block mb-1">
                                COA Parent <span className="normal-case font-normal">(click to expand, select a node)</span>
                            </label>
                            {form.coa_parent && (() => {
                                const sel = coaList.find((a: any) => a.id.toString() === form.coa_parent)
                                return sel ? (
                                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border border-app-primary/30"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)' }}>
                                        <FolderTree size={12} style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-xs font-bold text-app-text">{sel.code} — {sel.name}</span>
                                        <span className="text-[9px] text-app-text-faint">({sel.type})</span>
                                        <button onClick={() => setForm(f => ({ ...f, coa_parent: '' }))}
                                            className="ml-auto text-app-text-muted hover:text-rose-400 transition-colors">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : null
                            })()}
                            <COATreePicker
                                coaList={coaList}
                                selectedId={form.coa_parent}
                                onSelect={(id: string) => setForm(f => ({ ...f, coa_parent: id }))}
                            />
                        </div>

                        {/* Preview + Save */}
                        <div className="flex items-center justify-between pt-2 border-t border-app-border/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${form.color || DEFAULT_COLOR} 15%, transparent)`, color: form.color || DEFAULT_COLOR }}>
                                    {(() => { const Ic = getIcon(form.icon); return <Ic size={20} /> })()}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-app-text">{form.name || 'Preview'}</p>
                                    <p className="text-[10px] text-app-text-faint font-mono">{form.code || 'CODE'}</p>
                                </div>
                            </div>
                            <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Category'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Category Cards ── */}
            <div className="space-y-2">
                {categories.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl border-2 border-dashed border-app-border">
                        <FolderTree size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-bold text-app-text-muted">No categories yet</p>
                        <p className="text-[11px] text-app-text-faint mt-1">Create your first category to organize financial accounts.</p>
                    </div>
                ) : (
                    categories.map(cat => {
                        const Icon = getIcon(cat.icon)
                        const color = cat.color || DEFAULT_COLOR
                        const coaInfo = cat.coa_parent_name ? `${cat.coa_parent_code} — ${cat.coa_parent_name}` : null
                        return (
                            <div key={cat.id}
                                className="flex items-center gap-4 p-4 rounded-xl border border-app-border/60 bg-app-surface hover:border-app-border transition-all group"
                                style={{ borderLeft: `4px solid ${color}` }}>
                                {/* Icon */}
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                                    <Icon size={22} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-app-text truncate">{cat.name}</h3>
                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-app-text-faint"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                            {cat.code}
                                        </span>
                                        {!cat.is_active && (
                                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/10 text-rose-500">INACTIVE</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-app-text-faint">
                                        <span className="font-bold">{cat.account_count || 0} accounts</span>
                                        {coaInfo && (
                                            <span className="flex items-center gap-1">
                                                <FolderTree size={9} /> {coaInfo}
                                            </span>
                                        )}
                                        {cat.description && (
                                            <span className="hidden sm:inline truncate max-w-[200px]">· {cat.description}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Sort order badge */}
                                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-app-text-faint shrink-0">
                                    <GripVertical size={12} className="opacity-40" />
                                    #{cat.sort_order}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => startEdit(cat)}>
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600" onClick={() => setDeleteTarget(cat.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <ConfirmDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                onConfirm={handleDelete} title="Delete Category?"
                description="Only empty categories (no linked accounts) can be deleted. Move accounts to another category first." variant="danger" />
        </div>
    )
}
