'use client'

/**
 * Product Detail Cards — redesigned
 * ===================================
 * Hero KPI strip on top + smart compact field grid below.
 *
 * Improvements over the 6-card grid:
 *   • Hero strip surfaces the 3 metrics most often scanned (Available qty,
 *     Margin %, Procurement state) at a glance.
 *   • Stock health bar gives instant visual signal (green/yellow/red).
 *   • Empty fields are hidden (no rendered DOM for "—").
 *   • Single auto-fit field grid replaces 6 nested grids.
 *   • Description + secondary fields are inside a `<details>` so the initial
 *     paint is small and only expands on demand — better perf on long lists.
 */

import React, { useMemo, useState } from 'react'
import {
  Eye, Edit, ShoppingCart, ArrowRightLeft, BellRing,
  Package, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import type { Product } from '../_lib/types'
import { TYPE_CONFIG, STATUS_CONFIG, PIPELINE_STATUS_CONFIG, fmt } from '../_lib/constants'
import { type RequestableProduct } from '@/components/products/RequestProductDialog'
import { useRequestFlow } from '@/components/products/RequestFlowProvider'
import { ExpiryAlertDialog } from '@/components/products/ExpiryAlertDialog'

interface ProductDetailCardsProps {
  product: Product
  marginPct: string
  onView: (id: number) => void
}

/* ── Tiny field row, hides itself when empty ── */
function Field({ label, value, mono, color }: {
  label: string; value: React.ReactNode; mono?: boolean; color?: string
}) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="flex items-baseline justify-between gap-2 px-2 py-0.5 hover:bg-app-surface/40 rounded">
      <span className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground/80 truncate">{label}</span>
      <span className={`text-[11px] font-bold truncate ${mono ? 'font-mono tabular-nums' : ''}`}
        style={{ color: color || 'var(--app-foreground)' }}>
        {value}
      </span>
    </div>
  )
}

/* ── Section header within the smart grid ── */
function SectionHead({ color, title }: { color: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 col-span-full">
      <span className="w-1 h-3 rounded-full" style={{ background: color }} />
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
    </div>
  )
}

