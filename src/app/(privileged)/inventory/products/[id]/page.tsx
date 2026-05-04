'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'
import {
  ArrowLeft, Edit3, Trash2, Package, Barcode, TrendingUp, Activity,
  Layers, Tag, CheckCircle2, AlertTriangle, RefreshCw, Link2Off, Globe,
  DollarSign, Box, Shield, Hash, ChevronRight, Loader2,
  BarChart3, ShoppingCart, Archive, Clock, User, Warehouse, Star
} from 'lucide-react'
import ProductPackagingTab from '@/components/inventory/ProductPackagingTab'
import { toast } from 'sonner'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'

/* ═══════════════════════════════════════════════════════════
 *  SYNC & ROLE BADGE CONFIGS
 * ═══════════════════════════════════════════════════════════ */
const SYNC_BADGES: Record<string, { label: string; icon: any; color: string }> = {
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

function fmt(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(v: any) {
  if (v == null) return '—'
  return Number(v).toLocaleString()
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function ProductsDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [invMemberships, setInvMemberships] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'packaging' | 'activity'>('overview')

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

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return
    try {
      await erpFetch(`products/${id}/`, { method: 'DELETE' })
      toast.success('Product deleted')
      router.push('/inventory/products')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product')
    }
  }

  async function handleTogglePricingSource() {
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
    } catch (e: any) {
      toast.error(e.message || 'Failed to update pricing source')
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-app-primary/10 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-app-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-app-foreground">Loading Product</p>
          <p className="text-[10px] text-app-muted-foreground mt-1">Fetching product details…</p>
        </div>
      </div>
    )
  }

  /* ── Not Found ── */
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-in fade-in duration-300">
        <div className="w-14 h-14 rounded-2xl bg-app-error/10 flex items-center justify-center">
          <AlertTriangle size={26} style={{ color: 'var(--app-error)' }} />
        </div>
        <p className="text-sm font-black text-app-foreground">Product not found</p>
        <button onClick={() => router.back()}
          className="text-[11px] font-bold text-app-primary hover:underline">Go Back</button>
      </div>
    )
  }

  const syncBadge = SYNC_BADGES[item.group_sync_status] || SYNC_BADGES['N/A']
  const hasGroup = item.product_group || item.product_group_name
  const isActive = item.is_active !== false

  // Stock health
  const onHand = Number(item.on_hand_qty || 0)
  const minStock = Number(item.min_stock_level || 0)
  const stockHealth = minStock > 0 && onHand <= minStock ? 'LOW' : onHand === 0 ? 'OUT' : 'OK'
  const stockColor = stockHealth === 'OK' ? 'var(--app-success)' : stockHealth === 'LOW' ? 'var(--app-warning)' : 'var(--app-error)'

  return (
    <div className="h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
      <div className="px-4 md:px-6 py-5 space-y-5">

        {/* ═══════ HEADER ═══════ */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/inventory/products"
              className="w-9 h-9 rounded-xl flex items-center justify-center border border-app-border hover:bg-app-surface hover:border-app-primary/30 transition-all group shrink-0"
              title="Back to Products">
              <ArrowLeft size={16} className="text-app-muted-foreground group-hover:text-app-primary transition-colors" />
            </Link>
            <ProductThumbnail
              image={item.image}
              productType={item.product_type}
              name={item.name}
              size={56}
              className="rounded-2xl"
              color="var(--app-primary)"
              iconSize={26}
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                Product · {item.sku || `#${item.id}`}
              </p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                {item.name || `Product #${item.id}`}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status */}
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
              style={{
                background: isActive ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                color: isActive ? 'var(--app-success)' : 'var(--app-error)',
                border: `1px solid color-mix(in srgb, ${isActive ? 'var(--app-success)' : 'var(--app-error)'} 25%, transparent)`,
              }}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            {/* Sync Badge */}
            {hasGroup && syncBadge.icon && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl flex items-center gap-1"
                style={{
                  background: `color-mix(in srgb, ${syncBadge.color} 10%, transparent)`,
                  color: syncBadge.color,
                  border: `1px solid color-mix(in srgb, ${syncBadge.color} 25%, transparent)`,
                }}>
                <syncBadge.icon size={10} /> {syncBadge.label}
              </span>
            )}
            <div className="w-px h-6 bg-app-border mx-1 hidden md:block" />
            <Link href={`/inventory/products/${id}/edit`}
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
              <Edit3 size={13} /> Edit
            </Link>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all border"
              style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </header>

        {/* ═══════ KPI STRIP ═══════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {[
            { label: 'Selling TTC', value: fmt(item.selling_price_ttc), color: 'var(--app-success)', icon: <DollarSign size={14} /> },
            { label: 'Cost Price', value: fmt(item.cost_price), color: 'var(--app-info)', icon: <TrendingUp size={14} /> },
            { label: 'On Hand', value: fmtQty(item.on_hand_qty), color: stockColor, icon: <Box size={14} /> },
            { label: 'Available', value: fmtQty(item.available_qty), color: 'var(--app-primary)', icon: <Archive size={14} /> },
            { label: 'Reserved', value: fmtQty(item.reserved_qty), color: 'var(--app-accent)', icon: <Shield size={14} /> },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
              style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{s.label}</div>
                <div className="text-sm font-black text-app-foreground tabular-nums tracking-tight">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════ TAB BAR ═══════ */}
        <div className="flex items-center gap-1">
          {[
            { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
            { key: 'packaging' as const, label: 'Packaging', icon: Package },
            { key: 'activity' as const, label: 'Activity', icon: Activity },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl transition-all ${active
                  ? 'bg-app-surface border border-app-border text-app-foreground shadow-sm'
                  : 'text-app-muted-foreground hover:text-app-foreground border border-transparent'
                }`}>
                <Icon size={13} /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* ═══════ TAB: OVERVIEW ═══════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in duration-300">

            {/* ── Product Details + Pricing ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Product Details Card */}
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <Package size={14} style={{ color: 'var(--app-primary)' }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Product Details</span>
                </div>
                <div className="divide-y divide-app-border/40">
                  {[
                    { label: 'SKU', value: item.sku, icon: Hash, mono: true },
                    { label: 'Barcode', value: item.barcode, icon: Barcode, mono: true },
                    { label: 'Category', value: item.category_name, icon: Tag },
                    { label: 'Brand', value: item.brand_name, icon: Star },
                    { label: 'Unit', value: item.unit_name, icon: Box },
                    { label: 'Type', value: item.product_type || item.type, icon: Layers },
                    { label: 'Weight', value: item.weight ? `${item.weight} ${item.weight_unit || 'kg'}` : null, icon: Activity },
                  ].map(f => {
                    const Icon = f.icon
                    return (
                      <div key={f.label} className="flex items-center justify-between px-5 py-3 hover:bg-app-bg/30 transition-colors">
                        <span className="text-[11px] font-bold text-app-muted-foreground flex items-center gap-2">
                          <Icon size={12} /> {f.label}
                        </span>
                        <span className={`text-[13px] font-bold text-app-foreground ${f.mono ? 'font-mono' : ''}`}>{f.value || '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Pricing Card */}
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <DollarSign size={14} style={{ color: 'var(--app-success)' }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Pricing</span>
                  {hasGroup && (
                    <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                      style={{
                        background: item.pricing_source === 'GROUP' ? 'color-mix(in srgb, var(--app-warning) 10%, transparent)' : 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                        color: item.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                      }}>
                      {item.pricing_source === 'GROUP' ? '🏷️ Group Price' : '📍 Local Price'}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-app-border/40">
                  {[
                    { label: 'Selling Price TTC', value: fmt(item.selling_price_ttc), color: 'var(--app-success)', bold: true },
                    { label: 'Selling Price HT', value: fmt(item.selling_price_ht), color: 'var(--app-foreground)' },
                    { label: 'Cost Price', value: fmt(item.cost_price), color: 'var(--app-info)' },
                    { label: 'TVA Rate', value: item.tva_rate != null ? `${item.tva_rate}%` : '—', color: 'var(--app-muted-foreground)' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-app-bg/30 transition-colors">
                      <span className="text-[11px] font-bold text-app-muted-foreground">{f.label}</span>
                      <span className={`text-[14px] tabular-nums ${f.bold ? 'font-black' : 'font-bold'}`} style={{ color: f.color }}>{f.value}</span>
                    </div>
                  ))}
                  {/* Margin */}
                  {item.selling_price_ht && item.cost_price && Number(item.cost_price) > 0 && (
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)' }}>
                      <span className="text-[11px] font-bold text-app-muted-foreground">Margin</span>
                      <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--app-primary)' }}>
                        {((Number(item.selling_price_ht) - Number(item.cost_price)) / Number(item.cost_price) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                {/* Group Override Toggle */}
                {hasGroup && (
                  <div className="px-5 py-3 border-t border-app-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                      {item.pricing_source === 'GROUP' ? 'Following group price — switch to local?' : 'Using local price — follow group?'}
                    </span>
                    <button onClick={handleTogglePricingSource}
                      className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                      style={{
                        background: item.pricing_source === 'GROUP'
                          ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)'
                          : 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                        color: item.pricing_source === 'GROUP' ? 'var(--app-warning)' : 'var(--app-info)',
                      }}>
                      {item.pricing_source === 'GROUP' ? '⚡ Override' : '🔗 Follow Group'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Stock + Groups Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Stock Levels Card */}
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <Warehouse size={14} style={{ color: stockColor }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Stock Levels</span>
                  <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{
                      background: `color-mix(in srgb, ${stockColor} 10%, transparent)`,
                      color: stockColor,
                    }}>
                    {stockHealth === 'OK' ? '✓ In Stock' : stockHealth === 'LOW' ? '⚠ Low Stock' : '✕ Out of Stock'}
                  </span>
                </div>
                <div className="divide-y divide-app-border/40">
                  {[
                    { label: 'On Hand', value: fmtQty(item.on_hand_qty), color: stockColor },
                    { label: 'Reserved', value: fmtQty(item.reserved_qty), color: 'var(--app-accent)' },
                    { label: 'Available', value: fmtQty(item.available_qty), color: 'var(--app-primary)' },
                    { label: 'Min Stock Level', value: fmtQty(item.min_stock_level), color: 'var(--app-muted-foreground)' },
                    { label: 'Max Stock Level', value: fmtQty(item.max_stock_level), color: 'var(--app-muted-foreground)' },
                    { label: 'Reorder Point', value: fmtQty(item.reorder_point), color: 'var(--app-warning)' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between px-5 py-2.5 hover:bg-app-bg/30 transition-colors">
                      <span className="text-[11px] font-bold text-app-muted-foreground">{f.label}</span>
                      <span className="text-[13px] font-black tabular-nums" style={{ color: f.color }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Group Card */}
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <Tag size={14} style={{ color: 'var(--app-primary)' }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Pricing Group</span>
                </div>
                {hasGroup ? (
                  <div className="divide-y divide-app-border/40">
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-app-bg/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/inventory/product-groups/${item.product_group}`)}>
                      <span className="text-[11px] font-bold text-app-muted-foreground">Group</span>
                      <span className="text-[13px] font-bold flex items-center gap-1" style={{ color: 'var(--app-primary)' }}>
                        {item.product_group_name || `Group #${item.product_group}`}
                        <ChevronRight size={12} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-[11px] font-bold text-app-muted-foreground">Price Source</span>
                      <span className="text-[12px] font-bold text-app-foreground">
                        {item.pricing_source === 'GROUP' ? '🏷️ Group' : '📍 Local'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-[11px] font-bold text-app-muted-foreground">Sync Status</span>
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `color-mix(in srgb, ${syncBadge.color} 10%, transparent)`, color: syncBadge.color }}>
                        {syncBadge.icon && <syncBadge.icon size={10} />} {syncBadge.label}
                      </span>
                    </div>
                    {item.group_expected_price && (
                      <div className="flex items-center justify-between px-5 py-3">
                        <span className="text-[11px] font-bold text-app-muted-foreground">Expected Price</span>
                        <span className="text-[13px] font-bold tabular-nums" style={{
                          color: Number(item.selling_price_ttc) !== Number(item.group_expected_price) ? 'var(--app-error)' : 'var(--app-success)'
                        }}>
                          {fmt(item.group_expected_price)}
                        </span>
                      </div>
                    )}
                    {item.group_sync_status === 'BROKEN' && item.group_broken_since && (
                      <div className="px-5 py-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold px-3 py-2 rounded-xl"
                          style={{ background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', color: 'var(--app-error)' }}>
                          <AlertTriangle size={12} />
                          Price diverged since {new Date(item.group_broken_since).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-5">
                    <Tag size={28} className="text-app-muted-foreground/20 mb-3" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">Not in a pricing group</p>
                    <p className="text-[10px] text-app-muted-foreground/60 mt-1">Assign from Products Groups page</p>
                  </div>
                )}
              </div>

              {/* Inventory Groups Card */}
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <Layers size={14} style={{ color: 'var(--app-info)' }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Inventory Groups</span>
                  {invMemberships.length > 0 && (
                    <span className="ml-auto text-[9px] font-black text-app-muted-foreground px-2 py-0.5 rounded-md"
                      style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                      {invMemberships.length} group{invMemberships.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {invMemberships.length > 0 ? (
                  <div className="p-3 space-y-2">
                    {invMemberships.map((m: any) => {
                      const roleBadge = ROLE_BADGES[m.substitution_role] || ROLE_BADGES.NOT_SUB
                      return (
                        <div key={m.id} className="px-4 py-3 rounded-xl border border-app-border/40 hover:border-app-border transition-all"
                          style={{ background: 'var(--app-bg)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-bold text-app-foreground">{m.group_name || `Group #${m.group}`}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg"
                              style={{ background: `color-mix(in srgb, ${roleBadge.color} 10%, transparent)`, color: roleBadge.color }}>
                              {roleBadge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-app-muted-foreground">
                            <span className="font-bold" style={{ color: 'var(--app-info)' }}>Priority {m.substitution_priority}</span>
                            {m.origin_label && <span className="flex items-center gap-1"><Globe size={9} /> {m.origin_label}</span>}
                          </div>
                          {m.notes && <p className="text-[10px] text-app-muted-foreground/60 mt-1.5 italic">{m.notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-5">
                    <Layers size={28} className="text-app-muted-foreground/20 mb-3" />
                    <p className="text-[11px] font-bold text-app-muted-foreground">Not in any inventory group</p>
                    <p className="text-[10px] text-app-muted-foreground/60 mt-1">Add from Inventory Groups page</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Description (if exists) ── */}
            {item.description && (
              <div className="rounded-2xl border border-app-border overflow-hidden"
                style={{ background: 'var(--app-surface)' }}>
                <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
                  style={{ background: 'var(--app-bg)' }}>
                  <Activity size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                  <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Description</span>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[13px] text-app-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            )}

            {/* ── Audit Footer ── */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] text-app-muted-foreground font-bold px-2 pb-4">
              {item.created_at && (
                <span className="flex items-center gap-1.5">
                  <Clock size={10} /> Created {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {item.updated_at && (
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={10} /> Updated {new Date(item.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
              {item.created_by_name && (
                <span className="flex items-center gap-1.5"><User size={10} /> {item.created_by_name}</span>
              )}
              <span className="font-mono text-[9px] opacity-40">ID: {item.id}</span>
            </div>
          </div>
        )}

        {/* ═══════ TAB: PACKAGING ═══════ */}
        {activeTab === 'packaging' && (
          <div className="rounded-2xl border border-app-border overflow-hidden animate-in fade-in duration-300"
            style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
            <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
              style={{ background: 'var(--app-bg)' }}>
              <Package size={14} style={{ color: 'var(--app-warning)' }} />
              <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Product Packaging</span>
            </div>
            <div className="p-4">
              <ProductPackagingTab
                productId={id}
                productName={item.name}
                basePriceTTC={item.selling_price_ttc}
                basePriceHT={item.selling_price_ht}
                productUnitId={item.unit}
              />
            </div>
          </div>
        )}

        {/* ═══════ TAB: ACTIVITY ═══════ */}
        {activeTab === 'activity' && (
          <div className="rounded-2xl border border-app-border overflow-hidden animate-in fade-in duration-300"
            style={{ background: 'var(--app-surface)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)' }}>
            <div className="px-5 py-3.5 border-b border-app-border flex items-center gap-2"
              style={{ background: 'var(--app-bg)' }}>
              <Activity size={14} style={{ color: 'var(--app-accent)' }} />
              <span className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Activity Log</span>
            </div>
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <Activity size={32} className="text-app-muted-foreground/15 mb-3" />
              <p className="text-[12px] font-bold text-app-muted-foreground">Activity tracking coming soon</p>
              <p className="text-[10px] text-app-muted-foreground/60 mt-1">Stock movements, price changes, and order history</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
