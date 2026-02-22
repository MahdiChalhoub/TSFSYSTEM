'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLedgerEntries } from '@/app/actions/finance/ledger'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { LedgerEntryActions } from './ledger-actions'
import { useCurrency } from '@/lib/utils/currency'
import Link from 'next/link'
import { Search, Filter, Calendar, BookOpen, ChevronDown } from 'lucide-react'

const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'POSTED', label: 'Posted' },
    { value: 'REVERSED', label: 'Reversed' },
]

const TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 'OPENING', label: 'Opening Balances' },
    { value: 'MANUAL', label: 'Manual Entries' },
]

function getStatusStyle(status: string) {
    switch (status) {
        case 'POSTED': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        case 'DRAFT': return 'bg-stone-100 text-stone-600 border border-stone-200'
        case 'REVERSED': return 'bg-rose-100 text-rose-700 border border-rose-200'
        default: return 'bg-stone-100 text-stone-500'
    }
}

export default function GeneralLedgerPage() {
    const { fmt } = useCurrency()
    const [entries, setEntries] = useState<Record<string, any>[]>([])
    const [fiscalYears, setFiscalYears] = useState<Record<string, any>[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [status, setStatus] = useState('')
    const [fiscalYear, setFiscalYear] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [entryType, setEntryType] = useState('')
    const [search, setSearch] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const loadEntries = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getLedgerEntries('INTERNAL', {
                status: status || undefined,
                fiscal_year: fiscalYear || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                entry_type: entryType || undefined,
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

    const activeFilterCount = [status, fiscalYear, dateFrom, dateTo, entryType, search].filter(Boolean).length

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-2xl font-bold text-stone-900 font-serif">General Ledger</h1>
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full border border-emerald-100 font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Trial Balance Guard Active
                        </span>
                    </div>
                    <p className="text-sm text-stone-500">Review and manage your financial transactions with strict double-entry validation.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/finance/ledger/opening/list" className="bg-white text-stone-600 border border-stone-200 px-5 py-2.5 rounded-lg hover:bg-stone-50 font-bold text-sm shadow-sm transition-all flex items-center gap-2">
                        📋 Opening Balances
                    </Link>
                    <Link href="/finance/ledger/new" className="bg-black text-white px-5 py-2.5 rounded-lg hover:bg-stone-800 font-bold text-sm shadow-sm transition-all flex items-center gap-2">
                        + New Journal Entry
                    </Link>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="mb-6 bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-3 border-b border-stone-100">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search ledger entries..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                    </div>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilters || activeFilterCount > 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                        <Filter className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 1 && (
                            <span className="bg-emerald-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{activeFilterCount}</span>
                        )}
                        <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="p-3 grid grid-cols-4 gap-3 bg-stone-50/50 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Fiscal Year</label>
                            <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                                <option value="">All Years</option>
                                {fiscalYears.map((fy: Record<string, any>) => (
                                    <option key={fy.id} value={fy.id}>{fy.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">From Date</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">To Date</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Entry Type</label>
                            <select value={entryType} onChange={e => setEntryType(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        {activeFilterCount > 0 && (
                            <div className="col-span-4 flex justify-end">
                                <button onClick={() => { setStatus(''); setFiscalYear(''); setDateFrom(''); setDateTo(''); setEntryType(''); setSearch('') }} className="text-xs text-stone-500 hover:text-stone-900 font-bold uppercase tracking-wider">
                                    Clear All Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-stone-500">Loading ledger entries...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {entries.map((entry: Record<string, any>) => {
                        const isLocked = entry.fiscalYear?.status === 'LOCKED' || entry.fiscalYear?.isLocked
                        const isOpening = entry.reference?.startsWith('OPEN-')

                        return (
                            <div key={entry.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all border-stone-200 ${entry.status === 'REVERSED' ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                {/* Header */}
                                <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusStyle(entry.status)}`}>
                                            {entry.status}
                                        </div>
                                        {isOpening && (
                                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" />
                                                {entry.createdBy ? 'Manual Opening' : 'Auto Opening'}
                                            </div>
                                        )}
                                        <h3 className="font-bold text-stone-900 text-sm">JV #{entry.id} — {entry.description}</h3>
                                    </div>
                                    <LedgerEntryActions
                                        entryId={entry.id}
                                        status={entry.status}
                                        isLocked={isLocked}
                                    />
                                </div>

                                {/* Info Bar */}
                                <div className="px-4 py-2 bg-white flex items-center gap-6 text-[11px] text-stone-500 border-b border-stone-50 font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-3 w-3 text-stone-300" />
                                        <span>{new Date(entry.transactionDate).toLocaleDateString('en-GB')}</span>
                                    </div>
                                    {entry.reference && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-stone-300">Ref:</span> <span className="font-mono text-stone-800">{entry.reference}</span>
                                        </div>
                                    )}
                                    {entry.fiscalYear && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-stone-300">FY:</span> <span className="text-stone-700">{entry.fiscalYear.name || `FY ${entry.fiscalYear.id}`}</span>
                                        </div>
                                    )}
                                    {entry.reversalOf && (
                                        <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                            <span>↩ Reversal of JV #{entry.reversalOf.id}</span>
                                        </div>
                                    )}
                                    {entry.reversedBy && (
                                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                            <span>⚠ Reversed by JV #{entry.reversedBy.id}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Lines */}
                                <div className="p-4 pb-2">
                                    <div className="space-y-1">
                                        {entry.lines?.map((line: Record<string, any>) => (
                                            <div key={line.id} className="grid grid-cols-12 gap-3 py-1 items-center border-b border-stone-50 last:border-0 group">
                                                <div className="col-span-1 font-mono text-[10px] text-stone-400">
                                                    {line.account?.code}
                                                </div>
                                                <div className="col-span-5 text-xs font-medium text-stone-700">
                                                    {line.account?.name}
                                                </div>
                                                <div className="col-span-3 text-right text-xs font-mono text-stone-900">
                                                    {Number(line.debit) > 0 ? fmt(Number(line.debit)) : ''}
                                                </div>
                                                <div className="col-span-3 text-right text-xs font-mono text-stone-900">
                                                    {Number(line.credit) > 0 ? fmt(Number(line.credit)) : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {entries.length === 0 && (
                        <div className="text-center py-16 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-stone-300 text-2xl">?</span>
                            </div>
                            <h3 className="text-stone-900 font-bold mb-1">
                                {activeFilterCount > 0 ? 'No Entries Match Filters' : 'No Ledger Entries'}
                            </h3>
                            <p className="text-stone-500 text-sm">
                                {activeFilterCount > 0 ? 'Try adjusting your filters to see more results.' : 'Get started by creating your first journal voucher.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}