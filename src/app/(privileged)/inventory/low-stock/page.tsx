'use client'

import { useState, useEffect, useMemo } from "react"
import type { LowStockResponse } from '@/types/erp'
import { getLowStockAlerts } from "@/app/actions/inventory/low-stock"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    PackageX, AlertTriangle, TrendingDown, Search,
    DollarSign, ShoppingCart, ArrowUpDown, Package
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const SEVERITY_CONFIG: Record<string, { color: string, bg: string, label: string }> = {
    OUT: { color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', label: 'Out of Stock' },
    CRITICAL: { color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', label: 'Critical' },
    LOW: { color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', label: 'Low' },
}

type SortKey = 'product_name' | 'current_stock' | 'shortage' | 'restock_value'

export default function LowStockPage() {
    const [data, setData] = useState<LowStockResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeFilter, setActiveFilter] = useState<string | null>(null)
    const [sortKey, setSortKey] = useState<SortKey>('shortage')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            setData(await getLowStockAlerts())
        } catch {
            toast.error("Failed to load low stock data")
        } finally {
            setLoading(false)
        }
    }

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('desc') }
    }

    const products = useMemo(() => {
        if (!data?.products) return []
        let items = [...data.products]
        if (activeFilter) items = items.filter((p: Record<string, any>) => p.severity === activeFilter)
        if (search) {
            const s = search.toLowerCase()
            items = items.filter((p: Record<string, any>) =>
                p.product_name?.toLowerCase().includes(s) ||
                p.barcode?.toLowerCase().includes(s)
            )
        }
        items.sort((a: Record<string, any>, b: Record<string, any>) => {
            const av = a[sortKey] ?? 0
            const bv = b[sortKey] ?? 0
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
            return sortDir === 'asc' ? av - bv : bv - av
        })
        return items
    }, [data, search, activeFilter, sortKey, sortDir])

    const stats = data?.stats || { total_alerts: 0, out_of_stock: 0, critical: 0, low: 0, total_restock_value: 0 }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1>Low Stock Alerts</h1>
                <p className="text-sm text-app-muted-foreground mt-1">Products at or below minimum stock levels</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-4">
                <Card
                    className={`cursor-pointer transition-all ${!activeFilter ? 'ring-2 ring-gray-900' : 'hover:shadow-md'}`}
                    onClick={() => setActiveFilter(null)}
                >
                    <CardContent className="py-4 text-center">
                        <TrendingDown size={24} className="mx-auto mb-2 text-app-muted-foreground" />
                        <p className="text-3xl font-bold">{stats.total_alerts}</p>
                        <p className="text-xs text-app-muted-foreground uppercase font-medium">Total Alerts</p>
                    </CardContent>
                </Card>
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-red-500 ${activeFilter === 'OUT' ? 'ring-2 ring-app-error' : 'hover:shadow-md'}`}
                    onClick={() => setActiveFilter(activeFilter === 'OUT' ? null : 'OUT')}
                >
                    <CardContent className="py-4 text-center">
                        <PackageX size={24} className="mx-auto mb-2 text-app-error" />
                        <p className="text-3xl font-bold text-app-error">{stats.out_of_stock}</p>
                        <p className="text-xs text-app-error uppercase font-medium">Out of Stock</p>
                    </CardContent>
                </Card>
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-orange-500 ${activeFilter === 'CRITICAL' ? 'ring-2 ring-orange-500' : 'hover:shadow-md'}`}
                    onClick={() => setActiveFilter(activeFilter === 'CRITICAL' ? null : 'CRITICAL')}
                >
                    <CardContent className="py-4 text-center">
                        <AlertTriangle size={24} className="mx-auto mb-2 text-app-warning" />
                        <p className="text-3xl font-bold text-app-warning">{stats.critical}</p>
                        <p className="text-xs text-app-warning uppercase font-medium">Critical</p>
                    </CardContent>
                </Card>
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-yellow-500 ${activeFilter === 'LOW' ? 'ring-2 ring-yellow-500' : 'hover:shadow-md'}`}
                    onClick={() => setActiveFilter(activeFilter === 'LOW' ? null : 'LOW')}
                >
                    <CardContent className="py-4 text-center">
                        <ShoppingCart size={24} className="mx-auto mb-2 text-app-warning" />
                        <p className="text-3xl font-bold text-app-warning">{stats.low}</p>
                        <p className="text-xs text-app-warning uppercase font-medium">Low Stock</p>
                    </CardContent>
                </Card>
                <Card className="bg-app-info-soft">
                    <CardContent className="py-4 text-center">
                        <DollarSign size={24} className="mx-auto mb-2 text-indigo-400" />
                        <p className="text-xl font-bold text-app-info">{fmt(stats.total_restock_value)}</p>
                        <p className="text-xs text-indigo-400 uppercase font-medium">Restock Cost</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detail Table */}
            <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package size={18} className="text-app-muted-foreground" />
                        Product Details
                    </CardTitle>
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {products.length === 0 ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <Package size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-lg font-medium text-app-success">All stocked up!</p>
                            <p className="text-sm">No products below minimum stock level.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>Severity</TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('product_name')}>
                                        Product {sortKey === 'product_name' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead>Barcode</TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('current_stock')}>
                                        Current {sortKey === 'current_stock' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead className="text-right">Min Level</TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('shortage')}>
                                        Shortage {sortKey === 'shortage' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('restock_value')}>
                                        Restock Value {sortKey === 'restock_value' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p: Record<string, any>) => {
                                    const cfg = SEVERITY_CONFIG[p.severity] || SEVERITY_CONFIG.LOW
                                    const stockPct = p.min_stock_level > 0 ? (p.current_stock / p.min_stock_level) * 100 : 0
                                    return (
                                        <TableRow key={p.product_id} className="hover:bg-app-surface/50">
                                            <TableCell>
                                                <Badge className={`${cfg.bg} ${cfg.color} border`}>
                                                    {cfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{p.product_name}</TableCell>
                                            <TableCell className="font-mono text-xs text-app-muted-foreground">{p.barcode || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-app-surface-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${p.severity === 'OUT' ? 'bg-app-error' : p.severity === 'CRITICAL' ? 'bg-app-warning' : 'bg-app-warning'}`}
                                                            style={{ width: `${Math.min(stockPct, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-semibold tabular-nums">{p.current_stock}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-app-muted-foreground">{p.min_stock_level}</TableCell>
                                            <TableCell className="text-right font-bold text-app-error">-{p.shortage}</TableCell>
                                            <TableCell className="text-right text-sm">{fmt(p.cost_price)}</TableCell>
                                            <TableCell className="text-right font-bold text-app-info">{fmt(p.restock_value)}</TableCell>
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
