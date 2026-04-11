'use client'

/**
 * Product Row
 * ============
 * Table row with mobile card fallback and expandable detail cards.
 * Wrapped in React.memo for performance with large product lists.
 *
 * REFACTORED: April 2026
 * Detail cards → ProductDetailCards.tsx
 * Dynamic columns → ProductColumns.tsx
 */

import React, { useState, useRef } from 'react'
import {
  Package, Box, Layers, Eye, Edit, MoreHorizontal,
  ChevronRight, ChevronDown, ShoppingCart, ArrowRightLeft,
} from 'lucide-react'
import type { Product } from '../_lib/types'
import { TYPE_CONFIG, STATUS_CONFIG, fmt } from '../_lib/constants'
import { ProductColumns } from './ProductColumns'
import { ProductDetailCards } from './ProductDetailCards'

interface ProductRowProps {
  product: Product
  onView: (id: number) => void
  visibleColumns: Record<string, boolean>
  columnOrder: string[]
  tableMinWidth?: string
  isSelected: boolean
  onToggleSelect: (id: number) => void
}

export const ProductRow = React.memo(function ProductRow({
  product, onView, visibleColumns: vc, columnOrder, tableMinWidth, isSelected, onToggleSelect,
}: ProductRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const tc = TYPE_CONFIG[product.product_type] || { label: product.product_type || '—', color: 'var(--app-muted-foreground)' }
  const sc = STATUS_CONFIG[product.status] || STATUS_CONFIG.ACTIVE
  const qty = product.on_hand_qty ?? 0
  const isLow = qty > 0 && qty < (product.min_stock_level || 5)
  const sellHt = parseFloat(product.selling_price_ht) || 0
  const costP = parseFloat(product.cost_price) || 0
  const marginPct = sellHt > 0 ? (((sellHt - costP)) / (sellHt) * 100).toFixed(1) : '—'

  return (
    <div>
      {/* ── MOBILE CARD (≤640px) ── */}
      <div
        className="sm:hidden border-b border-app-border/30 px-3 py-3 active:bg-app-surface/60 transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
            {product.product_type === 'COMBO' ? <Layers size={15} /> : product.product_type === 'STOCKABLE' ? <Box size={15} /> : <Package size={15} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-app-foreground truncate">{product.name}</div>
            <div className="text-[11px] font-mono text-app-muted-foreground mt-0.5">{product.sku}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                style={{ color: tc.color, background: `color-mix(in srgb, ${tc.color} 10%, transparent)` }}>{tc.label}</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span>
              {product.category_name && <span className="text-[10px] font-bold text-app-muted-foreground">{product.category_name}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[13px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(product.selling_price_ttc)}</div>
            <div className="text-[11px] font-bold tabular-nums mt-0.5"
              style={{ color: qty <= 0 ? 'var(--app-error, #ef4444)' : isLow ? 'var(--app-warning, #f59e0b)' : 'var(--app-foreground)' }}>
              {fmt(qty)} in stock
            </div>
          </div>
        </div>
        {isOpen && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-app-border/20">
            <button onClick={e => { e.stopPropagation(); onView(product.id) }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-app-primary py-2 rounded-xl border border-app-primary/30 hover:bg-app-primary/5 transition-all">
              <Eye size={13} /> View Details
            </button>
          </div>
        )}
      </div>

      {/* ── TABLE ROW (≥640px) ── */}
      <div
        className={`hidden sm:flex group items-center transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2 ${isSelected ? 'bg-app-primary/5' : ''}`}
        style={{ paddingLeft: '12px', paddingRight: '12px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* ── LEFT SECTION: fixed-width product info ── */}
        <div className="flex items-center gap-2" style={{ width: '280px', minWidth: '280px', flexShrink: 0 }}>
          {/* Checkbox */}
          <div className="w-5 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(product.id)}
              className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onView(product.id)}
              className="p-1 hover:bg-app-primary/10 rounded-md transition-colors text-app-muted-foreground hover:text-app-primary" title="View Details">
              <Eye size={12} />
            </button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-app-border/50 rounded-md transition-colors text-app-muted-foreground hover:text-app-foreground" title="More actions">
                <MoreHorizontal size={12} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-48 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{ background: 'var(--app-surface)' }}>
                    <button onClick={() => { onView(product.id); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Eye size={12} className="text-app-primary" /> View Details
                    </button>
                    <button onClick={() => { window.location.href = `/procurement/purchase-orders/new?product=${product.id}`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <ShoppingCart size={12} className="text-app-info" /> Request Purchase
                    </button>
                    <button onClick={() => { window.location.href = `/inventory/transfers/new?product=${product.id}`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <ArrowRightLeft size={12} className="text-app-warning" /> Request Transfer
                    </button>
                    <div className="border-t border-app-border/50 my-1" />
                    <button onClick={() => { window.location.href = `/inventory/products/${product.id}`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Edit size={12} className="text-app-muted-foreground" /> Edit Product
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Expand chevron */}
          <div className="w-4 flex-shrink-0 flex items-center justify-center text-app-muted-foreground">
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </div>

          {/* Type badge */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
            {product.product_type === 'COMBO' ? <Layers size={13} /> : product.product_type === 'STOCKABLE' ? <Box size={13} /> : <Package size={13} />}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{product.name}</div>
            <div className="text-[10px] font-mono text-app-muted-foreground">
              {product.sku}
              {product.barcode && <span className="ml-2 opacity-60">⎸ {product.barcode}</span>}
            </div>
          </div>
        </div>

        {/* ── RIGHT SECTION: dynamic columns (delegated) ── */}
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 fill-cols">
          <ProductColumns product={product} vc={vc} columnOrder={columnOrder} marginPct={marginPct} />
        </div>
      </div>

      {/* ── EXPANDABLE DETAIL CARDS (delegated) ── */}
      {isOpen && <ProductDetailCards product={product} marginPct={marginPct} onView={onView} />}
    </div>
  )
})
