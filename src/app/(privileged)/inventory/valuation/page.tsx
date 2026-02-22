'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo, useCallback } from "react"
import type { ValuationResponse, Warehouse as WarehouseType } from '@/types/erp'
import { getStockValuation, getWarehouses } from "@/app/actions/inventory/valuation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TypicalListView, type ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from "@/components/common/TypicalFilter"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Package, DollarSign, BarChart3, Building2,
    TrendingUp, Boxes, Landmark, RefreshCw
} from "lucide-react"
import { Button } from '@/components/ui/button'

function fmtQty(n: number) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
}

const METHOD_BADGES: Record<string, string> = {
    WEIGHTED_AVG: 'bg-blue-100 text-blue-700 border-blue-200',
    FIFO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    LIFO: 'bg-purple-100 text-purple-700 border-purple-200',
    COST_PRICE: 'bg-stone-100 text-stone-700 border-stone-200',
}

export default function AssetValuationEnginePage() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_valuation', {
        columns: ['product_name', 'sku', 'quantity', 'avg_cost', 'total_value', 'method'],
        pageSize: 25,
        sortKey: 'total_value',
        sortDir: 'desc',
    })
    const [data, setData] = useState<ValuationResponse | null>(null)
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
    const [search, setSearch] = useState('')

    const loadData = useCallback(async (whId?: number) => {
        setLoading(true)
        try {
            const [valData, wh] = await Promise.all([
                getStockValuation(whId),
                getWarehouses()
            ])
            setData(valData)
            setWarehouses(wh)
        } catch {
            toast.error("Valuation sync failed")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleWarehouseChange = (val: string) => {
        setWarehouseFilter(val)
        if (val === 'all') loadData()
        else loadData(Number(val))
    }

    const columns: ColumnDef<any>[] = [
        { key: 'product_name', label: 'Asset Entity', sortable: true, alwaysVisible: true, render: r => <span className="font-bold text-gray-900">{r.product_name}</span> },
        { key: 'sku', label: 'SKU/Code', render: r => <span className="font-mono text-[10px] text-gray-400 font-black tracking-tighter uppercase">{r.product_sku || '—'}</span> },
        { key: 'quantity', label: 'Reserved Volume', align: 'right', sortable: true, render: r => <span className="font-black text-gray-900">{fmtQty(r.quantity)} <span className="text-[10px] text-gray-300">U</span></span> },
        { key: 'avg_cost', label: 'Asset Basis', align: 'right', sortable: true, render: r => <span className="text-gray-500 font-medium">{fmt(r.avg_cost)}</span> },
        { key: 'total_value', label: 'Market Exposure', align: 'right', sortable: true, render: r => <span className="font-black text-emerald-600">{fmt(r.total_value)}</span> },
        {
            key: 'method', label: 'Valuation Protocol', render: r => (
                <Badge variant="outline" className={`${METHOD_BADGES[r.method] || 'bg-gray-100'} text-[9px] font-black uppercase tracking-tighter py-0.5`}>
                    {r.method?.replace('_', ' ')}
                </Badge>
            )
        },
    ]

    const items = useMemo(() => {
        if (!data?.products) return []
        return data.products
    }, [data])

    // Top Products Logic
    const topProducts = useMemo(() => {
        if (!data?.products) return []
        return [...data.products]
            .sort((a: any, b: any) => b.total_value - a.total_value)
            .slice(0, 5)
    }, [data])
    const maxValue = topProducts.length ? Math.max(...topProducts.map((p: any) => p.total_value)) : 1

    if (loading && !data) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-20 w-1/2 rounded-2xl" />
                <div className="grid grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
                </div>
                <Skeleton className="h-[500px] rounded-[2rem]" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Landmark size={28} className="text-white" />
                        </div>
                        Asset <span className="text-emerald-600">Valuation</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Asset Equity & Inventory Exposure</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Valuation Engine Synced</span>
                </div>
            </header>

            {/* Global Equity Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Equity Exposure</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(data?.summary?.total_value || 0)}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Asset Diversity</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{data?.summary?.total_products || 0} <span className="text-sm text-gray-300">SKUs</span></h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Boxes size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Aggregate Units</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmtQty(data?.summary?.total_quantity || 0)}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TypicalListView
                        title="Asset Master List"
                        data={items}
                        loading={loading}
                        getRowId={r => `${r.product_id}-${r.warehouse || ''}`}
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
                            <div className="flex items-center gap-2">
                                <Button onClick={() => loadData()} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-emerald-600">
                                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                </Button>
                            </div>
                        }
                    >
                        <TypicalFilter
                            search={{ placeholder: 'Asset Entity or SKU...', value: search, onChange: setSearch }}
                            filters={[
                                { key: 'warehouse', label: 'Terminal Node', type: 'select', options: [{ value: 'all', label: 'All Warehouses' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))] }
                            ]}
                            values={{ warehouse: warehouseFilter }}
                            onChange={(k, v) => handleWarehouseChange(String(v))}
                        />
                    </TypicalListView>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {/* Top Concentrations Bar Chart */}
                    <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden h-full">
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-base font-black flex items-center gap-2 text-gray-400 uppercase tracking-tighter">
                                <TrendingUp size={18} className="text-emerald-500" />
                                Asset Concentration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                            <div className="space-y-6 mt-4">
                                {topProducts.map((p: any) => {
                                    const pct = (p.total_value / maxValue * 100)
                                    return (
                                        <div key={p.product_id} className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight truncate w-32">{p.product_name}</span>
                                                <span className="text-[10px] font-black text-emerald-600 font-mono">{fmt(p.total_value)}</span>
                                            </div>
                                            <div className="h-2 bg-stone-50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full shadow-lg shadow-emerald-100 transition-all duration-1000"
                                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="mt-12 p-5 bg-stone-50 rounded-[1.5rem] border border-stone-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 transition-transform hover:rotate-12">
                                        <BarChart3 size={20} />
                                    </div>
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Equity Pareto Analysis</span>
                                </div>
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded-lg">CALCULATED</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
