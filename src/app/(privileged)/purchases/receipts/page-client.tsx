'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchPurchaseOrders, fetchPurchaseOrder, receivePOLine } from '@/app/actions/pos/purchases'
import { toast } from 'sonner'
import { Truck, Clock, CheckCircle, Package, Eye, Loader2, PackageCheck } from 'lucide-react'
import Link from 'next/link'
import { KPIStrip } from '@/components/ui/KPIStrip'
import { DajingoListView, type DajingoColumnDef } from '@/components/common/DajingoListView'
import { useCurrency } from '@/lib/utils/currency'

type POLine = { id: number; product?: { id: number; name: string; sku?: string }; product_name?: string; quantity: number; quantity_ordered?: number; qty_received: number; quantity_received?: number; unit_price: number; line_total?: number; subtotal?: number }
type PO = { id: number; po_number?: string; supplier?: { id: number; name: string }; supplier_name?: string; supplier_display?: string; status: string; order_date?: string; expected_date?: string; total_amount: number; notes?: string; lines?: POLine[] }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 ORDERED: { label: 'Ordered', color: 'var(--app-info, #3b82f6)' },
 CONFIRMED: { label: 'Confirmed', color: 'var(--app-info, #3b82f6)' },
 IN_TRANSIT: { label: 'In Transit', color: 'var(--app-warning, #f59e0b)' },
 PARTIALLY_RECEIVED: { label: 'Partial', color: 'var(--app-warning, #f59e0b)' },
 RECEIVED: { label: 'Received', color: 'var(--app-success, #22c55e)' },
}

const ALL_COLUMNS: DajingoColumnDef[] = [
 { key: 'date', label: 'Order Date', defaultVisible: true },
 { key: 'expected', label: 'Expected', defaultVisible: true },
 { key: 'status', label: 'Status', defaultVisible: true },
 { key: 'amount', label: 'Amount', defaultVisible: true },
]
const COLUMN_WIDTHS: Record<string, string> = { date: 'w-24', expected: 'w-20', amount: 'w-24', status: 'w-20' }
const RIGHT_ALIGNED_COLS = new Set(['amount'])
const GROW_COLS = new Set(['amount'])

