'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'
import { erpFetch } from '@/lib/erp-api'
import { Receipt, Clock, CheckCircle, Building2, DollarSign, Eye, BookOpen, FileText, X } from 'lucide-react'
import Link from 'next/link'
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { useCurrency } from '@/lib/utils/currency'

type Invoice = {
 id: number; po_number?: string; invoice_number?: string; ref_code?: string
 supplier?: { id: number; name: string }; supplier_name?: string; supplier_display?: string
 contact_name?: string; status: string; order_date?: string; created_at?: string
 total_amount: number; notes?: string; is_legacy?: boolean; lines?: Record<string, unknown>[]
 // The list intermixes invoices and (legacy) purchase orders. When the
 // backend returns a PO row, its `id` IS the PO id — the `?from_po=<id>`
 // landing-from-PO filter matches `String(inv.id) === fromPo`.
 po_id?: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 RECEIVED: { label: 'Awaiting Invoice', color: 'var(--app-warning, #f59e0b)' },
 INVOICED: { label: 'Invoiced', color: 'var(--app-info, #3b82f6)' },
 COMPLETED: { label: 'Settled', color: 'var(--app-success, #22c55e)' },
 FINAL: { label: 'Final', color: 'var(--app-success, #22c55e)' },
}

const ALL_COLUMNS: DajingoColumnDef[] = [
 { key: 'date', label: 'Date', defaultVisible: true },
 { key: 'supplier', label: 'Supplier', defaultVisible: true },
 { key: 'status', label: 'Status', defaultVisible: true },
 { key: 'legacy', label: 'Source', defaultVisible: true },
 { key: 'amount', label: 'Amount', defaultVisible: true },
]
const COLUMN_WIDTHS: Record<string, string> = { date: 'w-24', supplier: 'w-28', legacy: 'w-16', amount: 'w-24', status: 'w-20' }
const RIGHT_ALIGNED_COLS = new Set(['amount'])
const GROW_COLS = new Set(['supplier', 'amount'])

function renderInvoiceCell(key: string, inv: Invoice, fmt: (n: number) => string): React.ReactNode {
 const sc = STATUS_CONFIG[inv.status] || { label: inv.status, color: 'var(--app-muted-foreground)' }
 switch (key) {
   case 'date': return <span className="text-[11px] text-app-muted-foreground">{inv.order_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '—')}</span>
   case 'supplier': return <span className="text-[11px] text-app-muted-foreground truncate flex items-center gap-1"><Building2 size={10} /> {inv.supplier?.name || inv.supplier_name || inv.contact_name || '—'}</span>
   case 'legacy': return <span className="text-[10px] font-bold text-app-muted-foreground">{inv.is_legacy ? 'Legacy' : 'PO'}</span>
   case 'amount': return <span className="text-[12px] font-mono font-bold tabular-nums text-app-foreground">{fmt(inv.total_amount)}</span>
   case 'status':
     return (
       <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
         style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
         {sc.label}
       </span>
     )
   default: return <span className="text-[10px] text-app-muted-foreground">—</span>
 }
}

async function getLegacyPurchases(): Promise<Invoice[]> {
 try {
  const data = await erpFetch('orders/?type=PURCHASE')
  const results: unknown[] = Array.isArray(data)
   ? data
   : (data && typeof data === 'object' && 'results' in data && Array.isArray((data as { results?: unknown[] }).results)
     ? (data as { results: unknown[] }).results
     : [])
  return results.map((row): Invoice => {
   const o = row as Record<string, unknown>
   return {
    id: Number(o.id),
    po_number: (typeof o.ref_code === 'string' ? o.ref_code : null) || `LEGACY-${o.id}`,
    invoice_number: typeof o.invoice_number === 'string' ? o.invoice_number : undefined,
    ref_code: typeof o.ref_code === 'string' ? o.ref_code : undefined,
    supplier_name: (typeof o.contact_name === 'string' ? o.contact_name : undefined) || 'Legacy Supplier',
    contact_name: typeof o.contact_name === 'string' ? o.contact_name : undefined,
    status: typeof o.status === 'string' ? o.status : 'RECEIVED',
    order_date: typeof o.order_date === 'string' ? o.order_date : undefined,
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    total_amount: Number(o.total_amount || 0),
    notes: typeof o.notes === 'string' ? o.notes : undefined,
    is_legacy: true,
   }
  })
 } catch { return [] }
}

