'use client'

import { useState, useEffect, useMemo } from 'react'
import { getCustomerBalances, getSupplierBalances } from '@/app/actions/finance/reports'
import { Users, Briefcase, TrendingUp, TrendingDown, RefreshCw, Search, ArrowUpRight, ArrowDownRight, Scale, Mail, DollarSign } from 'lucide-react'
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from "@/lib/utils/currency"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

type Balance = {
 id: number
 contact?: { id: number; name: string; email?: string }
 contact_name?: string
 balance: number
 credit_limit?: number
 last_transaction_date?: string
 outstanding_invoices?: number
 currency?: string
}

export default function BalancesPage() {
 const { fmt } = useCurrency()
 const [tab, setTab] = useState<'customer' | 'supplier'>('customer')
 const [customers, setCustomers] = useState<Balance[]>([])
 const [suppliers, setSuppliers] = useState<Balance[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('fin_balances', {
 columns: ['contact', 'balance', 'credit_limit', 'last_transaction_date'],
 pageSize: 25, sortKey: 'balance', sortDir: 'desc'
 })

 useEffect(() => {
 loadAll()
 }, [])

 async function loadAll() {
 setLoading(true)
 const [c, s] = await Promise.all([getCustomerBalances(), getSupplierBalances()])
 setCustomers(Array.isArray(c) ? c : (c?.results ?? []))
 setSuppliers(Array.isArray(s) ? s : (s?.results ?? []))
 setLoading(false)
 }

 const data = tab === 'customer' ? customers : suppliers

 const stats = useMemo(() => {
 const total = data.reduce((sum, b) => sum + (Number(b.balance) || 0), 0)
 const active = data.filter(b => (b.balance || 0) !== 0).length
 const totalCredit = data.reduce((sum, b) => sum + (Number(b.credit_limit) || 0), 0)
 return { total, active, totalCredit }
 }, [data])

 const columns: ColumnDef<Balance>[] = useMemo(() => [
 {
 key: 'contact',
 label: 'Business Partner',
 sortable: true,
 render: (b) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center shrink-0">
 <Users size={14} className="text-app-muted-foreground" />
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{b.contact?.name || b.contact_name || '—'}</span>
 {b.contact?.email && (
 <div className="flex items-center gap-1 text-[10px] text-app-muted-foreground font-medium">
 <Mail size={10} />
 {b.contact.email}
 </div>
 )}
 </div>
 </div>
 )
 },
 {
 key: 'balance',
 label: 'Position / Balance',
 align: 'right',
 sortable: true,
 render: (b) => {
 const bal = Number(b.balance || 0)
 return (
 <div className="flex flex-col items-end">
 <span className={`font-mono font-black text-sm ${bal > 0 ? 'text-app-primary' : bal < 0 ? 'text-app-info' : 'text-app-muted-foreground'}`}>
 {fmt(bal)}
 </span>
 <Badge className={`mt-1 border-none shadow-none text-[8px] font-black uppercase px-1.5 py-0 h-4 ${bal > 0 ? 'bg-app-primary-light text-app-primary' : bal < 0 ? 'bg-app-info-bg text-app-info' : 'bg-app-background text-app-muted-foreground'}`}>
 {bal > 0 ? (tab === 'customer' ? 'Payable' : 'Payable') : bal < 0 ? 'Credit' : 'Settled'}
 </Badge>
 </div>
 )
 }
 },
 {
 key: 'credit_limit',
 label: 'Credit Limit',
 align: 'right',
 sortable: true,
 render: (b) => <span className="font-mono text-xs text-app-muted-foreground">{b.credit_limit != null ? fmt(b.credit_limit) : '—'}</span>
 },
 {
 key: 'last_transaction_date',
 label: 'Last Transaction',
 sortable: true,
 render: (b) => <span className="text-xs text-app-muted-foreground font-medium">{b.last_transaction_date || '—'}</span>
 }
 ], [fmt, tab])

 if (loading && data.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <div className="flex justify-between items-center">
 <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
 </div>
 <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 min-h-screen bg-app-surface/30 bg-app-background">
 {/* Standard Header */}
 <header className="flex justify-between items-center">
 <div>
 <h1 className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-info flex items-center justify-center shadow-lg shadow-blue-200">
 <Scale size={28} className="text-app-foreground" />
 </div>
 Account <span className="text-app-info">Balances</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Real-time Financial Positions</p>
 </div>
 <div className="flex bg-app-surface p-1 rounded-2xl shadow-sm border border-app-border">
 <button
 onClick={() => setTab('customer')}
 className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'customer'
 ? 'bg-app-info shadow-lg shadow-blue-200 text-app-foreground'
 : 'text-app-muted-foreground hover:text-app-muted-foreground'
 }`}
 >
 <Users size={16} />
 Customers
 </button>
 <button
 onClick={() => setTab('supplier')}
 className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'supplier'
 ? 'bg-app-warning shadow-lg shadow-amber-200 text-app-foreground'
 : 'text-app-muted-foreground hover:text-app-muted-foreground'
 }`}
 >
 <Briefcase size={16} />
 Suppliers
 </button>
 </div>
 </header>

 {/* Summary Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <TrendingUp size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Net Exposure</p>
 <p className={`text-3xl font-black mt-1 tracking-tighter tabular-nums ${stats.total >= 0 ? 'text-app-primary' : 'text-app-info'}`}>{fmt(stats.total)}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <Briefcase size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Active Accounts</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.active}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Credit Limit</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{fmt(stats.totalCredit)}</p>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} Position Analysis`}
 data={data}
 loading={loading}
 getRowId={(b) => b.id}
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
 <button
 onClick={loadAll}
 className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-app-muted-foreground hover:text-app-foreground transition-colors"
 >
 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
 Reload Data
 </button>
 }
 />
 </div>
 )
}
