'use client'

import { useState, useEffect, useMemo } from "react"
import type { ValuationResponse, Warehouse as WarehouseType } from '@/types/erp'
import { getStockValuation, getWarehouses } from "@/app/actions/inventory/valuation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Package, DollarSign, BarChart3, Warehouse,
    Search, TrendingUp, ArrowUpDown, Boxes
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

function fmtQty(n: number) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
}

const METHOD_BADGES: Record<string, string> = {
    WEIGHTED_AVG: 'bg-app-info-bg text-app-info',
    FIFO: 'bg-app-success-bg text-app-success',
    LIFO: 'bg-purple-100 text-purple-700',
    COST_PRICE: 'bg-app-surface-2 text-app-foreground',
}

type SortKey = 'product_name' | 'quantity' | 'total_value' | 'avg_cost'

export default function InventoryValuationPage() {
    const [data, setData] = useState<ValuationResponse | null>(null)
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('total_value')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    useEffect(() => { loadData() }, [])

    async function loadData(whId?: number) {
        setLoading(true)
        try {
            const [valData, wh] = await Promise.all([
                getStockValuation(whId),
                warehouses.length ? Promise.resolve(warehouses) : getWarehouses()
            ])
            setData(valData)
            if (!warehouses.length) setWarehouses(wh)
        } catch {
            toast.error("Failed to load valuation data")
        } finally {
            setLoading(false)
        }
    }

    function handleWarehouseChange(val: string) {
        setWarehouseFilter(val)
        if (val === 'all') loadData()
        else loadData(Number(val))
    }

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('desc') }
    }

    const products = useMemo(() => {
        if (!data?.products) return []
        let items = [...data.products]
        if (search) {
            const s = search.toLowerCase()
            items = items.filter((p: Record<string, any>) =>
                p.product_name?.toLowerCase().includes(s) ||
                p.product_sku?.toLowerCase().includes(s)
            )
        }
        items.sort((a: Record<string, any>, b: Record<string, any>) => {
            const av = a[sortKey] ?? 0
            const bv = b[sortKey] ?? 0
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
            return sortDir === 'asc' ? av - bv : bv - av
        })
        return items
    }, [data, search, sortKey, sortDir])

    // Compute top products for the bar chart
    const topProducts = useMemo(() => {
        if (!data?.products) return []
        return [...data.products]
            .sort((a: Record<string, any>, b: Record<string, any>) => b.total_value - a.total_value)
            .slice(0, 8)
    }, [data])
    const maxValue = topProducts.length ? Math.max(...topProducts.map((p: Record<string, any>) => p.total_value)) : 1

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-72" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
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
                    <h1>Inventory Valuation</h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Stock value breakdown by product</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Warehouse size={16} className="text-app-muted-foreground" />
                        <select
                            value={warehouseFilter}
                            onChange={e => handleWarehouseChange(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm bg-app-surface"
                        >
                            <option value="all">All Warehouses</option>
                            {warehouses.map((wh: Record<string, any>) => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-app-success-bg flex items-center justify-center">
                                <DollarSign size={20} className="text-app-success" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Stock Value</p>
                                <p className="text-2xl font-bold text-app-foreground">{fmt(data?.summary?.total_value || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-app-info-bg flex items-center justify-center">
                                <Package size={20} className="text-app-info" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Products with Stock</p>
                                <p className="text-2xl font-bold text-app-foreground">{data?.summary?.total_products || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <Boxes size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Units</p>
                                <p className="text-2xl font-bold text-app-foreground">{fmtQty(data?.summary?.total_quantity || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Products Bar Chart */}
            {topProducts.length > 0 && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 size={18} className="text-app-muted-foreground" />
                            Top Products by Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="space-y-2">
                            {topProducts.map((p: Record<string, any>, i: number) => {
                                const pct = (p.total_value / maxValue * 100)
                                return (
                                    <div key={p.product_id} className="flex items-center gap-3">
                                        <span className="text-xs text-app-muted-foreground w-48 truncate font-medium">{p.product_name}</span>
                                        <div className="flex-1 h-6 bg-app-surface rounded overflow-hidden">
                                            <div
                                                className="h-full bg-app-primary rounded flex items-center justify-end pr-2 transition-all"
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            >
                                                {pct > 20 && (
                                                    <span className="text-[10px] text-white font-bold">{fmt(p.total_value)}</span>
                                                )}
                                            </div>
                                        </div>
                                        {pct <= 20 && (
                                            <span className="text-xs text-app-muted-foreground font-mono">{fmt(p.total_value)}</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Detail Table */}
            <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp size={18} className="text-app-muted-foreground" />
                        Product Valuation Details
                    </CardTitle>
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-8 text-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {products.length === 0 ? (
                        <div className="text-center py-12 text-app-muted-foreground">
                            <Package size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No inventory found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('product_name')}>
                                        Product {sortKey === 'product_name' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead>SKU / Barcode</TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('quantity')}>
                                        Qty {sortKey === 'quantity' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('avg_cost')}>
                                        Avg Cost {sortKey === 'avg_cost' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('total_value')}>
                                        Total Value {sortKey === 'total_value' && <ArrowUpDown size={12} className="inline ml-1" />}
                                    </TableHead>
                                    <TableHead>Method</TableHead>
                                    {products.some((p: Record<string, any>) => p.warehouse) && <TableHead>Warehouse</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p: Record<string, any>) => (
                                    <TableRow key={`${p.product_id}-${p.warehouse || ''}`} className="hover:bg-app-surface/50">
                                        <TableCell className="font-medium">{p.product_name}</TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground font-mono">
                                            {p.product_sku || '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">{fmtQty(p.quantity)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(p.avg_cost)}</TableCell>
                                        <TableCell className="text-right font-bold text-app-success">{fmt(p.total_value)}</TableCell>
                                        <TableCell>
                                            <Badge className={METHOD_BADGES[p.method] || 'bg-app-surface-2'}>
                                                {p.method?.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        {products.some((pr: Record<string, any>) => pr.warehouse) && (
                                            <TableCell className="text-sm text-app-muted-foreground">{p.warehouse || '—'}</TableCell>
                                        )}
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