export default function PurchaseInvoicesPage({ fromPo }: { fromPo?: string } = {}) {
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<Invoice[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [currentPage, setCurrentPage] = useState(1)
 const [pageSize, setPageSize] = useState(50)
 const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
 const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))
 // PO scope from `?from_po=<id>` (server-passed). Held in state so the
 // operator can clear it without a navigation round-trip — clearing
 // strips the param via `history.replaceState` so a refresh reflects
 // the cleared state.
 const [poScope, setPoScope] = useState<string | undefined>(fromPo)
 // React 19 typed ref `null` initial widens to `RefObject<HTMLInputElement | null>`,
 // but DajingoListView's `searchRef?: RefObject<HTMLInputElement>` is non-null.
 // Cast with `as` since the runtime guarantees null-or-element at most.
 const searchRef = useRef<HTMLInputElement>(null as unknown as HTMLInputElement)

 const load = useCallback(async () => {
   setLoading(true)
   try {
     const [poResult, legacyData] = await Promise.all([fetchPurchaseOrders(), getLegacyPurchases()])
     const rawPO = poResult.data as Invoice[]
     setOrders([...rawPO, ...legacyData].filter((o: Invoice) => ['RECEIVED', 'INVOICED', 'COMPLETED', 'FINAL'].includes(o.status)))
   } catch { setOrders([]) }
   setLoading(false)
 }, [])
 useEffect(() => { load() }, [load])

 // Resolve the scoped PO row (if any) once orders + scope are known.
 // Used by the banner to show the supplier/PO number context, and by
 // the row highlight code to scroll-into-view + flash.
 const scopedPO = useMemo(() => {
   if (!poScope) return null
   return orders.find(o => String(o.id) === String(poScope) || String(o.po_id) === String(poScope)) || null
 }, [orders, poScope])

 // Filter chain: from_po → search. When a `from_po` scope is active we
 // reduce the dataset to that single PO (and any invoices flagged as
 // belonging to it). The banner gives the operator a clear way out.
 const filtered = useMemo(() => {
   let rows = orders
   if (poScope) {
     rows = rows.filter(inv => String(inv.id) === String(poScope) || String(inv.po_id) === String(poScope))
   }
   if (search) {
     const q = search.toLowerCase()
     rows = rows.filter(inv =>
       (inv.invoice_number || '').toLowerCase().includes(q) ||
       (inv.po_number || '').toLowerCase().includes(q) ||
       (inv.supplier?.name || inv.supplier_name || inv.contact_name || '').toLowerCase().includes(q) ||
       String(inv.id).includes(q)
     )
   }
   return rows
 }, [orders, search, poScope])

 // When `from_po` is set, scroll the matching row into view and flash a
 // ring so the operator's eye finds it. Runs once per scope/load
 // transition, after the list has rendered.
 useEffect(() => {
   if (!poScope || loading) return
   if (typeof window === 'undefined') return
   const tries = [50, 200, 500]
   const timers = tries.map(ms => window.setTimeout(() => {
     // DajingoListView keys rows by `getRowId(inv)` — find it by partial
     // id match, then scroll into view + flash via a transient class.
     const el = document.querySelector<HTMLElement>(`[data-row-id$="-p"][data-row-id^="${poScope}-"]`)
       || document.querySelector<HTMLElement>(`[data-row-id$="-l"][data-row-id^="${poScope}-"]`)
     if (el) {
       el.scrollIntoView({ behavior: 'smooth', block: 'center' })
       el.style.transition = 'box-shadow 600ms ease-out'
       el.style.boxShadow = '0 0 0 2px var(--app-primary)'
       window.setTimeout(() => { el.style.boxShadow = '' }, 1800)
     }
   }, ms))
   return () => { timers.forEach(t => window.clearTimeout(t)) }
 }, [poScope, loading, orders.length])

 const clearPoScope = () => {
   setPoScope(undefined)
   if (typeof window !== 'undefined') {
     // Strip the param from the URL without a refresh so the user's
     // back-stack stays intact. Server-side state of the page resets on
     // their next navigation.
     const url = new URL(window.location.href)
     url.searchParams.delete('from_po')
     window.history.replaceState({}, '', url.toString())
   }
 }

 const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
 const pendingCount = orders.filter(o => ['RECEIVED'].includes(o.status)).length
 const settledCount = orders.filter(o => ['COMPLETED', 'FINAL'].includes(o.status)).length

 const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
 const clampedPage = Math.min(currentPage, totalPages)
 const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

 const hasFilters = !!search || !!poScope

 return (
   <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300">
     <div className="flex-shrink-0 space-y-4 pb-4">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
         <div className="flex items-center gap-3">
           <div className="page-header-icon" style={{ background: '#8b5cf6', boxShadow: '0 4px 14px color-mix(in srgb, #8b5cf6 30%, transparent)' }}>
             <Receipt size={20} className="text-white" />
           </div>
           <div>
             <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Purchase Invoices</h1>
             <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
               {orders.length} Invoices · {pendingCount} Pending · {settledCount} Settled
             </p>
           </div>
         </div>
         <div className="flex items-center gap-1.5 flex-shrink-0">
           <Link href="/purchases/credit-notes">
             <button className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all">
               <FileText size={13} /><span className="hidden sm:inline">Credit Notes</span>
             </button>
           </Link>
         </div>
       </div>
       <KPIStrip stats={[
         { label: 'Total Invoiced', value: fmt(totalValue), icon: <DollarSign size={11} />, color: '#8b5cf6' },
         { label: 'Pending Invoice', value: pendingCount, icon: <Clock size={11} />, color: '#f59e0b' },
         { label: 'Settled', value: settledCount, icon: <CheckCircle size={11} />, color: '#22c55e' },
       ]} />
       {/* PO-scoped banner. Appears when the operator landed here from
         * a PO list "→ Invoice" action (`?from_po=<id>`). Resolves the
         * matching PO/invoice row from the current dataset for context
         * (supplier, ref code) so the banner reads as "Showing invoices
         * for PO PO-2024-…" rather than a bare id. Clearable. */}
       {poScope && (
         <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
           style={{
             background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
             border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
           }}>
           <div className="flex items-center gap-2 min-w-0">
             <Receipt size={13} style={{ color: 'var(--app-primary)' }} className="flex-shrink-0" />
             <span className="text-[11px] font-bold text-app-foreground truncate">
               Showing invoices for PO{' '}
               <span style={{ color: 'var(--app-primary)' }}>
                 {scopedPO?.po_number || scopedPO?.ref_code || `#${poScope}`}
               </span>
               {scopedPO && (scopedPO.supplier?.name || scopedPO.supplier_name || scopedPO.contact_name) && (
                 <span className="text-app-muted-foreground font-normal">
                   {' '}· {scopedPO.supplier?.name || scopedPO.supplier_name || scopedPO.contact_name}
                 </span>
               )}
             </span>
           </div>
           <button type="button" onClick={clearPoScope}
             className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1 rounded-lg hover:bg-app-surface transition-all flex-shrink-0">
             <X size={11} /> Clear
           </button>
         </div>
       )}
     </div>

     <DajingoListView<Invoice>
       data={paginated}
       allData={filtered}
       loading={loading}
       getRowId={inv => `${inv.id}-${inv.is_legacy ? 'l' : 'p'}`}
       columns={ALL_COLUMNS}
       visibleColumns={visibleColumns}
       columnWidths={COLUMN_WIDTHS}
       rightAlignedCols={RIGHT_ALIGNED_COLS}
       growCols={GROW_COLS}
       columnOrder={columnOrder}
       onColumnReorder={setColumnOrder}
       entityLabel="Invoice"
       /* ── Integrated Toolbar ── */
       search={search}
       onSearchChange={setSearch}
       searchPlaceholder="Search invoices, PO numbers, suppliers... (Ctrl+K)"
       searchRef={searchRef}
       hasFilters={hasFilters}
       onClearFilters={() => setSearch('')}
       onSetVisibleColumns={setVisibleColumns}
       onSetColumnOrder={setColumnOrder}
       moduleKey="purchases.invoices"
       /* ── Row rendering ── */
       renderRowIcon={inv => {
         const sc = STATUS_CONFIG[inv.status] || { label: inv.status, color: 'var(--app-muted-foreground)' }
         return (
           <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
             <Receipt size={13} />
           </div>
         )
       }}
       renderRowTitle={inv => (
         <div className="flex-1 min-w-0">
           <div className="truncate text-[12px] font-bold text-app-foreground">{inv.invoice_number || inv.po_number || `INV-${inv.id}`}</div>
           <div className="text-[10px] text-app-muted-foreground">{inv.supplier?.name || inv.supplier_name || inv.contact_name || '—'}</div>
         </div>
       )}
       renderColumnCell={(key, inv) => renderInvoiceCell(key, inv, fmt)}
       renderExpanded={inv => {
         const supplier = inv.supplier?.name || inv.supplier_name || inv.contact_name || '—'
         const sc = STATUS_CONFIG[inv.status] || { label: inv.status, color: 'var(--app-muted-foreground)' }
         return (
           <div className="px-4 py-3">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
               <div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Supplier</div><div className="font-bold text-app-foreground text-sm">{supplier}</div></div>
               <div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Date</div><div className="font-bold text-app-foreground text-sm">{inv.order_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '—')}</div></div>
               <div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Total</div><div className="font-bold text-sm" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(inv.total_amount)}</div></div>
               <div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Status</div><div className="font-bold text-sm">{sc.label}</div></div>
             </div>
             {inv.notes && <div className="text-xs text-app-muted-foreground p-2 rounded-lg border border-app-border/30 bg-app-surface/50 mb-3">{inv.notes}</div>}
             <div className="flex gap-2">
               <Link href={`/purchases/${inv.id}`} className="flex items-center gap-1.5 text-[11px] font-bold text-app-primary px-3 py-1.5 rounded-lg border border-app-primary/30 hover:bg-app-primary/5"><Eye size={12} /> View PO</Link>
               <Link href={`/finance/ledger?q=${inv.po_number || inv.id}`} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-surface"><BookOpen size={12} /> Ledger</Link>
             </div>
           </div>
         )
       }}
       onView={inv => { window.location.href = `/purchases/${inv.id}` }}
       menuActions={inv => [
         { label: 'View Ledger', icon: <BookOpen size={12} className="text-app-muted-foreground" />, onClick: () => { window.location.href = `/finance/ledger?q=${inv.po_number || inv.id}` } },
       ]}
       emptyIcon={<Receipt size={36} />}
       pagination={{
         totalItems: filtered.length,
         activeFilterCount: 0,
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
