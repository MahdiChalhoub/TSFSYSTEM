'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
    Inbox, Clock, CheckCircle2, XCircle, PlayCircle, Bell, Ban,
} from 'lucide-react'

import { DajingoPageShell } from '@/components/common/DajingoPageShell'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import type { KPIStat } from '@/components/ui/KPIStrip'

import {
    listProcurementRequests,
    type ProcurementRequestRecord,
    type ProcurementRequestStatus,
} from '@/app/actions/inventory/procurement-requests'
import { makeRunAction, buildMenuActions, bulkBumpAll, bulkCancelAll } from './_lib/actions'

import {
    ALL_COLUMNS, COLUMN_WIDTHS, RIGHT_ALIGNED_COLS, GROW_COLS,
    EMPTY_FILTERS, type Filters,
} from './_lib/constants'
import { TYPE_META } from './_lib/meta'
import { renderRequestCell } from './_components/RequestColumns'
import { FiltersPanel } from './_components/FiltersPanel'

const STORAGE_KEY = 'inventory_requests_view_v1'

function loadView(): { visibleColumns: Record<string, boolean>; columnOrder: string[]; pageSize: number } {
    if (typeof window === 'undefined') return defaultView()
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return defaultView()
        const parsed = JSON.parse(raw)
        return {
            visibleColumns: parsed.visibleColumns ?? defaultView().visibleColumns,
            columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : defaultView().columnOrder,
            pageSize: typeof parsed.pageSize === 'number' ? parsed.pageSize : 50,
        }
    } catch { return defaultView() }
}

function defaultView() {
    const visibleColumns: Record<string, boolean> = {}
    for (const c of ALL_COLUMNS) visibleColumns[c.key] = c.defaultVisible
    return {
        visibleColumns,
        columnOrder: ALL_COLUMNS.map(c => c.key),
        pageSize: 50,
    }
}

function saveView(view: { visibleColumns: Record<string, boolean>; columnOrder: string[]; pageSize: number }) {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view)) } catch {}
}

