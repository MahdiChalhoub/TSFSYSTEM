'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getLedgerEntries, getLedgerUsers } from '@/app/actions/finance/ledger'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { LedgerEntryActions } from './ledger-actions'
import { useAdmin } from '@/context/AdminContext'
import { useCurrency } from '@/lib/utils/currency'
import Link from 'next/link'
import {
 Search, Filter, Calendar, BookOpen, ChevronDown,
 Plus, History, ShieldCheck, Wallet, FileText,
 ArrowUpRight, ArrowDownRight, Hash, X, Activity,
 TrendingUp, RefreshCw
} from 'lucide-react'
import { TypicalListView, ColumnDef } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const STATUS_OPTIONS = [
 { value: 'ALL', label: 'All Status' },
 { value: 'DRAFT', label: 'Draft' },
 { value: 'POSTED', label: 'Posted' },
 { value: 'REVERSED', label: 'Reversed' },
]

export default function GeneralLedgerPage() {
 const { fmt } = useCurrency()
 const [entries, setEntries] = useState<any[]>([])
 const [fiscalYears, setFiscalYears] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('fin_ledger', {
 columns: ['id', 'transactionDate', 'reference', 'description', 'amount', 'balance', 'status', 'actions'],
 pageSize: 25, sortKey: 'transactionDate', sortDir: 'desc'
 })

 // Filters
 const [status, setStatus] = useState('ALL')
 const [fiscalYear, setFiscalYear] = useState('ALL')
 const [dateFrom, setDateFrom] = useState('')
 const [dateTo, setDateTo] = useState('')
 const [entryType, setEntryType] = useState('ALL')
 const [verified, setVerified] = useState('ALL')
 const [locked, setLocked] = useState('ALL')
 const [user, setUser] = useState('ALL')
 const [autoSource, setAutoSource] = useState('ALL')
 const [search, setSearch] = useState('')
 const [showFilters, setShowFilters] = useState(false)
 const [users, setUsers] = useState<any[]>([])
 const { viewScope } = useAdmin()

 const loadEntries = useCallback(async () => {
 setLoading(true)
 try {
 const data = await getLedgerEntries(viewScope, {
 status: status === 'ALL' ? undefined : status,
 fiscal_year: fiscalYear === 'ALL' ? undefined : fiscalYear,
 date_from: dateFrom || undefined,
 date_to: dateTo || undefined,
 entry_type: entryType === 'ALL' ? undefined : entryType,
 verified: verified === 'ALL' ? undefined : verified,
 locked: locked === 'ALL' ? undefined : locked,
 user: user === 'ALL' ? undefined : user,
 auto_source: autoSource === 'ALL' ? undefined : autoSource,
 q: search || undefined,
 })
 setEntries(data)
 } catch (e) {
 console.error(e)
 } finally {
 setLoading(false)
 }
 }, [status, fiscalYear, dateFrom, dateTo, entryType, verified, locked, user, autoSource, search, viewScope])

 useEffect(() => {
 getFiscalYears().then(setFiscalYears).catch(() => { })
 getLedgerUsers().then(setUsers).catch(() => { })
 }, [])

 useEffect(() => {
 loadEntries()
 }, [loadEntries])

 const activeFilterCount = [
 status !== 'ALL',
 fiscalYear !== 'ALL',
 dateFrom,
 dateTo,
 entryType !== 'ALL',
 verified !== 'ALL',
 locked !== 'ALL',
 user !== 'ALL',
 autoSource !== 'ALL',
 search
 ].filter(Boolean).length

 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'id',
 label: 'JV ID',
 width: '80px',
 render: (e) => <span className="font-black text-emerald-600">#{e.id}</span>
 },
 {
 key: 'transactionDate',
 label: 'Posting Date',
 sortable: true,
 render: (e) => (
 <div className="flex flex-col">
 <span className="font-bold text-app-text">{e.transactionDate ? new Date(e.transactionDate).toLocaleDateString('en-GB') : '—'}</span>
 {e.fiscalYear && <span className="text-[10px] text-app-text-faint font-bold uppercase">{e.fiscalYear.name || `FY ${e.fiscalYear.id}`}</span>}
 </div>
 )
 },
 {
 key: 'reference',
 label: 'Reference',
 render: (e) => <span className="font-mono text-[11px] font-black text-app-text-muted bg-app-bg px-2 py-1 rounded-lg border border-app-border">{e.reference || '—'}</span>
 },
 {
 key: 'description',
 label: 'Narrative / Description',
 render: (e) => (
 <div className="flex flex-col py-1">
 <span className="font-bold text-app-text line-clamp-1">{e.description}</span>
 <div className="flex items-center gap-2 mt-1.5">
 {e.reference?.startsWith('OPEN-') && (
 <Badge className="bg-emerald-50 text-emerald-700 border-none h-5 text-[9px] font-black uppercase px-2 shadow-inner">Opening</Badge>
 )}
 {e.reversalOf && (
 <Badge className="bg-rose-50 text-rose-700 border-none h-5 text-[9px] font-black uppercase px-2 shadow-inner font-mono">↩ Reversal of #{e.reversalOf.id}</Badge>
 )}
 {e.reversedBy && (
 <Badge className="bg-amber-50 text-amber-700 border-none h-5 text-[9px] font-black uppercase px-2 shadow-inner font-mono">⚠ Reversed by #{e.reversedBy.id}</Badge>
 )}
 {/* Apple Minimalist Touch - small visual indicators */}
 {e.status === 'POSTED' && !e.reversalOf && !e.reversedBy && !e.reference?.startsWith('OPEN-') && (
 <div className="flex items-center gap-1.5 bg-app-bg border border-app-border px-2 h-5 rounded-full">
 <Activity size={10} className="text-emerald-500" />
 <span className="text-[8px] font-black uppercase text-app-text-faint tracking-widest">Logged</span>
 </div>
 )}
 </div>
 </div>
 )
 }
 ], [])

 const expandable: any = useMemo(() => ({
 getDetails: (e: any) => e.lines || [],
 columns: [
 {
 key: 'account_code',
 label: 'Code',
 render: (l: any) => <span className="font-mono text-[10px] text-app-text-faint bg-app-surface px-1.5 py-0.5 rounded shadow-sm border border-app-border">{l.account?.code}</span>
 },
 {
 key: 'account_name',
 label: 'Financial Vector',
 render: (l: any) => <span className="font-black text-slate-700 text-xs">{l.account?.name}</span>
 },
 {
 key: 'debit',
 label: 'Debit (Inflow)',
 align: 'right',
 render: (l: any) => <span className="font-black text-emerald-600 font-mono text-xs bg-emerald-50/50 px-2 py-1 rounded-lg">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : ''}</span>
 },
 {
 key: 'credit',
 label: 'Credit (Outflow)',
 align: 'right',
 render: (l: any) => <span className="font-black text-rose-500 font-mono text-xs bg-rose-50/50 px-2 py-1 rounded-lg">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ''}</span>
 }
 ],
 headerColor: 'bg-slate-50/80 backdrop-blur-sm',
 headerTextColor: 'text-app-text-muted tracking-widest uppercase font-black text-[10px]',
 borderColor: 'border-slate-100/50'
 }), [fmt])

 return (
 <div className="page-container animate-in fade-in duration-700 relative">
 <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-emerald-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
 <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-indigo-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

 <header className="flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
 <BookOpen size={40} className="text-app-text fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
 System: Online
 </Badge>
 <span className="text-[10px] font-black text-app-text-faint uppercase tracking-[0.2em] flex items-center gap-2">
 <ShieldCheck size={14} className="text-emerald-400" /> Trial Balance Guard
 </span>
 </div>
 <h1 className="page-header-title">
 Master <span className="text-emerald-700">Ledger</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Enterprise financial logs, vectors, and immutable entries.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <Button asChild variant="outline" className="h-14 px-8 rounded-2xl bg-app-text/60 backdrop-blur-xl border border-app-text/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-app-text-muted flex items-center gap-3 hover:bg-app-surface hover:text-app-text transition-all active:scale-95">
 <Link href="/finance/ledger/opening/list">
 <Wallet size={18} className="text-emerald-500" /> Opening Balances
 </Link>
 </Button>
 <Button asChild className="h-14 px-8 rounded-2xl bg-slate-900 border-0 shadow-[0_8px_30px_rgb(0,0,0,0.12)] font-black text-[11px] uppercase tracking-widest text-app-text flex items-center gap-3 hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95 group">
 <Link href="/finance/ledger/new">
 <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Plus size={14} className="text-emerald-400" />
 </div>
 Force Journal Entry
 </Link>
 </Button>
 </div>
 </div>
 </header>

 <Tabs value={entryType} onValueChange={setEntryType} className="space-y-6">
 <div className="flex justify-between items-center">
 <TabsList className="bg-app-text/60 backdrop-blur-xl border border-app-text/40 shadow-sm p-2 rounded-3xl h-14">
 <TabsTrigger value="ALL" className="rounded-2xl font-black text-[11px] uppercase tracking-widest px-8 h-full data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all">Global Feed</TabsTrigger>
 <TabsTrigger value="MANUAL" className="rounded-2xl font-black text-[11px] uppercase tracking-widest px-8 h-full data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm transition-all">Manual Interventions</TabsTrigger>
 <TabsTrigger value="AUTO" className="rounded-2xl font-black text-[11px] uppercase tracking-widest px-8 h-full data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 data-[state=active]:shadow-sm transition-all">Bot Activity</TabsTrigger>
 </TabsList>
 </div>

 {/* Apple Minimalist Glassmorphic Filter Bar */}
 <Card className="rounded-[2rem] border border-app-text/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-app-text/60 backdrop-blur-2xl overflow-visible">
 <CardContent className="p-4 space-y-4">
 <div className="flex items-center gap-4">
 <div className="relative flex-1 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-app-text-faint group-focus-within:text-emerald-500 transition-colors" />
 <Input
 placeholder="Search semantic references or narrative blocks..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="pl-12 h-14 rounded-2xl bg-app-text/50 border border-app-border shadow-inner focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/30 text-sm font-bold placeholder:text-app-text-faint placeholder:font-medium transition-all"
 />
 </div>
 <Select value={status} onValueChange={setStatus}>
 <SelectTrigger className="w-56 h-14 rounded-2xl bg-app-text/50 border border-app-border shadow-inner text-sm font-black text-app-text-muted focus:ring-emerald-500/20">
 <SelectValue placeholder="All Status" />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border border-app-border shadow-2xl bg-app-text/90 backdrop-blur-xl">
 {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="rounded-xl font-bold hover:bg-app-bg focus:bg-app-bg cursor-pointer my-0.5">{o.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Button
 variant="ghost"
 onClick={() => setShowFilters(!showFilters)}
 className={`h-14 px-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] gap-3 transition-all ${showFilters || activeFilterCount > 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm' : 'bg-app-text/50 border border-app-border text-app-text-muted shadow-sm hover:bg-app-surface hover:border-app-border'}`}
 >
 <Filter size={16} /> Filters
 {activeFilterCount > 1 && <Badge className="bg-emerald-500 text-app-text h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-lg shadow-sm">{activeFilterCount}</Badge>}
 </Button>
 </div>
 {showFilters && (
 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 p-6 rounded-3xl bg-app-text/40 border border-app-text/60 shadow-inner animate-in slide-in-from-top-4 duration-500 mt-4">
 <div className="space-y-3">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1">Time Horizon</label>
 <Select value={fiscalYear} onValueChange={setFiscalYear}>
 <SelectTrigger className="h-12 rounded-2xl border-white bg-app-text/80 shadow-sm text-xs font-bold focus:ring-emerald-500/20">
 <SelectValue placeholder="All Years" />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-0 shadow-2xl bg-app-text/95 backdrop-blur-xl p-1">
 <SelectItem value="ALL" className="rounded-xl font-bold">All Horizons</SelectItem>
 {fiscalYears.map((fy: any) => <SelectItem key={fy.id} value={String(fy.id)} className="rounded-xl font-bold">{fy.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-3 lg:col-span-2">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1">Chronological Window</label>
 <div className="flex items-center gap-3">
 <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-12 rounded-2xl border-white bg-app-text/80 shadow-sm text-xs font-bold w-full focus:ring-emerald-500/20" />
 <span className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">to</span>
 <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-12 rounded-2xl border-white bg-app-text/80 shadow-sm text-xs font-bold w-full focus:ring-emerald-500/20" />
 </div>
 </div>
 <div className="space-y-3">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1">Initiator</label>
 <Select value={user} onValueChange={setUser}>
 <SelectTrigger className="h-12 rounded-2xl border-white bg-app-text/80 shadow-sm text-xs font-bold focus:ring-emerald-500/20">
 <SelectValue placeholder="All Entities" />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-0 shadow-2xl bg-app-text/95 backdrop-blur-xl p-1">
 <SelectItem value="ALL" className="rounded-xl font-bold">All Entities</SelectItem>
 {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)} className="rounded-xl font-bold">{u.first_name || u.username}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 {(entryType === 'ALL' || entryType === 'AUTO') && (
 <div className="space-y-3">
 <label className="text-[10px] font-black text-app-text-faint uppercase tracking-widest ml-1">Algorithmic Source</label>
 <Select value={autoSource} onValueChange={setAutoSource}>
 <SelectTrigger className="h-12 rounded-2xl border-white bg-app-text/80 shadow-sm text-xs font-bold focus:ring-emerald-500/20">
 <SelectValue placeholder="All Sources" />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-0 shadow-2xl bg-app-text/95 backdrop-blur-xl p-1">
 <SelectItem value="ALL" className="rounded-xl font-bold">All Systems</SelectItem>
 <SelectItem value="INVOICE" className="rounded-xl font-bold">Invoicing Engine</SelectItem>
 <SelectItem value="PAYMENT" className="rounded-xl font-bold">Payment Gateway</SelectItem>
 <SelectItem value="RETURN" className="rounded-xl font-bold">Return Handler</SelectItem>
 <SelectItem value="PAYROLL" className="rounded-xl font-bold">HR Core</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}
 <div className="flex items-end justify-end pb-1 lg:col-span-full mt-2">
 <Button
 variant="ghost"
 onClick={() => { setStatus('ALL'); setFiscalYear('ALL'); setDateFrom(''); setDateTo(''); setEntryType('ALL'); setVerified('ALL'); setLocked('ALL'); setUser('ALL'); setAutoSource('ALL'); setSearch('') }}
 className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-app-text-faint hover:text-rose-500 hover:bg-rose-50/50 gap-2 transition-all"
 >
 <X size={14} /> Clear Active Filters
 </Button>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 <Card className="rounded-[2.5rem] border border-app-text/60 shadow-2xl shadow-slate-900/5 overflow-hidden bg-app-text/80 backdrop-blur-3xl">
 <TypicalListView
 data={entries}
 loading={loading}
 getRowId={(e) => e.id}
 columns={columns}
 expandable={expandable}
 lifecycle={{
 getStatus: (e) => {
 if (e.status === 'POSTED') return { label: 'Posted', variant: 'success' }
 if (e.status === 'REVERSED') return { label: 'Reversed', variant: 'danger' }
 return { label: 'Draft', variant: 'warning' }
 }
 }}
 actions={{
 extra: (e) => {
 const isLocked = e.fiscalYear?.status === 'LOCKED' || e.fiscalYear?.isLocked
 return (
 <LedgerEntryActions
 entryId={e.id}
 status={e.status}
 isLocked={isLocked}
 />
 )
 }
 }}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="border-0 bg-transparent shadow-none"
 />
 </Card>
 </Tabs>
 </div>
 )
}