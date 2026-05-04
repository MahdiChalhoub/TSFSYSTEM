/**
 * Product Manager — Filter Logic
 * ================================
 * Pure functions for applying filters to product arrays.
 */
import type { Product, Filters, NumericRange } from './types'

/* ─── Numeric Range Match ─── */

export function matchesNumericRange(val: number, range: NumericRange): boolean {
  if (!range.op) return true
  const a = parseFloat(range.a) || 0
  const b = parseFloat(range.b) || 0
  switch (range.op) {
    case 'eq': return val === a
    case 'gt': return val > a
    case 'gte': return val >= a
    case 'lt': return val < a
    case 'lte': return val <= a
    case 'between': return val >= a && val <= b
    default: return true
  }
}

/* ─── String Filter Match ─── */

export function matchStr(filterVal: string, fieldVal: string | undefined): boolean {
  if (!filterVal) return true
  const isNot = filterVal.startsWith('!')
  const raw = isNot ? filterVal.slice(1) : filterVal
  if (raw === '__NONE__') {
    const isEmpty = !fieldVal || fieldVal.trim() === ''
    return isNot ? !isEmpty : isEmpty
  }
  return isNot ? fieldVal !== raw : fieldVal === raw
}

/* ─── Boolean Filter Match ─── */

export function matchBool(fv: string, val: boolean | undefined): boolean {
  if (!fv) return true
  if (fv === 'yes') return !!val
  if (fv === 'no') return !val
  if (fv === '!yes') return !val
  if (fv === '!no') return !!val
  return true
}

/* ─── Apply All Filters ─── */

export function applyFilters(items: Product[], search: string, filters: Filters): Product[] {
  return items.filter(p => {
    // Text search
    if (search) {
      const q = search.toLowerCase()
      const match = (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      if (!match) return false
    }

    // String filters
    if (!matchStr(filters.type, p.product_type)) return false
    if (!matchStr(filters.category, p.category_name)) return false
    if (!matchStr(filters.brand, p.brand_name)) return false
    if (!matchStr(filters.unit, p.unit_name)) return false
    if (!matchStr(filters.country, p.country_name)) return false
    if (!matchStr(filters.status, p.status)) return false
    if (!matchStr(filters.completeness, p.completeness_label)) return false
    // Parfum filter matches against either:
    //   - the legacy `parfum_name` FK (deprecated but still populated on
    //     pre-migration products), OR
    //   - any name in `attribute_value_names` (the new dynamic-attribute
    //     system: products link to a Parfum attribute value via the
    //     `attribute_values` M2M).
    // This keeps both pre- and post-migration products filterable while we
    // phase out the standalone Parfum model.
    if (filters.parfum) {
      const isNot = filters.parfum.startsWith('!')
      const raw = isNot ? filters.parfum.slice(1) : filters.parfum
      const attrNames: string[] = (p as any).attribute_value_names || []
      let matches: boolean
      if (raw === '__NONE__') {
        matches = !p.parfum_name && attrNames.length === 0
      } else {
        matches = p.parfum_name === raw || attrNames.includes(raw)
      }
      if (isNot ? matches : !matches) return false
    }
    // Pipeline status — the canonical procurement-lifecycle key resolved
    // server-side (see ProductSerializer.get_pipeline_status). matchStr
    // gives us '!key' negation and `__NONE__` for "no active pipeline" out
    // of the box.
    if (!matchStr(filters.pipeline, p.pipeline_status)) return false
    if (!matchStr(filters.lotMgmt, p.lot_management)) return false
    if (!matchStr(filters.valuation, p.cost_valuation_method)) return false
    if (!matchStr(filters.productGroup, p.product_group_name)) return false
    if (!matchStr(filters.pricingSource, p.pricing_source)) return false
    if (!matchStr(filters.syncStatus, p.group_sync_status)) return false

    // Boolean filters
    if (!matchBool(filters.expiryTracked, p.is_expiry_tracked)) return false
    if (!matchBool(filters.verified, p.is_verified)) return false
    if (!matchBool(filters.isActive, p.is_active)) return false
    if (!matchBool(filters.catalogReady, p.catalog_ready)) return false
    if (!matchBool(filters.tracksLots, p.tracks_lots)) return false
    if (!matchBool(filters.tracksSerials, p.tracks_serials)) return false

    // Numeric range filters
    if (filters.stockLevel.op) {
      if (!matchesNumericRange(p.on_hand_qty ?? 0, filters.stockLevel)) return false
    }
    if (filters.availableRange.op) {
      if (!matchesNumericRange(p.available_qty ?? 0, filters.availableRange)) return false
    }
    if (filters.reservedRange.op) {
      if (!matchesNumericRange(p.reserved_qty ?? 0, filters.reservedRange)) return false
    }
    if (filters.priceRange.op) {
      const field = filters.priceRange.field || 'selling'
      const price = field === 'selling_ht' ? parseFloat(p.selling_price_ht) || 0
        : parseFloat(p.selling_price_ttc) || 0
      if (!matchesNumericRange(price, filters.priceRange)) return false
    }
    if (filters.costRange.op) {
      const field = filters.costRange.field || 'cost'
      const cost = field === 'cost_ht' ? parseFloat(p.cost_price_ht) || 0
        : field === 'cost_ttc' ? parseFloat(p.cost_price_ttc) || 0
          : parseFloat(p.cost_price) || 0
      if (!matchesNumericRange(cost, filters.costRange)) return false
    }
    if (filters.tvaRange.op) {
      if (!matchesNumericRange(parseFloat(p.tva_rate) || 0, filters.tvaRange)) return false
    }
    if (filters.margin.op) {
      const sell = parseFloat(p.selling_price_ht) || 0
      const cost = parseFloat(p.cost_price) || 0
      const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0
      if (!matchesNumericRange(margin, filters.margin)) return false
    }
    if (filters.expiryDays.op) {
      if (!matchesNumericRange(p.manufacturer_shelf_life_days ?? 0, filters.expiryDays)) return false
    }

    return true
  })
}

/* ─── Active Filter Count ─── */

export function countActiveFilters(filters: Filters): number {
  let count = 0
  for (const [, v] of Object.entries(filters)) {
    if (typeof v === 'string' && v !== '') count++
    else if (typeof v === 'object' && v?.op !== '') count++
  }
  return count
}