/* ── KPI tile for the hero strip ── */
function Kpi({ label, value, sub, color, icon }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; color: string; icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-app-border/40"
      style={{ background: `color-mix(in srgb, ${color} 6%, var(--app-surface))` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">{label}</div>
        <div className="text-sm font-black tabular-nums truncate" style={{ color }}>{value}</div>
        {sub && <div className="text-[9px] font-bold text-app-muted-foreground tabular-nums truncate">{sub}</div>}
      </div>
    </div>
  )
}

export const ProductDetailCards = React.memo(function ProductDetailCards({ product, marginPct, onView }: ProductDetailCardsProps) {
  const { trigger: triggerRequest } = useRequestFlow()
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false)
  const requestable: RequestableProduct = {
    id: product.id, name: product.name, sku: product.sku,
    reorder_quantity: product.reorder_quantity, min_stock_level: product.min_stock_level,
    pipeline_status: product.pipeline_status,
  }

  /* ── Stock health computation ── */
  const stock = useMemo(() => {
    const onHand = Number(product.on_hand_qty ?? 0)
    const min = Number(product.min_stock_level ?? 0)
    const max = Number(product.max_stock_level) || (min > 0 ? min * 3 : 1)
    const tier = onHand <= 0 ? 'OUT' : (min > 0 && onHand < min) ? 'LOW' : 'OK'
    const tierColor = tier === 'OUT' ? 'var(--app-error, #ef4444)' : tier === 'LOW' ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)'
    const tierLabel = tier === 'OUT' ? 'Out of Stock' : tier === 'LOW' ? 'Low Stock' : 'Healthy'
    const pct = Math.max(0, Math.min(100, max > 0 ? (onHand / max) * 100 : 0))
    return { onHand, min, max, tier, tierColor, tierLabel, pct }
  }, [product.on_hand_qty, product.min_stock_level, product.max_stock_level])

  const proc = PIPELINE_STATUS_CONFIG[product.pipeline_status as string] || PIPELINE_STATUS_CONFIG.NONE

  return (
    <div className="border-b border-app-border/30 animate-in slide-in-from-top-1 duration-200"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, var(--app-bg))' }}>
      <div className="sticky left-0 px-4 py-3 max-w-full">
        {/* ── Action bar ── */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => onView(product.id)}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
            <Eye size={11} /> View Details
          </button>
          <button onClick={() => { window.location.href = `/inventory/products/${product.id}` }}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
            <Edit size={11} /> Edit
          </button>
          <button onClick={() => triggerRequest('PURCHASE', [requestable])}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-info/30 text-app-info hover:bg-app-info/5 transition-all">
            <ShoppingCart size={11} /> Purchase
          </button>
          <button onClick={() => triggerRequest('TRANSFER', [requestable])}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-warning/30 text-app-warning hover:bg-app-warning/5 transition-all">
            <ArrowRightLeft size={11} /> Transfer
          </button>
          <button onClick={() => setExpiryDialogOpen(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-error/30 text-app-error hover:bg-app-error/5 transition-all"
            title="Log batch + create expiry alert for this product">
            <BellRing size={11} /> Expiry Alert
          </button>
        </div>

        {/* ── Hero KPI strip ── */}
        <div className="grid gap-2 mb-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Kpi
            label="Stock Available"
            value={fmt(product.available_qty ?? product.on_hand_qty)}
            sub={
              <span className="flex items-center gap-1">
                <span style={{ color: stock.tierColor }}>{stock.tierLabel}</span>
                {stock.min > 0 && <span>· min {fmt(stock.min)}</span>}
              </span>
            }
            color={stock.tierColor}
            icon={
              stock.tier === 'OUT' ? <AlertTriangle size={14} /> :
              stock.tier === 'LOW' ? <Clock size={14} /> :
              <CheckCircle2 size={14} />
            }
          />
          <Kpi
            label="Selling Price"
            value={fmt(product.selling_price_ttc) === '—' ? '—' : `${fmt(product.selling_price_ttc)}`}
            sub={
              marginPct !== '—'
                ? <span>Margin <span className="text-app-warning font-bold">{marginPct}%</span></span>
                : <span className="text-app-muted-foreground/50">No cost set</span>
            }
            color="var(--app-success, #22c55e)"
            icon={<Package size={14} />}
          />
          <Kpi
            label="Pipeline"
            value={proc.label}
            sub={
              product.pipeline_status && product.pipeline_status !== 'NONE'
                ? <span>Lifecycle in flight</span>
                : <span className="text-app-muted-foreground/50">Idle</span>
            }
            color={proc.color}
            icon={<ShoppingCart size={14} />}
          />
        </div>

        {/* ── Stock health bar ── */}
        {stock.max > 0 && (
          <div className="mb-3 px-1">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground mb-1">
              <span>Stock Health · {fmt(stock.onHand)} on hand</span>
              <span style={{ color: stock.tierColor }}>{stock.tierLabel}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-app-border/30 relative">
              <div className="h-full transition-all"
                style={{ width: `${stock.pct}%`, background: stock.tierColor }} />
              {stock.min > 0 && stock.max > 0 && (
                <div className="absolute top-0 bottom-0 w-px bg-app-foreground/40"
                  style={{ left: `${(stock.min / stock.max) * 100}%` }}
                  title={`Min ${fmt(stock.min)}`} />
              )}
            </div>
          </div>
        )}

        {/* ── Smart field grid (only renders fields with values) ── */}
        <div className="rounded-xl border border-app-border/40" style={{ background: 'var(--app-surface)' }}>
          <div className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 12px' }}>
            {/* Identity */}
            <SectionHead color="var(--app-primary)" title="Identity" />
            <Field label="SKU" value={product.sku} mono />
            <Field label="Barcode" value={product.barcode} mono />
            <Field label="Type" value={TYPE_CONFIG[product.product_type]?.label || product.product_type} />
            <Field label="Category" value={product.category_name} />
            <Field label="Brand" value={product.brand_name} />
            <Field label="Unit" value={product.unit_name} />
            <Field label="Country" value={product.country_name} />
            <Field label="Parfum" value={product.parfum_name} />
            <Field label="Size" value={product.size ? `${product.size}${product.size_unit_name ? ' ' + product.size_unit_name : ''}` : null} />

            {/* Pricing */}
            <SectionHead color="var(--app-info, #3b82f6)" title="Pricing" />
            <Field label="Cost" value={product.cost_price != null ? fmt(product.cost_price) : null} mono color="var(--app-info, #3b82f6)" />
            <Field label="Cost HT" value={product.cost_price_ht != null ? fmt(product.cost_price_ht) : null} mono color="var(--app-info, #3b82f6)" />
            <Field label="Cost TTC" value={product.cost_price_ttc != null ? fmt(product.cost_price_ttc) : null} mono color="var(--app-info, #3b82f6)" />
            <Field label="Sell HT" value={product.selling_price_ht != null ? fmt(product.selling_price_ht) : null} mono color="var(--app-success, #22c55e)" />
            <Field label="Sell TTC" value={product.selling_price_ttc != null ? fmt(product.selling_price_ttc) : null} mono color="var(--app-success, #22c55e)" />
            <Field label="TVA" value={product.tva_rate ? `${product.tva_rate}%` : null} />

            {/* Stock detail (the core 3 are in the hero already) */}
            <SectionHead color="var(--app-success, #22c55e)" title="Stock" />
            <Field label="Reserved" value={product.reserved_qty != null ? fmt(product.reserved_qty) : null} mono color="var(--app-warning, #f59e0b)" />
            <Field label="Incoming" value={product.incoming_transfer_qty != null ? fmt(product.incoming_transfer_qty) : null} mono />
            <Field label="Outgoing" value={product.outgoing_transfer_qty != null ? fmt(product.outgoing_transfer_qty) : null} mono />
            <Field label="Min" value={product.min_stock_level} mono />
            <Field label="Max" value={product.max_stock_level} mono />
            <Field label="Reorder Pt" value={product.reorder_point} mono />
            <Field label="Reorder Qty" value={product.reorder_quantity} mono />

            {/* Governance */}
            <SectionHead color="var(--app-warning, #f59e0b)" title="Governance" />
            <Field label="Status" value={STATUS_CONFIG[product.status]?.label || product.status} color={STATUS_CONFIG[product.status]?.color} />
            <Field label="Active" value={product.is_active ? 'Yes' : 'No'} color={product.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)'} />
            <Field label="Completeness" value={product.completeness_label} />
            <Field label="Level" value={product.data_completeness_level != null ? `${product.data_completeness_level}/7` : null} mono />
            <Field label="Verified" value={product.is_verified ? 'Yes' : null} color="var(--app-success, #22c55e)" />
            <Field label="Catalog Ready" value={product.catalog_ready ? 'Yes' : null} color="var(--app-success, #22c55e)" />

            {/* Tracking */}
            <SectionHead color="var(--app-error, #ef4444)" title="Tracking" />
            <Field label="Expiry Tracked" value={product.is_expiry_tracked ? 'Yes' : null} color="var(--app-success, #22c55e)" />
            <Field label="Shelf Life" value={product.manufacturer_shelf_life_days ? `${product.manufacturer_shelf_life_days}d` : null} mono />
            <Field label="Lots" value={product.tracks_lots ? 'Yes' : null} color="var(--app-success, #22c55e)" />
            <Field label="Serials" value={product.tracks_serials ? 'Yes' : null} color="var(--app-success, #22c55e)" />
            <Field label="Lot Mgmt" value={product.lot_management} />
            <Field label="Valuation" value={product.cost_valuation_method} />

            {/* Group & Dates */}
            <SectionHead color="var(--app-muted-foreground)" title="Group & Dates" />
            <Field label="Group" value={product.product_group_name} />
            <Field label="Price Src" value={product.pricing_source} />
            <Field label="Sync" value={product.group_sync_status && product.group_sync_status !== 'N/A' ? product.group_sync_status : null} />
            <Field label="Created" value={product.created_at ? new Date(product.created_at).toLocaleDateString() : null} />
            <Field label="Updated" value={product.updated_at ? new Date(product.updated_at).toLocaleDateString() : null} />
          </div>
        </div>

        {/* ── Description (collapsible) ── */}
        {product.description && (
          <details className="mt-2.5 group">
            <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl border border-app-border/30 hover:bg-app-surface transition-colors"
              style={{ background: 'var(--app-surface)' }}>
              <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Description</span>
              <span className="text-[10px] font-medium text-app-foreground/80 line-clamp-1 flex-1">{product.description}</span>
              <span className="text-[9px] font-bold text-app-muted-foreground group-open:hidden">Show full</span>
              <span className="text-[9px] font-bold text-app-muted-foreground hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-1 px-3 py-2 rounded-xl border border-app-border/30 text-[11px] font-medium text-app-foreground/90 whitespace-pre-wrap"
              style={{ background: 'var(--app-surface)' }}>
              {product.description}
            </div>
          </details>
        )}
      </div>

      <ExpiryAlertDialog
        open={expiryDialogOpen}
        onClose={() => setExpiryDialogOpen(false)}
        productId={product.id}
        productName={product.name}
        productSku={product.sku}
      />
    </div>
  )
})
