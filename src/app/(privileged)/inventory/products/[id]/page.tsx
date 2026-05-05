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
    // Visual theme — five look-and-feel philosophies for the same data.
    //   modern  — app's own dashboard (default): meters, alerts, sections
    //   apple   — Apple Human Interface: SF-style type, vibrant system
    //             colors, frosted materials, generous rounded geometry
    //   google  — Material 3: tonal surfaces, primary containers,
    //             Roboto/Google Sans, Google brand palette
    //   claude  — Anthropic feel: cream paper, terracotta clay accent,
    //             serif headings, calm editorial rhythm
    //   lovable — Vibrant gradient surface, glassmorphism cards,
    //             playful big rounded geometry, AI-builder vibe
    type ViewMode = 'modern' | 'apple' | 'google' | 'claude' | 'lovable'
    const [viewMode, setViewMode] = useState<ViewMode>('modern')
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

    return (
        <div className="h-full overflow-hidden flex flex-col"
             style={{ background: 'var(--app-bg)' }}>
            {/* ═══ Theme switcher — sits above EVERYTHING so it survives
                 across the very different chrome each theme renders. ═══ */}
            <PhilosophyGallery active={viewMode} onPick={setViewMode} />

            {viewMode === 'apple' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <AppleView
                        it={it}
                        stockByWarehouse={stockByWarehouse}
                        margin={margin}
                        stockColor={stockColor}
                        onBack={() => router.push('/inventory/products')}
                        onEdit={() => router.push(`/inventory/products/${id}/edit`)}
                        onDelete={() => setShowDelete(true)}
                    />
                </div>
            )}
            {viewMode === 'google' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <GoogleView
                        it={it}
                        stockByWarehouse={stockByWarehouse}
                        margin={margin}
                        stockColor={stockColor}
                        onBack={() => router.push('/inventory/products')}
                        onEdit={() => router.push(`/inventory/products/${id}/edit`)}
                        onDelete={() => setShowDelete(true)}
                    />
                </div>
            )}
            {viewMode === 'claude' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <ClaudeView
                        it={it}
                        stockByWarehouse={stockByWarehouse}
                        margin={margin}
                        stockColor={stockColor}
                        onBack={() => router.push('/inventory/products')}
                        onEdit={() => router.push(`/inventory/products/${id}/edit`)}
                        onDelete={() => setShowDelete(true)}
                    />
                </div>
            )}
            {viewMode === 'lovable' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <LovableView
                        it={it}
                        stockByWarehouse={stockByWarehouse}
                        margin={margin}
                        stockColor={stockColor}
                        onBack={() => router.push('/inventory/products')}
                        onEdit={() => router.push(`/inventory/products/${id}/edit`)}
                        onDelete={() => setShowDelete(true)}
                    />
                </div>
            )}

            {viewMode === 'modern' && (
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

                        {/* Visual theme picker — three look-and-feel
                            philosophies, same data. Modern = the app's own
                            dashboard. Apple = Human Interface. Google =
                            Material 3. */}
                        <div>
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Visual theme</p>
                            <div className="space-y-0.5">
                                {([
                                    { id: 'modern',  label: 'Modern',  accent: 'var(--app-primary)', hint: 'App theme · dashboard' },
                                    { id: 'apple',   label: 'Apple',   accent: '#007aff',            hint: 'SF · frosted materials' },
                                    { id: 'google',  label: 'Google',  accent: '#1a73e8',            hint: 'Material 3 · tonal' },
                                    { id: 'claude',  label: 'Claude',  accent: '#cc785c',            hint: 'Cream paper · serif' },
                                    { id: 'lovable', label: 'Lovable', accent: '#ff4f8b',            hint: 'Vibrant · glass cards' },
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
type PhilosophyId = 'modern' | 'apple' | 'google' | 'claude' | 'lovable'

function PhilosophyGallery({ active, onPick }: { active: PhilosophyId; onPick: (id: PhilosophyId) => void }) {
    const items: { id: PhilosophyId; label: string; tag: string; accent: string; preview: React.ReactNode }[] = [
        { id: 'modern',  label: 'Modern',  tag: 'App theme · dashboard',  accent: 'var(--app-primary)', preview: <PreviewModern /> },
        { id: 'apple',   label: 'Apple',   tag: 'SF · frosted materials', accent: '#007aff',            preview: <PreviewApple /> },
        { id: 'google',  label: 'Google',  tag: 'Material 3 · tonal',     accent: '#1a73e8',            preview: <PreviewGoogle /> },
        { id: 'claude',  label: 'Claude',  tag: 'Cream paper · serif',    accent: '#cc785c',            preview: <PreviewClaude /> },
        { id: 'lovable', label: 'Lovable', tag: 'Vibrant · glass cards',  accent: '#ff4f8b',            preview: <PreviewLovable /> },
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

/* ─── Theme thumbnails — painted in each theme's real palette ─── */
function PreviewModern() {
    return (
        <div className="w-full h-full p-1.5 flex flex-col gap-1"
             style={{ background: 'var(--app-bg)' }}>
            <div className="flex gap-0.5">
                <div className="flex-1 h-2 rounded-sm" style={{ background: 'var(--app-success)', opacity: 0.7 }} />
                <div className="flex-1 h-2 rounded-sm" style={{ background: 'var(--app-info, #3b82f6)', opacity: 0.7 }} />
                <div className="flex-1 h-2 rounded-sm" style={{ background: 'var(--app-warning, #f59e0b)', opacity: 0.7 }} />
            </div>
            <div className="flex-1 flex gap-0.5">
                <div className="flex-1 rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
                <div className="flex-1 rounded-sm" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }} />
            </div>
        </div>
    )
}
function PreviewApple() {
    return (
        <div className="w-full h-full p-1.5 flex flex-col gap-1"
             style={{ background: '#f5f5f7' }}>
            <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
            </div>
            <div className="flex-1 rounded-lg" style={{ background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                <div className="h-1.5 rounded-full m-1" style={{ background: '#007aff', opacity: 0.9, width: '40%' }} />
                <div className="flex gap-0.5 m-1 mt-0.5">
                    <div className="flex-1 h-2 rounded" style={{ background: '#34c759', opacity: 0.6 }} />
                    <div className="flex-1 h-2 rounded" style={{ background: '#ff9500', opacity: 0.6 }} />
                </div>
            </div>
        </div>
    )
}
function PreviewGoogle() {
    return (
        <div className="w-full h-full p-1.5 flex flex-col gap-1"
             style={{ background: '#fef7ff' }}>
            <div className="h-2.5 rounded flex items-center px-1 gap-0.5" style={{ background: '#1a73e8' }}>
                <div className="w-0.5 h-0.5 rounded-full bg-white" />
                <div className="w-0.5 h-0.5 rounded-full bg-white" />
                <div className="w-0.5 h-0.5 rounded-full bg-white" />
            </div>
            <div className="flex gap-0.5">
                <div className="flex-1 h-3 rounded-md" style={{ background: '#d3e3fd' }} />
                <div className="flex-1 h-3 rounded-md" style={{ background: '#e8f5e9' }} />
            </div>
            <div className="flex-1 rounded-md" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' }} />
        </div>
    )
}
function PreviewClaude() {
    return (
        <div className="w-full h-full p-1.5 flex flex-col gap-1"
             style={{ background: '#f5f1e8', color: '#1a1814', fontFamily: 'Georgia, serif' }}>
            <div className="text-[6px] tracking-[0.3em] uppercase opacity-50">PRODUCT</div>
            <div className="text-[10px] font-bold italic leading-none" style={{ color: '#cc785c' }}>Detail</div>
            <div className="border-t" style={{ borderColor: '#cc785c', opacity: 0.4 }} />
            <div className="flex-1 rounded-sm" style={{ background: '#faf6ee', border: '1px solid rgba(204,120,92,0.18)' }} />
        </div>
    )
}
function PreviewLovable() {
    return (
        <div className="w-full h-full relative overflow-hidden p-1.5"
             style={{ background: 'linear-gradient(135deg, #ff4f8b 0%, #a855f7 50%, #6366f1 100%)' }}>
            <div className="absolute top-0 right-0 w-6 h-6 rounded-full blur-md" style={{ background: '#fde047', opacity: 0.6 }} />
            <div className="relative h-full flex flex-col gap-1">
                <div className="flex-1 rounded-md" style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(4px)' }} />
                <div className="flex gap-0.5">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
                </div>
            </div>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  APPLE VIEW — Apple Human Interface Guidelines
 *  ----------------------------------------------------------------
 *  SF-style typography (system font stack), light gray system
 *  surface (#f5f5f7 — actual macOS/iOS background), big rounded
 *  corners, white cards with subtle shadows ("materials"), Apple
 *  system colors as accents (blue, green, orange, red, purple).
 *  Generous whitespace, refined hierarchy. Own toolbar, no rail.
 * ═════════════════════════════════════════════════════════════ */
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'
const APPLE = {
    blue:    '#007aff',
    green:   '#34c759',
    orange:  '#ff9500',
    red:     '#ff3b30',
    purple:  '#bf5af2',
    teal:    '#5ac8fa',
    indigo:  '#5856d6',
    gray:    '#8e8e93',
    bg:      '#f5f5f7',
    surface: '#ffffff',
    label:   '#1d1d1f',
    sublabel:'#6e6e73',
}

function AppleView({ it, stockByWarehouse, margin, stockColor: _stockColor, onBack, onEdit, onDelete }: {
    it: Record<string, any>
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    onBack: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const isOut = onHand <= 0
    const isLow = !isOut && minStock > 0 && onHand <= minStock
    const stockTone = isOut ? APPLE.red : isLow ? APPLE.orange : APPLE.green
    const stockText = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'

    return (
        <div className="min-h-full" style={{ background: APPLE.bg, color: APPLE.label, fontFamily: APPLE_FONT }}>
            {/* ── Toolbar (Apple-style segmented buttons) ── */}
            <div className="sticky top-0 z-10 px-4 md:px-8 py-3 flex items-center gap-3"
                 style={{ background: 'rgba(245,245,247,0.85)', backdropFilter: 'saturate(180%) blur(20px)', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                <button onClick={onBack}
                    className="flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity"
                    style={{ color: APPLE.blue }}>
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Products
                </button>
                <div className="flex-1" />
                <button onClick={onEdit}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: APPLE.blue, color: 'white' }}>
                    Edit
                </button>
                <button onClick={onDelete} title="Delete"
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
                    style={{ background: 'rgba(255,59,48,0.1)', color: APPLE.red }}>
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto space-y-6">
                {/* ── Hero card ── */}
                <div className="rounded-3xl p-6 md:p-8 flex items-center gap-5"
                     style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
                    <div className="flex-shrink-0 rounded-3xl flex items-center justify-center"
                         style={{ width: 80, height: 80, background: `linear-gradient(135deg, ${APPLE.blue}, ${APPLE.indigo})`, color: 'white', boxShadow: '0 6px 18px rgba(0,122,255,0.35)' }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={64} className="rounded-2xl" color="white" iconSize={36} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: APPLE.sublabel }}>
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <h1 className="text-3xl md:text-4xl font-bold leading-tight mt-1 truncate" style={{ letterSpacing: '-0.02em' }}>
                            {String(it.name || `Product #${it.id}`)}
                        </h1>
                        <p className="text-sm mt-1.5" style={{ color: APPLE.sublabel }}>
                            {String(it.sku || `#${it.id}`)}{it.barcode && <> · <span className="font-mono">{String(it.barcode)}</span></>}
                        </p>
                    </div>
                    {/* Status capsule */}
                    <div className="hidden md:flex flex-col items-end gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold"
                              style={{ background: `color-mix(in srgb, ${stockTone} 14%, transparent)`, color: stockTone }}>
                            {stockText}
                        </span>
                        {it.is_active === false && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold"
                                  style={{ background: 'rgba(142,142,147,0.18)', color: APPLE.gray }}>
                                Inactive
                            </span>
                        )}
                    </div>
                </div>

                {/* ── KPI tiles — Apple system color squares ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <AppleTile label="Selling"    value={fmt(it.selling_price_ttc)}  tone={APPLE.green}  caption="TTC" />
                    <AppleTile label="Cost"       value={fmt(it.cost_price)}         tone={APPLE.blue}   caption="HT" />
                    <AppleTile label="Margin"     value={margin != null ? `${margin.toFixed(1)}%` : '—'} tone={APPLE.purple} caption={margin != null ? 'over cost' : 'set cost'} />
                    <AppleTile label="On hand"    value={fmtQty(onHand)}             tone={stockTone}    caption={stockText} />
                </div>

                {/* ── Two-column body: Stock + Pricing ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Stock card */}
                    <div className="rounded-3xl overflow-hidden"
                         style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
                        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                            <Box size={16} style={{ color: APPLE.blue }} />
                            <h3 className="text-base font-semibold" style={{ letterSpacing: '-0.01em' }}>Stock</h3>
                        </div>
                        <div className="px-2 py-1">
                            <AppleRow label="On hand"   value={fmtQty(onHand)} tone={stockTone} />
                            <AppleRow label="Available" value={fmtQty(it.available_qty)} />
                            <AppleRow label="Reserved"  value={fmtQty(it.reserved_qty)} />
                            <AppleRow label="Reorder"   value={fmtQty(it.reorder_point)} sublabel="restock at" />
                            <AppleRow label="Min level" value={fmtQty(it.min_stock_level)} />
                            <AppleRow label="Max level" value={fmtQty(it.max_stock_level)} last />
                        </div>
                    </div>

                    {/* Pricing card */}
                    <div className="rounded-3xl overflow-hidden"
                         style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
                        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                            <DollarSign size={16} style={{ color: APPLE.green }} />
                            <h3 className="text-base font-semibold" style={{ letterSpacing: '-0.01em' }}>Pricing</h3>
                        </div>
                        <div className="px-2 py-1">
                            <AppleRow label="Selling TTC" value={fmt(it.selling_price_ttc)} tone={APPLE.green} />
                            <AppleRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                            <AppleRow label="Cost"        value={fmt(it.cost_price)} />
                            <AppleRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} />
                            {margin != null && <AppleRow label="Margin" value={`${margin.toFixed(1)}%`} tone={APPLE.purple} last />}
                        </div>
                    </div>
                </div>

                {/* ── Per-warehouse list (Apple settings-style rows) ── */}
                {stockByWarehouse.length > 0 && (
                    <div className="rounded-3xl overflow-hidden"
                         style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
                        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                            <Warehouse size={16} style={{ color: APPLE.indigo }} />
                            <h3 className="text-base font-semibold" style={{ letterSpacing: '-0.01em' }}>Warehouses</h3>
                            <span className="ml-auto text-xs font-medium" style={{ color: APPLE.sublabel }}>{stockByWarehouse.length} {stockByWarehouse.length === 1 ? 'location' : 'locations'}</span>
                        </div>
                        <div className="px-2 py-1">
                            {stockByWarehouse.slice(0, 10).map((s, i) => (
                                <AppleRow key={s.warehouse}
                                    label={s.warehouse_name || `Warehouse #${s.warehouse}`}
                                    value={fmtQty(s.quantity)}
                                    sublabel={s.reserved_quantity ? `${fmtQty(s.reserved_quantity)} reserved` : undefined}
                                    last={i === Math.min(stockByWarehouse.length, 10) - 1} />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Identity card ── */}
                <div className="rounded-3xl overflow-hidden"
                     style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
                    <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                        <Tag size={16} style={{ color: APPLE.orange }} />
                        <h3 className="text-base font-semibold" style={{ letterSpacing: '-0.01em' }}>Details</h3>
                    </div>
                    <div className="px-2 py-1">
                        <AppleRow label="Brand"    value={String(it.brand_name || '—')} />
                        <AppleRow label="Category" value={String(it.category_name || '—')} />
                        <AppleRow label="Unit"     value={String(it.unit_name || it.unit_code || '—')} />
                        <AppleRow label="Type"     value={String(it.product_type || '—')} />
                        <AppleRow label="Status"   value={it.is_active === false ? 'Inactive' : 'Active'} tone={it.is_active === false ? APPLE.gray : APPLE.green} last />
                    </div>
                </div>

                {it.description && (
                    <div className="rounded-3xl p-6"
                         style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
                        <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: APPLE.sublabel }}>About</p>
                        <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: APPLE.label }}>
                            {String(it.description)}
                        </p>
                    </div>
                )}

                <p className="text-xs text-center pt-2" style={{ color: APPLE.sublabel }}>
                    {it.updated_at && <>Updated {timeAgo(String(it.updated_at))} · </>}id {String(it.id)}
                </p>

                <div className="h-8" />
            </div>
        </div>
    )
}
function AppleTile({ label, value, tone, caption }: { label: string; value: string; tone: string; caption?: string }) {
    return (
        <div className="rounded-2xl p-4"
             style={{ background: APPLE.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: APPLE.sublabel }}>{label}</p>
            </div>
            <p className="text-3xl font-bold tabular-nums mt-1.5" style={{ color: APPLE.label, letterSpacing: '-0.02em' }}>{value}</p>
            {caption && <p className="text-xs mt-0.5" style={{ color: APPLE.sublabel }}>{caption}</p>}
        </div>
    )
}
function AppleRow({ label, value, sublabel, tone, last }: { label: string; value: string; sublabel?: string; tone?: string; last?: boolean }) {
    return (
        <div className="flex items-center justify-between px-3 py-2.5"
             style={{ borderBottom: last ? 'none' : '0.5px solid rgba(0,0,0,0.06)' }}>
            <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: APPLE.label }}>{label}</p>
                {sublabel && <p className="text-xs mt-0.5" style={{ color: APPLE.sublabel }}>{sublabel}</p>}
            </div>
            <span className="text-sm font-medium tabular-nums ml-3" style={{ color: tone || APPLE.sublabel }}>{value}</span>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  GOOGLE VIEW — Material Design 3
 *  ----------------------------------------------------------------
 *  Tonal surface palette (background warm-tinted, surface variants
 *  for cards, primary container fills for emphasis), Roboto/Google
 *  Sans, top app bar with title + actions, FAB, list rows with
 *  leading icons, filled tonal chips. Google brand colors as
 *  semantic accents (blue / green / yellow / red).
 * ═════════════════════════════════════════════════════════════ */
const GOOGLE_FONT = '"Google Sans", "Product Sans", Roboto, "Helvetica Neue", Arial, sans-serif'
const GOOGLE = {
    blue:    '#1a73e8',
    blueAlt: '#4285f4',
    green:   '#188038',
    greenC:  '#e6f4ea',
    yellow:  '#f9ab00',
    yellowC: '#fef7e0',
    red:     '#d93025',
    redC:    '#fce8e6',
    primaryC:'#d3e3fd',
    onPrimaryC: '#001d35',
    bg:      '#fef7ff',
    surface: '#ffffff',
    surfaceLow: '#f7f2fa',
    surfaceVariant: '#e7e0ec',
    onSurface: '#1d1b20',
    onSurfaceVariant: '#49454f',
    outline: '#79747e',
}

function GoogleView({ it, stockByWarehouse, margin, stockColor: _stockColor, onBack, onEdit, onDelete }: {
    it: Record<string, any>
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    onBack: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const isOut = onHand <= 0
    const isLow = !isOut && minStock > 0 && onHand <= minStock
    const stockTone = isOut ? GOOGLE.red : isLow ? GOOGLE.yellow : GOOGLE.green
    const stockBg   = isOut ? GOOGLE.redC : isLow ? GOOGLE.yellowC : GOOGLE.greenC
    const stockText = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'

    return (
        <div className="min-h-full relative" style={{ background: GOOGLE.bg, color: GOOGLE.onSurface, fontFamily: GOOGLE_FONT }}>
            {/* ── Material 3 top app bar ── */}
            <div className="sticky top-0 z-10 px-3 md:px-6 py-2 flex items-center gap-3"
                 style={{ background: GOOGLE.bg, borderBottom: '1px solid color-mix(in srgb, #79747e 20%, transparent)' }}>
                <button onClick={onBack}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
                    style={{ color: GOOGLE.onSurface }}>
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-base font-medium truncate" style={{ color: GOOGLE.onSurface }}>
                        {String(it.name || `Product #${it.id}`)}
                    </p>
                    <p className="text-xs truncate" style={{ color: GOOGLE.onSurfaceVariant }}>
                        {String(it.sku || `#${it.id}`)}
                    </p>
                </div>
                <button onClick={onDelete} title="Delete"
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/5"
                    style={{ color: GOOGLE.red }}>
                    <Trash2 size={18} />
                </button>
                <button onClick={onEdit}
                    className="hidden md:flex items-center gap-2 px-4 h-10 rounded-full font-medium text-sm transition-all hover:brightness-110"
                    style={{ background: GOOGLE.blue, color: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                    <Edit3 size={16} /> Edit
                </button>
            </div>

            <div className="px-4 md:px-8 py-6 md:py-8 max-w-5xl mx-auto space-y-4 pb-32">
                {/* ── Hero (Material primary container) ── */}
                <div className="rounded-3xl p-5 md:p-6 flex items-center gap-4"
                     style={{ background: GOOGLE.primaryC, color: GOOGLE.onPrimaryC }}>
                    <div className="flex-shrink-0 rounded-2xl flex items-center justify-center"
                         style={{ width: 72, height: 72, background: GOOGLE.blue, color: 'white' }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={56} className="rounded-xl" color="white" iconSize={32} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium" style={{ color: GOOGLE.onPrimaryC, opacity: 0.7 }}>
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <p className="text-2xl font-medium leading-tight mt-0.5 truncate" style={{ color: GOOGLE.onPrimaryC }}>
                            {String(it.name || `Product #${it.id}`)}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <GoogleChip label={stockText}                tone={stockTone} bg={stockBg} />
                            {it.is_active === false && <GoogleChip label="Inactive" tone={GOOGLE.onSurfaceVariant} bg={GOOGLE.surfaceVariant} />}
                            {it.barcode && <GoogleChip label={String(it.barcode)} mono />}
                        </div>
                    </div>
                </div>

                {/* ── KPI tiles (filled cards, Material 3) ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <GoogleStat label="Selling" value={fmt(it.selling_price_ttc)} tone={GOOGLE.blue}  bg={GOOGLE.primaryC} caption="TTC" />
                    <GoogleStat label="Cost"    value={fmt(it.cost_price)}        tone={GOOGLE.green} bg={GOOGLE.greenC}   caption="HT" />
                    <GoogleStat label="Margin"  value={margin != null ? `${margin.toFixed(1)}%` : '—'} tone={GOOGLE.yellow} bg={GOOGLE.yellowC} caption={margin != null ? 'over cost' : 'set cost'} />
                    <GoogleStat label="On hand" value={fmtQty(onHand)} tone={stockTone} bg={stockBg} caption={stockText} />
                </div>

                {/* ── Two cards: Stock + Pricing (elevated cards) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <GoogleCard title="Stock levels" icon={<Box size={18} />} accent={GOOGLE.blue}>
                        <GoogleListRow icon={<Box size={16} />}     label="On hand"   value={fmtQty(onHand)} tone={stockTone} />
                        <GoogleListRow icon={<Archive size={16} />} label="Available" value={fmtQty(it.available_qty)} />
                        <GoogleListRow icon={<Shield size={16} />}  label="Reserved"  value={fmtQty(it.reserved_qty)} />
                        <GoogleListRow icon={<RefreshCw size={16} />} label="Reorder point" value={fmtQty(it.reorder_point)} />
                        <GoogleListRow icon={<TrendingUp size={16} />} label="Max level" value={fmtQty(it.max_stock_level)} last />
                    </GoogleCard>

                    <GoogleCard title="Pricing" icon={<DollarSign size={18} />} accent={GOOGLE.green}>
                        <GoogleListRow icon={<DollarSign size={16} />} label="Selling TTC" value={fmt(it.selling_price_ttc)} tone={GOOGLE.green} />
                        <GoogleListRow icon={<DollarSign size={16} />} label="Selling HT"  value={fmt(it.selling_price_ht)} />
                        <GoogleListRow icon={<TrendingUp size={16} />} label="Cost"        value={fmt(it.cost_price)} />
                        <GoogleListRow icon={<Tag size={16} />}        label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} />
                        {margin != null && <GoogleListRow icon={<Activity size={16} />} label="Margin" value={`${margin.toFixed(1)}%`} tone={GOOGLE.yellow} last />}
                    </GoogleCard>
                </div>

                {/* ── Per-warehouse list ── */}
                {stockByWarehouse.length > 0 && (
                    <GoogleCard title={`Warehouses (${stockByWarehouse.length})`} icon={<Warehouse size={18} />} accent={GOOGLE.blueAlt}>
                        {stockByWarehouse.slice(0, 10).map((s, i, arr) => (
                            <GoogleListRow key={s.warehouse}
                                icon={<Warehouse size={16} />}
                                label={s.warehouse_name || `Warehouse #${s.warehouse}`}
                                sublabel={s.reserved_quantity ? `${fmtQty(s.reserved_quantity)} reserved` : undefined}
                                value={fmtQty(s.quantity)}
                                last={i === arr.length - 1} />
                        ))}
                    </GoogleCard>
                )}

                {/* ── Identity card ── */}
                <GoogleCard title="Details" icon={<Tag size={18} />} accent={GOOGLE.yellow}>
                    <GoogleListRow icon={<Star size={16} />}      label="Brand"    value={String(it.brand_name || '—')} />
                    <GoogleListRow icon={<Tag size={16} />}       label="Category" value={String(it.category_name || '—')} />
                    <GoogleListRow icon={<Ruler size={16} />}     label="Unit"     value={String(it.unit_name || it.unit_code || '—')} />
                    <GoogleListRow icon={<Package size={16} />}   label="Type"     value={String(it.product_type || '—')} />
                    <GoogleListRow icon={<CheckCircle2 size={16} />} label="Status" value={it.is_active === false ? 'Inactive' : 'Active'}
                        tone={it.is_active === false ? GOOGLE.onSurfaceVariant : GOOGLE.green} last />
                </GoogleCard>

                {it.description && (
                    <div className="rounded-2xl p-5"
                         style={{ background: GOOGLE.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: GOOGLE.onSurfaceVariant }}>ABOUT</p>
                        <p className="text-base leading-relaxed whitespace-pre-line">{String(it.description)}</p>
                    </div>
                )}

                <p className="text-xs text-center pt-2" style={{ color: GOOGLE.onSurfaceVariant }}>
                    {it.updated_at && <>Updated {timeAgo(String(it.updated_at))} · </>}id {String(it.id)}
                </p>
            </div>

            {/* ── FAB (Material extended FAB) ── */}
            <button onClick={onEdit}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 flex items-center gap-2 px-5 h-14 rounded-2xl font-medium text-base transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: GOOGLE.blue, color: 'white', boxShadow: '0 3px 6px rgba(0,0,0,0.15), 0 6px 16px rgba(26,115,232,0.3)' }}>
                <Edit3 size={18} /> Edit
            </button>
        </div>
    )
}
function GoogleChip({ label, tone, bg, mono }: { label: string; tone?: string; bg?: string; mono?: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${mono ? 'font-mono' : ''}`}
              style={{ background: bg || GOOGLE.surfaceVariant, color: tone || GOOGLE.onSurface }}>
            {label}
        </span>
    )
}
function GoogleStat({ label, value, tone, bg, caption }: { label: string; value: string; tone: string; bg: string; caption?: string }) {
    return (
        <div className="rounded-2xl p-4" style={{ background: bg, color: tone }}>
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</p>
            <p className="text-2xl font-medium tabular-nums mt-1" style={{ color: tone }}>{value}</p>
            {caption && <p className="text-xs mt-0.5 opacity-70">{caption}</p>}
        </div>
    )
}
function GoogleCard({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: GOOGLE.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in srgb, #79747e 18%, transparent)' }}>
                <span style={{ color: accent }}>{icon}</span>
                <h3 className="text-base font-medium" style={{ color: GOOGLE.onSurface }}>{title}</h3>
            </div>
            <div>{children}</div>
        </div>
    )
}
function GoogleListRow({ icon, label, value, sublabel, tone, last }: { icon: React.ReactNode; label: string; value: string; sublabel?: string; tone?: string; last?: boolean }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3"
             style={{ borderBottom: last ? 'none' : '1px solid color-mix(in srgb, #79747e 12%, transparent)' }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: GOOGLE.surfaceLow, color: GOOGLE.onSurfaceVariant }}>
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: GOOGLE.onSurface }}>{label}</p>
                {sublabel && <p className="text-xs" style={{ color: GOOGLE.onSurfaceVariant }}>{sublabel}</p>}
            </div>
            <span className="text-sm font-medium tabular-nums ml-2" style={{ color: tone || GOOGLE.onSurface }}>{value}</span>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  CLAUDE VIEW — Anthropic feel
 *  ----------------------------------------------------------------
 *  Warm cream paper background, Tiempos-style serif headings in
 *  near-black, terracotta clay accent (#cc785c — Anthropic's
 *  signature color). Calm editorial rhythm — sections set off by
 *  rule lines, not card chrome. Conversational, intelligent, dense
 *  but unhurried.
 * ═════════════════════════════════════════════════════════════ */
const CLAUDE_SERIF = '"Tiempos Headline", "Tiempos Text", Georgia, "Times New Roman", serif'
const CLAUDE_SANS  = '"Untitled Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const CLAUDE = {
    paper:    '#f5f1e8',
    paperLow: '#ede7d6',
    panel:    '#faf6ee',
    ink:      '#1a1814',
    inkSoft:  '#3d3830',
    muted:    '#7c7466',
    rule:     'rgba(26,24,20,0.18)',
    clay:     '#cc785c',
    clayDeep: '#a85a40',
    clayBg:   'rgba(204,120,92,0.10)',
    sage:     '#5a7a52',
    sageBg:   'rgba(90,122,82,0.10)',
    amber:    '#b8810f',
    amberBg:  'rgba(184,129,15,0.10)',
    rust:     '#a8453a',
    rustBg:   'rgba(168,69,58,0.10)',
}

function ClaudeView({ it, stockByWarehouse, margin, stockColor: _stockColor, onBack, onEdit, onDelete }: {
    it: Record<string, any>
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    onBack: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const isOut = onHand <= 0
    const isLow = !isOut && minStock > 0 && onHand <= minStock
    const stockTone = isOut ? CLAUDE.rust : isLow ? CLAUDE.amber : CLAUDE.sage
    const stockBg   = isOut ? CLAUDE.rustBg : isLow ? CLAUDE.amberBg : CLAUDE.sageBg
    const stockText = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'

    return (
        <div className="min-h-full" style={{ background: CLAUDE.paper, color: CLAUDE.ink, fontFamily: CLAUDE_SANS }}>
            {/* ── Slim editorial top bar ── */}
            <div className="sticky top-0 z-10 px-5 md:px-10 py-3 flex items-center gap-4"
                 style={{ background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${CLAUDE.rule}` }}>
                <button onClick={onBack}
                    className="text-sm hover:underline transition-all"
                    style={{ color: CLAUDE.clay, fontFamily: CLAUDE_SERIF, fontStyle: 'italic' }}>
                    ← Back to products
                </button>
                <div className="flex-1" />
                <button onClick={onEdit}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-all hover:brightness-95"
                    style={{ background: CLAUDE.clay, color: CLAUDE.panel }}>
                    Edit
                </button>
                <button onClick={onDelete}
                    className="text-sm hover:underline" style={{ color: CLAUDE.muted }}>
                    Delete
                </button>
            </div>

            <div className="px-6 md:px-12 py-10 md:py-16 max-w-3xl mx-auto">
                {/* ── Masthead ── */}
                <p className="text-[11px] font-semibold tracking-[0.4em] uppercase mb-5" style={{ color: CLAUDE.muted }}>
                    Inventory · Product · {String(it.sku || `#${it.id}`)}
                </p>
                <h1 className="leading-[0.98] tracking-tight mb-3"
                    style={{ fontFamily: CLAUDE_SERIF, fontSize: 'clamp(2.5rem, 6vw, 4.25rem)', fontWeight: 600, color: CLAUDE.ink }}>
                    {String(it.name || `Product #${it.id}`)}
                </h1>
                {(it.brand_name || it.category_name) && (
                    <p className="text-lg italic mb-8" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.inkSoft }}>
                        {it.brand_name && <>from {String(it.brand_name)}</>}
                        {it.brand_name && it.category_name && <> · </>}
                        {it.category_name && <span style={{ color: CLAUDE.muted }}>{String(it.category_name)}</span>}
                    </p>
                )}

                {/* Status line */}
                <div className="border-t border-b py-3 mb-12 flex items-center gap-4 flex-wrap text-xs font-semibold tracking-widest uppercase"
                     style={{ borderColor: CLAUDE.rule, color: CLAUDE.muted }}>
                    <span className="px-2 py-0.5 rounded" style={{ background: stockBg, color: stockTone }}>{stockText}</span>
                    {it.unit_name && <span>{String(it.unit_name)}</span>}
                    {it.is_active === false && <span style={{ color: CLAUDE.rust }}>Inactive</span>}
                    <span className="ml-auto">id {String(it.id)}</span>
                </div>

                {/* ── The lead — selling price as headline number ── */}
                <div className="mb-14">
                    <p className="text-xs font-semibold tracking-[0.35em] uppercase mb-2" style={{ color: CLAUDE.muted }}>The number</p>
                    <div className="flex items-baseline gap-4 flex-wrap">
                        <p className="leading-none tabular-nums tracking-tight"
                           style={{ fontFamily: CLAUDE_SERIF, fontSize: 'clamp(4rem, 12vw, 8rem)', fontWeight: 600, color: CLAUDE.clay, letterSpacing: '-0.03em' }}>
                            {fmt(it.selling_price_ttc)}
                        </p>
                        <p className="text-base italic" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.inkSoft }}>
                            TTC selling price
                            {margin != null && <> · {margin.toFixed(1)}% margin over {fmt(it.cost_price)}</>}
                        </p>
                    </div>
                </div>

                {/* ── Three columns: stock facts ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14 pb-14 border-b" style={{ borderColor: CLAUDE.rule }}>
                    <ClaudeFact label="On hand"   value={fmtQty(onHand)}            caption="across all locations" tone={stockTone} />
                    <ClaudeFact label="Available" value={fmtQty(it.available_qty)}  caption="free to allocate" />
                    <ClaudeFact label="Reserved"  value={fmtQty(it.reserved_qty)}   caption="on open orders" />
                </div>

                {/* ── Pricing & Cost ladder ── */}
                <h2 className="text-2xl italic mb-4" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.ink }}>
                    Pricing
                </h2>
                <div className="mb-14">
                    <ClaudePriceRow label="Selling TTC" value={fmt(it.selling_price_ttc)} accent={CLAUDE.clay} />
                    <ClaudePriceRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                    <ClaudePriceRow label="Cost"        value={fmt(it.cost_price)} />
                    <ClaudePriceRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                    {margin != null && <ClaudePriceRow label="Margin" value={`${margin.toFixed(1)}%`} accent={CLAUDE.sage} last />}
                </div>

                {/* ── Where it lives ── */}
                {stockByWarehouse.length > 0 && (
                    <>
                        <h2 className="text-2xl italic mb-4" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.ink }}>
                            Where it lives
                        </h2>
                        <div className="mb-14">
                            {stockByWarehouse.slice(0, 8).map((s, i, arr) => (
                                <div key={s.warehouse}
                                     className="flex items-baseline justify-between py-3"
                                     style={{ borderBottom: i === arr.length - 1 ? 'none' : `1px dotted ${CLAUDE.rule}` }}>
                                    <span className="text-base" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.ink }}>
                                        {s.warehouse_name || `Warehouse #${s.warehouse}`}
                                    </span>
                                    <span className="text-2xl tabular-nums" style={{ fontFamily: CLAUDE_SERIF, fontWeight: 600, color: CLAUDE.clay }}>
                                        {fmtQty(s.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Description with drop cap ── */}
                {it.description && (
                    <>
                        <h2 className="text-2xl italic mb-4" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.ink }}>
                            About
                        </h2>
                        <p className="text-lg leading-relaxed first-letter:text-6xl first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:leading-none first-letter:mt-1"
                           style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.ink }}>
                            <span style={{ color: CLAUDE.clay }} className="first-letter:inline">{String(it.description)}</span>
                        </p>
                    </>
                )}

                <p className="text-xs italic text-center mt-20 pt-8" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.muted, borderTop: `1px solid ${CLAUDE.rule}` }}>
                    — Last updated {fmtDate(String(it.updated_at)) || 'recently'} —
                </p>
            </div>
        </div>
    )
}
function ClaudeFact({ label, value, caption, tone }: { label: string; value: string; caption: string; tone?: string }) {
    return (
        <div>
            <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: CLAUDE.muted }}>{label}</p>
            <p className="leading-none tabular-nums my-2"
               style={{ fontFamily: CLAUDE_SERIF, fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: 600, color: tone || CLAUDE.ink, letterSpacing: '-0.02em' }}>
                {value}
            </p>
            <p className="text-sm italic" style={{ fontFamily: CLAUDE_SERIF, color: CLAUDE.inkSoft }}>{caption}</p>
        </div>
    )
}
function ClaudePriceRow({ label, value, accent, muted, last }: { label: string; value: string; accent?: string; muted?: boolean; last?: boolean }) {
    return (
        <div className="flex items-baseline justify-between py-3"
             style={{ borderBottom: last ? 'none' : `1px solid ${CLAUDE.rule}` }}>
            <span className="text-base" style={{ fontFamily: CLAUDE_SERIF, color: muted ? CLAUDE.muted : CLAUDE.inkSoft, fontStyle: muted ? 'italic' : 'normal' }}>
                {label}
            </span>
            <span className="tabular-nums" style={{ fontFamily: CLAUDE_SERIF, fontSize: accent ? '1.75rem' : '1.25rem', fontWeight: accent ? 600 : 500, color: accent || CLAUDE.ink }}>
                {value}
            </span>
        </div>
    )
}


