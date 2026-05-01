'use client'

/**
 * ProductCardGrid — Dajingo Pro V2 Card View for Product Master
 * ==============================================================
 * E-commerce style card inspired by the Samsung Galaxy S22 card reference.
 * - Large product image with clean background
 * - Stock status badge (top-right)
 * - Product name + Category • Brand subtitle
 * - Price prominent + stock quantity
 * - Action buttons row (View, Edit, Delete-style)
 *
 * Design-language.md compliance:
 *   auto-fit grid (§3), color-mix surfaces (§14), typography scale (§15),
 *   badge pattern (§7), semantic tokens only (§17),
 *   empty/loading states (§9/§10), animate-in (§16), custom-scrollbar (§16)
 */

import { Package, AlertTriangle, Eye, Pencil, Trash2, Loader2 } from 'lucide-react'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { TYPE_CONFIG, STATUS_CONFIG, fmt } from '../_lib/constants'
import type { Product } from '../_lib/types'

interface Props {
  data: Product[]
  loading?: boolean
  onView?: (product: Product) => void
  onEdit?: (product: Product) => void
}

export function ProductCardGrid({ data, loading, onView, onEdit }: Props) {

  /* ── Loading State (§10) ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-app-primary" />
      </div>
    )
  }

  /* ── Empty State (§9) ── */
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Package size={36} className="text-app-muted-foreground mb-3 opacity-40" />
        <p className="text-sm font-bold text-app-muted-foreground">No products found</p>
        <p className="text-[11px] text-app-muted-foreground mt-1">
          Try adjusting your search or filters.
        </p>
      </div>
    )
  }

  /* ── Card Grid — auto-fit (§3 MANDATORY) ── */
  return (
    <div
      className="flex-1 overflow-y-auto custom-scrollbar p-3 animate-in fade-in duration-300"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        alignContent: 'start',
      }}
    >
      {data.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onView={() => onView?.(product)}
          onEdit={() => onEdit?.(product)}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   ProductCard — e-commerce style, inspired by reference
   ═══════════════════════════════════════════════════════════ */

function ProductCard({ product, onView, onEdit }: {
  product: Product
  onView: () => void
  onEdit: () => void
}) {
  const tc = TYPE_CONFIG[product.product_type] || {
    label: product.product_type || '—',
    color: 'var(--app-muted-foreground)',
  }
  const sc = STATUS_CONFIG[product.status] || STATUS_CONFIG['ACTIVE']
  const costPrice = parseFloat(product.cost_price) || 0
  const sellPrice = parseFloat(product.selling_price_ttc) || 0
  const stockQty = product.total_stock ?? product.on_hand_qty ?? 0
  const isLowStock = stockQty <= (product.min_stock_level || 0) && stockQty > 0
  const isOutOfStock = stockQty <= 0

  const stockColor = isOutOfStock
    ? 'var(--app-error, #ef4444)'
    : isLowStock
      ? 'var(--app-warning, #f59e0b)'
      : 'var(--app-success, #22c55e)'

  const stockLabel = isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--app-surface)',
        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
      }}
    >
      {/* ── 1. PRODUCT IMAGE — large, clean background ── */}
      <div
        className="relative w-full flex items-center justify-center cursor-pointer"
        style={{
          height: '160px',
          background: 'color-mix(in srgb, var(--app-border) 10%, var(--app-background))',
        }}
        onClick={onView}
      >
        <ProductThumbnail
          image={product.image}
          productType={product.product_type}
          name={product.name}
          size={80}
          className="rounded-xl"
          color={tc.color}
        />

        {/* Stock Status Badge — top-right, like the reference */}
        <div className="absolute top-2.5 right-2.5">
          <span
            className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
            style={{
              background: `color-mix(in srgb, ${stockColor} 12%, var(--app-surface))`,
              color: stockColor,
              border: `1px solid color-mix(in srgb, ${stockColor} 25%, transparent)`,
            }}
          >
            {stockLabel}
          </span>
        </div>
      </div>

      {/* ── 2. PRODUCT INFO ── */}
      <div className="flex-1 px-3.5 pt-3 pb-2 cursor-pointer" onClick={onView}>
        {/* Category • Brand — subtitle */}
        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider truncate mb-1">
          {[product.category_name, product.brand_name].filter(Boolean).join(' • ') || tc.label}
        </p>

        {/* Product Name — prominent */}
        <h3 className="text-[13px] font-bold text-app-foreground leading-snug line-clamp-2 mb-1" style={{ minHeight: '36px' }}>
          {product.name}
        </h3>

        {/* SKU — mono */}
        <p className="font-mono text-[11px] font-bold text-app-muted-foreground truncate mb-3">
          {product.sku || '—'}
        </p>

        {/* Price Row */}
        <div className="flex items-end justify-between">
          {/* Selling Price — large and prominent */}
          <div>
            <span className="text-lg font-black text-app-foreground tabular-nums leading-none">
              {sellPrice > 0 ? fmt(sellPrice) : '—'}
            </span>
            {costPrice > 0 && (
              <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums ml-1.5">
                / {fmt(costPrice)}
              </span>
            )}
          </div>

          {/* Stock Quantity — like "987 sold" in reference */}
          <div className="flex items-center gap-1">
            <Package size={11} style={{ color: stockColor }} />
            <span className="text-[11px] font-bold tabular-nums" style={{ color: stockColor }}>
              {stockQty} <span className="text-app-muted-foreground">in stock</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. ACTION BUTTONS — bottom row, like reference ── */}
      <div
        className="flex items-center gap-1.5 px-3 py-2.5"
        style={{
          borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
        }}
      >
        {/* View — primary */}
        <button
          onClick={(e) => { e.stopPropagation(); onView() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold text-white transition-all hover:brightness-110"
          style={{
            background: 'var(--app-primary)',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
          }}
        >
          <Eye size={13} />
          <span>View</span>
        </button>

        {/* Edit — secondary */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all"
          style={{
            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
            color: 'var(--app-info, #3b82f6)',
            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
          }}
        >
          <Pencil size={12} />
          <span>Edit</span>
        </button>

        {/* Status badge — tertiary slot */}
        <div
          className="flex items-center justify-center px-2.5 py-2 rounded-xl"
          style={{
            background: `color-mix(in srgb, ${sc?.color} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${sc?.color} 20%, transparent)`,
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: sc?.color }}>
            {sc?.label}
          </span>
        </div>
      </div>
    </div>
  )
}
