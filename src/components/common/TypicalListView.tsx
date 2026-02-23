'use client'

import React, { useState, useMemo } from 'react'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
    Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
    MoreHorizontal, ChevronDown, ChevronRight, Eye, Pencil, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Settings2, Download, Plus,
    CheckCircle2, XCircle, Lock, Unlock, Check, LayoutGrid, List
} from 'lucide-react'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════
   TypicalListView — Universal data table component
   ═══════════════════════════════════════════════════════ */

export type ColumnDef<T> = {
    key: string
    label: string
    render?: (row: T) => React.ReactNode
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    alwaysVisible?: boolean
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
    visibleColumns?: string[] // Controlled by useListViewSettings
    onToggleColumn?: (key: string) => void

    /** Row selection state */
    selection?: {
        selectedIds: Set<string | number>
        onSelectionChange: (ids: Set<string | number>) => void
    }

    /** Bulk actions rendered when rows are selected */
    bulkActions?: React.ReactNode

    /** Lifecycle rendering & actions (Lock/Verify/Approve/Cancel) */
    lifecycle?: LifecycleConfig<T>

    /** Custom badges/indicators after title */
    headerExtras?: React.ReactNode
    headerExtra?: React.ReactNode // Backward compatibility

    /** Nested rows logic */
    expandable?: {
        columns: ColumnDef<D>[]
        getDetails: (row: T | any) => D[]
        renderActions?: (detail: D, parent: T) => React.ReactNode
    }

    /** Custom expanded content (takes precedence over nested rows) */
    renderExpanded?: (row: T) => React.ReactNode

    /** Actions on individual rows */
    actions?: {
        onView?: (row: T) => void
        onEdit?: (row: T) => void
        onDelete?: (row: T) => void
        extra?: (row: T) => React.ReactNode
    }

    /** Pagination & Sorting (Controlled by useListViewSettings or Internal) */
    pageSize?: number
    onPageSizeChange?: (size: number) => void
    sortKey?: string
    sortDir?: 'asc' | 'desc'
    onSort?: (key: string, dir: 'asc' | 'desc') => void

    /** View Mode support */
    viewMode?: 'table' | 'grid'
    onViewModeChange?: (mode: 'table' | 'grid') => void
    renderCard?: (row: T) => React.ReactNode
    gridClassName?: string

    className?: string
    children?: React.ReactNode // Usually TypicalFilter
}

