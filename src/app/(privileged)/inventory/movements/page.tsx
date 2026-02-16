'use client'

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ArrowDownCircle, ArrowUpCircle, RefreshCw, ArrowRightLeft,
    Search, Package, DollarSign, Clock
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
    IN: { icon: ArrowDownCircle, color: 'text-green-600', bg: 'bg-green-100' },
    OUT: { icon: ArrowUpCircle, color: 'text-red-600', bg: 'bg-red-100' },
    ADJUSTMENT: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-100' },
    TRANSFER: { icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-100' },
}

export default function InventoryMovementsPage() {
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<string | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('inventory/inventory-movements/')
            setMovements(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load movement data")
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        let items = movements
        if (typeFilter) items = items.filter(m => m.type === typeFilter)
        if (search) {
            const s = search.toLowerCase()
            items = items.filter(m =>
                (m.product_name || m.product?.name || '').toLowerCase().includes(s) ||
                (m.reference || '').toLowerCase().includes(s) ||
                (m.warehouse_name || m.warehouse?.name || '').toLowerCase().includes(s)
            )
        }
        return items.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }, [movements, typeFilter, search])

    const typeCounts: Record<string, number> = {}
    movements.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1 })

    const totalIn = movements.filter(m => m.type === 'IN').reduce((s, m) => s + parseFloat(m.quantity || 0), 0)
    const totalOut = movements.filter(m => m.type === 'OUT').reduce((s, m) => s + parseFloat(m.quantity || 0), 0)
    const totalValue = movements.reduce((s, m) => s + (parseFloat(m.quantity || 0) * parseFloat(m.cost_price || 0)), 0)

    if (loading) {
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
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <Package size={20} className="text-white" />
                        </div>
                        Inventory Movements
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Stock in/out timeline with cost tracking</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search products, refs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Package size={24} className="text-indigo-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Movements</p>
                                <p className="text-2xl font-bold">{movements.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <ArrowDownCircle size={24} className="text-green-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Stock In</p>
                                <p className="text-2xl font-bold text-green-700">{totalIn.toFixed(0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <ArrowUpCircle size={24} className="text-red-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Stock Out</p>
                                <p className="text-2xl font-bold text-red-700">{totalOut.toFixed(0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-amber-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Value</p>
                                <p className="text-xl font-bold text-amber-700">{fmt(totalValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setTypeFilter(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!typeFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    All ({movements.length})
                </button>
                {Object.entries(typeCounts).map(([type, count]) => {
                    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.IN
                    return (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${typeFilter === type ? 'bg-gray-900 text-white' : `${cfg.bg} ${cfg.color} hover:opacity-80`
                                }`}
                        >
                            {type} ({count})
                        </button>
                    )
                })}
            </div>

            {/* Movements Table */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Package size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No movements found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>Type</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Reference</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.slice(0, 100).map((m: any) => {
                                    const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.IN
                                    const Icon = cfg.icon
                                    const qty = parseFloat(m.quantity || 0)
                                    const cost = parseFloat(m.cost_price || 0)
                                    return (
                                        <TableRow key={m.id} className="hover:bg-gray-50/50">
                                            <TableCell>
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                                    <Icon size={12} />
                                                    {m.type}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">{m.product_name || m.product?.name || `#${m.product}`}</TableCell>
                                            <TableCell className="text-sm text-gray-500">{m.warehouse_name || m.warehouse?.name || `WH-${m.warehouse}`}</TableCell>
                                            <TableCell className={`text-right font-bold ${m.type === 'IN' ? 'text-green-600' : m.type === 'OUT' ? 'text-red-600' : ''}`}>
                                                {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : ''}{qty.toFixed(0)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm">{fmt(cost)}</TableCell>
                                            <TableCell className="text-right font-bold">{fmt(qty * cost)}</TableCell>
                                            <TableCell className="font-mono text-xs text-gray-400">{m.reference || '—'}</TableCell>
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
