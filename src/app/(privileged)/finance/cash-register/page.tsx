'use client'

import { useState, useEffect } from "react"
import { getDailySummary } from "@/app/actions/pos/daily-summary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Banknote, ShoppingCart, RotateCcw, CreditCard,
    Users, Clock, TrendingUp, Calendar, DollarSign, Receipt
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const PAYMENT_ICONS: Record<string, string> = {
    CASH: '💵',
    CARD: '💳',
    MOBILE: '📱',
    BANK: '🏦',
    CREDIT: '📝',
}

const TYPE_CONFIG: Record<string, { color: string, bg: string }> = {
    SALE: { color: 'text-app-success', bg: 'bg-app-success-bg' },
    PURCHASE: { color: 'text-app-info', bg: 'bg-app-info-bg' },
    RETURN: { color: 'text-orange-700', bg: 'bg-orange-50' },
}

export default function CashRegisterPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

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
    const purchases = data?.purchases || { count: 0, total: 0 }
    const returns = data?.returns || { count: 0, total: 0 }
    const paymentMethods = data?.payment_methods || {}
    const userStats = data?.user_stats || {}
    const hourly = data?.hourly || Array(24).fill(0)
    const recent = data?.recent || []
    const maxHourly = Math.max(...hourly, 1)

    if (loading && !data) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                            <Banknote size={20} className="text-white" />
                        </div>
                        Cash Register
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Daily transaction & revenue summary</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-app-surface-2 rounded-lg p-0.5">
                        {(['today', 'week', 'month'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${period === p ? 'bg-app-surface shadow text-app-foreground font-medium' : 'text-app-muted-foreground hover:text-app-foreground'
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
                            className="border rounded-lg px-3 py-2 text-sm bg-app-surface"
                        />
                    )}
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-app-success-bg flex items-center justify-center">
                                <ShoppingCart size={20} className="text-app-success" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Sales Revenue</p>
                                <p className="text-2xl font-bold text-app-foreground">{fmt(sales.total)}</p>
                                <p className="text-xs text-app-muted-foreground">{sales.count} transaction{sales.count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-app-success-bg flex items-center justify-center">
                                <TrendingUp size={20} className="text-app-success" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Net Revenue</p>
                                <p className="text-2xl font-bold text-app-success">{fmt(data?.net_revenue || 0)}</p>
                                <p className="text-xs text-app-muted-foreground">After returns</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <RotateCcw size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Returns</p>
                                <p className="text-2xl font-bold text-orange-700">{fmt(returns.total)}</p>
                                <p className="text-xs text-app-muted-foreground">{returns.count} return{returns.count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <DollarSign size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Tax Collected</p>
                                <p className="text-2xl font-bold text-purple-700">{fmt(sales.tax)}</p>
                                <p className="text-xs text-app-muted-foreground">Discount: {fmt(sales.discount)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Middle Row: Payment Methods + User Stats + Hourly */}
            <div className="grid grid-cols-3 gap-4">
                {/* Payment Methods */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard size={16} className="text-app-muted-foreground" /> Payment Methods
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 space-y-2">
                        {Object.keys(paymentMethods).length === 0 ? (
                            <p className="text-sm text-app-muted-foreground">No transactions</p>
                        ) : Object.entries(paymentMethods).map(([method, stats]: [string, any]) => (
                            <div key={method} className="flex items-center justify-between py-1 border-b last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{PAYMENT_ICONS[method] || '💰'}</span>
                                    <span className="text-sm font-medium">{method}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{fmt(stats.total)}</p>
                                    <p className="text-[10px] text-app-muted-foreground">{stats.count} txn</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* User Stats */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Users size={16} className="text-app-muted-foreground" /> Cashier Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 space-y-2">
                        {Object.keys(userStats).length === 0 ? (
                            <p className="text-sm text-app-muted-foreground">No transactions</p>
                        ) : Object.entries(userStats)
                            .sort(([, a]: [string, any], [, b]: [string, any]) => b.total - a.total)
                            .map(([name, stats]: [string, any]) => (
                                <div key={name} className="flex items-center justify-between py-1 border-b last:border-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-indigo-600">
                                                {name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <span className="text-sm">{name}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold">{fmt(stats.total)}</p>
                                        <p className="text-[10px] text-app-muted-foreground">{stats.count} sales</p>
                                    </div>
                                </div>
                            ))}
                    </CardContent>
                </Card>

                {/* Hourly Distribution */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock size={16} className="text-app-muted-foreground" /> Hourly Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex items-end gap-[2px] h-32">
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
                                            className={`w-full rounded-t transition-all ${isActive ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-app-surface-2'
                                                }`}
                                            style={{ height: `${Math.max(pct, 2)}%` }}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-app-muted-foreground">
                            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Receipt size={18} className="text-app-muted-foreground" /> Recent Transactions
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {recent.length === 0 ? (
                        <div className="text-center py-12 text-app-muted-foreground">
                            <Receipt size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No transactions for this period</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>Ref</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead>Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recent.map((t: Record<string, any>) => {
                                    const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.SALE
                                    return (
                                        <TableRow key={t.id} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-xs">{t.ref_code || `#${t.id}`}</TableCell>
                                            <TableCell>
                                                <Badge className={`${cfg.bg} ${cfg.color}`}>{t.type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">{t.status}</TableCell>
                                            <TableCell className="text-right font-bold">{fmt(t.total)}</TableCell>
                                            <TableCell className="text-sm">
                                                {PAYMENT_ICONS[t.payment_method] || '💰'} {t.payment_method}
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">{t.user}</TableCell>
                                            <TableCell className="text-xs text-app-muted-foreground">
                                                {t.time ? new Date(t.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