/* ═════════════════════════════════════════════════════════════
 *  LOVABLE VIEW — vibrant AI-builder feel
 *  ----------------------------------------------------------------
 *  Bright pink/purple/indigo gradient background, glassmorphism
 *  cards floating on top with backdrop blur, big rounded geometry
 *  (rounded-3xl everywhere), gradient text for the hero, vibrant
 *  CTAs with soft glow shadows. Playful but premium — the energy
 *  of a product that wants you to *make* something.
 * ═════════════════════════════════════════════════════════════ */
const LOVABLE_FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const LOVABLE = {
    grad:     'linear-gradient(135deg, #ff4f8b 0%, #a855f7 45%, #6366f1 100%)',
    gradSoft: 'linear-gradient(135deg, rgba(255,79,139,0.85), rgba(168,85,247,0.85), rgba(99,102,241,0.85))',
    pink:     '#ff4f8b',
    purple:   '#a855f7',
    indigo:   '#6366f1',
    yellow:   '#fde047',
    glassBg:  'rgba(255,255,255,0.14)',
    glassBgStrong: 'rgba(255,255,255,0.22)',
    glassBorder: 'rgba(255,255,255,0.32)',
    text:     '#ffffff',
    textSoft: 'rgba(255,255,255,0.75)',
    textMuted:'rgba(255,255,255,0.55)',
}

