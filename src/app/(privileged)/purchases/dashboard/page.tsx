'use client'

import { useState, useEffect, useMemo } from "react"
import type { PurchaseOrder } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Package, DollarSign, TrendingUp, Clock,
    Search, CheckCircle, AlertCircle, Truck
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_COLOR: Record<string, string> = {
    PENDING: 'bg-app-warning-bg text-app-warning',
    CONFIRMED: 'bg-app-info-bg text-app-info',
    COMPLETED: 'bg-app-success-bg text-app-success',
    CANCELLED: 'bg-app-error-bg text-app-error',
    DRAFT: 'bg-app-surface-2 text-app-muted-foreground',
}

export default function PurchaseDashboardPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | null>(null)

    useEffect(() => { loadOrders() }, [])

    async function loadOrders() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/purchase/')
            setOrders(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load purchase orders")
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        let items = orders
        if (statusFilter) items = items.filter(o => o.status === statusFilter)
        if (search) {
            const s = search.toLowerCase()
            items = items.filter(o =>
                (o.ref_code || '').toLowerCase().includes(s) ||
                (o.supplier_name || o.contact_name || '').toLowerCase().includes(s)
            )
        }
        return items.sort((a: Record<string, any>, b: Record<string, any>) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [orders, statusFilter, search])

    const totalValue = orders.reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
    const completedOrders = orders.filter(o => o.status === 'COMPLETED')
    const completedValue = completedOrders.reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)
    const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED')
    const pendingValue = pendingOrders.reduce((s, o) => s + parseFloat(String(o.total_amount || 0)), 0)

    const statusCounts: Record<string, number> = {}
    orders.forEach(o => { statusCounts[o.status ?? ''] = (statusCounts[o.status ?? ''] || 0) + 1 })

    if (loading && orders.length === 0) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-warning flex items-center justify-center">
                            <Truck size={20} className="text-white" />
                        </div>
                        Purchase Orders
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Track and monitor supplier purchase orders</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Package size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Orders</p>
                                <p className="text-2xl font-bold">{orders.length}</p>
                                <p className="text-xs text-app-muted-foreground">{fmt(totalValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Completed</p>
                                <p className="text-2xl font-bold text-app-success">{completedOrders.length}</p>
                                <p className="text-xs text-app-muted-foreground">{fmt(completedValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Clock size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">In Progress</p>
                                <p className="text-2xl font-bold text-app-warning">{pendingOrders.length}</p>
                                <p className="text-xs text-app-muted-foreground">{fmt(pendingValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Avg Order</p>
                                <p className="text-xl font-bold text-app-info">
                                    {orders.length > 0 ? fmt(totalValue / orders.length) : fmt(0)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setStatusFilter(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!statusFilter ? 'bg-app-bg text-white' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-surface-2'
                        }`}
                >
                    All ({orders.length})
                </button>
                {Object.entries(statusCounts).map(([status, count]) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${statusFilter === status ? 'bg-app-bg text-white' : `${STATUS_COLOR[status]?.split(' ')[0] || 'bg-app-surface-2'} ${STATUS_COLOR[status]?.split(' ')[1] || 'text-app-muted-foreground'} hover:opacity-80`
                            }`}
                    >
                        {status} ({count})
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <Truck size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No purchase orders found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((o: Record<string, any>) => (
                                    <TableRow key={o.id} className="hover:bg-app-surface/50">
                                        <TableCell className="font-mono text-xs text-app-info">
                                            {o.ref_code || `PO-${o.id}`}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
                                        </TableCell>
                                        <TableCell className="text-sm">{o.supplier_name || o.contact_name || '—'}</TableCell>
                                        <TableCell>
                                            <Badge className={STATUS_COLOR[o.status] || 'bg-app-surface-2'}>
                                                {o.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground">{o.payment_method || '—'}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {fmt(parseFloat(o.total_amount || 0))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
