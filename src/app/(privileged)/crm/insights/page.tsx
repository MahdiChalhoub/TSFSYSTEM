'use client'

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Users, DollarSign, ShoppingCart, TrendingUp, Search, Star, Crown
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function CustomerInsightsPage() {
    const [contacts, setContacts] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [contactsData, ordersData] = await Promise.all([
                erpFetch('crm/contacts/'),
                erpFetch('pos/pos/'),
            ])
            setContacts((Array.isArray(contactsData) ? contactsData : contactsData.results || [])
                .filter((c: any) => c.type === 'CLIENT' || c.type === 'CUSTOMER' || c.type === 'BOTH'))
            setOrders(Array.isArray(ordersData) ? ordersData : ordersData.results || [])
        } catch {
            toast.error("Failed to load customer data")
        } finally {
            setLoading(false)
        }
    }

    const enriched = useMemo(() => {
        return contacts.map(c => {
            const cOrders = orders.filter(o =>
                (o.contact === c.id || o.contact_id === c.id) && o.type === 'SALE'
            )
            const totalSpent = cOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
            const completedOrders = cOrders.filter(o => o.status === 'COMPLETED')
            const lastOrder = cOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

            // Calculate recency in days
            const lastDate = lastOrder?.created_at ? new Date(lastOrder.created_at) : null
            const daysSinceLast = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : 999

            // Simple tier based on total
            let tier = 'Bronze'
            if (totalSpent > 5000000) tier = 'Diamond'
            else if (totalSpent > 2000000) tier = 'Gold'
            else if (totalSpent > 500000) tier = 'Silver'

            return {
                ...c,
                orderCount: cOrders.length,
                totalSpent,
                avgOrderValue: cOrders.length > 0 ? totalSpent / cOrders.length : 0,
                lastOrderDate: lastOrder?.created_at,
                daysSinceLast,
                tier,
            }
        }).sort((a, b) => b.totalSpent - a.totalSpent)
    }, [contacts, orders])

    const filtered = useMemo(() => {
        if (!search) return enriched
        const s = search.toLowerCase()
        return enriched.filter(c =>
            (c.name || '').toLowerCase().includes(s) ||
            (c.email || '').toLowerCase().includes(s) ||
            (c.phone || '').toLowerCase().includes(s)
        )
    }, [enriched, search])

    const totalRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0)
    const activeCustomers = enriched.filter(c => c.daysSinceLast < 30).length
    const avgOrderVal = enriched.length > 0 ? enriched.reduce((s, c) => s + c.avgOrderValue, 0) / enriched.filter(c => c.orderCount > 0).length || 0 : 0

    const TIER_STYLE: Record<string, string> = {
        Diamond: 'bg-violet-100 text-violet-700',
        Gold: 'bg-amber-100 text-amber-700',
        Silver: 'bg-gray-200 text-gray-700',
        Bronze: 'bg-orange-100 text-orange-700',
    }

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
                        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                            <Crown size={20} className="text-white" />
                        </div>
                        Customer Insights
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Customer segmentation, tier analysis & spending patterns</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Users size={24} className="text-violet-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Customers</p>
                                <p className="text-2xl font-bold">{contacts.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-green-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Active (30d)</p>
                                <p className="text-2xl font-bold text-green-700">{activeCustomers}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-emerald-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                                <p className="text-xl font-bold text-emerald-700">{fmt(totalRevenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={24} className="text-blue-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Avg Order Value</p>
                                <p className="text-xl font-bold text-blue-700">{fmt(avgOrderVal)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tier Distribution */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Tier Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        {['Diamond', 'Gold', 'Silver', 'Bronze'].map(tier => {
                            const count = enriched.filter(c => c.tier === tier).length
                            const pct = enriched.length > 0 ? (count / enriched.length * 100) : 0
                            return (
                                <div key={tier} className="flex-1 text-center">
                                    <div className={`py-3 rounded-xl ${TIER_STYLE[tier]}`}>
                                        <p className="text-xs font-medium uppercase">{tier}</p>
                                        <p className="text-2xl font-bold">{count}</p>
                                        <p className="text-[10px] opacity-60">{pct.toFixed(0)}%</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Customer Table */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Users size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No customers found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>#</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Tier</TableHead>
                                    <TableHead className="text-right">Orders</TableHead>
                                    <TableHead className="text-right">Total Spent</TableHead>
                                    <TableHead className="text-right">Avg Order</TableHead>
                                    <TableHead>Recency</TableHead>
                                    <TableHead>Last Order</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((c: any, i: number) => (
                                    <TableRow key={c.id} className="hover:bg-gray-50/50">
                                        <TableCell className="font-bold text-gray-400">{i + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-violet-600">
                                                        {(c.name || '?').charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{c.name || 'Unknown'}</p>
                                                    {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={TIER_STYLE[c.tier]}>{c.tier}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{c.orderCount}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">{fmt(c.totalSpent)}</TableCell>
                                        <TableCell className="text-right text-sm">{fmt(c.avgOrderValue)}</TableCell>
                                        <TableCell>
                                            <Badge className={
                                                c.daysSinceLast < 7 ? 'bg-green-100 text-green-700' :
                                                    c.daysSinceLast < 30 ? 'bg-yellow-100 text-yellow-700' :
                                                        c.daysSinceLast < 90 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-red-100 text-red-700'
                                            }>
                                                {c.daysSinceLast < 999 ? `${c.daysSinceLast}d` : 'Never'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500">
                                            {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('fr-FR') : '\u2014'}
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
