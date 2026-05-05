'use client'

/**
 * ProductCardGrid — Dajingo Pro V2 Card View for Product Master
 * ==============================================================
 * Design-language.md compliant: auto-fit grid (§3), color-mix (§14),
 * typography (§15), badges (§7), tokens (§17), states (§9/§10)
 *
 * NOTE: This component renders INSIDE a <main overflow-auto> → DajingoPageShell.
 * We do NOT use flex-1 or overflow-y-auto here — the <main> is already the
 * scroll container. Cards just flow naturally within the grid.
 */

import { memo } from 'react'
import { Package, Eye, Pencil, Loader2, ShoppingCart, ArrowRightLeft, BellRing, Check } from 'lucide-react'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { TYPE_CONFIG, STATUS_CONFIG, PIPELINE_STATUS_CONFIG, fmt } from '../_lib/constants'
import { applyRecoveryPolicy, type PipelineStatus } from '@/lib/procurement-status'
import { useProcurementRecoveryPolicy } from '@/hooks/useProcurementRecoveryPolicy'
import type { Product } from '../_lib/types'

interface Props {
  data: Product[]
  loading?: boolean
  onView?: (product: Product) => void
  onEdit?: (product: Product) => void
  /** Bulk-selection state — same shape as the list view so toggling
   *  carries between views. */
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  /** Action callbacks — wire to the same RequestFlow and ExpiryAlertDialog
   *  the list view's expanded row uses, so the card and row paths produce
   *  identical results. */
  onPurchase?: (product: Product) => void
  onTransfer?: (product: Product) => void
  onExpiryAlert?: (product: Product) => void
}

export function ProductCardGrid({
  data, loading, onView, onEdit,
  selectedIds, onToggleSelect,
  onPurchase, onTransfer, onExpiryAlert,
}: Props) {

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-app-primary" />
      </div>
    )
  }

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

  /* No flex-1 / overflow-y-auto — parent <main> handles scrolling.
     Just render the grid and let it flow naturally. */
  return (
    <div
      className="p-4 animate-in fade-in duration-300"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
      }}
    >
      {data.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          isSelected={selectedIds?.has(product.id) ?? false}
          onView={onView}
          onEdit={onEdit}
          onToggleSelect={onToggleSelect}
          onPurchase={onPurchase}
          onTransfer={onTransfer}
          onExpiryAlert={onExpiryAlert}
        />
      ))}
    </div>
  )
}

/* Memoized so toggling one card's selection doesn't re-render the other 99.
 * Relies on stable callback references from the manager — if the parent
 * wraps `onView`, `onEdit`, `onPurchase`, `onTransfer`, `onExpiryAlert`
 * with useCallback, only the card whose `isSelected` changed will re-render. */
