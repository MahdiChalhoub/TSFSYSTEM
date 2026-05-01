'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    getTaxRateCategories, saveTaxRateCategory,
    deleteTaxRateCategory, seedTaxRateCategoriesFromTemplate,
} from '@/app/actions/finance/tax-engine'
import { toast } from 'sonner'
import {
    Percent, Plus, Trash2, Pencil, Loader2, Search,
    CheckCircle2, Wand2, Star, RefreshCw, X, Save,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────
interface TaxRateCategory {
    id: number
    name: string
    rate: number          // decimal fraction: 0.18 = 18%
    country_code: string
    is_default: boolean
    description: string
    is_active: boolean
    products_count: number
}

// ── Form Dialog ────────────────────────────────────────────────────
function CategoryForm({
    item, onSave, onClose,
}: { item?: TaxRateCategory; onClose: () => void; onSave: () => void }) {
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        name: item?.name || '',
        ratePct: item ? String(+(item.rate * 100).toFixed(4)) : '',
        country_code: item?.country_code || '',
        description: item?.description || '',
        is_default: item?.is_default || false,
        is_active: item?.is_active ?? true,
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.name || !form.ratePct) return toast.error('Name and rate are required')
        setSaving(true)
        try {
            await saveTaxRateCategory(item?.id || null, {
                name: form.name,
                rate: parseFloat(form.ratePct) / 100,
                country_code: form.country_code,
                description: form.description,
                is_default: form.is_default,
                is_active: form.is_active,
            })
            toast.success(item ? 'Rate category updated' : 'Rate category created')
            onSave()
            onClose()
        } catch {
            toast.error('Failed to save rate category')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                        <Percent size={15} />
                    </div>
                    <div className="flex-1">
                        <div className="text-[13px] font-bold text-app-foreground">
                            {item ? 'Edit Rate Category' : 'New Rate Category'}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/30 transition-all">
                        <X size={14} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                            Name *
                        </label>
                        <input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder='e.g. "Standard Rate 18%"'
                            required
                            className="w-full px-3 py-2 text-[13px] bg-app-surface border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                                Rate (%) *
                            </label>
                            <div className="relative">
                                <input
                                    value={form.ratePct}
                                    onChange={e => setForm(f => ({ ...f, ratePct: e.target.value }))}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    placeholder="18.00"
                                    required
                                    className="w-full pl-3 pr-8 py-2 text-[13px] bg-app-surface border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-app-muted-foreground">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                                Country Code
                            </label>
                            <input
                                value={form.country_code}
                                onChange={e => setForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))}
                                placeholder="CI"
                                maxLength={3}
                                className="w-full px-3 py-2 text-[13px] bg-app-surface border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                            Description
                        </label>
                        <input
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="e.g. Standard TVA rate for most goods"
                            className="w-full px-3 py-2 text-[13px] bg-app-surface border border-app-border rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.is_default}
                                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                                className="rounded"
                            />
                            <span className="text-[12px] font-bold text-app-foreground">Set as default rate</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                className="rounded"
                            />
                            <span className="text-[12px] font-bold text-app-foreground">Active</span>
                        </label>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-[12px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border rounded-xl hover:bg-app-surface transition-all">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-app-primary hover:brightness-110 text-white rounded-xl transition-all disabled:opacity-60"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {item ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TaxRateCategoriesPage() {
    const router = useRouter()
    const [categories, setCategories] = useState<TaxRateCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [editItem, setEditItem] = useState<TaxRateCategory | 'new' | null>(null)
    const [search, setSearch] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const data = await getTaxRateCategories()
            setCategories(Array.isArray(data) ? data : data?.results || [])
        } catch {
            toast.error('Failed to load rate categories')
        } finally {
            setLoading(false)
        }
    }

    async function handleSeedFromTemplate() {
        setSeeding(true)
        try {
            const result = await seedTaxRateCategoriesFromTemplate()
            if (result?.error) return toast.error(result.error)
            toast.success(result?.message || 'Rate categories seeded from country template')
            await loadData()
        } catch {
            toast.error('Failed to seed from template')
        } finally {
            setSeeding(false)
        }
    }

    async function handleDelete(id: number, productsCount: number) {
        if (productsCount > 0) return toast.error(`Cannot delete — ${productsCount} product(s) use this category`)
        if (!confirm('Delete this rate category?')) return
        setDeleting(id)
        try {
            await deleteTaxRateCategory(id)
            toast.success('Rate category deleted')
            await loadData()
        } catch {
            toast.error('Failed to delete rate category')
        } finally {
            setDeleting(null)
        }
    }

    const filtered = categories.filter(c =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.country_code.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-app-primary" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-shrink-0 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Percent size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            Tax Rate Categories
                        </h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Per-Product VAT Rate Overrides · {categories.length} Configured
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleSeedFromTemplate}
                        disabled={seeding}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-60"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        }}>
                        {seeding ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                        <span className="hidden sm:inline">Seed from Template</span>
                    </button>
                    <button onClick={loadData}
                        className="p-2 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                        <RefreshCw size={13} />
                    </button>
                    <button onClick={() => setEditItem('new')}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Plus size={14} />
                        <span className="hidden sm:inline">New Category</span>
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex-shrink-0 mb-4 px-4 py-3 rounded-2xl text-[12px] font-bold"
                style={{
                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, var(--app-surface))',
                    border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}>
                💡 Assign a Tax Rate Category to individual products on the product setup page. The engine uses the category rate instead of the legacy <code className="text-app-foreground">tva_rate</code> field. Use <strong className="text-app-foreground">Seed from Template</strong> to auto-populate rates from your country&apos;s standard VAT schedule.
            </div>

            {/* Search */}
            <div className="flex-shrink-0 mb-4 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search rate categories... (Ctrl+K)"
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                />
            </div>

            {/* Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Percent size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground mb-3">
                            {search ? 'No matching rate categories' : 'No rate categories configured yet'}
                        </p>
                        {!search && (
                            <div className="flex gap-2">
                                <button onClick={handleSeedFromTemplate} disabled={seeding}
                                    className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl transition-all"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                    {seeding ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                    Seed from Country Template
                                </button>
                                <button onClick={() => setEditItem('new')}
                                    className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl bg-app-primary text-white transition-all">
                                    <Plus size={13} /> Create Manually
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                        {filtered.map(cat => (
                            <div key={cat.id}
                                className="group rounded-2xl overflow-hidden transition-all hover:brightness-[1.02]"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: `1px solid ${cat.is_default ? 'color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                }}>
                                {/* Card Header */}
                                <div className="flex items-center gap-3 px-4 py-3"
                                    style={{
                                        background: `color-mix(in srgb, var(--app-primary) ${cat.is_default ? 5 : 2}%, var(--app-surface))`,
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                        borderLeft: `3px solid ${cat.is_default ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-[15px]"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        {(cat.rate * 100).toFixed(0)}%
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-bold text-app-foreground truncate">{cat.name}</span>
                                            {cat.is_default && <Star size={11} style={{ color: 'var(--app-primary)', flexShrink: 0 }} />}
                                        </div>
                                        <div className="text-[10px] font-bold text-app-muted-foreground">
                                            {cat.country_code || 'All Countries'} · {cat.products_count} product{cat.products_count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${cat.is_active ? 'text-app-success' : 'text-app-error'}`}
                                        style={{
                                            background: cat.is_active ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                        }}>
                                        {cat.is_active ? 'Active' : 'Inactive'}
                                    </div>
                                </div>

                                {/* Description + Actions */}
                                <div className="px-4 py-3 flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-app-muted-foreground flex-1 min-w-0 truncate">
                                        {cat.description || '—'}
                                    </p>
                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditItem(cat)}
                                            className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/30 transition-all">
                                            <Pencil size={12} />
                                        </button>
                                        <button onClick={() => handleDelete(cat.id, cat.products_count)}
                                            disabled={deleting === cat.id}
                                            className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error hover:bg-red-400/10 transition-all disabled:opacity-50">
                                            {deleting === cat.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form Dialog */}
            {editItem !== null && (
                <CategoryForm
                    item={editItem === 'new' ? undefined : editItem}
                    onClose={() => setEditItem(null)}
                    onSave={loadData}
                />
            )}
        </div>
    )
}
