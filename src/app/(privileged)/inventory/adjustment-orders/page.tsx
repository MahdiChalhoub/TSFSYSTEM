'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import {
 getAdjustmentOrders, createAdjustmentOrder, addAdjustmentLine,
 lockAdjustmentOrder, unlockAdjustmentOrder, approveAdjustmentOrder, cancelAdjustmentOrder,
 promoteToExecution
} from '@/app/actions/inventory/adjustment-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, Sparkles, Package, AlertCircle, CheckCircle2, RefreshCw, MessageSquare, Play, Info, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type AdjustmentLine = {
 id: number; product: number; product_name?: string; warehouse_name?: string
 qty_adjustment: number; amount_adjustment: number; reason: string
}

const ALL_COLUMNS: ColumnDef<any>[] = [
 { key: 'date', label: 'Strategy Date', sortable: true, alwaysVisible: true },
 { key: 'reference', label: 'Strategy ID', sortable: true, alwaysVisible: true },
 { key: 'wh', label: 'Proposed Terminal' },
 { key: 'qty', label: 'Est. Delta', align: 'right' },
 { key: 'status_label', label: 'Strategy Status' },
]

export default function DiscrepancyStrategyPage() {
 const { fmt } = useCurrency()
 const settings = useListViewSettings('inventory_adjustments_strategy_v1', {
 columns: ALL_COLUMNS.map(c => c.key),
 pageSize: 25,
 sortKey: 'date',
 sortDir: 'desc',
 })

 const [orders, setOrders] = useState<any[]>([])
 const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
 const [loading, setLoading] = useState(true)
 const [isPending, startTransition] = useTransition()

 const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

 const [filterStatus, setFilterStatus] = useState('')
 const [filterWh, setFilterWh] = useState('')
 const [search, setSearch] = useState('')

 const [showCreate, setShowCreate] = useState(false)
 const [showAddLine, setShowAddLine] = useState<number | null>(null)
 const [unlockComment, setUnlockComment] = useState('')

 const [newWh, setNewWh] = useState('')
 const [newReason, setNewReason] = useState('')
 const [newNotes, setNewNotes] = useState('')

 const [lineProduct, setLineProduct] = useState('')
 const [lineQty, setLineQty] = useState('')
 const [lineReason, setLineReason] = useState('')

 const loadData = useCallback(async () => {
 try {
 const [o, w] = await Promise.all([getAdjustmentOrders(), getWarehouses()])
 setOrders(Array.isArray(o) ? o : o?.results || [])
 setWarehouses(Array.isArray(w) ? w : [])
 } catch { toast.error('Strategy sync engine failed') }
 finally { setLoading(false) }
 }, [])

 useEffect(() => { loadData() }, [loadData])

 const columns: ColumnDef<any>[] = ALL_COLUMNS.map(c => {
 const renderers: Record<string, (r: any) => React.ReactNode> = {
 date: r => <span className="text-app-text-muted font-medium">{new Date(r.date || r.created_at).toLocaleDateString()}</span>,
 reference: r => <span className="font-mono font-bold text-app-text">STRAT-{r.reference || r.id}</span>,
 wh: r => <Badge variant="outline" className="bg-app-bg text-gray-700 border-app-border uppercase text-[10px] font-black">{r.warehouse_name || r.warehouse?.name || 'GLOBAL'}</Badge>,
 qty: r => <span className={`font-black ${(r.total_qty_adjustment || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.total_qty_adjustment ?? r.lines?.length ?? 0}</span>,
 status_label: r => {
 const status = r.lifecycle_status || 'OPEN'
 const variants: Record<string, string> = {
 OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-100',
 APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
 EXECUTED: 'bg-blue-50 text-blue-700 border-blue-100',
 CANCELED: 'bg-rose-50 text-rose-700 border-rose-100'
 }
 return <Badge variant="outline" className={`${variants[status] || 'bg-app-bg'} text-[10px] uppercase font-black`}>{status}</Badge>
 }
 }
 return { ...c, render: renderers[c.key] }
 })

 const filtered = orders.filter(o => {
 if (filterStatus && o.lifecycle_status !== filterStatus) return false
 if (filterWh && String(o.warehouse_id || o.warehouse?.id) !== filterWh) return false
 if (search) { const s = search.toLowerCase(); return o.reference?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s) }
 return true
 })

 const handlePromote = (id: number) => {
 startTransition(async () => {
 try {
 await promoteToExecution(id)
 toast.success('Strategy promoted to Operational Draft')
 loadData()
 } catch (e: any) { toast.error(e.message || 'Promotion failed') }
 })
 }

 const handleCreate = () => {
 if (!newWh) { toast.error('Select terminal'); return }
 startTransition(async () => {
 try {
 await createAdjustmentOrder({ date: new Date().toISOString().split('T')[0], warehouse: parseInt(newWh), reason: newReason, notes: newNotes })
 toast.success('Resolution Strategy Created')
 setShowCreate(false)
 loadData()
 } catch { toast.error('Failed') }
 })
 }

 const handleAddLine = () => {
 if (!lineProduct || !lineQty || !showAddLine) return
 startTransition(async () => {
 try {
 await addAdjustmentLine(showAddLine, { product: parseInt(lineProduct), qty_adjustment: parseFloat(lineQty), reason: lineReason })
 toast.success('Discrepancy added to strategy')
 setShowAddLine(null)
 loadData()
 } catch { toast.error('Failed') }
 })
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex justify-between items-center border-b pb-6">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <ShieldAlert size={20} className="text-indigo-600" />
 <h1 className="page-header-title tracking-tighter uppercase">
 Discrepancy <span className="text-indigo-600">Strategy</span>
 </h1>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
 <span className="text-[9px] font-black uppercase text-indigo-700 tracking-widest">Internal Strategy</span>
 </div>
 </div>
 </header>

 <TypicalListView<any, AdjustmentLine>
 title="Strategy Logs"
 addLabel="NEW RESOLUTION THREAD"
 onAdd={() => setShowCreate(true)}
 data={filtered}
 loading={loading}
 getRowId={r => r.id}
 columns={columns}
 headerExtras={
 <div className="flex items-center gap-2 text-[10px] font-black uppercase text-app-text-faint">
 <MessageSquare size={14} /> Active Threads: {orders.length}
 </div>
 }
 expandable={{
 columns: [
 { key: 'item', label: 'Proposed Adjustment', render: (d: AdjustmentLine) => d.product_name || `Product #${d.product}` },
 { key: 'qty', label: 'Proposed Delta', align: 'right', render: (d: AdjustmentLine) => <span className="font-black">{(d.qty_adjustment || 0) > 0 ? '+' : ''}{d.qty_adjustment}</span> },
 { key: 'reason', label: 'Team Context', render: (d: AdjustmentLine) => <span className="italic text-app-text-faint font-medium">{d.reason || '—'}</span> },
 ],
 getDetails: r => r.lines || [],
 renderActions: (row, parent) => (
 <div className="flex gap-2">
 {(parent.lifecycle_status === 'OPEN' || parent.lifecycle_status === 'APPROVED') && (
 <Button
 size="sm"
 className="bg-emerald-600 hover:bg-emerald-700 text-app-text font-black text-[10px] h-7 px-3 rounded-lg flex items-center gap-2 shadow-sm"
 onClick={() => handlePromote(parent.id)}
 >
 <Play size={10} fill="currentColor" /> INITIATE ADJUSTMENT
 </Button>
 )}
 <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-app-text-faint flex items-center gap-1"><Info size={12} /> VIEW AUDIT TRAIL</Button>
 </div>
 ),
 }}
 lifecycle={{
 getStatus: r => {
 const m: Record<string, any> = {
 OPEN: { label: 'Internal Discussion', variant: 'default' },
 APPROVED: { label: 'Approved Plan', variant: 'info' },
 EXECUTED: { label: 'Executed Action', variant: 'success' },
 CANCELED: { label: 'Strategy Shelved', variant: 'danger' }
 }
 return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
 },
 getLocked: r => r.lifecycle_status === 'EXECUTED' || r.lifecycle_status === 'CANCELED',
 onApprove: (row) => startTransition(async () => { try { await approveAdjustmentOrder(row.id); toast.success('Strategy Approved'); loadData() } catch { toast.error('Failed') } }),
 onCancel: (row) => startTransition(async () => { try { await cancelAdjustmentOrder(row.id); toast.success('Strategy Canceled'); loadData() } catch { toast.error('Failed') } }),
 }}
 >
 <TypicalFilter
 search={{ placeholder: 'Search Strategy ID...', value: search, onChange: setSearch }}
 filters={[
 { key: 'status', label: 'Status', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'APPROVED', label: 'Approved' }, { value: 'EXECUTED', label: 'Executed' }, { value: 'CANCELED', label: 'Canceled' }] },
 { key: 'warehouse', label: 'Terminal', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
 ]}
 values={{ status: filterStatus, warehouse: filterWh }}
 onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'warehouse') setFilterWh(s) }}
 />
 </TypicalListView>

 {/* Dialogs */}
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black text-emerald-900">Initiate Resolution Strategy</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 pt-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Target Terminal Location</Label>
 <Select value={newWh} onValueChange={setNewWh}>
 <SelectTrigger className="rounded-xl border-app-border h-12 font-bold">
 <SelectValue placeholder="Select terminal team context" />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-app-border">
 {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Governance Reason</Label>
 <Input className="rounded-xl border-app-border h-12" placeholder="Describe the discrepancy analysis..." value={newReason} onChange={e => setNewReason(e.target.value)} />
 </div>
 </div>
 <DialogFooter className="pt-6">
 <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl font-bold">Cancel</Button>
 <Button onClick={handleCreate} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-app-text rounded-xl px-8 font-bold h-12 shadow-lg shadow-emerald-200">Initialize Discussion</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 </div>
 )
}
