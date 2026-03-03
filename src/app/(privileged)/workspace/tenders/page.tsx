'use client'

import { useState, useEffect, useMemo } from "react"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 FileText, Clock, CheckCircle2, XCircle, RefreshCw,
 Users, DollarSign, CalendarDays
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 OPEN: { label: 'Open', color: 'text-app-info', bg: 'bg-app-info-bg border-app-info', icon: Clock },
 SUBMITTED: { label: 'Submitted', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: FileText },
 AWARDED: { label: 'Awarded', color: 'text-app-success', bg: 'bg-app-primary-light border-app-success', icon: CheckCircle2 },
 CLOSED: { label: 'Closed', color: 'text-app-muted-foreground', bg: 'bg-app-background border-app-border', icon: XCircle },
 CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
}

export default function TenderInboxPage() {
 const { fmt } = useCurrency()
 const [tenders, setTenders] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('workspace_tenders', {
 columns: ['reference', 'client', 'deadline', 'value', 'status'],
 pageSize: 25, sortKey: 'deadline', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const res = await erpFetch('workspace/tenders/').catch(() => [])
 setTenders(Array.isArray(res) ? res : res?.results || [])
 } catch {
 toast.error("Failed to load tenders")
 } finally {
 setLoading(false)
 }
 }

 const stats = useMemo(() => {
 const open = tenders.filter(t => t.status === 'OPEN').length
 const totalValue = tenders.reduce((s, t) => s + Number(t.estimated_value || t.value || 0), 0)
 return { total: tenders.length, open, totalValue }
 }, [tenders])

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'reference',
 label: 'Reference',
 sortable: true,
 render: (t) => (
 <div className="app-page flex flex-col">
 <span className="font-mono text-sm font-black text-app-foreground">{t.reference || t.ref_code || `#${t.id}`}</span>
 <span className="text-[10px] text-app-muted-foreground font-medium truncate max-w-[200px]">{t.title || t.subject || 'Untitled tender'}</span>
 </div>
 )
 },
 {
 key: 'client',
 label: 'Client / Organization',
 sortable: true,
 render: (t) => (
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-app-surface-2 flex items-center justify-center">
 <Users size={12} className="text-app-muted-foreground" />
 </div>
 <span className="font-bold text-app-foreground text-sm">{t.client_name || t.contact_name || 'N/A'}</span>
 </div>
 )
 },
 {
 key: 'deadline',
 label: 'Deadline',
 sortable: true,
 render: (t) => {
 const deadline = t.deadline || t.due_date
 if (!deadline) return <span className="text-app-muted-foreground text-sm">—</span>
 const isOverdue = new Date(deadline) < new Date()
 return (
 <span className={`text-sm font-medium ${isOverdue ? 'text-app-error' : 'text-app-muted-foreground'}`}>
 {new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
 </span>
 )
 }
 },
 {
 key: 'value',
 label: 'Est. Value',
 align: 'right' as const,
 sortable: true,
 render: (t) => <span className="font-mono text-sm font-black text-app-primary">{fmt(Number(t.estimated_value || t.value || 0))}</span>
 },
 {
 key: 'status',
 label: 'Status',
 align: 'center' as const,
 render: (t) => {
 const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN
 const Icon = sc.icon
 return (
 <Badge className={`${sc.bg} ${sc.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg flex items-center gap-1`}>
 <Icon size={10} /> {sc.label}
 </Badge>
 )
 }
 },
 ], [fmt])

 if (loading && tenders.length === 0) {
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
          <Briefcase size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Workspace</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Tender <span className="text-app-primary">Hub</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-warning-bg text-app-warning flex items-center justify-center group-hover:scale-110 transition-transform">
 <FileText size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Tenders</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.total}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <CalendarDays size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Open</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.open}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Pipeline Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-primary truncate">{fmt(stats.totalValue)}</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title="Tender Register"
 data={tenders}
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
