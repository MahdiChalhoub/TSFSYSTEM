'use client'
import { useCurrency } from '@/lib/utils/currency'
import { safeDateSort } from '@/lib/utils/safe-date'
import { useState, useEffect, useMemo } from "react"
import type { PurchaseOrder } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ShoppingCart, Package, DollarSign, TrendingUp, Clock,
    Search, CheckCircle, AlertCircle, Truck, RefreshCw,
    ArrowUpRight, Target, Activity, Zap, Building
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    CONFIRMED: { label: 'Confirmed', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
    DRAFT: { label: 'Draft', color: 'bg-stone-50 text-stone-500 border-stone-100' },
}
export default function PurchaseDashboardPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string | null>(null)
    const settings = useListViewSettings('purch_dashboard', {
        columns: ['ref_code', 'created_at', 'supplier_name', 'status', 'payment_method', 'total_amount'],
        pageSize: 15, sortKey: 'created_at', sortDir: 'desc'
    })
    useEffect(() => { loadOrders() }, [])
    async function loadOrders() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/purchase/')
            setOrders(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load procurement stream")
        } finally {
            setLoading(false)
        }
    }
    const filteredOrders = useMemo(() => {
        if (!statusFilter) return orders
        return orders.filter(o => o.status === statusFilter)
    }, [orders, statusFilter])
    const stats = useMemo(() => {
        const total = orders.reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
        const completed = orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
        const pending = orders.filter(o => ['PENDING', 'CONFIRMED'].includes(o.status ?? '')).reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
        return { total, completed, pending, count: orders.length }
    }, [orders])
    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'ref_code',
            label: 'Procurement ID',
            render: (o) => (
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                        {o.ref_code || `PO-${o.id}`}
                    </span>
                </div>
            )
        },
        {
            key: 'created_at',
            label: 'Posting Date',
            sortable: true,
            render: (o) => (
                <span className="text-xs font-bold text-stone-600">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
                </span>
            )
        },
        {
            key: 'supplier_name',
            label: 'Vendor Entity',
            render: (o) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400">
                        <Building size={14} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 tracking-tight">{o.supplier_name || o.contact_name || 'Legacy Vendor'}</span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Lifecycle Stage',
            render: (o) => (
                <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[o.status ?? '']?.color || 'bg-stone-50 text-stone-500'}`}>
                    {STATUS_CONFIG[o.status ?? '']?.label || o.status}
                </Badge>
            )
        },
        {
            key: 'payment_method',
            label: 'Settlement Channel',
            render: (o) => <span className="text-[10px] font-black uppercase tracking-tighter text-stone-400">{o.payment_method || 'PENDING'}</span>
        },
        {
            key: 'total_amount',
            label: 'Gross Procurement',
            align: 'right',
            render: (o) => (
                <span className="font-black text-gray-900 tracking-tighter">{fmt(parseFloat(o.total_amount || 0))}</span>
            )
        }
    ], [fmt])
    if (loading && orders.length === 0) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }
    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ShoppingCart size={28} className="text-white" />
                        </div>
                        Procurement <span className="text-indigo-600">Intelligence</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Supply Chain & Vendor Exposure Metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={loadOrders} variant="ghost" className="h-12 w-12 p-0 rounded-2xl text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Zap size={18} /> New Procurement Seq
                    </Button>
                </div>
            </header>
            {/* Premium Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform">
                        <Target size={80} />
                    </div>
                    <CardContent className="p-8 relative z-10">
                        <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Global Exposure</p>
                        <p className="text-4xl font-black mt-2 tracking-tighter">{fmt(stats.total)}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <Badge className="bg-white/20 text-white border-none text-[9px] font-black px-2">{stats.count} ACTIVE POs</Badge>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Completed Fulfillment</p>
                                <p className="text-3xl font-black mt-2 tracking-tighter text-emerald-600">{fmt(stats.completed)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle size={24} />
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Outstanding Pipeline</p>
                                <p className="text-3xl font-black mt-2 tracking-tighter text-amber-600">{fmt(stats.pending)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Clock size={24} />
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(stats.pending / stats.total) * 100}%` }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">Procurement Efficiency</p>
                                <p className="text-3xl font-black mt-2 tracking-tighter text-blue-600">{orders.length > 0 ? fmt(stats.total / orders.length) : fmt(0)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Activity size={24} />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-stone-400 mt-4 uppercase tracking-widest">Average Value / Unit</p>
                    </CardContent>
                </Card>
            </div>
            <TypicalListView
                title="Procurement Lifecycle Stream"
                data={filteredOrders}
                loading={loading}
                getRowId={(o) => o.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                headerExtra={
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl">
                        <Button
                            variant={!statusFilter ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setStatusFilter(null)}
                            className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!statusFilter ? 'bg-white shadow-sm text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            All Logs
                        </Button>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const count = orders.filter(o => o.status === key).length
                            if (count === 0) return null
                            return (
                                <Button
                                    key={key}
                                    variant={statusFilter === key ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setStatusFilter(key)}
                                    className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === key ? 'bg-white shadow-sm text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                    {cfg.label}
                                </Button>
                            )
                        })}
                    </div>
                }
            />
        </div>
    )
}
