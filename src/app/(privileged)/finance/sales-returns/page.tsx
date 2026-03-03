'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { getSalesReturns, approveSalesReturn, cancelSalesReturn, getCreditNotes } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 RotateCcw, Search, Clock, CheckCircle2, XCircle, Ban,
 FileText, CreditCard, ShieldCheck, Package, LayoutGrid,
 RefreshCw, ArrowRight, User
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 PENDING: { label: 'Pending', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: Clock },
 APPROVED: { label: 'Approved', color: 'text-app-success', bg: 'bg-app-primary-light border-app-success', icon: CheckCircle2 },
 COMPLETED: { label: 'Completed', color: 'text-app-info', bg: 'bg-app-info-bg border-app-info', icon: ShieldCheck },
 CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
}

export default function SalesReturnsPage() {
 const { fmt } = useCurrency()
 const [returns, setReturns] = useState<any[]>([])
 const [creditNotes, setCreditNotes] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [activeTab, setActiveTab] = useState<'RETURNS' | 'CREDIT_NOTES'>('RETURNS')
 const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'approve' | 'cancel' } | null>(null)
 const [isPending, startTransition] = useTransition()
 const settings = useListViewSettings('fin_sales_returns', {
 columns: ['return_date', 'customer', 'reason', 'status', 'actions'],
 pageSize: 25, sortKey: 'return_date', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const [r, cn] = await Promise.all([getSalesReturns(), getCreditNotes()])
 setReturns(Array.isArray(r) ? r : [])
 setCreditNotes(Array.isArray(cn) ? cn : [])
 } catch {
 toast.error("Failed to load returns data")
 } finally {
 setLoading(false)
 }
 }

 async function handleAction(id: number, action: 'approve' | 'cancel') {
 startTransition(async () => {
 try {
 if (action === 'approve') {
 await approveSalesReturn(id)
 toast.success("Return approved — stock restocked & credit note created")
 } else {
 await cancelSalesReturn(id)
 toast.success("Return cancelled")
 }
 setConfirmDialog(null)
 loadData()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || `Failed to ${action} return`)
 }
 })
 }

 const stats = useMemo(() => {
 const pending = returns.filter(r => r.status === 'PENDING').length
 const totalAmount = returns.filter(r => r.status !== 'CANCELLED').reduce((s, r) => s + Number(r.total || 0), 0)
 return { total: returns.length, pending, totalAmount, creditCount: creditNotes.length }
 }, [returns, creditNotes])

 const returnColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'return_date',
 label: 'Request Date',
 sortable: true,
 render: (r) => (
 <div className="app-page flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{r.return_date || '—'}</span>
 <span className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest">{r.reference || `#${r.id}`}</span>
 </div>
 )
 },
 {
 key: 'customer',
 label: 'Customer / Transaction',
 sortable: true,
 render: (r) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-surface-2 flex items-center justify-center">
 <User size={14} className="text-app-muted-foreground" />
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{r.customer_name || 'Anonymous'}</span>
 <span className="text-[10px] text-app-primary font-bold uppercase tracking-tighter">Order: {r.original_order_ref || `#${r.original_order}`}</span>
 </div>
 </div>
 )
 },
 {
 key: 'reason',
 label: 'Return Reason',
 render: (r) => <span className="text-xs text-app-muted-foreground font-medium truncate max-w-[200px] inline-block">{r.reason || 'Not specified'}</span>
 },
 {
 key: 'status',
 label: 'Lifecycle',
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
 <>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setConfirmDialog({ id: r.id, action: 'approve' })}
 className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-primary hover:bg-app-primary-light hover:text-app-success transition-all"
 >
 <CheckCircle2 size={12} className="mr-1" /> Approve
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setConfirmDialog({ id: r.id, action: 'cancel' })}
 className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-error hover:bg-app-error-bg hover:text-app-error transition-all"
 >
 <Ban size={12} className="mr-1" /> Cancel
 </Button>
 </>
 )}
 </div>
 )
 }
 ], [])

 const creditNoteColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'credit_number',
 label: 'Credit Note',
 sortable: true,
 render: (cn) => <span className="font-mono text-sm font-black text-app-foreground">{cn.credit_number}</span>
 },
 {
 key: 'date',
 label: 'Issued At',
 sortable: true,
 render: (cn) => <span className="text-sm text-app-muted-foreground font-medium">{cn.date}</span>
 },
 {
 key: 'customer',
 label: 'Beneficiary',
 sortable: true,
 render: (cn) => <span className="font-bold text-app-foreground text-sm">{cn.customer_name || 'Anonymous'}</span>
 },
 {
 key: 'amount',
 label: 'Valuation',
 align: 'right',
 sortable: true,
 render: (cn) => <span className="font-mono text-sm font-black text-app-primary">{fmt(Number(cn.amount))}</span>
 },
 {
 key: 'status',
 label: 'Status',
 align: 'center',
 render: (cn) => (
 <Badge variant="outline" className="gap-1 rounded-lg border bg-app-info-bg border-app-info text-app-info font-semibold text-[10px] uppercase h-5">
 <FileText size={10} /> {cn.status}
 </Badge>
 )
 }
 ], [fmt])

 if (loading && returns.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
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
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-surface flex items-center justify-center shadow-lg shadow-stone-200">
 <RotateCcw size={28} className="text-app-foreground" />
 </div>
 Sales Return <span className="text-app-muted-foreground">Management</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Post-Sale Invoicing & Returns</p>
 </div>
 <Button onClick={loadData} variant="ghost" className="h-12 w-12 rounded-2xl p-0 text-app-muted-foreground hover:text-app-foreground">
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </Button>
 </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-background text-app-muted-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
 <RotateCcw size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total volume</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.total}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">Lifecycle Count</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-warning-bg text-app-warning flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Awaiting Action</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.pending}</p>
 <p className="text-[10px] text-app-warning font-bold uppercase mt-1">Pending Approval</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <CheckCircle2 size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Portfolio Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-primary truncate">{fmt(stats.totalAmount)}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Accepted Returns</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <CreditCard size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Credit Notes</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.creditCount}</p>
 <p className="text-[10px] text-app-info font-bold uppercase mt-1">Active Portfolio</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title={activeTab === 'RETURNS' ? "Inventory Compensation Register" : "Client Credit Ledger"}
 data={activeTab === 'RETURNS' ? returns : creditNotes}
 loading={loading}
 getRowId={(item) => item.id}
 columns={activeTab === 'RETURNS' ? returnColumns : creditNoteColumns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 headerExtra={
 <div className="flex items-center gap-1 bg-app-surface-2 p-1 rounded-2xl">
 {[
 { key: 'RETURNS', label: 'Returns', icon: RotateCcw },
 { key: 'CREDIT_NOTES', label: 'Credits', icon: CreditCard },
 ].map(tab => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key as any)}
 className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.key
 ? "bg-app-surface shadow-sm text-app-foreground"
 : "text-app-muted-foreground hover:text-app-muted-foreground"
 }`}
 >
 <tab.icon size={12} />
 {tab.label}
 </button>
 ))}
 </div>
 }
 />

 {/* Confirm Dialog */}
 <Dialog open={confirmDialog !== null} onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}>
 <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-2xl">
 <DialogHeader>
 <DialogTitle className={`text-2xl font-black tracking-tight flex items-center gap-3 ${confirmDialog?.action === 'approve' ? 'text-app-success' : 'text-app-error'}`}>
 {confirmDialog?.action === 'approve' ? <><CheckCircle2 size={24} /> Approve Return</> : <><Ban size={24} /> Cancel Return</>}
 </DialogTitle>
 <DialogDescription className="text-app-muted-foreground font-medium tracking-tight mt-2">
 {confirmDialog?.action === 'approve'
 ? "This action will restock inventory items, generate a credit note for the client, and post a reversing journal entry to the ledger."
 : "This will permanently dismiss this return request. No inventory or financial changes will be made."}
 </DialogDescription>
 </DialogHeader>
 <div className="flex justify-end gap-3 pt-6 border-t border-stone-50">
 <Button variant="ghost" onClick={() => setConfirmDialog(null)} className="rounded-xl font-black text-[10px] uppercase">Cancel</Button>
 <Button
 variant={confirmDialog?.action === 'approve' ? 'default' : 'destructive'}
 onClick={() => confirmDialog && handleAction(confirmDialog.id, confirmDialog.action)}
 disabled={isPending}
 className={`rounded-xl font-black text-[10px] uppercase h-10 px-6 gap-2 ${confirmDialog?.action === 'approve' ? 'bg-app-primary hover:bg-app-success text-app-foreground' : ''}`}
 >
 {isPending ? "Configuring..." : confirmDialog?.action === 'approve' ? <><CheckCircle2 size={16} /> Authorize</> : <><Ban size={16} /> Revoke Request</>}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 )
}
