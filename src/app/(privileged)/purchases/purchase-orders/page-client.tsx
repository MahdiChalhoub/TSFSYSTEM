'use client'

/**
 * Purchase Orders Registry — DajingoListView Migration
 * ======================================================
 * Uses the universal DajingoListView table template for consistent UI
 * across all transactional pages. Keeps advanced filters, focus mode, and expanded details.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'
import { handleSessionExpired } from '@/lib/session-expiry'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import {
  Plus, ClipboardList, DollarSign, Clock, CheckCircle, Truck, ArrowRightCircle,
  Eye, Receipt, BarChart3, Pencil, X, Trash2, ChevronDown, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { bulkTransitionPurchaseOrders, bulkDeletePurchaseOrders } from '@/app/actions/commercial/purchases'

/* ── Shared UI ── */
import { DajingoListView } from '@/components/common/DajingoListView'
import { DajingoPageShell } from '@/components/common/DajingoPageShell'

/* ── State engine ── */
import { useDajingoPageState } from '@/hooks/useDajingoPageState'

/* ── Local lib ── */
import type { PO, Filters } from './_lib/types'
import type { NumericRange } from '@/components/ui/NumericRangeFilter'
import {
  STATUS_CONFIG, fmt,
  ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS,
  EMPTY_FILTERS,
} from './_lib/constants'
import { renderPOCell } from './_lib/render-cell'

/* ── Local components ── */
import { POFiltersPanel } from './_components/POFiltersPanel'
import { POCustomizePanel } from './_components/POCustomizePanel'
import { InlineStatusCell } from './_components/InlineStatusCell'
import { POExpandedRow } from './_components/POExpandedRow'

