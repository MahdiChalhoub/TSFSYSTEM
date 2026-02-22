'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
    Download, Plus, ChevronDown, ChevronUp, Lock, LockOpen,
    CheckCircle2, Eye, Pencil, Trash2, Search
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

/* ─────────────────────── TYPES ─────────────────────── */

export type FilterOption = {
    key: string
    label: string
    options: { value: string; label: string }[]
    value?: string
}

export type ColumnDef<T> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (row: T) => React.ReactNode
    sortable?: boolean
    width?: string
}

export type DetailColumnDef<D> = {
    key: string
    label: string
    align?: 'left' | 'center' | 'right'
    render?: (detail: D) => React.ReactNode
}

export type InventoryListViewProps<T, D = any> = {
    /* Header */
    title: string
    addLabel: string
    onAdd: () => void
    onExport?: () => void

    /* Data */
    data: T[]
    loading?: boolean
    getRowId: (row: T) => string | number

    /* Columns */
    columns: ColumnDef<T>[]

    /* Filters */
    filters?: FilterOption[]
    onFilterChange?: (key: string, value: string) => void
    searchPlaceholder?: string
    searchValue?: string
    onSearchChange?: (value: string) => void

    /* Expandable detail rows */
    detailColumns?: DetailColumnDef<D>[]
    getDetails?: (row: T) => D[]
    detailActions?: (detail: D, row: T) => React.ReactNode

    /* Status / Lifecycle */
    getStatus?: (row: T) => { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }
    getVerified?: (row: T) => boolean
    getLocked?: (row: T) => boolean
    onLockToggle?: (row: T) => void

    /* Row actions */
    onView?: (row: T) => void
    onEdit?: (row: T) => void
    onDelete?: (row: T) => void
}

/* ─────────────────── STATUS BADGE ──────────────────── */

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

/* ─────────────────── LOADING ROWS ──────────────────── */

