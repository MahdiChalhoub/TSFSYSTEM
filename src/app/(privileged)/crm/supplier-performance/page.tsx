'use client'

import { useState, useEffect, useMemo } from "react"
import { Contact } from "@/types/erp"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Truck, DollarSign, Package, Star, Search,
} from "lucide-react"

interface PurchaseOrderRow {
    id?: number
    contact?: number
    contact_id?: number
    status?: string
    total_amount?: string | number
    created_at?: string
    [key: string]: unknown
}

interface ListResponse<T> {
    results?: T[]
}

interface EnrichedSupplier extends Contact {
    orderCount: number
    totalSpent: number
    completedOrders: number
    completionRate: number
    lastOrderDate?: string
    avgOrderValue: number
}

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

function asArr<T>(d: unknown): T[] {
    if (Array.isArray(d)) return d as T[]
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as ListResponse<T>).results
        return Array.isArray(r) ? r : []
    }
    return []
}

export default function SupplierPerformancePage() {
    const [suppliers, setSuppliers] = useState<Contact[]>([])
    const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [contactsData, ordersData] = await Promise.all([
                erpFetch('crm/contacts/'),
                erpFetch('pos/purchase/'),
            ])
            const contacts = asArr<Contact>(contactsData)
            setSuppliers(contacts.filter((c) => {
                const t = c.type as string | undefined
                return t === 'SUPPLIER' || t === 'BOTH'
            }))
            setOrders(asArr<PurchaseOrderRow>(ordersData))
        } catch {
            toast.error("Failed to load supplier data")
        } finally {
            setLoading(false)
        }
    }

    // Enrich suppliers with their order stats
    const enriched = useMemo<EnrichedSupplier[]>(() => {
        return suppliers.map(s => {
            const sOrders = orders.filter(o =>
                o.contact === s.id || o.contact_id === s.id
            )
            const totalSpent = sOrders.reduce((sum, o) => sum + parseFloat(String(o.total_amount ?? 0)), 0)
            const completedOrders = sOrders.filter(o => o.status === 'COMPLETED')
            const completionRate = sOrders.length > 0 ? (completedOrders.length / sOrders.length * 100) : 0
            const lastOrder = sOrders.sort(
                (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
            )[0]

            return {
                ...s,
                orderCount: sOrders.length,
                totalSpent,
                completedOrders: completedOrders.length,
                completionRate,
                lastOrderDate: lastOrder?.created_at,
                avgOrderValue: sOrders.length > 0 ? totalSpent / sOrders.length : 0,
            }
        }).sort((a, b) => b.totalSpent - a.totalSpent)
    }, [suppliers, orders])

    const filtered = useMemo(() => {
        if (!search) return enriched
        const s = search.toLowerCase()
        return enriched.filter(sup =>
            (sup.name || '').toLowerCase().includes(s) ||
            (sup.email || '').toLowerCase().includes(s)
        )
    }, [enriched, search])

    const totalPurchaseValue = enriched.reduce((s, sup) => s + sup.totalSpent, 0)
    const activeSuppliers = enriched.filter(s => s.orderCount > 0).length
    const avgCompletionRate = enriched.length > 0
        ? enriched.reduce((s, sup) => s + sup.completionRate, 0) / enriched.length : 0

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
                    <h1 className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-success flex items-center justify-center">
                            <Truck size={20} className="text-white" />
                        </div>
                        Supplier Performance
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Vendor analysis, spend tracking & delivery rates</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Truck size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Suppliers</p>
                                <p className="text-2xl font-bold">{suppliers.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Package size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Active Suppliers</p>
                                <p className="text-2xl font-bold text-app-info">{activeSuppliers}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Spend</p>
                                <p className="text-xl font-bold text-app-success">{fmt(totalPurchaseValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Star size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Avg Completion</p>
                                <p className="text-2xl font-bold text-app-warning">{avgCompletionRate.toFixed(0)}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <Truck size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No suppliers found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>#</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead className="text-right">Orders</TableHead>
                                    <TableHead className="text-right">Total Spend</TableHead>
                                    <TableHead className="text-right">Avg Order</TableHead>
                                    <TableHead>Completion</TableHead>
                                    <TableHead>Last Order</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((s: Record<string, any>, i: number) => (
                                    <TableRow key={s.id} className="hover:bg-app-surface/50">
                                        <TableCell className="font-bold text-app-muted-foreground">{i + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-app-success-soft flex items-center justify-center">
                                                    <span className="text-xs font-bold text-app-success">
                                                        {(s.name || '?').charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{s.name || 'Unknown'}</p>
                                                    {s.phone && <p className="text-[10px] text-app-muted-foreground">{s.phone}</p>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{s.orderCount}</TableCell>
                                        <TableCell className="text-right font-bold text-app-success">{fmt(s.totalSpent)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(s.avgOrderValue)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${s.completionRate >= 80 ? 'bg-green-400' : s.completionRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                        style={{ width: `${s.completionRate}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-app-muted-foreground">{s.completionRate.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-app-muted-foreground">
                                            {s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString('fr-FR') : '—'}
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
