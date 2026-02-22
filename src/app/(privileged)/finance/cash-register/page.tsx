'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from '@/lib/utils/currency'
import { getDailySummary } from "@/app/actions/pos/daily-summary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Banknote, ShoppingCart, RotateCcw, CreditCard,
    Users, Clock, TrendingUp, Calendar, DollarSign, Receipt, ArrowRight, RefreshCw, BarChart3
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const PAYMENT_ICONS: Record<string, string> = {
    CASH: '💵',
    CARD: '💳',
    MOBILE: '📱',
    BANK: '🏦',
    CREDIT: '📝',
}

const TYPE_CONFIG: Record<string, { color: string, bg: string }> = {
    SALE: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
    PURCHASE: { color: 'text-blue-700', bg: 'bg-blue-50' },
    RETURN: { color: 'text-orange-700', bg: 'bg-orange-50' },
}

export default function CashRegisterPage() {
    const { fmt } = useCurrency()
    const [data, setData] = useState<Record<string, any> | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
    const settings = useListViewSettings('fin_cash_register', {
        columns: ['ref_code', 'type', 'total', 'payment_method', 'user', 'time'],
        pageSize: 25, sortKey: 'time', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [selectedDate, period])

    async function loadData() {
        setLoading(true)
        try {
            if (period === 'today') {
                setData(await getDailySummary(selectedDate))
            } else if (period === 'week') {
                setData(await getDailySummary(undefined, 7))
            } else {
                setData(await getDailySummary(undefined, 30))
            }
        } catch {
            toast.error("Failed to load daily summary")
        } finally {
            setLoading(false)
        }
    }

    const sales = data?.sales || { count: 0, total: 0, tax: 0, discount: 0 }
    const returns = data?.returns || { count: 0, total: 0 }
    const paymentMethods = data?.payment_methods || {}
    const userStats = data?.user_stats || {}
    const hourly = data?.hourly || Array(24).fill(0)
    const recent = data?.recent || []
    const maxHourly = Math.max(...hourly, 1)

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'ref_code',
            label: 'Reference',
            sortable: true,
            render: (t) => <span className="font-mono text-xs font-bold text-gray-400">#{t.ref_code || t.id}</span>
        },
        {
            key: 'type',
            label: 'Type',
            sortable: true,
            render: (t) => {
                const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.SALE
                return <Badge className={`${cfg.bg} ${cfg.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg`}>{t.type}</Badge>
            }
        },
        {
            key: 'total',
            label: 'Amount',
            align: 'right',
            sortable: true,
            render: (t) => <span className="font-black text-gray-900 text-sm">{fmt(t.total)}</span>
        },
        {
            key: 'payment_method',
            label: 'Payment',
            sortable: true,
            render: (t) => (
                <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{PAYMENT_ICONS[t.payment_method] || '💰'}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-tighter">{t.payment_method}</span>
                </div>
            )
        },
        {
            key: 'user',
            label: 'Cashier',
            sortable: true,
            render: (t) => (
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center">
                        <Users size={10} className="text-stone-400" />
                    </div>
                    <span className="text-xs font-medium text-gray-500">{t.user}</span>
                </div>
            )
        },
        {
            key: 'time',
            label: 'Timestamp',
            sortable: true,
            render: (t) => (
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400">
                        {t.time ? new Date(t.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                </div>
            )
        }
    ], [fmt])

    if (loading && !data) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Banknote size={28} className="text-white" />
                        </div>
                        Cash <span className="text-emerald-600">Register</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Daily Operations & POS Summary</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-stone-100 p-1 rounded-2xl shadow-inner h-12 items-center px-1">
                        {(['today', 'week', 'month'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${period === p
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-stone-400 hover:text-stone-600'
                                    }`}
                            >
                                {p === 'today' ? 'Today' : p === 'week' ? '7 Days' : '30 Days'}
                            </button>
                        ))}
                    </div>
                    {period === 'today' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-stone-100 border-none rounded-2xl h-12 px-4 text-xs font-bold text-stone-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    )}
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Revenue</p>
                            <p className="text-2xl font-black mt-1 tracking-tighter text-emerald-600">{fmt(sales.total)}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">{sales.count} Txns</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <RotateCcw size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Returns</p>
                            <p className="text-2xl font-black mt-1 tracking-tighter text-orange-600">{fmt(returns.total)}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">{returns.count} Items</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Banknote size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Net Position</p>
                            <p className="text-2xl font-black mt-1 tracking-tighter text-blue-600">{fmt(data?.net_revenue || 0)}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">Adjusted Balance</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Tax Collected</p>
                            <p className="text-2xl font-black mt-1 tracking-tighter text-purple-600">{fmt(sales.tax)}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">VAT/Service Tax</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Middle Row: Payment Methods + User Stats + Hourly */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Payment Methods */}
                <Card className="rounded-3xl border-0 shadow-sm bg-white">
                    <CardHeader className="pb-2 pt-6 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                            <CreditCard size={14} className="text-stone-300" /> Revenue Split
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-4">
                        {Object.keys(paymentMethods).length === 0 ? (
                            <div className="py-8 text-center"><p className="text-xs font-bold text-stone-300 uppercase tracking-widest italic">No Data logged</p></div>
                        ) : Object.entries(paymentMethods).map(([method, stats]: [string, any]) => (
                            <div key={method} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-inner">
                                        {PAYMENT_ICONS[method] || '💰'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-stone-900">{method}</p>
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">{stats.count} Transactions</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-stone-900">{fmt(stats.total)}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* User Stats */}
                <Card className="rounded-3xl border-0 shadow-sm bg-white">
                    <CardHeader className="pb-2 pt-6 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                            <Users size={14} className="text-stone-300" /> Cashier Rank
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-4">
                        {Object.keys(userStats).length === 0 ? (
                            <div className="py-8 text-center"><p className="text-xs font-bold text-stone-300 uppercase tracking-widest italic">No activity</p></div>
                        ) : Object.entries(userStats)
                            .sort(([, a]: [string, any], [, b]: [string, any]) => b.total - a.total)
                            .map(([name, stats]: [string, any]) => (
                                <div key={name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400 font-black group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-inner">
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-stone-900">{name}</p>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">{stats.count} Sales</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-stone-900">{fmt(stats.total)}</p>
                                    </div>
                                </div>
                            ))}
                    </CardContent>
                </Card>

                {/* Hourly Distribution */}
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="pb-4 pt-6 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                            <BarChart3 size={14} className="text-stone-300" /> Hourly Pulse
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="flex items-end gap-[3px] h-32 mb-2">
                            {hourly.map((val: number, i: number) => {
                                const pct = (val / maxHourly) * 100
                                const isActive = val > 0
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 group relative"
                                        title={`${i}:00 — ${fmt(val)}`}
                                    >
                                        <div
                                            className={`w-full rounded-t-sm transition-all duration-500 ease-out ${isActive ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-stone-50'
                                                }`}
                                            style={{ height: `${Math.max(pct, 4)}%` }}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-between mt-1 text-[8px] font-black text-stone-300 uppercase tracking-tighter">
                            <span>00h</span><span>08h</span><span>12h</span><span>16h</span><span>23h</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions Table */}
            <TypicalListView
                title="Recent Register Activity"
                data={recent}
                loading={loading}
                getRowId={(t) => t.id}
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
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="rounded-xl px-3 py-1 text-stone-400 border-stone-200">
                            {recent.length} Records
                        </Badge>
                        <button onClick={loadData} className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                }
            />
        </div>
    )
}
