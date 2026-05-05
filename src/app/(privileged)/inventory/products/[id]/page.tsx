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
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 space-y-4 md:space-y-5 overflow-y-auto custom-scrollbar">
            {/* ═══ Header — design-language §2 ═══ */}
            <header className="flex-shrink-0">
                <Link href="/inventory/products"
                    className="inline-flex items-center gap-1.5 text-tp-xs font-bold transition-colors mb-3 hover:opacity-70"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    <ArrowLeft size={13} /> Back to products
                </Link>

                <div className="flex items-start md:items-center gap-3 md:gap-4">
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ProductThumbnail image={it.image} productType={it.product_type} name={it.name} size={36} color="white" iconSize={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight truncate">
                                {String(it.name || `Product #${it.id}`)}
                            </h1>
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{
                                      background: `color-mix(in srgb, ${isActive ? 'var(--app-success)' : 'var(--app-error)'} 10%, transparent)`,
                                      color: isActive ? 'var(--app-success)' : 'var(--app-error)',
                                      border: `1px solid color-mix(in srgb, ${isActive ? 'var(--app-success)' : 'var(--app-error)'} 20%, transparent)`,
                                  }}>
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                            {hasGroup && syncBadge.icon && (
                                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0"
                                      style={{
                                          background: `color-mix(in srgb, ${syncBadge.color} 10%, transparent)`,
                                          color: syncBadge.color,
                                          border: `1px solid color-mix(in srgb, ${syncBadge.color} 20%, transparent)`,
                                      }}>
                                    <syncBadge.icon size={9} /> {syncBadge.label}
                                </span>
                            )}
                        </div>
                        <p className="text-tp-xxs font-bold uppercase tracking-widest mt-1.5"
                           style={{ color: 'var(--app-muted-foreground)' }}>
                            <span className="font-mono normal-case">{String(it.sku || `#${it.id}`)}</span>
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
                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
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
                    </div>
                    {invMemberships.length > 0 && (
                        <div className="mt-3 pt-2"
                             style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
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

            {/* ═══ Packaging variants ═══ */}
            <PanelCard icon={<Package size={13} />} accent="var(--app-warning)" title="Packaging Variants">
                <ProductPackagingTab
                    productId={id}
                    productName={String(it.name || '')}
                    basePriceTTC={Number(it.selling_price_ttc) || undefined}
                    basePriceHT={Number(it.selling_price_ht) || undefined}
                    productUnitId={it.unit as number}
                />
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
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  KPI tile — matches design-language §4 (compact, auto-fit)
 * ═══════════════════════════════════════════════════════════ */
function KpiTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
             style={{
                 background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                 border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
             }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
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
                     border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
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
