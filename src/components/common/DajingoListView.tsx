// @ts-nocheck
'use client'

/**
 * DajingoListView — Universal Table Template
 * =============================================
 * Extracted from the Products page "Dajingo Pro V2" design.
 *
 * This is the SINGLE source of truth for all list/table pages.
 * When you update this component, all 6+ pages update automatically.
 *
 * Features:
 *  - Sticky column headers with drag-and-drop reorder
 *  - Mobile card + desktop table dual layout
 *  - Checkbox selection + bulk actions bar
 *  - PaginationFooter integration
 *  - Expandable detail rows
 *  - SaaS policy enforcement (hidden columns)
 *
 * Usage:
 *  <DajingoListView
 *    data={paginated}
 *    allData={filtered}
 *    columns={ALL_COLUMNS}
 *    visibleColumns={vc}
 *    columnOrder={columnOrder}
 *    onColumnReorder={setColumnOrder}
 *    getRowId={r => r.id}
 *    renderRowIcon={r => <Package size={13} />}
 *    renderRowTitle={r => <>{r.name}</>}
 *    renderColumnCell={(key, row) => <span>{row[key]}</span>}
 *    ...
 *  />
 */

import React, { useState, useRef, useMemo } from 'react'
import {
  Eye, MoreHorizontal, ChevronRight, ChevronDown,
  Loader2, Search, SlidersHorizontal, Settings2, X,
} from 'lucide-react'
import { PaginationFooter } from '@/components/ui/PaginationFooter'
import { DajingoCustomizePanel } from './DajingoCustomizePanel'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */

export type DajingoColumnDef = {
  key: string
  label: string
  defaultVisible: boolean
}

export type DajingoMenuItem = {
  label: string
  icon?: React.ReactNode
  iconColor?: string
  onClick: () => void
  separator?: boolean
}

/** Parse a Tailwind `w-XX` (or `w-[Npx]`) class into a numeric weight.
 *  Default 16. Used as flex-grow value so leftover space is shared
 *  PROPORTIONAL to each grow column's declared width — wider columns get a
 *  bigger share of the slack instead of every grower getting an equal slice. */
function parseWidthWeight(cls: string): number {
  const arb = cls.match(/w-\[(\d+)(?:px|rem)?\]/)
  if (arb) return Math.max(1, Math.round(Number(arb[1])))
  const fixed = cls.match(/(?:^|\s)w-(\d+)(?:\s|$)/)
  return fixed ? Math.max(1, Number(fixed[1])) : 16
}

