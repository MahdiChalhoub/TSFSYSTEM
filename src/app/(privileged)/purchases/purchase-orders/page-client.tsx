'use client'

/**
 * Purchase Orders Registry — DajingoListView Migration
 * ======================================================
 * Uses the universal DajingoListView table template for consistent UI
 * across all transactional pages. Keeps advanced filters, focus mode, and expanded details.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { fetchPurchaseOrders, fetchPurchaseOrder, submitPO, approvePO, cancelPO, sendToSupplier, completePO, revertToDraft } from '@/app/actions/pos/purchases'
import { toast } from 'sonner'
import { getListViewPolicy } from '@/app/actions/listview-policies'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/AdminContext'
import {
  Plus, Search, ClipboardList, Eye, Edit, Package,
  X, Maximize2, Minimize2,
  SlidersHorizontal, RefreshCcw,
  DollarSign, Clock, CheckCircle,
  ChevronDown, Loader2, Truck, Receipt, ArrowRightCircle, Check,
} from 'lucide-react'

/* ── Shared UI ── */
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { DCell } from '@/components/ui/DCell'

/* ── Local lib ── */
import type { PO, Filters } from './_lib/types'
import type { NumericRange } from '@/components/ui/NumericRangeFilter'
import {
  STATUS_CONFIG, fmt,
  ALL_COLUMNS, ALL_FILTERS, DEFAULT_VISIBLE_COLS, DEFAULT_VISIBLE_FILTERS,
  EMPTY_FILTERS,
} from './_lib/constants'

/* ── Local components ── */
import { POFiltersPanel } from './_components/POFiltersPanel'

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

