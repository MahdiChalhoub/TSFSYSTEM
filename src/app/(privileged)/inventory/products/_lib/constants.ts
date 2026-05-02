/**
 * Product Manager — Constants & Config
 * ======================================
 */
import type { Filters, Lookups, ColumnDef, FilterDef } from './types'
import { EMPTY_RANGE } from '@/components/ui/NumericRangeFilter'
export { EMPTY_RANGE }

/* ─── Type & Status Config Maps ─── */

export const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  STOCKABLE: { label: 'Stockable', color: 'var(--app-success, #22c55e)' },
  COMBO: { label: 'Combo', color: 'var(--app-accent)' },
  STANDARD: { label: 'Standard', color: 'var(--app-info, #3b82f6)' },
}

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'var(--app-success, #22c55e)' },
  INACTIVE: { label: 'Inactive', color: 'var(--app-muted-foreground)' },
  DRAFT: { label: 'Draft', color: 'var(--app-warning, #f59e0b)' },
  ARCHIVED: { label: 'Archived', color: 'var(--app-error, #ef4444)' },
}

// Re-export the canonical procurement-status config so existing consumers
// keep working unchanged. The single source of truth lives in
// `@/lib/procurement-status` and is shared across /inventory/products,
// /inventory/requests, and /purchases/new.
export { PIPELINE_STATUS_CONFIG } from '@/lib/procurement-status'

/* ─── Formatters ─── */

export const fmt = (n: number | string | null | undefined) => {
  if (n == null || n === '') return '—'
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
}

/* ─── Empty Defaults ─── */

export const EMPTY_FILTERS: Filters = {
  type: '', category: '', brand: '', unit: '', country: '', parfum: '',
  status: '', completeness: '', verified: '', isActive: '', catalogReady: '',
  expiryTracked: '', tracksLots: '', tracksSerials: '',
  lotMgmt: '', valuation: '', productGroup: '', pricingSource: '', syncStatus: '',
  stockLevel: { ...EMPTY_RANGE }, priceRange: { ...EMPTY_RANGE, field: 'selling' },
  costRange: { ...EMPTY_RANGE }, margin: { ...EMPTY_RANGE },
  tvaRange: { ...EMPTY_RANGE }, availableRange: { ...EMPTY_RANGE },
  reservedRange: { ...EMPTY_RANGE }, expiryDays: { ...EMPTY_RANGE },
}

export const EMPTY_LOOKUPS: Lookups = { categories: [], brands: [], units: [], countries: [] }

/* ─── Column Definitions ─── */

export const ALL_COLUMNS: ColumnDef[] = [
  // ── Core identity ──
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'brand', label: 'Brand', defaultVisible: true },
  { key: 'barcode', label: 'Barcode', defaultVisible: false },
  { key: 'description', label: 'Description', defaultVisible: false },
  { key: 'parfum', label: 'Parfum', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'country', label: 'Country', defaultVisible: false },
  { key: 'size', label: 'Size', defaultVisible: false },
  // ── Pricing ──
  { key: 'cost', label: 'Cost Price', defaultVisible: true },
  { key: 'costHt', label: 'Cost HT', defaultVisible: false },
  { key: 'costTtc', label: 'Cost TTC', defaultVisible: false },
  { key: 'price', label: 'Selling TTC', defaultVisible: true },
  { key: 'sellingHt', label: 'Selling HT', defaultVisible: false },
  { key: 'tva', label: 'TVA Rate', defaultVisible: false },
  { key: 'margin', label: 'Margin %', defaultVisible: false },
  // ── Stock ──
  { key: 'stock', label: 'On Hand Qty', defaultVisible: true },
  { key: 'available', label: 'Available Qty', defaultVisible: false },
  { key: 'reserved', label: 'Reserved Qty', defaultVisible: false },
  { key: 'incoming', label: 'Incoming Qty', defaultVisible: false },
  { key: 'outgoing', label: 'Outgoing Qty', defaultVisible: false },
  { key: 'minStock', label: 'Min Stock', defaultVisible: false },
  { key: 'maxStock', label: 'Max Stock', defaultVisible: false },
  { key: 'reorderPoint', label: 'Reorder Point', defaultVisible: false },
  { key: 'reorderQty', label: 'Reorder Qty', defaultVisible: false },
  // ── Status & Governance ──
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'procurement', label: 'Pipeline', defaultVisible: true },
  { key: 'isActive', label: 'Active', defaultVisible: false },
  { key: 'completeness', label: 'Completeness', defaultVisible: false },
  { key: 'completenessLvl', label: 'Completeness Level', defaultVisible: false },
  { key: 'verified', label: 'Verified', defaultVisible: false },
  { key: 'verifiedAt', label: 'Verified Date', defaultVisible: false },
  { key: 'catalogReady', label: 'Catalog Ready', defaultVisible: false },
  // ── Tracking & Logistics ──
  { key: 'expiry', label: 'Expiry Tracked', defaultVisible: false },
  { key: 'shelfLife', label: 'Shelf Life (days)', defaultVisible: false },
  { key: 'tracksLots', label: 'Tracks Lots', defaultVisible: false },
  { key: 'tracksSerials', label: 'Tracks Serials', defaultVisible: false },
  { key: 'lotMgmt', label: 'Lot Management', defaultVisible: false },
  { key: 'valuation', label: 'Cost Valuation', defaultVisible: false },
  // ── Group & Sync ──
  { key: 'productGroup', label: 'Product Group', defaultVisible: false },
  { key: 'pricingSource', label: 'Pricing Source', defaultVisible: false },
  { key: 'syncStatus', label: 'Sync Status', defaultVisible: false },
  // ── Dates ──
  { key: 'createdAt', label: 'Created', defaultVisible: false },
  { key: 'updatedAt', label: 'Updated', defaultVisible: false },
]

