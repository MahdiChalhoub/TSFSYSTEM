'use client'

import { useState, useEffect, useCallback, useMemo, type ComponentType, type ReactNode } from 'react'
import {
    getLabelPolicy, updateLabelPolicy,
    getBarcodePolicy, updateBarcodePolicy,
    getWeightPolicy, updateWeightPolicy,
    getCategoryRules, deleteCategoryRule,
} from '@/app/actions/plm-governance'
import { getProductNamingRule, saveProductNamingRule } from '@/app/actions/settings'
import { getAttributeTree } from '@/app/actions/inventory/attributes'

// V3 naming formula slot — extends the action's component type with attribute-specific
// fields. The settings action only knows about the v1 component shape; the v3 formula
// is stored alongside under `v3_formula` and read back at render time.
type NamingFormulaSlot = {
    id: string
    label: string
    enabled: boolean
    type: 'static' | 'attribute'
    useShortLabel: boolean
    useShortName: boolean
}
import {
    Shield, Tag, Barcode, Scale, FolderCog, Eye,
    Save, RefreshCw, Settings, Printer, AlertTriangle,
    Plus, Pencil, Trash2, Check, MapPin, Building2, Globe, Layers,
    Warehouse, GitBranch, Network,
    Wand2, ArrowUp, ArrowDown, Tags, Type,
    EyeOff, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

type IconComponent = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

type LabelPolicyShape = { id?: number; default_output_method?: string; default_copies?: number; [key: string]: unknown }
type BarcodePolicyShape = { id?: number; default_mode?: string; internal_prefix?: string; [key: string]: unknown }
type WeightPolicyShape = { id?: number; default_weight_unit?: string; weight_tolerance_pct?: number; [key: string]: unknown }
type CategoryRuleShape = { id: number; category?: number; category_name?: string; barcode_mode?: string; label_template?: string; require_weight?: boolean; [key: string]: unknown }
type VisibilityPolicyShape = {
    default_scope?: string; multi_branch_mode?: string;
    allow_cross_branch_transfer_view?: boolean; show_transit_stock?: boolean;
    show_reserved_stock?: boolean; show_available_only?: boolean;
    aggregate_packaging_levels?: boolean; hide_zero_stock?: boolean;
    allow_scope_override_per_user?: boolean; show_stock_value?: boolean;
    [key: string]: unknown
}
type AttributeNode = { id: number | string; name: string; parent?: number | string | null; show_in_name?: boolean; short_label?: string; children?: AttributeNode[] }

// ═══════════════════════════════════════════════════════════════
// Policy Tab Definitions
// ═══════════════════════════════════════════════════════════════

const POLICY_TABS = [
    { key: 'naming', label: 'Naming', icon: Wand2, gradient: 'linear-gradient(135deg, var(--app-warning), var(--app-error))', desc: 'Auto-name formula' },
    { key: 'visibility', label: 'Visibility', icon: Eye, gradient: 'linear-gradient(135deg, var(--app-accent), var(--app-accent))', desc: 'Stock scope & access' },
    { key: 'label', label: 'Labels', icon: Tag, gradient: 'linear-gradient(135deg, var(--app-primary), var(--app-warning))', desc: 'Print & automation' },
    { key: 'barcode', label: 'Barcodes', icon: Barcode, gradient: 'linear-gradient(135deg, var(--app-primary), var(--app-accent))', desc: 'Generation & validation' },
    { key: 'weight', label: 'Weight', icon: Scale, gradient: 'linear-gradient(135deg, var(--app-warning), var(--app-accent))', desc: 'Scale & tolerance' },
    { key: 'category', label: 'Category Rules', icon: FolderCog, gradient: 'linear-gradient(135deg, var(--app-success), var(--app-primary))', desc: 'Per-category overrides' },
] as const

type TabKey = typeof POLICY_TABS[number]['key']

// ═══════════════════════════════════════════════════════════════
// Visibility Scope Options
// ═══════════════════════════════════════════════════════════════

const VISIBILITY_SCOPES = [
    {
        key: 'LOCAL', label: 'Local Only', icon: MapPin,
        desc: 'Users see stock only in their assigned locations/zones within their warehouse',
        color: 'var(--app-error)',
    },
    {
        key: 'BRANCH', label: 'Branch Total', icon: Building2,
        desc: 'Users see total stock across all warehouses in their branch',
        color: 'var(--app-warning)',
    },
    {
        key: 'COUNTRY', label: 'Country Total', icon: Globe,
        desc: 'Users see total stock for all branches in their country',
        color: 'var(--app-info)',
    },
    {
        key: 'ORGANIZATION', label: 'Organization Wide', icon: Network,
        desc: 'Users see total stock across the entire organization (all countries, all branches)',
        color: 'var(--app-success)',
    },
]

const MULTI_BRANCH_OPTIONS = [
    { key: 'STRICT', label: 'Strict — 1 warehouse per branch', desc: 'Each warehouse belongs to exactly one branch. No sharing.' },
    { key: 'SHARED', label: 'Shared — 1 warehouse serves multiple branches', desc: 'A warehouse can be linked to 2+ branches. Stock is shared and visible to all linked branches.' },
    { key: 'POOLED', label: 'Pooled — Combined inventory view', desc: 'Multiple branches pool their warehouse stock into a unified view. Useful for regional distribution.' },
]

// ═══════════════════════════════════════════════════════════════
// V3 Naming Formula — Static Slots
// ═══════════════════════════════════════════════════════════════

const STATIC_SLOTS: NamingFormulaSlot[] = [
    { id: 'brand', label: 'Brand', enabled: true, type: 'static', useShortLabel: false, useShortName: false },
    { id: 'base_name', label: 'Base Name', enabled: true, type: 'static', useShortLabel: false, useShortName: false },
    { id: 'category', label: 'Category', enabled: false, type: 'static', useShortLabel: false, useShortName: true },
    { id: 'country', label: 'Country', enabled: false, type: 'static', useShortLabel: false, useShortName: true },
    { id: 'emballage', label: 'Emballage', enabled: false, type: 'static', useShortLabel: false, useShortName: true },
]

// Example data for live preview
const PREVIEW_DATA: Record<string, { short: string; full: string }> = {
    brand: { short: 'H&S', full: 'Head & Shoulders' },
    base_name: { short: 'Anti-Dandruff', full: 'Anti-Dandruff Shampoo' },
    category: { short: 'SHP', full: 'Shampoo' },
    country: { short: 'LB', full: 'Lebanon' },
    emballage: { short: '400ml', full: '400 ml' },
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function InventoryPoliciesPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('naming')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Policy states
    const [labelPolicy, setLabelPolicy] = useState<LabelPolicyShape>({})
    const [barcodePolicy, setBarcodePolicy] = useState<BarcodePolicyShape>({})
    const [weightPolicy, setWeightPolicy] = useState<WeightPolicyShape>({})
    const [categoryRules, setCategoryRules] = useState<CategoryRuleShape[]>([])
    const [visibilityPolicy, setVisibilityPolicy] = useState<VisibilityPolicyShape>({
        default_scope: 'BRANCH',
        multi_branch_mode: 'STRICT',
        allow_cross_branch_transfer_view: true,
        show_transit_stock: true,
        show_reserved_stock: true,
        show_available_only: false,
        aggregate_packaging_levels: false,
        hide_zero_stock: false,
        allow_scope_override_per_user: false,
        show_stock_value: false,
    })

    // ── Naming rule state ──
    const [namingFormula, setNamingFormula] = useState<NamingFormulaSlot[]>(STATIC_SLOTS)
    const [namingSeparator, setNamingSeparator] = useState(' ')
    const [attributeTree, setAttributeTree] = useState<AttributeNode[]>([])
    const [namingRuleLoaded, setNamingRuleLoaded] = useState(false)

    // Category rules editing (kept for back-compat with the inline rule editor — see categoryRulesPage for full editor)
    const [, setEditingRule] = useState<CategoryRuleShape | null>(null)

    const loadAllPolicies = useCallback(async () => {
        setLoading(true)
        try {
            const [labelRes, barcodeRes, weightRes, catRes] = await Promise.allSettled([
                getLabelPolicy(),
                getBarcodePolicy(),
                getWeightPolicy(),
                getCategoryRules(),
            ])
            if (labelRes.status === 'fulfilled' && labelRes.value?.success) setLabelPolicy((labelRes.value.data as LabelPolicyShape) || {})
            if (barcodeRes.status === 'fulfilled' && barcodeRes.value?.success) setBarcodePolicy((barcodeRes.value.data as BarcodePolicyShape) || {})
            if (weightRes.status === 'fulfilled' && weightRes.value?.success) setWeightPolicy((weightRes.value.data as WeightPolicyShape) || {})
            if (catRes.status === 'fulfilled' && catRes.value?.success) setCategoryRules((catRes.value.data as CategoryRuleShape[]) || [])
        } catch { /* silent */ }
        setLoading(false)
    }, [])

    // ── Load naming rule + attribute tree ──
    const loadNamingData = useCallback(async () => {
        try {
            const [rule, tree] = await Promise.all([
                getProductNamingRule(),
                getAttributeTree(),
            ])
            const attrArr: AttributeNode[] = Array.isArray(tree)
                ? (tree as AttributeNode[])
                : (tree && typeof tree === 'object' && 'results' in tree && Array.isArray((tree as { results?: unknown[] }).results))
                    ? ((tree as { results: AttributeNode[] }).results)
                    : []
            setAttributeTree(attrArr)

            // Build formula from saved V3 or default
            const ruleObj = rule as { v3_formula?: NamingFormulaSlot[]; separator?: string } | null | undefined
            if (ruleObj?.v3_formula && ruleObj.v3_formula.length > 0) {
                setNamingFormula(ruleObj.v3_formula)
            } else {
                // Build initial formula: static slots + attribute groups from tree
                const attrSlots: NamingFormulaSlot[] = attrArr
                    .filter((g) => !g.parent)
                    .map((g) => ({
                        id: `attr_${g.id}`,
                        label: g.name,
                        enabled: g.show_in_name ?? false,
                        type: 'attribute' as const,
                        useShortLabel: !!g.short_label,
                        useShortName: false,
                    }))
                setNamingFormula([...STATIC_SLOTS, ...attrSlots])
            }
            setNamingSeparator(ruleObj?.separator || ' ')
            setNamingRuleLoaded(true)
        } catch (e) {
            console.error('Failed to load naming data', e)
            setNamingFormula(STATIC_SLOTS)
            setNamingRuleLoaded(true)
        }
    }, [])

    useEffect(() => { loadAllPolicies() }, [loadAllPolicies])
    useEffect(() => { loadNamingData() }, [loadNamingData])

    // ═══════════════════════════════════════════════════════════════
    // Save handler
    // ═══════════════════════════════════════════════════════════════

    async function handleSave() {
        setSaving(true)
        try {
            if (activeTab === 'naming') {
                const payload = {
                    components: namingFormula
                        .filter(s => s.type === 'static')
                        .map(s => ({ id: s.id, label: s.label, enabled: s.enabled, useShortName: s.useShortName })),
                    separator: namingSeparator,
                    v3_formula: namingFormula,
                }
                // The action's `ProductNamingRule` type doesn't model `v3_formula` yet — the backend
                // accepts it as a passthrough field. Cast at the boundary rather than widen the action.
                const res = await saveProductNamingRule(payload as unknown as Parameters<typeof saveProductNamingRule>[0])
                if (res.success) toast.success('Naming formula saved!')
                else toast.error(res.message || 'Failed to save')
            } else if (activeTab === 'label') {
                const res = await updateLabelPolicy({ id: labelPolicy.id ?? 'current', ...labelPolicy })
                if (res.success) toast.success('Label policy saved')
                else toast.error(res.error || 'Failed')
            } else if (activeTab === 'barcode') {
                const res = await updateBarcodePolicy({ id: barcodePolicy.id ?? 'current', ...barcodePolicy })
                if (res.success) toast.success('Barcode policy saved')
                else toast.error(res.error || 'Failed')
            } else if (activeTab === 'weight') {
                const res = await updateWeightPolicy({ id: weightPolicy.id ?? 'current', ...weightPolicy })
                if (res.success) toast.success('Weight policy saved')
                else toast.error(res.error || 'Failed')
            } else if (activeTab === 'visibility') {
                toast.success('Visibility policy saved (local only — backend coming soon)')
            }
        } catch { toast.error('Save failed') }
        setSaving(false)
    }

    // ═══════════════════════════════════════════════════════════════
    // Shared UI Helpers
    // ═══════════════════════════════════════════════════════════════

    function Toggle({ checked, onChange, label }: { checked: boolean, onChange: (v: boolean) => void, label: string }) {
        return (
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                    background: checked ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'var(--app-bg)',
                    border: `1.5px solid ${checked ? 'var(--app-primary)' : 'var(--app-border)'}`,
                }}>
                <div className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ background: checked ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-muted-foreground) 25%, transparent)' }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-app-surface shadow transition-all"
                        style={{ left: checked ? '22px' : '2px' }} />
                </div>
                <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
                <span className="text-xs font-bold text-app-foreground">{label}</span>
            </label>
        )
    }

    function Section({ title, icon: Icon, children }: { title: string, icon: IconComponent, children: ReactNode }) {
        return (
            <div className="rounded-2xl p-6" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h3 className="uppercase tracking-[0.15em] text-app-muted-foreground mb-5 flex items-center gap-2">
                    <Icon size={13} /> {title}
                </h3>
                {children}
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // NAMING TAB — V3 Formula Builder
    // ═══════════════════════════════════════════════════════════════

    function moveSlot(index: number, direction: 'up' | 'down') {
        const target = direction === 'up' ? index - 1 : index + 1
        if (target < 0 || target >= namingFormula.length) return
        const next = [...namingFormula]
            ;[next[index], next[target]] = [next[target], next[index]]
        setNamingFormula(next)
    }

    function toggleSlot(index: number, field: keyof NamingFormulaSlot) {
        const next = [...namingFormula]
        next[index] = { ...next[index], [field]: !next[index][field] }
        setNamingFormula(next)
    }

    function removeSlot(index: number) {
        setNamingFormula(prev => prev.filter((_, i) => i !== index))
    }

    // Attribute groups not yet in the formula
    const availableAttrGroups = useMemo(() => {
        const usedIds = new Set(namingFormula.filter(s => s.type === 'attribute').map(s => s.id))
        return attributeTree
            .filter((g) => !g.parent && !usedIds.has(`attr_${g.id}`))
    }, [attributeTree, namingFormula])

    function addAttrSlot(group: AttributeNode) {
        setNamingFormula(prev => [
            ...prev,
            {
                id: `attr_${group.id}`,
                label: group.name,
                enabled: true,
                type: 'attribute' as const,
                useShortLabel: !!group.short_label,
                useShortName: false,
            },
        ])
    }

    // Live preview
    const previewName = useMemo(() => {
        const parts: string[] = []
        for (const slot of namingFormula) {
            if (!slot.enabled) continue
            if (slot.type === 'static') {
                const data = PREVIEW_DATA[slot.id]
                if (data) parts.push(slot.useShortName ? data.short : data.full)
            } else {
                // Attribute: use label as the example value
                const attrId = slot.id.replace('attr_', '')
                const group = attributeTree.find((g) => String(g.id) === attrId)
                if (group) {
                    const firstChild = group.children?.[0]
                    const val = firstChild?.name || group.name
                    if (slot.useShortLabel && group.short_label) {
                        parts.push(`${val}${group.short_label}`)
                    } else {
                        parts.push(val)
                    }
                } else {
                    parts.push(slot.label)
                }
            }
        }
        return parts.join(namingSeparator || ' ')
    }, [namingFormula, namingSeparator, attributeTree])

    const enabledCount = namingFormula.filter(s => s.enabled).length

    function renderNaming() {
        if (!namingRuleLoaded) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                </div>
            )
        }

        return (
            <div className="space-y-5">
                {/* ── Live Preview ── */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-warning) 8%, var(--app-surface)), color-mix(in srgb, var(--app-error) 5%, var(--app-surface)))' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--app-warning), var(--app-error))' }}>
                                <Sparkles size={14} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-app-muted-foreground">Live Preview</p>
                            </div>
                        </div>
                        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest mb-1.5">Generated Product Name</p>
                            <p className="text-xl font-black text-app-foreground tracking-tight leading-snug">
                                {previewName || <span className="text-app-muted-foreground italic text-base">Enable components below...</span>}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-[9px] font-bold text-app-muted-foreground">{enabledCount} component{enabledCount !== 1 ? 's' : ''} active</span>
                            <span className="text-[9px] font-bold text-app-muted-foreground">•</span>
                            <span className="text-[9px] font-bold text-app-muted-foreground">Separator: &ldquo;{namingSeparator || '(none)'}&rdquo;</span>
                        </div>
                    </div>
                </div>

                {/* ── Formula Builder ── */}
                <Section title="Name Formula — Drag to Reorder" icon={Type}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Define which components appear in auto-generated product names and their order.
                        Enable/disable, reorder, and choose short vs full format for each.
                    </p>

                    <div className="space-y-2">
                        {namingFormula.map((slot, index) => {
                            const isStatic = slot.type === 'static'
                            const attrId = slot.id.replace('attr_', '')
                            const attrGroup = !isStatic ? attributeTree.find((g) => String(g.id) === attrId) : null
                            const childCount = attrGroup?.children?.length || 0

                            return (
                                <div key={slot.id}
                                    className="flex items-center gap-2 p-3 rounded-xl transition-all group"
                                    style={{
                                        background: slot.enabled
                                            ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                                            : 'var(--app-bg)',
                                        border: `1.5px solid ${slot.enabled ? 'color-mix(in srgb, var(--app-primary) 25%, var(--app-border))' : 'var(--app-border)'}`,
                                        opacity: slot.enabled ? 1 : 0.55,
                                    }}>

                                    {/* Position & Reorder */}
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button onClick={() => moveSlot(index, 'up')} disabled={index === 0}
                                            className="p-0.5 rounded hover:bg-app-border/30 disabled:opacity-20 transition-colors">
                                            <ArrowUp size={12} className="text-app-muted-foreground" />
                                        </button>
                                        <button onClick={() => moveSlot(index, 'down')} disabled={index === namingFormula.length - 1}
                                            className="p-0.5 rounded hover:bg-app-border/30 disabled:opacity-20 transition-colors">
                                            <ArrowDown size={12} className="text-app-muted-foreground" />
                                        </button>
                                    </div>

                                    {/* Position badge */}
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                                        style={{
                                            background: slot.enabled
                                                ? 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #000))'
                                                : 'var(--app-border)',
                                            color: slot.enabled ? 'white' : 'var(--app-muted-foreground)',
                                        }}>
                                        {index + 1}
                                    </div>

                                    {/* Icon */}
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{
                                            background: isStatic
                                                ? 'color-mix(in srgb, var(--app-info) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                                        }}>
                                        {isStatic
                                            ? <Type size={14} style={{ color: 'var(--app-info)' }} />
                                            : <Tags size={14} style={{ color: 'var(--app-warning)' }} />
                                        }
                                    </div>

                                    {/* Label & metadata */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-app-foreground truncate">{slot.label}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isStatic ? 'var(--app-info)' : 'var(--app-warning)' }}>
                                                {isStatic ? 'Static' : 'Attribute'}
                                            </span>
                                            {!isStatic && childCount > 0 && (
                                                <span className="text-[9px] text-app-muted-foreground">{childCount} value{childCount !== 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Short name toggle (for static) */}
                                    {isStatic && slot.id !== 'base_name' && (
                                        <button onClick={() => toggleSlot(index, 'useShortName')}
                                            disabled={!slot.enabled}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                                            style={{
                                                background: slot.useShortName
                                                    ? 'color-mix(in srgb, var(--app-info) 15%, transparent)'
                                                    : 'var(--app-bg)',
                                                color: slot.useShortName ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                                                border: `1px solid ${slot.useShortName ? 'var(--app-info)' : 'var(--app-border)'}`,
                                            }}>
                                            {slot.useShortName ? 'Short' : 'Full'}
                                        </button>
                                    )}

                                    {/* Short label toggle (for attributes) */}
                                    {!isStatic && attrGroup?.short_label && (
                                        <button onClick={() => toggleSlot(index, 'useShortLabel')}
                                            disabled={!slot.enabled}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                                            style={{
                                                background: slot.useShortLabel
                                                    ? 'color-mix(in srgb, var(--app-warning) 15%, transparent)'
                                                    : 'var(--app-bg)',
                                                color: slot.useShortLabel ? 'var(--app-warning)' : 'var(--app-muted-foreground)',
                                                border: `1px solid ${slot.useShortLabel ? 'var(--app-warning)' : 'var(--app-border)'}`,
                                            }}>
                                            {slot.useShortLabel ? `+${attrGroup.short_label}` : 'No suffix'}
                                        </button>
                                    )}

                                    {/* Enable/Disable */}
                                    <button onClick={() => toggleSlot(index, 'enabled')}
                                        className="p-1.5 rounded-lg transition-all hover:scale-110"
                                        title={slot.enabled ? 'Disable' : 'Enable'}>
                                        {slot.enabled
                                            ? <Eye size={16} style={{ color: 'var(--app-primary)' }} />
                                            : <EyeOff size={16} className="text-app-muted-foreground" />
                                        }
                                    </button>

                                    {/* Remove (attributes only) */}
                                    {!isStatic && (
                                        <button onClick={() => removeSlot(index)}
                                            className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove from formula">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Add attribute groups */}
                    {availableAttrGroups.length > 0 && (
                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mb-2">
                                + Add Attribute Groups to Formula
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {availableAttrGroups.map((group) => (
                                    <button key={group.id}
                                        onClick={() => addAttrSlot(group)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)',
                                            border: '1px dashed color-mix(in srgb, var(--app-warning) 40%, transparent)',
                                            color: 'var(--app-warning)',
                                        }}>
                                        <Plus size={12} />
                                        {group.name}
                                        {(group.children?.length ?? 0) > 0 && (
                                            <span className="text-[9px] opacity-60">({group.children?.length})</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </Section>

                {/* ── Separator ── */}
                <Section title="Separator Character" icon={Settings}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { val: ' ', label: 'Space', display: '⎵' },
                            { val: ' - ', label: 'Dash', display: '—' },
                            { val: ' | ', label: 'Pipe', display: '|' },
                            { val: ' · ', label: 'Dot', display: '·' },
                        ].map(opt => (
                            <button key={opt.val}
                                onClick={() => setNamingSeparator(opt.val)}
                                className="px-4 py-3 rounded-xl text-center transition-all hover:scale-[1.02]"
                                style={{
                                    background: namingSeparator === opt.val
                                        ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                        : 'var(--app-bg)',
                                    border: `1.5px solid ${namingSeparator === opt.val ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    boxShadow: namingSeparator === opt.val ? '0 2px 8px color-mix(in srgb, var(--app-primary) 15%, transparent)' : 'none',
                                }}>
                                <div className="text-lg font-black text-app-foreground mb-0.5">{opt.display}</div>
                                <div className="text-[10px] font-bold text-app-muted-foreground">{opt.label}</div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                        <label className="text-[10px] font-bold text-app-muted-foreground shrink-0">Custom:</label>
                        <input
                            type="text"
                            value={namingSeparator}
                            onChange={e => setNamingSeparator(e.target.value)}
                            className="w-24 px-3 py-2 rounded-lg text-sm text-center outline-none"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                            placeholder="Separator"
                        />
                    </div>
                </Section>

                {/* ── How It Works ── */}
                <Section title="How Auto-Naming Works" icon={Wand2}>
                    <div className="space-y-3 text-xs text-app-muted-foreground leading-relaxed">
                        <p>
                            When you create a product, the system auto-generates its <strong className="text-app-foreground">display name</strong> using the formula above.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center mb-2" style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)' }}>
                                    <Type size={13} style={{ color: 'var(--app-info)' }} />
                                </div>
                                <p className="text-[10px] font-bold text-app-foreground mb-1">Static Components</p>
                                <p className="text-[10px] text-app-muted-foreground">Fixed identity fields like Brand, Base Name, Category, Country.</p>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center mb-2" style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)' }}>
                                    <Tags size={13} style={{ color: 'var(--app-warning)' }} />
                                </div>
                                <p className="text-[10px] font-bold text-app-foreground mb-1">Attribute Components</p>
                                <p className="text-[10px] text-app-muted-foreground">Dynamic values from your attribute tree — Size, Color, Scent, etc.</p>
                            </div>
                            <div className="p-3 rounded-xl" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center mb-2" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                                    <Sparkles size={13} style={{ color: 'var(--app-primary)' }} />
                                </div>
                                <p className="text-[10px] font-bold text-app-foreground mb-1">Auto-Generated</p>
                                <p className="text-[10px] text-app-muted-foreground">The name updates in real-time as you fill in the product form.</p>
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // Tab Content Renderers (unchanged from original)
    // ═══════════════════════════════════════════════════════════════

    function renderVisibility() {
        return (
            <div className="space-y-5">
                <Section title="Default Visibility Scope" icon={Eye}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Choose the default level at which users see aggregated stock quantities.
                        This can be overridden per user role if enabled below.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {VISIBILITY_SCOPES.map(scope => {
                            const isActive = visibilityPolicy.default_scope === scope.key
                            return (
                                <button key={scope.key}
                                    onClick={() => setVisibilityPolicy({ ...visibilityPolicy, default_scope: scope.key })}
                                    className="relative p-5 rounded-2xl text-left transition-all hover:scale-[1.02] group"
                                    style={{
                                        background: isActive
                                            ? `color-mix(in srgb, ${scope.color} 8%, transparent)`
                                            : 'var(--app-bg)',
                                        border: `2px solid ${isActive ? scope.color : 'var(--app-border)'}`,
                                        boxShadow: isActive ? `0 4px 20px color-mix(in srgb, ${scope.color} 15%, transparent)` : 'none',
                                    }}>
                                    {isActive && (
                                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                                            style={{ background: scope.color }}>
                                            <Check size={11} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                        style={{ background: `color-mix(in srgb, ${scope.color} 15%, transparent)` }}>
                                        <scope.icon size={20} style={{ color: scope.color }} />
                                    </div>
                                    <div className="text-sm font-black text-app-foreground mb-1">{scope.label}</div>
                                    <p className="text-[10px] text-app-muted-foreground leading-relaxed">{scope.desc}</p>
                                </button>
                            )
                        })}
                    </div>
                </Section>

                <Section title="Multi-Branch Warehouse Sharing" icon={GitBranch}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Define how warehouses relate to branches. Choose &ldquo;Shared&rdquo; if a single warehouse serves multiple branches.
                    </p>
                    <div className="space-y-2">
                        {MULTI_BRANCH_OPTIONS.map(opt => {
                            const isActive = visibilityPolicy.multi_branch_mode === opt.key
                            return (
                                <button key={opt.key}
                                    onClick={() => setVisibilityPolicy({ ...visibilityPolicy, multi_branch_mode: opt.key })}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                                    style={{
                                        background: isActive ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'var(--app-bg)',
                                        border: `1.5px solid ${isActive ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                    }}>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                        style={{
                                            border: `2px solid ${isActive ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                            background: isActive ? 'var(--app-primary)' : 'transparent',
                                        }}>
                                        {isActive && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-app-foreground">{opt.label}</div>
                                        <p className="text-[10px] text-app-muted-foreground mt-0.5">{opt.desc}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </Section>

                <Section title="Display & Access Rules" icon={Settings}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Toggle checked={!!visibilityPolicy.show_transit_stock} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, show_transit_stock: v })} label="Show in-transit stock" />
                        <Toggle checked={!!visibilityPolicy.show_reserved_stock} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, show_reserved_stock: v })} label="Show reserved stock" />
                        <Toggle checked={!!visibilityPolicy.show_available_only} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, show_available_only: v })} label="Show available qty only" />
                        <Toggle checked={!!visibilityPolicy.hide_zero_stock} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, hide_zero_stock: v })} label="Hide zero-stock items" />
                        <Toggle checked={!!visibilityPolicy.aggregate_packaging_levels} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, aggregate_packaging_levels: v })} label="Aggregate across packaging levels" />
                        <Toggle checked={!!visibilityPolicy.allow_cross_branch_transfer_view} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, allow_cross_branch_transfer_view: v })} label="Allow cross-branch transfer view" />
                        <Toggle checked={!!visibilityPolicy.allow_scope_override_per_user} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, allow_scope_override_per_user: v })} label="Allow per-user scope override" />
                        <Toggle checked={!!visibilityPolicy.show_stock_value} onChange={v => setVisibilityPolicy({ ...visibilityPolicy, show_stock_value: v })} label="Show stock monetary value" />
                    </div>
                </Section>
            </div>
        )
    }

    function renderLabel() {
        return (
            <div className="space-y-5">
                <Section title="Print Settings" icon={Printer}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Default Output Method</label>
                            <select value={labelPolicy?.default_output_method || ''} onChange={e => setLabelPolicy({ ...labelPolicy, default_output_method: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="PDF">PDF Export</option>
                                <option value="THERMAL">Direct to Thermal Printer</option>
                                <option value="BROWSER">Browser Print Dialog</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Default Copies</label>
                            <input type="number" min="1" value={labelPolicy?.default_copies || 1}
                                onChange={e => setLabelPolicy({ ...labelPolicy, default_copies: parseInt(e.target.value) || 1 })}
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>
                </Section>
                <Section title="Automation Rules" icon={Settings}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { key: 'auto_print_on_receive', label: 'Auto-print on goods receipt' },
                            { key: 'auto_print_on_price_change', label: 'Auto-print on price change' },
                            { key: 'auto_print_on_create', label: 'Auto-print on product create' },
                            { key: 'require_approval', label: 'Require approval before print' },
                            { key: 'track_label_history', label: 'Track label print history' },
                            { key: 'enforce_template', label: 'Enforce template per category' },
                        ].map(f => (
                            <Toggle key={f.key} checked={!!labelPolicy?.[f.key]}
                                onChange={v => setLabelPolicy({ ...labelPolicy, [f.key]: v })} label={f.label} />
                        ))}
                    </div>
                </Section>
            </div>
        )
    }

    function renderBarcode() {
        return (
            <div className="space-y-5">
                <Section title="Generation Settings" icon={Settings}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Default Generation Mode</label>
                            <select value={barcodePolicy?.default_mode || ''} onChange={e => setBarcodePolicy({ ...barcodePolicy, default_mode: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="">Select...</option>
                                <option value="INTERNAL_AUTO">Internal Auto-generate (EAN-13)</option>
                                <option value="SUPPLIER">Require Supplier Barcode</option>
                                <option value="MANUAL">Manual Entry</option>
                                <option value="MIXED">Mixed (per-category override)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Internal Prefix</label>
                            <input type="text" value={barcodePolicy?.internal_prefix || ''}
                                onChange={e => setBarcodePolicy({ ...barcodePolicy, internal_prefix: e.target.value })}
                                placeholder="e.g. 200"
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>
                </Section>
                <Section title="Validation Rules" icon={Shield}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { key: 'require_unique', label: 'Require unique barcodes' },
                            { key: 'allow_duplicates_across_packaging', label: 'Allow duplicates across packaging' },
                            { key: 'validate_checksum', label: 'Validate EAN checksum' },
                            { key: 'auto_assign_on_create', label: 'Auto-assign on product create' },
                            { key: 'allow_manual_override', label: 'Allow manual override' },
                            { key: 'require_barcode_for_sale', label: 'Require barcode for sales' },
                        ].map(f => (
                            <Toggle key={f.key} checked={!!barcodePolicy?.[f.key]}
                                onChange={v => setBarcodePolicy({ ...barcodePolicy, [f.key]: v })} label={f.label} />
                        ))}
                    </div>
                </Section>
            </div>
        )
    }

    function renderWeight() {
        return (
            <div className="space-y-5">
                <Section title="Weigh Scale Integration" icon={Settings}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Default Weight Unit</label>
                            <select value={weightPolicy?.default_weight_unit || 'KG'} onChange={e => setWeightPolicy({ ...weightPolicy, default_weight_unit: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="KG">Kilograms (KG)</option>
                                <option value="G">Grams (G)</option>
                                <option value="LB">Pounds (LB)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5">Tolerance %</label>
                            <input type="number" step="0.1" value={weightPolicy?.weight_tolerance_pct || ''}
                                onChange={e => setWeightPolicy({ ...weightPolicy, weight_tolerance_pct: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g. 2.0"
                                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>
                </Section>
                <Section title="Rules" icon={AlertTriangle}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { key: 'require_tare_weight', label: 'Require tare weight' },
                            { key: 'enforce_min_weight', label: 'Enforce minimum weight' },
                            { key: 'enforce_max_weight', label: 'Enforce maximum weight' },
                            { key: 'auto_calculate_price', label: 'Auto-calculate price by weight' },
                            { key: 'barcode_includes_weight', label: 'Embed weight in barcode' },
                            { key: 'require_scale_verification', label: 'Require scale verification' },
                        ].map(f => (
                            <Toggle key={f.key} checked={!!weightPolicy?.[f.key]}
                                onChange={v => setWeightPolicy({ ...weightPolicy, [f.key]: v })} label={f.label} />
                        ))}
                    </div>
                </Section>
            </div>
        )
    }

    function renderCategoryRules() {
        return (
            <div className="space-y-5">
                <Section title="Category-Specific Rule Overrides" icon={FolderCog}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Override barcode, labeling, and weight policies on a per-category basis.
                    </p>
                    {categoryRules.length === 0 ? (
                        <div className="text-center py-12 text-app-muted-foreground">
                            <FolderCog size={32} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold mb-1">No category rules yet</p>
                            <p className="text-xs">Create rules to override policies for specific product categories</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {categoryRules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                                    <div>
                                        <span className="text-sm font-bold text-app-foreground">{rule.category_name || `Category #${rule.category}`}</span>
                                        <div className="flex gap-3 mt-1 text-[10px] text-app-muted-foreground">
                                            {rule.barcode_mode && <span>Barcode: {rule.barcode_mode}</span>}
                                            {rule.label_template && <span>Template: {rule.label_template}</span>}
                                            {rule.require_weight && <span>⚖️ Weight required</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditingRule(rule)}
                                            className="p-2 rounded-lg hover:bg-app-hover transition-colors">
                                            <Pencil size={13} className="text-app-muted-foreground" />
                                        </button>
                                        <button onClick={async () => {
                                            const res = await deleteCategoryRule(rule.id)
                                            if (res.success) { toast.success('Rule deleted'); loadAllPolicies() }
                                            else toast.error(res.error || 'Failed')
                                        }} className="p-2 rounded-lg hover:bg-app-hover transition-colors">
                                            <Trash2 size={13} className="text-app-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════
    // Tab Map & Render
    // ═══════════════════════════════════════════════════════════════

    const tabContent: Record<TabKey, () => ReactNode> = {
        naming: renderNaming,
        visibility: renderVisibility,
        label: renderLabel,
        barcode: renderBarcode,
        weight: renderWeight,
        category: renderCategoryRules,
    }

    const activeTabMeta = POLICY_TABS.find(t => t.key === activeTab)!

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            {/* ── Header ── */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: activeTabMeta.gradient, boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-app-muted-foreground">Inventory Governance</p>
                        <h1>
                            Policies <span style={{ color: 'var(--app-primary)' }}>&amp; Rules</span>
                        </h1>
                    </div>
                </div>
                {activeTab !== 'category' && (
                    <button onClick={handleSave} disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg disabled:opacity-50 hover:scale-105"
                        style={{ background: activeTabMeta.gradient }}>
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Save {activeTabMeta.label}
                    </button>
                )}
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                {POLICY_TABS.map(tab => {
                    const isActive = activeTab === tab.key
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
                            style={{
                                background: isActive ? activeTabMeta.gradient : 'var(--app-surface)',
                                color: isActive ? 'white' : 'var(--app-muted-foreground)',
                                border: isActive ? 'none' : '1px solid var(--app-border)',
                                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                            }}>
                            <tab.icon size={14} />
                            {tab.label}
                            {!isActive && <span className="text-[9px] opacity-60 hidden sm:inline">{tab.desc}</span>}
                        </button>
                    )
                })}
            </div>

            {/* ── Tab Content ── */}
            <div className="animate-in fade-in duration-200">
                {tabContent[activeTab]()}
            </div>
        </div>
    )
}
