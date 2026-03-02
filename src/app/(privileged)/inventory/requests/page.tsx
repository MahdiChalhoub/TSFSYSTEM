'use client'
import { useState, useEffect, useTransition, useMemo } from "react"
import type { OperationalRequest, Warehouse, Product } from '@/types/erp'
import {
 getOperationalRequests, createOperationalRequest, addRequestLine,
 approveRequest, rejectRequest, convertRequest, OperationalRequestInput
} from "@/app/actions/inventory/operational-requests"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 Inbox, Plus, Search, CheckCircle2, XCircle, ArrowRightCircle,
 ChevronDown, ChevronUp, Package, Clock, AlertTriangle,
 FileQuestion, ArrowDownUp, ArrowLeftRight, ShoppingCart, RefreshCw,
 Activity, ClipboardList
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from "@/components/common/TypicalFilter"
const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
 STOCK_ADJUSTMENT: { label: 'Adjustment Request', icon: ArrowDownUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
 STOCK_TRANSFER: { label: 'Logistics Request', icon: ArrowLeftRight, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
 PURCHASE_ORDER: { label: 'Procurement Request', icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
}
const STATUS_CONFIG: Record<string, { label: string; color: string; variant: any }> = {
 PENDING: { label: 'Awaiting Review', color: 'text-amber-600', variant: 'warning' },
 APPROVED: { label: 'Approved Request', color: 'text-emerald-600', variant: 'success' },
 REJECTED: { label: 'Request Rejected', color: 'text-rose-600', variant: 'danger' },
 CONVERTED: { label: 'Promoted to Strategy', color: 'text-indigo-600', variant: 'info' },
}
export default function OperationalRequestsPage() {
 const settings = useListViewSettings('inv_requests', {
 columns: ['reference', 'date', 'priority', 'items'],
 pageSize: 25,
 sortKey: 'date',
 sortDir: 'desc',
 })
 const [requests, setRequests] = useState<OperationalRequest[]>([])
 const [warehouses, setWarehouses] = useState<Warehouse[]>([])
 const [products, setProducts] = useState<Product[]>([])
 const [loading, setLoading] = useState(true)
 const [dialogOpen, setDialogOpen] = useState(false)
 const [lineDialogOpen, setLineDialogOpen] = useState(false)
 const [activeRequest, setActiveRequest] = useState<number | null>(null)
 const [searchQuery, setSearchQuery] = useState("")
 const [activeTab, setActiveTab] = useState("ALL")
 const [isPending, startTransition] = useTransition()
 const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
 const [rejectDialog, setRejectDialog] = useState<number | null>(null)
 const [convertDialog, setConvertDialog] = useState<OperationalRequest | null>(null)
 useEffect(() => { loadData() }, [])
 async function loadData() {
 setLoading(true)
 try {
 const [reqRes, whRes, prodRes] = await Promise.all([
 getOperationalRequests(),
 erpFetch('inventory/warehouses/'),
 erpFetch('inventory/products/')
 ])
 setRequests(Array.isArray(reqRes) ? reqRes : reqRes?.results || [])
 setWarehouses(Array.isArray(whRes) ? whRes : whRes?.results || [])
 setProducts(Array.isArray(prodRes) ? prodRes : prodRes?.results || [])
 } catch {
 toast.error("Failed to update")
 } finally {
 setLoading(false)
 }
 }
 const filtered = useMemo(() => {
 let list = requests
 if (activeTab !== "ALL") list = list.filter(r => r.status === activeTab)
 if (searchQuery) {
 const q = searchQuery.toLowerCase()
 list = list.filter(r =>
 r.reference?.toLowerCase().includes(q) ||
 r.description?.toLowerCase().includes(q) ||
 r.request_type?.toLowerCase().includes(q)
 )
 }
 return list
 }, [requests, activeTab, searchQuery])
 const columns: ColumnDef<OperationalRequest>[] = [
 {
 key: 'reference',
 label: 'Request Reference',
 alwaysVisible: true,
 render: r => (
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-xl ${(TYPE_CONFIG[r.request_type] || TYPE_CONFIG.STOCK_TRANSFER).bg} border`}>
 {(() => {
 const Icon = (TYPE_CONFIG[r.request_type] || TYPE_CONFIG.STOCK_TRANSFER).icon
 return <Icon size={16} className={(TYPE_CONFIG[r.request_type] || TYPE_CONFIG.STOCK_TRANSFER).color} />
 })()}
 </div>
 <div>
 <div className="font-bold text-app-text">{r.reference || `REQ-${r.id}`}</div>
 <div className="text-[10px] text-app-text-faint font-black uppercase tracking-widest leading-none">
 {(TYPE_CONFIG[r.request_type] || TYPE_CONFIG.STOCK_TRANSFER).label}
 </div>
 </div>
 </div>
 )
 },
 {
 key: 'date',
 label: 'Requested Date',
 render: r => <span className="text-app-text-muted font-medium text-xs">{r.date}</span>
 },
 {
 key: 'priority',
 label: 'Urgency',
 render: r => (
 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${r.priority === 'URGENT' ? 'text-rose-600 border-rose-100 bg-rose-50' :
 r.priority === 'HIGH' ? 'text-amber-600 border-amber-100 bg-amber-50' : 'text-app-text-faint border-app-border'
 }`}>
 {r.priority ?? 'NORMAL'}
 </Badge>
 )
 },
 {
 key: 'items',
 label: 'Manifest Size',
 align: 'center',
 render: r => (
 <div className="text-center">
 <div className="text-sm font-black text-app-text">{r.lines?.length || 0}</div>
 <div className="text-[9px] text-app-text-faint font-bold uppercase tracking-tighter">Line Items</div>
 </div>
 )
 }
 ]
 const detailColumns: ColumnDef<any>[] = [
 { key: 'product_name', label: 'Product', render: d => <div className="flex items-center gap-2 font-bold text-gray-700 text-xs">{d.product_name}</div> },
 { key: 'quantity', label: 'Requested Qty', align: 'right', render: d => <span className="font-mono font-black text-rose-500 text-xs">{d.quantity}</span> },
 { key: 'warehouse_name', label: 'Destination Terminal', render: d => <Badge variant="outline" className="bg-app-surface text-app-text-faint border-app-border text-[9px] font-black uppercase leading-none">{d.warehouse_name || 'Generic'}</Badge> },
 ]
 return (
 <div className="space-y-6 animate-in fade-in duration-500">
 <header className="flex justify-between items-start">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <div className="p-2 bg-indigo-600 rounded-lg text-app-text shadow-lg shadow-indigo-100">
 <ClipboardList size={16} />
 </div>
 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Operational Layer</span>
 </div>
 <h1 className="text-4xl lg:page-header-title tracking-tighter">
 Request <span className="text-indigo-600">Pipeline</span>
 </h1>
 <p className="mt-2 text-app-text-muted font-medium max-w-xl">
 Central queue for logistics, procurement, and adjustment requests. Approved requests are promoted to the Strategy layer for team governance.
 </p>
 </div>
 <div className="bg-indigo-50 px-4 py-3 rounded-2xl border border-indigo-100 flex items-center gap-3">
 <Activity size={20} className="text-indigo-600 animate-pulse" />
 <div className="text-right">
 <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Queue Status</div>
 <div className="text-lg font-black text-indigo-700 leading-none mt-1">{requests.filter(r => r.status === 'PENDING').length} PENDING</div>
 </div>
 </div>
 </header>
 <TypicalListView<OperationalRequest, any>
 title="Requests Manifest"
 addLabel="INITIATE REQUEST"
 onAdd={() => setDialogOpen(true)}
 data={filtered}
 loading={loading}
 getRowId={r => r.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 expandable={{
 columns: detailColumns,
 getDetails: r => r.lines || []
 }}
 selection={{
 selectedIds,
 onSelectionChange: setSelectedIds
 }}
 lifecycle={{
 getStatus: r => {
 const cfg = STATUS_CONFIG[r.status] || { label: r.status, variant: 'default' }
 return { label: cfg.label, variant: cfg.variant }
 },
 getApproved: r => r.status === 'APPROVED' || r.status === 'CONVERTED',
 getCanceled: r => r.status === 'REJECTED'
 }}
 actions={{
 extra: (req: OperationalRequest) => (
 <div className="flex items-center gap-2">
 {req.status === 'PENDING' && (
 <>
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px]" onClick={() => { setActiveRequest(req.id); setLineDialogOpen(true) }}>
 <Plus size={14} className="mr-1" /> ADD ITEM
 </Button>
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-black text-[10px]" onClick={() => {
 toast.promise(approveRequest(req.id).then(() => loadData()), {
 loading: 'Reviewing request...',
 success: 'Request Approved!',
 error: 'Review failed'
 })
 }} disabled={isPending}>
 <CheckCircle2 size={14} className="mr-1" /> APPROVE
 </Button>
 </>
 )}
 {req.status === 'APPROVED' && (
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px]" onClick={() => setConvertDialog(req)} disabled={isPending}>
 <ArrowRightCircle size={14} className="mr-1" /> CREATE TRANSFER
 </Button>
 )}
 </div>
 )
 }}
 >
 <TypicalFilter
 search={{ placeholder: 'Search analysis or ref...', value: searchQuery, onChange: setSearchQuery }}
 filters={[
 {
 key: 'status', label: 'Queue Filter', type: 'select', options: [
 { value: 'ALL', label: 'Complete Queue' },
 { value: 'PENDING', label: 'Pending Review' },
 { value: 'APPROVED', label: 'Approved Requests' },
 { value: 'CONVERTED', label: 'Promoted' },
 { value: 'REJECTED', label: 'Rejected' },
 ]
 }
 ]}
 values={{ status: activeTab }}
 onChange={(k, v) => setActiveTab(String(v))}
 />
 </TypicalListView>
 {/* ─── Create Request Dialog ──────────────────────────── */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="sm:max-w-lg rounded-[2.5rem] border-0">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black text-app-text tracking-tighter">Initiate Request</DialogTitle>
 <DialogDescription className="text-xs font-medium text-app-text-faint">Submit a new baseline request for procurement or logistics intervention.</DialogDescription>
 </DialogHeader>
 <form onSubmit={async (e) => {
 e.preventDefault()
 const fd = new FormData(e.currentTarget)
 startTransition(async () => {
 try {
 const data: OperationalRequestInput = {
 request_type: fd.get("request_type") as string,
 date: fd.get("date") as string,
 priority: fd.get("priority") as string || 'NORMAL',
 description: fd.get("description") as string || undefined,
 }
 await createOperationalRequest(data)
 toast.success("Request Initiated")
 setDialogOpen(false)
 loadData()
 } catch (err: any) {
 toast.error(err.message || "Initiation failed")
 }
 })
 }} className="space-y-4 pt-4">
 <div className="grid grid-cols-2 gap-3">
 <div className="col-span-1">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Request Type</label>
 <select name="request_type" required className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
 {Object.entries(TYPE_CONFIG).map(([k, v]) => (
 <option key={k} value={k}>{v.label}</option>
 ))}
 </select>
 </div>
 <div className="col-span-1">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Requested Date</label>
 <Input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="rounded-2xl bg-app-bg h-12" />
 </div>
 <div className="col-span-2">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Justification / Analysis Reference</label>
 <Input name="description" placeholder="e.g. Based on Warehouse Analytics #88..." className="rounded-2xl bg-app-bg h-12" />
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold">Discard</Button>
 <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-app-text rounded-2xl font-bold h-12 px-8 shadow-lg shadow-indigo-100 transition-all">
 {isPending ? "Syncing..." : "Publish Request"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 {/* ─── Add Line Dialog ────────────────────────────────── */}
 <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black text-app-text tracking-tighter">Add Manifest Line</DialogTitle>
 </DialogHeader>
 {/* ... (Implementation remains functionally same, UI refined in similar style) ... */}
 <form onSubmit={async (e) => {
 e.preventDefault()
 if (!activeRequest) return
 const fd = new FormData(e.currentTarget)
 startTransition(async () => {
 try {
 await addRequestLine(activeRequest, {
 product: Number(fd.get("product")),
 quantity: Number(fd.get("quantity")),
 warehouse: fd.get("warehouse") ? Number(fd.get("warehouse")) : undefined,
 })
 toast.success("Line Added to Manifest")
 setLineDialogOpen(false)
 loadData()
 } catch (err: any) {
 toast.error(err.message || "Failed to add line")
 }
 })
 }} className="space-y-4 pt-4">
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Selected Product</label>
 <select name="product" required className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
 {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
 </select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Quantity</label>
 <Input name="quantity" type="number" step="0.01" min="0.01" required className="rounded-2xl bg-app-bg h-12" />
 </div>
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Target Terminal</label>
 <select name="warehouse" className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all">
 <option value="">Any Warehouse</option>
 {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>
 </div>
 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="ghost" onClick={() => setLineDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
 <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-app-text rounded-2xl font-bold h-12 px-8 shadow-lg shadow-indigo-100 transition-all">
 {isPending ? "Adding..." : "Confirm Line"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog >
 {/* ─── Convert Dialog ─────────────────────────────────── */}
 < Dialog open={!!convertDialog} onOpenChange={() => setConvertDialog(null)}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black text-app-text tracking-tighter">Create Transfer</DialogTitle>
 <DialogDescription className="text-xs font-medium text-app-text-faint">Convert this approved request into an internal transfer.</DialogDescription>
 </DialogHeader>
 <form onSubmit={async (e) => {
 e.preventDefault()
 if (!convertDialog) return
 const fd = new FormData(e.currentTarget)
 startTransition(async () => {
 try {
 const data: Record<string, any> = {}
 if (convertDialog.request_type === 'STOCK_TRANSFER') {
 const fromWh = fd.get("from_warehouse")
 const toWh = fd.get("to_warehouse")
 if (fromWh) data.from_warehouse = Number(fromWh)
 if (toWh) data.to_warehouse = Number(toWh)
 } else {
 const wh = fd.get("target_warehouse")
 if (wh) data.warehouse = Number(wh)
 }
 await convertRequest(convertDialog.id, data)
 toast.success("Promoted to Strategy Layer!")
 setConvertDialog(null)
 loadData()
 } catch (err: any) {
 toast.error(err.message || "Promotion failed")
 }
 })
 }} className="space-y-4 pt-4">
 {convertDialog?.request_type === 'STOCK_TRANSFER' ? (
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Source Terminal</label>
 <select name="from_warehouse" required className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-100 transition-all">
 <option value="">Select Source</option>
 {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Destination Terminal</label>
 <select name="to_warehouse" required className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-100 transition-all">
 <option value="">Select Destination</option>
 {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>
 </div>
 ) : (
 <div>
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1 mb-1 block">Target Terminal</label>
 <select name="target_warehouse" required className="w-full rounded-2xl border-app-border bg-app-bg px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-100 transition-all">
 <option value="">Select Terminal</option>
 {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>
 )}
 <div className="flex justify-end gap-2 pt-4">
 <Button type="button" variant="ghost" onClick={() => setConvertDialog(null)} className="rounded-xl font-bold">Back</Button>
 <Button type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-app-text rounded-2xl font-bold h-12 px-8 shadow-lg shadow-purple-100 transition-all">
 {isPending ? "Promoting..." : "Finalize Promotion"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog >
 </div >
 )
}
