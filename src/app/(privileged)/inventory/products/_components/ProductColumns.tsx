'use client'

/**
 * Product Columns
 * ================
 * Renders the dynamic right-side columns for a product table row.
 * 
 * IMPORTANT: Columns MUST render in the same order as ALL_COLUMNS
 * to stay aligned with the header in manager.tsx.
 */

import React from 'react'
import type { Product } from '../_lib/types'
import { ALL_COLUMNS, COLUMN_WIDTHS, RIGHT_ALIGNED_COLS, CENTER_ALIGNED_COLS, GROW_COLS, TYPE_CONFIG, STATUS_CONFIG, PROCUREMENT_STATUS_CONFIG, fmt } from '../_lib/constants'
import { useMemo } from 'react'

interface ProductColumnsProps {
  product: Product
  vc: Record<string, boolean>
  columnOrder: string[]
  marginPct: string
}

/** Render a single column cell by key */
function renderCell(key: string, product: Product, marginPct: string): React.ReactNode {
  const tc = TYPE_CONFIG[product.product_type] || { label: product.product_type || '—', color: 'var(--app-muted-foreground)' }
  const sc = STATUS_CONFIG[product.status] || STATUS_CONFIG.ACTIVE
  const qty = product.on_hand_qty ?? 0
  const isLow = qty > 0 && qty < (product.min_stock_level || 5)

  switch (key) {
    case 'type':
      return (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ color: tc.color, background: `color-mix(in srgb, ${tc.color} 10%, transparent)` }}>
          {tc.label}
        </span>
      )
    case 'category': return <span className="text-[11px] text-app-foreground truncate">{product.category_name || '—'}</span>
    case 'brand': return <span className="text-[11px] text-app-muted-foreground truncate">{product.brand_name || '—'}</span>
    case 'barcode': return <span className="text-[10px] font-mono text-app-muted-foreground truncate">{product.barcode || '—'}</span>
    case 'description': return <span className="text-[10px] text-app-muted-foreground truncate">{product.description || '—'}</span>
    case 'parfum': return <span className="text-[10px] text-app-muted-foreground truncate">{product.parfum_name || '—'}</span>
    case 'unit': return <span className="text-[10px] text-app-muted-foreground truncate">{product.unit_short_name || product.unit_name || '—'}</span>
    case 'country': return <span className="text-[10px] text-app-muted-foreground truncate">{product.country_code || product.country_name || '—'}</span>
    case 'size': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.size ? `${product.size}${product.size_unit_name ? ` ${product.size_unit_name}` : ''}` : '—'}</span>
    case 'cost': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(product.cost_price)}</span>
    case 'costHt': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(product.cost_price_ht)}</span>
    case 'costTtc': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(product.cost_price_ttc)}</span>
    case 'price': return <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(product.selling_price_ttc)}</span>
    case 'sellingHt': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(product.selling_price_ht)}</span>
    case 'tva': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.tva_rate ? `${product.tva_rate}%` : '—'}</span>
    case 'margin': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-warning, #f59e0b)' }}>{marginPct !== '—' ? `${marginPct}%` : '—'}</span>
    case 'stock':
      return (
        <span className="text-[12px] font-bold tabular-nums"
          style={{ color: qty <= 0 ? 'var(--app-error, #ef4444)' : isLow ? 'var(--app-warning, #f59e0b)' : 'var(--app-foreground)' }}>
          {fmt(qty)}
        </span>
      )
    case 'available': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(product.available_qty)}</span>
    case 'reserved': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-warning, #f59e0b)' }}>{fmt(product.reserved_qty)}</span>
    case 'incoming': return <span className="text-[11px] font-mono tabular-nums text-app-foreground">{fmt(product.incoming_transfer_qty)}</span>
    case 'outgoing': return <span className="text-[11px] font-mono tabular-nums text-app-foreground">{fmt(product.outgoing_transfer_qty)}</span>
    case 'minStock': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.min_stock_level ?? '—'}</span>
    case 'maxStock': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.max_stock_level ?? '—'}</span>
    case 'reorderPoint': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.reorder_point ?? '—'}</span>
    case 'reorderQty': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.reorder_quantity ?? '—'}</span>
    case 'status':
      return (
        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
          style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
          {sc.label}
        </span>
      )
    case 'procurement': {
      const ps = PROCUREMENT_STATUS_CONFIG[product.procurement_status as string] || PROCUREMENT_STATUS_CONFIG.NONE
      const tier = qty <= 0 ? 'OUT' : isLow ? 'LOW' : null
      const tierLabel = tier === 'OUT' ? 'Out of Stock' : tier === 'LOW' ? 'Low Stock' : null
      const tierColor = tier === 'OUT' ? 'var(--app-error, #ef4444)' : tier === 'LOW' ? 'var(--app-warning, #f59e0b)' : ps.color
      const hasLifecycle = product.procurement_status && product.procurement_status !== 'NONE'
      // Stack: stock tier on the first line (only when not "Available"), lifecycle on the second (only when active).
      // When neither tier nor lifecycle is set, fall back to a single "Available" badge.
      const pill = (label: string, color: string) => (
        <span className="inline-flex items-center text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          }}>
          {label}
        </span>
      )
      if (!tierLabel && !hasLifecycle) return pill('Available', ps.color)
      return (
        <span className="inline-flex flex-col items-center gap-0.5">
          {tierLabel && pill(tierLabel, tierColor)}
          {hasLifecycle && pill(ps.label, ps.color)}
        </span>
      )
    }
    case 'isActive': return <span className="text-[10px]">{product.is_active ? '✅' : '❌'}</span>
    case 'completeness': return <span className="text-[10px] font-bold text-app-muted-foreground truncate">{product.completeness_label || '—'}</span>
    case 'completenessLvl': return <span className="text-[10px] font-bold text-app-muted-foreground">{product.data_completeness_level ?? '—'}/7</span>
    case 'verified': return <span className="text-[11px]">{product.is_verified ? '✅' : '—'}</span>
    case 'verifiedAt': return <span className="text-[9px] text-app-muted-foreground truncate">{product.verified_at ? new Date(product.verified_at).toLocaleDateString() : '—'}</span>
    case 'catalogReady': return <span className="text-[10px]">{product.catalog_ready ? '✅' : '—'}</span>
    case 'expiry': return <span className="text-[10px]">{product.is_expiry_tracked ? '✅' : '—'}</span>
    case 'shelfLife': return <span className="text-[10px] font-mono text-app-muted-foreground">{product.manufacturer_shelf_life_days ? `${product.manufacturer_shelf_life_days}d` : '—'}</span>
    case 'tracksLots': return <span className="text-[10px]">{product.tracks_lots ? '✅' : '—'}</span>
    case 'tracksSerials': return <span className="text-[10px]">{product.tracks_serials ? '✅' : '—'}</span>
    case 'lotMgmt': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{product.lot_management || '—'}</span>
    case 'valuation': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{product.cost_valuation_method || '—'}</span>
    case 'productGroup': return <span className="text-[10px] text-app-foreground truncate">{product.product_group_name || '—'}</span>
    case 'pricingSource': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase">{product.pricing_source || '—'}</span>
    case 'syncStatus': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{product.group_sync_status || '—'}</span>
    case 'createdAt': return <span className="text-[9px] text-app-muted-foreground truncate">{product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</span>
    case 'updatedAt': return <span className="text-[9px] text-app-muted-foreground truncate">{product.updated_at ? new Date(product.updated_at).toLocaleDateString() : '—'}</span>
    default: return <span className="text-[10px] text-app-muted-foreground">—</span>
  }
}