/* ─── Filter Definitions ─── */

export const ALL_FILTERS: FilterDef[] = [
  // ── Identity ──
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: true },
  { key: 'brand', label: 'Brand', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: true },
  { key: 'parfum', label: 'Parfum', defaultVisible: false },
  // ── Status & Governance ──
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'completeness', label: 'Completeness', defaultVisible: true },
  { key: 'verified', label: 'Verified', defaultVisible: true },
  { key: 'isActive', label: 'Active', defaultVisible: false },
  { key: 'catalogReady', label: 'Catalog Ready', defaultVisible: false },
  // ── Tracking ──
  { key: 'expiryTracked', label: 'Expiry Tracking', defaultVisible: true },
  { key: 'tracksLots', label: 'Tracks Lots', defaultVisible: false },
  { key: 'tracksSerials', label: 'Tracks Serials', defaultVisible: false },
  { key: 'lotMgmt', label: 'Lot Management', defaultVisible: false },
  { key: 'valuation', label: 'Cost Valuation', defaultVisible: false },
  // ── Group & Sync ──
  { key: 'productGroup', label: 'Product Group', defaultVisible: false },
  { key: 'pricingSource', label: 'Pricing Source', defaultVisible: false },
  { key: 'syncStatus', label: 'Sync Status', defaultVisible: false },
  // ── Numeric Ranges ──
  { key: 'stockLevel', label: 'Stock Level', defaultVisible: true },
  { key: 'availableRange', label: 'Available Qty', defaultVisible: false },
  { key: 'reservedRange', label: 'Reserved Qty', defaultVisible: false },
  { key: 'priceRange', label: 'Selling Price', defaultVisible: true },
  { key: 'costRange', label: 'Cost Price', defaultVisible: false },
  { key: 'tvaRange', label: 'TVA Rate %', defaultVisible: false },
  { key: 'margin', label: 'Margin %', defaultVisible: true },
  { key: 'expiryDays', label: 'Shelf Life Days', defaultVisible: false },
]

/* ─── Derived Defaults ─── */

export const DEFAULT_VISIBLE_COLS = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))
export const DEFAULT_VISIBLE_FILTERS = Object.fromEntries(ALL_FILTERS.map(f => [f.key, f.defaultVisible]))

/* ─── Column Width & Alignment Maps ─── */

export const COLUMN_WIDTHS: Record<string, string> = {
  type: 'w-20', category: 'w-20', brand: 'w-20', barcode: 'w-24',
  description: 'w-32', parfum: 'w-20', unit: 'w-16', country: 'w-16',
  size: 'w-14', cost: 'w-20', costHt: 'w-20', costTtc: 'w-20',
  price: 'w-24', sellingHt: 'w-20', tva: 'w-14', margin: 'w-16',
  stock: 'w-16', available: 'w-16', reserved: 'w-16', incoming: 'w-16',
  outgoing: 'w-16', minStock: 'w-14', maxStock: 'w-14',
  reorderPoint: 'w-16', reorderQty: 'w-16', status: 'w-16', procurement: 'w-24',
  isActive: 'w-14', completeness: 'w-20', completenessLvl: 'w-10',
  verified: 'w-14', verifiedAt: 'w-20', catalogReady: 'w-14',
  expiry: 'w-14', shelfLife: 'w-16', tracksLots: 'w-14', tracksSerials: 'w-14',
  lotMgmt: 'w-16', valuation: 'w-16', productGroup: 'w-24',
  pricingSource: 'w-16', syncStatus: 'w-16', createdAt: 'w-20', updatedAt: 'w-20',
}

export const RIGHT_ALIGNED_COLS = new Set([
  'cost', 'costHt', 'costTtc', 'price', 'sellingHt', 'tva', 'margin',
  'stock', 'available', 'reserved', 'incoming', 'outgoing',
  'minStock', 'maxStock', 'reorderPoint', 'reorderQty', 'shelfLife',
])

export const CENTER_ALIGNED_COLS = new Set([
  'verified', 'isActive', 'catalogReady', 'tracksLots', 'tracksSerials',
  'completenessLvl', 'expiry',
])

/** Columns that absorb extra horizontal space.
 *  Mix of text-heavy (wide content) + medium (badge/label) so the slack
 *  divides into small, even shares — no single column hogs the leftover.
 *  Tight numeric columns (cost, price, stock, qty) stay at their Tailwind
 *  width because their content is 1-3 chars; growing them produces awkward
 *  whitespace next to the tiny number. */
export const GROW_COLS = new Set([
  // Text-heavy
  'category', 'brand', 'description', 'parfum', 'productGroup', 'unit', 'country',
  // Medium badges/labels (still benefit from a few extra px)
  'type', 'status', 'procurement', 'completeness', 'pricingSource', 'syncStatus',
  // Identifiers
  'barcode',
])

/* ─── Completeness Levels ─── */

export const COMPLETENESS_LEVELS = [
  { value: 'Draft', label: 'L0 — Draft' },
  { value: 'Identified', label: 'L1 — Identified' },
  { value: 'Priced', label: 'L2 — Priced' },
  { value: 'Inventoried', label: 'L3 — Inventoried' },
  { value: 'Grouped', label: 'L4 — Grouped' },
  { value: 'Packaged', label: 'L5 — Packaged' },
  { value: 'Sourced', label: 'L6 — Sourced' },
  { value: 'Complete', label: 'L7 — Complete' },
]
