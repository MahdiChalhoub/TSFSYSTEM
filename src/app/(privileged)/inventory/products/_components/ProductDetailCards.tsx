'use client'

/**
 * Product Detail Cards
 * =====================
 * Expandable section showing 6 grouped info cards (Identity, Pricing, Stock, Governance, Tracking, Group & Dates).
 */

import React, { useState } from 'react'
import { Eye, Edit, ShoppingCart, ArrowRightLeft } from 'lucide-react'
import type { Product } from '../_lib/types'
import { TYPE_CONFIG, STATUS_CONFIG, PROCUREMENT_STATUS_CONFIG, fmt } from '../_lib/constants'
import { DCell } from './DCell'
import { RequestProductDialog, type RequestableProduct } from '@/components/products/RequestProductDialog'

interface ProductDetailCardsProps {
  product: Product
  marginPct: string
  onView: (id: number) => void
}

/* ── Reusable Card Section wrapper ── */
function CardSection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
        style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
        <div className="w-1 h-3 rounded-full" style={{ background: color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
        {children}
      </div>
    </div>
  )
}

export const ProductDetailCards = React.memo(function ProductDetailCards({ product, marginPct, onView }: ProductDetailCardsProps) {
  const [requestType, setRequestType] = useState<'PURCHASE' | 'TRANSFER' | null>(null)
  const requestable: RequestableProduct = { id: product.id, name: product.name, sku: product.sku, reorder_quantity: product.reorder_quantity, min_stock_level: product.min_stock_level }
  return (
    <div className="border-b border-app-border/30 animate-in slide-in-from-top-1 duration-200"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, var(--app-bg))' }}>
      <div className="sticky left-0 px-4 py-3" style={{ width: 'min(100vw - 280px, 100%)' }}>
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => onView(product.id)}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
            <Eye size={11} /> View Details
          </button>
          <button onClick={() => { window.location.href = `/inventory/products/${product.id}` }}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
            <Edit size={11} /> Edit
          </button>
          <button onClick={() => setRequestType('PURCHASE')}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-info/30 text-app-info hover:bg-app-info/5 transition-all">
            <ShoppingCart size={11} /> Purchase
          </button>
          <button onClick={() => setRequestType('TRANSFER')}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-warning/30 text-app-warning hover:bg-app-warning/5 transition-all">
            <ArrowRightLeft size={11} /> Transfer
          </button>
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          <CardSection color="var(--app-primary)" title="Identity">
            <DCell label="SKU" value={product.sku} mono />
            <DCell label="Barcode" value={product.barcode} mono />
            <DCell label="Type" value={TYPE_CONFIG[product.product_type]?.label || product.product_type} />
            <DCell label="Category" value={product.category_name} />
            <DCell label="Brand" value={product.brand_name} />
            <DCell label="Unit" value={product.unit_name} />
            <DCell label="Country" value={product.country_name} />
            <DCell label="Parfum" value={product.parfum_name} />
            <DCell label="Size" value={product.size ? `${product.size}${product.size_unit_name ? ' ' + product.size_unit_name : ''}` : null} />
          </CardSection>

          <CardSection color="var(--app-info)" title="Pricing">
            <DCell label="Cost" value={fmt(product.cost_price)} mono color="var(--app-info)" />
            <DCell label="Cost HT" value={fmt(product.cost_price_ht)} mono color="var(--app-info)" />
            <DCell label="Cost TTC" value={fmt(product.cost_price_ttc)} mono color="var(--app-info)" />
            <DCell label="Sell TTC" value={fmt(product.selling_price_ttc)} mono color="var(--app-success)" />
            <DCell label="Sell HT" value={fmt(product.selling_price_ht)} mono color="var(--app-success)" />
            <DCell label="TVA" value={product.tva_rate ? `${product.tva_rate}%` : null} />
            <DCell label="Margin" value={marginPct !== '—' ? `${marginPct}%` : null} color="var(--app-warning)" />
          </CardSection>

          <CardSection color="var(--app-success)" title="Stock">
            <DCell label="On Hand" value={fmt(product.on_hand_qty)} mono />
            <DCell label="Available" value={fmt(product.available_qty)} mono color="var(--app-success)" />
            <DCell label="Reserved" value={fmt(product.reserved_qty)} mono color="var(--app-warning)" />
            <DCell label="Incoming" value={fmt(product.incoming_transfer_qty)} mono />
            <DCell label="Outgoing" value={fmt(product.outgoing_transfer_qty)} mono />
            <DCell label="Min Stock" value={product.min_stock_level} />
            <DCell label="Max Stock" value={product.max_stock_level} />
            <DCell label="Reorder Pt" value={product.reorder_point} />
            <DCell label="Reorder Qty" value={product.reorder_quantity} />
            <DCell
              label="Procurement"
              value={(PROCUREMENT_STATUS_CONFIG[product.procurement_status as string] || PROCUREMENT_STATUS_CONFIG.NONE).label}
              color={(PROCUREMENT_STATUS_CONFIG[product.procurement_status as string] || PROCUREMENT_STATUS_CONFIG.NONE).color}
            />
          </CardSection>

          <CardSection color="var(--app-warning)" title="Governance">
            <DCell label="Status" value={STATUS_CONFIG[product.status]?.label || product.status} />
            <DCell label="Active" value={product.is_active ? '✅' : '❌'} />
            <DCell label="Completeness" value={product.completeness_label} />
            <DCell label="Level" value={product.data_completeness_level != null ? `${product.data_completeness_level}/7` : null} />
            <DCell label="Verified" value={product.is_verified ? '✅' : '—'} />
            <DCell label="Catalog Ready" value={product.catalog_ready ? '✅' : '—'} />
          </CardSection>

          <CardSection color="var(--app-error)" title="Tracking">
            <DCell label="Expiry" value={product.is_expiry_tracked ? '✅ Yes' : '—'} />
            <DCell label="Shelf Life" value={product.manufacturer_shelf_life_days ? `${product.manufacturer_shelf_life_days}d` : null} />
            <DCell label="Lots" value={product.tracks_lots ? '✅' : '—'} />
            <DCell label="Serials" value={product.tracks_serials ? '✅' : '—'} />
            <DCell label="Lot Mgmt" value={product.lot_management} />
            <DCell label="Valuation" value={product.cost_valuation_method} />
          </CardSection>

          <CardSection color="var(--app-muted-foreground)" title="Group & Dates">
            <DCell label="Group" value={product.product_group_name} />
            <DCell label="Price Src" value={product.pricing_source} />
            <DCell label="Sync" value={product.group_sync_status !== 'N/A' ? product.group_sync_status : null} />
            <DCell label="Created" value={product.created_at ? new Date(product.created_at).toLocaleDateString() : null} />
            <DCell label="Updated" value={product.updated_at ? new Date(product.updated_at).toLocaleDateString() : null} />
          </CardSection>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-2.5 px-3 py-2 rounded-xl border border-app-border/30" style={{ background: 'var(--app-surface)' }}>
            <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Description</span>
            <div className="text-[10px] font-medium text-app-foreground/80 line-clamp-2 mt-0.5">{product.description}</div>
          </div>
        )}
      </div>

      {requestType && (
        <RequestProductDialog
          open
          onClose={() => setRequestType(null)}
          requestType={requestType}
          products={[requestable]}
        />
      )}
    </div>
  )
})
