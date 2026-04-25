/**
 * PurchasesRegistryClient — Optimized V2 Registry
 * ==============================================
 * Migrated from TreeMasterPage to DajingoPageShell + DajingoListView.
 * Provides the modern workstation feel with integrated search, column customization,
 * advanced filtering, and high-density transactional layout.
 */
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus, ClipboardList, ShoppingCart, DollarSign, Clock, CheckCircle2,
    Truck, BarChart3, Edit, Eye, Receipt, ArrowRightCircle
} from 'lucide-react'
import { toast } from 'sonner'

/* ── UI Components ── */
import { DajingoPageShell } from '@/components/common/DajingoPageShell'
import { DajingoListView } from '@/components/common/DajingoListView'
import { useDajingoPageState } from '@/hooks/useDajingoPageState'

/* ── Local Assets (Reused from purchase-orders module) ── */
import {
    STATUS_CONFIG, fmt,
    ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS,
    COLUMN_WIDTHS, RIGHT_ALIGNED_COLS, EMPTY_FILTERS
} from './purchase-orders/_lib/constants'
import { POFiltersPanel } from './purchase-orders/_components/POFiltersPanel'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'

/* ── Types ── */
type PurchaseOrder = {
    id: number
    po_number: string
    supplier_display?: string
    supplier_name?: string
    status: string
    priority: string
    total_amount: string | number
    currency?: string
    order_date?: string
    expected_delivery?: string
    created_at?: string
    warehouse?: { id: number; name: string }
    notes?: string
}

const GROW_COLS = new Set(['amount', 'subtotal', 'tax', 'shipping', 'discount', 'warehouse'])

