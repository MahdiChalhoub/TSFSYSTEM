'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { getPurchaseReturns, completePurchaseReturn } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 RotateCcw, Search, Clock, CheckCircle2, XCircle,
 Package, Send, RefreshCw, User, ClipboardList
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 PENDING: { label: 'Pending', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: Clock },
 COMPLETED: { label: 'Completed', color: 'text-app-success', bg: 'bg-app-primary-light border-app-success', icon: CheckCircle2 },
 CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
}

export default function PurchaseReturnsPage() {
 const { fmt } = useCurrency()
 const [returns, setReturns] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [confirmId, setConfirmId] = useState<number | null>(null)
 const [isPending, startTransition] = useTransition()
 const settings = useListViewSettings('fin_purchase_returns', {
 columns: ['return_date', 'supplier', 'reason', 'status', 'actions'],
 pageSize: 25, sortKey: 'return_date', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const r = await getPurchaseReturns()
 setReturns(Array.isArray(r) ? r : [])
 } catch {
 toast.error("Failed to load purchase returns")
 } finally {
 setLoading(false)
 }
 }

 async function handleComplete(id: number) {
 startTransition(async () => {
 try {
 await completePurchaseReturn(id)
 toast.success("Purchase return completed — stock removed & GL posted")
 setConfirmId(null)
 loadData()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || "Failed to complete return")
 }
 })
 }

 const stats = useMemo(() => {
 const pending = returns.filter(r => r.status === 'PENDING').length
 const completed = returns.filter(r => r.status === 'COMPLETED').length
 const totalAmount = returns.filter(r => r.status !== 'CANCELLED').reduce((s, r) => s + Number(r.total || 0), 0)
 return { total: returns.length, pending, completed, totalAmount }
 }, [returns])

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'return_date',
 label: 'Manifest Date',
 sortable: true,
 render: (r) => (
 <div className="app-page flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{r.return_date || '—'}</span>
 <span className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest">{r.reference || `#${r.id}`}</span>
 </div>
 )
 },
 {
 key: 'supplier',
 label: 'Supplier / Vendor',
 sortable: true,
 render: (r) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-surface-2 flex items-center justify-center text-app-muted-foreground">
 <User size={14} />
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{r.supplier_name || 'Generic Vendor'}</span>
 <span className="text-[10px] text-app-primary font-bold uppercase">Ref: {r.original_order_ref || `#${r.original_order}`}</span>
 </div>
 </div>
 )
 },
 {
 key: 'reason',
 label: 'Rejection Reason',
 render: (r) => <span className="text-xs text-app-muted-foreground font-medium truncate max-w-[200px] inline-block">{r.reason || 'No reason provided'}</span>
 },
 {
 key: 'status',
 label: 'Workflow',
 align: 'center',
 sortable: true,
 render: (r) => {
 const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING
 const Icon = sc.icon
 return (
 <Badge className={`${sc.bg} ${sc.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg flex items-center gap-1`}>
 <Icon size={10} /> {sc.label}
 </Badge>
 )
 }
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (r) => (
 <div className="flex items-center justify-end gap-1">
 {r.status === 'PENDING' && (
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setConfirmId(r.id)}
 className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-primary hover:bg-app-primary-light hover:text-app-success transition-all gap-1"
 >
 <Send size={12} /> Finalize
 </Button>
 )}
 </div>
 )
 }
 ], [])

 if (loading && returns.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 {/* Standard Header */}
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-indigo-200">
 <Package size={28} className="text-app-foreground" />
 </div>
 Supply Return <span className="text-app-primary">Ledger</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Procurement Reversals & Supplier Credits</p>
 </div>
 <Button onClick={loadData} variant="ghost" className="h-12 w-12 rounded-2xl p-0 text-app-muted-foreground hover:text-app-foreground">
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </Button>
 </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-background text-app-muted-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
 <ClipboardList size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Manifests</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.total}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">Lifecycle Activity</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-warning-bg text-app-warning flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Active Requests</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.pending}</p>
 <p className="text-[10px] text-app-warning font-bold uppercase mt-1">Awaiting Finalization</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <CheckCircle2 size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Recovery Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-primary truncate">{fmt(stats.totalAmount)}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Confirmed Returns</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title="Procurement Reversal Log"
 data={returns}
 loading={loading}
 getRowId={(r) => r.id}
 columns={columns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 />

 {/* Confirm Dialog */}
 <Dialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null) }}>
 <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl">
 <DialogHeader>
 <DialogTitle className="text-2xl font-black tracking-tight text-app-success flex items-center gap-3">
 <Send size={24} /> Finalize Supply Return
 </DialogTitle>
 <DialogDescription className="text-app-muted-foreground font-medium tracking-tight mt-2">
 Finalizing this return will remove items from your physical inventory, adjust your supplier payable balance, and record a reversing entry in the general ledger.
 </DialogDescription>
 </DialogHeader>
 <div className="flex justify-end gap-3 pt-6 border-t border-stone-50">
 <Button variant="ghost" onClick={() => setConfirmId(null)} className="rounded-xl font-black text-[10px] uppercase">Cancel</Button>
 <Button
 onClick={() => confirmId && handleComplete(confirmId)}
 disabled={isPending}
 className="rounded-xl bg-app-primary hover:bg-app-success text-app-foreground font-black text-[10px] uppercase h-10 px-6 gap-2"
 >
 {isPending ? "Finalizing Ledger..." : <><Send size={16} /> Authorize Reversal</>}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 )
}