function renderReceiptCell(key: string, po: PO, fmt: (n: number) => string): React.ReactNode {
 const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
 switch (key) {
   case 'date': return <span className="text-[11px] text-app-muted-foreground">{po.order_date || '—'}</span>
   case 'expected': return <span className="text-[11px] text-app-muted-foreground">{po.expected_date || '—'}</span>
   case 'amount': return <span className="text-[12px] font-mono font-bold tabular-nums text-app-foreground">{fmt(po.total_amount)}</span>
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

export default function ReceiptsPage() {
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<PO[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [details, setDetails] = useState<Record<number, PO>>({})
 const [receiveLine, setReceiveLine] = useState<{ poId: number; line: POLine } | null>(null)
 const [receiveQty, setReceiveQty] = useState('')
 const [actionLoading, setActionLoading] = useState(false)
 const [currentPage, setCurrentPage] = useState(1)
 const [pageSize, setPageSize] = useState(50)
 const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({})
 const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map(c => c.key))
 // React 19 typed-ref null widens to RefObject<HTMLInputElement | null>; the
 // DajingoListView prop is non-null. Cast to satisfy the consumer.
 const searchRef = useRef<HTMLInputElement>(null as unknown as HTMLInputElement)

 const load = useCallback(async () => {
   setLoading(true)
   try {
     const data = await fetchPurchaseOrders()
     const raw: PO[] = Array.isArray(data)
       ? (data as PO[])
       : ((data && typeof data === 'object' && 'results' in data && Array.isArray((data as { results?: unknown[] }).results))
         ? ((data as { results: PO[] }).results)
         : [])
     setOrders(raw.filter((o: PO) => ['ORDERED','CONFIRMED','IN_TRANSIT','PARTIALLY_RECEIVED','RECEIVED'].includes(o.status)))
   }
   catch { setOrders([]) }
   setLoading(false)
 }, [])
 useEffect(() => { load() }, [load])

 // Search filter
 const filtered = useMemo(() => {
   if (!search) return orders
   const q = search.toLowerCase()
   return orders.filter(po =>
     (po.po_number || '').toLowerCase().includes(q) ||
     (po.supplier?.name || po.supplier_name || po.supplier_display || '').toLowerCase().includes(q) ||
     String(po.id).includes(q)
   )
 }, [orders, search])

 async function handleReceive() {
   if (!receiveLine || !receiveQty) return
   setActionLoading(true)
   try {
     await receivePOLine(receiveLine.poId, { line_id: receiveLine.line.id, quantity: Number(receiveQty) })
     toast.success(`Received ${receiveQty} units`)
     setReceiveLine(null); setReceiveQty('')
     const d = await fetchPurchaseOrder(receiveLine.poId)
     setDetails(prev => ({ ...prev, [receiveLine.poId]: d as PO }))
     load()
   } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to receive') }
   setActionLoading(false)
 }

 const pending = orders.filter(o => ['ORDERED','CONFIRMED','IN_TRANSIT','PARTIALLY_RECEIVED'].includes(o.status)).length
 const received = orders.filter(o => o.status === 'RECEIVED').length

 const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
 const clampedPage = Math.min(currentPage, totalPages)
 const paginated = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)

 const hasFilters = !!search

 return (
   <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300">
     <div className="flex-shrink-0 space-y-4 pb-4">
       <div className="flex items-center gap-3">
         <div className="page-header-icon" style={{ background: '#22c55e', boxShadow: '0 4px 14px color-mix(in srgb, #22c55e 30%, transparent)' }}>
           <PackageCheck size={20} className="text-white" />
         </div>
         <div>
           <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Goods Receiving</h1>
           <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
             {orders.length} Orders · {pending} Awaiting · {received} Received
           </p>
         </div>
       </div>
       <KPIStrip stats={[
         { label: 'Total Orders', value: orders.length, icon: <Package size={11} />, color: 'var(--app-primary)' },
         { label: 'Awaiting', value: pending, icon: <Clock size={11} />, color: '#f59e0b' },
         { label: 'Received', value: received, icon: <CheckCircle size={11} />, color: '#22c55e' },
       ]} />
     </div>

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
       entityLabel="Receipt"
       /* ── Integrated Toolbar ── */
       search={search}
       onSearchChange={setSearch}
       searchPlaceholder="Search PO numbers, suppliers... (Ctrl+K)"
       searchRef={searchRef}
       hasFilters={hasFilters}
       onClearFilters={() => setSearch('')}
       onSetVisibleColumns={setVisibleColumns}
       onSetColumnOrder={setColumnOrder}
       moduleKey="purchases.receipts"
       /* ── Row rendering ── */
       renderRowIcon={po => {
         const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
         return (
           <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
             <PackageCheck size={13} />
           </div>
         )
       }}
       renderRowTitle={po => (
         <div className="flex-1 min-w-0">
           <div className="truncate text-[12px] font-bold text-app-foreground">{po.po_number || `PO-${po.id}`}</div>
           <div className="text-[10px] text-app-muted-foreground">{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</div>
         </div>
       )}
       renderColumnCell={(key, po) => renderReceiptCell(key, po, fmt)}
       renderExpanded={po => {
         const detail = details[po.id]
         if (!detail) {
           fetchPurchaseOrder(po.id).then(d => setDetails(prev => ({ ...prev, [po.id]: d as PO }))).catch(() => {})
           return <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-app-primary" /></div>
         }
         return (
           <div className="px-4 py-3">
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-wider">Order Lines ({detail.lines?.length || 0})</h3>
               <Link href={`/purchases/${po.id}`} className="flex items-center gap-1.5 text-[11px] font-bold text-app-primary hover:underline"><Eye size={12} /> Full View</Link>
             </div>
             {detail.lines?.map((line: POLine) => {
               const ordered = Number(line.quantity_ordered || line.quantity || 0)
               const recv = Number(line.qty_received || line.quantity_received || 0)
               const pct = ordered > 0 ? Math.min((recv / ordered) * 100, 100) : 0
               return (
                 <div key={line.id} className="flex items-center gap-3 p-2.5 rounded-xl mb-1.5" style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}>
                   <div className="w-7 h-7 rounded-lg bg-app-info/10 flex items-center justify-center shrink-0"><Package size={13} className="text-app-info" /></div>
                   <div className="flex-1 min-w-0">
                     <div className="text-[12px] font-bold text-app-foreground truncate">{line.product?.name || line.product_name || '—'}</div>
                     <div className="flex items-center gap-2 mt-1">
                       <div className="flex-1 h-1.5 rounded-full bg-app-muted/20 overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-app-primary' : pct > 0 ? 'bg-app-warning' : 'bg-app-muted/20'}`} style={{ width: `${pct}%` }} /></div>
                       <span className="text-[10px] font-bold text-app-muted-foreground">{recv}/{ordered}</span>
                     </div>
                   </div>
                   <div className="text-right shrink-0">
                     <div className="text-[11px] font-mono text-app-muted-foreground">{ordered} × {fmt(line.unit_price)}</div>
                     <div className="text-[12px] font-bold text-app-foreground">{fmt(Number(line.line_total ?? line.subtotal ?? 0))}</div>
                   </div>
                   {po.status !== 'RECEIVED' && recv < ordered && (
                     <button onClick={(e) => { e.stopPropagation(); setReceiveLine({ poId: po.id, line }); setReceiveQty(String(ordered - recv)) }}
                       className="text-[10px] font-bold text-white px-2 py-1 rounded-lg shrink-0" style={{ background: 'var(--app-primary)' }}>Receive</button>
                   )}
                 </div>
               )
             })}
           </div>
         )
       }}
       onView={po => { window.location.href = `/purchases/${po.id}` }}
       emptyIcon={<PackageCheck size={36} />}
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

     {/* Receive Modal */}
     {receiveLine && (
       <div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setReceiveLine(null); setReceiveQty('') }} />
         <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5">
           <h3 className="text-sm font-black text-app-foreground mb-3">Receive: {receiveLine.line.product?.name || receiveLine.line.product_name}</h3>
           <div className="space-y-3">
             <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Quantity</label>
               <input type="number" min="1" value={receiveQty} onChange={e => setReceiveQty(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-surface text-sm text-app-foreground focus:outline-none focus:ring-1 focus:ring-app-primary/30" /></div>
             <div className="flex justify-end gap-2">
               <button onClick={() => { setReceiveLine(null); setReceiveQty('') }} className="px-3 py-1.5 rounded-xl text-sm font-bold text-app-muted-foreground hover:bg-app-muted/10">Cancel</button>
               <button onClick={handleReceive} disabled={actionLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--app-primary)' }}>
                 {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />} Confirm
               </button>
             </div>
           </div>
         </div>
       </div>
     )}
   </div>
 )
}
