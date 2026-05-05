'use client'

/* ═══════════════════════════════════════════════════════════
 *  Product Detail (/inventory/products/[id])
 *
 *  Design-language §11/§12 compliant:
 *    - page-header-icon + tp-* font tokens
 *    - status pills via theme tokens (no raw hex)
 *    - confirm dialogs via shared ConfirmDialog (no native confirm)
 *    - relation context surfaced as clickable chips (Brand · Category
 *      · Unit · Group) that open as new app tabs via AdminContext —
 *      same in-app navigation pattern used in /inventory/packages
 *    - 4 tabs: Overview · Packaging · Activity · Audit (kernel
 *      audit-trail, resource_type=product, scoped to this id)
 * ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, useContext } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'
import {
    ArrowLeft, Edit3, Trash2, Package, Barcode, TrendingUp, Activity,
    Layers, Tag, CheckCircle2, AlertTriangle, RefreshCw, Link2Off, Globe,
    DollarSign, Box, Shield, Hash, ChevronRight, Loader2,
    BarChart3, Archive, Clock, User as UserIcon, Warehouse, Star, Ruler,
    History, ExternalLink,
} from 'lucide-react'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'
import { toast } from 'sonner'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AdminContext } from '@/context/AdminContext'

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

/** Open a path inside the app's tab system; falls back to plain
 *  navigation when AdminContext isn't mounted. */
function useOpenInTab() {
    const ctx = useContext(AdminContext)
    return (title: string, path: string) => {
        if (ctx?.openTab) ctx.openTab(title, path)
        else window.location.assign(path)
    }
}

type TabKey = 'overview' | 'packaging' | 'activity' | 'audit'

