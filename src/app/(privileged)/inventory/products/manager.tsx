// @ts-nocheck
'use client'

/**
 * Product Master — Orchestrator
 * ==============================
 * Central registry of all products with comprehensive filtering.
 *
 * Design Language: COA / Categories pattern (Dajingo Pro V2)
 *
 * REFACTORED: April 2026
 * Decomposed from a 2,165-line monolith into modular components.
 * See _lib/ for types, constants, filters, profiles.
 * See _components/ for ProductRow, FiltersPanel, CustomizePanel, etc.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Package, Box, Layers,
  X, Maximize2, Minimize2, SlidersHorizontal,
  AlertTriangle, RefreshCcw, Settings2, DollarSign,
  ShoppingCart, ArrowRightLeft, Edit,
} from 'lucide-react'

/* ── Lib imports ── */
import type { Product, Filters, Lookups, ViewProfile } from './_lib/types'
import {
  ALL_COLUMNS, COLUMN_WIDTHS, RIGHT_ALIGNED_COLS, CENTER_ALIGNED_COLS, GROW_COLS,
  EMPTY_FILTERS, EMPTY_LOOKUPS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS, fmt,
  TYPE_CONFIG,
} from './_lib/constants'
import { applyFilters, countActiveFilters } from './_lib/filters'
import { loadProfiles, saveProfiles, loadActiveProfileId, saveActiveProfileId, syncProfileToBackend, loadProfileFromBackend } from './_lib/profiles'

/* ── Component imports ── */
import { FiltersPanel } from './_components/FiltersPanel'
import { CustomizePanel } from './_components/CustomizePanel'
import type { KPIStat } from '@/components/ui/KPIStrip'
import { DajingoListView } from '@/components/common/DajingoListView'
import { DajingoPageShell } from '@/components/common/DajingoPageShell'
import { ProductDetailCards } from './_components/ProductDetailCards'
import { renderProductCell } from './_components/ProductColumns'
import { ProductThumbnail } from '@/components/products/ProductThumbnail'
import { type RequestableProduct } from '@/components/products/RequestProductDialog'
import { RequestFlowProvider, useRequestFlow } from '@/components/products/RequestFlowProvider'

