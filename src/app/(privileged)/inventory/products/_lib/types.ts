/**
 * Product Manager — Shared Types
 * ===============================
 */

// NumericRange is defined in @/components/ui/NumericRangeFilter — re-exported for local convenience
import type { NumericRange } from '@/components/ui/NumericRangeFilter'
export type { NumericRange }

export type Product = Record<string, any>

export interface Filters {
  type: string
  category: string
  brand: string
  unit: string
  country: string
  parfum: string
  supplier: string
  status: string
  completeness: string
  verified: string
  isActive: string
  catalogReady: string
  expiryTracked: string
  tracksLots: string
  tracksSerials: string
  lotMgmt: string
  valuation: string
  productGroup: string
  pricingSource: string
  syncStatus: string
  stockLevel: NumericRange
  priceRange: NumericRange
  costRange: NumericRange
  margin: NumericRange
  tvaRange: NumericRange
  availableRange: NumericRange
  reservedRange: NumericRange
  expiryDays: NumericRange
}

export type Lookup = { id: number; name: string; short_name?: string }
export type Lookups = {
  categories: Lookup[]
  brands: Lookup[]
  units: Lookup[]
  /** Tenant-enabled sourcing countries (the canonical list from
   *  `reference/sourcing-countries/`). The Country filter pulls from here,
   *  not from the products themselves — otherwise filtering for a country
   *  that no product currently uses would be impossible. */
  countries: Lookup[]
  /** Catalogue-wide list of parfums (the master). Same reasoning — filter
   *  options should reflect what's available, not what's already been
   *  assigned to products. */
  parfums?: Lookup[]
  /** CRM contacts of type=SUPPLIER. Powers the Supplier filter so the user
   *  can narrow a product list to items quoted by a specific vendor. */
  suppliers?: Lookup[]
}

export type ViewProfile = {
  id: string
  name: string
  columns: Record<string, boolean>
  filters: Record<string, boolean>
  columnOrder?: string[]  // custom column ordering — keys from ALL_COLUMNS
  is_shared?: boolean
}

export type ColumnDef = { key: string; label: string; defaultVisible: boolean }
export type FilterDef = { key: string; label: string; defaultVisible: boolean }
