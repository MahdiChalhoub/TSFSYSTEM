'use client'

/* ═══════════════════════════════════════════════════════════
 *  Product Detail (/inventory/products/[id])
 *  -----------------------------------------------------------
 *  Single coherent page (no theme/view switcher):
 *    • Sticky identity rail on the left — hero, status pills,
 *      KPIs, primary actions, linked entities, section TOC.
 *    • Main column: Analytics dashboard up top (action bar,
 *      health meters, alerts, stock split, business metrics),
 *      then the full workspace sections below (Pulse, Pricing,
 *      Inventory, Packaging, Groups, Activity) — one continuous
 *      scroll. The rail's TOC anchors into those sections.
 *    • One accent color per section, used in the section header
 *      AND in the rail's TOC dot so the eye matches them up.
 *    • Mobile: rail collapses to a sticky header; TOC becomes a
 *      horizontal pill scroller.
 *    • No emojis. No raw hex. tp-* font tokens throughout.
 *    • All linked entities open as new app tabs via
 *      AdminContext.openTab — never window.open / target=_blank.
 * ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, useContext, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'
import {
    ArrowLeft, Edit3, Trash2, Package, TrendingUp, Activity,
    Layers, Tag, CheckCircle2, AlertTriangle, RefreshCw, Link2Off,
    DollarSign, Box, Shield, ChevronRight, Loader2,
    Archive, Clock, User as UserIcon, Warehouse, Star, Ruler,
    History, ExternalLink, Copy, Check, Truck, Zap,
    Calendar, ShoppingCart,
} from 'lucide-react'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'
import { toast } from 'sonner'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AdminContext } from '@/context/AdminContext'

/* ─── Section catalog ────────────────────────────────
 *  Single source of truth — drives both the rail's TOC
 *  dots and the section headers in the main column.
 *  Adding a section means one entry here + one renderer
 *  in the main column.
 */
type SectionId = 'pulse' | 'pricing' | 'inventory' | 'packaging' | 'groups' | 'activity'

const SECTIONS: { id: SectionId; label: string; icon: typeof Activity; accent: string; hint: string }[] = [
    { id: 'pulse',     label: 'Pulse',     icon: Zap,        accent: 'var(--app-primary)',           hint: 'Live signals at a glance' },
    { id: 'pricing',   label: 'Pricing',   icon: DollarSign, accent: 'var(--app-success)',           hint: 'Selling, cost, margin, VAT' },
    { id: 'inventory', label: 'Inventory', icon: Warehouse,  accent: 'var(--app-info, #3b82f6)',     hint: 'Stock levels and reorder math' },
    { id: 'packaging', label: 'Packaging', icon: Package,    accent: 'var(--app-warning, #f59e0b)',  hint: 'Per-product packaging chain' },
    { id: 'groups',    label: 'Groups',    icon: Layers,     accent: 'var(--app-accent)',            hint: 'Pricing and inventory groupings' },
    { id: 'activity',  label: 'Activity',  icon: History,    accent: 'var(--app-muted-foreground)',  hint: 'Audit history and edits' },
]

const SYNC_BADGES: Record<string, { label: string; icon: typeof CheckCircle2 | null; color: string }> = {
    SYNCED:         { label: 'Synced',         icon: CheckCircle2,  color: 'var(--app-success)' },
    BROKEN:         { label: 'Broken Group',   icon: AlertTriangle, color: 'var(--app-error)' },
    LOCAL_OVERRIDE: { label: 'Local Override', icon: Link2Off,      color: 'var(--app-warning)' },
    PENDING:        { label: 'Pending Sync',   icon: RefreshCw,     color: 'var(--app-info)' },
    'N/A':          { label: 'No Group',       icon: null,          color: 'var(--app-muted-foreground)' },
}
const ROLE_BADGES: Record<string, { label: string; color: string }> = {
    PRIMARY:    { label: 'Primary',    color: 'var(--app-info)' },
    TWIN:       { label: 'Twin',       color: 'var(--app-success)' },
    SUBSTITUTE: { label: 'Substitute', color: 'var(--app-warning)' },
    NOT_SUB:    { label: 'No Sub',     color: 'var(--app-muted-foreground)' },
}