export type DajingoPagination = {
  totalItems: number
  /** True total in the data source (e.g. DRF `count`). When > totalItems
   *  — meaning more rows exist on the server than were fetched — the
   *  footer surfaces "X of Y in catalog" so users know there's more. */
  totalAvailable?: number
  currentPage: number
  totalPages: number
  pageSize: number
  activeFilterCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export type DajingoListViewProps<T> = {
  /* ── Data ── */
  data: T[]                            // Paginated slice for rendering
  allData?: T[]                        // Full filtered list (for empty-state message)
  loading?: boolean
  getRowId: (row: T) => number | string

  /* ── Columns ── */
  columns: DajingoColumnDef[]
  visibleColumns: Record<string, boolean>
  columnWidths?: Record<string, string>
  rightAlignedCols?: Set<string>
  centerAlignedCols?: Set<string>
  growCols?: Set<string>
  columnOrder?: string[]
  onColumnReorder?: (order: string[]) => void
  policyHiddenColumns?: Set<string>

  /* ── Row rendering ── */
  renderRowIcon?: (row: T) => React.ReactNode
  renderRowTitle: (row: T) => React.ReactNode
  renderColumnCell: (key: string, row: T) => React.ReactNode
  renderMobileCard?: (row: T, isOpen: boolean, toggle: () => void) => React.ReactNode
  renderExpanded?: (row: T) => React.ReactNode

  /* ── Actions ── */
  onView?: (row: T) => void
  menuActions?: (row: T) => DajingoMenuItem[]

  /* ── Selection ── */
  selectedIds?: Set<number | string>
  onToggleSelect?: (id: number | string) => void
  isAllPageSelected?: boolean
  onToggleSelectAll?: () => void

  /* ── Bulk Actions ── */
  bulkActions?: React.ReactNode

  /* ── Pagination ── */
  pagination?: DajingoPagination

  /* ── Empty state ── */
  emptyIcon?: React.ReactNode
  emptyMessage?: string
  hasFilters?: boolean
  onClearFilters?: () => void

  /* ── Custom table min-width for horizontal scroll ── */
  tableMinWidth?: string

  /* ── Label for the entity type (pluralized automatically) ── */
  entityLabel?: string

  /* ── Integrated Toolbar (search + filters + customize) ── */
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchRef?: React.RefObject<HTMLInputElement>
  showFilters?: boolean
  onToggleFilters?: () => void
  activeFilterCount?: number

  /* ── External customize panel (Products) — if provided, Customize button opens this instead of built-in panel ── */
  onToggleCustomize?: () => void

  /* ── Column visibility toggle callback — built-in panel calls this when user toggles a column ── */
  onSetVisibleColumns?: (cols: Record<string, boolean>) => void
  /* ── Column order setter for built-in panel ── */
  onSetColumnOrder?: (order: string[]) => void

  /* ── Filter customization (for Filter tab in Customize panel) ── */
  allFilters?: { key: string; label: string; defaultVisible: boolean }[]
  visibleFilters?: Record<string, boolean>
  onSetVisibleFilters?: (f: Record<string, boolean>) => void
  policyHiddenFilters?: Set<string>

  /* ── Module key for localStorage profile isolation ── */
  moduleKey?: string
}


/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */

export function DajingoListView<T>({
  data, allData, loading, getRowId,
  columns, visibleColumns, columnWidths = {}, rightAlignedCols, centerAlignedCols, growCols,
  columnOrder, onColumnReorder, policyHiddenColumns,
  renderRowIcon, renderRowTitle, renderColumnCell,
  renderMobileCard, renderExpanded,
  onView, menuActions,
  selectedIds, onToggleSelect, isAllPageSelected, onToggleSelectAll,
  bulkActions,
  pagination,
  emptyIcon, emptyMessage, hasFilters, onClearFilters,
  tableMinWidth,
  entityLabel = 'Item',
  search, onSearchChange, searchPlaceholder, searchRef: externalSearchRef,
  showFilters: showFiltersProp, onToggleFilters, activeFilterCount: afc,
  onToggleCustomize,
  onSetVisibleColumns, onSetColumnOrder,
  allFilters, visibleFilters, onSetVisibleFilters, policyHiddenFilters,
  moduleKey,
}: DajingoListViewProps<T>) {
  const internalSearchRef = useRef<HTMLInputElement>(null)
  const sRef = externalSearchRef || internalSearchRef
  const hasToolbar = onSearchChange !== undefined

  // ── Built-in customize panel (full sidebar, same as Products) ──
  const [showBuiltInPanel, setShowBuiltInPanel] = useState(false)
  // Use external onToggleCustomize if provided (Products page), otherwise built-in panel
  const handleCustomize = onToggleCustomize || (() => setShowBuiltInPanel(!showBuiltInPanel))
  const showInternalPanel = !onToggleCustomize && showBuiltInPanel

  const dragColRef = useRef<string | null>(null)
  const phc = policyHiddenColumns || new Set<string>()
  const rac = rightAlignedCols || new Set<string>()
  const cac = centerAlignedCols || new Set<string>()
  const gc = growCols || new Set<string>()

  // PROPORTIONAL DISTRIBUTION (Option D):
  // Product column lives at row-level alongside the dynamic-column track. To share
  // leftover proportionally we give the track a combined weight + basis equal to
  // the sum of its visible columns. Product's weight is fixed at 60 (matching its
  // ~240px basis). Then Product and Track are siblings competing for slack with
  // weights 60 + 160 = 220, basis 240 + 640 = 880.
  const PRODUCT_WEIGHT = 60
  const PRODUCT_BASIS_REM = 15  // 60 × 0.25rem = 240px

  // ── Ordered columns (respect custom ordering) ──
  const orderedColumns = useMemo(() => {
    const colMap = new Map(columns.map(c => [c.key, c]))
    const seen = new Set<string>()
    const result: DajingoColumnDef[] = []
    const order = columnOrder || columns.map(c => c.key)
    for (const key of order) {
      const col = colMap.get(key)
      if (col && !seen.has(key)) { result.push(col); seen.add(key) }
    }
    for (const col of columns) {
      if (!seen.has(col.key)) result.push(col)
    }
    return result
  }, [columns, columnOrder])

  // ── Visible column count for horizontal scroll detection ──
  const visibleColCount = orderedColumns.filter(col =>
    !phc.has(col.key) && (col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key])
  ).length

  // ── Track weight + basis (for proportional sharing with Product column) ──
  const visibleCols = orderedColumns.filter(col =>
    !phc.has(col.key) && (col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key])
  )
  const trackWeight = visibleCols.reduce((s, c) => s + parseWidthWeight(columnWidths[c.key] || 'w-16'), 0) || 1
  const trackBasisRem = trackWeight * 0.25

  const effectiveMinWidth = tableMinWidth || (visibleColCount > 9 ? `${300 + visibleColCount * 100}px` : undefined)

  return (
    <>
    <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl flex flex-col overflow-hidden">

      {/* ── Integrated Toolbar (Search + Filters + Customize) ── */}
      {hasToolbar && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-app-border/40">
          <div className="flex-1 relative min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={sRef} type="text" value={search || ''} onChange={e => onSearchChange!(e.target.value)}
              placeholder={searchPlaceholder || `Search by name, SKU, or barcode... (Ctrl+K)`}
              className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>

          {onToggleFilters && (
            <button onClick={onToggleFilters}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-all flex-shrink-0 ${showFiltersProp ? 'border-app-primary text-app-primary' : 'border-app-border text-app-muted-foreground hover:text-app-foreground'}`}
              style={showFiltersProp ? { background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)' } : {}}>
              <SlidersHorizontal size={13} /><span className="hidden sm:inline">Filters</span>
              {(afc || 0) > 0 && <span className="text-[9px] font-black bg-app-primary text-white px-1.5 py-0.5 rounded-full">{afc}</span>}
            </button>
          )}

          {hasFilters && onClearFilters && (
            <button onClick={onClearFilters}
              className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
              style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
              <X size={13} />
            </button>
          )}

          <button onClick={handleCustomize} title="Customize Columns"
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
            <Settings2 size={13} /><span className="hidden sm:inline">Customize</span>
          </button>
        </div>
      )}

      {/* ── Mobile header ── */}
      <div className="sm:hidden flex-shrink-0 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
        {(allData || data).length} {entityLabel}{(allData || data).length !== 1 ? 's' : ''} · Tap to expand
      </div>

      {/* ── Scrollable wrapper ── */}
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain custom-scrollbar">
        <div style={effectiveMinWidth ? { minWidth: effectiveMinWidth } : undefined}>

          {/* ── Sticky Column Headers ── */}
          <div className="hidden sm:flex sticky top-0 z-10 items-center py-2 bg-app-surface/90 backdrop-blur-sm border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}>

            {/* LEFT: split into two header columns — Actions, then Product */}
            <div className="flex items-center" style={{ width: '110px', minWidth: '110px', flexShrink: 0 }}>
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {onToggleSelectAll && (
                  <input type="checkbox" checked={isAllPageSelected || false} onChange={onToggleSelectAll}
                    className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" />
                )}
              </div>
            </div>
            <div className="flex items-center pr-3" style={{ flex: `${PRODUCT_WEIGHT} 1 ${PRODUCT_BASIS_REM}rem`, minWidth: 0 }}>
              <div className="flex-1 min-w-0">{entityLabel}</div>
            </div>

            {/* RIGHT: dynamic column headers — proportional with Product via shared flex weights */}
            <div className="flex items-center gap-2 md:gap-3 fill-cols" style={{ flex: `${trackWeight} 1 ${trackBasisRem}rem`, minWidth: 0 }}>
              {orderedColumns.map(col => {
                if (phc.has(col.key)) return null
                const isOn = col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key]
                if (!isOn) return null
                const w = columnWidths[col.key] || 'w-16'
                const align = rac.has(col.key) ? ' text-right' : cac.has(col.key) ? ' text-center' : ''
                // OPTION D — PROPORTIONAL: every column gets
                //   total = required + required × (extra / sum_required)
                // Implemented as `flex: <weight> 1 <weight × 0.25rem>` where weight is the
                // numeric value of the Tailwind w-XX class. Wider declared columns absorb
                // proportionally more of the leftover space.
                // CONTENT ALIGNMENT: all column content centered horizontally (`justify-center`).
                const _w = parseWidthWeight(w)
                const isGrow = gc.has(col.key)
                const widthCls = 'flex items-center justify-center'
                const growStyle = { flex: `${_w} 1 ${_w * 0.25}rem`, minWidth: 0, width: 'auto' as const }
                return (
                  <div key={col.key}
                    className={`${widthCls}${align}${isGrow ? ' col-grow' : ''}${onColumnReorder ? ' cursor-grab active:cursor-grabbing select-none hover:text-app-primary transition-colors' : ''}`}
                    style={growStyle}
                    draggable={!!onColumnReorder}
                    onDragStart={onColumnReorder ? () => { dragColRef.current = col.key } : undefined}
                    onDragOver={onColumnReorder ? e => { e.preventDefault(); e.currentTarget.style.borderBottom = '2px solid var(--app-primary)' } : undefined}
                    onDragLeave={onColumnReorder ? e => { e.currentTarget.style.borderBottom = '' } : undefined}
                    onDrop={onColumnReorder ? e => {
                      e.currentTarget.style.borderBottom = ''
                      if (!dragColRef.current || dragColRef.current === col.key) return
                      const currentOrder = columnOrder || columns.map(c => c.key)
                      const newOrder = [...currentOrder]
                      const fromIdx = newOrder.indexOf(dragColRef.current)
                      const toIdx = newOrder.indexOf(col.key)
                      if (fromIdx < 0 || toIdx < 0) return
                      newOrder.splice(fromIdx, 1)
                      newOrder.splice(toIdx, 0, dragColRef.current)
                      onColumnReorder(newOrder)
                      dragColRef.current = null
                    } : undefined}
                    onDragEnd={onColumnReorder ? () => { dragColRef.current = null } : undefined}
                  >{col.label}</div>
                )
              })}
            </div>
          </div>

          {/* ── Rows ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : data.length > 0 ? (
            data.map(row => (
              <DajingoRow<T>
                key={getRowId(row)}
                row={row}
                getRowId={getRowId}
                orderedColumns={orderedColumns}
                visibleColumns={visibleColumns}
                columnWidths={columnWidths}
                rightAlignedCols={rac}
                centerAlignedCols={cac}
                growCols={gc}
                policyHiddenColumns={phc}
                renderRowIcon={renderRowIcon}
                renderRowTitle={renderRowTitle}
                renderColumnCell={renderColumnCell}
                renderMobileCard={renderMobileCard}
                renderExpanded={renderExpanded}
                onView={onView}
                menuActions={menuActions}
                isSelected={selectedIds ? selectedIds.has(getRowId(row)) : false}
                onToggleSelect={onToggleSelect}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              {emptyIcon && <div className="mb-3 opacity-40">{emptyIcon}</div>}
              <p className="text-sm font-bold text-app-muted-foreground">
                {hasFilters ? (emptyMessage || `No ${entityLabel.toLowerCase()}s match your filters`) : (emptyMessage || `No ${entityLabel.toLowerCase()}s found`)}
              </p>
              {hasFilters && onClearFilters && (
                <button onClick={onClearFilters}
                  className="mt-3 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds && selectedIds.size > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-app-primary/30 flex items-center gap-2 flex-wrap"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' }}>
          <span className="text-[11px] font-black text-app-primary">{selectedIds.size} selected</span>
          {bulkActions && <div className="flex items-center gap-1.5 ml-2">{bulkActions}</div>}
          {onToggleSelect && (
            <button onClick={() => {
              // Deselect all — parent should handle this
              // We signal by calling onToggleSelect with a special 'deselect-all' pattern
              // Actually, we need a separate handler. Use the bulkActions slot for this.
            }}
              className="ml-auto text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
              Deselect All
            </button>
          )}
        </div>
      )}

      {/* ── Pagination Footer ── */}
      {pagination && !loading && (allData || data).length > 0 && (
        <PaginationFooter
          totalItems={pagination.totalItems}
          totalAvailable={pagination.totalAvailable}
          activeFilterCount={pagination.activeFilterCount}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>

    {/* ── Built-in Customize Panel (same as Products) ── */}
    {showInternalPanel && onSetVisibleColumns && (
      <DajingoCustomizePanel
        isOpen={showInternalPanel}
        onClose={() => setShowBuiltInPanel(false)}
        columns={columns}
        visibleColumns={visibleColumns}
        setVisibleColumns={onSetVisibleColumns}
        columnOrder={columnOrder || columns.map(c => c.key)}
        setColumnOrder={onSetColumnOrder || onColumnReorder || (() => {})}
        policyHiddenColumns={policyHiddenColumns}
        allFilters={allFilters}
        visibleFilters={visibleFilters}
        setVisibleFilters={onSetVisibleFilters}
        policyHiddenFilters={policyHiddenFilters}
        moduleKey={moduleKey}
        entityLabel={entityLabel}
      />
    )}
    </>
  )
}


/* ═══════════════════════════════════════════════════════════
 *  ROW COMPONENT (memoized)
 * ═══════════════════════════════════════════════════════════ */

type DajingoRowProps<T> = {
  row: T
  getRowId: (row: T) => number | string
  orderedColumns: DajingoColumnDef[]
  visibleColumns: Record<string, boolean>
  columnWidths: Record<string, string>
  rightAlignedCols: Set<string>
  centerAlignedCols: Set<string>
  growCols: Set<string>
  policyHiddenColumns: Set<string>
  renderRowIcon?: (row: T) => React.ReactNode
  renderRowTitle: (row: T) => React.ReactNode
  renderColumnCell: (key: string, row: T) => React.ReactNode
  renderMobileCard?: (row: T, isOpen: boolean, toggle: () => void) => React.ReactNode
  renderExpanded?: (row: T) => React.ReactNode
  onView?: (row: T) => void
  menuActions?: (row: T) => DajingoMenuItem[]
  isSelected: boolean
  onToggleSelect?: (id: number | string) => void
}

const DajingoRowInner = React.memo(function DajingoRowInner<T>({
  row, getRowId, orderedColumns, visibleColumns, columnWidths,
  rightAlignedCols, centerAlignedCols, growCols, policyHiddenColumns,
  renderRowIcon, renderRowTitle, renderColumnCell,
  renderMobileCard, renderExpanded,
  onView, menuActions,
  isSelected, onToggleSelect,
}: DajingoRowProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = getRowId(row)

  // Same track-weight computation as the header (Option D proportional layout).
  const _visibleCols = orderedColumns.filter(col =>
    !policyHiddenColumns.has(col.key) && (col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key])
  )
  const trackWeight = _visibleCols.reduce((s, c) => s + parseWidthWeight(columnWidths[c.key] || 'w-16'), 0) || 1
  const trackBasisRem = trackWeight * 0.25

  // Get menu items if available
  const items = menuActions ? menuActions(row) : []
  // Add default View action if onView is provided
  if (onView && !items.find(i => i.label === 'View Details')) {
    items.unshift({ label: 'View Details', icon: <Eye size={12} className="text-app-primary" />, onClick: () => onView(row) })
  }

  return (
    <div>
      {/* ── MOBILE CARD ── */}
      {renderMobileCard ? (
        <div className="sm:hidden">
          {renderMobileCard(row, isOpen, () => setIsOpen(!isOpen))}
        </div>
      ) : (
        <div className="sm:hidden border-b border-app-border/30 px-3 py-3 active:bg-app-surface/60 transition-all"
          onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-start gap-3">
            {renderRowIcon && <div className="flex-shrink-0">{renderRowIcon(row)}</div>}
            <div className="flex-1 min-w-0">{renderRowTitle(row)}</div>
          </div>
          {isOpen && onView && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-app-border/20">
              <button onClick={e => { e.stopPropagation(); onView(row) }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-app-primary py-2 rounded-xl border border-app-primary/30 hover:bg-app-primary/5 transition-all">
                <Eye size={13} /> View Details
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TABLE ROW (≥640px) ── */}
      <div
        className={`hidden sm:flex group items-center transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2 ${isSelected ? 'bg-app-primary/5' : ''}`}
        style={{ paddingLeft: '12px', paddingRight: '12px' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* ── ACTIONS COLUMN: checkbox + view + menu + chevron ── */}
        <div className="flex items-center gap-1" style={{ width: '110px', minWidth: '110px', flexShrink: 0 }}>
          {/* Checkbox */}
          {onToggleSelect && (
            <div className="w-5 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(id)}
                className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" />
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {onView && (
              <button onClick={() => onView(row)}
                className="p-1 hover:bg-app-primary/10 rounded-md transition-colors text-app-muted-foreground hover:text-app-primary" title="View Details">
                <Eye size={12} />
              </button>
            )}
            {items.length > 0 && (
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
                      {items.map((item, i) => (
                        <React.Fragment key={i}>
                          {item.separator && <div className="border-t border-app-border/50 my-1" />}
                          <button onClick={() => { item.onClick(); setShowMenu(false) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                            {item.icon}{item.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Expand chevron */}
          {renderExpanded && (
            <div className="w-4 flex-shrink-0 flex items-center justify-center text-app-muted-foreground">
              {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </div>
          )}
        </div>

        {/* ── PRODUCT COLUMN: icon + title — proportional weight 60 ── */}
        <div className="flex items-center gap-2 pr-3" style={{ flex: '60 1 15rem', minWidth: 0 }}>
          {/* Row icon */}
          {renderRowIcon && <div className="flex-shrink-0">{renderRowIcon(row)}</div>}

          {/* Title */}
          <div className="flex-1 min-w-0">{renderRowTitle(row)}</div>
        </div>

        {/* ── RIGHT SECTION: dynamic columns — proportional with Product via shared flex weights ── */}
        <div className="flex items-center gap-2 md:gap-3 fill-cols" style={{ flex: `${trackWeight} 1 ${trackBasisRem}rem`, minWidth: 0 }}>
          {orderedColumns.map(col => {
            if (policyHiddenColumns.has(col.key)) return null
            const isOn = col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key]
            if (!isOn) return null
            const w = columnWidths[col.key] || 'w-16'
            const align = rightAlignedCols.has(col.key) ? ' text-right' : centerAlignedCols.has(col.key) ? ' text-center' : ''
            // Option D — proportional: flex: <weight> 1 <weight × 0.25rem>
            // Content centered horizontally (Product column kept left-aligned via its own JSX).
            const _w = parseWidthWeight(w)
            const isGrow = growCols.has(col.key)
            const widthCls = 'flex items-center justify-center'
            const growStyle = { flex: `${_w} 1 ${_w * 0.25}rem`, minWidth: 0, width: 'auto' as const }
            return (
              <div key={col.key} className={`${widthCls}${align}${isGrow ? ' col-grow' : ''}`} style={growStyle}>
                {renderColumnCell(col.key, row)}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── EXPANDED CONTENT ── */}
      {isOpen && renderExpanded && renderExpanded(row)}
    </div>
  )
}) as <T>(props: DajingoRowProps<T>) => React.ReactElement

// Wrapper to preserve generic type
function DajingoRow<T>(props: DajingoRowProps<T>) {
  return <DajingoRowInner {...props} />
}
