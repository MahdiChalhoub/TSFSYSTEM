'use client'
import { useState, useEffect, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
 getCountingSessions, createCountingSession, deleteCountingSession,
 getFilterOptions, getProductCount, type CreateSessionInput
} from "@/app/actions/inventory/stock-count"
import { Card, CardContent } from "@/components/ui/card"
import { TypicalListView, type ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from "@/components/common/TypicalFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
 Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
 Plus, Search, Clock, AlertTriangle, CheckCircle2, Sparkles,
 Package, ClipboardList, Trash2, Eye, ShieldCheck, Loader2, Users, RefreshCw
} from "lucide-react"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SessionPopulator } from "./SyncPanel"
import { toast } from "sonner"
// ─── Types ───────────────────────────────────────────────────────
interface Session {
 id: number
 reference: string | null
 location: string
 section: string
 warehouse: number | null
 warehouse_name: string | null
 session_date: string
 status: string
 person1_name: string | null
 person2_name: string | null
 assigned_users: { user_id: number; user_name: string }[]
 products_count: number
 counted_count: number
 verified_count: number
 needs_adjustment_count: number
 created_by_name: string | null
 created_at: string
}
interface FilterOptions {
 categories: string[]
 suppliers: { id: number; company_name: string }[]
 warehouses: { id: number; name: string; code: string | null }[]
}
// ─── Page ────────────────────────────────────────────────────────
export default function StockCountPage() {
 const settings = useListViewSettings('inv_stock_count', {
 columns: ['reference', 'location', 'section', 'date', 'compliance'],
 pageSize: 25,
 sortKey: 'date',
 sortDir: 'desc',
 })
 const [sessions, setSessions] = useState<Session[]>([])
 const [loading, setLoading] = useState(true)
 const [isPending, startTransition] = useTransition()
 const [search, setSearch] = useState("")
 const [statusFilter, setStatusFilter] = useState("ALL")
 const [showCreate, setShowCreate] = useState(false)
 const [activeSession, setActiveSession] = useState<{ id: number, ref?: string } | null>(null)
 const router = useRouter()
 const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
 const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
 // ─── Fetch ───
 const fetchSessions = useCallback(() => {
 setLoading(true)
 startTransition(async () => {
 try {
 const data = await getCountingSessions()
 setSessions(Array.isArray(data) ? data : data?.results || [])
 } catch {
 setSessions([])
 toast.error("Failed to load stock count sessions")
 } finally {
 setLoading(false)
 }
 })
 }, [])
 useEffect(() => { fetchSessions() }, [fetchSessions])
 // KPI Calculations
 const inProgress = sessions.filter(s => s.status === 'IN_PROGRESS').length
 const pendingReview = sessions.filter(s => s.status === 'WAITING_VERIFICATION').length
 const auditCompletion = sessions.length > 0 ? (sessions.filter(s => s.status === 'VERIFIED' || s.status === 'ADJUSTED').length / sessions.length * 100).toFixed(1) : '0.0'
 const columns: ColumnDef<Session>[] = [
 { key: 'reference', label: 'Reference', sortable: true, alwaysVisible: true, render: r => <span className="font-mono font-bold text-app-text">COUNT-{r.reference || r.id}</span> },
 { key: 'location', label: 'Warehouse', render: r => <Badge variant="outline" className="bg-app-bg text-gray-700 border-app-border uppercase text-[9px] font-black">{r.warehouse_name || r.location}</Badge> },
 { key: 'section', label: 'Category', render: r => <span className="text-xs font-medium text-app-text-faint italic">{r.section}</span> },
 { key: 'date', label: 'Count Date', render: r => <span className="text-app-text-muted font-medium">{r.session_date}</span> },
 {
 key: 'progress', label: 'Progress', align: 'center', render: r => (
 <div className="flex flex-col items-center gap-1">
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-tighter">Verified</span>
 <span className={`text-sm font-black ${r.verified_count === r.products_count ? 'text-emerald-600' : 'text-orange-500'}`}>{r.verified_count}/{r.products_count}</span>
 </div>
 )
 },
 ]
 const filtered = sessions.filter(s => {
 const matchesSearch = !search || s.location?.toLowerCase().includes(search.toLowerCase()) || s.reference?.toLowerCase().includes(search.toLowerCase())
 const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter
 return matchesSearch && matchesStatus
 })
 const handleDelete = () => {
 if (deleteTarget === null) return
 startTransition(async () => {
 try {
 await deleteCountingSession(deleteTarget)
 toast.success("Count session deleted")
 fetchSessions()
 } catch { toast.error("Failed to purge session") }
 })
 setDeleteTarget(null)
 }
 const handleBulkDelete = () => {
 if (!confirm(`Are you sure you want to purge ${selectedIds.size} sessions?`)) return
 toast.info("Bulk purge successful (simulation)")
 setSelectedIds(new Set())
 }
 const handleCreated = (id: number, ref?: string) => {
 setShowCreate(false)
 setActiveSession({ id, ref })
 fetchSessions()
 }
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
 <ClipboardList size={28} className="text-app-text" />
 </div>
 Stock <span className="text-indigo-600">Count</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Inventory Verification & Adjustment</p>
 </div>
 <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
 <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
 <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Count System Active</span>
 </div>
 </header>
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
 <div className="lg:col-span-3 space-y-6">
 {/* Count Session Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-wider">In Progress</p>
 <h2 className="text-3xl font-black text-app-text mt-0.5">{inProgress}</h2>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <AlertTriangle size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-wider">Pending Review</p>
 <h2 className="text-3xl font-black text-app-text mt-0.5">{pendingReview}</h2>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Sparkles size={28} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-wider">Completion Rate</p>
 <h2 className="text-3xl font-black text-app-text mt-0.5">{auditCompletion}%</h2>
 </div>
 </CardContent>
 </Card>
 </div>
 <TypicalListView<Session>
 title="Count Sessions"
 addLabel="NEW COUNT"
 onAdd={() => setShowCreate(true)}
 data={filtered}
 loading={loading}
 getRowId={r => r.id}
 columns={columns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 selection={{
 selectedIds,
 onSelectionChange: setSelectedIds
 }}
 bulkActions={
 <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 font-bold px-4 uppercase" onClick={handleBulkDelete}>
 <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
 </Button>
 }
 headerExtra={
 <Button onClick={fetchSessions} variant="ghost" className="h-8 w-8 p-0 text-app-text-faint hover:text-indigo-600">
 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
 </Button>
 }
 lifecycle={{
 getStatus: r => {
 const m: Record<string, any> = {
 IN_PROGRESS: { label: 'Counting', variant: 'warning' },
 WAITING_VERIFICATION: { label: 'Pending Verification', variant: 'info' },
 VERIFIED: { label: 'Verified', variant: 'success' },
 ADJUSTED: { label: 'Stock Adjusted', variant: 'success' },
 CANCELLED: { label: 'Cancelled', variant: 'danger' }
 }
 return m[r.status] || { label: r.status, variant: 'default' }
 },
 getVerified: r => r.status === 'VERIFIED' || r.status === 'ADJUSTED',
 getCanceled: r => r.status === 'CANCELLED'
 }}
 actions={{
 extra: (s: Session) => (
 <div className="flex items-center gap-1">
 {s.status === 'IN_PROGRESS' && (
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px]" onClick={() => router.push(`/inventory/stock-count/${s.id}/count`)}>
 <ClipboardList size={14} className="mr-1" /> COUNT
 </Button>
 )}
 {(s.status === 'WAITING_VERIFICATION' || s.status === 'VERIFIED') && (
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold text-[10px]" onClick={() => router.push(`/inventory/stock-count/${s.id}/verify`)}>
 <ShieldCheck size={14} className="mr-1" /> VERIFY
 </Button>
 )}
 {s.status === 'ADJUSTED' && (
 <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-app-border text-app-text-muted hover:bg-app-bg font-bold text-[10px]" onClick={() => router.push(`/inventory/stock-count/${s.id}/verify`)}>
 <Eye size={14} className="mr-1" /> VIEW RESULTS
 </Button>
 )}
 <Button size="sm" variant="ghost" className="h-8 w-8 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => setDeleteTarget(s.id)}>
 <Trash2 size={14} />
 </Button>
 </div>
 )
 }}
 >
 <TypicalFilter
 search={{ placeholder: 'Search by reference or warehouse...', value: search, onChange: setSearch }}
 filters={[
 {
 key: 'status', label: 'Status', type: 'select', options: [
 { value: 'ALL', label: 'All Statuses' },
 { value: 'IN_PROGRESS', label: 'In Progress' },
 { value: 'WAITING_VERIFICATION', label: 'Pending Review' },
 { value: 'VERIFIED', label: 'Verified' },
 { value: 'ADJUSTED', label: 'Adjusted' }
 ]
 }
 ]}
 values={{ status: statusFilter }}
 onChange={(k, v) => setStatusFilter(String(v))}
 />
 </TypicalListView>
 </div>
 <div className="lg:col-span-1">
 <SessionPopulator
 sessionId={activeSession?.id}
 sessionRef={activeSession?.ref}
 onComplete={fetchSessions}
 />
 </div>
 </div>
 {/* Create Modal - Standardized */}
 {showCreate && <CreateSessionDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleDelete}
 title="Delete Count Session?"
 description="This will permanently remove all count data and verification records for this session. This action cannot be undone."
 confirmText="Delete Session"
 variant="danger"
 />
 </div>
 )
}
// ─── Create Session Dialog ───────────────────────────────────────
function CreateSessionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number, ref?: string) => void }) {
 const [isPending, startTransition] = useTransition()
 const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null)
 const [productPreview, setProductPreview] = useState<number | null>(null)
 const [form, setForm] = useState({
 warehouse_id: '',
 category: '',
 supplier_id: '',
 qty_filter: '',
 qty_min: '',
 qty_max: '',
 person1_name: '',
 person2_name: '',
 })
 useEffect(() => {
 startTransition(async () => {
 const opts = await getFilterOptions()
 setFilterOpts(opts)
 })
 }, [])
 useEffect(() => {
 const params: Record<string, string> = {}
 if (form.category) params.category = form.category
 if (form.supplier_id) params.supplier_id = form.supplier_id
 if (form.qty_filter) {
 params.qty_filter = form.qty_filter
 if (form.qty_filter === 'custom') {
 if (form.qty_min) params.qty_min = form.qty_min
 if (form.qty_max) params.qty_max = form.qty_max
 }
 }
 startTransition(async () => {
 const data = await getProductCount(params)
 setProductPreview(data?.total ?? null)
 })
 }, [form.category, form.supplier_id, form.qty_filter, form.qty_min, form.qty_max])
 const handleSubmit = () => {
 const wh = filterOpts?.warehouses.find(w => w.id.toString() === form.warehouse_id)
 const data: CreateSessionInput = {
 location: wh?.name || 'All Locations',
 section: form.category || 'All Categories',
 warehouse: wh ? wh.id : undefined,
 session_date: new Date().toISOString().split('T')[0],
 person1_name: form.person1_name || undefined,
 person2_name: form.person2_name || undefined,
 category_filter: form.category || undefined,
 supplier_filter: form.supplier_id ? parseInt(form.supplier_id) : undefined,
 qty_filter: form.qty_filter || undefined,
 qty_min: form.qty_filter === 'custom' && form.qty_min ? parseFloat(form.qty_min) : undefined,
 qty_max: form.qty_filter === 'custom' && form.qty_max ? parseFloat(form.qty_max) : undefined,
 }
 startTransition(async () => {
 try {
 const res = await createCountingSession(data)
 if (res && res.id) {
 toast.success("Stock count session created")
 onCreated(res.id, res.reference)
 } else {
 onCreated(0)
 }
 } catch (e: any) {
 toast.error(e.message || "Failed to initiate session")
 }
 })
 }
 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent className="max-w-xl rounded-[2rem] border-0 shadow-2xl overflow-y-auto max-h-[85vh]">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black">New Stock Count Session</DialogTitle>
 <DialogDescription className="text-app-text-faint font-medium pt-1">Configure the scope and assign counters for this inventory count.</DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Warehouse</Label>
 <Select value={form.warehouse_id} onValueChange={v => setForm(f => ({ ...f, warehouse_id: v }))}>
 <SelectTrigger className="rounded-xl border-app-border h-11"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
 <SelectContent className="rounded-xl border-app-border">
 {filterOpts?.warehouses.map(w => (
 <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Category</Label>
 <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
 <SelectTrigger className="rounded-xl border-app-border h-11"><SelectValue placeholder="All categories" /></SelectTrigger>
 <SelectContent className="rounded-xl border-app-border">
 <SelectItem value=" ">All Categories</SelectItem>
 {filterOpts?.categories.map(c => (
 <SelectItem key={c} value={c}>{c}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Supplier</Label>
 <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
 <SelectTrigger className="rounded-xl border-app-border h-11"><SelectValue placeholder="All suppliers" /></SelectTrigger>
 <SelectContent className="rounded-xl border-app-border">
 <SelectItem value=" ">All Suppliers</SelectItem>
 {filterOpts?.suppliers.map(s => (
 <SelectItem key={s.id} value={s.id.toString()}>{s.company_name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Quantity Filter</Label>
 <Select value={form.qty_filter} onValueChange={v => setForm(f => ({ ...f, qty_filter: v }))}>
 <SelectTrigger className="rounded-xl border-app-border h-11"><SelectValue placeholder="All Volumes" /></SelectTrigger>
 <SelectContent className="rounded-xl border-app-border">
 <SelectItem value=" ">All Quantities</SelectItem>
 <SelectItem value="zero">Zero Only</SelectItem>
 <SelectItem value="non_zero">Active Only</SelectItem>
 <SelectItem value="custom">Custom Range</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {form.qty_filter === 'custom' ? (
 <div className="flex gap-2 items-end">
 <div className="flex-1"><Input type="number" className="rounded-xl border-app-border h-11 text-xs" value={form.qty_min} onChange={e => setForm(f => ({ ...f, qty_min: e.target.value }))} placeholder="MIN" /></div>
 <div className="flex-1"><Input type="number" className="rounded-xl border-app-border h-11 text-xs" value={form.qty_max} onChange={e => setForm(f => ({ ...f, qty_max: e.target.value }))} placeholder="MAX" /></div>
 </div>
 ) : (
 <div className="border border-dashed border-app-border rounded-xl flex items-center justify-center bg-gray-50/50">
 <span className="text-[10px] font-bold text-gray-300">ALL QUANTITIES</span>
 </div>
 )}
 </div>
 {productPreview !== null && (
 <div className="flex items-center gap-4 p-5 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100">
 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200"><Package size={22} className="text-app-text" /></div>
 <div>
 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Products to Count</p>
 <p className="text-2xl font-black text-indigo-900 leading-none mt-1">{productPreview.toLocaleString()} <span className="text-xs font-bold opacity-40 uppercase tracking-tighter">products matched</span></p>
 </div>
 </div>
 )}
 <div className="grid grid-cols-2 gap-4 pt-2">
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Counter 1</Label>
 <Input className="rounded-xl border-app-border h-11" value={form.person1_name} onChange={e => setForm(f => ({ ...f, person1_name: e.target.value }))} placeholder="Name of first counter" />
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] font-black uppercase text-app-text-faint tracking-wider">Counter 2</Label>
 <Input className="rounded-xl border-app-border h-11" value={form.person2_name} onChange={e => setForm(f => ({ ...f, person2_name: e.target.value }))} placeholder="Name of second counter" />
 </div>
 </div>
 </div>
 <DialogFooter className="pt-6">
 <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
 <Button onClick={handleSubmit} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-app-text rounded-xl px-8 font-bold h-12 shadow-lg shadow-indigo-200">
 {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <ClipboardList size={16} className="mr-2" />}
 Start Count Session
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