function LovableView({ it, stockByWarehouse, margin, stockColor: _stockColor, onBack, onEdit, onDelete }: {
    it: Record<string, any>
    stockByWarehouse: Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>
    margin: number | null
    stockColor: string
    onBack: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const isOut = onHand <= 0
    const isLow = !isOut && minStock > 0 && onHand <= minStock
    const stockText = isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'
    const stockEmoji = isOut ? '#ef4444' : isLow ? '#fde047' : '#22c55e'

    return (
        <div className="min-h-full relative overflow-hidden" style={{ background: LOVABLE.grad, color: LOVABLE.text, fontFamily: LOVABLE_FONT }}>
            {/* ── Aurora blobs for depth ── */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
                 style={{ background: LOVABLE.yellow, opacity: 0.18, transform: 'translate(150px, -150px)' }} />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
                 style={{ background: '#06b6d4', opacity: 0.18, transform: 'translate(-200px, 200px)' }} />

            {/* ── Floating glass top bar ── */}
            <div className="sticky top-0 z-10 px-4 md:px-8 py-3 flex items-center gap-3"
                 style={{ background: 'rgba(99,102,241,0.30)', backdropFilter: 'blur(20px) saturate(180%)', borderBottom: `1px solid ${LOVABLE.glassBorder}` }}>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: LOVABLE.glassBg, border: `1px solid ${LOVABLE.glassBorder}`, color: LOVABLE.text, backdropFilter: 'blur(8px)' }}>
                    <ArrowLeft size={14} /> Products
                </button>
                <div className="flex-1" />
                <button onClick={onDelete}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:brightness-110"
                    style={{ background: 'rgba(239,68,68,0.22)', border: '1px solid rgba(239,68,68,0.38)', color: '#fecaca' }}>
                    <Trash2 size={14} />
                </button>
                <button onClick={onEdit}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: 'white', color: LOVABLE.purple, boxShadow: '0 6px 20px rgba(255,255,255,0.35)' }}>
                    <Edit3 size={14} /> Edit
                </button>
            </div>

            <div className="relative px-5 md:px-10 py-8 md:py-12 max-w-5xl mx-auto space-y-5">
                {/* ── Hero glass card ── */}
                <div className="rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5"
                     style={{
                         background: LOVABLE.glassBg,
                         border: `1px solid ${LOVABLE.glassBorder}`,
                         backdropFilter: 'blur(24px) saturate(180%)',
                         boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                     }}>
                    <div className="flex-shrink-0 rounded-3xl flex items-center justify-center"
                         style={{ width: 88, height: 88, background: 'white', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={72} className="rounded-2xl" color={LOVABLE.purple} iconSize={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LOVABLE.textMuted }}>
                            {String(it.brand_name || it.category_name || 'Product')}
                        </p>
                        <h1 className="text-3xl md:text-5xl font-extrabold leading-[1.05] tracking-tight mt-1.5"
                            style={{
                                background: 'linear-gradient(135deg, #ffffff 0%, #fde047 50%, #ffffff 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                            {String(it.name || `Product #${it.id}`)}
                        </h1>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <LovableChip>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: stockEmoji }} /> {stockText}
                            </LovableChip>
                            <LovableChip>{String(it.sku || `#${it.id}`)}</LovableChip>
                            {it.barcode && <LovableChip mono>{String(it.barcode)}</LovableChip>}
                        </div>
                    </div>
                </div>

                {/* ── KPI tiles — glass with gradient accents ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <LovableTile label="Selling" value={fmt(it.selling_price_ttc)} hue="#22d3ee" caption="TTC" />
                    <LovableTile label="Cost"    value={fmt(it.cost_price)}        hue="#fde047" caption="HT" />
                    <LovableTile label="Margin"  value={margin != null ? `${margin.toFixed(0)}%` : '—'} hue="#22c55e" caption={margin != null ? 'over cost' : 'set cost'} />
                    <LovableTile label="On hand" value={fmtQty(onHand)}            hue={stockEmoji} caption={stockText} />
                </div>

                {/* ── Two glass cards: Stock + Pricing ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <LovableCard title="Stock" hue="#22d3ee">
                        <LovableRow label="On hand"   value={fmtQty(onHand)} bold />
                        <LovableRow label="Available" value={fmtQty(it.available_qty)} />
                        <LovableRow label="Reserved"  value={fmtQty(it.reserved_qty)} />
                        <LovableRow label="Reorder"   value={fmtQty(it.reorder_point)} />
                        <LovableRow label="Min · Max" value={`${fmtQty(it.min_stock_level)} · ${fmtQty(it.max_stock_level)}`} last />
                    </LovableCard>

                    <LovableCard title="Pricing" hue="#fde047">
                        <LovableRow label="Selling TTC" value={fmt(it.selling_price_ttc)} bold />
                        <LovableRow label="Selling HT"  value={fmt(it.selling_price_ht)} />
                        <LovableRow label="Cost"        value={fmt(it.cost_price)} />
                        <LovableRow label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} />
                        {margin != null && <LovableRow label="Margin" value={`${margin.toFixed(1)}%`} bold last />}
                    </LovableCard>
                </div>

                {/* ── Per-warehouse list ── */}
                {stockByWarehouse.length > 0 && (
                    <LovableCard title={`Warehouses · ${stockByWarehouse.length}`} hue="#a855f7">
                        {stockByWarehouse.slice(0, 10).map((s, i, arr) => (
                            <LovableRow key={s.warehouse}
                                label={s.warehouse_name || `Warehouse #${s.warehouse}`}
                                value={fmtQty(s.quantity)}
                                last={i === arr.length - 1} />
                        ))}
                    </LovableCard>
                )}

                {/* ── Identity ── */}
                <LovableCard title="Details" hue="#ff4f8b">
                    <LovableRow label="Brand"    value={String(it.brand_name || '—')} />
                    <LovableRow label="Category" value={String(it.category_name || '—')} />
                    <LovableRow label="Unit"     value={String(it.unit_name || it.unit_code || '—')} />
                    <LovableRow label="Type"     value={String(it.product_type || '—')} />
                    <LovableRow label="Status"   value={it.is_active === false ? 'Inactive' : 'Active'} last />
                </LovableCard>

                {it.description && (
                    <div className="rounded-3xl p-6"
                         style={{ background: LOVABLE.glassBg, border: `1px solid ${LOVABLE.glassBorder}`, backdropFilter: 'blur(24px)' }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: LOVABLE.textMuted }}>About</p>
                        <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: LOVABLE.text }}>
                            {String(it.description)}
                        </p>
                    </div>
                )}

                <p className="text-center text-xs pt-4" style={{ color: LOVABLE.textMuted }}>
                    {it.updated_at && <>Updated {timeAgo(String(it.updated_at))} · </>}id {String(it.id)}
                </p>

                <div className="h-12" />
            </div>
        </div>
    )
}
function LovableChip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${mono ? 'font-mono' : ''}`}
              style={{ background: LOVABLE.glassBgStrong, border: `1px solid ${LOVABLE.glassBorder}`, color: LOVABLE.text, backdropFilter: 'blur(8px)' }}>
            {children}
        </span>
    )
}
function LovableTile({ label, value, hue, caption }: { label: string; value: string; hue: string; caption?: string }) {
    return (
        <div className="rounded-3xl p-4 relative overflow-hidden"
             style={{
                 background: `linear-gradient(135deg, color-mix(in srgb, ${hue} 22%, transparent), ${LOVABLE.glassBg})`,
                 border: `1px solid color-mix(in srgb, ${hue} 35%, ${LOVABLE.glassBorder})`,
                 backdropFilter: 'blur(20px) saturate(180%)',
                 boxShadow: `0 8px 24px color-mix(in srgb, ${hue} 18%, transparent)`,
             }}>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: hue, boxShadow: `0 0 12px ${hue}` }} />
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: LOVABLE.textSoft }}>{label}</p>
            </div>
            <p className="text-3xl font-extrabold tabular-nums mt-2" style={{ color: LOVABLE.text, letterSpacing: '-0.02em' }}>{value}</p>
            {caption && <p className="text-xs mt-0.5" style={{ color: LOVABLE.textMuted }}>{caption}</p>}
        </div>
    )
}
function LovableCard({ title, hue, children }: { title: string; hue: string; children: React.ReactNode }) {
    return (
        <div className="rounded-3xl p-5 relative overflow-hidden"
             style={{
                 background: LOVABLE.glassBg,
                 border: `1px solid ${LOVABLE.glassBorder}`,
                 backdropFilter: 'blur(24px) saturate(180%)',
                 boxShadow: `0 12px 36px rgba(0,0,0,0.14)`,
             }}>
            <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: hue, boxShadow: `0 0 14px ${hue}` }} />
                <h3 className="text-base font-bold" style={{ color: LOVABLE.text }}>{title}</h3>
            </div>
            <div>{children}</div>
        </div>
    )
}
function LovableRow({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) {
    return (
        <div className="flex items-center justify-between py-2"
             style={{ borderBottom: last ? 'none' : `1px solid rgba(255,255,255,0.10)` }}>
            <span className="text-sm" style={{ color: LOVABLE.textSoft }}>{label}</span>
            <span className={`tabular-nums ${bold ? 'text-base font-extrabold' : 'text-sm font-semibold'}`} style={{ color: LOVABLE.text }}>
                {value}
            </span>
        </div>
    )
}

