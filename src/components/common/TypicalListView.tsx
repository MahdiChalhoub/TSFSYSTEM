'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
    Download, Plus, ChevronDown, ChevronUp, Lock, LockOpen,
    CheckCircle2, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
    Columns3, ChevronLeft, ChevronRight,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════
   TypicalListView — Fully customizable list/table
   
   Features:
   ✓ Column definitions with custom renderers
   ✓ Column visibility dropdown (show/hide columns)
   ✓ Record count badge in header
   ✓ Pagination bar with "Showing X–Y of Z" + page nav
   ✓ Page size selector
   ✓ Expandable detail sub-rows
   ✓ Lifecycle columns (status, verified, lock)
   ✓ Row actions (view, edit, delete, custom)
   ✓ Row selection + bulk actions
   ✓ Sorting
   ✓ Compact / striped / hoverable modes
   ═══════════════════════════════════════════════════════ */

/* ─── Types ──────────────────────────────────────────── */

export type ColumnDef<T> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (row: T) => React.ReactNode
    sortable?: boolean
    width?: string
    hideMobile?: boolean
    /** If false, column cannot be hidden via visibility dropdown */
    alwaysVisible?: boolean
}

export type DetailColumnDef<D> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (detail: D) => React.ReactNode
}

export type ExpandableConfig<T, D> = {
    columns: DetailColumnDef<D>[]
    getDetails: (row: T) => D[]
    renderActions?: (detail: D, row: T) => React.ReactNode
    borderColor?: string
    headerColor?: string
    headerTextColor?: string
}

export type LifecycleConfig<T> = {
    getStatus: (row: T) => { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }
    getVerified?: (row: T) => boolean
    getLocked?: (row: T) => boolean
    onLockToggle?: (row: T) => void
}

export type ActionsConfig<T> = {
    onView?: (row: T) => void
    onEdit?: (row: T) => void
    onDelete?: (row: T) => void
    extra?: (row: T) => React.ReactNode
}

