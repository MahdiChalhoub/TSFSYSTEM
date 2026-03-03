'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { PurchaseReturn } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 RotateCcw, CheckCircle2, Truck, Search,
 Filter, Calendar, ChevronRight, User, PackageX,
 Hash, RefreshCw, ArrowUpRight, ShieldCheck, Building
} from "lucide-react"
import Link from "next/link"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 PENDING: { label: 'Pending Processing', color: 'bg-app-warning-bg text-app-warning border-app-warning/30' },
 COMPLETED: { label: 'Completed (Destocked)', color: 'bg-app-primary-light text-app-success border-app-success/30' },
 CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}

export default function PurchaseReturnsPage() {
 const { fmt } = useCurrency()
 const [returns, setReturns] = useState<PurchaseReturn[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('purch_returns', {
 columns: ['id', 'original_order', 'supplier_name', 'status', 'total_amount', 'actions'],
 pageSize: 25, sortKey: 'id', sortDir: 'desc'
 })

 useEffect(() => { loadReturns() }, [])

 async function loadReturns() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('purchase-returns/')
 setReturns(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load vendor debit stream")
 } finally {
 setLoading(false)
 }
 }

 async function completeReturn(id: number) {
 toast.loading("Initiating vendor destock sequence...")
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`purchase-returns/${id}/complete/`, { method: 'POST' })
 toast.dismiss()
 toast.success("Vendor return completed successfully")
 loadReturns()
 } catch (e: unknown) {
 toast.dismiss()
 toast.error((e instanceof Error ? e.message : String(e)) || "Processing failed")
 }
 }

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'id',
 label: 'Debit ID',
 render: (ret) => <span className="font-black text-app-foreground leading-tight">PRET-{ret.id}</span>
 },
 {
 key: 'original_order',
 label: 'Source PO',
 render: (ret) => (
 <Link href={`/purchases/${ret.original_order}`} className="app-page flex items-center gap-1.5 group/link">
 <div className="w-6 h-6 rounded bg-app-background border border-app-border flex items-center justify-center text-app-muted-foreground group-hover/link:text-app-primary group-hover/link:bg-app-primary/5 transition-colors">
 <Hash size={10} />
 </div>
 <span className="text-xs font-bold text-app-primary group-hover/link:underline">
 PO #{ret.original_order}
 </span>
 </Link>
 )
 },
 {
 key: 'supplier_name',
 label: 'Vendor Entity',
 render: (ret) => (
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl bg-app-background border border-app-border flex items-center justify-center text-app-muted-foreground">
 <Building size={14} />
 </div>
 <span className="text-sm font-semibold text-app-muted-foreground tracking-tight">{ret.supplier_name || 'Unknown Supplier'}</span>
 </div>
 )
 },
 {
 key: 'status',
 label: 'Lifecycle Status',
 render: (ret) => (
 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[ret.status ?? '']?.color || 'bg-app-background text-app-muted-foreground'}`}>
 {STATUS_CONFIG[ret.status ?? '']?.label || ret.status}
 </Badge>
 )
 },
 {
 key: 'total_amount',
 label: 'Debit Exposure',
 align: 'right',
 render: (ret) => (
 <span className="font-black text-app-foreground tracking-tighter">{fmt(parseFloat(String(ret.total_amount || 0)))}</span>
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
 className="h-8 px-4 bg-app-info hover:bg-app-info text-app-foreground font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-blue-100 gap-1.5"
 onClick={() => completeReturn(ret.id)}
 >
 <Truck size={13} /> Ship Out
 </Button>
 )}
 <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-app-muted-foreground hover:text-app-info hover:bg-app-info-bg">
 <Link href={`/purchases/returns/${ret.id}`}>
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
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Procurement</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Purchase <span className="text-app-primary">Returns</span>
          </h1>
        </div>
      </div>
    </header>

 <TypicalListView
 title="Vendor Restitution Flow"
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
 <Badge variant="outline" className="bg-app-info-bg text-app-info border-app-info/30 text-[10px] font-black uppercase px-3 h-6">
 Verified Claims Only
 </Badge>
 </div>
 }
 />
 </div>
 )
}
