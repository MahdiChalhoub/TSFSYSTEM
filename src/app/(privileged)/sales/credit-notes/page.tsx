'use client'

import { useState, useEffect, useMemo } from "react"
import { getCreditNotes } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 CreditCard, FileText, Clock, DollarSign, RefreshCw, User
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'

export default function CreditNotesPage() {
 const { fmt } = useCurrency()
 const [creditNotes, setCreditNotes] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('sales_credit_notes', {
 columns: ['credit_number', 'date', 'customer', 'amount', 'status'],
 pageSize: 25, sortKey: 'date', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const cn = await getCreditNotes()
 setCreditNotes(Array.isArray(cn) ? cn : [])
 } catch {
 toast.error("Failed to load credit notes")
 } finally {
 setLoading(false)
 }
 }

 const stats = useMemo(() => {
 const totalAmount = creditNotes.reduce((s, cn) => s + Number(cn.amount || 0), 0)
 return { total: creditNotes.length, totalAmount }
 }, [creditNotes])

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'credit_number',
 label: 'Credit Note #',
 sortable: true,
 render: (cn) => <span className="font-mono text-sm font-black text-app-foreground">{cn.credit_number || `CN-${cn.id}`}</span>
 },
 {
 key: 'date',
 label: 'Issue Date',
 sortable: true,
 render: (cn) => <span className="text-sm text-app-muted-foreground font-medium">{cn.date || cn.created_at?.split('T')[0] || '—'}</span>
 },
 {
 key: 'customer',
 label: 'Customer',
 sortable: true,
 render: (cn) => (
 <div className="app-page flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-app-surface-2 flex items-center justify-center">
 <User size={12} className="text-app-muted-foreground" />
 </div>
 <span className="font-bold text-app-foreground text-sm">{cn.customer_name || 'Anonymous'}</span>
 </div>
 )
 },
 {
 key: 'amount',
 label: 'Amount',
 align: 'right' as const,
 sortable: true,
 render: (cn) => <span className="font-mono text-sm font-black text-app-primary">{fmt(Number(cn.amount || 0))}</span>
 },
 {
 key: 'status',
 label: 'Status',
 align: 'center' as const,
 render: (cn) => (
 <Badge variant="outline" className="gap-1 rounded-lg border bg-app-info-bg border-app-info text-app-info font-semibold text-[10px] uppercase h-5">
 <FileText size={10} /> {cn.status || 'ISSUED'}
 </Badge>
 )
 },
 ], [fmt])

 if (loading && creditNotes.length === 0) {
 return (
 <div className="p-6 space-y-6 animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <FileText size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="italic">
            Credit <span className="text-app-primary">Notes</span>
          </h1>
        </div>
      </div>
    </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary/5 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <CreditCard size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Notes</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.total}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-primary truncate">{fmt(stats.totalAmount)}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-violet-50 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">This Month</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">
 {creditNotes.filter(cn => {
 const d = cn.date || cn.created_at
 if (!d) return false
 const now = new Date()
 const noteDate = new Date(d)
 return noteDate.getMonth() === now.getMonth() && noteDate.getFullYear() === now.getFullYear()
 }).length}
 </p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title="Credit Note Register"
 data={creditNotes}
 loading={loading}
 getRowId={(item) => item.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 />
 </div>
 )
}