/** Public API: render a product column cell (auto-calculates margin) */
export function renderProductCell(key: string, product: Product): React.ReactNode {
  const sellHt = parseFloat(product.selling_price_ht) || 0
  const costP = parseFloat(product.cost_price) || 0
  const marginPct = sellHt > 0 ? (((sellHt - costP)) / (sellHt) * 100).toFixed(1) : '—'
  return renderCell(key, product, marginPct)
}

export const ProductColumns = React.memo(function ProductColumns({ product, vc, columnOrder, marginPct }: ProductColumnsProps) {
  // Derive ordered column defs from columnOrder
  const orderedCols = useMemo(() => {
    const colMap = new Map(ALL_COLUMNS.map(c => [c.key, c]))
    const seen = new Set<string>()
    const result: typeof ALL_COLUMNS = []
    for (const key of columnOrder) {
      const col = colMap.get(key)
      if (col && !seen.has(key)) { result.push(col); seen.add(key) }
    }
    for (const col of ALL_COLUMNS) {
      if (!seen.has(col.key)) result.push(col)
    }
    return result
  }, [columnOrder])

  return (
    <>
      {orderedCols.map(col => {
        const isOn = col.defaultVisible ? vc[col.key] !== false : vc[col.key]
        if (!isOn) return null
        const w = COLUMN_WIDTHS[col.key] || 'w-16'
        const align = RIGHT_ALIGNED_COLS.has(col.key) ? ' text-right' : CENTER_ALIGNED_COLS.has(col.key) ? ' text-center' : ''
        return (
          <div key={col.key} className={`${w} flex-shrink-0${align}${GROW_COLS.has(col.key) ? ' col-grow' : ''}`}>
            {renderCell(col.key, product, marginPct)}
          </div>
        )
      })}
    </>
  )
})
