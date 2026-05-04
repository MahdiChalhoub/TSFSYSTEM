'use client'

/**
 * Filters Panel
 * ==============
 * Grid of searchable dropdowns and numeric range filters.
 */

import { useMemo } from 'react'
import type { Product, Filters, Lookups } from '../_lib/types'
import { TYPE_CONFIG, STATUS_CONFIG, COMPLETENESS_LEVELS } from '../_lib/constants'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { NumericRangeFilter } from '@/components/ui/NumericRangeFilter'

interface FiltersPanelProps {
  items: Product[]
  filters: Filters
  setFilters: (f: Filters) => void
  isOpen: boolean
  lookups: Lookups
  visibleFilters: Record<string, boolean>
}

// Source: apps/inventory/services/readiness_service.py::_check_catalog_ready
// A product counts as "Catalog Ready" when ALL three are true:
//   1. The `catalog_ready` flag is set (manual approval by an admin)
//   2. The product has an `image_url`
//   3. The product has a `catalog_description`
// To customize the criteria, edit `_check_catalog_ready`. To make a product
// catalog-ready: set the flag, upload an image, and write a description.
const CATALOG_READY_HINT =
  'A product is "Catalog Ready" when:\n' +
  '  • the catalog_ready flag is set (manual approval),\n' +
  '  • it has an image,\n' +
  '  • it has a catalog description.\n\n' +
  'Edit apps/inventory/services/readiness_service.py to change the criteria.'

