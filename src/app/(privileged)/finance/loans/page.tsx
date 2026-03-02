'use client'

import { useState, useEffect, useMemo } from "react"
import { getLoans } from "@/app/actions/finance/loans"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import Link from "next/link"
import { format } from "date-fns"
import { useCurrency } from '@/lib/utils/currency'
import {
 HandCoins, Plus, Search, CheckCircle2, FileText, Timer,
 Calendar, DollarSign, ArrowRight, RefreshCw, Users, ShieldCheck
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
 ACTIVE: { icon: Timer, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
 PAID: { icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
 DRAFT: { icon: FileText, color: "text-stone-700", bg: "bg-app-bg border-app-border" },
}

export default function LoansPage() {
 const { fmt } = useCurrency()
 const [loans, setLoans] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('fin_loans', {
 columns: ['startDate', 'partner', 'principalAmount', 'termMonths', 'status', 'actions'],
 pageSize: 25, sortKey: 'startDate', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const data = await getLoans()
 setLoans(Array.isArray(data) ? data : [])
 } catch {
 toast.error("Failed to load loan contracts")
 } finally {
 setLoading(false)
 }
 }

 const stats = useMemo(() => {
 const active = loans.filter(l => l.status === 'ACTIVE').length
 const totalPrincipal = loans.reduce((s, l) => s + Number(l.principalAmount || 0), 0)
 const avgInterest = loans.length > 0
 ? loans.reduce((s, l) => s + Number(l.interestRate || 0), 0) / loans.length
 : 0
 return { active, totalPrincipal, avgInterest }
 }, [loans])

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'startDate',
 label: 'Contract Date',
 sortable: true,
 render: (loan) => (
 <div className="flex flex-col">
 <span className="font-bold text-app-text text-sm">
 {loan.startDate ? format(new Date(loan.startDate), "MMM dd, yyyy") : '—'}
 </span>
 <span className="text-[10px] text-app-text-faint font-black uppercase tracking-widest">Effective Date</span>
 </div>
 )
 },
 {
 key: 'partner',
 label: 'Borrower / Partner',
 sortable: true,
 render: (loan) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center">
 <Users size={14} className="text-app-text-faint" />
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-text text-sm">{loan.contact?.name || 'Unknown Partner'}</span>
 <span className="text-[10px] text-app-text-faint font-black uppercase tracking-widest">ID: #{loan.id}</span>
 </div>
 </div>
 )
 },
 {
 key: 'principalAmount',
 label: 'Principal Amount',
 align: 'right',
 sortable: true,
 render: (loan) => (
 <div className="flex flex-col items-end">
 <span className="font-mono text-sm font-black text-app-text">{fmt(Number(loan.principalAmount))}</span>
 <span className="text-[10px] text-app-text-faint font-bold uppercase tracking-tighter">{Number(loan.interestRate)}% Int. Rate</span>
 </div>
 )
 },
 {
 key: 'termMonths',
 label: 'Duration',
 align: 'center',
 sortable: true,
 render: (loan) => (
 <Badge variant="outline" className="rounded-xl px-3 py-1 bg-app-bg border-app-border text-app-text-muted font-bold text-[11px]">
 {loan.termMonths} Months
 </Badge>
 )
 },
 {
 key: 'status',
 label: 'Status',
 align: 'center',
 sortable: true,
 render: (loan) => {
 const sc = STATUS_CONFIG[loan.status] || STATUS_CONFIG.ACTIVE
 const Icon = sc.icon
 return (
 <Badge className={`${sc.bg} ${sc.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg flex items-center gap-1`}>
 <Icon size={10} /> {loan.status}
 </Badge>
 )
 }
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (loan) => (
 <Link href={`/finance/loans/${loan.id}`}>
 <Button
 size="sm"
 variant="ghost"
 className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all group"
 >
 View Details <ArrowRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
 </Button>
 </Link>
 )
 }
 ], [fmt])

 if (loading && loans.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <div className="flex justify-between items-center">
 <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
 <Skeleton className="h-10 w-44" />
 </div>
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
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-stone-900 flex items-center justify-center shadow-lg shadow-stone-200">
 <HandCoins size={28} className="text-app-text" />
 </div>
 Partner <span className="text-app-text-muted">Loans</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Financial Contracts & Agreements</p>
 </div>
 <Link href="/finance/loans/new">
 <Button className="h-12 px-6 rounded-2xl bg-stone-900 hover:bg-black text-app-text font-black uppercase tracking-widest text-xs shadow-lg shadow-stone-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
 <Plus size={18} /> New Loan Contract
 </Button>
 </Link>
 </header>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <ShieldCheck size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Active Facilities</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-text">{stats.active}</p>
 <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Live Contracts</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Total Portfolio</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-text">{fmt(stats.totalPrincipal)}</p>
 <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Lending Volume</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <RefreshCw size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Average Yield</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-purple-600">{stats.avgInterest.toFixed(2)}%</p>
 <p className="text-[10px] text-app-text-faint font-bold uppercase mt-1">Avg. Return Rate</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title="Lending Activity Ledger"
 data={loans}
 loading={loading}
 getRowId={(loan) => loan.id}
 columns={columns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 headerExtra={
 <button onClick={loadData} className="p-2 hover:bg-app-bg rounded-xl transition-colors text-app-text-faint hover:text-app-text">
 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
 </button>
 }
 />
 </div>
 )
}