function toRequestable(p: Product): RequestableProduct {
  return {
    id: p.id, name: p.name, sku: p.sku,
    reorder_quantity: p.reorder_quantity, min_stock_level: p.min_stock_level,
    procurement_status: p.procurement_status,
  }
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */

export default function ProductMasterManager({ initialProducts = [], totalProductCount, lookups = EMPTY_LOOKUPS }: { initialProducts?: Product[]; totalProductCount?: number; lookups?: Lookups; initialFilters?: Record<string, string> }) {
  const router = useRouter()
  const { openTab } = useAdmin()
  const { trigger: triggerRequest } = useRequestFlow()
  const [items, setItems] = useState<Product[]>(initialProducts)
  // True total in the DB — survives even when `items` is a paginated slice.
  // Falls back to items.length when the page wasn't paginated server-side.
  const [serverTotal, setServerTotal] = useState<number>(totalProductCount ?? initialProducts.length)
  const [loading, setLoading] = useState(initialProducts.length === 0)
  const [search, setSearch] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [profiles, setProfiles] = useState<ViewProfile[]>(() => loadProfiles())
  const [activeProfileId, setActiveProfileId] = useState(() => loadActiveProfileId())
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0]
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(activeProfile?.columns || DEFAULT_VISIBLE_COLS)
  const [visibleFilters, setVisibleFilters] = useState<Record<string, boolean>>(activeProfile?.filters || DEFAULT_VISIBLE_FILTERS)
  const [columnOrder, setColumnOrder] = useState<string[]>(activeProfile?.columnOrder || ALL_COLUMNS.map(c => c.key))
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  // ── SaaS ListViewPolicy enforcement ──
  const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
  const [policyHiddenFilters, setPolicyHiddenFilters] = useState<Set<string>>(new Set())
  useEffect(() => {
    getListViewPolicy('inventory_products').then(policy => {
      if (policy) {
        if (policy.hidden_columns?.length) setPolicyHiddenColumns(new Set(policy.hidden_columns))
        if (policy.hidden_filters?.length) setPolicyHiddenFilters(new Set(policy.hidden_filters))
      }
    }).catch(() => { /* no policy — allow everything */ })
  }, [])

  // ── Backend sync: load saved preferences on mount ──
  useEffect(() => {
    loadProfileFromBackend(profiles, activeProfileId).then(result => {
      if (result) {
        setProfiles(result.profiles)
        setVisibleColumns(result.columns)
        setVisibleFilters(result.filters)
        setColumnOrder(result.columnOrder)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effective columns: user prefs minus policy-hidden
  const effectiveVisibleColumns = useMemo<Record<string, boolean>>(() => {
    if (policyHiddenColumns.size === 0) return visibleColumns
    const eff = { ...visibleColumns }
    for (const key of policyHiddenColumns) eff[key] = false
    return eff
  }, [visibleColumns, policyHiddenColumns])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await erpFetch('products/')
      if (Array.isArray(data)) {
        setItems(data); setServerTotal(data.length)
      } else {
        const results = Array.isArray(data?.results) ? data.results : []
        setItems(results)
        setServerTotal(typeof data?.count === 'number' ? data.count : results.length)
      }
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (initialProducts.length === 0) fetchData() }, [fetchData, initialProducts.length])

  // ── Filtering (delegated to _lib/filters.ts) ──
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])
  const filtered = useMemo(() => applyFilters(items, search, filters), [items, search, filters])
  const hasFilters = !!search || activeFilterCount > 0

  // Reset to page 1 when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCurrentPage(1) }, [search, filters])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(currentPage, totalPages)
  const paginated = useMemo(() => {
    const start = (clampedPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, clampedPage, pageSize])

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const isAllPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id))
  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); paginated.forEach(p => next.delete(p.id)); return next })
    } else {
      setSelectedIds(prev => { const next = new Set(prev); paginated.forEach(p => next.add(p.id)); return next })
    }
  }

  // Stats
  const stats = useMemo(() => {
    const total = items.length
    const combos = items.filter(p => p.product_type === 'COMBO').length
    const outOfStock = items.filter(p => (p.on_hand_qty ?? 0) <= 0).length
    const avgPrice = total > 0 ? items.reduce((s, p) => s + (parseFloat(p.selling_price_ttc) || 0), 0) / total : 0
    return { total, combos, outOfStock, avgPrice }
  }, [items])

  const kpiStats: KPIStat[] = useMemo(() => [
    { label: 'Total Products', value: stats.total, icon: <Package size={11} />, color: 'var(--app-primary)' },
    { label: 'Combos', value: stats.combos, icon: <Layers size={11} />, color: '#8b5cf6' },
    { label: 'Out of Stock', value: stats.outOfStock, icon: <AlertTriangle size={11} />, color: 'var(--app-error, #ef4444)' },
    { label: 'Avg Price', value: fmt(Math.round(stats.avgPrice)), icon: <DollarSign size={11} />, color: 'var(--app-success, #22c55e)' },
  ], [stats])

  /* ═══════════════════════════════════════════════════════════
   *  RENDER
   * ═══════════════════════════════════════════════════════════ */
  return (
    <DajingoPageShell
      title="Product Master"
      icon={<Package size={20} className="text-white" />}
      subtitle={`${stats.total} Products · ${stats.combos} Combos · ${stats.outOfStock} Out of Stock`}
      entityLabel="Product"
      kpiStats={kpiStats}
      primaryAction={{
        label: 'New Product',
        icon: <Plus size={14} />,
        onClick: () => openTab('New Product', '/products/new'),
      }}
      search={search}
      onSearchChange={setSearch}
      searchRef={searchRef}
      searchPlaceholder="Search by name, SKU, or barcode... (Ctrl+K)"
      filteredCount={filtered.length}
      totalCount={stats.total}
      focusMode={focusMode}
      onFocusModeChange={setFocusMode}
      showFilters={showFilters}
      onToggleFilters={() => setShowFilters(!showFilters)}
      activeFilterCount={activeFilterCount}
      onRefresh={fetchData}
      dataTools={{
        title: 'Product Data',
        exportFilename: 'products',
        exportColumns: [
          { key: 'name', label: 'Name' },
          { key: 'sku', label: 'SKU', format: (p: Product) => p.sku || '' },
          { key: 'barcode', label: 'Barcode', format: (p: Product) => p.barcode || '' },
          { key: 'type', label: 'Type', format: (p: Product) => p.product_type || '' },
          { key: 'category', label: 'Category', format: (p: Product) => p.category_name || '' },
          { key: 'brand', label: 'Brand', format: (p: Product) => p.brand_name || '' },
          { key: 'unit', label: 'Unit', format: (p: Product) => p.unit_name || '' },
          { key: 'cost', label: 'Cost Price', format: (p: Product) => p.cost_price ?? '' },
          { key: 'selling', label: 'Selling Price', format: (p: Product) => p.selling_price ?? '' },
          { key: 'stock', label: 'On Hand Qty', format: (p: Product) => p.total_stock ?? 0 },
          { key: 'status', label: 'Status', format: (p: Product) => p.status || 'ACTIVE' },
        ],
        print: {
          title: 'Products',
          subtitle: 'Product Master Registry',
          prefKey: 'print.products',
          columns: [
            { key: 'name', label: 'Name', defaultOn: true },
            { key: 'sku', label: 'SKU', mono: true, defaultOn: true, width: '120px' },
            { key: 'type', label: 'Type', defaultOn: true, width: '80px' },
            { key: 'category', label: 'Category', defaultOn: true, width: '120px' },
            { key: 'brand', label: 'Brand', defaultOn: false, width: '100px' },
            { key: 'cost', label: 'Cost', align: 'right', defaultOn: true, width: '90px' },
            { key: 'selling', label: 'Selling', align: 'right', defaultOn: true, width: '90px' },
            { key: 'stock', label: 'Stock', align: 'right', defaultOn: true, width: '70px' },
            { key: 'status', label: 'Status', defaultOn: true, width: '80px' },
          ],
          rowMapper: (p: Product) => ({
            name: p.name,
            sku: p.sku || '',
            type: p.product_type || '',
            category: p.category_name || '',
            brand: p.brand_name || '',
            cost: p.cost_price != null ? fmt(p.cost_price) : '',
            selling: p.selling_price != null ? fmt(p.selling_price) : '',
            stock: p.total_stock ?? 0,
            status: p.status || 'ACTIVE',
          }),
        },
      }}
      data={items}
      renderFilters={() => (
        <FiltersPanel
          items={items}
          filters={filters}
          setFilters={setFilters}
          isOpen={showFilters}
          lookups={lookups}
          visibleFilters={visibleFilters}
        />
      )}
    >
      {/* ═══════════════ TREE TABLE (DajingoListView) ═══════════════ */}
      <DajingoListView<Product>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={r => r.id}
        columns={ALL_COLUMNS}
        visibleColumns={effectiveVisibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_ALIGNED_COLS}
        centerAlignedCols={CENTER_ALIGNED_COLS}
        growCols={GROW_COLS}
        columnOrder={columnOrder}
        onColumnReorder={newOrder => {
          setColumnOrder(newOrder)
          const updated = profiles.map(p => p.id === activeProfileId ? { ...p, columnOrder: newOrder } : p)
          setProfiles(updated); saveProfiles(updated)
          const ap = updated.find(p => p.id === activeProfileId)
          if (ap) syncProfileToBackend(ap)
        }}
        policyHiddenColumns={policyHiddenColumns}
        entityLabel="Product"
        /* ── Integrated Toolbar ── */
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, SKU, or barcode... (Ctrl+K)"
        searchRef={searchRef}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        activeFilterCount={activeFilterCount}
        onToggleCustomize={() => setShowCustomize(true)}
        /* ── Row rendering ── */
        renderRowIcon={product => {
          const tc = TYPE_CONFIG[product.product_type] || { label: product.product_type || '—', color: 'var(--app-muted-foreground)' }
          // Thumbnail when an image is set; falls back to the type icon. The
          // <img> uses native lazy-loading so off-screen rows don't fetch.
          return (
            <ProductThumbnail
              image={product.image}
              productType={product.product_type}
              name={product.name}
              size={28}
              className="rounded-lg"
              color={tc.color}
            />
          )
        }}
        renderRowTitle={product => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{product.name}</div>
            <div className="text-[10px] font-mono text-app-muted-foreground">
              {product.sku}
              {product.barcode && <span className="ml-2 opacity-60">⎸ {product.barcode}</span>}
            </div>
          </div>
        )}
        renderColumnCell={(key, product) => renderProductCell(key, product)}
        renderExpanded={product => <ProductDetailCards product={product} marginPct={(() => { const sellHt = parseFloat(product.selling_price_ht) || 0; const costP = parseFloat(product.cost_price) || 0; return sellHt > 0 ? (((sellHt - costP)) / (sellHt) * 100).toFixed(1) : '—' })()} onView={id => router.push(`/inventory/products/${id}`)} />}
        onView={product => router.push(`/inventory/products/${product.id}`)}
        menuActions={product => [
          { label: 'Request Purchase', icon: <ShoppingCart size={12} className="text-app-info" />, onClick: () => triggerRequest('PURCHASE', [toRequestable(product)]) },
          { label: 'Request Transfer', icon: <ArrowRightLeft size={12} className="text-app-warning" />, onClick: () => triggerRequest('TRANSFER', [toRequestable(product)]) },
          { label: 'Edit Product', icon: <Edit size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/inventory/products/${product.id}` }, separator: true },
        ]}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        isAllPageSelected={isAllPageSelected}
        onToggleSelectAll={toggleSelectAll}
        bulkActions={
          <>
            <button onClick={() => triggerRequest('PURCHASE', items.filter(p => selectedIds.has(p.id)).map(toRequestable))}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-info/30 text-app-info hover:bg-app-info/10 transition-all">
              <ShoppingCart size={11} /> Request Purchase
            </button>
            <button onClick={() => triggerRequest('TRANSFER', items.filter(p => selectedIds.has(p.id)).map(toRequestable))}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-warning/30 text-app-warning hover:bg-app-warning/10 transition-all">
              <ArrowRightLeft size={11} /> Request Transfer
            </button>
          </>
        }
        hasFilters={hasFilters}
        onClearFilters={() => { setSearch(''); setFilters(EMPTY_FILTERS) }}
        emptyIcon={<Package size={36} />}
        pagination={{
          // `totalItems` is the count the pagination buttons step through —
          // matches `totalPages`. `totalAvailable` is the truth from the
          // server (DRF `count`). When the two differ, the footer surfaces
          // "X of Y in catalog" so the user knows there's more than they
          // can see in this fetch.
          totalItems: filtered.length,
          totalAvailable: Math.max(serverTotal, items.length),
          activeFilterCount,
          currentPage: clampedPage,
          totalPages,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: n => { setPageSize(n); setCurrentPage(1) },
        }}
      />

      {/* Customize Panel */}
      <CustomizePanel isOpen={showCustomize} onClose={() => setShowCustomize(false)}
        visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns}
        visibleFilters={visibleFilters} setVisibleFilters={setVisibleFilters}
        columnOrder={columnOrder} setColumnOrder={setColumnOrder}
        profiles={profiles} setProfiles={setProfiles}
        activeProfileId={activeProfileId} setActiveProfileId={setActiveProfileId}
        policyHiddenColumns={policyHiddenColumns} policyHiddenFilters={policyHiddenFilters} />
    </DajingoPageShell>
  )
}