export function FiltersPanel({ items, filters, setFilters, isOpen, lookups, visibleFilters }: FiltersPanelProps) {
  const types = useMemo(() => [...new Set(items.map(p => p.product_type).filter(Boolean))].sort(), [items])
  // ── SOURCE-OF-TRUTH FILTERS ──────────────────────────────────────────
  // These read from canonical masters (enum constants or `lookups`), not
  // from the loaded `items` slice. That way the dropdown shows every
  // possible value, not just what's already in use among visible products.
  const statuses = useMemo(() => Object.keys(STATUS_CONFIG), [])
  const parfumOptions = useMemo(() => (lookups.parfums || []).map(p => p.name).sort(), [lookups.parfums])
  const sourceCountries = useMemo(() => (lookups.countries || []).map(c => c.name).sort(), [lookups.countries])
  const supplierOptions = useMemo(() => (lookups.suppliers || []).map(s => s.name).sort(), [lookups.suppliers])
  // ── DATA-DERIVED FILTERS ─────────────────────────────────────────────
  // No clean master exists; derive from the current set so the filter is at
  // least usable. Replace with a master fetch when one is available.
  const lotMgmtModes = useMemo(() => [...new Set(items.map(p => p.lot_management).filter(Boolean))].sort(), [items])
  const valuationMethods = useMemo(() => [...new Set(items.map(p => p.cost_valuation_method).filter(Boolean))].sort(), [items])
  const productGroups = useMemo(() => [...new Set(items.map(p => p.product_group_name).filter(Boolean))].sort(), [items])
  const pricingSources = useMemo(() => [...new Set(items.map(p => p.pricing_source).filter(Boolean))].sort(), [items])
  const syncStatuses = useMemo(() => [...new Set(items.map(p => p.group_sync_status).filter(v => v && v !== 'N/A'))].sort(), [items])

  if (!isOpen) return null
  const vf = visibleFilters || {}

  const upd = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })

  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-200 p-3 rounded-2xl border border-app-border/50"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>

        {vf.type !== false && <SearchableDropdown label="Type" value={filters.type} onChange={v => upd({ type: v })}
          options={[{ value: '__NONE__', label: '— No Type —' }, ...types.map(t => ({ value: t, label: TYPE_CONFIG[t]?.label || t }))]} placeholder="All Types" />}

        {vf.category !== false && <SearchableDropdown label="Category" value={filters.category} onChange={v => upd({ category: v })}
          options={[{ value: '__NONE__', label: '— No Category —' }, ...lookups.categories.map(c => ({ value: c.name, label: c.name }))]} placeholder="All Categories" />}

        {vf.brand !== false && <SearchableDropdown label="Brand" value={filters.brand} onChange={v => upd({ brand: v })}
          options={[{ value: '__NONE__', label: '— No Brand —' }, ...lookups.brands.map(b => ({ value: b.name, label: b.name }))]} placeholder="All Brands" />}

        {vf.unit !== false && <SearchableDropdown label="Unit" value={filters.unit} onChange={v => upd({ unit: v })}
          options={[{ value: '__NONE__', label: '— No Unit —' }, ...lookups.units.map(u => ({ value: u.name, label: `${u.name}${u.short_name ? ` (${u.short_name})` : ''}` }))]} placeholder="All Units" />}

        {vf.country !== false && <SearchableDropdown label="Country" value={filters.country} onChange={v => upd({ country: v })}
          options={[{ value: '__NONE__', label: '— No Country —' }, ...sourceCountries.map(c => ({ value: c, label: c }))]} placeholder="All Countries" />}

        {vf.status !== false && <SearchableDropdown label="Status" value={filters.status} onChange={v => upd({ status: v })}
          options={[{ value: '__NONE__', label: '— No Status —' }, ...statuses.map(s => ({ value: s, label: STATUS_CONFIG[s]?.label || s }))]} placeholder="All Statuses" />}

        {vf.completeness !== false && <SearchableDropdown label="Completeness" value={filters.completeness} onChange={v => upd({ completeness: v })}
          options={[{ value: '__NONE__', label: '— No Level —' }, ...COMPLETENESS_LEVELS]} placeholder="All Levels" />}

        {vf.verified !== false && <SearchableDropdown label="Verified" value={filters.verified} onChange={v => upd({ verified: v })}
          options={[{ value: 'yes', label: 'Verified ✅' }, { value: 'no', label: 'Not Verified' }]} placeholder="All" />}

        {vf.expiryTracked !== false && <SearchableDropdown label="Expiry Tracking" value={filters.expiryTracked} onChange={v => upd({ expiryTracked: v })}
          options={[{ value: 'yes', label: 'Tracked' }, { value: 'no', label: 'Not Tracked' }]} placeholder="All" />}

        {vf.isActive !== false && <SearchableDropdown label="Active" value={filters.isActive} onChange={v => upd({ isActive: v })}
          options={[{ value: 'yes', label: 'Active ✅' }, { value: 'no', label: 'Inactive ❌' }]} placeholder="All" />}

        {vf.catalogReady !== false && (
          <div title={CATALOG_READY_HINT}>
            <SearchableDropdown label="Catalog Ready" value={filters.catalogReady} onChange={v => upd({ catalogReady: v })}
              options={[{ value: 'yes', label: 'Ready ✅' }, { value: 'no', label: 'Not Ready' }]} placeholder="All" />
          </div>
        )}

        {vf.tracksLots !== false && <SearchableDropdown label="Tracks Lots" value={filters.tracksLots} onChange={v => upd({ tracksLots: v })}
          options={[{ value: 'yes', label: 'Yes ✅' }, { value: 'no', label: 'No' }]} placeholder="All" />}

        {vf.tracksSerials !== false && <SearchableDropdown label="Tracks Serials" value={filters.tracksSerials} onChange={v => upd({ tracksSerials: v })}
          options={[{ value: 'yes', label: 'Yes ✅' }, { value: 'no', label: 'No' }]} placeholder="All" />}

        {vf.parfum !== false && <SearchableDropdown label="Parfum" value={filters.parfum} onChange={v => upd({ parfum: v })}
          options={[{ value: '__NONE__', label: '— No Parfum —' }, ...parfumOptions.map(p => ({ value: p, label: p }))]} placeholder="All Parfums" />}

        {vf.supplier !== false && <SearchableDropdown label="Supplier" value={filters.supplier} onChange={v => upd({ supplier: v })}
          options={[{ value: '__NONE__', label: '— No Supplier —' }, ...supplierOptions.map(s => ({ value: s, label: s }))]} placeholder="All Suppliers" />}

        {vf.lotMgmt !== false && <SearchableDropdown label="Lot Management" value={filters.lotMgmt} onChange={v => upd({ lotMgmt: v })}
          options={[{ value: '__NONE__', label: '— None —' }, ...lotMgmtModes.map(m => ({ value: m, label: m }))]} placeholder="All" />}

        {vf.valuation !== false && <SearchableDropdown label="Cost Valuation" value={filters.valuation} onChange={v => upd({ valuation: v })}
          options={[{ value: '__NONE__', label: '— None —' }, ...valuationMethods.map(m => ({ value: m, label: m }))]} placeholder="All" />}

        {vf.productGroup !== false && <SearchableDropdown label="Product Group" value={filters.productGroup} onChange={v => upd({ productGroup: v })}
          options={[{ value: '__NONE__', label: '— No Group —' }, ...productGroups.map(g => ({ value: g, label: g }))]} placeholder="All Groups" />}

        {vf.pricingSource !== false && <SearchableDropdown label="Pricing Source" value={filters.pricingSource} onChange={v => upd({ pricingSource: v })}
          options={[{ value: '__NONE__', label: '— None —' }, ...pricingSources.map(s => ({ value: s, label: s }))]} placeholder="All" />}

        {vf.syncStatus !== false && <SearchableDropdown label="Sync Status" value={filters.syncStatus} onChange={v => upd({ syncStatus: v })}
          options={[{ value: '__NONE__', label: '— None —' }, ...syncStatuses.map(s => ({ value: s, label: s }))]} placeholder="All" />}

        {vf.stockLevel !== false && <NumericRangeFilter label="Stock Level" value={filters.stockLevel} onChange={v => upd({ stockLevel: v })} />}
        {vf.availableRange !== false && <NumericRangeFilter label="Available Qty" value={filters.availableRange} onChange={v => upd({ availableRange: v })} />}
        {vf.reservedRange !== false && <NumericRangeFilter label="Reserved Qty" value={filters.reservedRange} onChange={v => upd({ reservedRange: v })} />}

        {vf.priceRange !== false && <NumericRangeFilter label="Selling Price" value={filters.priceRange} onChange={v => upd({ priceRange: v })}
          fieldOptions={[{ value: 'selling', label: 'Selling Price TTC' }, { value: 'selling_ht', label: 'Selling Price HT' }]} />}

        {vf.costRange !== false && <NumericRangeFilter label="Cost Price" value={filters.costRange} onChange={v => upd({ costRange: v })}
          fieldOptions={[{ value: 'cost', label: 'Cost Price' }, { value: 'cost_ht', label: 'Cost HT' }, { value: 'cost_ttc', label: 'Cost TTC' }]} />}

        {vf.tvaRange !== false && <NumericRangeFilter label="TVA Rate %" value={filters.tvaRange} onChange={v => upd({ tvaRange: v })} />}
        {vf.margin !== false && <NumericRangeFilter label="Margin %" value={filters.margin} onChange={v => upd({ margin: v })} />}
        {vf.expiryDays !== false && <NumericRangeFilter label="Shelf Life Days" value={filters.expiryDays} onChange={v => upd({ expiryDays: v })} />}

      </div>
    </div>
  )
}
