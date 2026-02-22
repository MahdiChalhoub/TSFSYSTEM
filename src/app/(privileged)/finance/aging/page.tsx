'use client'

import { useState, useEffect } from "react"
import { useCurrency } from "@/lib/utils/currency"
import { getAgedReceivables, getAgedPayables } from "@/app/actions/finance/reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle,
    TrendingUp, Users, DollarSign, CalendarClock
} from "lucide-react"

type AgingBucket = {
    total: number
    items: {
        order_id: number
        customer?: string
        supplier?: string
        amount: number
        days: number
        date: string
    }[]
}

type AgingData = {
    current: AgingBucket
    '31_60': AgingBucket
    '61_90': AgingBucket
    over_90: AgingBucket
}

const BUCKET_CONFIG = [
    { key: 'current', label: 'Current (0-30)', color: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700', icon: Clock },
    { key: '31_60', label: '31-60 Days', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700', icon: CalendarClock },
    { key: '61_90', label: '61-90 Days', color: 'bg-orange-500', badgeClass: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    { key: 'over_90', label: '90+ Days', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700', icon: AlertTriangle },
]


export default function AgingReportPage() {
    const { fmt: formatCurrency } = useCurrency()
    const [tab, setTab] = useState<'receivables' | 'payables'>('receivables')
    const [receivables, setReceivables] = useState<AgingData | null>(null)
    const [payables, setPayables] = useState<AgingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeBucket, setActiveBucket] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [ar, ap] = await Promise.all([
                getAgedReceivables(),
                getAgedPayables()
            ])
            setReceivables(ar as AgingData)
            setPayables(ap as AgingData)
        } catch {
            toast.error("Failed to load aging data")
        } finally {
            setLoading(false)
        }
    }

    const data = tab === 'receivables' ? receivables : payables
    const contactField = tab === 'receivables' ? 'customer' : 'supplier'
    const grandTotal = data
        ? Object.values(data).reduce((sum, b) => sum + (b?.total || 0), 0)
        : 0

    const allItems = data && !activeBucket
        ? Object.entries(data).flatMap(([key, bucket]) =>
            (bucket?.items || []).map((item: Record<string, any>) => ({ ...item, bucket: key }))
        )
        : data && activeBucket
            ? (data[activeBucket as keyof AgingData]?.items || []).map((item: Record<string, any>) => ({ ...item, bucket: activeBucket }))
            : []

    allItems.sort((a: Record<string, any>, b: Record<string, any>) => b.days - a.days)

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-72" />
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
                    <h1 className="text-2xl font-bold text-gray-900">Aging Report</h1>
                    <p className="text-sm text-gray-500 mt-1">Receivables & Payables breakdown by age</p>
                </div>
                <div className="flex rounded-lg border overflow-hidden">
                    <button
                        onClick={() => { setTab('receivables'); setActiveBucket(null) }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === 'receivables'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <ArrowDownLeft size={16} />
                        Receivables (AR)
                    </button>
                    <button
                        onClick={() => { setTab('payables'); setActiveBucket(null) }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${tab === 'payables'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <ArrowUpRight size={16} />
                        Payables (AP)
                    </button>
                </div>
            </header>

            {/* Grand Total */}
            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <DollarSign size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">
                                Total Outstanding {tab === 'receivables' ? 'Receivables' : 'Payables'}
                            </p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(grandTotal)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users size={16} />
                        {allItems.length} open {tab === 'receivables' ? 'invoices' : 'bills'}
                    </div>
                </CardContent>
            </Card>

            {/* Aging Buckets */}
            <div className="grid grid-cols-4 gap-4">
                {BUCKET_CONFIG.map(({ key, label, color, badgeClass, icon: Icon }) => {
                    const bucket = data?.[key as keyof AgingData]
                    const isActive = activeBucket === key
                    const pct = grandTotal > 0 ? ((bucket?.total || 0) / grandTotal * 100) : 0

                    return (
                        <Card
                            key={key}
                            onClick={() => setActiveBucket(isActive ? null : key)}
                            className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''
                                }`}
                        >
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge className={badgeClass}>{label}</Badge>
                                    <Icon size={16} className="text-gray-400" />
                                </div>
                                <p className="text-xl font-bold text-gray-900">
                                    {formatCurrency(bucket?.total || 0)}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-gray-400">
                                        {bucket?.items?.length || 0} items
                                    </span>
                                    <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Stacked Bar Summary */}
            {grandTotal > 0 && (
                <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                    {BUCKET_CONFIG.map(({ key, color }) => {
                        const pct = (data?.[key as keyof AgingData]?.total || 0) / grandTotal * 100
                        return pct > 0 ? (
                            <div key={key} className={`${color} transition-all`} style={{ width: `${pct}%` }} title={`${pct.toFixed(1)}%`} />
                        ) : null
                    })}
                </div>
            )}

            {/* Detail Table */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp size={18} className="text-gray-400" />
                        {activeBucket
                            ? `${BUCKET_CONFIG.find(b => b.key === activeBucket)?.label} — Details`
                            : 'All Outstanding Items'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {allItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No outstanding {tab === 'receivables' ? 'receivables' : 'payables'}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>Order</TableHead>
                                    <TableHead>{tab === 'receivables' ? 'Customer' : 'Supplier'}</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-center">Days</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Bucket</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allItems.map((item: Record<string, any>, idx: number) => {
                                    const bucketCfg = BUCKET_CONFIG.find(b => b.key === item.bucket)
                                    return (
                                        <TableRow key={idx} className="hover:bg-gray-50/50">
                                            <TableCell className="font-mono text-sm">
                                                ORD-{item.order_id}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {item[contactField] || 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.days > 90 ? "destructive" : item.days > 60 ? "outline" : "secondary"}>
                                                    {item.days}d
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {item.date}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={bucketCfg?.badgeClass || ''}>
                                                    {bucketCfg?.label || item.bucket}
                                                </Badge>
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
