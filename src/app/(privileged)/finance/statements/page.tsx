'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 FileText, Search, Users, DollarSign, ShoppingCart,
 CreditCard, BookOpen, ArrowLeft, FileBarChart,
 ChevronRight, Calendar, UserCheck, ShieldCheck,
 RefreshCw, Filter, Mail, Phone, Wallet
} from "lucide-react"
import { getContactStatement } from "@/app/actions/finance/bank-reconciliation"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Input } from "@/components/ui/input"
const TAB_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
 orders: { label: 'Orders', icon: ShoppingCart, color: 'text-app-info' },
 payments: { label: 'Payments', icon: CreditCard, color: 'text-purple-600' },
 journal: { label: 'Journal', icon: BookOpen, color: 'text-app-muted-foreground' },
}
export default function StatementsPage() {
 const { fmt } = useCurrency()
 const [contacts, setContacts] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [selectedContact, setSelectedContact] = useState<any | null>(null)
 const [detail, setDetail] = useState<any | null>(null)
 const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'journal'>('orders')
 const settings = useListViewSettings('fin_statements', {
 columns: ['name', 'type', 'phone', 'actions'],
 pageSize: 25, sortKey: 'name', sortDir: 'asc'
 })
 useEffect(() => { loadContacts() }, [])
 async function loadContacts() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('crm/contacts/')
 const list = Array.isArray(data) ? data : data.results || []
 setContacts(list)
 } catch {
 toast.error("Failed to load contacts")
 } finally {
 setLoading(false)
 }
 }
 async function viewStatement(contact: any) {
 setLoading(true)
 setSelectedContact(contact)
 try {
 const data = await getContactStatement(contact.id)
 setDetail(data)
 } catch {
 toast.error("Failed to load statement")
 } finally {
 setLoading(false)
 }
 }
 const filteredContacts = useMemo(() => {
 if (!search) return contacts
 const s = search.toLowerCase()
 return contacts.filter((c: any) =>
 (c.name || "").toLowerCase().includes(s) ||
 (c.phone || "").toLowerCase().includes(s) ||
 (c.email || "").toLowerCase().includes(s)
 )
 }, [contacts, search])
 const contactColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'name',
 label: 'Contact Name',
 sortable: true,
 render: (c) => (
 <div className="app-page flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-primary/5 text-app-primary flex items-center justify-center font-black text-xs">
 {c.name?.charAt(0) || '?'}
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground">{c.name}</span>
 <span className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-tight">{c.email || 'No email'}</span>
 </div>
 </div>
 )
 },
 {
 key: 'type',
 label: 'Entity Type',
 sortable: true,
 render: (c) => (
 <Badge className={`${c.type === 'CUSTOMER' ? 'bg-app-info-bg text-app-info' : 'bg-app-warning-bg text-app-warning'} border-none h-5 text-[10px] font-black uppercase px-2 rounded-lg`}>
 {c.type}
 </Badge>
 )
 },
 {
 key: 'phone',
 label: 'Direct Line',
 hideMobile: true,
 render: (c) => <span className="text-app-muted-foreground font-medium text-xs">{c.phone || '—'}</span>
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (c) => (
 <Button variant="ghost" size="sm" onClick={() => viewStatement(c)} className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-app-primary hover:bg-app-primary/5 gap-1.5 transition-all">
 Analyze <ChevronRight size={14} />
 </Button>
 )
 }
 ], [])
 const orderColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'date',
 label: 'Order Date',
 sortable: true,
 render: (o) => <span className="text-app-foreground font-bold text-xs">{o.date || '—'}</span>
 },
 {
 key: 'ref_code',
 label: 'Reference',
 render: (o) => <span className="font-mono text-[11px] text-app-muted-foreground">{o.ref_code || `#${o.id}`}</span>
 },
 {
 key: 'type',
 label: 'Service',
 render: (o) => <Badge variant="outline" className="h-5 text-[9px] font-black uppercase rounded-lg">{o.type}</Badge>
 },
 {
 key: 'status',
 label: 'State',
 render: (o) => <span className="text-[10px] text-app-muted-foreground font-black uppercase">{o.status}</span>
 },
 {
 key: 'total',
 label: 'Amount',
 align: 'right',
 render: (o) => <span className="font-black text-app-foreground text-xs">{fmt(o.total || 0)}</span>
 }
 ], [fmt])
 const paymentColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'date',
 label: 'Settlement Date',
 sortable: true,
 render: (p) => <span className="text-app-foreground font-bold text-xs">{p.date || '—'}</span>
 },
 {
 key: 'reference',
 label: 'Payment Ref',
 render: (p) => <span className="font-mono text-[11px] text-app-primary">{p.reference || '—'}</span>
 },
 {
 key: 'type',
 label: 'Method',
 render: (p) => <Badge variant="outline" className="h-5 text-[9px] font-black uppercase rounded-lg">{p.type}</Badge>
 },
 {
 key: 'amount',
 label: 'Amount',
 align: 'right',
 render: (p) => <span className="font-black text-app-primary text-xs">{fmt(p.amount || 0)}</span>
 }
 ], [fmt])
 const journalColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'date',
 label: 'Posting Date',
 sortable: true,
 render: (j) => <span className="text-app-foreground font-bold text-xs">{j.date || '—'}</span>
 },
 {
 key: 'reference',
 label: 'JV Reference',
 render: (j) => <span className="font-mono text-[11px] text-app-muted-foreground">{j.reference || '—'}</span>
 },
 {
 key: 'description',
 label: 'Narrative',
 render: (j) => <span className="text-xs text-app-muted-foreground font-medium truncate max-w-[150px] inline-block">{j.description}</span>
 },
 {
 key: 'account',
 label: 'Ledger Post',
 render: (j) => <span className="text-[10px] text-app-primary font-black uppercase">{j.account}</span>
 },
 {
 key: 'debit',
 label: 'Debit',
 align: 'right',
 render: (j) => <span className="font-black text-app-primary font-mono text-xs">{j.debit > 0 ? fmt(j.debit) : ''}</span>
 },
 {
 key: 'credit',
 label: 'Credit',
 align: 'right',
 render: (j) => <span className="font-black text-rose-600 font-mono text-xs">{j.credit > 0 ? fmt(j.credit) : ''}</span>
 }
 ], [fmt])
 if (loading && !detail && contacts.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }
 // Detail View
 if (selectedContact && detail) {
 const balance = Number(detail.balance?.amount || 0)
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <FileText size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Financial <span className="text-app-primary">Statements</span>
          </h1>
        </div>
      </div>
    </header>
 {/* KPI Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary/5 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <ShoppingCart size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Activity Vol.</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{detail.stats?.order_count || 0}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">Confirmed Orders</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Revenue</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-primary">{fmt(detail.stats?.total_revenue || 0)}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Lifetime Value</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <CreditCard size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Paid</p>
 <p className="text-xl font-black mt-1 tracking-tight text-purple-600">{fmt(detail.stats?.total_paid || 0)}</p>
 <p className="text-[10px] text-purple-600 font-bold uppercase mt-1">Settled Txs</p>
 </div>
 </CardContent>
 </Card>
 <Card className={`rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group border-r-4 ${balance > 0 ? 'border-r-rose-400' : 'border-r-emerald-400'}`}>
 <CardContent className="p-6 flex items-center gap-5">
 <div className={`w-16 h-16 rounded-[1.5rem] ${balance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-app-primary-light text-app-primary'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
 <Wallet size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Current Balance</p>
 <p className={`text-xl font-black mt-1 tracking-tight ${balance > 0 ? 'text-rose-600' : 'text-app-primary'}`}>{fmt(balance)}</p>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mt-1">{balance > 0 ? 'Receivable' : 'No Overdue'}</p>
 </div>
 </CardContent>
 </Card>
 </div>
 {/* Sub-Navigation Tabs */}
 <div className="flex items-center gap-2 bg-app-surface-2 p-1.5 rounded-2xl w-fit border border-app-border shadow-inner">
 {(['orders', 'payments', 'journal'] as const).map(tab => {
 const tc = TAB_CONFIG[tab]
 const Icon = tc.icon
 return (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={`h-10 px-6 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-app-surface text-app-foreground shadow-lg' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 <Icon size={14} className={activeTab === tab ? tc.color : ''} />
 {tc.label}
 </button>
 )
 })}
 </div>
 {/* Tab Content Tables */}
 <TypicalListView
 title={TAB_CONFIG[activeTab].label}
 data={activeTab === 'orders' ? (detail.orders || []) : activeTab === 'payments' ? (detail.payments || []) : (detail.journal || [])}
 loading={loading}
 getRowId={(item) => item.id || ''}
 columns={activeTab === 'orders' ? orderColumns : activeTab === 'payments' ? paymentColumns : journalColumns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 />
 </div>
 )
 }
 // Contact List View
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-indigo-200">
 <FileBarChart size={28} className="text-app-foreground" />
 </div>
 Constituent <span className="text-app-primary">Financial Hub</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Global Account Analysis & Statements</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative w-72">
 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <Input
 placeholder="Find constituent by name or email..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="h-12 pl-11 rounded-2xl bg-app-surface border-app-border shadow-sm focus-visible:ring-app-primary"
 />
 </div>
 <Button onClick={loadContacts} variant="ghost" className="h-12 w-12 rounded-2xl text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5">
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </Button>
 </div>
 </header>
 <TypicalListView
 title="Entity Roster"
 data={filteredContacts}
 loading={loading}
 getRowId={(c) => c.id}
 columns={contactColumns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 headerExtra={
 <div className="flex items-center gap-2 px-3 py-1.5 bg-app-surface-2 rounded-xl border border-app-border">
 <UserCheck size={14} className="text-app-muted-foreground" />
 <span className="text-[10px] font-black uppercase text-app-muted-foreground">Verified CRM Feed</span>
 </div>
 }
 />
 </div>
 )
}
