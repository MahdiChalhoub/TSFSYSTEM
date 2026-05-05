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

import React, { useEffect, useState, useCallback, useContext } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AdminContext } from '@/context/AdminContext'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'
import { RequestFlowProvider, useRequestFlow } from '@/components/products/RequestFlowProvider'
import { ExpiryAlertDialog } from '@/components/products/ExpiryAlertDialog'
import { toast } from 'sonner'
import {
    ArrowLeft, Edit3, Trash2, Package,
    DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
    Warehouse, Tag, Layers, Star, Ruler,
    Box, Shield, Archive, RefreshCw, ArrowRightLeft, BellRing, Sliders, Truck,
    User as UserIcon, ChevronRight, Loader2, Activity, Boxes, GitBranch,
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

type PackagingRow = {
    id: number
    name: string | null
    display_name?: string | null
    barcode: string | null
    unit_name: string | null
    level: number
    ratio: number | string
    effective_selling_price?: number | string | null
    effective_purchase_price?: number | string | null
    custom_selling_price?: number | string | null
    custom_selling_price_ht?: number | string | null
    price_mode?: 'FORMULA' | 'FIXED' | string | null
    discount_pct?: number | string | null
    weight_kg?: number | string | null
    is_default_sale?: boolean
    is_default_purchase?: boolean
}

/* Pricing-source explainer — turns the opaque `effective_selling_price` into
 * a readable "where did this number come from?" string for the operator.
 *
 *   FIXED + custom set        → "Custom 0.75"
 *   FORMULA, no discount      → "Auto: base × 1"
 *   FORMULA, with discount    → "Base × 1 − 5%"
 *   No price                  → null (caller hides the chip)
 */
function pricingSource(p: PackagingRow | null, basePriceTTC: number | null, ratio: number): { label: string; tone: 'fixed' | 'formula' } | null {
    if (!p) return basePriceTTC ? { label: `Product base price`, tone: 'formula' } : null
    const mode = (p.price_mode || '').toString().toUpperCase()
    const customRaw = p.custom_selling_price != null ? Number(p.custom_selling_price) : null
    const discount = p.discount_pct != null ? Number(p.discount_pct) : 0
    if (mode === 'FIXED' || (customRaw != null && customRaw > 0)) {
        return { label: 'Custom price', tone: 'fixed' }
    }
    if (basePriceTTC && basePriceTTC > 0) {
        const formula = `Base × ${+(Number(ratio).toFixed(4))}${discount ? ` − ${+discount}%` : ''}`
        return { label: formula, tone: 'formula' }
    }
    return { label: 'Auto from formula', tone: 'formula' }
}

function useOpenInTab() {
    const ctx = useContext(AdminContext)
    return (title: string, path: string) => {
        if (ctx?.openTab) ctx.openTab(title, path)
        else window.location.assign(path)
    }
}

/* ═══════════════════════════════════════════════════════════
 *  PAGE — wraps the content in RequestFlowProvider so the quick
 *  Purchase / Transfer actions can drive the same dialog the list
 *  page uses (single source of truth for the request flow).
 * ═══════════════════════════════════════════════════════════ */
export default function ProductsDetailPage() {
    return (
        <RequestFlowProvider>
            <ProductsDetailContent />
        </RequestFlowProvider>
    )
}

function ProductsDetailContent() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const openInTab = useOpenInTab()
    const { trigger: triggerRequest } = useRequestFlow()

    const [item, setItem] = useState<Record<string, unknown> | null>(null)
    const [loading, setLoading] = useState(true)
    const [invMemberships, setInvMemberships] = useState<Record<string, unknown>[]>([])
    const [stockByWarehouse, setStockByWarehouse] = useState<Array<{ warehouse: number; warehouse_name?: string; quantity: number; reserved_quantity?: number }>>([])
    const [packagings, setPackagings] = useState<PackagingRow[]>([])
    const [packagingView, setPackagingView] = useState<'list' | 'tree' | 'pipeline'>('pipeline')
    const [showDelete, setShowDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showExpiryAlert, setShowExpiryAlert] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const data = await erpFetch(`products/${id}/`)
            setItem(data)
            const [memberships, stock, packs] = await Promise.all([
                erpFetch(`inventory/inventory-group-members/?product=${id}`).catch(() => []),
                erpFetch(`inventory/?product=${id}`).catch(() => []),
                erpFetch(`inventory/products/${id}/packaging/`).catch(() => []),
            ])
            setInvMemberships(Array.isArray(memberships) ? memberships : (memberships?.results || []))
            const stockRows = Array.isArray(stock) ? stock : (stock?.results || [])
            setStockByWarehouse(stockRows.map((r: any) => ({
                warehouse: Number(r.warehouse),
                warehouse_name: r.warehouse_name || r.warehouse_repr,
                quantity: Number(r.quantity ?? r.on_hand_qty ?? 0),
                reserved_quantity: Number(r.reserved_quantity ?? 0),
            })))
            const packRows = Array.isArray(packs) ? packs : (packs?.results || [])
            setPackagings(packRows as PackagingRow[])
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
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
            </div>
        )
    }
    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <AlertTriangle size={36} style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} className="mb-3" />
                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>Product not found</p>
                <Link href="/inventory/products" className="text-tp-xs font-bold hover:underline mt-1" style={{ color: 'var(--app-primary)' }}>
                    Back to products
                </Link>
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
        <div className="p-4 md:p-6 animate-in fade-in duration-300 space-y-4 md:space-y-5 overflow-y-auto custom-scrollbar"
             style={{ height: '100%', maxHeight: 'calc(100vh - 4rem)' }}>
            {/* ═══ Header — design-language §2 ═══ */}
            <header className="flex-shrink-0">
                <div className="flex items-start md:items-center gap-3 md:gap-4">
                    {/* Back chevron — sits beside the product icon, not above */}
                    <Link href="/inventory/products"
                          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0 hover:opacity-80"
                          style={{
                              background: 'color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--app-foreground) 10%, transparent)',
                              color: 'var(--app-muted-foreground)',
                          }}
                          title="Back to products">
                        <ArrowLeft size={15} />
                    </Link>
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={36} color="white" iconSize={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight truncate">
                                {String(it.name || `Product #${it.id}`)}
                            </h1>
                            <Badge tone={isActive ? 'var(--app-success)' : 'var(--app-error)'} label={isActive ? 'Active' : 'Inactive'} />
                            {it.product_type && (
                                <Badge tone="var(--app-info, #3b82f6)" label={String(it.product_type).replace(/_/g, ' ')} />
                            )}
                            {hasGroup && syncBadge.icon && (
                                <Badge tone={syncBadge.color} label={syncBadge.label} icon={<syncBadge.icon size={9} />} />
                            )}
                        </div>
                        <p className="text-tp-xxs font-bold uppercase tracking-widest mt-1.5"
                           style={{ color: 'var(--app-muted-foreground)' }}>
                            <span className="font-mono normal-case">{String(it.sku || `#${it.id}`)}</span>
                            {it.short_name && <> · <span className="normal-case italic">{String(it.short_name)}</span></>}
                            {it.brand_name && <> · {String(it.brand_name)}</>}
                            {it.category_name && <> · {String(it.category_name)}</>}
                            {it.unit_name && <> · {String(it.unit_name)}</>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setShowDelete(true)}
                            className="flex items-center gap-1 text-tp-xs font-bold px-2.5 py-1.5 rounded-xl transition-all"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                border: '1px solid var(--app-border)',
                                background: 'transparent',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = 'var(--app-error)'
                                e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--app-error) 30%, transparent)'
                                e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error) 8%, transparent)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = 'var(--app-muted-foreground)'
                                e.currentTarget.style.borderColor = 'var(--app-border)'
                                e.currentTarget.style.background = 'transparent'
                            }}>
                            <Trash2 size={13} />
                            <span className="hidden md:inline">Delete</span>
                        </button>
                        <button onClick={() => router.push(`/inventory/products/${id}/edit`)}
                            className="flex items-center gap-1.5 text-tp-xs font-bold text-white px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}>
                            <Edit3 size={14} />
                            <span className="hidden sm:inline">Edit Product</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══ Quick actions — same set the list page exposes per row ═══ */}
            <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
                <QuickAction
                    icon={<ShoppingCart size={12} />}
                    label="Request Purchase"
                    color="var(--app-info)"
                    onClick={() => triggerRequest('PURCHASE', [{
                        id: Number(it.id), name: String(it.name || ''), sku: String(it.sku || ''),
                        reorder_quantity: Number(it.reorder_quantity || 0),
                        min_stock_level: Number(it.min_stock_level || 0),
                        pipeline_status: it.pipeline_status as any,
                    }])} />
                <QuickAction
                    icon={<ArrowRightLeft size={12} />}
                    label="Request Transfer"
                    color="var(--app-warning)"
                    onClick={() => triggerRequest('TRANSFER', [{
                        id: Number(it.id), name: String(it.name || ''), sku: String(it.sku || ''),
                        reorder_quantity: Number(it.reorder_quantity || 0),
                        min_stock_level: Number(it.min_stock_level || 0),
                        pipeline_status: it.pipeline_status as any,
                    }])} />
                <QuickAction
                    icon={<BellRing size={12} />}
                    label="Expiry Alert"
                    color="var(--app-error)"
                    onClick={() => setShowExpiryAlert(true)} />
                <QuickAction
                    icon={<Sliders size={12} />}
                    label="Stock Adjustment"
                    color="#8b5cf6"
                    onClick={() => router.push(`/inventory/adjustments?product=${id}`)} />
            </div>

            {/* ═══ KPI Strip — design-language §4 (compact, auto-fit) ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                <KpiTile icon={<DollarSign size={14} />} color="var(--app-success)"
                    label="Selling TTC" value={fmt(it.selling_price_ttc)} />
                <KpiTile icon={<TrendingUp size={14} />} color="var(--app-primary)"
                    label="Margin" value={margin != null ? `${margin.toFixed(1)}%` : '—'} />
                <KpiTile icon={<Box size={14} />}
                    color={stockHealth === 'OUT' ? 'var(--app-error)' : stockHealth === 'LOW' ? 'var(--app-warning)' : 'var(--app-info)'}
                    label="On Hand" value={fmtQty(onHand)} />
                <KpiTile icon={<Archive size={14} />} color="var(--app-info)"
                    label="Available" value={fmtQty(it.available_qty)} />
                <KpiTile icon={<Shield size={14} />} color="#8b5cf6"
                    label="Reserved" value={fmtQty(it.reserved_qty)} />
                <KpiTile icon={<RefreshCw size={14} />} color="var(--app-warning)"
                    label="Reorder At" value={fmtQty(reorder)} />
                <KpiTile icon={<ShoppingCart size={14} />} color="var(--app-primary)"
                    label="Total Sold" value={fmtQty(totalSold)} />
                <KpiTile icon={<TrendingUp size={14} />} color="var(--app-success)"
                    label="Cost" value={fmt(it.cost_price)} />
            </div>

            {/* ═══ Stock Status — slim severity banner ═══ */}
            {(stockHealth !== 'OK' || minStock > 0) && (() => {
                const tone = stockHealth === 'OUT' ? 'var(--app-error)' : stockHealth === 'LOW' ? 'var(--app-warning)' : 'var(--app-success)'
                return (
                    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl"
                         style={{
                             background: `color-mix(in srgb, ${tone} 7%, transparent)`,
                             border: `1px solid color-mix(in srgb, ${tone} 20%, transparent)`,
                         }}>
                        {stockHealth === 'OK'
                            ? <CheckCircle2 size={14} style={{ color: tone }} className="flex-shrink-0" />
                            : <AlertTriangle size={14} style={{ color: tone }} className="flex-shrink-0" />}
                        <span className="text-tp-xs font-bold" style={{ color: tone }}>{stockLabel}</span>
                        <span className="text-tp-xs font-medium tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                            {stockHealth === 'OK' && minStock > 0 && `· ${fmtQty(onHand - minStock)} above minimum (${fmtQty(minStock)})`}
                            {stockHealth === 'LOW' && `· min ${fmtQty(minStock)} · reorder ${fmtQty(reorder)}`}
                            {stockHealth === 'OUT' && `· restock ${fmtQty(reorder || minStock || 1)} units`}
                        </span>
                        <span className="ml-auto text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            {stockByWarehouse.length} {stockByWarehouse.length === 1 ? 'location' : 'locations'}
                        </span>
                    </div>
                )
            })()}

            {/* ═══ Analytics — 3 health meters + alerts + business metrics ═══ */}
            {(() => {
                const reorderN = Number(it.reorder_point || 0)
                const minN = Number(it.min_stock_level || 0)
                const maxN = Number(it.max_stock_level || 0)
                const financialPct = reorderN > 0 ? Math.min(100, Math.round((onHand / Math.max(reorderN, 1)) * 100)) : 100
                const adjustmentPct = maxN > 0 ? Math.min(100, Math.round((onHand / maxN) * 100)) : 100
                const marginPct = margin != null ? Math.max(0, Math.min(100, Math.round(margin))) : 0
                const totalPurchases = Number(it.total_purchases ?? it.purchases_count ?? 0)
                const totalProfit = Number(it.total_profit ?? 0)
                const alerts: { icon: typeof AlertTriangle; label: string; color: string }[] = []
                if (onHand <= 0) alerts.push({ icon: AlertTriangle, label: 'Out of stock', color: 'var(--app-error)' })
                else if (minN > 0 && onHand <= minN) alerts.push({ icon: AlertTriangle, label: `Low stock — ${onHand} units (min ${minN})`, color: 'var(--app-warning)' })
                if (it.is_active === false) alerts.push({ icon: AlertTriangle, label: 'Product inactive', color: 'var(--app-muted-foreground)' })
                if (it.group_sync_status === 'BROKEN') alerts.push({ icon: AlertTriangle, label: 'Group price diverged', color: 'var(--app-error)' })
                if (reorderN > 0 && onHand <= reorderN && onHand > 0) alerts.push({ icon: ShoppingCart, label: `Below reorder — purchase ${Math.max(reorderN - onHand, 1)} units`, color: 'var(--app-warning)' })
                return (
                    <PanelCard icon={<Activity size={13} />} accent="var(--app-primary)" title="Analytics">
                        {/* Meters */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <Meter label="Financial"  value={financialPct}  tone="var(--app-primary)"          icon={<Activity size={13} />}    hint="On-hand vs reorder point" />
                            <Meter label="Adjustment" value={adjustmentPct} tone="var(--app-info, #3b82f6)"    icon={<Activity size={13} />}    hint="On-hand vs max stock" />
                            <Meter label="Margin"     value={marginPct}     tone="var(--app-success)"          icon={<TrendingUp size={13} />}  hint={margin != null ? `${margin.toFixed(1)}% over cost` : 'Set cost to compute'} />
                        </div>

                        {/* Alerts */}
                        {alerts.length > 0 && (
                            <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap"
                                 style={{
                                     background: 'color-mix(in srgb, var(--app-warning) 7%, transparent)',
                                     border: '1px solid color-mix(in srgb, var(--app-warning) 22%, transparent)',
                                 }}>
                                <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Alerts</span>
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

                        {/* Business metrics */}
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                            <p className="text-tp-xxs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--app-muted-foreground)' }}>Business metrics</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                <BizStat label="Total sold"    value={fmtQty(totalSold)}     tone="var(--app-success)" hint="Lifetime units" />
                                <BizStat label="Purchases"     value={fmtQty(totalPurchases)} tone="var(--app-warning)" hint="Distinct POs" />
                                <BizStat label="Total profit"  value={fmt(totalProfit)}      tone="#8b5cf6"             hint={margin != null ? `${margin.toFixed(1)}% margin` : '—'} />
                            </div>
                        </div>
                    </PanelCard>
                )
            })()}

            {/* ═══ 3-col widget row — auto-fit per design-language §3 ═══ */}
            <div className="flex-shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Pricing breakdown */}
                <PanelCard icon={<DollarSign size={13} />} accent="var(--app-success)" title="Pricing"
                    right={hasGroup && (
                        <button onClick={handleTogglePricingSource}
                            className="text-tp-xxs font-black uppercase tracking-wider px-2 py-0.5 rounded-md hover:brightness-110 transition-all"
                            style={{
                                background: it.pricing_source === 'GROUP'
                                    ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)'
                                    : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                color: it.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                            }}>
                            {it.pricing_source === 'GROUP' ? 'Override' : 'Follow group'}
                        </button>
                    )}>
                    <div className="space-y-1">
                        <Row label="Selling TTC" value={fmt(it.selling_price_ttc)} highlight color="text-app-success" />
                        <Row label="Selling HT"  value={fmt(it.selling_price_ht)} />
                        <Row label="Cost"        value={fmt(it.cost_price)} color="text-app-info" />
                        <Row label="VAT rate"    value={it.tva_rate != null ? `${it.tva_rate}%` : '—'} muted />
                        {margin != null && <Row label="Margin" value={`${margin.toFixed(1)}%`} highlight color="text-app-primary" />}
                        {totalProfit > 0 && <Row label="Total profit" value={fmt(totalProfit)} muted />}
                    </div>
                    {hasGroup && syncBadge.icon && (
                        <div className="mt-3 pt-2 flex items-center gap-2 text-tp-xs"
                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                            <span style={{ color: syncBadge.color }} className="flex items-center gap-1 font-bold">
                                <syncBadge.icon size={11} /> {syncBadge.label}
                            </span>
                            {it.product_group_name && (
                                <button type="button"
                                    onClick={() => openInTab(String(it.product_group_name), `/inventory/product-groups/${it.product_group}`)}
                                    className="ml-auto font-medium text-app-muted-foreground hover:text-app-foreground inline-flex items-center gap-1 truncate transition-colors">
                                    <span className="truncate max-w-[140px]">{String(it.product_group_name)}</span>
                                    <ExternalLink size={9} className="flex-shrink-0" />
                                </button>
                            )}
                        </div>
                    )}
                </PanelCard>

                {/* Stock by warehouse */}
                <PanelCard icon={<Warehouse size={13} />} accent="var(--app-info, #3b82f6)" title="Stock by Warehouse"
                    right={<span className="text-tp-xxs font-bold text-app-muted-foreground tabular-nums">{stockByWarehouse.length}</span>}>
                    {stockByWarehouse.length === 0 ? (
                        <div className="py-4 text-center">
                            <Warehouse size={20} className="text-app-muted-foreground/40 mx-auto mb-1.5" />
                            <p className="text-tp-xs font-bold text-app-muted-foreground">No warehouse data</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stockByWarehouse.slice(0, 8).map(s => {
                                const pct = (s.quantity / maxWarehouseQty) * 100
                                const reserved = Number(s.reserved_quantity ?? 0)
                                return (
                                    <div key={s.warehouse} className="space-y-1">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <span className="text-tp-xs font-medium truncate flex-1 text-app-foreground">{s.warehouse_name || `Warehouse #${s.warehouse}`}</span>
                                            <span className="text-tp-sm font-bold tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmtQty(s.quantity)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden"
                                             style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                            <div className="h-full rounded-full transition-all"
                                                 style={{ width: `${pct}%`, background: 'var(--app-info, #3b82f6)' }} />
                                        </div>
                                        {reserved > 0 && (
                                            <p className="text-tp-xxs font-medium tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {fmtQty(reserved)} reserved · {fmtQty(s.quantity - reserved)} free
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                            {stockByWarehouse.length > 8 && (
                                <p className="text-tp-xxs text-app-muted-foreground text-center pt-1">+{stockByWarehouse.length - 8} more locations</p>
                            )}
                        </div>
                    )}
                </PanelCard>

                {/* Identity & Groups */}
                <PanelCard icon={<Tag size={13} />} accent="#8b5cf6" title="Identity & Groups">
                    <div className="space-y-1">
                        {it.brand_name && (
                            <RowLink icon={<Star size={11} style={{ color: 'var(--app-warning)' }} />} label="Brand" value={String(it.brand_name)}
                                onClick={it.brand ? () => openInTab(String(it.brand_name), `/inventory/brands/${it.brand}`) : undefined} />
                        )}
                        {it.category_name && (
                            <RowLink icon={<Tag size={11} style={{ color: 'var(--app-info)' }} />} label="Category" value={String(it.category_name)}
                                onClick={it.category ? () => openInTab(String(it.category_name), `/inventory/categories?category=${it.category}`) : undefined} />
                        )}
                        {(it.unit_name || it.unit_code) && (
                            <RowLink icon={<Ruler size={11} style={{ color: 'var(--app-primary)' }} />} label="Unit" value={String(it.unit_name || it.unit_code)}
                                onClick={it.unit ? () => openInTab(String(it.unit_name || it.unit_code), `/inventory/units?unit=${it.unit}`) : undefined} />
                        )}
                        {it.barcode && <Row label="Barcode" value={String(it.barcode)} mono muted />}
                        {it.product_type && <Row label="Type" value={String(it.product_type).replace(/_/g, ' ')} muted />}
                        {it.short_name && <Row label="Short name" value={String(it.short_name)} muted />}
                    </div>

                    {/* Operational flags — pulled from create-form's Traceability & Rules. */}
                    {(it.is_for_sale != null || it.is_for_purchasing != null || it.is_serialized != null || it.is_expiry_tracked != null) && (
                        <div className="mt-3 pt-2 flex items-center gap-1.5 flex-wrap"
                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                            <p className="w-full text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-0.5 flex items-center gap-1.5">
                                <Sliders size={10} /> Operational flags
                            </p>
                            <FlagChip on={it.is_for_sale !== false} label="For sale" tone="var(--app-success)" offTone="var(--app-muted-foreground)" />
                            <FlagChip on={it.is_for_purchasing !== false} label="For purchase" tone="var(--app-info, #3b82f6)" offTone="var(--app-muted-foreground)" />
                            <FlagChip on={!!it.is_expiry_tracked} label="Expiry tracked" tone="var(--app-warning)" offTone="var(--app-muted-foreground)" />
                            <FlagChip on={!!it.is_serialized} label="Serialized (IMEI)" tone="#8b5cf6" offTone="var(--app-muted-foreground)" />
                        </div>
                    )}

                    {invMemberships.length > 0 && (
                        <div className="mt-3 pt-2"
                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                            <p className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Layers size={10} /> Inventory groups · {invMemberships.length}
                            </p>
                            <div className="space-y-0.5">
                                {invMemberships.slice(0, 4).map(m => {
                                    const mm = m as Record<string, any>
                                    const role = ROLE_BADGES[mm.substitution_role as string] || ROLE_BADGES.NOT_SUB
                                    return (
                                        <button key={mm.id as number} type="button"
                                            onClick={() => mm.group && openInTab(String(mm.group_name || `Group #${mm.group}`), `/inventory/inventory-groups/${mm.group}`)}
                                            className="w-full flex items-center gap-2 text-tp-xs px-2 py-1 rounded-lg transition-colors text-left"
                                            style={{ background: 'transparent' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                            <span className="flex-1 truncate font-medium text-app-foreground">{String(mm.group_name || `Group #${mm.group}`)}</span>
                                            <span className="text-tp-xxs font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                style={{ background: `color-mix(in srgb, ${role.color} 10%, transparent)`, color: role.color }}>
                                                {role.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </PanelCard>
            </div>

            {/* ═══ Description ═══ */}
            {it.description && (
                <PanelCard icon={<Package size={13} />} accent="var(--app-muted-foreground)" title="Description">
                    <p className="text-tp-sm leading-relaxed whitespace-pre-line text-app-foreground">{String(it.description)}</p>
                </PanelCard>
            )}

            {/* ═══ Suppliers — sourced from /products/{id}/ payload (suppliers field) ═══ */}
            {Array.isArray(it.suppliers) && it.suppliers.length > 0 && (
                <PanelCard icon={<Truck size={13} />} accent="var(--app-info, #3b82f6)"
                    title={`Suppliers · ${it.suppliers.length}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                        {it.suppliers.map((s: Record<string, any>) => (
                            <button key={String(s.id ?? s.supplier ?? s.supplier_id)} type="button"
                                onClick={() => s.supplier && openInTab(String(s.supplier_name || `Supplier #${s.supplier}`), `/contacts/${s.supplier}`)}
                                className="text-left p-3 rounded-xl transition-all"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 22%, transparent)',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, var(--app-surface))' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Truck size={13} style={{ color: 'var(--app-info, #3b82f6)' }} className="flex-shrink-0" />
                                    <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                        {String(s.supplier_name || `Supplier #${s.supplier}`)}
                                    </span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                                    {s.supplier_sku && <Row label="SKU" value={String(s.supplier_sku)} mono muted />}
                                    {s.supplier_price != null && <Row label="Price" value={fmt(s.supplier_price)} color="text-app-success" />}
                                    {s.supplier_lead_time != null && <Row label="Lead time" value={`${s.supplier_lead_time}d`} muted />}
                                </div>
                            </button>
                        ))}
                    </div>
                </PanelCard>
            )}

            {/* ═══ Attribute values (parfum, size, ...) — render when present ═══ */}
            {Array.isArray(it.attribute_values) && it.attribute_values.length > 0 && (
                <PanelCard icon={<Tag size={13} />} accent="var(--app-warning)" title="Attributes">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {it.attribute_values.map((a: Record<string, any>) => (
                            <Badge key={String(a.id)}
                                tone="var(--app-warning)"
                                label={`${a.attribute_name || a.group_name || ''}: ${a.value || a.name || ''}`.trim().replace(/^:\s*/, '')} />
                        ))}
                    </div>
                </PanelCard>
            )}

            {/* ═══ Packaging variants — three views: Pipeline · Tree · List ═══ */}
            <PanelCard icon={<Package size={13} />} accent="var(--app-warning)" title="Packaging Variants"
                right={
                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
                         style={{ background: 'color-mix(in srgb, var(--app-foreground) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                        {([
                            { id: 'pipeline', label: 'Pipeline', icon: <ArrowRightLeft size={11} /> },
                            { id: 'tree',     label: 'Tree',     icon: <GitBranch size={11} /> },
                            { id: 'list',     label: 'List',     icon: <Sliders size={11} /> },
                        ] as const).map(v => {
                            const active = packagingView === v.id
                            return (
                                <button key={v.id} type="button" onClick={() => setPackagingView(v.id)}
                                    className="flex items-center gap-1 text-tp-xxs font-bold px-2 py-1 rounded-md transition-all"
                                    style={{
                                        background: active ? 'var(--app-warning)' : 'transparent',
                                        color: active ? '#fff' : 'var(--app-muted-foreground)',
                                    }}>
                                    {v.icon}<span className="hidden sm:inline">{v.label}</span>
                                </button>
                            )
                        })}
                    </div>
                }>
                {packagingView === 'pipeline' && (
                    <PackagingPipelineView levels={packagings} baseUnitName={String(it.unit_name || it.unit_code || 'unit')} basePriceTTC={Number(it.selling_price_ttc) || 0} />
                )}
                {packagingView === 'tree' && (
                    <PackagingTreeView levels={packagings} baseUnitName={String(it.unit_name || it.unit_code || 'unit')} basePriceTTC={Number(it.selling_price_ttc) || 0} />
                )}
                {packagingView === 'list' && (
                    <ProductPackagingTab
                        productId={id}
                        productName={String(it.name || '')}
                        basePriceTTC={Number(it.selling_price_ttc) || undefined}
                        basePriceHT={Number(it.selling_price_ht) || undefined}
                        productUnitId={it.unit as number}
                    />
                )}
            </PanelCard>

            {/* ═══ Activity timeline ═══ */}
            <PanelCard icon={<History size={13} />} accent="var(--app-muted-foreground)" title="Activity">
                <ProductAuditTimeline productId={Number(id)} />
            </PanelCard>

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

            {/* Expiry alert dialog — same component the list cards open */}
            <ExpiryAlertDialog
                open={showExpiryAlert}
                onClose={() => setShowExpiryAlert(false)}
                productId={Number(it.id)}
                productName={String(it.name || `Product #${it.id}`)}
                productSku={it.sku ? String(it.sku) : null}
            />
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  Badge — small inline pill, used in hero status row
 *  FlagChip — on/off pill for operational flags (For Sale, etc)
 * ═══════════════════════════════════════════════════════════ */
function Badge({ tone, label, icon }: { tone: string; label: string; icon?: React.ReactNode }) {
    return (
        <span className="text-tp-xxs font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0"
              style={{
                  background: `color-mix(in srgb, ${tone} 10%, transparent)`,
                  color: tone,
                  border: `1px solid color-mix(in srgb, ${tone} 22%, transparent)`,
              }}>
            {icon} {label}
        </span>
    )
}
function FlagChip({ on, label, tone, offTone }: { on: boolean; label: string; tone: string; offTone: string }) {
    const c = on ? tone : offTone
    return (
        <span className="text-tp-xxs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                  background: `color-mix(in srgb, ${c} ${on ? 12 : 6}%, transparent)`,
                  color: c,
                  border: `1px solid color-mix(in srgb, ${c} ${on ? 28 : 18}%, transparent)`,
                  textDecoration: on ? 'none' : 'line-through',
                  opacity: on ? 1 : 0.7,
              }}>
            {label}
        </span>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  QuickAction — matches list page's bulk-action button style
 *  (text-[10px] font-bold, accent border 30%, hover accent bg 10%)
 * ═══════════════════════════════════════════════════════════ */
function QuickAction({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className="flex items-center gap-1.5 text-tp-xs font-bold px-2.5 py-1.5 rounded-lg transition-all"
            style={{
                color,
                border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
                background: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `color-mix(in srgb, ${color} 10%, transparent)` }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  KPI tile — matches design-language §4 (compact, auto-fit)
 * ═══════════════════════════════════════════════════════════ */
function KpiTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
             style={{
                 background: `color-mix(in srgb, ${color} 4%, var(--app-surface))`,
                 border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
             }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
                <div className="text-tp-sm font-black tabular-nums truncate" style={{ color: 'var(--app-foreground)' }}>{value}</div>
            </div>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  PanelCard — production-style container
 *  ----------------------------------------------------------
 *  Matches CategoryDetailPanel surface treatment: subtle gradient
 *  header bg, accent-tinted icon tile, inline-styled border using
 *  --app-border. No shadcn chrome, all tokens, no raw hex.
 * ═══════════════════════════════════════════════════════════ */
function PanelCard({ icon, title, accent, right, children }: {
    icon: React.ReactNode; title: string; accent: string;
    right?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl overflow-hidden"
                 style={{
                     background: 'var(--app-surface)',
                     border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
                 }}>
            <header className="px-3 py-2 flex items-center gap-2"
                    style={{
                        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 6%, var(--app-surface)), var(--app-surface))`,
                        borderBottom: `1px solid color-mix(in srgb, ${accent} 14%, transparent)`,
                    }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
                    {icon}
                </div>
                <h3 className="text-tp-sm font-bold tracking-tight flex-1 truncate" style={{ color: 'var(--app-foreground)' }}>
                    {title}
                </h3>
                {right}
            </header>
            <div className="p-3">
                {children}
            </div>
        </section>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  Helper rows
 * ═══════════════════════════════════════════════════════════ */
function Row({ label, value, color, highlight, muted, mono }: { label: string; value: string; color?: string; highlight?: boolean; muted?: boolean; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 px-2 py-1.5 rounded-lg"
             style={{ background: highlight ? `color-mix(in srgb, ${color || 'var(--app-success)'} 5%, transparent)` : 'transparent' }}>
            <span className={`text-tp-xs ${muted ? 'font-medium' : 'font-medium'}`}
                  style={{ color: muted ? 'var(--app-muted-foreground)' : 'var(--app-foreground)' }}>
                {label}
            </span>
            <span className={`tabular-nums truncate ${highlight ? 'text-tp-md font-black' : 'text-tp-sm font-bold'} ${mono ? 'font-mono' : ''} ${color || 'text-app-foreground'}`}>{value}</span>
        </div>
    )
}
function RowLink({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
    const Element = onClick ? 'button' : 'div'
    return (
        <Element type={onClick ? 'button' : undefined} onClick={onClick}
            className={`w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg transition-colors ${onClick ? 'cursor-pointer text-left' : ''}`}
            style={{ background: 'transparent' }}
            onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-border) 25%, transparent)' } : undefined}
            onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' } : undefined}>
            <span className="flex items-center gap-1.5 text-tp-xs font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                {icon}{label}
            </span>
            <span className="text-tp-sm font-bold truncate flex items-center gap-1 max-w-[60%]" style={{ color: 'var(--app-foreground)' }}>
                <span className="truncate">{value}</span>
                {onClick && <ExternalLink size={9} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }} />}
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


/* ═══════════════════════════════════════════════════════════
 *  Meter — health gauge with percent + colored fill bar
 *  BizStat — small business metric tile
 * ═══════════════════════════════════════════════════════════ */
function Meter({ label, value, tone, icon, hint }: { label: string; value: number; tone: string; icon: React.ReactNode; hint?: string }) {
    return (
        <div className="rounded-xl p-3 relative overflow-hidden"
             style={{
                 background: `color-mix(in srgb, ${tone} 4%, var(--app-surface))`,
                 border: `1px solid color-mix(in srgb, ${tone} 22%, transparent)`,
             }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: tone }}>{label}</p>
                    <p className="text-2xl font-black tabular-nums tracking-tight mt-0.5" style={{ color: 'var(--app-foreground)' }}>{value}%</p>
                    {hint && <p className="text-tp-xxs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</p>}
                </div>
                <span style={{ color: tone, opacity: 0.6 }}>{icon}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                 style={{ background: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' }}>
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} />
            </div>
        </div>
    )
}
function BizStat({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
    return (
        <div className="rounded-xl px-3 py-2"
             style={{
                 background: `color-mix(in srgb, ${tone} 4%, var(--app-surface))`,
                 border: `1px solid color-mix(in srgb, ${tone} 18%, transparent)`,
             }}>
            <p className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{label}</p>
            <p className="text-tp-md font-black tabular-nums tracking-tight" style={{ color: tone }}>{value}</p>
            {hint && <p className="text-tp-xxs truncate" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</p>}
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  PACKAGING TIER ICONS
 *  -----------------------------------------------------------
 *  Each level gets a distinct icon that grows with the tier:
 *    Level 0 (pc / base unit)  → small Box
 *    Level 1 (paquet / pack)   → Package (sealed package)
 *    Level 2 (carton)          → Boxes (multiple boxes stacked)
 *    Level 3+ (pallet)         → PalletIcon (custom SVG: stack on slats)
 * ═══════════════════════════════════════════════════════════ */
function PalletIcon({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
    // A small stack of boxes on top of horizontal pallet slats with feet.
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
             stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
             style={{ flexShrink: 0 }}>
                {/* Top row of cartons */}
                <rect x="4"  y="6"  width="7" height="7" rx="1" />
                <rect x="13" y="6"  width="7" height="7" rx="1" />
                <rect x="22" y="6"  width="6" height="7" rx="1" />
                {/* Second row */}
                <rect x="7"  y="13" width="9" height="7" rx="1" />
                <rect x="18" y="13" width="9" height="7" rx="1" />
                {/* Pallet base — top slat, gap, bottom slat */}
                <line x1="2"  y1="22" x2="30" y2="22" />
                <line x1="2"  y1="26" x2="30" y2="26" />
                {/* Feet */}
                <line x1="5"  y1="26" x2="5"  y2="29" />
                <line x1="16" y1="26" x2="16" y2="29" />
                <line x1="27" y1="26" x2="27" y2="29" />
        </svg>
    )
}
/* Tier accent — keeps a progressive color ramp by sorted index, regardless of
 * how the unit is named. pc=neutral, then info/warning/violet for tiers 1/2/3+. */
function tierAccent(idx: number): string {
    if (idx <= 0) return 'var(--app-muted-foreground)'
    if (idx === 1) return 'var(--app-info, #3b82f6)'
    if (idx === 2) return 'var(--app-warning, #f59e0b)'
    return '#8b5cf6'
}
/* Icon picker — driven by the actual unit_name keyword (pallet/carton/pack/
 * paquet/can/piece), with the tier index only used to pick a base size and
 * as a fallback. This is what fixes "Pack of 6" being drawn as a CARTON. */
function iconForPackaging(unitName: string | null | undefined, idx: number, color: string): React.ReactNode {
    const size = 22 + Math.min(idx, 3) * 4
    const u = (unitName || '').toLowerCase()
    if (/(pallet|crate|skid)/.test(u)) return <PalletIcon size={size + 2} color={color} />
    if (/(carton|box|case)/.test(u))   return <Boxes size={size} style={{ color }} />
    if (/(pack|paquet|package|bag|sachet|can|bottle|jar|tube)/.test(u))
                                        return <Package size={Math.max(16, size - 2)} style={{ color }} />
    if (/(piece|pc|unit|item|each)/.test(u) || idx === 0)
                                        return <Box size={Math.max(14, size - 6)} style={{ color }} />
    // Unknown unit name — fall back on tier index ramp so we always render *something*.
    if (idx === 1) return <Package size={Math.max(16, size - 2)} style={{ color }} />
    if (idx === 2) return <Boxes size={size} style={{ color }} />
    return <PalletIcon size={size + 2} color={color} />
}


/* ═══════════════════════════════════════════════════════════
 *  PackagingPipelineView — horizontal flow of tiers
 *  ----------------------------------------------------------
 *  Each tier card shows: icon · custom name · ratio over base ·
 *  ratio over previous tier · barcode · price. Tiers are connected
 *  by an arrow with the multiplier label.
 * ═══════════════════════════════════════════════════════════ */
function PackagingPipelineView({ levels, baseUnitName, basePriceTTC }: { levels: PackagingRow[]; baseUnitName: string; basePriceTTC: number }) {
    if (levels.length === 0) {
        return (
            <div className="text-center py-6">
                <Package size={28} className="mx-auto mb-2" style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }} />
                <p className="text-tp-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No packaging variants yet</p>
                <p className="text-tp-xs mt-1" style={{ color: 'var(--app-muted-foreground)' }}>The base unit ({baseUnitName}) is the only way this product is sold.</p>
            </div>
        )
    }
    // Sort by RATIO ascending (the natural containment chain — small fits inside big),
    // tie-break by level so two equal ratios still get a stable order. Using level as
    // the *primary* key was wrong: that field is a manual ordering, not a containment
    // index — a "pack of 6" with level=3 would be drawn after a carton with level=2
    // even though 6 < 24, breaking the chain.
    const sorted = [...levels].sort((a, b) => {
        const ra = Number(a.ratio) || 1, rb = Number(b.ratio) || 1
        if (ra !== rb) return ra - rb
        return (a.level || 0) - (b.level || 0)
    })
    // Tier index 0 = base unit; subsequent indexes are real packaging levels in
    // ratio order. We DRIVE the icon and accent off this index, not off the
    // level field, so the visual progression matches the actual chain.
    // De-dupe the synthetic "base unit" card when there's already a packaging
    // level at ratio 1. That level IS the base unit's salable form (same
    // quantity, just with SKU/barcode/price/default-sale-flag), so showing
    // both reads as a duplicate. We "absorb" it: tier 0 takes the level's
    // label/barcode/price, and the rest of the chain shifts up by one.
    const baseLevelIdx = sorted.findIndex(p => Number(p.ratio || 1) === 1)
    const baseLevel = baseLevelIdx >= 0 ? sorted[baseLevelIdx] : null
    const restLevels = baseLevel ? sorted.filter((_, i) => i !== baseLevelIdx) : sorted

    const chain: Array<{
        isBase: boolean; tier: number; label: string; unitLabel: string;
        ratio: number; barcode: string | null; price: number | null; isDefaultSale: boolean;
        priceSource: ReturnType<typeof pricingSource>;
    }> = [
        {
            isBase: true,
            tier: 0,
            label: baseLevel ? (baseLevel.display_name || baseLevel.name || baseUnitName) : baseUnitName,
            unitLabel: baseLevel ? (baseLevel.unit_name || baseUnitName) : baseUnitName,
            ratio: 1,
            barcode: baseLevel?.barcode || null,
            price: baseLevel?.effective_selling_price != null ? Number(baseLevel.effective_selling_price) : (basePriceTTC || null),
            isDefaultSale: !!baseLevel?.is_default_sale,
            priceSource: pricingSource(baseLevel, basePriceTTC, 1),
        },
        ...restLevels.map((p, i) => ({
            isBase: false, tier: i + 1,
            label: p.display_name || p.name || (p.unit_name || `Level ${i + 1}`),
            unitLabel: p.unit_name || (p.display_name || p.name || `Level ${i + 1}`),
            ratio: Number(p.ratio) || 1,
            barcode: p.barcode || null,
            price: p.effective_selling_price != null ? Number(p.effective_selling_price) : null,
            isDefaultSale: !!p.is_default_sale,
            priceSource: pricingSource(p, basePriceTTC, Number(p.ratio) || 1),
        })),
    ]
    return (
        <div className="overflow-x-auto custom-scrollbar -mx-3 px-3">
            <div className="flex items-stretch gap-2" style={{ minWidth: 'fit-content' }}>
                {chain.map((c, i) => {
                    const accent = tierAccent(c.tier)
                    const prev = i > 0 ? chain[i - 1] : null
                    const localMul = prev ? c.ratio / prev.ratio : 1
                    return (
                        <React.Fragment key={i}>
                            {/* Tier card */}
                            <div className="rounded-xl p-3 flex flex-col items-center min-w-[150px]"
                                 style={{
                                     background: `color-mix(in srgb, ${accent} 6%, var(--app-surface))`,
                                     border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
                                 }}>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1.5"
                                     style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
                                    {iconForPackaging(c.unitLabel, c.tier, accent)}
                                </div>
                                <p className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: accent }}>
                                    {c.isBase ? 'Base unit' : c.unitLabel}
                                </p>
                                <p className="text-tp-sm font-black truncate max-w-full text-center" style={{ color: 'var(--app-foreground)' }}>
                                    {c.label}
                                </p>
                                {prev && (
                                    <p className="text-tp-xxs font-bold tabular-nums mt-0.5" style={{ color: accent }}>
                                        ×{+(Number(localMul).toFixed(4))} {(prev.unitLabel || baseUnitName).toLowerCase()}
                                    </p>
                                )}
                                <p className="text-tp-xxs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {+c.ratio} {baseUnitName} total
                                </p>
                                {c.barcode && (
                                    <p className="font-mono text-tp-xxs font-bold mt-1 truncate max-w-full" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {c.barcode}
                                    </p>
                                )}
                                {c.price != null && (
                                    <p className="text-tp-sm font-black tabular-nums mt-1" style={{ color: 'var(--app-success)' }}>
                                        {fmt(c.price)}
                                    </p>
                                )}
                                {c.priceSource && c.price != null && (
                                    <p className="text-tp-xxs font-medium mt-0.5"
                                       style={{ color: c.priceSource.tone === 'fixed' ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}
                                       title={c.priceSource.tone === 'fixed' ? 'Manually set on this packaging' : 'Computed from product base price'}>
                                        {c.priceSource.label}
                                    </p>
                                )}
                                {c.isDefaultSale && (
                                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded mt-1"
                                          style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                                        Default sale
                                    </span>
                                )}
                            </div>

                            {/* Arrow connector — between every pair, not after the last */}
                            {i < chain.length - 1 && (() => {
                                const next = chain[i + 1]
                                const mul = next.ratio / c.ratio
                                return (
                                    <div className="flex flex-col items-center justify-center px-1 min-w-[52px]">
                                        <p className="text-tp-xs font-black tabular-nums" style={{ color: tierAccent(next.tier) }}>
                                            ×{+(Number(mul).toFixed(4))}
                                        </p>
                                        <ArrowRightLeft size={14} style={{ color: tierAccent(next.tier), opacity: 0.6, transform: 'scaleY(0.8)' }} />
                                    </div>
                                )
                            })()}
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  PackagingTreeView — hierarchical indented list
 *  ----------------------------------------------------------
 *  Each level renders one row with a tier icon, name, ratio,
 *  barcode, and price. Indentation grows with level so the
 *  containment relationship reads top-to-bottom.
 * ═══════════════════════════════════════════════════════════ */
function PackagingTreeView({ levels, baseUnitName, basePriceTTC }: { levels: PackagingRow[]; baseUnitName: string; basePriceTTC: number }) {
    // Sort by ratio so containment reads correctly: pc < paquet < pack of 6 <
    // carton of 24 < pallet of 144. The `level` field is unreliable as the
    // tree-depth driver — see PackagingPipelineView for the same explanation.
    const sorted = [...levels].sort((a, b) => {
        const ra = Number(a.ratio) || 1, rb = Number(b.ratio) || 1
        if (ra !== rb) return ra - rb
        return (a.level || 0) - (b.level || 0)
    })
    // Same dedupe as the pipeline view: if a packaging level has ratio 1, it
    // IS the base unit's salable form. Absorb it into tier 0 instead of
    // rendering both.
    const baseLevelIdx = sorted.findIndex(p => Number(p.ratio || 1) === 1)
    const baseLevel = baseLevelIdx >= 0 ? sorted[baseLevelIdx] : null
    const restLevels = baseLevel ? sorted.filter((_, i) => i !== baseLevelIdx) : sorted

    return (
        <div className="space-y-0.5">
            {/* Base unit row — absorbs a ratio-1 packaging level when present */}
            <PackagingTreeRow
                tier={0}
                label={baseLevel ? (baseLevel.display_name || baseLevel.name || baseUnitName) : baseUnitName}
                tierName="Base unit"
                unitLabel={baseLevel ? (baseLevel.unit_name || baseUnitName) : baseUnitName}
                ratio={1}
                localMul={null}
                parentTierName={null}
                baseUnitName={baseUnitName}
                barcode={baseLevel?.barcode || null}
                price={baseLevel?.effective_selling_price != null ? Number(baseLevel.effective_selling_price) : (basePriceTTC || null)}
                priceSource={pricingSource(baseLevel, basePriceTTC, 1)}
                isDefaultSale={!!baseLevel?.is_default_sale}
            />
            {restLevels.map((p, i) => {
                const tier = i + 1
                const ratio = Number(p.ratio) || 1
                const prevRatio = i === 0 ? 1 : (Number(restLevels[i - 1].ratio) || 1)
                const localMul = ratio / prevRatio
                const unitLabel = p.unit_name || (p.display_name || p.name || `Level ${tier}`)
                const parentUnitLabel = i === 0
                    ? (baseLevel ? (baseLevel.unit_name || baseUnitName) : baseUnitName)
                    : (restLevels[i - 1].unit_name || restLevels[i - 1].display_name || restLevels[i - 1].name || `Level ${i}`)
                return (
                    <PackagingTreeRow
                        key={p.id}
                        tier={tier}
                        label={p.display_name || p.name || unitLabel}
                        tierName={unitLabel}
                        unitLabel={unitLabel}
                        ratio={ratio}
                        localMul={localMul}
                        parentTierName={parentUnitLabel}
                        baseUnitName={baseUnitName}
                        barcode={p.barcode || null}
                        price={p.effective_selling_price != null ? Number(p.effective_selling_price) : null}
                        priceSource={pricingSource(p, basePriceTTC, ratio)}
                        isDefaultSale={!!p.is_default_sale}
                    />
                )
            })}
        </div>
    )
}
function PackagingTreeRow({ tier, label, tierName, unitLabel, ratio, localMul, parentTierName, baseUnitName, barcode, price, priceSource, isDefaultSale }: {
    tier: number; label: string; tierName: string; unitLabel: string;
    ratio: number; localMul: number | null; parentTierName: string | null; baseUnitName: string;
    barcode: string | null; price: number | null;
    priceSource: ReturnType<typeof pricingSource>;
    isDefaultSale?: boolean;
}) {
    const accent = tierAccent(tier)
    const indent = tier * 22
    return (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg transition-colors"
             style={{
                 marginLeft: indent,
                 background: 'transparent',
                 borderLeft: tier > 0 ? `2px solid color-mix(in srgb, ${accent} 35%, transparent)` : '2px solid transparent',
             }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
                {iconForPackaging(unitLabel, tier, accent)}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{label}</span>
                    <span className="text-tp-xxs font-black uppercase tracking-widest" style={{ color: accent }}>{tierName}</span>
                    {isDefaultSale && (
                        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                            Default sale
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-tp-xxs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                    {localMul != null && parentTierName ? (
                        <span className="font-bold tabular-nums">
                            <span style={{ color: accent }}>×{+(Number(localMul).toFixed(4))} {parentTierName.toLowerCase()}</span>
                            <span> · {+ratio} {baseUnitName} total</span>
                        </span>
                    ) : (
                        <span className="font-bold tabular-nums">×{+ratio} {baseUnitName}</span>
                    )}
                    {barcode && <span className="font-mono">{barcode}</span>}
                </div>
            </div>
            {price != null && (
                <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-tp-md font-black tabular-nums" style={{ color: 'var(--app-success)' }}>
                        {fmt(price)}
                    </span>
                    {priceSource && (
                        <span className="text-tp-xxs font-medium"
                              style={{ color: priceSource.tone === 'fixed' ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}
                              title={priceSource.tone === 'fixed' ? 'Manually set on this packaging' : 'Computed from product base price'}>
                            {priceSource.label}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