export function TypicalListView<T, D = any>({
    title, addLabel, onAdd, onExport,
    data, loading, getRowId,
    columns, visibleColumns, onToggleColumn,
    selection, bulkActions,
    lifecycle, headerExtras, headerExtra,
    expandable, actions, renderExpanded,
    pageSize = 25, onPageSizeChange,
    sortKey, sortDir, onSort,
    viewMode: initialViewMode = 'table', onViewModeChange, renderCard, gridClassName,
    className,
    children
}: TypicalListViewProps<T, D>) {

    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
    const [currentPage, setCurrentPage] = useState(1)
    const [viewModeState, setViewModeState] = useState<'table' | 'grid'>(initialViewMode)

    const viewMode = onViewModeChange ? initialViewMode : viewModeState
    const handleViewModeChange = (mode: 'table' | 'grid') => {
        if (onViewModeChange) onViewModeChange(mode)
        else setViewModeState(mode)
    }

    // Filter columns based on visibility
    const activeColumns = useMemo(() => {
        if (!visibleColumns) return columns
        return columns.filter(c => c.alwaysVisible || visibleColumns.includes(c.key))
    }, [columns, visibleColumns])

    const safeData = Array.isArray(data) ? data : []

    // Client-side Sort Logic
    const sortedData = useMemo(() => {
        if (!sortKey) return safeData
        const dir = sortDir === 'desc' ? -1 : 1
        return [...safeData].sort((a: any, b: any) => {
            const valA = a[sortKey]
            const valB = b[sortKey]
            if (valA < valB) return -1 * dir
            if (valA > valB) return 1 * dir
            return 0
        })
    }, [safeData, sortKey, sortDir])

    // Client-side Pagination Logic
    const totalPages = Math.ceil(sortedData.length / pageSize)
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return sortedData.slice(start, start + pageSize)
    }, [sortedData, currentPage, pageSize])

    const toggleExpand = (id: string | number) => {
        const next = new Set(expandedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedRows(next)
    }

    const toggleSort = (key: string) => {
        if (!onSort) return
        const dir = (sortKey === key && sortDir === 'asc') ? 'desc' : 'asc'
        onSort(key, dir)
    }

    const handleSelectAll = (checked: boolean) => {
        if (!selection) return
        if (checked) {
            selection.onSelectionChange(new Set(paginatedData.map(r => getRowId(r))))
        } else {
            selection.onSelectionChange(new Set())
        }
    }

    const handleSelectRow = (id: string | number, checked: boolean) => {
        if (!selection) return
        const next = new Set(selection.selectedIds)
        if (checked) next.add(id)
        else next.delete(id)
        selection.onSelectionChange(next)
    }

    return (
        <div className={cn("space-y-4 bg-white rounded-xl shadow-sm border border-gray-100 p-1", className)}>
            {/* ─── Header Section ────────────────── */}
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-100 font-bold border-none">
                        {safeData.length}
                    </Badge>
                    {headerExtras}
                    {headerExtra}
                </div>

                <div className="flex items-center gap-4">
                    {/* View Mode Toggle */}
                    {renderCard && (
                        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as 'table' | 'grid')} className="hidden sm:block">
                            <TabsList className="bg-gray-100/50 p-1 h-9 rounded-lg">
                                <TabsTrigger value="table" className="h-7 px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <List className="h-4 w-4 text-gray-400 data-[state=active]:text-emerald-500" />
                                </TabsTrigger>
                                <TabsTrigger value="grid" className="h-7 px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    <LayoutGrid className="h-4 w-4 text-gray-400 data-[state=active]:text-emerald-500" />
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}

                    <div className="flex items-center gap-2">
                        {onExport && (
                            <Button variant="outline" size="sm" onClick={onExport} className="text-xs border-gray-200">
                                <Download className="h-4 w-4 mr-2 text-gray-400" /> Export
                            </Button>
                        )}

                        {/* Column Visibility Popover */}
                        {onToggleColumn && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-xs border-gray-200">
                                        <Settings2 className="h-4 w-4 mr-2 text-gray-400" /> Columns
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="end">
                                    <div className="space-y-1">
                                        <p className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">Visible Columns</p>
                                        {columns.map(c => (
                                            <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                                                <Checkbox
                                                    checked={c.alwaysVisible || visibleColumns?.includes(c.key)}
                                                    onCheckedChange={() => onToggleColumn(c.key)}
                                                    disabled={c.alwaysVisible}
                                                />
                                                <span className={`text-sm ${c.alwaysVisible ? 'text-gray-400' : 'text-gray-700'}`}>{c.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        {onAdd && (
                            <Button onClick={onAdd} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-xs font-bold shadow-emerald-100 shadow-lg border-none px-4">
                                <Plus className="h-4 w-4 mr-1 text-white stroke-[3px]" /> {addLabel || 'ADD'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Filter Section ────────────────── */}
            {children && <div className="px-5">{children}</div>}

            {/* ─── Bulk Actions Bar ──────────────── */}
            {selection && selection.selectedIds.size > 0 && (
                <div className="mx-5 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2 duration-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-indigo-700">{selection.selectedIds.size} lines selected</span>
                        <div className="h-4 w-px bg-indigo-200" />
                        <button onClick={() => selection.onSelectionChange(new Set())} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium underline underline-offset-4">
                            Clear selection
                        </button>
                    </div>
                    {bulkActions && <div className="flex items-center gap-2">{bulkActions}</div>}
                </div>
            )}

            {/* ─── Table Section ─────────────────── */}
            {viewMode === 'table' ? (
                <div className="relative overflow-x-auto min-h-[300px]">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="border-b-0 hover:bg-transparent">
                                {/* Expandable Chevron Placeholder */}
                                {(expandable || renderExpanded) && <TableHead className="w-10"></TableHead>}

                                {/* Selection Checkbox */}
                                {selection && (
                                    <TableHead className="w-10 px-4">
                                        <Checkbox
                                            checked={paginatedData.length > 0 && paginatedData.every(r => selection.selectedIds.has(getRowId(r)))}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                )}

                                {activeColumns.map(c => (
                                    <TableHead key={c.key} className={`text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 py-4 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                                        {c.sortable ? (
                                            <button onClick={() => toggleSort(c.key)} className="group inline-flex items-center hover:text-gray-900 transition-colors gap-1">
                                                {c.label}
                                                {sortKey === c.key ? (
                                                    sortDir === 'desc' ? <ArrowDown className="h-3 w-3 text-emerald-500" /> : <ArrowUp className="h-3 w-3 text-emerald-500" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 text-gray-300" />
                                                )}
                                            </button>
                                        ) : (
                                            c.label
                                        )}
                                    </TableHead>
                                ))}

                                {/* Indicators Placeholder (Status, Verified, Locked) */}
                                {lifecycle && (
                                    <>
                                        <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-widest w-28 px-4 text-center">Status</TableHead>
                                        <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16 px-4 text-center">Verified</TableHead>
                                        <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16 px-4 text-center">Lock</TableHead>
                                    </>
                                )}

                                {actions && <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-widest w-24 px-4 text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i} className="animate-pulse">
                                        <TableCell colSpan={activeColumns.length + 5} className="h-12 bg-gray-50/50" />
                                    </TableRow>
                                ))
                            ) : paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeColumns.length + (expandable ? 1 : 0) + (selection ? 1 : 0) + (lifecycle ? 3 : 0) + (actions ? 1 : 0)} className="h-32 text-center text-gray-400 text-sm">
                                        No results found
                                    </TableCell>
                                </TableRow>
                            ) : paginatedData.map(row => {
                                const id = getRowId(row)
                                const isExpanded = expandedRows.has(id)
                                const isSelected = selection?.selectedIds.has(id)

                                return (
                                    <React.Fragment key={id}>
                                        <TableRow className={`group cursor-pointer transition-colors border-b border-gray-50 ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-gray-50/80'}`}>
                                            {(expandable || renderExpanded) && (
                                                <TableCell className="px-4" onClick={() => toggleExpand(id)}>
                                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                                </TableCell>
                                            )}

                                            {selection && (
                                                <TableCell className="px-4">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => handleSelectRow(id, !!checked)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </TableCell>
                                            )}

                                            {activeColumns.map(c => (
                                                <TableCell key={c.key} className={`px-4 py-4 text-sm ${c.align === 'right' ? 'text-right font-mono' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                                                    {c.render ? c.render(row) : (row as any)[c.key]}
                                                </TableCell>
                                            ))}

                                            {/* Lifecycle Indicators */}
                                            {lifecycle && (
                                                <>
                                                    <TableCell className="px-4 text-center">
                                                        {lifecycle.getStatus && (() => {
                                                            const s = lifecycle.getStatus(row)
                                                            const colorMap: Record<string, string> = {
                                                                default: 'bg-gray-100 text-gray-600',
                                                                success: 'bg-emerald-100 text-emerald-700',
                                                                warning: 'bg-amber-100 text-amber-700',
                                                                danger: 'bg-rose-100 text-rose-700',
                                                                info: 'bg-blue-100 text-blue-700'
                                                            }
                                                            return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colorMap[s.variant]}`}>{s.label}</span>
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="px-4 text-center">
                                                        {lifecycle.getVerified?.(row) ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <div className="h-4 w-4 rounded-full border border-gray-200 mx-auto" />}
                                                    </TableCell>
                                                    <TableCell className="px-4 text-center">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); lifecycle.onLockToggle?.(row) }}
                                                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                                        >
                                                            {lifecycle.getLocked?.(row) ? <Lock className="h-4 w-4 text-amber-500" /> : <Unlock className="h-4 w-4 text-gray-300" />}
                                                        </button>
                                                    </TableCell>
                                                </>
                                            )}

                                            {/* Row Actions */}
                                            {actions && (
                                                <TableCell className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                                                        {(lifecycle?.onApprove || lifecycle?.onCancel) && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600">
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    {lifecycle.onApprove && !lifecycle.getApproved?.(row) && !lifecycle.getCanceled?.(row) && (
                                                                        <DropdownMenuItem onClick={() => lifecycle.onApprove?.(row)} className="text-emerald-600 font-semibold focus:text-emerald-600 focus:bg-emerald-50">
                                                                            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {lifecycle.onCancel && !lifecycle.getCanceled?.(row) && (
                                                                        <DropdownMenuItem onClick={() => lifecycle.onCancel?.(row)} className="text-rose-600 font-semibold focus:text-rose-600 focus:bg-rose-50">
                                                                            <XCircle className="mr-2 h-4 w-4" /> Cancel
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}

                                                        {actions.onView && (
                                                            <button onClick={() => actions.onView!(row)} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                        {actions.extra && actions.extra(row)}
                                                        {actions.onEdit && (
                                                            <button onClick={() => actions.onEdit!(row)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all">
                                                                <Pencil size={16} />
                                                            </button>
                                                        )}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all">
                                                                    <MoreHorizontal size={16} />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 p-1">
                                                                <DropdownMenuItem className="text-xs font-medium">Download PDF</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-xs font-medium">Send Email</DropdownMenuItem>
                                                                {actions.onDelete && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => actions.onDelete!(row)} className="text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600">
                                                                            <Trash2 size={14} className="mr-2" /> Delete
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>

                                        {/* Expandable Content (Details or Custom) */}
                                        {(expandable || renderExpanded) && isExpanded && (
                                            <TableRow className="bg-emerald-50/10 border-l-2 border-emerald-400 hover:bg-emerald-50/10">
                                                <TableCell colSpan={activeColumns.length + (selection ? 2 : 1) + (lifecycle ? 3 : 0) + (actions ? 1 : 0)} className="p-0">
                                                    {renderExpanded ? (
                                                        renderExpanded(row)
                                                    ) : expandable && (
                                                        <div className="p-5 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                                            <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                                                                <Table>
                                                                    <TableHeader className="bg-emerald-50/50">
                                                                        <TableRow className="border-b-0 hover:bg-transparent">
                                                                            {expandable.columns.map(ec => (
                                                                                <TableHead key={ec.key} className={`text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-4 py-3 ${ec.align === 'right' ? 'text-right' : 'text-left'}`}>
                                                                                    {ec.label}
                                                                                </TableHead>
                                                                            ))}
                                                                            {expandable.renderActions && <TableHead className="w-20"></TableHead>}
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {expandable.getDetails(row).map((detail: any, di: number) => (
                                                                            <TableRow key={di} className="hover:bg-emerald-50/30 border-b border-emerald-50 last:border-0">
                                                                                {expandable.columns.map(ec => (
                                                                                    <TableCell key={ec.key} className={`px-4 py-3 text-xs ${ec.align === 'right' ? 'text-right font-mono' : 'text-left'}`}>
                                                                                        {ec.render ? ec.render(detail) : detail[ec.key]}
                                                                                    </TableCell>
                                                                                ))}
                                                                                {expandable.renderActions && (
                                                                                    <TableCell className="px-4 py-1 text-right">
                                                                                        {expandable.renderActions(detail, row)}
                                                                                    </TableCell>
                                                                                )}
                                                                            </TableRow>
                                                                        ))}
                                                                        {expandable.getDetails(row).length === 0 && (
                                                                            <TableRow>
                                                                                <TableCell colSpan={expandable.columns.length + 1} className="py-4 text-center text-xs text-emerald-400 font-medium">
                                                                                    No details available for this record
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className={`px-5 py-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500 ${gridClassName}`}>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-64 bg-gray-50 rounded-[2.5rem] animate-pulse" />
                        ))
                    ) : paginatedData.length === 0 ? (
                        <div className="col-span-full py-32 text-center text-gray-400">
                            No results found
                        </div>
                    ) : paginatedData.map(row => (
                        <div key={getRowId(row)} className="relative h-full">
                            {selection && (
                                <div className="absolute top-6 right-6 z-20">
                                    <Checkbox
                                        checked={selection.selectedIds.has(getRowId(row))}
                                        onCheckedChange={(checked) => handleSelectRow(getRowId(row), !!checked)}
                                    />
                                </div>
                            )}
                            {renderCard ? renderCard(row) : (
                                <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm h-full">
                                    <pre className="text-[10px] overflow-auto">{JSON.stringify(row, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Pagination Section ────────────── */}
            <div className="px-5 py-3 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <p className="text-xs text-gray-400 font-medium whitespace-nowrap">
                        Showing <span className="text-gray-700 font-bold">{Math.min(sortedData.length, (currentPage - 1) * pageSize + 1)}</span>
                        {' '}- <span className="text-gray-700 font-bold">{Math.min(sortedData.length, currentPage * pageSize)}</span>
                        {' '}of <span className="text-gray-700 font-bold">{sortedData.length}</span> results
                    </p>

                    {onPageSizeChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Rows:</span>
                            <Select value={String(pageSize)} onValueChange={v => onPageSizeChange(parseInt(v))}>
                                <SelectTrigger className="h-7 w-16 text-xs bg-gray-50 border-none shadow-none focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 25, 50, 100].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-8 px-2 text-xs font-bold text-gray-400 hover:text-gray-900"
                        >
                            First
                        </Button>
                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                // Simple sliding window for page numbers
                                let pageNum = i + 1
                                if (totalPages > 5) {
                                    if (currentPage > 3) pageNum = currentPage - 3 + i + 1
                                    if (pageNum > totalPages) pageNum = totalPages - (4 - i)
                                }
                                if (pageNum <= 0) return null

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`h-7 w-7 rounded-md text-xs font-bold transition-all ${currentPage === pageNum
                                            ? 'bg-white shadow text-emerald-600'
                                            : 'text-gray-400 hover:text-emerald-500'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="h-8 px-2 text-xs font-bold text-gray-400 hover:text-gray-900"
                        >
                            Last
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
