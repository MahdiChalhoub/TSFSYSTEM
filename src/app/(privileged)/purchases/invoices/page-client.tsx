'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'
import { erpFetch } from '@/lib/erp-api'
import { Receipt, Clock, CheckCircle, Building2, DollarSign, Eye, BookOpen, FileText } from 'lucide-react'
import Link from 'next/link'
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { useCurrency } from '@/lib/utils/currency'

type Invoice = {
 id: number; po_number?: string; invoice_number?: string; ref_code?: string
 supplier?: { id: number; name: string }; supplier_name?: string; supplier_display?: string
 contact_name?: string; status: string; order_date?: string; created_at?: string
 total_amount: number; notes?: string; is_legacy?: boolean; lines?: Record<string, unknown>[]
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

export default function PurchaseInvoicesPage() {
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<Invoice[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [currentPage, setCurrentPage] = useState(1)
 const [pageSize, setPageSize] = useState(50)
 const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
 const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))
 // React 19 typed ref `null` initial widens to `RefObject<HTMLInputElement | null>`,
 // but DajingoListView's `searchRef?: RefObject<HTMLInputElement>` is non-null.
 // Cast with `as` since the runtime guarantees null-or-element at most.
 const searchRef = useRef<HTMLInputElement>(null as unknown as HTMLInputElement)

 const load = useCallback(async () => {
   setLoading(true)
   try {
     const [poData, legacyData] = await Promise.all([fetchPurchaseOrders(), getLegacyPurchases()])
     const rawPO: Invoice[] = Array.isArray(poData)
       ? (poData as Invoice[])
       : ((poData && typeof poData === 'object' && 'results' in poData && Array.isArray((poData as { results?: unknown[] }).results))
         ? ((poData as { results: Invoice[] }).results)
         : [])
     setOrders([...rawPO, ...legacyData].filter((o: Invoice) => ['RECEIVED', 'INVOICED', 'COMPLETED', 'FINAL'].includes(o.status)))
   } catch { setOrders([]) }
   setLoading(false)
 }, [])
 useEffect(() => { load() }, [load])

 // Search filter
 const filtered = useMemo(() => {
   if (!search) return orders
   const q = search.toLowerCase()
   return orders.filter(inv =>
     (inv.invoice_number || '').toLowerCase().includes(q) ||
     (inv.po_number || '').toLowerCase().includes(q) ||
     (inv.supplier?.name || inv.supplier_name || inv.contact_name || '').toLowerCase().includes(q) ||
     String(inv.id).includes(q)
   )
 }, [orders, search])

 const totalValue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
 const pendingCount = orders.filter(o => ['RECEIVED'].includes(o.status)).length
 const settledCount = orders.filter(o => ['COMPLETED', 'FINAL'].includes(o.status)).length

 const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
 const clampedPage = Math.min(currentPage, totalPages)
 const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

 const hasFilters = !!search

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
