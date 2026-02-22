'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Download, Plus, ChevronDown, ChevronUp, Lock, LockOpen,
    CheckCircle2, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════
   TypicalListView — Reusable list/table for any page
   
   Usage:
     <TypicalListView
       title="Stock Transfer"
       addLabel="Add Transfer"
       onAdd={() => ...}
       data={orders}
       columns={[
         { key: 'date', label: 'Date', render: r => ... },
         { key: 'ref',  label: 'Reference' },
       ]}
       getRowId={r => r.id}
       expandable={{
         columns: [{ key: 'location', label: 'Location' }],
         getDetails: r => r.lines,
         renderActions: (detail, row) => <button>View</button>,
       }}
       lifecycle={{
         getStatus: r => ({ label: 'Approved', variant: 'success' }),
         getVerified: r => r.verified,
         getLocked: r => r.locked,
         onLockToggle: r => ...,
       }}
       actions={{
         onView: r => ...,
         onEdit: r => ...,
         onDelete: r => ...,
         extra: r => <button>Post</button>,
       }}
     />
   ═══════════════════════════════════════════════════════ */

/* ─── Types ──────────────────────────────────────────── */

export type ColumnDef<T> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (row: T) => React.ReactNode
    sortable?: boolean
    width?: string
    /** Hide this column on mobile */
    hideMobile?: boolean
}

export type DetailColumnDef<D> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (detail: D) => React.ReactNode
}

export type ExpandableConfig<T, D> = {
    /** Columns for the detail sub-table */
    columns: DetailColumnDef<D>[]
    /** Extract detail items from a master row */
    getDetails: (row: T) => D[]
    /** Optional actions column in detail rows */
    renderActions?: (detail: D, row: T) => React.ReactNode
    /** Detail sub-table border color (tailwind) */
    borderColor?: string
    /** Detail sub-table header bg color (tailwind) */
    headerColor?: string
    /** Detail sub-table header text color (tailwind) */
    headerTextColor?: string
}

export type LifecycleConfig<T> = {
    /** Get display status for a row */
    getStatus: (row: T) => { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }
    /** Whether row is verified (shows checkmark) */
    getVerified?: (row: T) => boolean
    /** Whether row is locked (shows lock icon) */
    getLocked?: (row: T) => boolean
    /** Toggle lock on a row */
    onLockToggle?: (row: T) => void
}

export type ActionsConfig<T> = {
    onView?: (row: T) => void
    onEdit?: (row: T) => void
    onDelete?: (row: T) => void
    /** Extra action buttons per row */
    extra?: (row: T) => React.ReactNode
}

export type TypicalListViewProps<T, D = any> = {
    /* ── Header settings ─── */
    /** Page title */
    title: string
    /** Label for the add button */
    addLabel?: string
    /** Called when add button is clicked */
    onAdd?: () => void
    /** Called when export button is clicked */
    onExport?: () => void
    /** Extra buttons in the header area */
    headerExtra?: React.ReactNode

    /* ── Data ─── */
    /** Array of data rows */
    data: T[]
    /** Loading state */
    loading?: boolean
    /** Unique ID for each row */
    getRowId: (row: T) => string | number
    /** Empty state message */
    emptyMessage?: string

    /* ── Columns ─── */
    /** Column definitions for the main table */
    columns: ColumnDef<T>[]

    /* ── Expandable detail rows ─── */
    expandable?: ExpandableConfig<T, D>

    /* ── Lifecycle (status, verified, lock) ─── */
    lifecycle?: LifecycleConfig<T>

    /* ── Row actions ─── */
    actions?: ActionsConfig<T>

    /* ── Visual settings ─── */
    /** Custom class for the table container */
    className?: string
    /** Strip rows with alternating background */
    striped?: boolean
    /** Compact row height */
    compact?: boolean
    /** Show row hover effect */
    hoverable?: boolean

    /* ── Bulk actions ─── */
    /** Enable row selection checkboxes */
    selectable?: boolean
    /** Called with selected row IDs */
    onSelectionChange?: (ids: (string | number)[]) => void
    /** Render bulk action bar when items selected */
    renderBulkActions?: (selectedIds: (string | number)[]) => React.ReactNode

    /* ── Sorting ─── */
    /** Current sort key */
    sortKey?: string
    /** Current sort direction */
    sortDir?: 'asc' | 'desc'
    /** Called when user clicks sortable column header */
    onSort?: (key: string) => void

    /* ── Pagination ─── */
    /** Total number of items (for pagination display) */
    totalCount?: number
    /** Current page (1-indexed) */
    currentPage?: number
    /** Items per page */
    pageSize?: number
    /** Called when page changes */
    onPageChange?: (page: number) => void

    /** Children rendered below the table (e.g. TypicalFilter, extra UI) */
    children?: React.ReactNode
}

