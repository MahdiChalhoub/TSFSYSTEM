'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { FinancialAccount } from '@/types/erp'
import { getBankAccounts, getBankReconciliation } from "@/app/actions/finance/bank-reconciliation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Landmark, ArrowLeft, Search, DollarSign,
    ArrowUpRight, ArrowDownRight, Hash, FileText,
    Calendar, Building, RefreshCw, ChevronRight,
    ShieldCheck, Wallet, Landmark as BankIcon
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
export default function BankReconciliationPage() {
    const { fmt } = useCurrency()
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [detail, setDetail] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const settings = useListViewSettings('fin_bank_recon', {
        columns: ['code', 'name', 'entry_count', 'book_balance', 'actions'],
        pageSize: 25, sortKey: 'name', sortDir: 'asc'
    })
    const [endDate, setEndDate] = useState('')
    useEffect(() => { loadAccounts() }, [])
    async function loadAccounts() {
        setLoading(true)
        try {
            const data = await getBankAccounts()
            setAccounts(data.accounts || [])
        } catch {
            toast.error("Failed to load bank accounts")
        } finally {
            setLoading(false)
        }
    }
    async function drillIn(accountId: string) {
        setLoading(true)
        setSelectedAccountId(accountId)
        try {
            const data = await getBankReconciliation(accountId, startDate || undefined, endDate || undefined)
            setDetail(data)
        } catch {
            toast.error("Failed to load account entries")
        } finally {
            setLoading(false)
        }
    }
    function goBack() {
        setSelectedAccountId(null)
        setDetail(null)
        setSearch('')
    }
    const accountColumns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'code',
            label: 'Account Code',
            width: '120px',
            render: (acc) => <Badge variant="outline" className="font-mono text-[10px] h-5 rounded-lg">{acc.code}</Badge>
        },
        {
            key: 'name',
            label: 'Bank Account Name',
            sortable: true,
            render: (acc) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                        <BankIcon size={14} />
                    </div>
                    <span className="font-bold text-gray-900">{acc.name}</span>
                </div>
            )
        },
        {
            key: 'entry_count',
            label: 'Activity',
            align: 'center',
            render: (acc) => <span className="text-[10px] text-gray-400 font-bold uppercase">{acc.entry_count} Entries</span>
        },
        {
            key: 'book_balance',
            label: 'Ledger Balance',
            align: 'right',
            render: (acc) => <span className="font-black text-blue-700 text-xs">{fmt(acc.book_balance)}</span>
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            render: (acc) => (
                <Button variant="ghost" size="sm" onClick={() => drillIn(acc.id)} className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 gap-1.5 transition-all">
                    Reconcile <ChevronRight size={14} />
                </Button>
            )
        }
    ], [fmt])
    const entryColumns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'date',
            label: 'Posting Date',
            sortable: true,
            render: (e) => <span className="text-gray-900 font-bold text-xs">{e.date || '—'}</span>
        },
        {
            key: 'reference',
            label: 'Bank Reference',
            render: (e) => <span className="font-mono text-[11px] text-indigo-600">{e.reference || '—'}</span>
        },
        {
            key: 'description',
            label: 'Narrative',
            render: (e) => <span className="text-xs text-stone-500 font-medium line-clamp-1">{e.description}</span>
        },
        {
            key: 'debit',
            label: 'Debit (+)',
            align: 'right',
            render: (e) => <span className="font-black text-emerald-600 font-mono text-xs">{e.debit > 0 ? fmt(e.debit) : ''}</span>
        },
        {
            key: 'credit',
            label: 'Credit (-)',
            align: 'right',
            render: (e) => <span className="font-black text-rose-600 font-mono text-xs">{e.credit > 0 ? fmt(e.credit) : ''}</span>
        },
        {
            key: 'running_balance',
            label: 'Dynamic Bal.',
            align: 'right',
            render: (e) => <span className="font-black text-gray-900 font-mono text-xs">{fmt(e.running_balance)}</span>
        }
    ], [fmt])
    if (loading && !detail && accounts.length === 0) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }
    // Detail View
    if (selectedAccountId && detail) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <header className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goBack}
                            className="h-12 w-12 rounded-2xl text-stone-400 hover:text-gray-900 transition-all hover:bg-stone-50 border border-transparent hover:border-stone-100"
                        >
                            <ArrowLeft size={18} />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter text-gray-900">
                                {detail.account?.code} — {detail.account?.name}
                            </h1>
                            <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">Settlement Detail & Audit Log</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-black uppercase flex items-center gap-1 h-6">
                        <ShieldCheck size={12} /> Live Reconciliation Active
                    </Badge>
                </header>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ArrowDownRight size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Debits</p>
                                <p className="text-xl font-black mt-1 tracking-tight text-emerald-600">{fmt(detail.summary?.total_debit || 0)}</p>
                                <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Inflow Value</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ArrowUpRight size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Credits</p>
                                <p className="text-xl font-black mt-1 tracking-tight text-rose-600">{fmt(detail.summary?.total_credit || 0)}</p>
                                <p className="text-[10px] text-rose-600 font-bold uppercase mt-1">Outflow Value</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Wallet size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Settled Bal.</p>
                                <p className="text-xl font-black mt-1 tracking-tight text-blue-700">{fmt(detail.summary?.book_balance || 0)}</p>
                                <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Closing Ledger</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6 flex items-center gap-5">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-stone-50 text-stone-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Hash size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Entry Count</p>
                                <p className="text-3xl font-black mt-1 tracking-tighter text-stone-900">{detail.summary?.entry_count || 0}</p>
                                <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">Audit Record</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                {/* Filter Controls */}
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-3 bg-stone-50 px-4 py-2 rounded-2xl border border-stone-100">
                            <Calendar size={16} className="text-stone-400" />
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 h-8 bg-transparent border-0 font-bold text-xs" />
                            <span className="text-stone-300">to</span>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 h-8 bg-transparent border-0 font-bold text-xs" />
                        </div>
                        <Button onClick={() => drillIn(selectedAccountId)} className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase shadow-md shadow-blue-100">
                            Apply Horizon
                        </Button>
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Filter results by narration or reference..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-10 pl-11 rounded-xl bg-stone-50 border-0 focus-visible:ring-blue-500/30 text-xs font-medium"
                            />
                        </div>
                    </CardContent>
                </Card>
                <TypicalListView
                    title="Audit Settlement Log"
                    data={detail.entries || []}
                    loading={loading}
                    getRowId={(e) => e.id}
                    columns={entryColumns}
                    className="rounded-3xl border-0 shadow-sm overflow-hidden"
                    visibleColumns={settings.visibleColumns}
                    onToggleColumn={settings.toggleColumn}
                    pageSize={settings.pageSize}
                    onPageSizeChange={settings.setPageSize}
                    sortKey={settings.sortKey}
                    sortDir={settings.sortDir}
                    onSort={settings.setSort}
                    compact
                />
            </div>
        )
    }
    // Account List View
    const totalBalance = accounts.reduce((sum, a) => sum + (a.book_balance || 0), 0)
    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                            <Building size={28} className="text-white" />
                        </div>
                        Liquidity <span className="text-blue-600">Settlement</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Bank & Cash Reconciliation Engine</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Direct Bank Feed Active</span>
                </div>
            </header>
            {/* Aggregate Exposure */}
            <Card className="rounded-[2.5rem] border-0 shadow-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
                    <Landmark size={120} />
                </div>
                <CardContent className="p-8 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <p className="text-blue-200 text-xs font-black uppercase tracking-[0.2em]">Total Market Exposure</p>
                        <h2 className="text-5xl font-black mt-2 tracking-tighter">{fmt(totalBalance)}</h2>
                        <div className="flex items-center gap-2 mt-4">
                            <Badge className="bg-blue-800 text-blue-200 border-none font-black text-[10px] px-3">{accounts.length} ACTIVE CHANNELS</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <TypicalListView
                title="Monetary Channels"
                data={accounts}
                loading={loading}
                getRowId={(acc) => acc.id}
                columns={accountColumns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                headerExtra={
                    <Button onClick={loadAccounts} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-blue-600">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                }
            />
        </div>
    )
}