function fmt(v: unknown): string {
    if (v == null) return '—'
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtQty(v: unknown): string {
    if (v == null) return '—'
    return Number(v).toLocaleString()
}
function fmtDate(ts?: string): string {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function timeAgo(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime()
    if (Number.isNaN(ms)) return ts
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString()
}

function useOpenInTab() {
    const ctx = useContext(AdminContext)
    return (title: string, path: string) => {
        if (ctx?.openTab) ctx.openTab(title, path)
        else window.location.assign(path)
    }
}

/* ═══════════════════════════════════════════════════════════
 *  PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function ProductsDetailPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const openInTab = useOpenInTab()

    const [item, setItem] = useState<Record<string, unknown> | null>(null)
    const [loading, setLoading] = useState(true)
    const [invMemberships, setInvMemberships] = useState<Record<string, unknown>[]>([])
    const [showDelete, setShowDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [activeSection, setActiveSection] = useState<SectionId>('pulse')
    const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
        pulse: null, pricing: null, inventory: null, packaging: null, groups: null, activity: null,
    })
    // Information-architecture variant — same data, different layout.
    //   workspace  — sticky rail + main scroll (TOC, KPIs, hero, sections)
    //   executive  — dense ERP-style: header + KPI strip + 6-card grid
    //   premium    — minimal/airy: hero banner + single-column flow of cards
    //   analytics  — operational cockpit: charts row + health + sections
    //   minimal    — tabbed workspace: header + tab nav + active tab content
    type ViewMode = 'workspace' | 'executive' | 'premium' | 'analytics' | 'minimal'
    const [viewMode, setViewMode] = useState<ViewMode>('workspace')
    // Per-warehouse stock breakdown — loaded once and used in the dashboard.
    const [stockByWarehouse, setStockByWarehouse] = useState<Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>>([])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const data = await erpFetch(`products/${id}/`)
            setItem(data)
            // Lookups in parallel — none block the page render once the
            // hero data has landed. Each catches independently so a single
            // 404 doesn't take the whole panel down.
            const [memberships, stock] = await Promise.all([
                erpFetch(`inventory/inventory-group-members/?product=${id}`).catch(() => []),
                erpFetch(`inventory/?product=${id}`).catch(() => []),
            ])
            setInvMemberships(Array.isArray(memberships) ? memberships : (memberships?.results || []))
            const stockRows = Array.isArray(stock) ? stock : (stock?.results || [])
            setStockByWarehouse(stockRows.map((r: any) => ({
                warehouse: Number(r.warehouse),
                warehouse_name: r.warehouse_name || r.warehouse_repr,
                quantity: Number(r.quantity ?? r.on_hand_qty ?? 0),
                reserved_quantity: Number(r.reserved_quantity ?? 0),
            })))
        } catch (error) {
            console.error('Failed to load product:', error)
        } finally {
            setLoading(false)
        }
    }, [id])
    useEffect(() => { loadData() }, [loadData])

    /* IntersectionObserver — drives the rail's "active section" dot
       so the operator always knows where in the narrative they are. */
    useEffect(() => {
        if (loading || !item) return
        const obs = new IntersectionObserver(
            (entries) => {
                // Pick the entry closest to the viewport top among all
                // currently-visible sections.
                const visible = entries.filter(e => e.isIntersecting)
                if (visible.length === 0) return
                const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
                const sec = (top.target as HTMLElement).dataset.section as SectionId | undefined
                if (sec) setActiveSection(sec)
            },
            { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
        )
        for (const id of Object.keys(sectionRefs.current) as SectionId[]) {
            const el = sectionRefs.current[id]
            if (el) obs.observe(el)
        }
        return () => obs.disconnect()
    }, [loading, item])

    const handleConfirmDelete = async () => {
        setDeleting(true)
        try {
            await erpFetch(`products/${id}/`, { method: 'DELETE' })
            toast.success('Product deleted')
            router.push('/inventory/products')
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete product')
            setDeleting(false)
            setShowDelete(false)
        }
    }
    const handleTogglePricingSource = async () => {
        if (!item) return
        const newSource = item.pricing_source === 'GROUP' ? 'LOCAL' : 'GROUP'
        try {
            await erpFetch(`products/${id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pricing_source: newSource,
                    group_sync_status: newSource === 'LOCAL' ? 'LOCAL_OVERRIDE' : 'PENDING',
                }),
            })
            toast.success(newSource === 'LOCAL' ? 'Switched to local pricing' : 'Now following group price')
            loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to update pricing source')
        }
    }
    const scrollToSection = (id: SectionId) => {
        const el = sectionRefs.current[id]
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                </div>
                <p className="text-tp-md font-bold text-app-foreground">Loading workspace…</p>
            </div>
        )
    }
    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                <AlertTriangle size={26} style={{ color: 'var(--app-error)' }} />
                <p className="text-tp-md font-bold text-app-foreground">Product not found</p>
                <button onClick={() => router.back()}
                    className="text-tp-xs font-bold hover:underline" style={{ color: 'var(--app-primary)' }}>
                    Go back
                </button>
            </div>
        )
    }

    const it = item as Record<string, any>
    const syncBadge = SYNC_BADGES[it.group_sync_status as string] || SYNC_BADGES['N/A']
    const hasGroup = it.product_group || it.product_group_name
    const isActive = it.is_active !== false

    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const stockHealth: 'OK' | 'LOW' | 'OUT' =
        onHand === 0 ? 'OUT' : (minStock > 0 && onHand <= minStock ? 'LOW' : 'OK')
    const stockColor = stockHealth === 'OK' ? 'var(--app-success)' : stockHealth === 'LOW' ? 'var(--app-warning)' : 'var(--app-error)'
    const stockLabel = stockHealth === 'OK' ? 'In stock' : stockHealth === 'LOW' ? 'Low stock' : 'Out of stock'
    const margin = it.selling_price_ht && it.cost_price && Number(it.cost_price) > 0
        ? ((Number(it.selling_price_ht) - Number(it.cost_price)) / Number(it.cost_price) * 100)
        : null

    // Shared per-layout props for the four self-contained variants —
    // each lays out the same data with its own chrome, no shared rail.
    const sharedViewProps = {
        it,
        invMemberships,
        stockByWarehouse,
        margin,
        stockColor,
        stockHealth,
        stockLabel,
        onBack:   () => router.push('/inventory/products'),
        onEdit:   () => router.push(`/inventory/products/${id}/edit`),
        onDelete: () => setShowDelete(true),
        onTogglePricingSource: handleTogglePricingSource,
        productId: Number(id),
    }

    return (
        <div className="h-full overflow-hidden flex flex-col"
             style={{ background: 'var(--app-bg)' }}>
            {/* ═══ Layout switcher — sits above the per-layout chrome so
                 it survives across the very different shapes each layout
                 renders below. ═══ */}
            <PhilosophyGallery active={viewMode} onPick={setViewMode} />

            {viewMode === 'executive' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <ExecutiveView {...sharedViewProps} />
                </div>
            )}
            {viewMode === 'premium' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <PremiumView {...sharedViewProps} />
                </div>
            )}
            {viewMode === 'analytics' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <AnalyticsCockpitView {...sharedViewProps} />
                </div>
            )}
            {viewMode === 'minimal' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <MinimalView {...sharedViewProps} />
                </div>
            )}

            {viewMode === 'workspace' && (
            <>
            {/* ═══ Mobile sticky header (rail collapsed) ═══ */}
            <div className="lg:hidden flex-shrink-0 sticky top-0 z-30 px-3 py-2"
                 style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2">
                    <Link href="/inventory/products" className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border">
                        <ArrowLeft size={14} className="text-app-muted-foreground" />
                    </Link>
                    <div className="flex-shrink-0 page-header-icon"
                         style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)', width: 36, height: 36 }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={32} className="rounded-lg" color="white" iconSize={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">{it.sku || `#${it.id}`}</p>
                        <h1 className="text-tp-md truncate">{it.name || `Product #${it.id}`}</h1>
                    </div>
                    <button onClick={() => router.push(`/inventory/products/${id}/edit`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-app-border">
                        <Edit3 size={14} className="text-app-muted-foreground" />
                    </button>
                </div>
                {/* Pill TOC scroller */}
                <div className="mt-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar -mx-1 px-1">
                    {SECTIONS.map(s => {
                        const Icon = s.icon
                        const active = activeSection === s.id
                        return (
                            <button key={s.id} onClick={() => scrollToSection(s.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all"
                                style={{
                                    background: active ? `color-mix(in srgb, ${s.accent} 14%, transparent)` : 'transparent',
                                    color: active ? s.accent : 'var(--app-muted-foreground)',
                                    border: `1px solid ${active ? `color-mix(in srgb, ${s.accent} 35%, transparent)` : 'var(--app-border)'}`,
                                }}>
                                <Icon size={11} />
                                <span className="text-tp-xxs font-bold">{s.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ═══ Two-column workspace ═══ */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* ─── Sticky identity rail (desktop only) ─── */}
                <aside className="hidden lg:flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar"
                       style={{ width: 320, borderRight: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <div className="p-5 space-y-4">
                        {/* Back */}
                        <Link href="/inventory/products"
                            className="inline-flex items-center gap-1.5 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground">
                            <ArrowLeft size={12} /> All products
                        </Link>

                        {/* Hero */}
                        <div className="space-y-2">
                            <div className="page-header-icon"
                                 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px color-mix(in srgb, var(--app-primary) 30%, transparent)', width: 64, height: 64 }}>
                                <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={56} className="rounded-2xl" color="white" iconSize={28} />
                            </div>
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                                Product
                            </p>
                            <h1>
                                {it.name || `Product #${it.id}`}
                            </h1>
                            <div className="flex items-center gap-1.5">
                                <CopyChip value={String(it.sku || `#${it.id}`)} />
                                {it.barcode && <CopyChip value={String(it.barcode)} mono />}
                            </div>
                        </div>

                        {/* Status pills */}
                        <div className="flex items-center gap-1 flex-wrap">
                            <Pill label={isActive ? 'Active' : 'Inactive'} color={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                            <Pill label={stockLabel} color={stockColor} />
                            {hasGroup && syncBadge.icon && (
                                <Pill label={syncBadge.label} color={syncBadge.color} icon={<syncBadge.icon size={9} />} />
                            )}
                        </div>

                        {/* Vertical KPIs */}
                        <div className="space-y-1.5">
                            <RailKpi label="Selling TTC" value={fmt(it.selling_price_ttc)} color="var(--app-success)" icon={<DollarSign size={12} />} />
                            <RailKpi label="Cost"        value={fmt(it.cost_price)}        color="var(--app-info)"    icon={<TrendingUp size={12} />} />
                            {margin !== null && (
                                <RailKpi label="Margin" value={`${margin.toFixed(1)}%`} color="var(--app-primary)" icon={<Activity size={12} />} />
                            )}
                            <RailKpi label="On hand"     value={fmtQty(it.on_hand_qty)}    color={stockColor}         icon={<Box size={12} />} />
                            <RailKpi label="Available"   value={fmtQty(it.available_qty)}  color="var(--app-primary)" icon={<Archive size={12} />} />
                            <RailKpi label="Reserved"    value={fmtQty(it.reserved_qty)}   color="var(--app-accent)"  icon={<Shield size={12} />} />
                        </div>

                        {/* Layout picker — five information-architecture
                            variants of the same data. The picker only renders
                            in 'workspace' mode (the rail itself is part of
                            that layout); other modes drive switching from
                            the sticky gallery at the top of the page. */}
                        <div>
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Layout</p>
                            <div className="space-y-0.5">
                                {([
                                    { id: 'workspace', label: 'Workspace', accent: 'var(--app-primary)',          hint: 'Sticky rail + sections' },
                                    { id: 'executive', label: 'Executive', accent: 'var(--app-info, #3b82f6)',    hint: 'Dense ERP · 6-card grid' },
                                    { id: 'premium',   label: 'Premium',   accent: 'var(--app-success)',          hint: 'Hero + flowing cards' },
                                    { id: 'analytics', label: 'Analytics', accent: 'var(--app-accent)',           hint: 'Charts cockpit' },
                                    { id: 'minimal',   label: 'Minimal',   accent: 'var(--app-warning, #f59e0b)', hint: 'Tabbed workspace' },
                                ] as { id: ViewMode; label: string; accent: string; hint: string }[]).map(v => {
                                    const active = viewMode === v.id
                                    return (
                                        <button key={v.id} onClick={() => setViewMode(v.id)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                                            style={{
                                                background: active ? `color-mix(in srgb, ${v.accent} 12%, transparent)` : 'transparent',
                                                color: active ? v.accent : 'var(--app-muted-foreground)',
                                                border: `1px solid ${active ? `color-mix(in srgb, ${v.accent} 32%, transparent)` : 'transparent'}`,
                                            }}
                                            title={v.hint}>
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.accent }} />
                                            <span className="text-tp-sm font-bold flex-1 truncate">{v.label}</span>
                                            {active && <Check size={11} className="flex-shrink-0" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Primary actions */}
                        <div className="space-y-1.5 pt-1">
                            <Link href={`/inventory/products/${id}/edit`}
                                className="flex items-center justify-center gap-1.5 w-full text-tp-sm font-bold py-2 rounded-xl transition-all hover:brightness-110"
                                style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <Edit3 size={13} /> Edit product
                            </Link>
                            <button onClick={() => setShowDelete(true)}
                                className="flex items-center justify-center gap-1.5 w-full text-tp-xs font-bold py-2 rounded-xl border transition-all"
                                style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>

                        {/* Relation chain */}
                        <div className="pt-2">
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Linked entities</p>
                            <div className="space-y-1">
                                {it.brand_name && (
                                    <RailLink icon={<Star size={11} />} label="Brand" value={String(it.brand_name)} accent="var(--app-warning, #f59e0b)"
                                        onClick={it.brand ? () => openInTab(String(it.brand_name), `/inventory/brands/${it.brand}`) : undefined} />
                                )}
                                {it.category_name && (
                                    <RailLink icon={<Tag size={11} />} label="Category" value={String(it.category_name)} accent="var(--app-info, #3b82f6)"
                                        onClick={it.category ? () => openInTab(String(it.category_name), `/inventory/categories?category=${it.category}`) : undefined} />
                                )}
                                {(it.unit_name || it.unit_code) && (
                                    <RailLink icon={<Ruler size={11} />} label="Unit" value={String(it.unit_name || it.unit_code)} accent="var(--app-primary)"
                                        onClick={it.unit ? () => openInTab(String(it.unit_name || it.unit_code), `/inventory/units?unit=${it.unit}`) : undefined} />
                                )}
                                {hasGroup && (
                                    <RailLink icon={<Layers size={11} />} label="Pricing group" value={String(it.product_group_name || `Group #${it.product_group}`)} accent="var(--app-accent)"
                                        onClick={it.product_group ? () => openInTab(String(it.product_group_name || `Group #${it.product_group}`), `/inventory/product-groups/${it.product_group}`) : undefined} />
                                )}
                            </div>
                        </div>

                        {/* TOC — section anchors for the page below. */}
                        <div className="pt-2">
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Sections</p>
                            <nav className="space-y-0.5">
                                {SECTIONS.map(s => {
                                    const Icon = s.icon
                                    const active = activeSection === s.id
                                    return (
                                        <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                                            style={{
                                                background: active ? `color-mix(in srgb, ${s.accent} 8%, transparent)` : 'transparent',
                                                color: active ? s.accent : 'var(--app-muted-foreground)',
                                            }}>
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                  style={{ background: active ? s.accent : 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }} />
                                            <Icon size={12} />
                                            <span className="text-tp-sm font-bold">{s.label}</span>
                                        </button>
                                    )
                                })}
                            </nav>
                        </div>

                        {/* Audit summary */}
                        {(it.updated_at || it.created_at) && (
                            <div className="pt-3 border-t border-app-border/50 space-y-0.5 text-tp-xxs text-app-muted-foreground">
                                {it.updated_at && <p className="flex items-center gap-1.5"><RefreshCw size={9} /> Updated {timeAgo(String(it.updated_at))}</p>}
                                {it.created_at && <p className="flex items-center gap-1.5"><Clock size={9} /> Created {fmtDate(String(it.created_at))}</p>}
                                {it.created_by_name && <p className="flex items-center gap-1.5"><UserIcon size={9} /> by {String(it.created_by_name)}</p>}
                                <p className="font-mono opacity-50 pt-0.5">id {String(it.id)}</p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* ─── Main column ─── */}
                <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
                    {/* Analytics dashboard — at-a-glance answers up top:
                        action bar, three health meters, alerts, stock split,
                        business metrics, best supplier. */}
                    <AnalyticsView
                        it={it}
                        stockByWarehouse={stockByWarehouse}
                        margin={margin}
                        stockColor={stockColor}
                        onScrollToSections={() => scrollToSection('pulse')}
                    />

                    {/* Workspace sections — full drill-down below the
                        dashboard. Operators who need details keep scrolling;
                        the rail's section nav anchors here. */}
                    <div className="px-4 md:px-10 py-6 md:py-10 max-w-3xl mx-auto space-y-12">

                        {/* PULSE */}
                        <Section refSet={el => { sectionRefs.current.pulse = el }} id="pulse">
                            <SectionHeader def={SECTIONS[0]} />
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <PulseCell label="On hand"      value={fmtQty(it.on_hand_qty)}    color={stockColor} hint={stockLabel} />
                                <PulseCell label="Available"    value={fmtQty(it.available_qty)}  color="var(--app-primary)" hint="On hand minus reserved" />
                                <PulseCell label="Reserved"     value={fmtQty(it.reserved_qty)}   color="var(--app-accent)"  hint="Allocated to open orders" />
                                <PulseCell label="Reorder"      value={fmtQty(it.reorder_point)}  color="var(--app-warning)" hint="Stock floor before alert" />
                            </div>
                            {it.description && (
                                <div className="rounded-2xl px-4 py-3"
                                     style={{ background: 'color-mix(in srgb, var(--app-foreground) 3%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                    <p className="text-tp-sm text-app-foreground leading-relaxed whitespace-pre-line">{String(it.description)}</p>
                                </div>
                            )}
                        </Section>

                        {/* PRICING */}
                        <Section refSet={el => { sectionRefs.current.pricing = el }} id="pricing">
                            <SectionHeader def={SECTIONS[1]}
                                rightSlot={hasGroup && (
                                    <button onClick={handleTogglePricingSource}
                                        className="text-tp-xxs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all hover:brightness-110"
                                        style={{
                                            background: it.pricing_source === 'GROUP'
                                                ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)'
                                                : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                            color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                                        }}>
                                        {it.pricing_source === 'GROUP' ? 'Override locally' : 'Follow group'}
                                    </button>
                                )} />
                            <div className="space-y-1">
                                <PriceLadderRow label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="var(--app-success)" />
                                <PriceLadderRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                                <PriceLadderRow label="Cost"        value={fmt(it.cost_price)} color="var(--app-info)" />
                                <PriceLadderRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                                {margin !== null && (
                                    <PriceLadderRow label="Margin" value={`${margin.toFixed(1)}%`} highlight color="var(--app-primary)" />
                                )}
                            </div>
                            {hasGroup && it.group_expected_price && (
                                <div className="rounded-xl px-3 py-2 text-tp-xs flex items-center gap-2"
                                     style={{
                                         background: Number(it.selling_price_ttc) !== Number(it.group_expected_price)
                                             ? 'color-mix(in srgb, var(--app-error) 6%, transparent)'
                                             : 'color-mix(in srgb, var(--app-success) 6%, transparent)',
                                         color: Number(it.selling_price_ttc) !== Number(it.group_expected_price) ? 'var(--app-error)' : 'var(--app-success)',
                                     }}>
                                    <AlertTriangle size={12} />
                                    Group expects {fmt(it.group_expected_price)} · this product sells at {fmt(it.selling_price_ttc)}
                                </div>
                            )}
                        </Section>

                        {/* INVENTORY */}
                        <Section refSet={el => { sectionRefs.current.inventory = el }} id="inventory">
                            <SectionHeader def={SECTIONS[2]} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <InvCell label="On hand"          value={fmtQty(it.on_hand_qty)} color={stockColor} />
                                <InvCell label="Reserved"         value={fmtQty(it.reserved_qty)} color="var(--app-accent)" />
                                <InvCell label="Available"        value={fmtQty(it.available_qty)} color="var(--app-primary)" />
                                <InvCell label="Min stock"        value={fmtQty(it.min_stock_level)} color="var(--app-muted-foreground)" />
                                <InvCell label="Max stock"        value={fmtQty(it.max_stock_level)} color="var(--app-muted-foreground)" />
                                <InvCell label="Reorder point"    value={fmtQty(it.reorder_point)} color="var(--app-warning)" />
                            </div>
                            {/* Stock health bar */}
                            {Number(it.max_stock_level) > 0 && (
                                <div>
                                    <div className="flex items-center justify-between text-tp-xxs font-bold text-app-muted-foreground mb-1">
                                        <span>0</span>
                                        <span>min {fmtQty(it.min_stock_level)} · reorder {fmtQty(it.reorder_point)} · max {fmtQty(it.max_stock_level)}</span>
                                    </div>
                                    <StockHealthBar
                                        onHand={onHand}
                                        min={Number(it.min_stock_level)}
                                        reorder={Number(it.reorder_point)}
                                        max={Number(it.max_stock_level)}
                                        color={stockColor}
                                    />
                                </div>
                            )}
                        </Section>

                        {/* PACKAGING */}
                        <Section refSet={el => { sectionRefs.current.packaging = el }} id="packaging">
                            <SectionHeader def={SECTIONS[3]} />
                            <div className="rounded-2xl overflow-hidden"
                                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="p-4">
                                    <ProductPackagingTab
                                        productId={id}
                                        productName={String(it.name || '')}
                                        basePriceTTC={Number(it.selling_price_ttc) || undefined}
                                        basePriceHT={Number(it.selling_price_ht) || undefined}
                                        productUnitId={it.unit as number}
                                    />
                                </div>
                            </div>
                        </Section>

                        {/* GROUPS */}
                        <Section refSet={el => { sectionRefs.current.groups = el }} id="groups">
                            <SectionHeader def={SECTIONS[4]} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Pricing group */}
                                <div className="rounded-2xl p-4 space-y-2"
                                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-1.5 text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                                        <Tag size={10} /> Pricing group
                                    </div>
                                    {hasGroup ? (
                                        <>
                                            <button type="button"
                                                onClick={() => it.product_group && openInTab(String(it.product_group_name || `Group #${it.product_group}`), `/inventory/product-groups/${it.product_group}`)}
                                                className="flex items-center gap-2 text-left w-full">
                                                <span className="text-tp-md font-black text-app-foreground truncate">{String(it.product_group_name || `Group #${it.product_group}`)}</span>
                                                <ExternalLink size={11} className="text-app-muted-foreground" />
                                            </button>
                                            <div className="flex items-center gap-2 flex-wrap text-tp-xs">
                                                <span className="text-app-muted-foreground">{it.pricing_source === 'GROUP' ? 'Following group' : 'Local override'}</span>
                                                <Pill label={syncBadge.label} color={syncBadge.color} icon={syncBadge.icon ? <syncBadge.icon size={9} /> : undefined} />
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-tp-sm text-app-muted-foreground">Not in a pricing group.</p>
                                    )}
                                </div>
                                {/* Inventory groups */}
                                <div className="rounded-2xl p-4 space-y-2"
                                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-1.5 text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                                        <Layers size={10} /> Inventory groups
                                        {invMemberships.length > 0 && (
                                            <span className="ml-auto text-tp-xxs font-bold rounded px-1.5 py-0.5"
                                                  style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)' }}>
                                                {invMemberships.length}
                                            </span>
                                        )}
                                    </div>
                                    {invMemberships.length > 0 ? (
                                        <div className="space-y-1">
                                            {invMemberships.map(m => {
                                                const mm = m as Record<string, any>
                                                const role = ROLE_BADGES[mm.substitution_role as string] || ROLE_BADGES.NOT_SUB
                                                return (
                                                    <button key={mm.id as number} type="button"
                                                        onClick={() => mm.group && openInTab(String(mm.group_name || `Group #${mm.group}`), `/inventory/inventory-groups/${mm.group}`)}
                                                        className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg hover:bg-app-bg/50 transition-colors">
                                                        <span className="text-tp-sm font-bold text-app-foreground truncate flex-1">{String(mm.group_name || `Group #${mm.group}`)}</span>
                                                        <span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                            style={{ background: `color-mix(in srgb, ${role.color} 10%, transparent)`, color: role.color }}>
                                                            {role.label}
                                                        </span>
                                                        <ExternalLink size={10} className="text-app-muted-foreground" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-tp-sm text-app-muted-foreground">Not in any inventory group.</p>
                                    )}
                                </div>
                            </div>
                        </Section>

                        {/* ACTIVITY */}
                        <Section refSet={el => { sectionRefs.current.activity = el }} id="activity">
                            <SectionHeader def={SECTIONS[5]} />
                            <ProductAuditTimeline productId={Number(id)} />
                        </Section>

                        <div className="h-32" />
                    </div>
                </main>
            </div>
            </>
            )}

            <ConfirmDialog
                open={showDelete}
                onOpenChange={(o) => { if (!o && !deleting) setShowDelete(false) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${String(it.name || `#${it.id}`)}"?`}
                description="This permanently removes the product and its packaging records. Past orders that referenced it keep their snapshot of the SKU; live stock and pricing rules tied to this row are dropped."
                confirmText={deleting ? 'Deleting…' : 'Delete'}
                variant="danger"
            />
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  ATOMS
 * ═════════════════════════════════════════════════════════════ */

function Section({ id, refSet, children }: { id: SectionId; refSet: (el: HTMLElement | null) => void; children: React.ReactNode }) {
    return (
        <section ref={refSet} data-section={id} id={`s-${id}`} className="space-y-3 scroll-mt-6">
            {children}
        </section>
    )
}

function SectionHeader({ def, rightSlot }: { def: typeof SECTIONS[number]; rightSlot?: React.ReactNode }) {
    const Icon = def.icon
    return (
        <header className="flex items-end gap-3 pb-1.5"
                style={{ borderBottom: `1px solid color-mix(in srgb, ${def.accent} 25%, transparent)` }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${def.accent} 14%, transparent)`, color: def.accent }}>
                <Icon size={15} />
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="text-tp-lg">{def.label}</h2>
                <p className="text-tp-xxs font-bold uppercase tracking-widest mt-1" style={{ color: def.accent }}>{def.hint}</p>
            </div>
            {rightSlot}
        </header>
    )
}

function Pill({ label, color, icon }: { label: string; color: string; icon?: React.ReactNode }) {
    return (
        <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1"
              style={{
                  background: `color-mix(in srgb, ${color} 10%, transparent)`,
                  color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
              }}>
            {icon} {label}
        </span>
    )
}

function CopyChip({ value, mono }: { value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false)
    return (
        <button type="button"
            onClick={() => {
                navigator.clipboard?.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
            }}
            title="Click to copy"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-tp-xxs ${mono ? 'font-mono' : ''} font-bold transition-all hover:bg-app-bg`}
            style={{ background: 'color-mix(in srgb, var(--app-foreground) 5%, transparent)', color: 'var(--app-muted-foreground)' }}>
            {copied ? <Check size={9} /> : <Copy size={9} />}
            <span className="truncate max-w-[180px]">{value}</span>
        </button>
    )
}

function RailKpi({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground">{label}</div>
                <div className="text-tp-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{value}</div>
            </div>
        </div>
    )
}

function RailLink({ icon, label, value, accent, onClick }: { icon: React.ReactNode; label: string; value: string; accent: string; onClick?: () => void }) {
    const Element = onClick ? 'button' : 'div'
    return (
        <Element type={onClick ? 'button' : undefined} onClick={onClick}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${onClick ? 'hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all' : ''}`}
            style={{
                background: `color-mix(in srgb, ${accent} 6%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
            }}
            title={`${label}: ${value}`}>
            <span style={{ color: accent }} className="flex-shrink-0">{icon}</span>
            <span className="flex flex-col leading-tight min-w-0">
                <span className="text-tp-xxs font-bold uppercase tracking-widest opacity-60" style={{ color: accent }}>{label}</span>
                <span className="text-tp-xs font-bold text-app-foreground truncate">{value}</span>
            </span>
            {onClick && <ExternalLink size={9} className="ml-auto opacity-50" style={{ color: accent }} />}
        </Element>
    )
}

function PulseCell({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
    return (
        <div className="rounded-2xl p-3"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="text-tp-xxs font-black uppercase tracking-widest" style={{ color }}>{label}</div>
            <div className="text-2xl font-black tabular-nums tracking-tight mt-1" style={{ color: 'var(--app-foreground)' }}>{value}</div>
            {hint && <div className="text-tp-xxs text-app-muted-foreground mt-0.5">{hint}</div>}
        </div>
    )
}

function PriceLadderRow({ label, value, color, highlight, muted }: { label: string; value: string; color?: string; highlight?: boolean; muted?: boolean }) {
    return (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
             style={{
                 background: highlight ? `color-mix(in srgb, ${color || 'var(--app-success)'} 6%, transparent)` : 'transparent',
                 border: highlight ? `1px solid color-mix(in srgb, ${color || 'var(--app-success)'} 20%, transparent)` : '1px solid transparent',
             }}>
            <span className={`text-tp-sm font-bold ${muted ? 'text-app-muted-foreground' : 'text-app-foreground'}`}>{label}</span>
            <span className={`tabular-nums ${highlight ? 'text-tp-lg font-black' : 'text-tp-md font-bold'}`}
                  style={{ color: color || 'var(--app-foreground)' }}>{value}</span>
        </div>
    )
}

function InvCell({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <span className="text-tp-xs font-bold text-app-muted-foreground">{label}</span>
            <span className="text-tp-md font-black tabular-nums" style={{ color }}>{value}</span>
        </div>
    )
}

function StockHealthBar({ onHand, min, reorder, max, color }: { onHand: number; min: number; reorder: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (onHand / max) * 100)) : 0
    const minPct = max > 0 ? Math.min(100, (min / max) * 100) : 0
    const reorderPct = max > 0 ? Math.min(100, (reorder / max) * 100) : 0
    return (
        <div className="relative h-2 rounded-full overflow-hidden"
             style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' }}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                 style={{ width: `${pct}%`, background: color }} />
            {minPct > 0 && (
                <div className="absolute inset-y-0 w-px" style={{ left: `${minPct}%`, background: 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }} />
            )}
            {reorderPct > 0 && (
                <div className="absolute inset-y-0 w-px" style={{ left: `${reorderPct}%`, background: 'var(--app-warning)' }} />
            )}
        </div>
    )
}


/* ─── Audit timeline ─── */
type AuditFC = { field_name: string; old_value: string | null; new_value: string | null }
type AuditEntry = { id: number; action: string; timestamp: string; username?: string; field_changes?: AuditFC[] }
function actionTone(action: string) {
    const tail = (action.split('.').pop() || '').toLowerCase()
    if (tail === 'create') return { bg: 'color-mix(in srgb, var(--app-success) 12%, transparent)', fg: 'var(--app-success)' }
    if (tail === 'delete') return { bg: 'color-mix(in srgb, var(--app-error) 12%, transparent)', fg: 'var(--app-error)' }
    return { bg: 'color-mix(in srgb, var(--app-info) 12%, transparent)', fg: 'var(--app-info)' }
}
function ProductAuditTimeline({ productId }: { productId: number }) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        let cancelled = false
        setLoading(true); setError(null)
        erpFetch(`inventory/audit-trail/?resource_type=product&resource_id=${productId}&limit=120`)
            .then((data: unknown) => {
                if (cancelled) return
                const list = Array.isArray(data) ? data : ((data as { results?: AuditEntry[] })?.results ?? [])
                setEntries(list as AuditEntry[])
            })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load history') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [productId])
    if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <div className="text-tp-sm text-app-muted-foreground py-4 text-center">Audit log isn&apos;t available on this deployment.</div>
    if (entries.length === 0) return (
        <div className="text-center py-10">
            <History size={20} className="text-app-muted-foreground/40 mx-auto mb-2" />
            <p className="text-tp-sm font-bold text-app-muted-foreground">No history yet</p>
        </div>
    )
    return (
        <div className="relative">
            {/* Vertical spine */}
            <div className="absolute top-0 bottom-0 left-3 w-px" style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
            <div className="space-y-3">
                {entries.map(e => {
                    const tone = actionTone(e.action)
                    const tail = (e.action.split('.').pop() || '').toLowerCase()
                    return (
                        <div key={e.id} className="relative pl-8">
                            <span className="absolute left-2 top-2 w-2 h-2 rounded-full"
                                  style={{ background: tone.fg, boxShadow: `0 0 0 3px color-mix(in srgb, ${tone.fg} 18%, var(--app-bg))` }} />
                            <div className="rounded-xl p-2.5 space-y-1.5"
                                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                          style={{ background: tone.bg, color: tone.fg }}>
                                        {tail || e.action}
                                    </span>
                                    <span className="flex items-center gap-1 text-tp-xxs text-app-muted-foreground">
                                        <UserIcon size={10} /><span className="truncate max-w-[120px]">{e.username || 'system'}</span>
                                    </span>
                                    <span className="text-tp-xxs text-app-muted-foreground" title={e.timestamp}>{timeAgo(e.timestamp)}</span>
                                </div>
                                {e.field_changes && e.field_changes.length > 0 && (
                                    <div className="space-y-0.5">
                                        {e.field_changes.map((fc, i) => (
                                            <div key={i} className="text-tp-xs flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono font-bold text-app-foreground">{fc.field_name}</span>
                                                <span className="font-mono px-1 rounded text-app-muted-foreground"
                                                      style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', textDecoration: 'line-through' }}>
                                                    {fc.old_value ?? '∅'}
                                                </span>
                                                <ChevronRight size={9} className="opacity-50" />
                                                <span className="font-mono px-1 rounded text-app-foreground"
                                                      style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)' }}>
                                                    {fc.new_value ?? '∅'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  ANALYTICS VIEW — the simple-first dashboard
 *  ----------------------------------------------------------------
 *  Quick-scan layout: action bar · meters · alerts · stock split ·
 *  business metrics · best supplier. Goal: "in 5 seconds, do I know
 *  enough to act?". Sections below this dashboard hold the deeper
 *  drill-down — the rail's TOC anchors there.
 *
 *  Empty states for missing endpoints (sales velocity, supplier
 *  history) render as honest "shows up here once …" so the layout
 *  reads as the right shape from day one.
 * ═════════════════════════════════════════════════════════════ */
function AnalyticsView({
    it, stockByWarehouse, margin, stockColor, onScrollToSections,
}: {
    it: Record<string, any>
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    onScrollToSections: () => void
}) {
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const reorder = Number(it.reorder_point || 0)
    // Three "health meter" percentages — Financial / Adjustment / Margin
    // mirror the analytic dashboard the user prefers as the entry point.
    //   Financial:  on-hand vs reorder point (above reorder = healthy)
    //   Adjustment: on-hand vs max stock (room to grow)
    //   Margin:     selling-vs-cost margin clamped to [0,100]
    const financialPct = reorder > 0
        ? Math.min(100, Math.round((onHand / Math.max(reorder, 1)) * 100))
        : 100
    const maxStock = Number(it.max_stock_level || 0)
    const adjustmentPct = maxStock > 0
        ? Math.min(100, Math.round((onHand / maxStock) * 100))
        : 100
    const marginPct = margin != null ? Math.max(0, Math.min(100, Math.round(margin))) : 0

    const totalSold = Number(it.total_sold ?? it.units_sold ?? 0)
    const totalPurchases = Number(it.total_purchases ?? it.purchases_count ?? 0)
    const totalProfit = Number(it.total_profit ?? 0)

    const alerts: { icon: typeof ShoppingCart; label: string; color: string }[] = []
    if (onHand <= 0) alerts.push({ icon: AlertTriangle, label: 'Out of stock', color: 'var(--app-error)' })
    else if (minStock > 0 && onHand <= minStock) alerts.push({ icon: AlertTriangle, label: `Low stock — ${onHand} units (min ${minStock})`, color: 'var(--app-warning)' })
    if (it.is_active === false) alerts.push({ icon: AlertTriangle, label: 'Product inactive', color: 'var(--app-muted-foreground)' })
    if (it.group_sync_status === 'BROKEN') alerts.push({ icon: AlertTriangle, label: 'Group price diverged', color: 'var(--app-error)' })
    if (reorder > 0 && onHand <= reorder) alerts.push({ icon: ShoppingCart, label: `At/below reorder point — purchase ${Math.max(reorder - onHand, 1)} units`, color: 'var(--app-warning)' })

    return (
        <div className="px-4 md:px-8 py-5 md:py-8 max-w-5xl mx-auto space-y-5">
            {/* ── Quick action bar ── */}
            <div className="flex items-center gap-1.5 flex-wrap">
                <ActionButton color="var(--app-success)"           icon={<ShoppingCart size={13} />} label="Purchase"      onClick={() => toast.info('Purchase flow not wired yet')} />
                <ActionButton color="var(--app-info, #3b82f6)"     icon={<Truck size={13} />}        label="Transfer"      onClick={() => toast.info('Transfer flow not wired yet')} />
                <ActionButton color="var(--app-warning, #f59e0b)"  icon={<Edit3 size={13} />}        label="Adjust stock"  onClick={() => toast.info('Stock adjustment flow not wired yet')} />
                <ActionButton color="var(--app-accent)"            icon={<Calendar size={13} />}     label="Expiry alert"  onClick={() => toast.info('Expiry alert flow not wired yet')} />
                <span className="ml-auto text-tp-xxs text-app-muted-foreground">
                    Need details?{' '}
                    <button onClick={onScrollToSections} className="font-bold underline" style={{ color: 'var(--app-primary)' }}>
                        Jump to sections
                    </button>
                </span>
            </div>

            {/* ── Three health meters ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Meter label="Financial"  value={financialPct}  accent="var(--app-accent)"          icon={<Activity size={14} />}     hint="On-hand vs reorder point" />
                <Meter label="Adjustment" value={adjustmentPct} accent="var(--app-info, #3b82f6)"   icon={<Activity size={14} />}     hint="On-hand vs max stock" />
                <Meter label="Margin"     value={marginPct}     accent="var(--app-success)"         icon={<TrendingUp size={14} />}   hint={margin != null ? `${margin.toFixed(1)}% over cost` : 'Set cost to compute'} />
            </div>

            {/* ── Alerts banner ── */}
            {alerts.length > 0 && (
                <div className="rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap"
                     style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 22%, transparent)' }}>
                    <span className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-warning, #f59e0b)' }}>Alerts</span>
                    {alerts.map((a, i) => {
                        const Icon = a.icon
                        return (
                            <span key={i} className="flex items-center gap-1 text-tp-xs font-bold" style={{ color: a.color }}>
                                <Icon size={11} /> {a.label}
                            </span>
                        )
                    })}
                </div>
            )}

            {/* ── Stock split + Business metrics ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Stock levels */}
                <div className="rounded-2xl p-4 space-y-3"
                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2">
                        <Box size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <h3 className="text-tp-md font-black text-app-foreground">Stock levels</h3>
                        <span className="ml-auto text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{ background: `color-mix(in srgb, ${stockColor} 12%, transparent)`, color: stockColor }}>
                            {onHand <= 0 ? 'Out of stock' : (minStock > 0 && onHand <= minStock) ? 'Low stock' : 'In stock'}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <BigStat label="Total stock"  value={fmtQty(onHand)}             hint="All locations"   color="var(--app-info, #3b82f6)" />
                        <BigStat label="Available"    value={fmtQty(it.available_qty)}   hint="Free to allocate" color="var(--app-primary)" />
                        <BigStat label="Reserved"     value={fmtQty(it.reserved_qty)}    hint="On open orders"  color="var(--app-accent)" />
                    </div>
                    {/* Per-warehouse breakdown */}
                    {stockByWarehouse.length > 0 ? (
                        <div className="space-y-1 pt-2 border-t border-app-border/40">
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">By warehouse</p>
                            {stockByWarehouse.slice(0, 8).map(s => (
                                <div key={s.warehouse} className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-app-bg/40">
                                    <span className="text-tp-sm font-bold text-app-foreground truncate flex-1">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                    <span className="text-tp-md font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</span>
                                </div>
                            ))}
                            {stockByWarehouse.length > 8 && (
                                <p className="text-tp-xxs text-app-muted-foreground text-center">+{stockByWarehouse.length - 8} more locations</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-tp-xxs text-app-muted-foreground pt-2 border-t border-app-border/40">
                            Per-warehouse breakdown shows up here once stock is allocated to a location.
                        </p>
                    )}
                </div>

                {/* Business metrics */}
                <div className="rounded-2xl p-4 space-y-3"
                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2">
                        <Activity size={14} style={{ color: 'var(--app-accent)' }} />
                        <h3 className="text-tp-md font-black text-app-foreground">Business metrics</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <BigStat label="Total sold"      value={fmtQty(totalSold)}      hint="Lifetime units"           color="var(--app-success)" />
                        <BigStat label="Purchases"       value={fmtQty(totalPurchases)} hint="Distinct POs"             color="var(--app-warning, #f59e0b)" />
                        <BigStat label="Total profit"    value={fmt(totalProfit)}       hint={margin != null ? `${margin.toFixed(1)}% margin` : '—'} color="var(--app-accent)" />
                    </div>
                    <p className="text-tp-xxs text-app-muted-foreground pt-2 border-t border-app-border/40">
                        Sales velocity charts and time-series breakdowns will surface here once the analytics pipeline ships.
                    </p>
                </div>
            </div>

            {/* ── Best supplier (rendered when payload includes it) ── */}
            {(it.best_supplier_name || it.best_supplier) && (
                <div className="rounded-2xl p-4 flex items-center gap-3"
                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                        <Truck size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">Best supplier</p>
                        <p className="text-tp-md font-black text-app-foreground truncate">{String(it.best_supplier_name || `Supplier #${it.best_supplier}`)}</p>
                    </div>
                    {it.best_supplier_price != null && (
                        <div className="text-right">
                            <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">Best price</p>
                            <p className="text-tp-lg font-black tabular-nums" style={{ color: 'var(--app-success)' }}>{fmt(it.best_supplier_price)}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="h-2" />
        </div>
    )
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
    return (
        <button type="button" onClick={onClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-tp-sm font-bold transition-all hover:brightness-110"
            style={{
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                color, border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
            }}>
            {icon} {label}
        </button>
    )
}

function Meter({ label, value, accent, icon, hint }: { label: string; value: number; accent: string; icon: React.ReactNode; hint?: string }) {
    return (
        <div className="rounded-2xl p-3 relative overflow-hidden"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: accent }}>{label}</p>
                    <p className="text-2xl font-black text-app-foreground tabular-nums tracking-tight mt-0.5">{value}%</p>
                    {hint && <p className="text-tp-xxs text-app-muted-foreground mt-0.5">{hint}</p>}
                </div>
                <span style={{ color: accent }} className="opacity-60">{icon}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: accent }} />
            </div>
        </div>
    )
}

function BigStat({ label, value, hint, color }: { label: string; value: string; hint?: string; color: string }) {
    return (
        <div className="rounded-xl p-2.5"
             style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">{label}</p>
            <p className="text-tp-lg font-black tabular-nums tracking-tight" style={{ color }}>{value}</p>
            {hint && <p className="text-tp-xxs text-app-muted-foreground truncate">{hint}</p>}
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  PHILOSOPHY GALLERY — sticky top strip
 *  ----------------------------------------------------------------
 *  Sits above the per-theme chrome. Each thumbnail is painted in
 *  the real palette of its theme so the operator picks by visual
 *  feel, not by reading text.
 * ═════════════════════════════════════════════════════════════ */
type PhilosophyId = 'workspace' | 'executive' | 'premium' | 'analytics' | 'minimal'

function PhilosophyGallery({ active, onPick }: { active: PhilosophyId; onPick: (id: PhilosophyId) => void }) {
    const items: { id: PhilosophyId; label: string; tag: string; accent: string; preview: React.ReactNode }[] = [
        { id: 'workspace', label: 'Workspace', tag: 'Rail · sections',      accent: 'var(--app-primary)',          preview: <PreviewWorkspace /> },
        { id: 'executive', label: 'Executive', tag: 'Dense · 6-card grid',  accent: 'var(--app-info, #3b82f6)',    preview: <PreviewExecutive /> },
        { id: 'premium',   label: 'Premium',   tag: 'Hero · airy flow',     accent: 'var(--app-success)',          preview: <PreviewPremium /> },
        { id: 'analytics', label: 'Analytics', tag: 'Charts · cockpit',     accent: 'var(--app-accent)',           preview: <PreviewAnalytics /> },
        { id: 'minimal',   label: 'Minimal',   tag: 'Tabs · single pane',   accent: 'var(--app-warning, #f59e0b)', preview: <PreviewMinimal /> },
    ]
    return (
        <div className="flex-shrink-0 px-3 md:px-6 py-2.5"
             style={{ background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-2 mb-1.5">
                <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">Visual theme</p>
                <span className="text-tp-xxs text-app-muted-foreground hidden md:inline">— same data, different look-and-feel</span>
            </div>
            <div className="flex items-stretch gap-2 overflow-x-auto custom-scrollbar -mx-1 px-1">
                {items.map(p => {
                    const isActive = active === p.id
                    return (
                        <button key={p.id} type="button" onClick={() => onPick(p.id)}
                            className="flex-shrink-0 rounded-xl p-1.5 text-left transition-all hover:brightness-105 active:scale-[0.98]"
                            style={{
                                width: 168,
                                background: isActive
                                    ? `color-mix(in srgb, ${p.accent} 10%, var(--app-surface))`
                                    : 'var(--app-surface)',
                                border: `1px solid ${isActive
                                    ? `color-mix(in srgb, ${p.accent} 45%, transparent)`
                                    : 'var(--app-border)'}`,
                                boxShadow: isActive ? `0 4px 14px color-mix(in srgb, ${p.accent} 18%, transparent)` : undefined,
                            }}
                            title={`${p.label} — ${p.tag}`}>
                            <div className="rounded-lg overflow-hidden mb-1.5" style={{ height: 56 }}>
                                {p.preview}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-tp-xs font-black truncate"
                                      style={{ color: isActive ? p.accent : 'var(--app-foreground)' }}>
                                    {p.label}
                                </span>
                                {isActive && <Check size={9} style={{ color: p.accent }} />}
                            </div>
                            <p className="text-tp-xxs font-bold text-app-muted-foreground truncate">{p.tag}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ─── Layout thumbnails — show the *shape* of each layout, all
 *   painted in the app's own palette so the operator picks by
 *   information arrangement, not visual style. ─── */
function PreviewWorkspace() {
    // Sticky rail on the left + main scroll on the right
    return (
        <div className="w-full h-full flex gap-0.5 p-1" style={{ background: 'var(--app-bg)' }}>
            <div className="w-3 flex flex-col gap-0.5">
                <div className="h-1 rounded-sm" style={{ background: 'var(--app-primary)' }} />
                <div className="h-1 rounded-sm" style={{ background: 'var(--app-primary)', opacity: 0.4 }} />
                <div className="h-1 rounded-sm" style={{ background: 'var(--app-primary)', opacity: 0.4 }} />
                <div className="h-1 rounded-sm" style={{ background: 'var(--app-primary)', opacity: 0.4 }} />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
                <div className="h-1.5 rounded-sm" style={{ background: 'var(--app-info, #3b82f6)', opacity: 0.5 }} />
                <div className="flex-1 rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
                <div className="h-1.5 rounded-sm" style={{ background: 'var(--app-info, #3b82f6)', opacity: 0.5 }} />
            </div>
        </div>
    )
}
function PreviewExecutive() {
    // Header + KPI strip + 2x3 card grid
    return (
        <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ background: 'var(--app-bg)' }}>
            <div className="h-1.5 rounded-sm" style={{ background: 'var(--app-foreground)', opacity: 0.18 }} />
            <div className="flex gap-0.5">
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'var(--app-success)', opacity: 0.65 }} />
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'var(--app-info, #3b82f6)', opacity: 0.65 }} />
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'var(--app-warning, #f59e0b)', opacity: 0.65 }} />
                <div className="flex-1 h-1.5 rounded-sm" style={{ background: 'var(--app-accent)', opacity: 0.65 }} />
            </div>
            <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-0.5">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
                ))}
            </div>
        </div>
    )
}
function PreviewPremium() {
    // Wide hero banner + single column flow of cards
    return (
        <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ background: 'var(--app-bg)' }}>
            <div className="h-4 rounded-md" style={{ background: 'color-mix(in srgb, var(--app-success) 18%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-success) 35%, transparent)' }} />
            <div className="h-2 rounded-md" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
            <div className="h-2 rounded-md" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
            <div className="h-2 rounded-md" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
        </div>
    )
}
function PreviewAnalytics() {
    // Charts row + health + sections
    return (
        <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ background: 'var(--app-bg)' }}>
            <div className="flex gap-0.5 h-3">
                <div className="flex-1 rounded-sm relative overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <svg viewBox="0 0 20 12" className="w-full h-full" preserveAspectRatio="none">
                        <polyline points="0,9 4,7 8,8 12,4 16,5 20,2" fill="none" stroke="var(--app-success)" strokeWidth="0.6" />
                    </svg>
                </div>
                <div className="flex-1 rounded-sm relative overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <svg viewBox="0 0 20 12" className="w-full h-full" preserveAspectRatio="none">
                        <polyline points="0,3 4,5 8,4 12,7 16,6 20,9" fill="none" stroke="var(--app-info, #3b82f6)" strokeWidth="0.6" />
                    </svg>
                </div>
                <div className="flex-1 rounded-sm relative overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <svg viewBox="0 0 20 12" className="w-full h-full" preserveAspectRatio="none">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <rect key={i} x={i * 3.2 + 0.5} y={12 - (3 + (i % 3) * 2.5)} width={2.4} height={3 + (i % 3) * 2.5} fill="var(--app-warning, #f59e0b)" opacity={0.7} />
                        ))}
                    </svg>
                </div>
            </div>
            <div className="flex gap-0.5">
                <div className="flex-1 h-1 rounded-sm" style={{ background: 'var(--app-success)', opacity: 0.6 }} />
                <div className="flex-1 h-1 rounded-sm" style={{ background: 'var(--app-warning, #f59e0b)', opacity: 0.6 }} />
            </div>
            <div className="flex-1 rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
        </div>
    )
}
function PreviewMinimal() {
    // Header + tab bar + active tab
    return (
        <div className="w-full h-full p-1 flex flex-col gap-0.5" style={{ background: 'var(--app-bg)' }}>
            <div className="h-1.5 rounded-sm" style={{ background: 'var(--app-foreground)', opacity: 0.18 }} />
            <div className="flex gap-0.5 px-0.5">
                <div className="w-3 h-1 rounded-t-sm" style={{ background: 'var(--app-warning, #f59e0b)' }} />
                <div className="w-3 h-1 rounded-t-sm" style={{ background: 'var(--app-foreground)', opacity: 0.18 }} />
                <div className="w-3 h-1 rounded-t-sm" style={{ background: 'var(--app-foreground)', opacity: 0.18 }} />
                <div className="w-3 h-1 rounded-t-sm" style={{ background: 'var(--app-foreground)', opacity: 0.18 }} />
            </div>
            <div className="flex-1 rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderTop: '2px solid var(--app-warning, #f59e0b)' }} />
        </div>
    )
}



/* ═════════════════════════════════════════════════════════════
 *  LAYOUT VARIANTS — shared props
 *  ----------------------------------------------------------------
 *  All four self-contained layouts (executive, premium, analytics,
 *  minimal) take the same data + the same callbacks. They render
 *  the SAME information through fundamentally different shapes —
 *  the picker at the top is a way to A/B compare which arrangement
 *  fits the operator's task best.
 * ═════════════════════════════════════════════════════════════ */
type LayoutViewProps = {
    it: Record<string, any>
    invMemberships: Record<string, unknown>[]
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    stockHealth: 'OK' | 'LOW' | 'OUT'
    stockLabel: string
    onBack: () => void
    onEdit: () => void
    onDelete: () => void
    onTogglePricingSource: () => void
    productId: number
}

/* ─── Shared per-layout chrome bits ─── */
function LayoutTopBar({ title, sku, onBack, onEdit, onDelete, accent = 'var(--app-primary)' }: {
    title: string; sku: string
    onBack: () => void; onEdit: () => void; onDelete: () => void
    accent?: string
}) {
    return (
        <div className="sticky top-0 z-10 px-4 md:px-8 py-3 flex items-center gap-3"
             style={{ background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--app-border)' }}>
            <button onClick={onBack}
                className="flex items-center gap-1.5 text-tp-xs font-bold transition-colors hover:text-app-foreground"
                style={{ color: 'var(--app-muted-foreground)' }}>
                <ArrowLeft size={13} /> Products
            </button>
            <div className="hidden md:block min-w-0 flex-1 px-3">
                <p className="text-tp-xxs font-mono text-app-muted-foreground truncate">{sku}</p>
                <p className="text-tp-sm font-bold text-app-foreground truncate">{title}</p>
            </div>
            <div className="flex-1 md:hidden" />
            <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-tp-xs font-bold transition-all hover:brightness-110"
                style={{ background: accent, color: 'white' }}>
                <Edit3 size={12} /> Edit
            </button>
            <button onClick={onDelete} title="Delete"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:brightness-110"
                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 22%, transparent)' }}>
                <Trash2 size={13} />
            </button>
        </div>
    )
}

function CardHeader({ icon, title, accent, right }: { icon: React.ReactNode; title: string; accent: string; right?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
                {icon}
            </span>
            <h3 className="text-tp-md font-black text-app-foreground">{title}</h3>
            {right && <div className="ml-auto">{right}</div>}
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  EXECUTIVE — data-dense ERP-style dashboard
 *  ----------------------------------------------------------------
 *  The "show everything at once" layout for managers. Top bar with
 *  hero + status, a strip of 5 KPI tiles, then a 2x3 grid of cards:
 *  Pricing · Inventory · Packaging · Compliance · Accounting · Audit.
 *  Heavy reuse of existing atoms — same paint, denser packing.
 * ═════════════════════════════════════════════════════════════ */
function ExecutiveView({
    it, invMemberships, stockByWarehouse, margin, stockColor, stockLabel,
    onBack, onEdit, onDelete, onTogglePricingSource, productId,
}: LayoutViewProps) {
    const onHand = Number(it.on_hand_qty || 0)
    const reorder = Number(it.reorder_point || 0)
    const totalSold = Number(it.total_sold ?? it.units_sold ?? 0)
    const hasGroup = it.product_group || it.product_group_name
    const syncBadge = SYNC_BADGES[it.group_sync_status as string] || SYNC_BADGES['N/A']
    const isActive = it.is_active !== false

    return (
        <div className="min-h-full">
            <LayoutTopBar title={String(it.name || `Product #${it.id}`)} sku={String(it.sku || `#${it.id}`)}
                onBack={onBack} onEdit={onEdit} onDelete={onDelete} accent="var(--app-info, #3b82f6)" />

            <div className="px-4 md:px-8 py-5 max-w-[1400px] mx-auto space-y-4">
                {/* ── Top: Hero + status strip ── */}
                <div className="rounded-2xl p-4 md:p-5 flex items-center gap-4"
                     style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 1px 2px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                    <div className="flex-shrink-0 page-header-icon"
                         style={{ background: 'var(--app-primary)', boxShadow: '0 6px 16px color-mix(in srgb, var(--app-primary) 25%, transparent)', width: 56, height: 56 }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={48} className="rounded-xl" color="white" iconSize={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <h1 className="text-tp-lg font-black truncate">{String(it.name || `Product #${it.id}`)}</h1>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                            <CopyChip value={String(it.sku || `#${it.id}`)} />
                            {it.barcode && <CopyChip value={String(it.barcode)} mono />}
                        </div>
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-1">
                        <Pill label={isActive ? 'Active' : 'Inactive'} color={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                        <Pill label={stockLabel} color={stockColor} />
                        {hasGroup && syncBadge.icon && <Pill label={syncBadge.label} color={syncBadge.color} icon={<syncBadge.icon size={9} />} />}
                    </div>
                </div>

                {/* ── KPI strip ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <ExecKpi label="Selling TTC" value={fmt(it.selling_price_ttc)}  accent="var(--app-success)" caption="per unit" />
                    <ExecKpi label="Margin"      value={margin != null ? `${margin.toFixed(1)}%` : '—'} accent="var(--app-primary)" caption={margin != null ? 'over cost' : 'set cost'} />
                    <ExecKpi label="On hand"     value={fmtQty(onHand)}              accent={stockColor}         caption={stockLabel} />
                    <ExecKpi label="Reserved"    value={fmtQty(it.reserved_qty)}     accent="var(--app-accent)"  caption="open orders" />
                    <ExecKpi label="Reorder"     value={fmtQty(reorder)}             accent="var(--app-warning)" caption="restock at" />
                </div>

                {/* ── 6-card grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {/* Pricing */}
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<DollarSign size={14} />} title="Pricing" accent="var(--app-success)"
                            right={hasGroup && (
                                <button onClick={onTogglePricingSource}
                                    className="text-tp-xxs font-black uppercase tracking-wider px-2 py-0.5 rounded-md hover:brightness-110"
                                    style={{
                                        background: it.pricing_source === 'GROUP' ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)' : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                        color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                                    }}>
                                    {it.pricing_source === 'GROUP' ? 'Override' : 'Follow'}
                                </button>
                            )} />
                        <div className="space-y-0.5">
                            <PriceLadderRow label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="var(--app-success)" />
                            <PriceLadderRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                            <PriceLadderRow label="Cost"        value={fmt(it.cost_price)} color="var(--app-info)" />
                            <PriceLadderRow label="VAT"         value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                            {margin != null && <PriceLadderRow label="Margin" value={`${margin.toFixed(1)}%`} color="var(--app-primary)" />}
                        </div>
                    </div>

                    {/* Inventory */}
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Warehouse size={14} />} title="Inventory" accent="var(--app-info, #3b82f6)" />
                        <div className="grid grid-cols-2 gap-1.5">
                            <InvCell label="On hand"   value={fmtQty(onHand)} color={stockColor} />
                            <InvCell label="Available" value={fmtQty(it.available_qty)} color="var(--app-primary)" />
                            <InvCell label="Reserved"  value={fmtQty(it.reserved_qty)} color="var(--app-accent)" />
                            <InvCell label="Reorder"   value={fmtQty(reorder)} color="var(--app-warning)" />
                            <InvCell label="Min"       value={fmtQty(it.min_stock_level)} color="var(--app-muted-foreground)" />
                            <InvCell label="Max"       value={fmtQty(it.max_stock_level)} color="var(--app-muted-foreground)" />
                        </div>
                    </div>

                    {/* Packaging */}
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Package size={14} />} title="Packaging" accent="var(--app-warning, #f59e0b)" />
                        <p className="text-tp-xs text-app-muted-foreground mb-2">Packaging chain — switch to Workspace for the full editor.</p>
                        <div className="space-y-1">
                            <ExecRow label="Base unit"   value={String(it.unit_name || it.unit_code || '—')} />
                            <ExecRow label="Sold by"     value={String(it.unit_name || '—')} />
                            <ExecRow label="Variants"    value={Number(it.packaging_count ?? 0).toString()} />
                            <ExecRow label="Box size"    value={fmtQty(it.units_per_box)} />
                        </div>
                    </div>

                    {/* Compliance */}
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Shield size={14} />} title="Compliance" accent="var(--app-accent)" />
                        <div className="space-y-1">
                            <ExecRow label="Status"       value={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                            <ExecRow label="Type"         value={String(it.product_type || '—')} />
                            <ExecRow label="Barcode"      value={String(it.barcode || '—')} mono />
                            <ExecRow label="Sourcing"     value={String(it.sourcing_country_name || it.sourcing_country || '—')} />
                            <ExecRow label="Certifications" value={Array.isArray(it.certifications) && it.certifications.length > 0 ? `${it.certifications.length} on file` : '—'} />
                        </div>
                    </div>

                    {/* Accounting */}
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Activity size={14} />} title="Accounting" accent="var(--app-primary)" />
                        <div className="space-y-1">
                            <ExecRow label="Total sold"     value={fmtQty(totalSold)} />
                            <ExecRow label="Total bought"   value={fmtQty(it.total_purchases ?? 0)} />
                            <ExecRow label="Total profit"   value={fmt(it.total_profit ?? 0)} tone="var(--app-success)" />
                            <ExecRow label="Pricing group"  value={hasGroup ? String(it.product_group_name || `Group #${it.product_group}`) : '—'} />
                            <ExecRow label="Inventory grps" value={String(invMemberships.length)} />
                        </div>
                    </div>

                    {/* Audit */}
                    <div className="rounded-2xl p-4 xl:col-span-1 md:col-span-2" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<History size={14} />} title="Audit" accent="var(--app-muted-foreground)" />
                        <div className="-mt-1 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                            <ProductAuditTimeline productId={productId} />
                        </div>
                    </div>
                </div>

                {/* ── Per-warehouse table ── */}
                {stockByWarehouse.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Warehouse size={14} />} title={`Per-warehouse stock · ${stockByWarehouse.length} ${stockByWarehouse.length === 1 ? 'location' : 'locations'}`} accent="var(--app-info, #3b82f6)" />
                        <div className="overflow-x-auto">
                            <table className="w-full text-tp-xs">
                                <thead>
                                    <tr className="text-left text-app-muted-foreground font-black uppercase tracking-widest text-tp-xxs"
                                        style={{ borderBottom: '1px solid var(--app-border)' }}>
                                        <th className="py-2">Warehouse</th>
                                        <th className="py-2 text-right">On hand</th>
                                        <th className="py-2 text-right">Reserved</th>
                                        <th className="py-2 text-right">Available</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockByWarehouse.map(s => {
                                        const reserved = Number(s.reserved_quantity ?? 0)
                                        return (
                                            <tr key={s.warehouse} className="hover:bg-app-bg/40 transition-colors"
                                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                                <td className="py-2 font-bold text-app-foreground">{s.warehouse_name || `Warehouse #${s.warehouse}`}</td>
                                                <td className="py-2 text-right tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</td>
                                                <td className="py-2 text-right tabular-nums" style={{ color: 'var(--app-accent)' }}>{fmtQty(reserved)}</td>
                                                <td className="py-2 text-right tabular-nums font-bold" style={{ color: 'var(--app-foreground)' }}>{fmtQty(s.quantity - reserved)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="h-8" />
            </div>
        </div>
    )
}
function ExecKpi({ label, value, accent, caption }: { label: string; value: string; accent: string; caption?: string }) {
    return (
        <div className="rounded-xl p-3"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: accent }}>{label}</p>
            <p className="text-tp-lg font-black tabular-nums tracking-tight mt-0.5" style={{ color: 'var(--app-foreground)' }}>{value}</p>
            {caption && <p className="text-tp-xxs text-app-muted-foreground truncate">{caption}</p>}
        </div>
    )
}
function ExecRow({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: string }) {
    return (
        <div className="flex items-baseline justify-between text-tp-xs">
            <span className="text-app-muted-foreground">{label}</span>
            <span className={`font-bold ${mono ? 'font-mono' : ''} truncate ml-2`} style={{ color: tone || 'var(--app-foreground)' }}>{value}</span>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  PREMIUM — minimal / elegant / airy
 *  ----------------------------------------------------------------
 *  Hero banner with the product as the visual centerpiece, then a
 *  single-column flow of cards (Overview, Pricing, Inventory,
 *  Packaging, Activity). Generous whitespace, refined hierarchy,
 *  large typography. Single readable column, no rail.
 * ═════════════════════════════════════════════════════════════ */
function PremiumView({
    it, stockByWarehouse, margin, stockColor, stockLabel,
    onBack, onEdit, onDelete, productId,
}: LayoutViewProps) {
    const onHand = Number(it.on_hand_qty || 0)
    const isActive = it.is_active !== false

    return (
        <div className="min-h-full">
            <LayoutTopBar title={String(it.name || `Product #${it.id}`)} sku={String(it.sku || `#${it.id}`)}
                onBack={onBack} onEdit={onEdit} onDelete={onDelete} accent="var(--app-success)" />

            {/* ── Hero banner ── */}
            <div className="px-4 md:px-10 pt-10 md:pt-16 pb-10"
                 style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 6%, var(--app-bg)) 0%, var(--app-bg) 100%)' }}>
                <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex-shrink-0 page-header-icon"
                         style={{ background: 'var(--app-primary)', boxShadow: '0 12px 32px color-mix(in srgb, var(--app-primary) 28%, transparent)', width: 96, height: 96 }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={80} className="rounded-3xl" color="white" iconSize={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-tp-xxs font-black uppercase tracking-[0.3em] text-app-muted-foreground mb-2">
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <h1 className="text-3xl md:text-5xl font-black leading-[1.05] tracking-tight text-app-foreground">
                            {String(it.name || `Product #${it.id}`)}
                        </h1>
                        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                            <Pill label={isActive ? 'Active' : 'Inactive'} color={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                            <Pill label={stockLabel} color={stockColor} />
                            <CopyChip value={String(it.sku || `#${it.id}`)} />
                            {it.barcode && <CopyChip value={String(it.barcode)} mono />}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-10 py-8 max-w-3xl mx-auto space-y-6">
                {/* ── Overview ── */}
                <PremiumCard accent="var(--app-primary)" eyebrow="Overview" title="At a glance">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <PremiumStat label="Selling"   value={fmt(it.selling_price_ttc)} caption="TTC" accent="var(--app-success)" />
                        <PremiumStat label="Margin"    value={margin != null ? `${margin.toFixed(1)}%` : '—'} caption={margin != null ? 'over cost' : 'set cost'} accent="var(--app-primary)" />
                        <PremiumStat label="On hand"   value={fmtQty(onHand)} caption={stockLabel} accent={stockColor} />
                        <PremiumStat label="Reserved"  value={fmtQty(it.reserved_qty)} caption="open orders" accent="var(--app-accent)" />
                    </div>
                    {it.description && (
                        <p className="text-tp-md text-app-foreground leading-relaxed mt-5 whitespace-pre-line">
                            {String(it.description)}
                        </p>
                    )}
                </PremiumCard>

                {/* ── Pricing ── */}
                <PremiumCard accent="var(--app-success)" eyebrow="Pricing" title="The numbers">
                    <div className="space-y-1 mt-3">
                        <PriceLadderRow label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="var(--app-success)" />
                        <PriceLadderRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                        <PriceLadderRow label="Cost"        value={fmt(it.cost_price)} color="var(--app-info)" />
                        <PriceLadderRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                        {margin != null && <PriceLadderRow label="Margin" value={`${margin.toFixed(1)}%`} highlight color="var(--app-primary)" />}
                    </div>
                </PremiumCard>

                {/* ── Inventory ── */}
                <PremiumCard accent="var(--app-info, #3b82f6)" eyebrow="Inventory" title="Where it lives">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                        <InvCell label="On hand"   value={fmtQty(onHand)} color={stockColor} />
                        <InvCell label="Available" value={fmtQty(it.available_qty)} color="var(--app-primary)" />
                        <InvCell label="Reserved"  value={fmtQty(it.reserved_qty)} color="var(--app-accent)" />
                        <InvCell label="Reorder"   value={fmtQty(it.reorder_point)} color="var(--app-warning)" />
                        <InvCell label="Min"       value={fmtQty(it.min_stock_level)} color="var(--app-muted-foreground)" />
                        <InvCell label="Max"       value={fmtQty(it.max_stock_level)} color="var(--app-muted-foreground)" />
                    </div>
                    {stockByWarehouse.length > 0 && (
                        <div className="mt-5 space-y-1">
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2">By warehouse</p>
                            {stockByWarehouse.slice(0, 8).map(s => (
                                <div key={s.warehouse} className="flex items-baseline justify-between py-2"
                                     style={{ borderBottom: '1px dotted color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <span className="text-tp-sm font-bold text-app-foreground truncate flex-1">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                    <span className="text-tp-md font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </PremiumCard>

                {/* ── Identity ── */}
                <PremiumCard accent="var(--app-warning, #f59e0b)" eyebrow="Identity" title="What it is">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-3">
                        <ExecRow label="Brand"    value={String(it.brand_name || '—')} />
                        <ExecRow label="Category" value={String(it.category_name || '—')} />
                        <ExecRow label="Unit"     value={String(it.unit_name || it.unit_code || '—')} />
                        <ExecRow label="Type"     value={String(it.product_type || '—')} />
                        <ExecRow label="Barcode"  value={String(it.barcode || '—')} mono />
                        <ExecRow label="Status"   value={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                    </div>
                </PremiumCard>

                {/* ── Activity ── */}
                <PremiumCard accent="var(--app-muted-foreground)" eyebrow="History" title="Recent changes">
                    <div className="mt-3">
                        <ProductAuditTimeline productId={productId} />
                    </div>
                </PremiumCard>

                <div className="h-12" />
            </div>
        </div>
    )
}
function PremiumCard({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent: string; children: React.ReactNode }) {
    return (
        <section className="rounded-3xl p-6 md:p-8"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 1px 2px color-mix(in srgb, var(--app-foreground) 4%, transparent), 0 8px 24px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
            <p className="text-tp-xxs font-black uppercase tracking-[0.3em]" style={{ color: accent }}>{eyebrow}</p>
            <h2 className="text-tp-lg font-black text-app-foreground mt-1">{title}</h2>
            {children}
        </section>
    )
}
function PremiumStat({ label, value, caption, accent }: { label: string; value: string; caption?: string; accent: string }) {
    return (
        <div className="rounded-2xl p-3"
             style={{ background: `color-mix(in srgb, ${accent} 6%, var(--app-bg))`, border: `1px solid color-mix(in srgb, ${accent} 18%, transparent)` }}>
            <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: accent }}>{label}</p>
            <p className="text-2xl font-black tabular-nums tracking-tight mt-0.5 text-app-foreground">{value}</p>
            {caption && <p className="text-tp-xxs text-app-muted-foreground truncate">{caption}</p>}
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  ANALYTICS COCKPIT — operational data-intelligence layout
 *  ----------------------------------------------------------------
 *  Charts row up top (sales / margin / stock — placeholder sparks
 *  until the time-series API is in place), health meters & alerts
 *  in the middle, then operational sections (Pricing, Inventory,
 *  Packaging) followed by the audit timeline. Designed for the
 *  operator who's pattern-matching on signals.
 * ═════════════════════════════════════════════════════════════ */
function AnalyticsCockpitView({
    it, stockByWarehouse, margin, stockColor, stockLabel,
    onBack, onEdit, onDelete, productId,
}: LayoutViewProps) {
    const onHand = Number(it.on_hand_qty || 0)
    const reorder = Number(it.reorder_point || 0)
    const minStock = Number(it.min_stock_level || 0)
    const maxStock = Number(it.max_stock_level || 0)
    const financialPct = reorder > 0 ? Math.min(100, Math.round((onHand / Math.max(reorder, 1)) * 100)) : 100
    const adjustmentPct = maxStock > 0 ? Math.min(100, Math.round((onHand / maxStock) * 100)) : 100
    const marginPct = margin != null ? Math.max(0, Math.min(100, Math.round(margin))) : 0

    const alerts: { icon: typeof ShoppingCart; label: string; color: string }[] = []
    if (onHand <= 0) alerts.push({ icon: AlertTriangle, label: 'Out of stock', color: 'var(--app-error)' })
    else if (minStock > 0 && onHand <= minStock) alerts.push({ icon: AlertTriangle, label: `Low stock — ${onHand} units (min ${minStock})`, color: 'var(--app-warning)' })
    if (it.is_active === false) alerts.push({ icon: AlertTriangle, label: 'Product inactive', color: 'var(--app-muted-foreground)' })
    if (it.group_sync_status === 'BROKEN') alerts.push({ icon: AlertTriangle, label: 'Group price diverged', color: 'var(--app-error)' })
    if (reorder > 0 && onHand <= reorder) alerts.push({ icon: ShoppingCart, label: `At/below reorder — purchase ${Math.max(reorder - onHand, 1)} units`, color: 'var(--app-warning)' })

    return (
        <div className="min-h-full">
            <LayoutTopBar title={String(it.name || `Product #${it.id}`)} sku={String(it.sku || `#${it.id}`)}
                onBack={onBack} onEdit={onEdit} onDelete={onDelete} accent="var(--app-accent)" />

            <div className="px-4 md:px-8 py-5 max-w-[1200px] mx-auto space-y-4">
                {/* ── Charts row (sparkline placeholders) ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <CockpitChart title="Sales velocity"   tone="var(--app-success)"           hint="Units sold over time — pipeline placeholder" />
                    <CockpitChart title="Margin trend"     tone="var(--app-primary)"           hint="Margin % week over week — pipeline placeholder" />
                    <CockpitChart title="Stock position"   tone="var(--app-info, #3b82f6)"     hint="On-hand vs reorder line — pipeline placeholder" bars />
                </div>

                {/* ── Health meters ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Meter label="Financial"  value={financialPct}  accent="var(--app-accent)"          icon={<Activity size={14} />}    hint="On-hand vs reorder point" />
                    <Meter label="Adjustment" value={adjustmentPct} accent="var(--app-info, #3b82f6)"   icon={<Activity size={14} />}    hint="On-hand vs max stock" />
                    <Meter label="Margin"     value={marginPct}     accent="var(--app-success)"         icon={<TrendingUp size={14} />}  hint={margin != null ? `${margin.toFixed(1)}% over cost` : 'Set cost to compute'} />
                </div>

                {/* ── Alerts ── */}
                {alerts.length > 0 && (
                    <div className="rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap"
                         style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 22%, transparent)' }}>
                        <span className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-warning, #f59e0b)' }}>Alerts</span>
                        {alerts.map((a, i) => {
                            const Icon = a.icon
                            return (
                                <span key={i} className="flex items-center gap-1 text-tp-xs font-bold" style={{ color: a.color }}>
                                    <Icon size={11} /> {a.label}
                                </span>
                            )
                        })}
                    </div>
                )}

                {/* ── Operational sections ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Box size={14} />} title="Stock position" accent="var(--app-info, #3b82f6)"
                            right={<span className="text-tp-xxs font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                         style={{ background: `color-mix(in srgb, ${stockColor} 12%, transparent)`, color: stockColor }}>{stockLabel}</span>} />
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <BigStat label="On hand"   value={fmtQty(onHand)}             hint="all locations"   color="var(--app-info, #3b82f6)" />
                            <BigStat label="Available" value={fmtQty(it.available_qty)}   hint="free"            color="var(--app-primary)" />
                            <BigStat label="Reserved"  value={fmtQty(it.reserved_qty)}    hint="on orders"       color="var(--app-accent)" />
                        </div>
                        {maxStock > 0 && (
                            <div>
                                <div className="flex items-center justify-between text-tp-xxs font-bold text-app-muted-foreground mb-1">
                                    <span>0</span>
                                    <span>min {fmtQty(minStock)} · reorder {fmtQty(reorder)} · max {fmtQty(maxStock)}</span>
                                </div>
                                <StockHealthBar onHand={onHand} min={minStock} reorder={reorder} max={maxStock} color={stockColor} />
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<DollarSign size={14} />} title="Pricing" accent="var(--app-success)" />
                        <div className="space-y-1">
                            <PriceLadderRow label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="var(--app-success)" />
                            <PriceLadderRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                            <PriceLadderRow label="Cost"        value={fmt(it.cost_price)} color="var(--app-info)" />
                            {margin != null && <PriceLadderRow label="Margin" value={`${margin.toFixed(1)}%`} highlight color="var(--app-primary)" />}
                        </div>
                    </div>
                </div>

                {/* ── Per-warehouse ── */}
                {stockByWarehouse.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <CardHeader icon={<Warehouse size={14} />} title={`Per warehouse · ${stockByWarehouse.length}`} accent="var(--app-info, #3b82f6)" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                            {stockByWarehouse.slice(0, 12).map(s => (
                                <div key={s.warehouse} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-app-bg/40">
                                    <span className="text-tp-sm font-bold text-app-foreground truncate flex-1">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                    <span className="text-tp-md font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Audit ── */}
                <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <CardHeader icon={<History size={14} />} title="Activity timeline" accent="var(--app-muted-foreground)" />
                    <ProductAuditTimeline productId={productId} />
                </div>

                <div className="h-8" />
            </div>
        </div>
    )
}
function CockpitChart({ title, tone, hint, bars }: { title: string; tone: string; hint: string; bars?: boolean }) {
    return (
        <div className="rounded-2xl p-4 relative overflow-hidden"
             style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: tone }}>{title}</p>
            <div className="h-20 mt-3 relative">
                <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="none">
                    {bars ? (
                        Array.from({ length: 16 }).map((_, i) => {
                            const h = 18 + ((i * 17 + 4) % 50)
                            return <rect key={i} x={i * 12 + 4} y={80 - h} width={9} height={h} rx={1.5} fill={tone} opacity={0.55 + (i % 3) * 0.15} />
                        })
                    ) : (
                        <>
                            <defs>
                                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
                                    <stop offset="100%" stopColor={tone} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path d="M0,55 L20,48 L40,52 L60,30 L80,38 L100,18 L120,22 L140,12 L160,18 L180,8 L200,14 L200,80 L0,80 Z" fill={`url(#grad-${title})`} />
                            <polyline points="0,55 20,48 40,52 60,30 80,38 100,18 120,22 140,12 160,18 180,8 200,14" fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                    )}
                </svg>
            </div>
            <p className="text-tp-xxs text-app-muted-foreground mt-1">{hint}</p>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  MINIMAL — tabbed workspace
 *  ----------------------------------------------------------------
 *  Compact header with hero + status, then a tab bar (Overview,
 *  Pricing, Inventory, Packaging, Identity, Activity), then the
 *  active tab's content. Keeps all data accessible without long
 *  scrolling — best for very large datasets.
 * ═════════════════════════════════════════════════════════════ */
type MinimalTab = 'overview' | 'pricing' | 'inventory' | 'packaging' | 'identity' | 'activity'
function MinimalView({
    it, invMemberships, stockByWarehouse, margin, stockColor, stockLabel,
    onBack, onEdit, onDelete, onTogglePricingSource, productId,
}: LayoutViewProps) {
    const [tab, setTab] = useState<MinimalTab>('overview')
    const onHand = Number(it.on_hand_qty || 0)
    const isActive = it.is_active !== false
    const hasGroup = it.product_group || it.product_group_name
    const syncBadge = SYNC_BADGES[it.group_sync_status as string] || SYNC_BADGES['N/A']

    const tabs: { id: MinimalTab; label: string; icon: typeof Activity; accent: string }[] = [
        { id: 'overview',  label: 'Overview',  icon: Zap,        accent: 'var(--app-primary)' },
        { id: 'pricing',   label: 'Pricing',   icon: DollarSign, accent: 'var(--app-success)' },
        { id: 'inventory', label: 'Inventory', icon: Warehouse,  accent: 'var(--app-info, #3b82f6)' },
        { id: 'packaging', label: 'Packaging', icon: Package,    accent: 'var(--app-warning, #f59e0b)' },
        { id: 'identity',  label: 'Identity',  icon: Tag,        accent: 'var(--app-accent)' },
        { id: 'activity',  label: 'Activity',  icon: History,    accent: 'var(--app-muted-foreground)' },
    ]
    const activeTab = tabs.find(t => t.id === tab) || tabs[0]

    return (
        <div className="min-h-full">
            <LayoutTopBar title={String(it.name || `Product #${it.id}`)} sku={String(it.sku || `#${it.id}`)}
                onBack={onBack} onEdit={onEdit} onDelete={onDelete} accent="var(--app-warning, #f59e0b)" />

            {/* ── Header strip ── */}
            <div className="px-4 md:px-8 py-5 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 page-header-icon"
                         style={{ background: 'var(--app-primary)', boxShadow: '0 6px 16px color-mix(in srgb, var(--app-primary) 25%, transparent)', width: 56, height: 56 }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={48} className="rounded-xl" color="white" iconSize={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <h1 className="text-tp-lg font-black truncate">{String(it.name || `Product #${it.id}`)}</h1>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                            <Pill label={isActive ? 'Active' : 'Inactive'} color={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                            <Pill label={stockLabel} color={stockColor} />
                            {hasGroup && syncBadge.icon && <Pill label={syncBadge.label} color={syncBadge.color} icon={<syncBadge.icon size={9} />} />}
                            <CopyChip value={String(it.sku || `#${it.id}`)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="sticky top-[60px] z-[5] px-4 md:px-8"
                 style={{ background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="max-w-5xl mx-auto flex items-center gap-0.5 overflow-x-auto custom-scrollbar -mx-1 px-1">
                    {tabs.map(t => {
                        const Icon = t.icon
                        const active = t.id === tab
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 transition-all relative"
                                style={{
                                    color: active ? t.accent : 'var(--app-muted-foreground)',
                                    borderBottom: `2px solid ${active ? t.accent : 'transparent'}`,
                                }}>
                                <Icon size={13} />
                                <span className="text-tp-xs font-bold">{t.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <PulseCell label="On hand"   value={fmtQty(onHand)}             color={stockColor}        hint={stockLabel} />
                            <PulseCell label="Available" value={fmtQty(it.available_qty)}   color="var(--app-primary)" hint="On hand minus reserved" />
                            <PulseCell label="Reserved"  value={fmtQty(it.reserved_qty)}    color="var(--app-accent)"  hint="Allocated to open orders" />
                            <PulseCell label="Reorder"   value={fmtQty(it.reorder_point)}   color="var(--app-warning)" hint="Stock floor before alert" />
                        </div>
                        {it.description && (
                            <div className="rounded-2xl px-4 py-3"
                                 style={{ background: 'color-mix(in srgb, var(--app-foreground) 3%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                <p className="text-tp-sm text-app-foreground leading-relaxed whitespace-pre-line">{String(it.description)}</p>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'pricing' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-end">
                            {hasGroup && (
                                <button onClick={onTogglePricingSource}
                                    className="text-tp-xxs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all hover:brightness-110"
                                    style={{
                                        background: it.pricing_source === 'GROUP' ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)' : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                        color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                                    }}>
                                    {it.pricing_source === 'GROUP' ? 'Override locally' : 'Follow group'}
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <PriceLadderRow label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="var(--app-success)" />
                            <PriceLadderRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                            <PriceLadderRow label="Cost"        value={fmt(it.cost_price)} color="var(--app-info)" />
                            <PriceLadderRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                            {margin != null && <PriceLadderRow label="Margin" value={`${margin.toFixed(1)}%`} highlight color="var(--app-primary)" />}
                        </div>
                    </div>
                )}
                {tab === 'inventory' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <InvCell label="On hand"   value={fmtQty(onHand)} color={stockColor} />
                            <InvCell label="Available" value={fmtQty(it.available_qty)} color="var(--app-primary)" />
                            <InvCell label="Reserved"  value={fmtQty(it.reserved_qty)} color="var(--app-accent)" />
                            <InvCell label="Reorder"   value={fmtQty(it.reorder_point)} color="var(--app-warning)" />
                            <InvCell label="Min"       value={fmtQty(it.min_stock_level)} color="var(--app-muted-foreground)" />
                            <InvCell label="Max"       value={fmtQty(it.max_stock_level)} color="var(--app-muted-foreground)" />
                        </div>
                        {stockByWarehouse.length > 0 && (
                            <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2">By warehouse</p>
                                <div className="space-y-1">
                                    {stockByWarehouse.slice(0, 12).map(s => (
                                        <div key={s.warehouse} className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-app-bg/40">
                                            <span className="text-tp-sm font-bold text-app-foreground truncate flex-1">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                            <span className="text-tp-md font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {tab === 'packaging' && (
                    <div className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <ProductPackagingTab
                            productId={String(it.id)}
                            productName={String(it.name || '')}
                            basePriceTTC={Number(it.selling_price_ttc) || undefined}
                            basePriceHT={Number(it.selling_price_ht) || undefined}
                            productUnitId={it.unit as number}
                        />
                    </div>
                )}
                {tab === 'identity' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        <ExecRow label="Brand"           value={String(it.brand_name || '—')} />
                        <ExecRow label="Category"        value={String(it.category_name || '—')} />
                        <ExecRow label="Unit"            value={String(it.unit_name || it.unit_code || '—')} />
                        <ExecRow label="Type"            value={String(it.product_type || '—')} />
                        <ExecRow label="Barcode"         value={String(it.barcode || '—')} mono />
                        <ExecRow label="Status"          value={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'var(--app-success)' : 'var(--app-error)'} />
                        <ExecRow label="Pricing group"   value={hasGroup ? String(it.product_group_name || `Group #${it.product_group}`) : '—'} />
                        <ExecRow label="Inventory grps"  value={String(invMemberships.length)} />
                    </div>
                )}
                {tab === 'activity' && (
                    <ProductAuditTimeline productId={productId} />
                )}
            </div>

            <div className="h-8" />
            <div style={{ display: 'none' }}>{activeTab.label}</div>
        </div>
    )
}
