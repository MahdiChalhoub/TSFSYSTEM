'use client'

import { useState, useEffect, useMemo } from "react"
import type { TaxGroup, TaxSummary } from '@/types/erp'
import { getTaxGroups, getTaxSummary } from "@/app/actions/finance/tax-reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Receipt, Percent, DollarSign, TrendingUp, CheckCircle, AlertCircle, BarChart3
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function TaxReportsPage() {
    const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([])
    const [summary, setSummary] = useState<TaxSummary | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [groups, sumData] = await Promise.all([
                getTaxGroups(),
                getTaxSummary(),
            ])
            setTaxGroups(Array.isArray(groups) ? groups : groups.results || [])
            setSummary(sumData)
        } catch {
            toast.error("Failed to load tax data")
        } finally {
            setLoading(false)
        }
    }

    const totalTaxCollected = parseFloat(summary?.sales?.tax || 0)
    const totalSalesRevenue = parseFloat(summary?.sales?.total || 0)
    const effectiveRate = totalSalesRevenue > 0 ? (totalTaxCollected / totalSalesRevenue * 100) : 0
    const activeGroups = taxGroups.filter(g => g.is_active).length

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
            <header>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
                        <Receipt size={20} className="text-white" />
                    </div>
                    Tax Reports
                </h1>
                <p className="text-sm text-gray-500 mt-1">Tax groups, rates & collection summary (last 30 days)</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-rose-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Tax Collected</p>
                                <p className="text-2xl font-bold text-rose-700">{fmt(totalTaxCollected)}</p>
                                <p className="text-[10px] text-gray-400">Last 30 days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-blue-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Taxable Revenue</p>
                                <p className="text-2xl font-bold text-blue-700">{fmt(totalSalesRevenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Percent size={24} className="text-amber-600" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Effective Rate</p>
                                <p className="text-2xl font-bold text-amber-700">{effectiveRate.toFixed(2)}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 size={24} className="text-green-600" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Tax Groups</p>
                                <p className="text-2xl font-bold text-green-700">{activeGroups}</p>
                                <p className="text-[10px] text-gray-400">{taxGroups.length} total</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tax Groups Table */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Receipt size={18} className="text-gray-400" /> Tax Groups
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {taxGroups.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Receipt size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No tax groups configured</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Rate (%)</TableHead>
                                    <TableHead>Default</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {taxGroups.map((g: any) => (
                                    <TableRow key={g.id} className="hover:bg-gray-50/50">
                                        <TableCell className="font-medium">{g.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className="font-mono">
                                                {parseFloat(g.rate).toFixed(2)}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {g.is_default ? (
                                                <CheckCircle size={16} className="text-green-500" />
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                                                {g.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                                            {g.description || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Tax Collection Summary */}
            {summary && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <DollarSign size={18} className="text-gray-400" /> 30-Day Collection Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-gray-50 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase mb-1">Sales Transactions</p>
                                <p className="text-2xl font-bold">{summary.sales?.count || 0}</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase mb-1">Discounts Applied</p>
                                <p className="text-2xl font-bold text-orange-600">{fmt(parseFloat(summary.sales?.discount || 0))}</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-xl">
                                <p className="text-xs text-gray-500 uppercase mb-1">Net Revenue</p>
                                <p className="text-2xl font-bold text-emerald-600">{fmt(parseFloat(summary.net_revenue || 0))}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
