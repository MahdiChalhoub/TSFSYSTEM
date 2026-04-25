// @ts-nocheck
'use client'

/**
 * ═══════════════════════════════════════════════════════════
 *  MasterListPage — one-component registry page.
 *
 *  Wires DajingoPageShell + DajingoListView + DajingoCustomizePanel
 *  plus all the standard state (search, filters, focus mode,
 *  selection, pagination, policy enforcement, refresh) into a
 *  single drop-in. A new master-data page becomes ~30 lines
 *  instead of ~300.
 *
 *  All three underlying components are already shared — edit
 *  any of them once and every consumer of MasterListPage picks
 *  up the change automatically.
 *
 *  Usage (see /dev/templates/master-list for a runnable demo):
 *
 *    <MasterListPage
 *      config={{
 *        title: 'Widgets',
 *        entityLabel: 'Widget',
 *        icon: <Package size={20} className="text-white" />,
 *        initialData: widgets,
 *        getRowId: r => r.id,
 *        columns: ALL_COLUMNS,
 *        defaultVisibleColumns: DEFAULTS,
 *        searchFields: ['name', 'sku'],
 *        applyFilters: (rows, q, f) => rows.filter(...),
 *        computeKpis: (rows) => [...],
 *        primaryAction: { label: 'New Widget', icon: <Plus />, onClick: () => {} },
 *        renderRowTitle: (r) => <span>{r.name}</span>,
 *        renderColumnCell: (key, r) => <span>{r[key]}</span>,
 *      }}
 *    />
 * ═══════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, type ReactNode, type RefObject } from 'react'
import { Package, Plus } from 'lucide-react'
import { DajingoPageShell } from '@/components/common/DajingoPageShell'
import { DajingoListView } from '@/components/common/DajingoListView'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import type { KPIStat } from '@/components/ui/KPIStrip'


/* ═══════════════════════════════════════════════════════════
 *  Config types — intentionally minimal. Domain code supplies
 *  data + a few renderers; the template does everything else.
 * ═══════════════════════════════════════════════════════════ */

export interface MasterListColumnDef {
    key: string
    label: string
    /** When true, column is hidden behind the customize panel. */
    optional?: boolean
}

export interface MasterListMenuAction<T> {
    label: string
    icon?: ReactNode
    onClick: (row: T) => void
    separator?: boolean
}

export interface MasterListConfig<T> {
    /* ── Identity ── */
    title: string
    /** Short entity label — used in empty state, customize panel, etc. */
    entityLabel: string
    icon: ReactNode
    /** String or fn(rows) → string — recomputed on every filter change. */
    subtitle?: string | ((rows: T[]) => string)

    /* ── Data ── */
    initialData?: T[]
    /** Used by the refresh button + mount fetch if initialData is empty. */
    fetchEndpoint?: string
    /** Used if you want to control the fetch yourself. Must return a Promise<T[]>. */
    fetch?: () => Promise<T[]>
    /** Stable id extractor. */
    getRowId: (row: T) => number | string

    /* ── Columns (see DajingoListView) ── */
    columns: MasterListColumnDef[]
    defaultVisibleColumns: Record<string, boolean>
    defaultVisibleFilters?: Record<string, boolean>
    columnWidths?: Record<string, number>
    rightAlignedCols?: string[]
    centerAlignedCols?: string[]
    growCols?: string[]

    /* ── Filtering ── */
    /** Defaults to empty object; override to ship a filters panel. */
    emptyFilters?: any
    /** Core filtering predicate — consumer owns domain logic. */
    applyFilters?: (rows: T[], search: string, filters: any) => T[]
    /** Returns active filter count (shown on the toolbar pill). */
    countActiveFilters?: (filters: any) => number
    /** Convenience fallback when `applyFilters` isn't supplied — plain
     *  case-insensitive match across these fields (dot paths NOT allowed). */
    searchFields?: (keyof T)[]

    /* ── KPI strip (top of page) ── */
    /** Optional fn → KPIStat[]; fires whenever the filtered set changes. */
    computeKpis?: (rows: T[], allRows: T[]) => KPIStat[]

    /* ── Primary + refresh actions ── */
    primaryAction?: { label: string; icon?: ReactNode; onClick: () => void }

    /* ── Row rendering (passed through to DajingoListView) ── */
    renderRowIcon?: (row: T) => ReactNode
    renderRowTitle?: (row: T) => ReactNode
    renderColumnCell?: (key: string, row: T) => ReactNode
    renderExpanded?: (row: T) => ReactNode
    onView?: (row: T) => void
    menuActions?: (row: T) => MasterListMenuAction<T>[]
    bulkActions?: (selectedIds: Set<number | string>, rows: T[]) => ReactNode

