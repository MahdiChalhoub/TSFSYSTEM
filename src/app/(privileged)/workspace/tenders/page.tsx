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
 OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
 SUBMITTED: { label: 'Submitted', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: FileText },
 AWARDED: { label: 'Awarded', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
 CLOSED: { label: 'Closed', color: 'text-gray-700', bg: 'bg-app-bg border-app-border', icon: XCircle },
 CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
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
 <div className="flex flex-col">
 <span className="font-mono text-sm font-black text-app-text">{t.reference || t.ref_code || `#${t.id}`}</span>
 <span className="text-[10px] text-app-text-faint font-medium truncate max-w-[200px]">{t.title || t.subject || 'Untitled tender'}</span>
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
 <Users size={12} className="text-app-text-faint" />
 </div>
 <span className="font-bold text-app-text text-sm">{t.client_name || t.contact_name || 'N/A'}</span>
 </div>
 )
 },
 {
 key: 'deadline',
 label: 'Deadline',
 sortable: true,
 render: (t) => {
 const deadline = t.deadline || t.due_date
 if (!deadline) return <span className="text-app-text-faint text-sm">—</span>
 const isOverdue = new Date(deadline) < new Date()
 return (
 <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-app-text-muted'}`}>
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
 render: (t) => <span className="font-mono text-sm font-black text-emerald-600">{fmt(Number(t.estimated_value || t.value || 0))}</span>
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
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
 <FileText size={28} className="text-white" />
 </div>
 Tender <span className="text-amber-600">Inbox</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
 Request for Proposals & Bidding
 </p>
 </div>
 <button
 onClick={loadData}
 className="h-12 w-12 rounded-2xl border border-app-border flex items-center justify-center text-app-text-faint hover:text-app-text hover:bg-app-bg transition-all"
 >
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </button>
 </header>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <FileText size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Total Tenders</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-text">{stats.total}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <CalendarDays size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Open</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-text">{stats.open}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Pipeline Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-emerald-600 truncate">{fmt(stats.totalValue)}</p>
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