function LoadingSkeleton({ columns }: { columns: number }) {
    return (
        <>
            {[1, 2, 3, 4].map(i => (
                <TableRow key={i}>
                    {Array.from({ length: columns }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}

/* ─────────────────── MAIN COMPONENT ────────────────── */

export function InventoryListView<T extends Record<string, any>, D extends Record<string, any> = any>({
    title, addLabel, onAdd, onExport,
    data, loading, getRowId,
    columns,
    filters, onFilterChange, searchPlaceholder, searchValue, onSearchChange,
    detailColumns, getDetails, detailActions,
    getStatus, getVerified, getLocked, onLockToggle,
    onView, onEdit, onDelete,
}: InventoryListViewProps<T, D>) {

    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())

    const toggleRow = useCallback((id: string | number) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const hasDetails = !!detailColumns && !!getDetails
    const hasStatus = !!getStatus
    const hasVerified = !!getVerified
    const hasLock = !!getLocked
    const hasActions = !!onView || !!onEdit || !!onDelete

    /* Column count for detail row colspan */
    const totalCols =
        columns.length
        + (hasDetails ? 1 : 0)          /* expand toggle */
        + (hasStatus ? 1 : 0)           /* status */
        + (hasVerified ? 1 : 0)         /* verified */
        + (hasLock ? 1 : 0)             /* lock */
        + (hasActions ? 1 : 0)          /* actions */

    return (
        <div className="space-y-4">
            {/* ─── HEADER ─────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                <div className="flex items-center gap-2">
                    {onExport && (
                        <Button variant="outline" size="sm" onClick={onExport}>
                            <Download className="h-4 w-4 mr-1.5" /> Export
                        </Button>
                    )}
                    <Button size="sm" onClick={onAdd}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Plus className="h-4 w-4 mr-1.5" /> {addLabel}
                    </Button>
                </div>
            </div>

            {/* ─── FILTER BAR ─────────────────────────────────── */}
            {(filters?.length || onSearchChange) && (
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
                    {onSearchChange && (
                        <div className="relative w-56">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={searchPlaceholder || 'Search...'}
                                value={searchValue || ''}
                                onChange={e => onSearchChange(e.target.value)}
                                className="pl-8 h-8 text-sm"
                            />
                        </div>
                    )}
                    {filters?.map(f => (
                        <Select key={f.key} value={f.value || ''} onValueChange={v => onFilterChange?.(f.key, v)}>
                            <SelectTrigger className="h-8 w-auto min-w-[130px] text-sm gap-1">
                                <span className="text-gray-500 text-xs mr-1">▽</span>
                                <SelectValue placeholder={f.label} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">{f.label}</SelectItem>
                                {f.options.map(o => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ))}
                </div>
            )}

            {/* ─── TABLE ──────────────────────────────────────── */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/60">
                            {columns.map(col => (
                                <TableHead key={col.key}
                                    className={`text-xs font-semibold text-gray-600 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                                    style={col.width ? { width: col.width } : undefined}
                                >
                                    {col.label}
                                </TableHead>
                            ))}
                            {hasStatus && <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>}
                            {hasVerified && <TableHead className="text-xs font-semibold text-gray-600 text-center">Verified</TableHead>}
                            {hasLock && <TableHead className="text-xs font-semibold text-gray-600 text-center">Lock</TableHead>}
                            {hasDetails && <TableHead className="text-xs font-semibold text-gray-600 text-center">Details</TableHead>}
                            {hasActions && <TableHead className="text-xs font-semibold text-gray-600 text-center">Action</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <LoadingSkeleton columns={totalCols} />
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={totalCols} className="text-center py-12 text-gray-400">
                                    No records found
                                </TableCell>
                            </TableRow>
                        ) : data.map(row => {
                            const rowId = getRowId(row)
                            const isExpanded = expandedRows.has(rowId)
                            const details = hasDetails ? getDetails!(row) : []

                            return (
                                <React.Fragment key={rowId}>
                                    {/* ─── Master Row ─── */}
                                    <TableRow className="hover:bg-gray-50/50 transition-colors">
                                        {columns.map(col => (
                                            <TableCell key={col.key}
                                                className={`text-sm ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                                                {col.render ? col.render(row) : String(row[col.key] ?? '')}
                                            </TableCell>
                                        ))}
                                        {hasStatus && (
                                            <TableCell>
                                                {(() => { const s = getStatus!(row); return <StatusBadge label={s.label} variant={s.variant} /> })()}
                                            </TableCell>
                                        )}
                                        {hasVerified && (
                                            <TableCell className="text-center">
                                                {getVerified!(row)
                                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                                                    : <div className="h-5 w-5 rounded-full border-2 border-gray-200 mx-auto" />}
                                            </TableCell>
                                        )}
                                        {hasLock && (
                                            <TableCell className="text-center">
                                                <button onClick={() => onLockToggle?.(row)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {getLocked!(row)
                                                        ? <Lock className="h-4 w-4 text-gray-700" />
                                                        : <LockOpen className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasDetails && (
                                            <TableCell className="text-center">
                                                <button onClick={() => toggleRow(rowId)}
                                                    className="p-1 rounded hover:bg-gray-100 transition-colors mx-auto block">
                                                    {isExpanded
                                                        ? <ChevronUp className="h-4 w-4 text-gray-600" />
                                                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        {hasActions && (
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {onView && (
                                                        <button onClick={() => onView(row)}
                                                            className="p-1 rounded hover:bg-gray-100 transition-colors">
                                                            <Eye className="h-4 w-4 text-gray-500" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button onClick={() => onEdit(row)}
                                                            className="p-1 rounded hover:bg-blue-50 transition-colors">
                                                            <Pencil className="h-4 w-4 text-blue-500" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button onClick={() => onDelete(row)}
                                                            className="p-1 rounded hover:bg-red-50 transition-colors">
                                                            <Trash2 className="h-4 w-4 text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>

                                    {/* ─── Detail Rows ─── */}
                                    {hasDetails && isExpanded && details.length > 0 && (
                                        <TableRow>
                                            <TableCell colSpan={totalCols} className="p-0 bg-gray-50/30">
                                                <div className="mx-6 my-3 rounded-lg border border-emerald-200 overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-emerald-50/80">
                                                                {detailActions && (
                                                                    <TableHead className="text-xs font-semibold text-emerald-700">Action</TableHead>
                                                                )}
                                                                {detailColumns!.map(dc => (
                                                                    <TableHead key={dc.key}
                                                                        className={`text-xs font-semibold text-emerald-700 ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
                                                                        {dc.label}
                                                                    </TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {details.map((d, idx) => (
                                                                <TableRow key={idx} className="hover:bg-emerald-50/30">
                                                                    {detailActions && (
                                                                        <TableCell className="text-sm">
                                                                            {detailActions(d, row)}
                                                                        </TableCell>
                                                                    )}
                                                                    {detailColumns!.map(dc => (
                                                                        <TableCell key={dc.key}
                                                                            className={`text-sm ${dc.align === 'right' ? 'text-right' : dc.align === 'center' ? 'text-center' : ''}`}>
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
            </div>
        </div>
    )
}