/* ── Valid transitions (mirrored from backend) ── */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  REJECTED: ['DRAFT'],
  SENT: ['CONFIRMED', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
  CONFIRMED: ['IN_TRANSIT', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
  IN_TRANSIT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['INVOICED', 'COMPLETED'],
  INVOICED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

const STATUS_ACTIONS: Record<string, (id: number | string) => Promise<any>> = {
  SUBMITTED: submitPO,
  APPROVED: approvePO,
  SENT: sendToSupplier,
  CANCELLED: cancelPO,
  COMPLETED: completePO,
  DRAFT: revertToDraft,
}

/* ═══════════════════════════════════════════════════════════
 *  INLINE STATUS CELL — clickable dropdown with transitions
 * ═══════════════════════════════════════════════════════════ */
function InlineStatusCell({ po, onRefresh }: { po: PO; onRefresh?: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
  const transitions = VALID_TRANSITIONS[po.status] || []

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  async function handleTransition(t: string) {
    setLoading(true); setOpen(false)
    try {
      const action = STATUS_ACTIONS[t]
      if (action) await action(po.id)
      else {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch(`purchase-orders/${po.id}/`, { method: 'PATCH', body: JSON.stringify({ status: t }) })
      }
      toast.success(`${po.po_number || `PO-${po.id}`} → ${(STATUS_CONFIG[t]?.label || t)}`)
      onRefresh?.()
    } catch (e: any) { toast.error(e?.message || 'Transition failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => transitions.length > 0 && setOpen(!open)}
        disabled={transitions.length === 0 || loading}
        className="flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded transition-all"
        style={{
          color: sc.color,
          background: `color-mix(in srgb, ${sc.color} 10%, transparent)`,
          cursor: transitions.length > 0 ? 'pointer' : 'default',
          border: transitions.length > 0 ? `1px solid color-mix(in srgb, ${sc.color} 20%, transparent)` : 'none',
        }}
      >
        {loading ? <Loader2 size={8} className="animate-spin" /> : null}
        {sc.label}
        {transitions.length > 0 && <ChevronDown size={7} className="opacity-50" />}
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-44 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-100"
          style={{ background: 'var(--app-surface)' }}>
          <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">Transition to</div>
          {transitions.map(t => {
            const tc = STATUS_CONFIG[t] || { label: t, color: 'var(--app-muted-foreground)' }
            return (
              <button key={t} onClick={() => handleTransition(t)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold hover:bg-app-surface-hover transition-colors"
                style={{ color: t === 'CANCELLED' ? 'var(--app-error)' : 'var(--app-foreground)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                {tc.label}
                {t === 'CANCELLED' && <X size={9} className="ml-auto opacity-50" />}
                {t === 'COMPLETED' && <Check size={9} className="ml-auto opacity-50" style={{ color: 'var(--app-success)' }} />}
                {t === 'SUBMITTED' && <ArrowRightCircle size={9} className="ml-auto opacity-50" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function renderPOCell(key: string, po: PO, _extra?: any): React.ReactNode {
  const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
  switch (key) {
    case 'date': return <span className="text-[11px] text-app-muted-foreground">{po.order_date || '—'}</span>
    case 'expected': return <span className="text-[11px] text-app-muted-foreground">{po.expected_delivery || '—'}</span>
    case 'amount': return <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(po.total_amount)}</span>
    case 'lines': {
      const count = (po as any).line_count ?? (po as any).lines?.length ?? '—'
      return <span className="text-[11px] font-mono font-bold text-app-foreground">{count}</span>
    }
    case 'receiving': {
      const pct = Number((po as any).receipt_progress || 0)
      const lineCount = (po as any).line_count || 0
      if (lineCount === 0) return <span className="text-[9px] text-app-muted-foreground">—</span>
      const barColor = pct >= 100 ? 'var(--app-success)' : pct > 0 ? 'var(--app-warning)' : 'var(--app-muted-foreground)'
      return (
        <div className="flex items-center gap-1.5 w-full">
          <div className="flex-1 h-1.5 rounded-full bg-app-border/30 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
          </div>
          <span className="text-[9px] font-bold font-mono flex-shrink-0" style={{ color: barColor }}>{pct}%</span>
        </div>
      )
    }
    case 'warehouse': return <span className="text-[10px] text-app-foreground truncate">{po.warehouse?.name || '—'}</span>
    case 'priority': {
      const p = po.priority?.toUpperCase()
      const pColor = p === 'URGENT' ? 'var(--app-error)' : p === 'HIGH' ? 'var(--app-warning)' : 'var(--app-muted-foreground)'
      return <span className="text-[9px] font-black uppercase" style={{ color: pColor }}>{po.priority || '—'}</span>
    }
    case 'subtype': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase">{po.purchase_sub_type || '—'}</span>
    case 'scope': {
      const s = po.po_number?.startsWith('IPO-') ? 'INT' : 'OFF'
      const sColor = s === 'INT' ? 'var(--app-warning)' : 'var(--app-info)'
      return <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded" style={{ color: sColor, background: `color-mix(in srgb, ${sColor} 10%, transparent)` }}>{s}</span>
    }
    case 'currency': return <span className="text-[10px] font-mono text-app-muted-foreground">{po.currency || '—'}</span>
    case 'supplierRef': return <span className="text-[10px] font-mono text-app-muted-foreground truncate">{po.supplier_ref || '—'}</span>
    case 'subtotal': return <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(po.subtotal)}</span>
    case 'tax': return <span className="text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.tax_amount)}</span>
    case 'shipping': return <span className="text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.shipping_cost)}</span>
    case 'discount': return <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{fmt(po.discount_amount)}</span>
    case 'invoicePolicy': return <span className="text-[9px] font-bold text-app-muted-foreground uppercase truncate">{po.invoice_policy === 'RECEIVED_QTY' ? 'Received' : po.invoice_policy === 'ORDERED_QTY' ? 'Ordered' : po.invoice_policy || '—'}</span>
    case 'received': return <span className="text-[9px] text-app-muted-foreground">{po.received_date || '—'}</span>
    case 'created': return <span className="text-[9px] text-app-muted-foreground">{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</span>
    case 'createdBy': return <span className="text-[9px] text-app-muted-foreground truncate">{(po as any).created_by_name || (po as any).created_by?.username || '—'}</span>
    case 'status':
      return <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
        style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span>
    default: return <span className="text-[10px] text-app-muted-foreground">—</span>
  }
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function PurchaseOrdersManager() {
  const router = useRouter()
  const { openTab } = useAdmin()
  const [orders, setOrders] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [visibleFilters, setVisibleFilters] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_FILTERS)
  const searchRef = useRef<HTMLInputElement>(null)

  // Column visibility & ordering
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_COLS)
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const toggleSelect = (id: number | string) => {
    const next = new Set(selectedIds)
    if (next.has(id as number)) next.delete(id as number); else next.add(id as number)
    setSelectedIds(next)
  }

  // ── SaaS ListViewPolicy enforcement ──
  const [policyHiddenColumns, setPolicyHiddenColumns] = useState<Set<string>>(new Set())
  useEffect(() => {
    getListViewPolicy('purchases_purchase_orders').then(policy => {
      if (policy?.hidden_columns?.length) setPolicyHiddenColumns(new Set(policy.hidden_columns))
    }).catch(() => {})
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPurchaseOrders()
      setOrders(Array.isArray(data) ? data : data?.results || [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

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
      if (search) {
        const q = search.toLowerCase()
        const match = (o.po_number || `PO-${o.id}`).toLowerCase().includes(q) ||
          (o.supplier?.name || o.supplier_name || o.supplier_display || '').toLowerCase().includes(q) ||
          (o.supplier_ref || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [orders, search, filters])

  const hasFilters = !!search || activeFilterCount > 0

  // Stats
  const stats = useMemo(() => {
    const total = orders.length
    const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const pending = orders.filter(o => ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(o.status)).length
    const completed = orders.filter(o => ['RECEIVED', 'COMPLETED', 'INVOICED'].includes(o.status)).length
    return { total, totalValue, pending, completed }
  }, [orders])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const clampedPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

  const isAllPageSelected = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id))
  const toggleSelectAll = () => {
    if (isAllPageSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map(o => o.id)))
  }

  const onView = (id: number) => router.push(`/purchases/${id}`)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300 transition-all">
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

        {focusMode ? (
          /* ── FOCUS MODE ── */
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                <ClipboardList size={14} className="text-white" />
              </div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Purchase Orders</span>
              <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{stats.total}</span>
            </div>
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all flex-shrink-0 ${showFilters ? 'border-app-primary text-app-primary bg-app-primary/5' : 'border-app-border text-app-muted-foreground'}`}>
              <SlidersHorizontal size={13} />
              {activeFilterCount > 0 && <span className="text-[9px] font-black bg-app-primary text-white px-1.5 rounded-full">{activeFilterCount}</span>}
            </button>
            <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
              <Minimize2 size={13} />
            </button>
          </div>
        ) : (
          /* ── NORMAL MODE ── */
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <ClipboardList size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Purchase Orders</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    {stats.total} Orders · {stats.pending} Pending · {stats.completed} Completed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => openTab('New Purchase Order', '/purchases/new-order')}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /><span className="hidden sm:inline">New Order</span>
                </button>
                <button onClick={fetchData} title="Refresh"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <RefreshCcw size={13} />
                </button>
                <button onClick={() => setFocusMode(true)} title="Focus mode — Ctrl+Q"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            <KPIStrip stats={[
              { label: 'Total Orders', value: stats.total, icon: <ClipboardList size={11} />, color: 'var(--app-primary)' },
              { label: 'Total Value', value: fmt(stats.totalValue), icon: <DollarSign size={11} />, color: 'var(--app-success, #22c55e)' },
              { label: 'Pending', value: stats.pending, icon: <Clock size={11} />, color: 'var(--app-warning, #f59e0b)' },
              { label: 'Completed', value: stats.completed, icon: <CheckCircle size={11} />, color: 'var(--app-success, #22c55e)' },
            ]} />

            <POFiltersPanel orders={orders} filters={filters} setFilters={setFilters} isOpen={showFilters} visibleFilters={visibleFilters} />
          </>
        )}

        {focusMode && <POFiltersPanel orders={orders} filters={filters} setFilters={setFilters} isOpen={showFilters} visibleFilters={visibleFilters} />}
      </div>

      {/* ═══════════════ TABLE (DajingoListView) ═══════════════ */}
      <DajingoListView<PO>
        data={paginated}
        allData={filtered}
        loading={loading}
        getRowId={po => po.id}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        columnWidths={COLUMN_WIDTHS}
        rightAlignedCols={RIGHT_ALIGNED_COLS}
        growCols={GROW_COLS}
        columnOrder={columnOrder}
        onColumnReorder={setColumnOrder}
        policyHiddenColumns={policyHiddenColumns}
        entityLabel="Purchase Order"
        /* ── Integrated Toolbar ── */
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by PO number or supplier... (Ctrl+K)"
        searchRef={searchRef as React.RefObject<HTMLInputElement>}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        activeFilterCount={activeFilterCount}
        onSetVisibleColumns={setVisibleColumns}
        onSetColumnOrder={setColumnOrder}
        moduleKey="purchases.purchase_orders"
        allFilters={ALL_FILTERS}
        visibleFilters={visibleFilters}
        onSetVisibleFilters={setVisibleFilters}
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
        renderRowTitle={po => (
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{po.po_number || `PO-${po.id}`}</div>
            <div className="text-[10px] font-mono text-app-muted-foreground">{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</div>
          </div>
        )}
        renderColumnCell={(key, po) => {
          if (key === 'status') return <InlineStatusCell po={po} onRefresh={fetchData} />
          return renderPOCell(key, po)
        }}
        renderExpanded={po => <POExpandedRow po={po} onView={onView} onRefresh={fetchData} />}
        onView={po => onView(po.id)}
        menuActions={po => [
          { label: 'Edit Order', icon: <Edit size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/purchases/new-order?edit=${po.id}` } },
          { label: '─── Transfer To ───', icon: <ArrowRightCircle size={12} className="text-app-muted-foreground/30" />, onClick: () => {} },
          { label: 'Purchase Receipt', icon: <Truck size={12} style={{ color: 'var(--app-success)' }} />, onClick: () => { window.location.href = `/purchases/receipts/new?from_po=${po.id}` } },
          { label: 'Purchase Invoice', icon: <Receipt size={12} style={{ color: 'var(--app-warning)' }} />, onClick: () => { window.location.href = `/finance/invoices/new?from_po=${po.id}&type=purchase` } },
        ]}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        isAllPageSelected={isAllPageSelected}
        onToggleSelectAll={toggleSelectAll}
        hasFilters={hasFilters}
        onClearFilters={() => { setSearch(''); setFilters(EMPTY_FILTERS) }}
        emptyIcon={<ClipboardList size={36} />}
        pagination={{
          totalItems: filtered.length,
          activeFilterCount,
          currentPage: clampedPage,
          totalPages,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: n => { setPageSize(n); setCurrentPage(1) },
        }}
      />
    </div>
  )
}

/* ── PO Expanded Row ── */
function POExpandedRow({ po, onView, onRefresh }: { po: PO; onView: (id: number) => void; onRefresh?: () => void }) {
  const [detail, setDetail] = useState<PO | null>(null)
  useEffect(() => {
    fetchPurchaseOrder(po.id).then(d => setDetail(d)).catch(() => setDetail(po))
  }, [po.id])

  const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
  const supplier = po.supplier?.name || po.supplier_name || po.supplier_display || '—'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => onView(po.id)}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
          <Eye size={11} /> View Details
        </button>
        <button onClick={() => { window.location.href = `/purchases/new-order?edit=${po.id}` }}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
          <Edit size={11} /> Edit
        </button>
        <div className="h-4 w-px bg-app-border/40 mx-0.5" />
        <InlineStatusCell po={po} onRefresh={onRefresh} />
        <div className="h-4 w-px bg-app-border/40 mx-0.5" />
        <button onClick={() => { window.location.href = `/purchases/receipts/new?from_po=${po.id}` }}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
          <Truck size={11} style={{ color: 'var(--app-success)' }} /> → Receipt
        </button>
        <button onClick={() => { window.location.href = `/finance/invoices/new?from_po=${po.id}&type=purchase` }}
          className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
          <Receipt size={11} style={{ color: 'var(--app-warning)' }} /> → Invoice
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        <CardSection color="var(--app-primary)" title="Order Info">
          <DCell label="PO Number" value={po.po_number || `PO-${po.id}`} mono />
          <DCell label="Supplier" value={supplier} />
          <DCell label="Status" value={sc.label} color={sc.color} />
          <DCell label="Order Date" value={po.order_date} />
          <DCell label="Expected" value={po.expected_delivery} />
          <DCell label="Priority" value={po.priority} />
        </CardSection>
        <CardSection color="var(--app-info)" title="Financials">
          <DCell label="Total" value={fmt(po.total_amount)} mono color="var(--app-success)" />
          <DCell label="Lines" value={detail?.lines?.length ?? '...'} />
          <DCell label="Created" value={po.created_at ? new Date(po.created_at).toLocaleDateString() : null} />
        </CardSection>
        {detail?.lines && detail.lines.length > 0 && (
          <div className="rounded-xl border border-app-border/40 overflow-hidden md:col-span-2 xl:col-span-1" style={{ background: 'var(--app-surface)' }}>
            <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
              style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
              <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-success)' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>Lines ({detail.lines.length})</span>
            </div>
            <div className="px-3 py-2 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
              {detail.lines.map((line: any) => (
                <div key={line.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-app-border/20 last:border-0">
                  <Package size={10} className="text-app-muted-foreground flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate font-bold text-app-foreground">{line.product?.name || line.product_name || '—'}</span>
                  <span className="font-mono text-app-muted-foreground flex-shrink-0">{line.quantity || line.quantity_ordered || 0} × {fmt(line.unit_price)}</span>
                  <span className="font-mono font-bold text-app-foreground flex-shrink-0">{fmt(line.line_total || line.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {po.notes && (
        <div className="mt-2.5 px-3 py-2 rounded-xl border border-app-border/30" style={{ background: 'var(--app-surface)' }}>
          <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Notes</span>
          <div className="text-[10px] font-medium text-app-foreground/80 line-clamp-2 mt-0.5">{po.notes}</div>
        </div>
      )}
    </div>
  )
}

/* ── Reusable Card Section wrapper ── */
function CardSection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
        style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
        <div className="w-1 h-3 rounded-full" style={{ background: color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
        {children}
      </div>
    </div>
  )
}
