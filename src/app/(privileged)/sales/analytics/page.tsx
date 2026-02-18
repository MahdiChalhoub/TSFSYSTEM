'use client'

import { useState, useEffect } from "react"
import type { SalesAnalyticsData } from '@/types/erp'
import { getSalesAnalytics } from "@/app/actions/pos/sales-analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    BarChart3, DollarSign, TrendingUp, ShoppingCart, Users,
    Package, CreditCard, Building2
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const PAYMENT_ICONS: Record<string, string> = {
    CASH: '💵', CARD: '💳', MOBILE: '📱', TRANSFER: '🏦', CHECK: '📝', CREDIT: '🧾'
}

export default function SalesAnalyticsPage() {
    const [data, setData] = useState<SalesAnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState(30)

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        setLoading(true)
        try {
            const result = await getSalesAnalytics(period)
            setData(result)
        } catch {
            toast.error("Failed to load sales analytics")
        } finally {
            setLoading(false)
        }
    }

    if (loading || !data) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    const { overall, top_products, top_customers, daily_trend, payment_methods, site_performance } = data

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                            <BarChart3 size={20} className="text-white" />
                        </div>
                        Sales Analytics
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {data.period?.start} → {data.period?.end}
                    </p>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period === d ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-4">
                <Card className="border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={22} className="text-violet-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Revenue</p>
                                <p className="text-lg font-bold text-violet-700">{fmt(overall.revenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={22} className="text-blue-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Orders</p>
                                <p className="text-lg font-bold text-blue-700">{overall.orders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={22} className="text-emerald-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Avg Order</p>
                                <p className="text-lg font-bold text-emerald-700">{fmt(overall.avg_order)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={22} className="text-rose-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Tax</p>
                                <p className="text-lg font-bold text-rose-700">{fmt(overall.tax)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={22} className="text-orange-500" />
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Discounts</p>
                                <p className="text-lg font-bold text-orange-700">{fmt(overall.discount)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Trend (simplified bar chart) */}
            {(daily_trend?.length ?? 0) > 0 && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp size={18} className="text-gray-400" /> Daily Revenue Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-1 h-32">
                            {daily_trend?.map((d: any, i: number) => {
                                const max = Math.max(...(daily_trend?.map((t: any) => t.revenue) ?? [0]))
                                const pct = max ? (d.revenue / max * 100) : 0
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                        <div className="invisible group-hover:visible text-[10px] text-gray-500 whitespace-nowrap">
                                            {fmt(d.revenue)}
                                        </div>
                                        <div
                                            className="w-full bg-violet-400 rounded-t hover:bg-violet-600 transition-all"
                                            style={{ height: `${Math.max(pct, 2)}%` }}
                                        />
                                        <div className="text-[9px] text-gray-400 transform -rotate-45 origin-top-left whitespace-nowrap">
                                            {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-6">
                {/* Top Products */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package size={18} className="text-gray-400" /> Top Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>#</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {top_products?.map((p: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-bold text-gray-400">{i + 1}</TableCell>
                                        <TableCell className="font-medium">{p.name || 'Unknown'}</TableCell>
                                        <TableCell className="text-right text-sm">{Math.round(p.qty)}</TableCell>
                                        <TableCell className="text-right font-bold text-violet-600">{fmt(p.revenue)}</TableCell>
                                    </TableRow>
                                ))}
                                {(!top_products?.length) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-400">No product data</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Top Customers */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users size={18} className="text-gray-400" /> Top Customers
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>#</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Orders</TableHead>
                                    <TableHead className="text-right">Spent</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {top_customers?.map((c: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-bold text-gray-400">{i + 1}</TableCell>
                                        <TableCell className="font-medium">{c.name || 'Walk-in'}</TableCell>
                                        <TableCell className="text-right text-sm">{c.orders}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">{fmt(c.spent)}</TableCell>
                                    </TableRow>
                                ))}
                                {(!top_customers?.length) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-400">No customer data</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Payment Methods */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard size={18} className="text-gray-400" /> Payment Methods
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {payment_methods?.map((p: any, i: number) => {
                                const totalRev = overall.revenue || 1
                                const pct = (p.total / totalRev * 100)
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-lg">{PAYMENT_ICONS[p.method] || '💳'}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium">{p.method}</span>
                                                <span className="text-gray-500">{p.count} orders</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <span className="font-bold text-sm w-28 text-right">{fmt(p.total)}</span>
                                    </div>
                                )
                            })}
                            {(!payment_methods?.length) && (
                                <p className="text-center py-4 text-gray-400">No payment data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Site Performance */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 size={18} className="text-gray-400" /> Site Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {site_performance?.map((s: any, i: number) => {
                                const totalRev = overall.revenue || 1
                                const pct = (s.total / totalRev * 100)
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Building2 size={14} className="text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium">{s.site || 'Unknown'}</span>
                                                <span className="text-gray-500">{s.count} orders</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <span className="font-bold text-sm w-28 text-right">{fmt(s.total)}</span>
                                    </div>
                                )
                            })}
                            {(!site_performance?.length) && (
                                <p className="text-center py-4 text-gray-400">No site data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
