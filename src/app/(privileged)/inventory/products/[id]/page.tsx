'use client'

/* ═══════════════════════════════════════════════════════════
 *  Product Detail (/inventory/products/[id])
 *  -----------------------------------------------------------
 *  Mirrors the Command Center dashboard's design rhythm so the
 *  product page reads as part of the same product, not a one-off:
 *    • Standard <Card> chrome from @/components/ui/card
 *    • Primary KPI row — 4 solid-color hero cards with white text
 *    • Secondary KPI row — 4 left-accent border cards on muted bg
 *    • 3-col widget row — Pricing breakdown · Stock by warehouse
 *      · Identity & groups
 *    • Full-width sections — Description · Packaging · Activity
 *
 *  Design tokens only (var(--app-*) and bg-app-* classes). No
 *  invented palettes, no theme switcher, no per-page chrome.
 * ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, useContext } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AdminContext } from '@/context/AdminContext'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'
import { toast } from 'sonner'
import {
    ArrowLeft, Edit3, Trash2, Package,
    DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
    Warehouse, Tag, Layers, Star, Ruler,
    Box, Shield, Archive, RefreshCw,
    User as UserIcon, ChevronRight, Loader2,
    History, ExternalLink, Link2Off, ShoppingCart,
} from 'lucide-react'

/* ─── format helpers ─── */
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
    const [stockByWarehouse, setStockByWarehouse] = useState<Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>>([])
    const [showDelete, setShowDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const data = await erpFetch(`products/${id}/`)
            setItem(data)
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
        } catch (e) {
            console.error('Failed to load product:', e)
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
        const newSource = (item as any).pricing_source === 'GROUP' ? 'LOCAL' : 'GROUP'
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
            <div className="p-6 space-y-6 bg-app-bg min-h-full">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-app-surface-2 animate-pulse" />
                    <div className="space-y-2">
                        <div className="h-6 w-64 rounded bg-app-surface-2 animate-pulse" />
                        <div className="h-3 w-48 rounded bg-app-surface-2 animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-app-surface-2 animate-pulse" />)}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-2xl bg-app-surface-2 animate-pulse" />)}</div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => <div key={i} className="h-72 rounded-2xl bg-app-surface-2 animate-pulse" />)}</div>
            </div>
        )
    }
    if (!item) {
        return (
            <div className="p-6 flex flex-col items-center justify-center gap-4 h-full bg-app-bg">
                <AlertTriangle size={26} className="text-app-error" />
                <p className="text-base font-bold">Product not found</p>
                <Link href="/inventory/products" className="text-sm font-bold text-app-primary hover:underline">Back to products</Link>
            </div>
        )
    }

    const it = item as Record<string, any>
    const onHand = Number(it.on_hand_qty || 0)
    const minStock = Number(it.min_stock_level || 0)
    const reorder = Number(it.reorder_point || 0)
    const stockHealth: 'OK' | 'LOW' | 'OUT' =
        onHand === 0 ? 'OUT' : (minStock > 0 && onHand <= minStock ? 'LOW' : 'OK')
    const margin = it.selling_price_ht && it.cost_price && Number(it.cost_price) > 0
        ? ((Number(it.selling_price_ht) - Number(it.cost_price)) / Number(it.cost_price) * 100)
        : null
    const stockLabel = stockHealth === 'OK' ? 'In stock' : stockHealth === 'LOW' ? 'Low stock' : 'Out of stock'
    const isActive = it.is_active !== false
    const hasGroup = it.product_group || it.product_group_name
    const syncBadge = SYNC_BADGES[it.group_sync_status as string] || SYNC_BADGES['N/A']
    const totalSold = Number(it.total_sold ?? it.units_sold ?? 0)
    const totalProfit = Number(it.total_profit ?? 0)
    const maxWarehouseQty = Math.max(1, ...stockByWarehouse.map(s => s.quantity))

    return (
        <div className="p-6 space-y-6 bg-app-bg min-h-full">
            {/* ═══ Header ═══ */}
            <header>
                <Link href="/inventory/products"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-muted-foreground hover:text-app-foreground transition-colors mb-4">
                    <ArrowLeft size={14} /> Back to products
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-app-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-app-primary/20">
                            <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={56} className="rounded-2xl" color="white" iconSize={28} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-3 text-xl font-black tracking-tight">
                                <span className="truncate">{String(it.name || `Product #${it.id}`)}</span>
                                <span className={`shrink-0 inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isActive ? 'text-app-success bg-app-success/10 border-app-success/20' : 'text-app-error bg-app-error/10 border-app-error/20'}`}>
                                    {isActive ? 'Active' : 'Inactive'}
                                </span>
                            </h1>
                            <p className="text-sm text-app-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                <span className="font-mono">{String(it.sku || `#${it.id}`)}</span>
                                {it.brand_name && <><span>·</span><span>{String(it.brand_name)}</span></>}
                                {it.category_name && <><span>·</span><span>{String(it.category_name)}</span></>}
                                {it.unit_name && <><span>·</span><span>{String(it.unit_name)}</span></>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => router.push(`/inventory/products/${id}/edit`)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-app-primary text-white shadow-lg shadow-app-primary/20 hover:brightness-110 transition-all">
                            <Edit3 size={14} /> Edit
                        </button>
                        <button onClick={() => setShowDelete(true)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-app-border hover:bg-app-error/10 hover:border-app-error/30 hover:text-app-error transition-colors text-app-muted-foreground">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══ Primary KPI Row ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-app-primary text-white border-0 shadow-lg shadow-app-primary/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <DollarSign size={28} className="opacity-80 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Selling TTC</p>
                                <p className="text-2xl font-black tabular-nums">{fmt(it.selling_price_ttc)}</p>
                                <p className="text-xs font-medium opacity-60 truncate">HT {fmt(it.selling_price_ht)} · VAT {it.tva_rate != null ? `${it.tva_rate}%` : '—'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-app-success text-white border-0 shadow-lg shadow-app-success/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={28} className="opacity-80 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Margin</p>
                                <p className="text-2xl font-black tabular-nums">{margin != null ? `${margin.toFixed(1)}%` : '—'}</p>
                                <p className="text-xs font-medium opacity-60 truncate">{margin != null ? `over ${fmt(it.cost_price)} cost` : 'set cost to compute'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-app-info text-white border-0 shadow-lg shadow-app-info/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <Box size={28} className="opacity-80 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">On Hand</p>
                                <p className="text-2xl font-black tabular-nums">{fmtQty(onHand)}</p>
                                <p className="text-xs font-medium opacity-60 truncate">{stockByWarehouse.length} {stockByWarehouse.length === 1 ? 'location' : 'locations'} · {fmtQty(it.available_qty)} free</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`text-white border-0 shadow-lg ${stockHealth === 'OUT' ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-app-error/10' : stockHealth === 'LOW' ? 'bg-gradient-to-br from-orange-500 to-amber-600 shadow-app-warning/10' : 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-app-accent/10'}`}>
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            {stockHealth === 'OK' ? <CheckCircle2 size={28} className="opacity-80 flex-shrink-0" /> : <AlertTriangle size={28} className="opacity-80 flex-shrink-0" />}
                            <div className="min-w-0">
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Stock Status</p>
                                <p className="text-2xl font-black">{stockLabel}</p>
                                <p className="text-xs font-medium opacity-60 truncate">
                                    {stockHealth === 'OK' && (minStock > 0 ? `${fmtQty(onHand - minStock)} above minimum` : 'no minimum set')}
                                    {stockHealth === 'LOW' && `min ${fmtQty(minStock)} · reorder ${fmtQty(reorder)}`}
                                    {stockHealth === 'OUT' && `restock ${fmtQty(reorder || minStock || 1)} units`}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Secondary KPI Row ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-app-info bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <Archive size={20} className="text-app-info flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Available</p>
                                <p className="text-lg font-black text-app-info tabular-nums">{fmtQty(it.available_qty)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-accent bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <Shield size={20} className="text-app-accent flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Reserved</p>
                                <p className="text-lg font-black text-app-accent tabular-nums">{fmtQty(it.reserved_qty)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-warning bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <RefreshCw size={20} className="text-app-warning flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Reorder Point</p>
                                <p className="text-lg font-black text-app-warning tabular-nums">{fmtQty(reorder)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-primary bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={20} className="text-app-primary flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Total Sold</p>
                                <p className="text-lg font-black text-app-primary tabular-nums">{fmtQty(totalSold)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══ 3-col widget row ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pricing breakdown */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign size={16} className="text-app-success" /> Pricing Breakdown
                            {hasGroup && (
                                <button onClick={handleTogglePricingSource}
                                    className="ml-auto text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md hover:brightness-110 transition-all"
                                    style={{
                                        background: it.pricing_source === 'GROUP'
                                            ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)'
                                            : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                        color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                                    }}>
                                    {it.pricing_source === 'GROUP' ? 'Override' : 'Follow group'}
                                </button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Row label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="text-app-success" />
                        <Row label="Selling HT"  value={fmt(it.selling_price_ht)} />
                        <Row label="Cost"        value={fmt(it.cost_price)} color="text-app-info" />
                        <Row label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                        {margin != null && <Row label="Margin" value={`${margin.toFixed(1)}%`} highlight color="text-app-primary" />}
                        {totalProfit > 0 && <Row label="Total profit" value={fmt(totalProfit)} muted />}
                        {hasGroup && syncBadge.icon && (
                            <div className="pt-2 mt-2 border-t border-app-border flex items-center gap-2 text-xs">
                                <span style={{ color: syncBadge.color }} className="flex items-center gap-1 font-bold">
                                    <syncBadge.icon size={11} /> {syncBadge.label}
                                </span>
                                {it.product_group_name && (
                                    <button type="button"
                                        onClick={() => openInTab(String(it.product_group_name), `/inventory/product-groups/${it.product_group}`)}
                                        className="ml-auto font-medium text-app-muted-foreground hover:text-app-foreground inline-flex items-center gap-1 truncate">
                                        <span className="truncate max-w-[140px]">{String(it.product_group_name)}</span>
                                        <ExternalLink size={9} className="flex-shrink-0" />
                                    </button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Stock by warehouse */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Warehouse size={16} className="text-app-info" /> Stock by Warehouse
                            <span className="ml-auto text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">{stockByWarehouse.length}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                        {stockByWarehouse.length === 0 ? (
                            <p className="text-center py-4 text-app-muted-foreground text-sm">No warehouse data</p>
                        ) : stockByWarehouse.slice(0, 8).map(s => {
                            const pct = (s.quantity / maxWarehouseQty) * 100
                            const reserved = Number(s.reserved_quantity ?? 0)
                            return (
                                <div key={s.warehouse} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium truncate flex-1 text-app-foreground">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                        <span className="font-bold text-app-info tabular-nums">{fmtQty(s.quantity)}</span>
                                    </div>
                                    <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-app-info rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    {reserved > 0 && (
                                        <p className="text-[10px] text-app-muted-foreground tabular-nums">{fmtQty(reserved)} reserved · {fmtQty(s.quantity - reserved)} free</p>
                                    )}
                                </div>
                            )
                        })}
                        {stockByWarehouse.length > 8 && (
                            <p className="text-[10px] text-app-muted-foreground text-center pt-1">+{stockByWarehouse.length - 8} more locations</p>
                        )}
                    </CardContent>
                </Card>

                {/* Identity & Groups */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Tag size={16} className="text-app-accent" /> Identity & Groups
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {it.brand_name && (
                            <RowLink icon={<Star size={11} className="text-app-warning" />} label="Brand" value={String(it.brand_name)}
                                onClick={it.brand ? () => openInTab(String(it.brand_name), `/inventory/brands/${it.brand}`) : undefined} />
                        )}
                        {it.category_name && (
                            <RowLink icon={<Tag size={11} className="text-app-info" />} label="Category" value={String(it.category_name)}
                                onClick={it.category ? () => openInTab(String(it.category_name), `/inventory/categories?category=${it.category}`) : undefined} />
                        )}
                        {(it.unit_name || it.unit_code) && (
                            <RowLink icon={<Ruler size={11} className="text-app-primary" />} label="Unit" value={String(it.unit_name || it.unit_code)}
                                onClick={it.unit ? () => openInTab(String(it.unit_name || it.unit_code), `/inventory/units?unit=${it.unit}`) : undefined} />
                        )}
                        {it.barcode && <Row label="Barcode" value={String(it.barcode)} mono muted />}
                        {invMemberships.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-app-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1.5">
                                    <Layers size={10} /> Inventory groups · {invMemberships.length}
                                </p>
                                <div className="space-y-1">
                                    {invMemberships.slice(0, 4).map(m => {
                                        const mm = m as Record<string, any>
                                        const role = ROLE_BADGES[mm.substitution_role as string] || ROLE_BADGES.NOT_SUB
                                        return (
                                            <button key={mm.id as number} type="button"
                                                onClick={() => mm.group && openInTab(String(mm.group_name || `Group #${mm.group}`), `/inventory/inventory-groups/${mm.group}`)}
                                                className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded-lg hover:bg-app-surface-2 transition-colors text-left">
                                                <span className="flex-1 truncate font-medium text-app-foreground">{String(mm.group_name || `Group #${mm.group}`)}</span>
                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
                                                    style={{ background: `color-mix(in srgb, ${role.color} 10%, transparent)`, color: role.color }}>
                                                    {role.label}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Description ═══ */}
            {it.description && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package size={16} className="text-app-muted-foreground" /> Description
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm leading-relaxed whitespace-pre-line text-app-foreground">{String(it.description)}</p>
                    </CardContent>
                </Card>
            )}

            {/* ═══ Packaging variants ═══ */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Package size={16} className="text-app-warning" /> Packaging Variants
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ProductPackagingTab
                        productId={id}
                        productName={String(it.name || '')}
                        basePriceTTC={Number(it.selling_price_ttc) || undefined}
                        basePriceHT={Number(it.selling_price_ht) || undefined}
                        productUnitId={it.unit as number}
                    />
                </CardContent>
            </Card>

            {/* ═══ Activity timeline ═══ */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <History size={16} className="text-app-muted-foreground" /> Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ProductAuditTimeline productId={Number(id)} />
                </CardContent>
            </Card>

            {/* Delete confirm */}
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

/* ═══════════════════════════════════════════════════════════
 *  Helper rows
 * ═══════════════════════════════════════════════════════════ */
function Row({ label, value, color, highlight, muted, mono }: { label: string; value: string; color?: string; highlight?: boolean; muted?: boolean; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between text-xs gap-3">
            <span className={muted ? 'text-app-muted-foreground' : 'text-app-foreground font-medium'}>{label}</span>
            <span className={`tabular-nums truncate ${highlight ? 'text-base font-black' : 'text-sm font-bold'} ${mono ? 'font-mono' : ''} ${color || 'text-app-foreground'}`}>{value}</span>
        </div>
    )
}
function RowLink({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
    const Element = onClick ? 'button' : 'div'
    return (
        <Element type={onClick ? 'button' : undefined} onClick={onClick}
            className={`w-full flex items-center justify-between text-xs gap-3 ${onClick ? 'hover:text-app-foreground transition-colors text-left cursor-pointer' : ''}`}>
            <span className="flex items-center gap-1.5 text-app-muted-foreground">{icon}{label}</span>
            <span className="font-bold truncate flex items-center gap-1 max-w-[60%] text-app-foreground">
                <span className="truncate">{value}</span>
                {onClick && <ExternalLink size={9} className="text-app-muted-foreground flex-shrink-0" />}
            </span>
        </Element>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  Audit timeline
 * ═══════════════════════════════════════════════════════════ */
type AuditFC = { field_name: string; old_value: string | null; new_value: string | null }
type AuditEntry = { id: number; action: string; timestamp: string; username?: string; field_changes?: AuditFC[] }
function actionTone(action: string) {
    const tail = (action.split('.').pop() || '').toLowerCase()
    if (tail === 'create') return { dot: 'bg-app-success', bg: 'bg-app-success/10', fg: 'text-app-success' }
    if (tail === 'delete') return { dot: 'bg-app-error',   bg: 'bg-app-error/10',   fg: 'text-app-error' }
    return                         { dot: 'bg-app-info',    bg: 'bg-app-info/10',    fg: 'text-app-info' }
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
    if (loading) return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <p className="text-sm text-app-muted-foreground py-2">Audit log isn&apos;t available on this deployment.</p>
    if (entries.length === 0) return (
        <div className="text-center py-6">
            <History size={20} className="text-app-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-app-muted-foreground">No history yet</p>
        </div>
    )
    return (
        <div className="space-y-2">
            {entries.slice(0, 30).map(e => {
                const tone = actionTone(e.action)
                const tail = (e.action.split('.').pop() || '').toLowerCase()
                return (
                    <div key={e.id} className="flex items-start gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${tone.dot}`} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${tone.bg} ${tone.fg}`}>
                                    {tail || e.action}
                                </span>
                                <span className="flex items-center gap-1 text-app-muted-foreground">
                                    <UserIcon size={10} /><span className="truncate max-w-[120px]">{e.username || 'system'}</span>
                                </span>
                                <span className="text-app-muted-foreground" title={e.timestamp}>{timeAgo(e.timestamp)}</span>
                            </div>
                            {e.field_changes && e.field_changes.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                    {e.field_changes.slice(0, 5).map((fc, i) => (
                                        <div key={i} className="text-[11px] flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono font-bold">{fc.field_name}</span>
                                            <span className="font-mono px-1 rounded text-app-muted-foreground bg-app-error/5 line-through">{fc.old_value ?? '∅'}</span>
                                            <ChevronRight size={9} className="opacity-50" />
                                            <span className="font-mono px-1 rounded bg-app-success/5">{fc.new_value ?? '∅'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