export default function ProcurementRequestsPage() {
    const [requests, setRequests] = useState<ProcurementRequestRecord[]>([])
    const [loading, setLoading] = useState(true)
    /* Track the last load's error so the "no requests" empty state can
     * distinguish "you genuinely have none" from "the request failed".
     * Without this, an auth/tenant-context/500 error rendered identically
     * to a real empty list — operators with hundreds of requests were
     * told "go create one". */
    const [loadError, setLoadError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
    const [focusMode, setFocusMode] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [pending, startTransition] = useTransition()
    const searchRef = useRef<HTMLInputElement>(null)

    const initialView = useMemo(loadView, [])
    const [visibleColumns, setVisibleColumns] = useState(initialView.visibleColumns)
    const [columnOrder, setColumnOrder] = useState<string[]>(initialView.columnOrder)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(initialView.pageSize)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    useEffect(() => {
        saveView({ visibleColumns, columnOrder, pageSize })
    }, [visibleColumns, columnOrder, pageSize])

    const refresh = () => {
        setLoading(true)
        listProcurementRequests().then(result => {
            setRequests(result.data)
            setLoadError(result.error || null)
            setLoading(false)
        })
    }
    useEffect(() => { refresh() }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(v => !v) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const counts = useMemo(() => {
        const c: Record<ProcurementRequestStatus, number> & { ALL: number; BUMPED: number } = {
            ALL: requests.length, PENDING: 0, APPROVED: 0, EXECUTED: 0, REJECTED: 0, CANCELLED: 0, BUMPED: 0,
        }
        for (const r of requests) {
            c[r.status]++
            if (r.bump_count > 0) c.BUMPED++
        }
        return c
    }, [requests])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        const list = requests.filter(r => {
            if (filters.status !== 'ALL' && r.status !== filters.status) return false
            if (filters.type !== 'ALL' && r.request_type !== filters.type) return false
            if (filters.priority !== 'ALL' && r.priority !== filters.priority) return false
            if (filters.onlyBumped && r.bump_count === 0) return false
            if (q) {
                const hay = `${r.product_name || ''} ${r.product_sku || ''} ${r.supplier_name || ''} ${r.reason || ''}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
        const activity = (r: ProcurementRequestRecord) => new Date(r.last_bumped_at || r.requested_at).getTime()
        return list.sort((a, b) => activity(b) - activity(a))
    }, [requests, search, filters])

    const activeFilterCount = useMemo(() => {
        let n = 0
        if (filters.status !== 'ALL') n++
        if (filters.type !== 'ALL') n++
        if (filters.priority !== 'ALL') n++
        if (filters.onlyBumped) n++
        return n
    }, [filters])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const clampedPage = Math.min(currentPage, totalPages)
    useEffect(() => { if (currentPage !== clampedPage) setCurrentPage(clampedPage) }, [currentPage, clampedPage])
    const pageSlice = useMemo(
        () => filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
        [filtered, clampedPage, pageSize],
    )

    const kpis: KPIStat[] = useMemo(() => [
        { label: 'All',       value: counts.ALL,       color: 'var(--app-primary)',          icon: <Inbox size={14} />,        filterKey: 'ALL' },
        { label: 'Pending',   value: counts.PENDING,   color: 'var(--app-warning, #f59e0b)', icon: <Clock size={14} />,        filterKey: 'PENDING' },
        { label: 'Approved',  value: counts.APPROVED,  color: 'var(--app-info, #3b82f6)',    icon: <CheckCircle2 size={14} />, filterKey: 'APPROVED' },
        { label: 'Executed',  value: counts.EXECUTED,  color: 'var(--app-success, #22c55e)', icon: <PlayCircle size={14} />,   filterKey: 'EXECUTED' },
        { label: 'Rejected',  value: counts.REJECTED,  color: 'var(--app-error, #ef4444)',   icon: <XCircle size={14} />,      filterKey: 'REJECTED' },
        { label: 'Bumped',    value: counts.BUMPED,    color: 'var(--app-accent)',                     icon: <Bell size={14} />,         filterKey: 'BUMPED' },
    ], [counts])

    const toggleSelect = (id: number | string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id as number)) next.delete(id as number)
            else next.add(id as number)
            return next
        })
    }
    const toggleSelectAll = () => {
        const ids = new Set(pageSlice.map(r => r.id))
        const allSelected = pageSlice.every(r => selectedIds.has(r.id))
        setSelectedIds(allSelected ? new Set([...selectedIds].filter(id => !ids.has(id))) : new Set([...selectedIds, ...ids]))
    }
    const isAllPageSelected = pageSlice.length > 0 && pageSlice.every(r => selectedIds.has(r.id))

    const runAction = makeRunAction(startTransition, refresh)
    const bulkBump = () => bulkBumpAll(selectedIds, startTransition, setSelectedIds, refresh)
    const bulkCancel = () => bulkCancelAll(selectedIds, startTransition, setSelectedIds, refresh)
    const menuActions = (r: ProcurementRequestRecord) => buildMenuActions(r, runAction, startTransition, refresh)

    const columns: DajingoColumnDef[] = ALL_COLUMNS

    return (
        <DajingoPageShell
            title="Procurement Requests"
            icon={<Inbox size={20} className="text-white" />}
            entityLabel="Request"
            kpiStats={kpis}
            search={search}
            onSearchChange={setSearch}
            searchRef={searchRef}
            searchPlaceholder="Search by product, SKU, supplier, reason... (Ctrl+K)"
            filteredCount={filtered.length}
            totalCount={counts.ALL}
            focusMode={focusMode}
            onFocusModeChange={setFocusMode}
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(v => !v)}
            activeFilterCount={activeFilterCount}
            onRefresh={refresh}
            renderFilters={() => <FiltersPanel isOpen={showFilters} filters={filters} setFilters={setFilters} />}
        >
            <DajingoListView<ProcurementRequestRecord>
                data={pageSlice}
                allData={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={visibleColumns}
                columnWidths={COLUMN_WIDTHS}
                rightAlignedCols={RIGHT_ALIGNED_COLS}
                growCols={GROW_COLS}
                columnOrder={columnOrder}
                onColumnReorder={setColumnOrder}
                renderRowIcon={r => {
                    const tm = TYPE_META[r.request_type]
                    const Icon = tm.icon
                    return (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${tm.color} 12%, transparent)`, color: tm.color }}>
                            <Icon size={13} />
                        </div>
                    )
                }}
                renderRowTitle={r => (
                    <div className="flex-1 min-w-0">
                        <div className="truncate text-[12px] font-bold text-app-foreground">
                            {r.product_name || `Product #${r.product}`}
                        </div>
                        <div className="text-[10px] font-mono text-app-muted-foreground truncate">
                            {r.product_sku || '—'}
                            {r.bump_count > 0 && (
                                <span className="ml-2" style={{ color: 'var(--app-accent)' }}>
                                    🔔 ×{r.bump_count}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                renderColumnCell={(key, r) => renderRequestCell(key, r)}
                menuActions={menuActions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                isAllPageSelected={isAllPageSelected}
                onToggleSelectAll={toggleSelectAll}
                bulkActions={
                    <>
                        <button onClick={bulkBump} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-accent) 35%, transparent)', color: 'var(--app-accent)' }}>
                            <Bell size={11} /> Bump {selectedIds.size}
                        </button>
                        <button onClick={bulkCancel} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-error/30 text-app-error hover:bg-app-error/10 transition-all disabled:opacity-50">
                            <Ban size={11} /> Cancel {selectedIds.size}
                        </button>
                    </>
                }
                pagination={{
                    totalItems: filtered.length,
                    activeFilterCount,
                    currentPage: clampedPage,
                    totalPages,
                    pageSize,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: n => { setPageSize(n); setCurrentPage(1) },
                }}
                emptyIcon={<Inbox size={36} />}
                emptyMessage={
                    loadError
                        ? `Couldn't load requests — ${loadError}. Check your connection or session and refresh.`
                        : activeFilterCount > 0 || search
                            ? 'No requests match the current filters.'
                            : 'No requests yet — open /inventory/products and click "Request Purchase" or "Request Transfer".'
                }
                hasFilters={activeFilterCount > 0 || !!search}
                onClearFilters={() => { setSearch(''); setFilters(EMPTY_FILTERS) }}
                entityLabel="Request"
                search={search}
                onSearchChange={setSearch}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(v => !v)}
                activeFilterCount={activeFilterCount}
                onSetVisibleColumns={setVisibleColumns}
                onSetColumnOrder={setColumnOrder}
                moduleKey="procurement-requests"
            />
        </DajingoPageShell>
    )
}