/* ── Column widths & alignment ── */
const COLUMN_WIDTHS: Record<string, string> = {
  status: 'w-24', date: 'w-20', expected: 'w-20', amount: 'w-24',
  lines: 'w-12', receiving: 'w-24', warehouse: 'w-24',
  priority: 'w-16', subtype: 'w-20', scope: 'w-16', currency: 'w-14', supplierRef: 'w-20',
  subtotal: 'w-20', tax: 'w-16', shipping: 'w-16', discount: 'w-16',
  invoicePolicy: 'w-20', received: 'w-20', created: 'w-20', createdBy: 'w-20',
}
const RIGHT_ALIGNED_COLS = new Set(['amount', 'subtotal', 'tax', 'shipping', 'discount', 'lines'])
const GROW_COLS = new Set(['amount', 'subtotal', 'tax', 'shipping', 'discount', 'warehouse'])

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function PurchaseOrdersManager({
  initialOrders = [],
  currency = 'USD',
}: {
  initialOrders?: PO[]
  currency?: string
} = {}) {
  const router = useRouter()
  const { openTab } = useAdmin()
  const [orders, setOrders] = useState<PO[]>(initialOrders)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  // ── Universal state engine (search, columns, ordering, policy, selection, pagination, shortcuts) ──
  const state = useDajingoPageState({
    moduleKey: 'purchases_purchase_orders',
    columns: ALL_COLUMNS,
    defaultVisibleCols: DEFAULT_VISIBLE_COLS,
    defaultVisibleFilters: DEFAULT_VISIBLE_FILTERS,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const result = await fetchPurchaseOrders()
    setOrders(result.data)
    if (result.error) {
      if (result.auth) {
        handleSessionExpired()
        return
      }
      const { toast } = await import('sonner')
      toast.error('Couldn\'t refresh purchase orders', {
        description: result.error,
        duration: 6000,
      })
    }
    setLoading(false)
  }, [])
  // Initial data is hydrated SSR via props; only fetch client-side if SSR returned empty.
  useEffect(() => { if (initialOrders.length === 0) fetchData() }, [fetchData, initialOrders.length])

  // Generic numeric range check
  const matchesNumericRange = (val: number, range: NumericRange): boolean => {
    if (!range.op) return true
    const a = parseFloat(range.a) || 0
    const b = parseFloat(range.b) || 0
    switch (range.op) {
      case 'eq': return val === a
      case 'gt': return val > a
      case 'gte': return val >= a
      case 'lt': return val < a
      case 'lte': return val <= a
      case 'between': return val >= a && val <= b
      default: return true
    }
  }

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    for (const [, v] of Object.entries(filters)) {
      if (typeof v === 'string' && v !== '') count++
      else if (typeof v === 'object' && v?.op !== '') count++
    }
    return count
  }, [filters])

  // Apply all filters + search
  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (filters.status && o.status !== filters.status) return false
      if (filters.priority && o.priority !== filters.priority) return false
      if (filters.purchaseSubType && o.purchase_sub_type !== filters.purchaseSubType) return false
      if (filters.supplier) {
        const sup = o.supplier?.name || o.supplier_name || o.supplier_display || ''
        if (sup !== filters.supplier) return false
      }
      if (filters.warehouse && String(o.warehouse?.id) !== filters.warehouse) return false
      if (filters.currency && o.currency !== filters.currency) return false
      if (filters.invoicePolicy && o.invoice_policy !== filters.invoicePolicy) return false
      if (filters.amountRange.op) {
        if (!matchesNumericRange(Number(o.total_amount || 0), filters.amountRange)) return false
      }
      if (state.search) {
        const q = state.search.toLowerCase()
        const match = (o.po_number || `PO-${o.id}`).toLowerCase().includes(q) ||
          (o.supplier?.name || o.supplier_name || o.supplier_display || '').toLowerCase().includes(q) ||
          (o.supplier_ref || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [orders, state.search, filters])

  const hasFilters = !!state.search || activeFilterCount > 0

  // Stats
  const stats = useMemo(() => {
    const total = orders.length
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const pending = orders.filter(o => ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(o.status)).length
    const incoming = orders.filter(o => ['SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(o.status)).length
    const completed = orders.filter(o => ['RECEIVED', 'COMPLETED', 'INVOICED'].includes(o.status)).length
    return { total, totalValue, pending, incoming, completed }
  }, [orders])

  // Pagination — delegated to state engine
  const paginated = state.paginate(filtered)
  const isAllPageSelected = state.isAllPageSelected(paginated)

  const onView = (id: number) => router.push(`/purchases/${id}`)

  return (
    <DajingoPageShell
      title="Purchase Orders"
      icon={<ClipboardList size={20} className="text-white" />}
      subtitle={`${stats.total} Orders · ${stats.pending} Pending · ${stats.incoming} Incoming · ${stats.completed} Completed`}
      kpiStats={[
        { label: 'Total Orders', value: stats.total, icon: <ClipboardList size={11} />, color: 'var(--app-primary)' },
        { label: 'Total Value', value: `${fmt(stats.totalValue)} ${currency}`, icon: <DollarSign size={11} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Pending', value: stats.pending, icon: <Clock size={11} />, color: 'var(--app-warning, #f59e0b)' },
        { label: 'Incoming', value: stats.incoming, icon: <Truck size={11} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Completed', value: stats.completed, icon: <CheckCircle size={11} />, color: 'var(--app-success, #22c55e)' },
      ]}
      primaryAction={{ label: 'New Order', icon: <Plus size={14} />, onClick: () => openTab('New Purchase Order', '/purchases/new') }}
      secondaryActions={
        <>
          <button onClick={() => router.push('/purchases/sourcing')}
            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
            <BarChart3 size={13} /> <span className="hidden md:inline">Sourcing</span>
          </button>
          <button onClick={() => router.push('/purchases/dashboard')}
            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
            <DollarSign size={13} /> <span className="hidden md:inline">Dashboard</span>
          </button>
        </>
      }
      search={state.search}
      onSearchChange={state.setSearch}
      searchRef={state.searchRef}
      searchPlaceholder="Search by PO number or supplier... (Ctrl+K)"
      filteredCount={filtered.length}
      totalCount={stats.total}
      focusMode={state.focusMode}
      onFocusModeChange={state.setFocusMode}
      showFilters={state.showFilters}
      onToggleFilters={() => state.setShowFilters(!state.showFilters)}
      activeFilterCount={activeFilterCount}
      onRefresh={fetchData}
      renderFilters={() => (
        <POFiltersPanel orders={orders} filters={filters} setFilters={setFilters}
          isOpen={state.showFilters} visibleFilters={state.visibleFilters} />
      )}
    >
      {/* ═══════════════ TABLE (DajingoListView) ═══════════════ */}
      <DajingoListView<PO>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={po => po.id}
        columns={ALL_COLUMNS}
        visibleColumns={state.effectiveVisibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_ALIGNED_COLS}
        growCols={GROW_COLS}
        columnOrder={state.columnOrder}
        onColumnReorder={state.setColumnOrder}
        policyHiddenColumns={state.policyHiddenColumns}
        entityLabel="Purchase Order"
        /* ── Integrated Toolbar ── */
        search={state.search}
        onSearchChange={state.setSearch}
        searchPlaceholder="Search by PO number or supplier... (Ctrl+K)"
        searchRef={state.searchRef as React.RefObject<HTMLInputElement>}
        showFilters={state.showFilters}
        onToggleFilters={() => state.setShowFilters(!state.showFilters)}
        activeFilterCount={activeFilterCount}
        onToggleCustomize={() => state.setShowCustomize(true)}
        onSetVisibleColumns={state.setVisibleColumns}
        onSetColumnOrder={state.setColumnOrder}
        moduleKey={state.moduleKey}
        allFilters={ALL_FILTERS}
        visibleFilters={state.visibleFilters}
        onSetVisibleFilters={state.setVisibleFilters}
        /* ── Row rendering ── */
        renderRowIcon={po => {
          const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
          return (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
              <ClipboardList size={13} />
            </div>
          )
        }}
        renderRowTitle={po => {
          const rejCat: string | null = po.rejection_category || null
          const reissueId: number | null = po.caused_reissue_id || null
          // Tone the rejection-category chip: hard problems red, soft amber.
          const catColor =
            rejCat === 'DAMAGED' ? 'var(--app-error)'
            : rejCat === 'NEEDS_REVISION' ? 'var(--app-info)'
            : rejCat ? 'var(--app-warning)'
            : null
          return (
            <div className="flex-1 min-w-0">
              <div className="truncate text-[12px] font-bold text-app-foreground flex items-center gap-1.5">
                <span className="truncate">{po.po_number || `PO-${po.id}`}</span>
                {rejCat && (
                  <span
                    title={`Rejected as ${rejCat.replace('_', ' ').toLowerCase()}`}
                    className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                      color: catColor!,
                      border: `1px solid color-mix(in srgb, ${catColor} 25%, transparent)`,
                    }}>
                    {rejCat.replace('_', ' ')}
                  </span>
                )}
                {reissueId && (
                  <a
                    href={`/inventory/requests?focus=${reissueId}`}
                    onClick={e => e.stopPropagation()}
                    title={`Auto-reissued as procurement request #${reissueId}`}
                    className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hover:underline"
                    style={{
                      background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                      color: 'var(--app-warning)',
                      border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)',
                    }}>
                    → Reissue #{reissueId}
                  </a>
                )}
              </div>
              <div className="text-[10px] font-mono text-app-muted-foreground">{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</div>
            </div>
          )
        }}
        renderColumnCell={(key, po) => {
          if (key === 'status') return <InlineStatusCell po={po} onRefresh={fetchData} />
          return renderPOCell(key, po)
        }}
        renderExpanded={po => <POExpandedRow po={po} onView={onView} onRefresh={fetchData} />}
        onView={po => onView(po.id)}
        menuActions={po => [
          { label: 'Open Order', icon: <Eye size={12} className="text-app-muted-foreground" />, onClick: () => onView(po.id) },
          { label: 'Edit Order', icon: <Pencil size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/purchases/new?edit=${po.id}` } },
          { label: '─── Transfer To ───', icon: <ArrowRightCircle size={12} className="text-app-muted-foreground/30" />, onClick: () => {} },
          { label: 'Purchase Receipt', icon: <Truck size={12} style={{ color: 'var(--app-success)' }} />, onClick: () => { window.location.href = `/purchases/receipts/new?from_po=${po.id}` } },
          { label: 'Purchase Invoice', icon: <Receipt size={12} style={{ color: 'var(--app-warning)' }} />, onClick: () => { window.location.href = `/purchases/invoices?from_po=${po.id}` } },
        ]}
        selectedIds={state.selectedIds}
        onToggleSelect={state.toggleSelect}
        isAllPageSelected={isAllPageSelected}
        onToggleSelectAll={() => state.toggleSelectAll(paginated)}
        bulkActions={
          <BulkActionBar
            selectedIds={Array.from(state.selectedIds) as Array<number | string>}
            onClear={() => state.setSelectedIds(new Set())}
            onDone={() => { fetchData(); state.setSelectedIds(new Set()) }}
          />
        }
        hasFilters={hasFilters}
        onClearFilters={() => { state.setSearch(''); setFilters(EMPTY_FILTERS) }}
        emptyIcon={<ClipboardList size={36} />}
        pagination={state.buildPagination(filtered.length, activeFilterCount)}
      />

      {/* Customize Panel — column / filter visibility (matches /inventory/products) */}
      <POCustomizePanel
        isOpen={state.showCustomize}
        onClose={() => state.setShowCustomize(false)}
        visibleColumns={state.visibleColumns}
        setVisibleColumns={state.setVisibleColumns}
        visibleFilters={state.visibleFilters}
        setVisibleFilters={state.setVisibleFilters}
        policyHiddenColumns={state.policyHiddenColumns}
        policyHiddenFilters={state.policyHiddenFilters}
      />
    </DajingoPageShell>
  )
}

/* ──────────────────────────────────────────────────────────────────
 *  BulkActionBar — bottom-anchored action strip for multi-PO ops.
 *  Renders only when something is selected. Each action runs server
 *  actions per-id (sequential to respect rate limits), shows a toast
 *  with succeeded/failed counts, then signals the parent to refetch.
 * ────────────────────────────────────────────────────────────────── */
function BulkActionBar({ selectedIds, onClear, onDone }: {
  selectedIds: Array<number | string>
  onClear: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState<null | 'status' | 'delete'>(null)
  const [statusMenu, setStatusMenu] = useState(false)
  const count = selectedIds.length

  const runTransition = async (toStatus: string, label: string) => {
    setBusy('status')
    setStatusMenu(false)
    const r = await bulkTransitionPurchaseOrders(selectedIds, toStatus)
    setBusy(null)
    if (r.failed.length === 0) {
      toast.success(`${r.succeeded} PO${r.succeeded === 1 ? '' : 's'} → ${label}.`)
    } else if (r.succeeded === 0) {
      toast.error(`Failed to transition any PO. First error: ${r.failed[0].error}`)
    } else {
      toast.warning(`${r.succeeded} updated, ${r.failed.length} skipped`, {
        description: `Some POs could not move to ${label} (current status doesn't allow it).`,
      })
    }
    onDone()
  }

  const runDelete = async () => {
    if (!confirm(`Delete ${count} purchase order${count === 1 ? '' : 's'}?\n\nOnly DRAFT or CANCELLED POs can be removed; the backend will skip protected ones.`)) return
    setBusy('delete')
    const r = await bulkDeletePurchaseOrders(selectedIds)
    setBusy(null)
    if (r.failed.length === 0) {
      toast.success(`${r.succeeded} PO${r.succeeded === 1 ? '' : 's'} deleted.`)
    } else if (r.succeeded === 0) {
      toast.error(`Could not delete any PO. ${r.failed[0].error}`)
    } else {
      toast.warning(`${r.succeeded} deleted, ${r.failed.length} skipped`, {
        description: 'Protected POs (with posted journals) were skipped.',
      })
    }
    onDone()
  }

  // Transitions surfaced to the user. Wider catalogue lives on the
  // model (VALID_TRANSITIONS); we expose the ones admins reach for in
  // bulk: SUBMITTED, APPROVED, ORDERED, CANCELLED.
  const transitions: Array<{ to: string; label: string }> = [
    { to: 'SUBMITTED', label: 'Submitted' },
    { to: 'APPROVED', label: 'Approved' },
    { to: 'ORDERED', label: 'Ordered' },
    { to: 'CANCELLED', label: 'Cancelled' },
  ]

  // Renders inside DajingoListView's `bulkActions` slot — the parent
  // already shows the "{N} selected" label, so we only emit the action
  // controls themselves here (no count, no own background).
  void count // shown by the slot wrapper
  return (
    <div className="flex items-center gap-2">
      {/* Change status — opens a small menu of allowed transitions */}
      <div className="relative">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setStatusMenu(v => !v)}
          className="flex items-center gap-1 text-tp-xs font-bold px-3 h-8 rounded-lg border transition-all active:scale-95 disabled:opacity-50"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)', background: 'var(--app-surface)' }}>
          {busy === 'status' ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
          Change status
        </button>
        {statusMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStatusMenu(false)} />
            {/* Drop UPWARD — the bar lives at the bottom of the screen
                inside DajingoListView's pagination footer, which has its
                own overflow clipping. Anchoring to bottom-full keeps the
                menu in view without needing a portal. */}
            <div className="absolute right-0 bottom-full mb-1 z-50 rounded-xl overflow-hidden min-w-[180px]"
              style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg, 0 8px 24px rgba(0,0,0,0.18))' }}>
              {transitions.map(t => (
                <button
                  key={t.to}
                  type="button"
                  onClick={() => runTransition(t.to, t.label)}
                  className="w-full text-left text-tp-sm font-bold px-3 py-2 hover:bg-app-surface-2 transition-colors"
                  style={{ color: 'var(--app-foreground)' }}>
                  → {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk delete */}
      <button
        type="button"
        onClick={runDelete}
        disabled={busy !== null}
        className="flex items-center gap-1 text-tp-xs font-bold px-3 h-8 rounded-lg transition-all active:scale-95 disabled:opacity-50"
        style={{
          color: 'var(--app-error, #ef4444)',
          background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
        }}>
        {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Delete
      </button>

      {/* Clear selection */}
      <button
        type="button"
        onClick={onClear}
        disabled={busy !== null}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-app-muted-foreground hover:bg-app-surface transition-colors disabled:opacity-50"
        title="Clear selection">
        <X size={14} />
      </button>
    </div>
  )
}