export function PurchasesRegistryClient({
    orders: initialOrders,
    currency = 'CFA',
    tradeSubTypesEnabled = false,
}: {
    orders: PurchaseOrder[]
    currency?: string
    tradeSubTypesEnabled?: boolean
}) {
    const router = useRouter()
    const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders)
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState(EMPTY_FILTERS)

    // ── V2 State Engine ──
    const state = useDajingoPageState({
        moduleKey: 'purchases_main_registry',
        columns: ALL_COLUMNS,
        defaultVisibleCols: DEFAULT_VISIBLE_COLS,
        defaultVisibleFilters: DEFAULT_VISIBLE_FILTERS,
    })

    const refreshData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchPurchaseOrders()
            setOrders(Array.isArray(data) ? data : (data?.results ?? []))
        } catch {
            toast.error('Failed to refresh data')
        } finally {
            setLoading(false)
        }
    }, [])

    // ── Filtering Logic ──
    const activeFilterCount = useMemo(() => {
        let count = 0
        for (const [k, v] of Object.entries(filters)) {
            if (k === 'amountRange') {
                if (v.op) count++
            } else if (v !== '') count++
        }
        return count
    }, [filters])

    const filtered = useMemo(() => {
        return orders.filter(o => {
            if (filters.status && o.status !== filters.status) return false
            if (filters.priority && o.priority !== filters.priority) return false
            if (filters.supplier) {
                const sup = o.supplier_name || o.supplier_display || ''
                if (sup !== filters.supplier) return false
            }
            if (filters.warehouse && String(o.warehouse?.id) !== filters.warehouse) return false
            if (state.search) {
                const q = state.search.toLowerCase()
                const match = (o.po_number || '').toLowerCase().includes(q) ||
                            (o.supplier_name || o.supplier_display || '').toLowerCase().includes(q)
                if (!match) return false
            }
            return true
        })
    }, [orders, state.search, filters])

    // ── Stats ──
    const stats = useMemo(() => {
        const total = orders.length
        const totalVal = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
        const pending = orders.filter(o => ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(o.status)).length
        const incoming = orders.filter(o => ['SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(o.status)).length
        return { total, totalVal, pending, incoming }
    }, [orders])

    const paginated = state.paginate(filtered)

    const onView = (id: number) => router.push(`/purchases/${id}`)

    return (
        <DajingoPageShell
            title="Purchase Orders"
            icon={<ShoppingCart size={20} className="text-white" />}
            subtitle={`${stats.total} Orders · ${stats.pending} Pending · ${stats.incoming} Incoming`}
            kpiStats={[
                { label: 'Total Orders', value: stats.total, icon: <ClipboardList size={11} />, color: 'var(--app-primary)' },
                { label: 'Total Value', value: `${fmt(stats.totalVal)} ${currency}`, icon: <DollarSign size={11} />, color: 'var(--app-success)' },
                { label: 'Pending', value: stats.pending, icon: <Clock size={11} />, color: 'var(--app-warning)' },
                { label: 'Incoming', value: stats.incoming, icon: <Truck size={11} />, color: 'var(--app-info)' },
            ]}
            primaryAction={{
                label: 'New Order',
                icon: <Plus size={14} />,
                onClick: () => router.push('/purchases/new-order')
            }}
            secondaryActions={[
                { label: 'Sourcing', icon: <BarChart3 size={13} />, href: '/purchases/sourcing' },
                { label: 'Dashboard', icon: <DollarSign size={13} />, href: '/purchases/dashboard' },
            ]}
            search={state.search}
            onSearchChange={state.setSearch}
            searchPlaceholder="Search POs or Suppliers... (Ctrl+K)"
            onRefresh={refreshData}
            activeFilterCount={activeFilterCount}
            showFilters={state.showFilters}
            onToggleFilters={() => state.setShowFilters(!state.showFilters)}
            renderFilters={() => (
                <POFiltersPanel 
                    orders={orders} 
                    filters={filters} 
                    setFilters={setFilters}
                    isOpen={state.showFilters}
                    visibleFilters={state.visibleFilters}
                />
            )}
        >
            <DajingoListView<PurchaseOrder>
                data={paginated}
                allData={filtered}
                loading={loading}
                getRowId={o => o.id}
                columns={ALL_COLUMNS}
                visibleColumns={state.effectiveVisibleColumns}
                columnWidths={COLUMN_WIDTHS}
                rightAlignedCols={RIGHT_ALIGNED_COLS}
                growCols={GROW_COLS}
                entityLabel="Order"
                
                moduleKey={state.moduleKey}
                onSetVisibleColumns={state.setVisibleColumns}
                onSetColumnOrder={state.setColumnOrder}
                
                renderRowIcon={o => {
                    const sc = STATUS_CONFIG[o.status] || { color: 'var(--app-muted-foreground)' }
                    return (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                             style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
                            <ClipboardList size={13} />
                        </div>
                    )
                }}
                renderRowTitle={o => (
                    <div className="flex-1 min-w-0">
                        <div className="truncate text-[12px] font-bold text-app-foreground">{o.po_number || `PO-${o.id}`}</div>
                        <div className="text-[10px] font-medium text-app-muted-foreground">{o.supplier_name || o.supplier_display || '—'}</div>
                    </div>
                )}
                renderColumnCell={(key, o) => {
                    const sc = STATUS_CONFIG[o.status] || { label: o.status, color: 'var(--app-muted-foreground)' }
                    switch (key) {
                        case 'status':
                            return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                                         style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span>
                        case 'date': return <span className="text-[11px] text-app-muted-foreground">{o.order_date || '—'}</span>
                        case 'expected': return <span className="text-[11px] text-app-muted-foreground">{o.expected_delivery || '—'}</span>
                        case 'amount': return <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success)' }}>{fmt(o.total_amount)}</span>
                        case 'warehouse': return <span className="text-[10px] text-app-foreground truncate">{o.warehouse?.name || '—'}</span>
                        default: return <span className="text-[10px] text-app-muted-foreground">—</span>
                    }
                }}
                onView={o => onView(o.id)}
                menuActions={o => [
                    { label: 'View Details', icon: <Eye size={12} />, onClick: () => onView(o.id) },
                    { label: 'Edit Order', icon: <Edit size={12} />, onClick: () => router.push(`/purchases/new-order?edit=${o.id}`) },
                    { label: 'Create Receipt', icon: <Truck size={12} />, onClick: () => router.push(`/purchases/receipts/new?from_po=${o.id}`) },
                ]}
                pagination={state.buildPagination(filtered.length, activeFilterCount)}
                emptyIcon={<ShoppingCart size={36} />}
            />
        </DajingoPageShell>
    )
}