export type TypicalListViewProps<T, D = any> = {
    /* Header */
    title: string
    addLabel?: string
    onAdd?: () => void
    onExport?: () => void
    headerExtra?: React.ReactNode

    /* Data */
    data: T[]
    loading?: boolean
    getRowId: (row: T) => string | number
    emptyMessage?: string

    /* Columns */
    columns: ColumnDef<T>[]

    /* Column visibility */
    visibleColumns?: string[]
    onToggleColumn?: (key: string) => void

    /* Expandable */
    expandable?: ExpandableConfig<T, D>

    /* Lifecycle */
    lifecycle?: LifecycleConfig<T>

    /* Actions */
    actions?: ActionsConfig<T>

    /* Visual */
    className?: string
    striped?: boolean
    compact?: boolean
    hoverable?: boolean

    /* Selection */
    selectable?: boolean
    onSelectionChange?: (ids: (string | number)[]) => void
    renderBulkActions?: (selectedIds: (string | number)[]) => React.ReactNode

    /* Sorting */
    sortKey?: string
    sortDir?: 'asc' | 'desc'
    onSort?: (key: string) => void

    /* Pagination (client-side auto-paginate OR server-side) */
    pageSize?: number
    onPageSizeChange?: (size: number) => void
    /** For server-side pagination */
    totalCount?: number
    currentPage?: number
    onPageChange?: (page: number) => void

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

/* ─── Skeleton ──────────────────────────────────────── */

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

/* ─── Page Size Options ─────────────────────────────── */
const PAGE_SIZES = [10, 25, 50, 100]

/* ═══════════════ MAIN COMPONENT ═════════════════════ */

export function TypicalListView<T extends Record<string, any>, D extends Record<string, any> = any>({
    title, addLabel, onAdd, onExport, headerExtra,
    data, loading, getRowId, emptyMessage,
    columns,
    visibleColumns, onToggleColumn,
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
    pageSize: pageSizeProp = 25,
    onPageSizeChange,
    totalCount: totalCountProp,
    currentPage: currentPageProp,
    onPageChange: onPageChangeProp,
    children,
}: TypicalListViewProps<T, D>) {

    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set())
    const [localPage, setLocalPage] = useState(1)

    /* ─── Column Visibility ─────────────── */
    const activeColumns = useMemo(() => {
        if (!visibleColumns) return columns
        return columns.filter(c => visibleColumns.includes(c.key) || c.alwaysVisible)
    }, [columns, visibleColumns])

    /* ─── Client-side pagination ─────────── */
    const isServerPaginated = !!onPageChangeProp
    const currentPage = isServerPaginated ? (currentPageProp || 1) : localPage
    const totalRecords = isServerPaginated ? (totalCountProp || data.length) : data.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSizeProp))

    const paginatedData = useMemo(() => {
        if (isServerPaginated) return data // server already sliced
        const start = (currentPage - 1) * pageSizeProp
        return data.slice(start, start + pageSizeProp)
    }, [data, currentPage, pageSizeProp, isServerPaginated])

    const handlePageChange = useCallback((page: number) => {
        const clamped = Math.max(1, Math.min(totalPages, page))
        if (isServerPaginated) {
            onPageChangeProp?.(clamped)
        } else {
            setLocalPage(clamped)
        }
    }, [totalPages, isServerPaginated, onPageChangeProp])

    // Reset to page 1 when data changes
    useEffect(() => { if (!isServerPaginated) setLocalPage(1) }, [data.length, isServerPaginated])

    /* ─── Row expand / select ────────────── */
    const toggleRow = useCallback((id: string | number) => {
        setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }, [])
    const toggleSelect = useCallback((id: string | number) => {
        setSelectedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); onSelectionChange?.(Array.from(n)); return n })
    }, [onSelectionChange])
    const toggleSelectAll = useCallback(() => {
        if (selectedRows.size === paginatedData.length) { setSelectedRows(new Set()); onSelectionChange?.([]) }
        else { const ids = paginatedData.map(getRowId); setSelectedRows(new Set(ids)); onSelectionChange?.(ids) }
    }, [paginatedData, getRowId, selectedRows.size, onSelectionChange])

    const hasExpandable = !!expandable
    const hasLifecycle = !!lifecycle
    const hasActions = !!actions
    const hasVerified = !!lifecycle?.getVerified
    const hasLock = !!lifecycle?.getLocked

    const totalCols = (selectable ? 1 : 0) + activeColumns.length +
        (hasLifecycle ? 1 : 0) + (hasVerified ? 1 : 0) + (hasLock ? 1 : 0) +
        (hasExpandable ? 1 : 0) + (hasActions ? 1 : 0)

    const cp = compact ? 'py-1.5 px-2' : 'py-2.5 px-3'
    const hp = compact ? 'py-1 px-2' : 'py-2 px-3'
    const detailBorder = expandable?.borderColor || 'border-emerald-200'
    const detailHeader = expandable?.headerColor || 'bg-emerald-50/80'
    const detailText = expandable?.headerTextColor || 'text-emerald-700'

    /* Showing range */
    const showStart = totalRecords === 0 ? 0 : (currentPage - 1) * pageSizeProp + 1
    const showEnd = Math.min(currentPage * pageSizeProp, totalRecords)

    return (
        <div className={`space-y-4 ${className}`}>
            {/* ═══ HEADER ═════════════════════════════ */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        {totalRecords} records
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Column Visibility Dropdown */}
                    {onToggleColumn && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    <Columns3 className="h-4 w-4" /> Columns
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Show / Hide Columns</p>
                                <div className="space-y-1.5 max-h-64 overflow-auto">
                                    {columns.map(col => (
                                        <label key={col.key}
                                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors ${col.alwaysVisible ? 'opacity-50' : ''}`}>
                                            <Checkbox
                                                checked={visibleColumns?.includes(col.key) ?? true}
                                                onCheckedChange={() => !col.alwaysVisible && onToggleColumn(col.key)}
                                                disabled={col.alwaysVisible}
                                            />
                                            <span>{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {headerExtra}
                    {onExport && (
                        <Button variant="outline" size="sm" onClick={onExport}>
                            <Download className="h-4 w-4 mr-1.5" /> Export
                        </Button>
                    )}
                    {onAdd && addLabel && (
                        <Button size="sm" onClick={onAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                            <Plus className="h-4 w-4 mr-1.5" /> {addLabel}
                        </Button>
                    )}
                </div>
            </div>

            {/* ═══ CHILDREN (TypicalFilter) ═══════════ */}
            {children}

            {/* ═══ BULK ACTIONS ═══════════════════════ */}
            {selectable && selectedRows.size > 0 && renderBulkActions && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg animate-in slide-in-from-top-2">
                    <span className="text-sm font-medium text-blue-700">{selectedRows.size} selected</span>
                    {renderBulkActions(Array.from(selectedRows))}
                </div>
            )}

            {/* ═══ TABLE ═════════════════════════════ */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/60">
                            {selectable && (
                                <TableHead className={`${hp} w-10`}>
                                    <input type="checkbox" checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                                        onChange={toggleSelectAll} className="rounded border-gray-300" />
                                </TableHead>
                            )}
                            {activeColumns.map(col => (
                                <TableHead key={col.key}
                                    className={`${hp} text-xs font-semibold text-gray-600 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.hideMobile ? 'hidden md:table-cell' : ''}`}
                                    style={col.width ? { width: col.width } : undefined}>
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
                            {hasLifecycle && <TableHead className={`${hp} text-xs font-semibold text-gray-600`}>Status</TableHead>}
                            {hasVerified && <TableHead className={`${hp} text-xs font-semibold text-gray-600 text-center`}>Verified</TableHead>}
                            {hasLock && <TableHead className={`${hp} text-xs font-semibold text-gray-600 text-center`}>Lock</TableHead>}
                            {hasExpandable && <TableHead className={`${hp} text-xs font-semibold text-gray-600 text-center`}>Details</TableHead>}
                            {hasActions && <TableHead className={`${hp} text-xs font-semibold text-gray-600 text-center`}>Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <LoadingSkeleton columns={totalCols} compact={compact} />
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={totalCols} className="text-center py-12 text-gray-400">
                                    {emptyMessage || 'No records found'}
                                </TableCell>
                            </TableRow>
                        ) : paginatedData.map((row, rowIdx) => {
                            const rowId = getRowId(row)
                            const isExpanded = expandedRows.has(rowId)
                            const isSelected = selectedRows.has(rowId)
                            const details = hasExpandable ? expandable!.getDetails(row) : []

                            return (
                                <React.Fragment key={rowId}>
                                    <TableRow className={`
                                        ${hoverable ? 'hover:bg-gray-50/50' : ''} transition-colors
                                        ${striped && rowIdx % 2 === 1 ? 'bg-gray-50/30' : ''}
                                        ${isSelected ? 'bg-blue-50/50' : ''}
                                    `}>
                                        {selectable && (
                                            <TableCell className={cp}>
                                                <input type="checkbox" checked={isSelected}
                                                    onChange={() => toggleSelect(rowId)} className="rounded border-gray-300" />
                                            </TableCell>
                                        )}
                                        {activeColumns.map(col => (
                                            <TableCell key={col.key}
                                                className={`${cp} ${compact ? 'text-xs' : 'text-sm'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.hideMobile ? 'hidden md:table-cell' : ''}`}>
                                                {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                            </TableCell>
                                        ))}
                                        {hasLifecycle && (
                                            <TableCell className={cp}>
                                                {(() => { const s = lifecycle!.getStatus(row); return <StatusBadge label={s.label} variant={s.variant} /> })()}
                                            </TableCell>
                                        )}
                                        {hasVerified && (
                                            <TableCell className={`${cp} text-center`}>
                                                {lifecycle!.getVerified!(row)
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                                    : <div className="h-5 w-5 rounded-full border-2 border-gray-200 mx-auto" />}
                                            </TableCell>
                                        )}
                                        {hasLock && (
                                            <TableCell className={`${cp} text-center`}>
                                                <button onClick={() => lifecycle?.onLockToggle?.(row)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {lifecycle!.getLocked!(row)
                                                        ? <Lock className="h-4 w-4 text-gray-700" />
                                                        : <LockOpen className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasExpandable && (
                                            <TableCell className={`${cp} text-center`}>
                                                <button onClick={() => toggleRow(rowId)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {isExpanded
                                                        ? <ChevronUp className="h-4 w-4 text-gray-600" />
                                                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasActions && (
                                            <TableCell className={`${cp} text-center`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    {actions?.extra?.(row)}
                                                    {actions?.onView && <button onClick={() => actions.onView!(row)} className="p-1 rounded hover:bg-gray-100 transition-colors"><Eye className="h-4 w-4 text-gray-500" /></button>}
                                                    {actions?.onEdit && <button onClick={() => actions.onEdit!(row)} className="p-1 rounded hover:bg-blue-50 transition-colors"><Pencil className="h-4 w-4 text-blue-500" /></button>}
                                                    {actions?.onDelete && <button onClick={() => actions.onDelete!(row)} className="p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4 text-red-400" /></button>}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>

                                    {/* Detail sub-rows */}
                                    {hasExpandable && isExpanded && details.length > 0 && (
                                        <TableRow>
                                            <TableCell colSpan={totalCols} className="p-0 bg-gray-50/30">
                                                <div className={`mx-6 my-3 rounded-lg border ${detailBorder} overflow-hidden`}>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className={detailHeader}>
                                                                {expandable!.renderActions && <TableHead className={`${hp} text-xs font-semibold ${detailText}`}>Action</TableHead>}
                                                                {expandable!.columns.map(dc => (
                                                                    <TableHead key={dc.key} className={`${hp} text-xs font-semibold ${detailText} ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
                                                                        {dc.label}
                                                                    </TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {details.map((d, idx) => (
                                                                <TableRow key={idx} className="hover:bg-emerald-50/30">
                                                                    {expandable!.renderActions && <TableCell className={`${cp} ${compact ? 'text-xs' : 'text-sm'}`}>{expandable!.renderActions(d, row)}</TableCell>}
                                                                    {expandable!.columns.map(dc => (
                                                                        <TableCell key={dc.key} className={`${cp} ${compact ? 'text-xs' : 'text-sm'} ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
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

                {/* ═══ PAGINATION BAR ═════════════════ */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                            Showing <span className="font-medium text-gray-700">{showStart}–{showEnd}</span> of <span className="font-medium text-gray-700">{totalRecords}</span>
                        </span>
                        {onPageSizeChange && (
                            <Select value={String(pageSizeProp)} onValueChange={v => onPageSizeChange(parseInt(v))}>
                                <SelectTrigger className="h-7 w-auto min-w-[70px] text-xs gap-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZES.map(s => (
                                        <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={currentPage <= 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="h-7 w-7 p-0">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {/* Page number buttons */}
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                            let page: number
                            if (totalPages <= 5) { page = i + 1 }
                            else if (currentPage <= 3) { page = i + 1 }
                            else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i }
                            else { page = currentPage - 2 + i }
                            return (
                                <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm"
                                    onClick={() => handlePageChange(page)}
                                    className={`h-7 w-7 p-0 text-xs ${page === currentPage ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}`}>
                                    {page}
                                </Button>
                            )
                        })}
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="h-7 w-7 p-0">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
