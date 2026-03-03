'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesReturn } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 RotateCcw, CheckCircle2, XCircle, Search,
 Filter, Calendar, ChevronRight, User, FileText,
 Hash, RefreshCw, Undo2, ArrowLeftRight, ShieldCheck
} from "lucide-react"
import Link from "next/link"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 PENDING: { label: 'Pending Review', color: 'bg-app-warning-bg text-app-warning border-app-warning/30' },
 APPROVED: { label: 'Approved & Restocked', color: 'bg-app-primary-light text-app-success border-app-success/30' },
 COMPLETED: { label: 'Completed', color: 'bg-app-info-bg text-app-info border-app-info/30' },
 CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}

export default function SalesReturnsPage() {
 const { fmt } = useCurrency()
 const [returns, setReturns] = useState<SalesReturn[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('sales_returns', {
 columns: ['id', 'original_order_ref', 'customer_name', 'status', 'total_refund', 'actions'],
 pageSize: 25, sortKey: 'id', sortDir: 'desc'
 })

 useEffect(() => { loadReturns() }, [])

 async function loadReturns() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('sales-returns/')
 setReturns(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load restitution stream")
 } finally {
 setLoading(false)
 }
 }

 async function approveReturn(id: number) {
 toast.loading("Initiating inventory restitution...")
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`sales-returns/${id}/approve/`, { method: 'POST' })
 toast.dismiss()
 toast.success("Restock sequence completed")
 loadReturns()
 } catch (e: unknown) {
 toast.dismiss()
 toast.error((e instanceof Error ? e.message : String(e)) || "Restitution failed")
 }
 }

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'id',
 label: 'Restitution ID',
 render: (ret) => <span className="font-black text-app-foreground leading-tight">RET-{ret.id}</span>
 },
 {
 key: 'original_order_ref',
 label: 'Root Order',
 render: (ret) => (
 <Link href={`/sales/${ret.original_order}`} className="app-page flex items-center gap-1.5 group/link">
 <span className="font-mono text-xs font-bold text-app-primary group-hover/link:underline">
 {ret.original_order_ref || `#${ret.original_order}`}
 </span>
 <FileText size={10} className="text-app-muted-foreground group-hover/link:text-app-primary transition-colors" />
 </Link>
 )
 },
 {
 key: 'customer_name',
 label: 'Consignee',
 render: (ret) => (
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-app-background border border-app-border flex items-center justify-center text-app-muted-foreground">
 <User size={12} />
 </div>
 <span className="text-sm font-semibold text-app-muted-foreground">{ret.customer_name || 'N/A'}</span>
 </div>
 )
 },
 {
 key: 'status',
 label: 'Lifecycle',
 render: (ret) => (
 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[ret.status ?? '']?.color || 'bg-app-background text-app-muted-foreground'}`}>
 {STATUS_CONFIG[ret.status ?? '']?.label || ret.status}
 </Badge>
 )
 },
 {
 key: 'total_refund',
 label: 'Refund Value',
 align: 'right',
 render: (ret) => (
 <span className="font-black text-app-foreground tracking-tighter">{fmt(parseFloat(String(ret.total_refund || 0)))}</span>
 )
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (ret) => (
 <div className="flex items-center justify-end gap-1.5">
 {ret.status === 'PENDING' && (
 <Button
 size="sm"
 className="h-8 px-4 bg-app-primary hover:bg-app-success text-app-foreground font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-emerald-100 gap-1.5"
 onClick={() => approveReturn(ret.id)}
 >
 <CheckCircle2 size={13} /> Restock
 </Button>
 )}
 <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5">
 <Link href={`/sales/returns/${ret.id}`}>
 <ChevronRight size={18} />
 </Link>
 </Button>
 </div>
 )
 }
 ], [fmt])

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Undo2 size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Return <span className="text-app-primary">Center</span>
          </h1>
        </div>
      </div>
    </header>

 <TypicalListView
 title="Monetary Restitution Flow"
 data={returns}
 loading={loading}
 getRowId={(ret) => ret.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 headerExtra={
 <div className="flex items-center gap-3">
 <Badge variant="outline" className="bg-app-warning-bg text-app-warning border-app-warning/30 text-[10px] font-black uppercase px-3 h-6">
 Verified Returns Only
 </Badge>
 </div>
 }
 />
 </div>
 )
}
