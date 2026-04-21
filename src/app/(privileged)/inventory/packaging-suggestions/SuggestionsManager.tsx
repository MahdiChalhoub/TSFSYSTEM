// @ts-nocheck
'use client'

/**
 * Packaging Suggestions Rules Manager
 * ═══════════════════════════════════════════════════════════════
 * Admin UI for the Smart Suggestion Engine.
 *
 * Create rules like:
 *   Category=Tissue → Pack 12
 *   Category=Tissue + Brand=Fine → Pack 24
 *   Category=Tissue + Brand=Fine + Size=Big → Pack 30
 *
 * Higher specificity (more dimensions set) = higher priority = wins.
 * Explicit `priority` overrides. Usage frequency breaks ties.
 */

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
    Sparkles, Plus, Trash2, Loader2, X, Save, Tag, Layers, Box,
    FolderTree, Zap, TrendingUp, Info,
} from 'lucide-react'
import {
    createPackagingRule, deletePackagingRule,
    type PackagingSuggestionRule,
} from '@/app/actions/inventory/packaging-suggestions'

type Option = { id: number; name: string; code?: string }

export default function SuggestionsManager({
    initialRules,
    categories, brands, attributes, units, unitPackages,
}: {
    initialRules: PackagingSuggestionRule[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    units: any[]
    unitPackages: any[]
}) {
    const router = useRouter()
    const [rules, setRules] = useState<PackagingSuggestionRule[]>(initialRules)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form state
    const [categoryId, setCategoryId] = useState<string>('')
    const [brandId, setBrandId] = useState<string>('')
    const [attributeId, setAttributeId] = useState<string>('')
    const [attributeValue, setAttributeValue] = useState<string>('')
    const [packagingId, setPackagingId] = useState<string>('')
    const [priority, setPriority] = useState<string>('')

    const resetForm = () => {
        setCategoryId(''); setBrandId(''); setAttributeId(''); setAttributeValue('')
        setPackagingId(''); setPriority('')
    }

    const specificity = (categoryId ? 1 : 0) + (brandId ? 1 : 0) + (attributeId ? 1 : 0)
    const previewPriority = priority ? Number(priority) : specificity * 10

    const selectedPackaging = useMemo(
        () => unitPackages.find((p: any) => String(p.id) === packagingId),
        [packagingId, unitPackages]
    )

    const groupedPackages = useMemo(() => {
        const byUnit: Record<string, any[]> = {}
        for (const p of unitPackages) {
            const key = p.unit_code || p.unit_name || 'Unit'
            if (!byUnit[key]) byUnit[key] = []
            byUnit[key].push(p)
        }
        return byUnit
    }, [unitPackages])

    const handleSave = async () => {
        if (!packagingId) { toast.error('Pick a packaging template'); return }
        if (!categoryId && !brandId && !attributeId) {
            toast.error('At least one dimension (category, brand, or attribute) is required')
            return
        }
        setSaving(true)
        try {
            const created = await createPackagingRule({
                category: categoryId ? Number(categoryId) : null,
                brand: brandId ? Number(brandId) : null,
                attribute: attributeId ? Number(attributeId) : null,
                attribute_value: attributeValue || null,
                packaging: Number(packagingId),
                priority: priority ? Number(priority) : 0,
            })
            setRules(prev => [...prev, created].sort(byPriority))
            toast.success('Rule created')
            resetForm(); setShowForm(false)
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to create rule')
        }
        setSaving(false)
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this rule?')) return
        try {
            await deletePackagingRule(id)
            setRules(prev => prev.filter(r => r.id !== id))
            toast.success('Rule deleted')
            router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Delete failed') }
    }

    const sortedRules = useMemo(() => [...rules].sort(byPriority), [rules])

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                            boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }}>
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                            Packaging Suggestions
                        </h1>
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>
                            Smart rules that auto-suggest packaging when creating products
                        </p>
                    </div>
                </div>
                <button type="button" onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                    style={{
                        background: showForm ? 'var(--app-background)' : 'var(--app-primary)',
                        color: showForm ? 'var(--app-muted-foreground)' : 'white',
                        border: showForm ? '1px solid var(--app-border)' : 'none',
                        boxShadow: showForm ? 'none' : '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    {showForm ? <><X size={12} /> Cancel</> : <><Plus size={12} /> New Rule</>}
                </button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <KpiCard label="Total Rules" value={rules.length} icon={<Sparkles size={13} />} />
                <KpiCard label="Most Specific"
                    value={Math.max(0, ...rules.map(r => r.specificity || 0))}
                    hint="dimensions"
                    icon={<Layers size={13} />} />
                <KpiCard label="Most Used"
                    value={Math.max(0, ...rules.map(r => r.usage_count || 0))}
                    hint="acceptances"
                    icon={<TrendingUp size={13} />} />
                <KpiCard label="Packages Available" value={unitPackages.length}
                    hint="templates" icon={<Box size={13} />} />
            </div>

            {/* Rule Creation Form */}
            {showForm && (
                <div className="p-4 rounded-2xl mb-4 space-y-3 animate-in fade-in slide-in-from-top-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                    }}>
                    <div className="flex items-start gap-2 mb-1">
                        <Info size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>
                            Any combination of <strong>Category + Brand + Attribute</strong> — more dimensions = higher priority (auto).
                            Leave a dimension empty to act as a wildcard.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <FieldSelect label="Category" icon={<FolderTree size={11} />}
                            value={categoryId} onChange={setCategoryId}
                            placeholder="Any category"
                            options={categories.map(c => ({ value: c.id, label: c.name }))} />
                        <FieldSelect label="Brand" icon={<Tag size={11} />}
                            value={brandId} onChange={setBrandId}
                            placeholder="Any brand"
                            options={brands.map(b => ({ value: b.id, label: b.name }))} />
                        <FieldSelect label="Attribute" icon={<Layers size={11} />}
                            value={attributeId} onChange={setAttributeId}
                            placeholder="Any attribute"
                            options={attributes.map(a => ({ value: a.id, label: a.name }))} />
                    </div>

                    {attributeId && (
                        <div className="animate-in fade-in">
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
                                style={{ color: 'var(--app-primary)' }}>
                                Attribute Value (optional)
                            </label>
                            <input value={attributeValue} onChange={e => setAttributeValue(e.target.value)}
                                placeholder="e.g. Big, Red, XL — leave blank to match any value"
                                className="w-full px-3 py-2 rounded-lg text-[12px] font-bold outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1"
                                style={{ color: 'var(--app-primary)' }}>
                                <Box size={11} /> Suggest Packaging *
                            </label>
                            <select value={packagingId} onChange={e => setPackagingId(e.target.value)} required
                                className="w-full px-3 py-2 rounded-lg text-[12px] font-bold outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="">— Select a package template —</option>
                                {Object.entries(groupedPackages).map(([unitCode, pkgs]) => (
                                    <optgroup key={unitCode} label={`Unit: ${unitCode}`}>
                                        {(pkgs as any[]).map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} (×{p.ratio} {p.unit_code})
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1"
                                style={{ color: 'var(--app-primary)' }}>
                                <Zap size={11} /> Priority (manual)
                            </label>
                            <input type="number" min="0" value={priority} onChange={e => setPriority(e.target.value)}
                                placeholder={`Auto: ${specificity * 10}`}
                                className="w-full px-3 py-2 rounded-lg text-[12px] font-mono font-bold text-center outline-none"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>

                    {/* Live preview */}
                    {(categoryId || brandId || attributeId) && packagingId && (
                        <div className="px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                color: 'var(--app-primary)',
                            }}>
                            <Sparkles size={12} />
                            <span>
                                When a product matches
                                {categoryId && <> <Chip>{categories.find(c => String(c.id) === categoryId)?.name}</Chip></>}
                                {brandId && <> + <Chip>{brands.find(b => String(b.id) === brandId)?.name}</Chip></>}
                                {attributeId && <> + <Chip>{attributes.find(a => String(a.id) === attributeId)?.name}{attributeValue ? `=${attributeValue}` : ''}</Chip></>}
                                , suggest <strong>{selectedPackaging?.name}</strong> at priority <strong>{previewPriority}</strong>
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => { resetForm(); setShowForm(false) }}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            Cancel
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving || !packagingId}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}>
                            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Create Rule</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            {sortedRules.length === 0 ? (
                <div className="p-12 rounded-2xl text-center"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px dashed var(--app-border)',
                    }}>
                    <Sparkles size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--app-muted-foreground)' }} />
                    <h3 className="text-sm font-black mb-1" style={{ color: 'var(--app-foreground)' }}>
                        No suggestion rules yet
                    </h3>
                    <p className="text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>
                        Create rules to make the system auto-suggest packaging when users create products.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    {/* Header row */}
                    <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 text-[9px] font-black uppercase tracking-widest"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                        <div className="w-6"></div>
                        <div>Match When</div>
                        <div>Suggest</div>
                        <div className="text-right">Ratio</div>
                        <div className="text-center w-[70px]">Priority</div>
                        <div className="text-center w-[60px]">Uses</div>
                        <div className="w-8"></div>
                    </div>

                    <div className="divide-y divide-app-border/30">
                        {sortedRules.map((r: any) => (
                            <div key={r.id}
                                className="grid grid-cols-[auto_1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-app-background/40 transition-colors group">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Sparkles size={11} />
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                    {r.category_name && <Chip>{r.category_name}</Chip>}
                                    {r.brand_name && <Chip tone="amber">{r.brand_name}</Chip>}
                                    {r.attribute_name && <Chip tone="info">{r.attribute_name}{r.attribute_value ? `=${r.attribute_value}` : ''}</Chip>}
                                    {!r.category_name && !r.brand_name && !r.attribute_name && (
                                        <span className="text-[10px] italic" style={{ color: 'var(--app-muted-foreground)' }}>
                                            (global — no dimensions)
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    <Box size={11} style={{ color: '#8b5cf6' }} />
                                    {r.packaging_name}
                                </div>

                                <div className="text-right text-[11px] font-mono tabular-nums font-bold"
                                    style={{ color: 'var(--app-primary)' }}>
                                    ×{Number(r.packaging_ratio).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                    <span className="text-[9px] ml-1" style={{ color: 'var(--app-muted-foreground)' }}>{r.packaging_unit_code}</span>
                                </div>

                                <div className="w-[70px] text-center">
                                    <span className="inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded-full text-[10px] font-black"
                                        style={{
                                            background: r.priority > 0
                                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: r.priority > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)',
                                        }}
                                        title={r.priority > 0 ? 'Manual override' : `Auto from ${r.specificity} dimension(s)`}>
                                        {r.effective_priority}
                                    </span>
                                </div>

                                <div className="w-[60px] text-center text-[10px] font-mono tabular-nums"
                                    style={{ color: r.usage_count > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                    {r.usage_count || 0}
                                </div>

                                <button type="button" onClick={() => handleDelete(r.id)}
                                    className="w-8 opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all flex justify-center"
                                    style={{ color: 'var(--app-error, #ef4444)' }}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function byPriority(a: PackagingSuggestionRule, b: PackagingSuggestionRule) {
    return (b.effective_priority ?? 0) - (a.effective_priority ?? 0)
        || (b.usage_count ?? 0) - (a.usage_count ?? 0)
}

function KpiCard({ label, value, hint, icon }: { label: string; value: any; hint?: string; icon?: any }) {
    return (
        <div className="px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
                style={{ color: 'var(--app-muted-foreground)' }}>
                {icon}{label}
            </div>
            <div className="text-[18px] font-black font-mono tabular-nums mt-0.5" style={{ color: 'var(--app-foreground)' }}>
                {value}
                {hint && <span className="text-[9px] font-bold ml-1" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</span>}
            </div>
        </div>
    )
}

function Chip({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'amber' | 'info' }) {
    const palette: Record<string, { bg: string; fg: string }> = {
        primary: { bg: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', fg: 'var(--app-primary)' },
        amber: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
        info: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', fg: 'var(--app-info, #3b82f6)' },
    }
    const p = palette[tone]
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
            style={{ background: p.bg, color: p.fg }}>
            {children}
        </span>
    )
}

function FieldSelect({ label, icon, value, onChange, options, placeholder }: {
    label: string; icon?: any; value: string; onChange: (v: string) => void
    options: { value: number; label: string }[]; placeholder: string
}) {
    return (
        <div>
            <label className="block text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1"
                style={{ color: 'var(--app-primary)' }}>
                {icon}{label}
            </label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[12px] font-bold outline-none"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                <option value="">{placeholder}</option>
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    )
}
