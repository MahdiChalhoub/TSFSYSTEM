'use client'

/**
 * PO Filters Panel
 * ==================
 * Renders the dynamic filter controls for Purchase Orders.
 * Uses shared SearchableDropdown + NumericRangeFilter from @/components/ui/.
 */

import { useMemo } from 'react'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { NumericRangeFilter } from '@/components/ui/NumericRangeFilter'
import type { PO, Filters } from '../_lib/types'
import { STATUS_CONFIG, PRIORITY_OPTIONS, SUBTYPE_OPTIONS, INVOICE_POLICY_OPTIONS } from '../_lib/constants'

interface POFiltersPanelProps {
  orders: PO[]
  filters: Filters
  setFilters: (f: Filters) => void
  isOpen: boolean
  visibleFilters: Record<string, boolean>
}

export function POFiltersPanel({ orders, filters, setFilters, isOpen, visibleFilters: vf }: POFiltersPanelProps) {
  const suppliers = useMemo(() => {
    const s = new Map<string, string>()
    orders.forEach(o => {
      const name = o.supplier?.name || o.supplier_name || o.supplier_display
      if (name) s.set(name, name)
    })
    return [...s.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([v]) => ({ value: v, label: v }))
  }, [orders])

  const warehouses = useMemo(() => {
    const w = new Map<string, string>()
    orders.forEach(o => { if (o.warehouse?.name) w.set(String(o.warehouse.id), o.warehouse.name) })
    return [...w.entries()].map(([v, l]) => ({ value: v, label: l }))
  }, [orders])

  const currencies = useMemo(() =>
    [...new Set(orders.map(o => o.currency).filter(Boolean))].sort().map(c => ({ value: c, label: c })),
    [orders]
  )

  if (!isOpen) return null

  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-200 p-3 rounded-2xl border border-app-border/50"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        {vf.status !== false && (
          <SearchableDropdown value={filters.status} onChange={v => setFilters({ ...filters, status: v })}
            options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder="All Statuses" label="Status" />
        )}
        {vf.priority !== false && (
          <SearchableDropdown value={filters.priority} onChange={v => setFilters({ ...filters, priority: v })}
            options={PRIORITY_OPTIONS} placeholder="All Priorities" label="Priority" />
        )}
        {vf.purchaseSubType !== false && (
          <SearchableDropdown value={filters.purchaseSubType} onChange={v => setFilters({ ...filters, purchaseSubType: v })}
            options={SUBTYPE_OPTIONS} placeholder="All Types" label="Purchase Type" />
        )}
        {vf.supplier !== false && (
          <SearchableDropdown value={filters.supplier} onChange={v => setFilters({ ...filters, supplier: v })}
            options={suppliers} placeholder="All Suppliers" label="Supplier" />
        )}
        {vf.warehouse && (
          <SearchableDropdown value={filters.warehouse} onChange={v => setFilters({ ...filters, warehouse: v })}
            options={warehouses} placeholder="All Warehouses" label="Warehouse" />
        )}
        {vf.currency && (
          <SearchableDropdown value={filters.currency} onChange={v => setFilters({ ...filters, currency: v })}
            options={currencies} placeholder="All Currencies" label="Currency" />
        )}
        {vf.amountRange !== false && (
          <NumericRangeFilter value={filters.amountRange} onChange={v => setFilters({ ...filters, amountRange: v })} label="Total Amount" />
        )}
        {vf.invoicePolicy && (
          <SearchableDropdown value={filters.invoicePolicy} onChange={v => setFilters({ ...filters, invoicePolicy: v })}
            options={INVOICE_POLICY_OPTIONS} placeholder="All Policies" label="Invoice Policy" />
        )}
      </div>
    </div>
  )
}
