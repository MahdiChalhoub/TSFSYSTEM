'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getLedgerEntries } from '@/app/actions/finance/ledger'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { LedgerEntryActions } from './ledger-actions'
import { useCurrency } from '@/lib/utils/currency'
import Link from 'next/link'
import {
    Search, Filter, Calendar, BookOpen, ChevronDown,
    Plus, History, ShieldCheck, Wallet, FileText,
    ArrowUpRight, ArrowDownRight, Hash, X
} from 'lucide-react'
import { TypicalListView, ColumnDef } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'POSTED', label: 'Posted' },
    { value: 'REVERSED', label: 'Reversed' },
]

const TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Types' },
    { value: 'OPENING', label: 'Opening Balances' },
    { value: 'MANUAL', label: 'Manual Entries' },
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
    const [search, setSearch] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const loadEntries = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getLedgerEntries('INTERNAL', {
                status: status === 'ALL' ? undefined : status,
                fiscal_year: fiscalYear === 'ALL' ? undefined : fiscalYear,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                entry_type: entryType === 'ALL' ? undefined : entryType,
                q: search || undefined,
            })
            setEntries(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [status, fiscalYear, dateFrom, dateTo, entryType, search])

    useEffect(() => {
        getFiscalYears().then(setFiscalYears).catch(() => { })
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
        search
    ].filter(Boolean).length

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'id',
            label: 'JV ID',
            width: '80px',
            render: (e) => <span className="font-black text-indigo-600">#{e.id}</span>
        },
        {
            key: 'transactionDate',
            label: 'Posting Date',
            sortable: true,
            render: (e) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{e.transactionDate ? new Date(e.transactionDate).toLocaleDateString('en-GB') : '—'}</span>
                    {e.fiscalYear && <span className="text-[10px] text-gray-400 font-bold uppercase">{e.fiscalYear.name || `FY ${e.fiscalYear.id}`}</span>}
                </div>
            )
        },
        {
            key: 'reference',
            label: 'Reference',
            render: (e) => <span className="font-mono text-[11px] text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{e.reference || '—'}</span>
        },
        {
            key: 'description',
            label: 'Narrative / Description',
            render: (e) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-800 line-clamp-1">{e.description}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        {e.reference?.startsWith('OPEN-') && (
                            <Badge className="bg-blue-50 text-blue-700 border-none h-4 text-[9px] font-black uppercase px-1.5">Opening</Badge>
                        )}
                        {e.reversalOf && (
                            <Badge className="bg-rose-50 text-rose-700 border-none h-4 text-[9px] font-black uppercase px-1.5 font-mono">↩ Reversal of #{e.reversalOf.id}</Badge>
                        )}
                        {e.reversedBy && (
                            <Badge className="bg-amber-50 text-amber-700 border-none h-4 text-[9px] font-black uppercase px-1.5 font-mono">⚠ Reversed by #{e.reversedBy.id}</Badge>
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
                render: (l: any) => <span className="font-mono text-[10px] text-gray-400">{l.account?.code}</span>
            },
            {
                key: 'account_name',
                label: 'Financial Account',
                render: (l: any) => <span className="font-bold text-gray-700 text-xs">{l.account?.name}</span>
            },
            {
                key: 'debit',
                label: 'Debit',
                align: 'right',
                render: (l: any) => <span className="font-black text-emerald-600 font-mono text-xs">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : ''}</span>
            },
            {
                key: 'credit',
                label: 'Credit',
                align: 'right',
                render: (l: any) => <span className="font-black text-rose-600 font-mono text-xs">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ''}</span>
            }
        ],
        headerColor: 'bg-stone-50',
        headerTextColor: 'text-stone-500',
        borderColor: 'border-stone-100'
    }), [fmt])

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-stone-50 text-stone-600 border-stone-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            System Node: Integrity Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <ShieldCheck size={12} /> Trial Balance Guard
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-stone-900 flex items-center justify-center shadow-2xl shadow-stone-200">
                            <BookOpen size={32} className="text-white" />
                        </div>
                        General <span className="text-indigo-600">Ledger</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <Button asChild variant="outline" className="h-12 px-6 rounded-2xl border-stone-100 font-bold text-gray-600 flex items-center gap-2 hover:bg-stone-50 transition-all">
                        <Link href="/finance/ledger/opening/list" className="flex items-center gap-2">
                            <Wallet size={18} /> Opening Balances
                        </Link>
                    </Button>
                    <Button asChild className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                        <Link href="/finance/ledger/new" className="flex items-center gap-2">
                            <Plus size={18} /> New Journal Entry
                        </Link>
                    </Button>
                </div>
            </header>

            {/* Enhanced Filter Bar */}
            <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search JV narrative or reference..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-11 rounded-2xl bg-stone-50 border-0 focus-visible:ring-indigo-500/30"
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-48 h-11 rounded-2xl bg-stone-50 border-0 text-sm font-bold">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-0 shadow-xl">
                                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="rounded-xl">{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="ghost"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-11 px-4 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2 transition-all ${showFilters || activeFilterCount > 1 ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'text-gray-400 hover:bg-stone-50 hover:text-gray-900'}`}
                        >
                            <Filter size={16} /> Filters
                            {activeFilterCount > 1 && <Badge className="bg-indigo-600 text-white h-4 w-4 p-0 flex items-center justify-center text-[8px]">{activeFilterCount}</Badge>}
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-4 gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fiscal Year</label>
                                <Select value={fiscalYear} onValueChange={setFiscalYear}>
                                    <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white text-xs font-bold">
                                        <SelectValue placeholder="All Years" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-0 shadow-xl">
                                        <SelectItem value="ALL">All Years</SelectItem>
                                        {fiscalYears.map((fy: any) => <SelectItem key={fy.id} value={String(fy.id)}>{fy.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date Range</label>
                                <div className="flex items-center gap-2">
                                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 rounded-xl border-stone-200 bg-white text-xs font-bold" />
                                    <span className="text-stone-300">to</span>
                                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 rounded-xl border-stone-200 bg-white text-xs font-bold" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Entry Type</label>
                                <Select value={entryType} onValueChange={setEntryType}>
                                    <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white text-xs font-bold">
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-0 shadow-xl">
                                        {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end justify-end pb-1">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setStatus('ALL'); setFiscalYear('ALL'); setDateFrom(''); setDateTo(''); setEntryType('ALL'); setSearch('') }}
                                    className="h-8 text-[9px] font-black uppercase text-gray-400 hover:text-rose-600 gap-1.5"
                                >
                                    <X size={14} /> Clear All
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TypicalListView
                title="Financial Transaction Log"
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
                className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden bg-white"
            />
        </div>
    )
}