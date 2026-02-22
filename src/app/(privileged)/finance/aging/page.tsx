'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from "@/lib/utils/currency"
import { getAgedReceivables, getAgedPayables } from "@/app/actions/finance/reports"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle,
    TrendingUp, Users, DollarSign, CalendarClock
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"

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
    const { fmt } = useCurrency()
    const [tab, setTab] = useState<'receivables' | 'payables'>('receivables')
    const [receivables, setReceivables] = useState<AgingData | null>(null)
    const [payables, setPayables] = useState<AgingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeBucket, setActiveBucket] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
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
    const grandTotal = useMemo(() => data ? Object.values(data).reduce((sum, b) => sum + (b?.total || 0), 0) : 0, [data])

    const allItems = useMemo(() => {
        if (!data) return []
        const raw = !activeBucket
            ? Object.entries(data).flatMap(([key, bucket]) =>
                (bucket?.items || []).map((item: Record<string, any>) => ({ ...item, bucket: key }))
            )
            : (data[activeBucket as keyof AgingData]?.items || []).map((item: Record<string, any>) => ({ ...item, bucket: activeBucket }))

        return [...raw].sort((a: any, b: any) => b.days - a.days)
    }, [data, activeBucket])

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'order_id',
            label: 'Order',
            sortable: true,
            render: (v) => <span className="font-mono text-xs font-bold text-gray-400">ORD-{v.order_id}</span>
        },
        {
            key: contactField,
            label: tab === 'receivables' ? 'Customer' : 'Supplier',
            sortable: true,
            render: (v) => <span className="font-medium text-sm">{v[contactField] || 'N/A'}</span>
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            sortable: true,
            render: (v) => <span className="font-bold text-gray-900">{fmt(v.amount)}</span>
        },
        {
            key: 'days',
            label: 'Days',
            align: 'center',
            sortable: true,
            render: (v) => (
                <Badge variant={v.days > 90 ? "destructive" : v.days > 60 ? "outline" : "secondary"} className="rounded-lg h-5 px-1.5 text-[10px]">
                    {v.days}d
                </Badge>
            )
        },
        {
            key: 'date',
            label: 'Date',
            sortable: true,
            render: (v) => <span className="text-xs text-gray-500">{v.date}</span>
        },
        {
            key: 'bucket',
            label: 'Bucket',
            render: (v) => {
                const bucketCfg = BUCKET_CONFIG.find(b => b.key === v.bucket)
                return (
                    <Badge className={`${bucketCfg?.badgeClass} rounded-lg h-5 px-1.5 text-[10px] border-none shadow-none`}>
                        {bucketCfg?.label || v.bucket}
                    </Badge>
                )
            }
        }
    ], [fmt, tab, contactField])

    if (loading) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                </div>
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Clock size={28} className="text-white" />
                        </div>
                        Aging <span className="text-amber-600">Report</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Receivables & Payables Aging</p>
                </div>
                <div className="flex bg-stone-100 p-1 rounded-2xl shadow-inner">
                    <button
                        onClick={() => { setTab('receivables'); setActiveBucket(null) }}
                        className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'receivables'
                            ? 'bg-white shadow-sm text-emerald-600'
                            : 'text-stone-400 hover:text-stone-600'
                            }`}
                    >
                        <ArrowDownLeft size={16} />
                        Receivables (AR)
                    </button>
                    <button
                        onClick={() => { setTab('payables'); setActiveBucket(null) }}
                        className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === 'payables'
                            ? 'bg-white shadow-sm text-rose-600'
                            : 'text-stone-400 hover:text-stone-600'
                            }`}
                    >
                        <ArrowUpRight size={16} />
                        Payables (AP)
                    </button>
                </div>
            </header>

            {/* Grand Total Summary Card */}
            <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-br from-stone-900 to-stone-800 text-white overflow-hidden relative">
                <div className="absolute top-[-20px] right-[-20px] opacity-10">
                    <DollarSign size={160} />
                </div>
                <CardContent className="py-8 px-10 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center backdrop-blur-md">
                            <TrendingUp size={32} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-stone-400">Grand Total Outstanding</p>
                            <p className="text-4xl font-black mt-1 tracking-tighter tabular-nums">{fmt(grandTotal)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
                        <Users size={18} className="text-stone-400" />
                        <span className="text-sm font-bold">{allItems.length} <span className="text-stone-500 font-medium">Open Items</span></span>
                    </div>
                </CardContent>
            </Card>

            {/* Aging Buckets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {BUCKET_CONFIG.map(({ key, label, color, badgeClass, icon: Icon }) => {
                    const bucket = data?.[key as keyof AgingData]
                    const isActive = activeBucket === key
                    const pct = grandTotal > 0 ? ((bucket?.total || 0) / grandTotal * 100) : 0

                    return (
                        <Card
                            key={key}
                            onClick={() => setActiveBucket(isActive ? null : key)}
                            className={`group cursor-pointer rounded-2xl border-0 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${isActive ? 'ring-2 ring-amber-500 bg-amber-50/10 shadow-lg' : 'bg-white'}`}
                        >
                            <CardContent className="pt-5 pb-4 px-5">
                                <div className="flex items-center justify-between mb-3">
                                    <Badge className={`${badgeClass} rounded-lg border-none text-[10px] uppercase font-black px-2 py-0.5`}>{label}</Badge>
                                    <Icon size={18} className="text-stone-300 group-hover:text-amber-500 transition-colors" />
                                </div>
                                <p className="text-2xl font-bold text-stone-900 tabular-nums">
                                    {fmt(bucket?.total || 0)}
                                </p>
                                <div className="flex items-center justify-between mt-3 mb-1.5">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">
                                        {bucket?.items?.length || 0} Items
                                    </span>
                                    <span className="text-[10px] font-black text-stone-500">{pct.toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className={`h-full ${color} rounded-full transition-all duration-500 ease-out shadow-sm`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Visual Stacked Summary */}
            <div className="h-6 bg-stone-100 rounded-3xl overflow-hidden flex shadow-inner group p-1">
                {grandTotal > 0 ? (
                    BUCKET_CONFIG.map(({ key, color, label }) => {
                        const pct = (data?.[key as keyof AgingData]?.total || 0) / grandTotal * 100
                        return pct > 0 ? (
                            <div
                                key={key}
                                className={`${color} h-full first:rounded-l-2xl last:rounded-r-2xl border-r last:border-0 border-white/20 transition-all hover:brightness-110 flex items-center justify-center`}
                                style={{ width: `${pct}%` }}
                                title={`${label}: ${pct.toFixed(1)}%`}
                            >
                                {pct > 10 && <span className="text-[8px] font-black text-white uppercase opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">{pct.toFixed(0)}%</span>}
                            </div>
                        ) : null
                    })
                ) : (
                    <div className="flex-1 flex items-center justify-center text-[10px] text-stone-300 uppercase font-black tracking-widest">No Aging Data Available</div>
                )}
            </div>

            {/* Details Table */}
            <TypicalListView
                title={activeBucket ? `${BUCKET_CONFIG.find(b => b.key === activeBucket)?.label} Details` : "Outstanding Balance Analysis"}
                data={allItems}
                loading={loading}
                getRowId={(v, i) => `${v.order_id}-${i}`}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                headerExtra={
                    <div className="flex items-center gap-2">
                        {activeBucket && (
                            <button
                                onClick={() => setActiveBucket(null)}
                                className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 transition-all"
                            >
                                Clear Filter
                            </button>
                        )}
                        <Badge variant="outline" className="rounded-xl px-3 py-1 text-stone-400 border-stone-200">
                            {allItems.length} Records
                        </Badge>
                    </div>
                }
            />
        </div>
    )
}