export default function ProductsDetailPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const openInTab = useOpenInTab()

    const [item, setItem] = useState<Record<string, unknown> | null>(null)
    const [loading, setLoading] = useState(true)
    const [invMemberships, setInvMemberships] = useState<Record<string, unknown>[]>([])
    const [activeTab, setActiveTab] = useState<TabKey>('overview')
    const [showDelete, setShowDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const data = await erpFetch(`products/${id}/`)
            setItem(data)
            try {
                const memberships = await erpFetch(`inventory/inventory-group-members/?product=${id}`)
                setInvMemberships(Array.isArray(memberships) ? memberships : (memberships?.results || []))
            } catch { setInvMemberships([]) }
        } catch (error) {
            console.error('Failed to load product:', error)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { loadData() }, [loadData])

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                </div>
                <div className="text-center">
                    <p className="text-tp-md font-bold text-app-foreground">Loading product</p>
                    <p className="text-tp-xs text-app-muted-foreground mt-1">Fetching product details…</p>
                </div>
            </div>
        )
    }

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                     style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)' }}>
                    <AlertTriangle size={26} style={{ color: 'var(--app-error)' }} />
                </div>
                <p className="text-tp-md font-bold text-app-foreground">Product not found</p>
                <button onClick={() => router.back()}
                    className="text-tp-xs font-bold hover:underline" style={{ color: 'var(--app-primary)' }}>Go back</button>
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
        <div className="h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
            <div className="px-4 md:px-6 py-5 space-y-5 max-w-[1400px] mx-auto">

                {/* ─── Header ─────────────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <Link href="/inventory/products"
                            className="w-9 h-9 rounded-xl flex items-center justify-center border border-app-border hover:bg-app-surface hover:border-app-primary/30 transition-all shrink-0 mt-1"
                            title="Back to Products">
                            <ArrowLeft size={16} className="text-app-muted-foreground" />
                        </Link>
                        <div className="page-header-icon flex-shrink-0"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <ProductThumbnail
                                image={it.image as string}
                                productType={it.product_type as string}
                                name={it.name as string}
                                size={40}
                                className="rounded-xl"
                                color="white"
                                iconSize={20}
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                                Product · <span className="font-mono">{it.sku || `#${it.id}`}</span>
                            </p>
                            <h1 className="text-lg md:text-xl font-black tracking-tight text-app-foreground truncate">
                                {it.name || `Product #${it.id}`}
                            </h1>
                            {it.description && (
                                <p className="text-tp-sm text-app-muted-foreground mt-0.5 line-clamp-1 max-w-xl">{it.description}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusPill
                            label={isActive ? 'Active' : 'Inactive'}
                            color={isActive ? 'var(--app-success)' : 'var(--app-error)'}
                        />
                        {hasGroup && syncBadge.icon && (
                            <StatusPill label={syncBadge.label} color={syncBadge.color} icon={<syncBadge.icon size={10} />} />
                        )}
                        <StatusPill label={stockLabel} color={stockColor} />
                        <div className="w-px h-6 bg-app-border mx-1 hidden md:block" />
                        <Link href={`/inventory/products/${id}/edit`}
                            className="flex items-center gap-1.5 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Edit3 size={13} /> Edit
                        </Link>
                        <button onClick={() => setShowDelete(true)}
                            className="flex items-center gap-1.5 text-tp-xs font-bold px-2.5 py-1.5 rounded-xl transition-all border"
                            style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                            <Trash2 size={13} /> Delete
                        </button>
                    </div>
                </header>

                {/* ─── Relation chain ─────────────────────────────
                    Surfaces the entity context of this product as
                    clickable chips. Each chip opens the linked entity
                    in a new app tab via AdminContext, keeping the
                    operator inside our navigation shell. */}
                <div className="rounded-xl px-3 py-2 overflow-x-auto custom-scrollbar"
                     style={{ background: 'color-mix(in srgb, var(--app-foreground) 3%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                    <div className="flex items-center gap-1.5 min-w-max">
                        {it.brand_name && (
                            <ChainChip icon={<Star size={10} />} label="Brand" value={String(it.brand_name)}
                                accent="var(--app-warning, #f59e0b)"
                                onClick={it.brand ? () => openInTab(String(it.brand_name), `/inventory/brands/${it.brand}`) : undefined} />
                        )}
                        {it.category_name && (
                            <>
                                {it.brand_name && <ChainArrow />}
                                <ChainChip icon={<Tag size={10} />} label="Category" value={String(it.category_name)}
                                    accent="var(--app-info, #3b82f6)"
                                    onClick={it.category ? () => openInTab(String(it.category_name), `/inventory/categories?category=${it.category}`) : undefined} />
                            </>
                        )}
                        {(it.unit_name || it.unit_code) && (
                            <>
                                {(it.brand_name || it.category_name) && <ChainArrow />}
                                <ChainChip icon={<Ruler size={10} />} label="Unit" value={String(it.unit_name || it.unit_code)}
                                    sub={it.unit_short_name as string | undefined}
                                    accent="var(--app-primary)"
                                    onClick={it.unit ? () => openInTab(String(it.unit_name || it.unit_code), `/inventory/units?unit=${it.unit}`) : undefined} />
                            </>
                        )}
                        {(it.product_type || it.type) && (
                            <>
                                <ChainArrow />
                                <ChainChip icon={<Layers size={10} />} label="Type" value={String(it.product_type || it.type)}
                                    accent="var(--app-muted-foreground)" />
                            </>
                        )}
                    </div>
                </div>

                {/* ─── KPI strip ──────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <Kpi label="Selling TTC"  value={fmt(it.selling_price_ttc)} color="var(--app-success)" icon={<DollarSign size={14} />} />
                    <Kpi label="Cost"         value={fmt(it.cost_price)}        color="var(--app-info)"    icon={<TrendingUp size={14} />} />
                    {margin !== null && (
                        <Kpi label="Margin" value={`${margin.toFixed(1)}%`} color="var(--app-primary)" icon={<BarChart3 size={14} />} />
                    )}
                    <Kpi label="On hand"      value={fmtQty(it.on_hand_qty)}    color={stockColor}         icon={<Box size={14} />} />
                    <Kpi label="Available"    value={fmtQty(it.available_qty)}  color="var(--app-primary)" icon={<Archive size={14} />} />
                    <Kpi label="Reserved"     value={fmtQty(it.reserved_qty)}   color="var(--app-accent)"  icon={<Shield size={14} />} />
                </div>

                {/* ─── Tab bar ──────────────────────────────── */}
                <div className="flex items-center gap-1 border-b border-app-border/40 -mx-4 md:-mx-6 px-4 md:px-6">
                    {([
                        { key: 'overview',  label: 'Overview',  icon: BarChart3 },
                        { key: 'packaging', label: 'Packaging', icon: Package },
                        { key: 'activity',  label: 'Activity',  icon: Activity },
                        { key: 'audit',     label: 'Audit',     icon: History },
                    ] as { key: TabKey; label: string; icon: typeof BarChart3 }[]).map(t => {
                        const Icon = t.icon
                        const active = activeTab === t.key
                        return (
                            <button key={t.key} onClick={() => setActiveTab(t.key)}
                                className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-2.5 -mb-px transition-all"
                                style={{
                                    color: active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                    borderBottom: active ? '2px solid var(--app-primary)' : '2px solid transparent',
                                }}>
                                <Icon size={13} /> {t.label}
                            </button>
                        )
                    })}
                </div>

                {/* ─── Tab: Overview ──────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-in fade-in duration-200">

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card icon={<Package size={14} style={{ color: 'var(--app-primary)' }} />} title="Product details">
                                <KvRow label="SKU"       value={it.sku} icon={Hash} mono />
                                <KvRow label="Barcode"   value={it.barcode} icon={Barcode} mono />
                                <KvRow label="Category"  value={it.category_name} icon={Tag} />
                                <KvRow label="Brand"     value={it.brand_name} icon={Star} />
                                <KvRow label="Unit"      value={it.unit_name} icon={Box} />
                                <KvRow label="Type"      value={it.product_type || it.type} icon={Layers} />
                                <KvRow label="Weight"    value={it.weight ? `${it.weight} ${it.weight_unit || 'kg'}` : null} icon={Activity} />
                            </Card>

                            <Card
                                icon={<DollarSign size={14} style={{ color: 'var(--app-success)' }} />}
                                title="Pricing"
                                rightSlot={hasGroup && (
                                    <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                        style={{
                                            background: it.pricing_source === 'GROUP' ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)' : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                            color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                                        }}>
                                        {it.pricing_source === 'GROUP' ? 'Group price' : 'Local price'}
                                    </span>
                                )}>
                                <PriceRow label="Selling price TTC" value={fmt(it.selling_price_ttc)} bold color="var(--app-success)" />
                                <PriceRow label="Selling price HT"  value={fmt(it.selling_price_ht)} />
                                <PriceRow label="Cost price"        value={fmt(it.cost_price)} color="var(--app-info)" />
                                <PriceRow label="VAT rate"          value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} color="var(--app-muted-foreground)" />
                                {margin !== null && (
                                    <PriceRow label="Margin" value={`${margin.toFixed(1)}%`} bold color="var(--app-primary)" subtle />
                                )}
                                {hasGroup && (
                                    <div className="px-4 py-2.5 border-t border-app-border/50 flex items-center justify-between gap-2">
                                        <span className="text-tp-xxs text-app-muted-foreground">
                                            {it.pricing_source === 'GROUP' ? 'Following the group — switch to local?' : 'Using local price — follow the group?'}
                                        </span>
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
                                    </div>
                                )}
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card
                                icon={<Warehouse size={14} style={{ color: stockColor }} />}
                                title="Stock levels"
                                rightSlot={
                                    <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                                        style={{ background: `color-mix(in srgb, ${stockColor} 10%, transparent)`, color: stockColor }}>
                                        {stockLabel}
                                    </span>
                                }>
                                <PriceRow label="On hand"          value={fmtQty(it.on_hand_qty)} color={stockColor} />
                                <PriceRow label="Reserved"         value={fmtQty(it.reserved_qty)} color="var(--app-accent)" />
                                <PriceRow label="Available"        value={fmtQty(it.available_qty)} color="var(--app-primary)" />
                                <PriceRow label="Min stock level"  value={fmtQty(it.min_stock_level)} color="var(--app-muted-foreground)" />
                                <PriceRow label="Max stock level"  value={fmtQty(it.max_stock_level)} color="var(--app-muted-foreground)" />
                                <PriceRow label="Reorder point"    value={fmtQty(it.reorder_point)}   color="var(--app-warning)" />
                            </Card>

                            <Card icon={<Tag size={14} style={{ color: 'var(--app-primary)' }} />} title="Pricing group">
                                {hasGroup ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => it.product_group && openInTab(String(it.product_group_name || `Group #${it.product_group}`), `/inventory/product-groups/${it.product_group}`)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-app-bg/40 transition-colors text-left">
                                            <span className="text-tp-xs font-bold text-app-muted-foreground">Group</span>
                                            <span className="flex items-center gap-1 text-tp-md font-bold" style={{ color: 'var(--app-primary)' }}>
                                                {String(it.product_group_name || `Group #${it.product_group}`)}
                                                <ChevronRight size={12} />
                                            </span>
                                        </button>
                                        <PriceRow label="Price source" value={it.pricing_source === 'GROUP' ? 'Group' : 'Local'} />
                                        <div className="flex items-center justify-between px-4 py-2.5">
                                            <span className="text-tp-xs font-bold text-app-muted-foreground">Sync status</span>
                                            <span className="flex items-center gap-1.5 text-tp-xxs font-black uppercase px-2 py-0.5 rounded-lg"
                                                style={{ background: `color-mix(in srgb, ${syncBadge.color} 10%, transparent)`, color: syncBadge.color }}>
                                                {syncBadge.icon && <syncBadge.icon size={10} />} {syncBadge.label}
                                            </span>
                                        </div>
                                        {it.group_expected_price && (
                                            <PriceRow
                                                label="Expected price"
                                                value={fmt(it.group_expected_price)}
                                                color={Number(it.selling_price_ttc) !== Number(it.group_expected_price) ? 'var(--app-error)' : 'var(--app-success)'}
                                            />
                                        )}
                                        {it.group_sync_status === 'BROKEN' && it.group_broken_since && (
                                            <div className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-tp-xxs font-bold px-3 py-2 rounded-xl"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', color: 'var(--app-error)' }}>
                                                    <AlertTriangle size={12} />
                                                    Price diverged since {fmtDate(String(it.group_broken_since))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <EmptyState icon={<Tag size={24} />} title="Not in a pricing group" hint="Assign from the Product Groups page" />
                                )}
                            </Card>

                            <Card
                                icon={<Layers size={14} style={{ color: 'var(--app-info)' }} />}
                                title="Inventory groups"
                                rightSlot={invMemberships.length > 0 && (
                                    <span className="text-tp-xxs font-black text-app-muted-foreground px-2 py-0.5 rounded-md"
                                        style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                                        {invMemberships.length} group{invMemberships.length === 1 ? '' : 's'}
                                    </span>
                                )}>
                                {invMemberships.length > 0 ? (
                                    <div className="p-3 space-y-2">
                                        {invMemberships.map(m => {
                                            const mm = m as Record<string, any>
                                            const roleBadge = ROLE_BADGES[mm.substitution_role as string] || ROLE_BADGES.NOT_SUB
                                            return (
                                                <button key={mm.id as number} type="button"
                                                    onClick={() => mm.group && openInTab(String(mm.group_name || `Group #${mm.group}`), `/inventory/inventory-groups/${mm.group}`)}
                                                    className="w-full px-3 py-2.5 rounded-xl border border-app-border/40 hover:border-app-border transition-all text-left"
                                                    style={{ background: 'var(--app-bg)' }}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-tp-sm font-bold text-app-foreground">{String(mm.group_name || `Group #${mm.group}`)}</span>
                                                        <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-0.5 rounded-lg"
                                                            style={{ background: `color-mix(in srgb, ${roleBadge.color} 10%, transparent)`, color: roleBadge.color }}>
                                                            {roleBadge.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-tp-xxs text-app-muted-foreground">
                                                        <span className="font-bold" style={{ color: 'var(--app-info)' }}>Priority {mm.substitution_priority}</span>
                                                        {mm.origin_label && <span className="flex items-center gap-1"><Globe size={9} /> {String(mm.origin_label)}</span>}
                                                    </div>
                                                    {mm.notes && <p className="text-tp-xxs text-app-muted-foreground/70 mt-1.5 italic">{String(mm.notes)}</p>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <EmptyState icon={<Layers size={24} />} title="Not in any inventory group" hint="Add from the Inventory Groups page" />
                                )}
                            </Card>
                        </div>

                        {it.description && (
                            <Card icon={<Activity size={14} style={{ color: 'var(--app-muted-foreground)' }} />} title="Description">
                                <div className="px-4 py-3">
                                    <p className="text-tp-sm text-app-foreground leading-relaxed whitespace-pre-line">{String(it.description)}</p>
                                </div>
                            </Card>
                        )}

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-tp-xxs text-app-muted-foreground font-bold px-2 pb-4">
                            {it.created_at && <span className="flex items-center gap-1.5"><Clock size={10} /> Created {fmtDate(String(it.created_at))}</span>}
                            {it.updated_at && <span className="flex items-center gap-1.5"><RefreshCw size={10} /> Updated {fmtDate(String(it.updated_at))}</span>}
                            {it.created_by_name && <span className="flex items-center gap-1.5"><UserIcon size={10} /> {String(it.created_by_name)}</span>}
                            <span className="font-mono opacity-50">ID: {String(it.id)}</span>
                        </div>
                    </div>
                )}

                {activeTab === 'packaging' && (
                    <Card icon={<Package size={14} style={{ color: 'var(--app-warning)' }} />} title="Product packaging">
                        <div className="p-4">
                            <ProductPackagingTab
                                productId={id}
                                productName={String(it.name || '')}
                                basePriceTTC={it.selling_price_ttc as string}
                                basePriceHT={it.selling_price_ht as string}
                                productUnitId={it.unit as number}
                            />
                        </div>
                    </Card>
                )}

                {activeTab === 'activity' && (
                    <Card icon={<Activity size={14} style={{ color: 'var(--app-accent)' }} />} title="Activity log">
                        <EmptyState
                            icon={<Activity size={28} />}
                            title="Activity tracking coming soon"
                            hint="Stock movements, price changes, and order history will surface here." />
                    </Card>
                )}

                {activeTab === 'audit' && (
                    <Card icon={<History size={14} style={{ color: 'var(--app-muted-foreground)' }} />} title="Audit history">
                        <ProductAuditTimeline productId={Number(id)} />
                    </Card>
                )}
            </div>

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


/* ─── Reusable bits ─── */

function Card({ icon, title, rightSlot, children }: { icon: React.ReactNode; title: string; rightSlot?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-app-border overflow-hidden"
            style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
            <div className="px-5 py-2.5 border-b border-app-border flex items-center gap-2"
                style={{ background: 'var(--app-bg)' }}>
                {icon}
                <span className="text-tp-xs font-black text-app-foreground uppercase tracking-widest">{title}</span>
                {rightSlot && <span className="ml-auto">{rightSlot}</span>}
            </div>
            <div className="divide-y divide-app-border/40">{children}</div>
        </div>
    )
}

function KvRow({ label, value, icon: Icon, mono }: { label: string; value: unknown; icon?: typeof Hash; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between px-5 py-2.5 hover:bg-app-bg/40 transition-colors">
            <span className="text-tp-xs font-bold text-app-muted-foreground flex items-center gap-2">
                {Icon && <Icon size={12} />} {label}
            </span>
            <span className={`text-tp-sm font-bold text-app-foreground truncate ml-3 ${mono ? 'font-mono' : ''}`}>{String(value || '—')}</span>
        </div>
    )
}

function PriceRow({ label, value, color, bold, subtle }: { label: string; value: React.ReactNode; color?: string; bold?: boolean; subtle?: boolean }) {
    return (
        <div className={`flex items-center justify-between px-5 py-2.5 hover:bg-app-bg/30 transition-colors ${subtle ? '' : ''}`}
             style={subtle ? { background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)' } : undefined}>
            <span className="text-tp-xs font-bold text-app-muted-foreground">{label}</span>
            <span className={`text-tp-md tabular-nums ${bold ? 'font-black' : 'font-bold'}`} style={{ color: color || 'var(--app-foreground)' }}>{value}</span>
        </div>
    )
}

function StatusPill({ label, color, icon }: { label: string; color: string; icon?: React.ReactNode }) {
    return (
        <span className="text-tp-xxs font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl flex items-center gap-1"
            style={{
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                color, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
            }}>
            {icon} {label}
        </span>
    )
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>{icon}</div>
            <div className="min-w-0">
                <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">{label}</div>
                <div className="text-tp-md font-black text-app-foreground tabular-nums tracking-tight">{value}</div>
            </div>
        </div>
    )
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
            <div className="opacity-30 mb-3">{icon}</div>
            <p className="text-tp-sm font-bold text-app-muted-foreground">{title}</p>
            {hint && <p className="text-tp-xs text-app-muted-foreground/70 mt-1 max-w-[280px]">{hint}</p>}
        </div>
    )
}

/* ─── Relation chain ─── */
function ChainChip({ icon, label, value, sub, accent, onClick }: {
    icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; onClick?: () => void
}) {
    const Element = onClick ? 'button' : 'div'
    return (
        <Element type={onClick ? 'button' : undefined} onClick={onClick}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-left ${onClick ? 'hover:brightness-110 active:scale-[0.97] cursor-pointer transition-all' : ''}`}
            style={{
                background: `color-mix(in srgb, ${accent} 8%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
                color: accent,
            }}
            title={`${label}: ${value}${sub ? ` (${sub})` : ''}`}>
            <span className="flex-shrink-0">{icon}</span>
            <span className="flex flex-col leading-tight">
                <span className="text-tp-xxs font-bold uppercase tracking-widest opacity-70">{label}</span>
                <span className="text-tp-xs font-bold text-app-foreground truncate max-w-[160px]">{value}</span>
                {sub && <span className="text-tp-xxs font-mono opacity-60 truncate max-w-[160px]">{sub}</span>}
            </span>
            {onClick && <ExternalLink size={9} className="opacity-50 ml-1" />}
        </Element>
    )
}
function ChainArrow() {
    return <span className="flex items-center text-app-muted-foreground"><ChevronRight size={12} /></span>
}


/* ─── Audit timeline (kernel audit-trail, scoped to this product) ─── */
type AuditFC = { field_name: string; old_value: string | null; new_value: string | null }
type AuditEntry = { id: number; action: string; timestamp: string; username?: string; field_changes?: AuditFC[] }
function timeAgo(ts: string) {
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
    if (loading) return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <div className="px-5 py-6 text-tp-sm text-app-muted-foreground text-center">Audit log isn&apos;t available on this deployment.</div>
    if (entries.length === 0) return (
        <EmptyState icon={<History size={24} />} title="No history yet" hint="Edits to this product will show up here — who changed what, when." />
    )
    return (
        <div className="p-3 space-y-2">
            <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                {entries.length} event{entries.length === 1 ? '' : 's'} · most recent first
            </p>
            {entries.map(e => {
                const tone = actionTone(e.action)
                const tail = (e.action.split('.').pop() || '').toLowerCase()
                return (
                    <div key={e.id} className="rounded-xl p-2.5 space-y-1.5"
                         style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
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
                )
            })}
        </div>
    )
}