    /* ── Filters + customize panels ── */
    /** Render the filters panel body. Receives current filters + setter. */
    renderFilters?: (ctx: {
        items: T[]
        filters: any
        setFilters: (f: any) => void
        lookups?: any
        visibleFilters: Record<string, boolean>
    }) => ReactNode
    /** Optional extra render for the customize panel. */
    renderCustomize?: (ctx: {
        visibleColumns: Record<string, boolean>
        setVisibleColumns: (v: Record<string, boolean>) => void
        visibleFilters: Record<string, boolean>
        setVisibleFilters: (v: Record<string, boolean>) => void
        columnOrder: string[]
        setColumnOrder: (v: string[]) => void
        policyHiddenColumns: Set<string>
        policyHiddenFilters: Set<string>
    }) => ReactNode
    /** Optional `lookups` blob passed through to renderFilters. */
    lookups?: any

    /* ── Policy / governance (listview-policies) ── */
    /** When set, SaaS admins can hide columns/filters globally for this list. */
    listviewPolicyKey?: string

    /* ── Misc ── */
    searchPlaceholder?: string
    emptyIcon?: ReactNode
    /** Initial page size. Defaults to 50. */
    initialPageSize?: number
}


/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export function MasterListPage<T = any>({ config }: { config: MasterListConfig<T> }) {
    const {
        title, entityLabel, icon, subtitle,
        initialData = [], fetchEndpoint, fetch: fetchFn, getRowId,
        columns, defaultVisibleColumns, defaultVisibleFilters = {},
        columnWidths = {}, rightAlignedCols = [], centerAlignedCols = [], growCols = [],
        emptyFilters = {}, applyFilters: applyFiltersFn, countActiveFilters: countFn,
        searchFields,
        computeKpis, primaryAction,
        renderRowIcon, renderRowTitle, renderColumnCell, renderExpanded,
        onView, menuActions, bulkActions,
        renderFilters, renderCustomize, lookups,
        listviewPolicyKey,
        searchPlaceholder, emptyIcon = <Package size={36} />,
        initialPageSize = 50,
    } = config

    /* ── Core state ── */
    const [items, setItems] = useState<T[]>(initialData)
    const [loading, setLoading] = useState(initialData.length === 0 && (fetchFn || fetchEndpoint))
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState<any>(emptyFilters)
    const [focusMode, setFocusMode] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [showCustomize, setShowCustomize] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set())
    const [pageSize, setPageSize] = useState(initialPageSize)
    const [currentPage, setCurrentPage] = useState(1)
    const searchRef = useRef<HTMLInputElement>(null)

    /* ── Column & filter visibility ── */
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns)
    const [visibleFilters, setVisibleFilters] = useState<Record<string, boolean>>(defaultVisibleFilters)
    const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(c => c.key))

    /* ── Policy enforcement (SaaS listview-policies) ── */
    const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
    const [policyHiddenFilters, setPolicyHiddenFilters] = useState<Set<string>>(new Set())
    useEffect(() => {
        if (!listviewPolicyKey) return
        getListViewPolicy(listviewPolicyKey)
            .then((p: any) => {
                if (!p) return
                if (p.hidden_columns?.length) setPolicyHiddenColumns(new Set(p.hidden_columns))
                if (p.hidden_filters?.length) setPolicyHiddenFilters(new Set(p.hidden_filters))
            })
            .catch(() => { /* no policy = allow everything */ })
    }, [listviewPolicyKey])

    const effectiveVisibleColumns = useMemo(() => {
        if (policyHiddenColumns.size === 0) return visibleColumns
        const eff = { ...visibleColumns }
        for (const key of policyHiddenColumns) eff[key] = false
        return eff
    }, [visibleColumns, policyHiddenColumns])

    /* ── Fetching ── */
    const fetchData = useCallback(async () => {
        if (!fetchFn && !fetchEndpoint) return
        setLoading(true)
        try {
            if (fetchFn) {
                const data = await fetchFn()
                setItems(data || [])
            } else if (fetchEndpoint) {
                // Lazy import so the template stays SSR-safe.
                const { erpFetch } = await import('@/lib/erp-api')
                const data = await erpFetch(fetchEndpoint)
                setItems(Array.isArray(data) ? data : (data?.results || []))
            }
        } catch { /* noop — leave old data */ }
        setLoading(false)
    }, [fetchFn, fetchEndpoint])

    useEffect(() => {
        if (initialData.length === 0 && (fetchFn || fetchEndpoint)) fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* ── Keyboard shortcuts (Ctrl+K / Ctrl+Q) ── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    /* ── Filtering ── */
    const activeFilterCount = useMemo(
        () => (countFn ? countFn(filters) : 0),
        [countFn, filters],
    )
    const filtered = useMemo(() => {
        if (applyFiltersFn) return applyFiltersFn(items, search, filters)
        // Fallback: case-insensitive match across searchFields.
        if (!search.trim() || !searchFields?.length) return items
        const q = search.toLowerCase()
        return items.filter(row => searchFields.some(f => String((row as any)[f] ?? '').toLowerCase().includes(q)))
    }, [items, search, filters, applyFiltersFn, searchFields])
    const hasFilters = !!search || activeFilterCount > 0

    /* ── Pagination ── */
    useEffect(() => { setCurrentPage(1) }, [search, filters])
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const clampedPage = Math.min(currentPage, totalPages)
    const paginated = useMemo(() => {
        const start = (clampedPage - 1) * pageSize
        return filtered.slice(start, start + pageSize)
    }, [filtered, clampedPage, pageSize])

    /* ── Selection ── */
    const toggleSelect = (id: any) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const isAllPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(getRowId(p)))
    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (isAllPageSelected) paginated.forEach(p => next.delete(getRowId(p)))
            else paginated.forEach(p => next.add(getRowId(p)))
            return next
        })
    }

    /* ── KPIs + subtitle resolution ── */
    const kpiStats = useMemo(
        () => (computeKpis ? computeKpis(filtered, items) : []),
        [computeKpis, filtered, items],
    )
    const resolvedSubtitle = typeof subtitle === 'function' ? subtitle(filtered) : subtitle


    /* ═══════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════ */
    return (
        <DajingoPageShell
            title={title}
            icon={icon}
            subtitle={resolvedSubtitle}
            entityLabel={entityLabel}
            kpiStats={kpiStats}
            primaryAction={primaryAction}
            search={search}
            onSearchChange={setSearch}
            searchRef={searchRef as RefObject<HTMLInputElement>}
            searchPlaceholder={searchPlaceholder}
            filteredCount={filtered.length}
            totalCount={items.length}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(v => !v)}
            activeFilterCount={activeFilterCount}
            onRefresh={fetchData}
            renderFilters={renderFilters ? () => renderFilters({
                items, filters, setFilters, lookups, visibleFilters,
            }) : undefined}
        >
            <DajingoListView<T>
                data={paginated}
                allData={filtered}
                loading={loading}
                getRowId={getRowId}
                columns={columns}
                visibleColumns={effectiveVisibleColumns}
                columnWidths={columnWidths}
                rightAlignedCols={rightAlignedCols}
                centerAlignedCols={centerAlignedCols}
                growCols={growCols}
                columnOrder={columnOrder}
                onColumnReorder={setColumnOrder}
                policyHiddenColumns={policyHiddenColumns}
                entityLabel={entityLabel}
                /* ── Integrated toolbar ── */
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={searchPlaceholder}
                searchRef={searchRef as RefObject<HTMLInputElement>}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(v => !v)}
                activeFilterCount={activeFilterCount}
                onToggleCustomize={() => setShowCustomize(true)}
                /* ── Row rendering ── */
                renderRowIcon={renderRowIcon}
                renderRowTitle={renderRowTitle}
                renderColumnCell={renderColumnCell}
                renderExpanded={renderExpanded}
                onView={onView}
                menuActions={menuActions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                isAllPageSelected={isAllPageSelected}
                onToggleSelectAll={toggleSelectAll}
                bulkActions={bulkActions ? bulkActions(selectedIds, items) : undefined}
                hasFilters={hasFilters}
                onClearFilters={() => { setSearch(''); setFilters(emptyFilters) }}
                emptyIcon={emptyIcon}
                pagination={{
                    totalItems: filtered.length,
                    activeFilterCount,
                    currentPage: clampedPage,
                    totalPages,
                    pageSize,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: (n: number) => { setPageSize(n); setCurrentPage(1) },
                }}
            />

            {showCustomize && renderCustomize && renderCustomize({
                visibleColumns, setVisibleColumns,
                visibleFilters, setVisibleFilters,
                columnOrder, setColumnOrder,
                policyHiddenColumns, policyHiddenFilters,
            })}
        </DajingoPageShell>
    )
}
