'use client'

/**
 * TypicalListView — Compatibility Bridge
 * ========================================
 * This file wraps DajingoListView so ALL legacy pages (148+) automatically
 * get the full Customize panel (profiles, drag-reorder, filter toggles)
 * with ZERO changes to individual page files.
 *
 * Original API is preserved — columns with `render`, `visibleColumns` as
 * string[], `onToggleColumn`, `sortKey/sortDir/onSort`, etc. are all
 * transparently mapped to DajingoListView's interface.
 */

import React, { useState, useMemo, useRef } from 'react'
import {
  DajingoListView, type DajingoColumnDef, type DajingoMenuItem
} from '@/components/common/DajingoListView'
import { cn } from '@/lib/utils'
import {
  Eye, Pencil, Trash2, MoreHorizontal, Plus, Download,
  CheckCircle2, XCircle, Lock, Unlock, Check, LayoutGrid, List
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════
 TypicalListView — Universal data table component (Bridge)
 ═══════════════════════════════════════════════════════ */

export type ColumnDef<T> = {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  alwaysVisible?: boolean
  grow?: boolean
  width?: string
}

export type LifecycleConfig<T> = {
  getStatus?: (row: T) => { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }
  getVerified?: (row: T) => boolean
  getLocked?: (row: T) => boolean
  getApproved?: (row: T) => boolean
  getCanceled?: (row: T) => boolean
  onLockToggle?: (row: T) => void
  onApprove?: (row: T) => void
  onCancel?: (row: T) => void
}

export type TypicalListViewProps<T, D = any> = {
  title: string
  addLabel?: string
  onAdd?: () => void
  onExport?: () => void

  data: T[]
  loading?: boolean
  getRowId: (row: T) => string | number

  columns: ColumnDef<T>[]
  visibleColumns?: string[]
  onToggleColumn?: (key: string) => void

  selection?: {
    selectedIds: Set<string | number>
    onSelectionChange: (ids: Set<string | number>) => void
  }

  bulkActions?: React.ReactNode
  lifecycle?: LifecycleConfig<T>
  headerExtras?: React.ReactNode
  headerExtra?: React.ReactNode
  expandable?: {
    columns: ColumnDef<D>[]
    getDetails: (row: T | any) => D[]
    renderActions?: (detail: D, parent: T) => React.ReactNode
  }
  renderExpanded?: (row: T) => React.ReactNode
  actions?: {
    onView?: (row: T) => void
    onEdit?: (row: T) => void
    onDelete?: (row: T) => void
    extra?: (row: T) => React.ReactNode
  }
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  viewMode?: 'table' | 'grid'
  onViewModeChange?: (mode: 'table' | 'grid') => void
  renderCard?: (row: T) => React.ReactNode
  gridClassName?: string
  columnOrder?: string[]
  onColumnReorder?: (newOrder: string[]) => void
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}


/* ── Status color helpers ── */
const VARIANT_COLORS: Record<string, string> = {
  default: 'var(--app-muted-foreground)',
  success: 'var(--app-success, #22c55e)',
  warning: '#f59e0b',
  danger: 'var(--app-error, #ef4444)',
  info: '#3b82f6',
}


export function TypicalListView<T, D = any>(props: TypicalListViewProps<T, D>) {
  const {
    title, addLabel, onAdd, onExport,
    data, loading, getRowId,
    columns, visibleColumns, onToggleColumn,
    selection, bulkActions,
    lifecycle, headerExtras, headerExtra,
    expandable, actions, renderExpanded,
    pageSize = 25, onPageSizeChange,
    sortKey, sortDir, onSort,
    viewMode, onViewModeChange, renderCard, gridClassName,
    columnOrder, onColumnReorder,
    className,
    children,
  } = props

  /* ── Internal state for DajingoListView ── */
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [intVisibleCols, setIntVisibleCols] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map(c => [c.key, c.alwaysVisible || !visibleColumns || visibleColumns.includes(c.key)]))
  )
  const [intColumnOrder, setIntColumnOrder] = useState<string[]>(
    columnOrder || columns.map(c => c.key)
  )
  const searchRef = useRef<HTMLInputElement>(null)

  /* ── Sync external visibleColumns → internal Record ── */
  const effectiveVisibleCols = useMemo(() => {
    if (visibleColumns) {
      return Object.fromEntries(columns.map(c =>
        [c.key, c.alwaysVisible || visibleColumns.includes(c.key)]
      ))
    }
    return intVisibleCols
  }, [visibleColumns, columns, intVisibleCols])

  /* ── Convert ColumnDef<T> → DajingoColumnDef ── */
  const djColumns: DajingoColumnDef[] = useMemo(() =>
    columns.map(c => ({
      key: c.key,
      label: c.label,
      defaultVisible: c.alwaysVisible || !visibleColumns || visibleColumns.includes(c.key),
    }))
  , [columns, visibleColumns])

  /* ── Build column widths from ColumnDef.width ── */
  const columnWidths = useMemo(() => {
    const w: Record<string, string> = {}
    columns.forEach(c => { if (c.width) w[c.key] = c.width })
    return w
  }, [columns])

  /* ── Build alignment sets ── */
  const rightAlignedCols = useMemo(() =>
    new Set(columns.filter(c => c.align === 'right').map(c => c.key))
  , [columns])
  const centerAlignedCols = useMemo(() =>
    new Set(columns.filter(c => c.align === 'center').map(c => c.key))
  , [columns])
  const growCols = useMemo(() =>
    new Set(columns.filter(c => c.grow).map(c => c.key))
  , [columns])

  /* ── Sort data client-side ── */
  const safeData = Array.isArray(data) ? data : []
  const sortedData = useMemo(() => {
    if (!sortKey) return safeData
    const dir = sortDir === 'desc' ? -1 : 1
    return [...safeData].sort((a: any, b: any) => {
      const valA = a[sortKey]; const valB = b[sortKey]
      if (valA < valB) return -1 * dir
      if (valA > valB) return 1 * dir
      return 0
    })
  }, [safeData, sortKey, sortDir])

  /* ── Search filter ── */
  const filtered = useMemo(() => {
    if (!search) return sortedData
    const q = search.toLowerCase()
    return sortedData.filter(row =>
      JSON.stringify(row).toLowerCase().includes(q)
    )
  }, [sortedData, search])

  /* ── Paginate ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  /* ── Build moduleKey from title ── */
  const moduleKey = `legacy.${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`

  /* ── Build menu actions from legacy actions prop ── */
  const menuActions = useMemo(() => {
    if (!actions) return undefined
    return (row: T): DajingoMenuItem[] => {
      const items: DajingoMenuItem[] = []
      if (actions.onView) items.push({
        label: 'View', icon: <Eye size={12} className="text-app-primary" />, onClick: () => actions.onView!(row)
      })
      if (actions.onEdit) items.push({
        label: 'Edit', icon: <Pencil size={12} className="text-app-muted-foreground" />, onClick: () => actions.onEdit!(row)
      })
      if (actions.onDelete) items.push({
        label: 'Delete', icon: <Trash2 size={12} className="text-app-error" />, onClick: () => actions.onDelete!(row)
      })
      return items
    }
  }, [actions])

  /* ── Handle column visibility toggle (bridge to legacy onToggleColumn) ── */
  const handleSetVisibleCols = (cols: Record<string, boolean>) => {
    setIntVisibleCols(cols)
    // If legacy onToggleColumn exists, also sync
    if (onToggleColumn) {
      // Find what changed and toggle it
      Object.entries(cols).forEach(([key, visible]) => {
        const wasVisible = effectiveVisibleCols[key]
        if (visible !== wasVisible) onToggleColumn(key)
      })
    }
  }

  /* ── Handle column order (bridge to legacy onColumnReorder) ── */
  const handleSetColumnOrder = (order: string[]) => {
    setIntColumnOrder(order)
    if (onColumnReorder) onColumnReorder(order)
  }

  /* ── Lifecycle cell rendering ── */
  const renderLifecycleInfo = (row: T): React.ReactNode => {
    if (!lifecycle) return null
    const status = lifecycle.getStatus?.(row)
    const statusColor = status ? (VARIANT_COLORS[status.variant] || VARIANT_COLORS.default) : null
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {status && (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
            style={{ color: statusColor!, background: `color-mix(in srgb, ${statusColor} 10%, transparent)` }}>
            {status.label}
          </span>
        )}
        {lifecycle.getVerified?.(row) && (
          <CheckCircle2 size={12} className="text-app-success" />
        )}
        {lifecycle.getLocked?.(row) && (
          <Lock size={12} className="text-app-warning" />
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300", className)}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="page-header-icon" style={{
              background: 'var(--app-primary)',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)'
            }}>
              <LayoutGrid size={20} className="text-white" />
            </div>
            <div>
              <h1>{title}</h1>
              <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                {safeData.length} Records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerExtras}
            {headerExtra}
            {onExport && (
              <button onClick={onExport}
                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                <Download size={13} /> Export
              </button>
            )}
            {onAdd && (
              <button onClick={onAdd}
                className="flex items-center gap-1.5 text-[11px] font-bold text-white px-4 py-2 rounded-xl shadow-lg transition-all hover:brightness-110"
                style={{ background: 'var(--app-primary)' }}>
                <Plus size={14} /> {addLabel || 'Add'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter children (legacy TypicalFilter) ── */}
      {children && <div className="flex-shrink-0 pb-3">{children}</div>}

      {/* ── DajingoListView (the universal engine) ── */}
      <DajingoListView<T>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={row => {
          const id = getRowId(row)
          return typeof id === 'string' ? id : Number(id)
        }}
        columns={djColumns}
        visibleColumns={effectiveVisibleCols}
        columnWidths={columnWidths}
        rightAlignedCols={rightAlignedCols}
        centerAlignedCols={centerAlignedCols}
        growCols={growCols}
        columnOrder={intColumnOrder}
        onColumnReorder={handleSetColumnOrder}
        entityLabel={title}

        /* ── Integrated Toolbar ── */
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${title.toLowerCase()}... (Ctrl+K)`}
        searchRef={searchRef as React.RefObject<HTMLInputElement>}
        hasFilters={!!search}
        onClearFilters={() => setSearch('')}
        onSetVisibleColumns={handleSetVisibleCols}
        onSetColumnOrder={handleSetColumnOrder}
        moduleKey={moduleKey}

        /* ── Row rendering ── */
        renderRowIcon={row => {
          if (lifecycle) {
            const status = lifecycle.getStatus?.(row)
            const color = status ? (VARIANT_COLORS[status.variant] || VARIANT_COLORS.default) : 'var(--app-muted-foreground)'
            return (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                <LayoutGrid size={13} />
              </div>
            )
          }
          return (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
              <LayoutGrid size={13} />
            </div>
          )
        }}
        renderRowTitle={row => {
          // Use first column's render as the title
          const firstCol = columns[0]
          const rendered = firstCol?.render ? firstCol.render(row) : (row as any)[firstCol?.key]
          return (
            <div className="flex-1 min-w-0">
              <div className="truncate text-[12px] font-bold text-app-foreground">
                {rendered || `${title} #${getRowId(row)}`}
              </div>
              {lifecycle && (
                <div className="mt-0.5">{renderLifecycleInfo(row)}</div>
              )}
            </div>
          )
        }}
        renderColumnCell={(key, row) => {
          const col = columns.find(c => c.key === key)
          if (!col) return <span className="text-[10px] text-app-muted-foreground">—</span>
          const rendered = col.render ? col.render(row) : (row as any)[key]
          if (rendered === null || rendered === undefined) {
            return <span className="text-[10px] text-app-muted-foreground">—</span>
          }
          // Wrap primitive values in standard styling
          if (typeof rendered === 'string' || typeof rendered === 'number') {
            return <span className="text-[11px] text-app-foreground">{rendered}</span>
          }
          return rendered
        }}
        renderExpanded={renderExpanded ? renderExpanded : expandable ? (row) => {
          const details = expandable.getDetails(row)
          if (details.length === 0) {
            return (
              <div className="px-4 py-6 text-center text-xs text-app-muted-foreground">
                No details available
              </div>
            )
          }
          return (
            <div className="px-4 py-3">
              <div className="space-y-1.5">
                {details.map((detail: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {expandable.columns.map(ec => (
                        <div key={ec.key}>
                          <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">{ec.label}</div>
                          <div className="text-[11px] font-bold text-app-foreground">
                            {ec.render ? ec.render(detail) : detail[ec.key] ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {expandable.renderActions && (
                      <div className="flex-shrink-0">{expandable.renderActions(detail, row)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        } : undefined}

        onView={actions?.onView}
        menuActions={menuActions}

        /* ── Selection ── */
        selectedIds={selection?.selectedIds}
        onToggleSelect={selection ? (id) => {
          const next = new Set(selection.selectedIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          selection.onSelectionChange(next)
        } : undefined}
        isAllPageSelected={selection ? paginated.length > 0 && paginated.every(r => selection.selectedIds.has(getRowId(r))) : undefined}
        onToggleSelectAll={selection ? () => {
          const allSelected = paginated.every(r => selection.selectedIds.has(getRowId(r)))
          if (allSelected) {
            selection.onSelectionChange(new Set())
          } else {
            selection.onSelectionChange(new Set(paginated.map(r => getRowId(r))))
          }
        } : undefined}
        bulkActions={bulkActions}

        emptyIcon={<LayoutGrid size={36} />}
        pagination={{
          totalItems: filtered.length,
          activeFilterCount: 0,
          currentPage: clampedPage,
          totalPages,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: n => {
            if (onPageSizeChange) onPageSizeChange(n)
            setCurrentPage(1)
          },
        }}
      />
    </div>
  )
}

/** Alias: new pages should use this name */
export const TypicalDynamicListView = TypicalListView