const ProductCard = memo(function ProductCard({
  product, isSelected,
  onView, onEdit, onToggleSelect,
  onPurchase, onTransfer, onExpiryAlert,
}: {
  product: Product
  isSelected: boolean
  onView?: (product: Product) => void
  onEdit?: (product: Product) => void
  onToggleSelect?: (id: number) => void
  onPurchase?: (product: Product) => void
  onTransfer?: (product: Product) => void
  onExpiryAlert?: (product: Product) => void
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

  // Procurement Status Config — apply the tenant's recovery policy
  // so terminal states (Received / Cancelled / Rejected / Failed)
  // auto-recycle to "Available" once their cooldown matures. The
  // policy lives in Org settings; the hook reads it once per session.
  const recoveryPolicy = useProcurementRecoveryPolicy()
  const liveStatus: string = applyRecoveryPolicy(
    (product.pipeline_status as PipelineStatus) || 'NONE',
    (product.pipeline_status_changed_at as string | null) ?? null,
    recoveryPolicy,
    (product.pipeline_rejection_reason as string | undefined) || undefined,
  )
  const ps = PIPELINE_STATUS_CONFIG[liveStatus] || PIPELINE_STATUS_CONFIG.NONE
  const hasProcurement = liveStatus && liveStatus !== 'NONE'

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: 'var(--app-surface)',
        // Highlight selected cards with a primary-tinted ring so bulk
        // operations are visually obvious without taking extra layout.
        border: isSelected
          ? `1px solid var(--app-primary)`
          : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
        boxShadow: isSelected ? '0 0 0 2px color-mix(in srgb, var(--app-primary) 18%, transparent)' : undefined,
      }}
    >
      {/* ── IMAGE AREA ── */}
      <div
        className="relative w-full flex items-center justify-center cursor-pointer"
        style={{
          height: '180px',
          background: 'color-mix(in srgb, var(--app-border) 8%, var(--app-background))',
        }}
        onClick={() => onView?.(product)}
      >
        {/* Selection checkbox — top-left, fades in on hover or when
         *  any card in the grid is selected. Same idiom as the list-view
         *  row checkbox. */}
        {onToggleSelect && (
          <button type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(product.id) }}
                  className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  style={{
                      background: isSelected ? 'var(--app-primary)' : 'var(--app-surface)',
                      border: isSelected
                          ? '1px solid var(--app-primary)'
                          : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                      boxShadow: isSelected ? undefined : '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                  aria-checked={isSelected} role="checkbox"
                  aria-label={`Select ${product.name}`}>
              {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
          </button>
        )}
        <ProductThumbnail
          image={product.image}
          productType={product.product_type}
          name={product.name}
          size={90}
          className="rounded-xl"
          color={tc.color}
        />

        {/* Type badge — bottom-left of image area to avoid colliding with
         *  the selection checkbox at top-left. Subtler position, still
         *  scannable. */}
        <span
          className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
          style={{
            background: `color-mix(in srgb, ${tc.color} 12%, var(--app-surface))`,
            color: tc.color,
            border: `1px solid color-mix(in srgb, ${tc.color} 25%, transparent)`,
          }}
        >
          {tc.label}
        </span>

        {/* Stock badge — top-right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
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

          {/* Procurement badge — shown only if active (Requested, Ordered, etc.) */}
          {hasProcurement && (
            <span
              className="inline-flex flex-col items-center text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg leading-tight"
              style={{
                background: `color-mix(in srgb, ${ps.color} 12%, var(--app-surface))`,
                color: ps.color,
                border: `1px solid color-mix(in srgb, ${ps.color} 25%, transparent)`,
              }}
            >
              {ps.label.split(' · ').map((p, i) => <span key={i} className="whitespace-nowrap">{p}</span>)}
            </span>
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all duration-200">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'var(--app-primary)',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
              }}
            >
              <Eye size={16} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* ── PRODUCT INFO ── */}
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={() => onView?.(product)}>
        {/* Category • Brand */}
        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider truncate mb-1.5">
          {[product.category_name, product.brand_name].filter(Boolean).join(' • ') || tc.label}
        </p>

        {/* Product Name */}
        <h3
          className="mb-1"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '40px',
          }}
        >
          {product.name}
        </h3>

        {/* SKU */}
        <p className="font-mono text-[11px] font-bold text-app-muted-foreground truncate mb-3">
          {product.sku || '—'}
        </p>

        {/* Price + Stock row */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[18px] font-black text-app-foreground tabular-nums leading-none">
              {sellPrice > 0 ? fmt(sellPrice) : '—'}
            </span>
            {costPrice > 0 && sellPrice > 0 && (
              <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums ml-1.5 opacity-70">
                / {fmt(costPrice)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Package size={12} style={{ color: stockColor }} />
            <span className="text-[12px] font-bold tabular-nums" style={{ color: stockColor }}>
              {stockQty}
            </span>
            <span className="text-[10px] font-bold text-app-muted-foreground">
              in stock
            </span>
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ──
       *  Top row: primary actions (View) + status pill (read-only).
       *  Bottom row: icon-only secondary actions (Edit + Purchase /
       *  Transfer / Expiry Alert). Splitting into two rows keeps each
       *  row legible at the 280px card width and matches the same
       *  ordering used by the list view's expanded row. */}
      <div className="px-3 pt-2 pb-3 space-y-1.5"
           style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
        {/* Primary row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onView?.(product) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'var(--app-primary)' }}
          >
            <Eye size={13} />
            View
          </button>
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

        {/* Secondary row — icon-only quick actions, equal-weight grid. */}
        <div className="grid grid-cols-4 gap-1.5">
          <CardIconButton
            label="Edit"
            icon={<Pencil size={12} />}
            color="var(--app-muted-foreground)"
            onClick={(e) => { e.stopPropagation(); onEdit?.(product) }}
          />
          {onPurchase && (
            <CardIconButton
              label="Purchase"
              icon={<ShoppingCart size={12} />}
              color="var(--app-info, #3b82f6)"
              onClick={(e) => { e.stopPropagation(); onPurchase(product) }}
            />
          )}
          {onTransfer && (
            <CardIconButton
              label="Transfer"
              icon={<ArrowRightLeft size={12} />}
              color="var(--app-warning, #f59e0b)"
              onClick={(e) => { e.stopPropagation(); onTransfer(product) }}
            />
          )}
          {onExpiryAlert && (
            <CardIconButton
              label="Expiry alert"
              icon={<BellRing size={12} />}
              color="var(--app-error, #ef4444)"
              onClick={(e) => { e.stopPropagation(); onExpiryAlert(product) }}
            />
          )}
        </div>
      </div>
    </div>
  )
})

function CardIconButton({ label, icon, color, onClick }: {
  label: string
  icon: React.ReactNode
  color: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center justify-center py-1.5 rounded-lg transition-all hover:brightness-105 active:scale-[0.95]"
      style={{
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      {icon}
    </button>
  )
}