/* ─── Status Badge ──────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-red-50 text-red-700 border-red-200',
    default: 'bg-gray-50 text-gray-700 border-gray-200',
}

function StatusBadge({ label, variant }: { label: string; variant: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[variant] || STATUS_COLORS.default}`}>
            {label}
        </span>
    )
}

/* ─── Loading Skeleton ──────────────────────────────── */

function LoadingSkeleton({ columns, compact }: { columns: number; compact: boolean }) {
    return (
        <>
            {[1, 2, 3, 4, 5].map(i => (
                <TableRow key={i}>
                    {Array.from({ length: columns }).map((_, j) => (
                        <TableCell key={j} className={compact ? 'py-1.5' : 'py-3'}>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}

/* ─── Main Component ────────────────────────────────── */

export function TypicalListView<T extends Record<string, any>, D extends Record<string, any> = any>({
    title, addLabel, onAdd, onExport, headerExtra,
    data, loading, getRowId, emptyMessage,
    columns,
    expandable,
    lifecycle,
    actions,
    className = '',
    striped = false,
    compact = false,
    hoverable = true,
    selectable = false,
    onSelectionChange,
    renderBulkActions,
    sortKey, sortDir, onSort,
    totalCount, currentPage, pageSize, onPageChange,
    children,
}: TypicalListViewProps<T, D>) {

    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set())

    const toggleRow = useCallback((id: string | number) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const toggleSelect = useCallback((id: string | number) => {
        setSelectedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            const ids = Array.from(next)
            onSelectionChange?.(ids)
            return next
        })
    }, [onSelectionChange])

    const toggleSelectAll = useCallback(() => {
        if (selectedRows.size === data.length) {
            setSelectedRows(new Set())
            onSelectionChange?.([])
        } else {
            const allIds = data.map(getRowId)
            setSelectedRows(new Set(allIds))
            onSelectionChange?.(allIds)
        }
    }, [data, getRowId, selectedRows.size, onSelectionChange])

    const hasExpandable = !!expandable
    const hasLifecycle = !!lifecycle
    const hasActions = !!actions
    const hasVerified = !!lifecycle?.getVerified
    const hasLock = !!lifecycle?.getLocked

    /* Total column count */
    const totalCols =
        (selectable ? 1 : 0)
        + columns.length
        + (hasLifecycle ? 1 : 0)
        + (hasVerified ? 1 : 0)
        + (hasLock ? 1 : 0)
        + (hasExpandable ? 1 : 0)
        + (hasActions ? 1 : 0)

    const cellPadding = compact ? 'py-1.5 px-2' : 'py-2.5 px-3'
    const headerPadding = compact ? 'py-1 px-2' : 'py-2 px-3'

    /* Detail sub-table colors */
    const detailBorder = expandable?.borderColor || 'border-emerald-200'
    const detailHeader = expandable?.headerColor || 'bg-emerald-50/80'
    const detailText = expandable?.headerTextColor || 'text-emerald-700'

    return (
        <div className={`space-y-4 ${className}`}>
            {/* ─── HEADER ─────────────────────────────── */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                <div className="flex items-center gap-2">
                    {headerExtra}
                    {onExport && (
                        <Button variant="outline" size={compact ? 'sm' : 'sm'} onClick={onExport}>
                            <Download className="h-4 w-4 mr-1.5" /> Export
                        </Button>
                    )}
                    {onAdd && addLabel && (
                        <Button size="sm" onClick={onAdd}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white">
                            <Plus className="h-4 w-4 mr-1.5" /> {addLabel}
                        </Button>
                    )}
                </div>
            </div>

            {/* ─── CHILDREN (e.g. TypicalFilter) ──────── */}
            {children}

            {/* ─── BULK ACTIONS BAR ───────────────────── */}
            {selectable && selectedRows.size > 0 && renderBulkActions && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg animate-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{selectedRows.size} selected</span>
                    {renderBulkActions(Array.from(selectedRows))}
                </div>
            )}

            {/* ─── TABLE ──────────────────────────────── */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/60">
                            {selectable && (
                                <TableHead className={`${headerPadding} w-10`}>
                                    <input type="checkbox"
                                        checked={data.length > 0 && selectedRows.size === data.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300"
                                    />
                                </TableHead>
                            )}
                            {columns.map(col => (
                                <TableHead key={col.key}
                                    className={`${headerPadding} text-xs font-semibold text-gray-600 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.hideMobile ? 'hidden md:table-cell' : ''}`}
                                    style={col.width ? { width: col.width } : undefined}
                                >
                                    {col.sortable && onSort ? (
                                        <button onClick={() => onSort(col.key)}
                                            className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                                            {col.label}
                                            {sortKey === col.key
                                                ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                                                : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                                        </button>
                                    ) : col.label}
                                </TableHead>
                            ))}
                            {hasLifecycle && <TableHead className={`${headerPadding} text-xs font-semibold text-gray-600`}>Status</TableHead>}
                            {hasVerified && <TableHead className={`${headerPadding} text-xs font-semibold text-gray-600 text-center`}>Verified</TableHead>}
                            {hasLock && <TableHead className={`${headerPadding} text-xs font-semibold text-gray-600 text-center`}>Lock</TableHead>}
                            {hasExpandable && <TableHead className={`${headerPadding} text-xs font-semibold text-gray-600 text-center`}>Details</TableHead>}
                            {hasActions && <TableHead className={`${headerPadding} text-xs font-semibold text-gray-600 text-center`}>Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <LoadingSkeleton columns={totalCols} compact={compact} />
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={totalCols} className="text-center py-12 text-gray-400">
                                    {emptyMessage || 'No records found'}
                                </TableCell>
                            </TableRow>
                        ) : data.map((row, rowIdx) => {
                            const rowId = getRowId(row)
                            const isExpanded = expandedRows.has(rowId)
                            const isSelected = selectedRows.has(rowId)
                            const details = hasExpandable ? expandable!.getDetails(row) : []

                            return (
                                <React.Fragment key={rowId}>
                                    {/* ─── Master Row ─── */}
                                    <TableRow className={`
                                        ${hoverable ? 'hover:bg-gray-50/50' : ''} transition-colors
                                        ${striped && rowIdx % 2 === 1 ? 'bg-gray-25' : ''}
                                        ${isSelected ? 'bg-blue-50/50' : ''}
                                    `}>
                                        {selectable && (
                                            <TableCell className={cellPadding}>
                                                <input type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(rowId)}
                                                    className="rounded border-gray-300"
                                                />
                                            </TableCell>
                                        )}
                                        {columns.map(col => (
                                            <TableCell key={col.key}
                                                className={`${cellPadding} ${compact ? 'text-xs' : 'text-sm'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.hideMobile ? 'hidden md:table-cell' : ''}`}>
                                                {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                            </TableCell>
                                        ))}
                                        {hasLifecycle && (
                                            <TableCell className={cellPadding}>
                                                {(() => { const s = lifecycle!.getStatus(row); return <StatusBadge label={s.label} variant={s.variant} /> })()}
                                            </TableCell>
                                        )}
                                        {hasVerified && (
                                            <TableCell className={`${cellPadding} text-center`}>
                                                {lifecycle!.getVerified!(row)
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                                    : <div className="h-5 w-5 rounded-full border-2 border-gray-200 mx-auto" />}
                                            </TableCell>
                                        )}
                                        {hasLock && (
                                            <TableCell className={`${cellPadding} text-center`}>
                                                <button onClick={() => lifecycle?.onLockToggle?.(row)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {lifecycle!.getLocked!(row)
                                                        ? <Lock className="h-4 w-4 text-gray-700" />
                                                        : <LockOpen className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasExpandable && (
                                            <TableCell className={`${cellPadding} text-center`}>
                                                <button onClick={() => toggleRow(rowId)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {isExpanded
                                                        ? <ChevronUp className="h-4 w-4 text-gray-600" />
                                                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasActions && (
                                            <TableCell className={`${cellPadding} text-center`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    {actions?.extra?.(row)}
                                                    {actions?.onView && (
                                                        <button onClick={() => actions.onView!(row)}
                                                            className="p-1 rounded hover:bg-gray-100 transition-colors">
                                                            <Eye className="h-4 w-4 text-gray-500" />
                                                        </button>
                                                    )}
                                                    {actions?.onEdit && (
                                                        <button onClick={() => actions.onEdit!(row)}
                                                            className="p-1 rounded hover:bg-blue-50 transition-colors">
                                                            <Pencil className="h-4 w-4 text-blue-500" />
                                                        </button>
                                                    )}
                                                    {actions?.onDelete && (
                                                        <button onClick={() => actions.onDelete!(row)}
                                                            className="p-1 rounded hover:bg-red-50 transition-colors">
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>

                                    {/* ─── Detail Rows ─── */}
                                    {hasExpandable && isExpanded && details.length > 0 && (
                                        <TableRow>
                                            <TableCell colSpan={totalCols} className="p-0 bg-gray-50/30">
                                                <div className={`mx-6 my-3 rounded-lg border ${detailBorder} overflow-hidden`}>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className={detailHeader}>
                                                                {expandable!.renderActions && (
                                                                    <TableHead className={`${headerPadding} text-xs font-semibold ${detailText}`}>Action</TableHead>
                                                                )}
                                                                {expandable!.columns.map(dc => (
                                                                    <TableHead key={dc.key}
                                                                        className={`${headerPadding} text-xs font-semibold ${detailText} ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
                                                                        {dc.label}
                                                                    </TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {details.map((d, idx) => (
                                                                <TableRow key={idx} className="hover:bg-emerald-50/30">
                                                                    {expandable!.renderActions && (
                                                                        <TableCell className={`${cellPadding} ${compact ? 'text-xs' : 'text-sm'}`}>
                                                                            {expandable!.renderActions(d, row)}
                                                                        </TableCell>
                                                                    )}
                                                                    {expandable!.columns.map(dc => (
                                                                        <TableCell key={dc.key}
                                                                            className={`${cellPadding} ${compact ? 'text-xs' : 'text-sm'} ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
                                                                            {dc.render ? dc.render(d) : String((d as any)[dc.key] ?? '')}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </TableBody>
                </Table>

                {/* ─── PAGINATION ──────────────────────── */}
                {onPageChange && totalCount != null && pageSize && currentPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                        </span>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" disabled={currentPage <= 1}
                                onClick={() => onPageChange(currentPage - 1)}
                                className="h-7 text-xs">Previous</Button>
                            <span className="text-xs text-gray-500 px-2">Page {currentPage}</span>
                            <Button variant="outline" size="sm" disabled={currentPage * pageSize >= totalCount}
                                onClick={() => onPageChange(currentPage + 1)}
                                className="h-7 text-xs">Next</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
