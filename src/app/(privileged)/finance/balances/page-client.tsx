'use client'

import { useState, useEffect } from 'react'
import { getCustomerBalances, getSupplierBalances } from '@/app/actions/finance/reports'
import { Users, Briefcase, TrendingUp, TrendingDown, RefreshCw, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react'

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
    const [tab, setTab] = useState<'customer' | 'supplier'>('customer')
    const [customers, setCustomers] = useState<Balance[]>([])
    const [suppliers, setSuppliers] = useState<Balance[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

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
    const filtered = data.filter(b => {
        const name = b.contact?.name || b.contact_name || ''
        return name.toLowerCase().includes(search.toLowerCase())
    })

    const totalBalance = filtered.reduce((sum, b) => sum + (Number(b.balance) || 0), 0)
    const positive = filtered.filter(b => (b.balance || 0) > 0)
    const negative = filtered.filter(b => (b.balance || 0) < 0)

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${tab === 'customer' ? 'bg-gradient-to-br from-blue-500 to-indigo-700 shadow-indigo-900/40' : 'bg-gradient-to-br from-orange-500 to-amber-700 shadow-amber-900/40'}`}>
                        {tab === 'customer' ? <Users size={22} className="text-white" /> : <Briefcase size={22} className="text-white" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Contact Balances</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Customer receivables and supplier payables</p>
                    </div>
                </div>
                <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-1.5 w-fit">
                {([['customer', 'Customer Balances', Users], ['supplier', 'Supplier Balances', Briefcase]] as const).map(([key, label, Icon]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? (key === 'customer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-amber-600 text-white shadow-lg shadow-amber-900/40') : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Balance', value: totalBalance, icon: TrendingUp, color: totalBalance >= 0 ? 'emerald' : 'red' },
                    { label: 'Receivables / Payables', value: positive.reduce((s, b) => s + Number(b.balance), 0), icon: ArrowUpRight, color: 'emerald' },
                    { label: 'Credits / Prepayments', value: negative.reduce((s, b) => s + Number(b.balance), 0), icon: ArrowDownRight, color: 'blue' },
                ].map(stat => (
                    <div key={stat.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-medium mb-2">
                            <stat.icon size={14} />
                            {stat.label}
                        </div>
                        <div className={`text-2xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                            {stat.value < 0 ? '-' : ''}${Math.abs(stat.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${tab} balances...`}
                    className="w-full bg-[#0F1729] border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
            </div>

            {/* Table */}
            <div className="bg-[#0F1729] rounded-2xl border border-gray-800 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-800">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Credit Limit</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Transaction</th>
                            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="border-b border-gray-800/50">
                                    <td colSpan={5} className="px-5 py-4">
                                        <div className="h-4 bg-gray-800/60 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-5 py-12 text-center text-gray-500 text-sm">No balances found</td>
                            </tr>
                        ) : filtered.map(b => {
                            const bal = Number(b.balance || 0)
                            const name = b.contact?.name || b.contact_name || '—'
                            return (
                                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="font-medium text-white text-sm">{name}</div>
                                        {b.contact?.email && <div className="text-xs text-gray-500">{b.contact.email}</div>}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <span className={`font-mono font-semibold text-sm ${bal > 0 ? 'text-emerald-400' : bal < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                            {bal < 0 ? '-' : ''}{b.currency || '$'}{Math.abs(bal).toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <span className="font-mono text-sm text-gray-400">{b.credit_limit != null ? `$${Number(b.credit_limit).toFixed(2)}` : '—'}</span>
                                    </td>
                                    <td className="px-5 py-4 text-right text-xs text-gray-500">{b.last_transaction_date || '—'}</td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${bal > 0 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800' : bal < 0 ? 'bg-blue-900/40 text-blue-400 border-blue-800' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                            {bal > 0 ? (tab === 'customer' ? 'OWED' : 'PAYABLE') : bal < 0 ? 'CREDIT' : 'SETTLED'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
