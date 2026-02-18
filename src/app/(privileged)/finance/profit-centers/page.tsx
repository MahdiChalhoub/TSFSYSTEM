'use client'

import { useState, useEffect, useMemo } from "react"
import type { ChartOfAccount } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Building2, DollarSign, TrendingUp, TrendingDown, Percent
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function ProfitCentersPage() {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('coa/')
            setAccounts(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load account data")
        } finally {
            setLoading(false)
        }
    }

    // Group SYSCOHADA accounts by class prefix to create "profit centers"
    const centers = useMemo(() => {
        const classGroups: Record<string, { name: string; income: number; expense: number; accounts: any[] }> = {}

        const CLASS_NAMES: Record<string, string> = {
            '1': 'Capital & Reserves',
            '2': 'Fixed Assets',
            '3': 'Inventories',
            '4': 'Third Parties (AR/AP)',
            '5': 'Cash & Banks',
            '6': 'Expenses',
            '7': 'Revenue',
            '8': 'Special Accounts',
        }

        accounts.forEach(a => {
            const code = String(a.code || '')
            const cls = code.charAt(0)
            if (!cls || !CLASS_NAMES[cls]) return

            if (!classGroups[cls]) {
                classGroups[cls] = { name: CLASS_NAMES[cls], income: 0, expense: 0, accounts: [] }
            }

            const bal = parseFloat(a.balance || 0)
            classGroups[cls].accounts.push(a)

            if (a.type === 'INCOME' || cls === '7') {
                classGroups[cls].income += Math.abs(bal)
            } else if (a.type === 'EXPENSE' || cls === '6') {
                classGroups[cls].expense += Math.abs(bal)
            } else if (bal >= 0) {
                classGroups[cls].income += bal
            } else {
                classGroups[cls].expense += Math.abs(bal)
            }
        })

        return Object.entries(classGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cls, data]) => ({
                class: cls,
                ...data,
                net: data.income - data.expense,
            }))
    }, [accounts])

    const totalIncome = centers.reduce((s, c) => s + c.income, 0)
    const totalExpense = centers.reduce((s, c) => s + c.expense, 0)
    const totalNet = totalIncome - totalExpense

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
                    <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
                        <Building2 size={20} className="text-white" />
                    </div>
                    Profit Centers
                </h1>
                <p className="text-sm text-gray-500 mt-1">SYSCOHADA class-based profit center analysis</p>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Building2 size={24} className="text-purple-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Centers</p>
                                <p className="text-2xl font-bold">{centers.length}</p>
                                <p className="text-[10px] text-gray-400">{accounts.length} accounts</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-green-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Debits</p>
                                <p className="text-xl font-bold text-green-700">{fmt(totalIncome)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingDown size={24} className="text-red-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Credits</p>
                                <p className="text-xl font-bold text-red-700">{fmt(totalExpense)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border-l-4 ${totalNet >= 0 ? 'border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white' : 'border-l-rose-500 bg-gradient-to-r from-rose-50 to-white'}`}>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className={totalNet >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Net Position</p>
                                <p className={`text-xl font-bold ${totalNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {fmt(Math.abs(totalNet))}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Profit Center Cards */}
            <div className="grid grid-cols-2 gap-4">
                {centers.map(c => (
                    <Card key={c.class} className="hover:shadow-md transition-all">
                        <CardHeader className="py-3 pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <span className="font-bold text-purple-600 text-sm">{c.class}</span>
                                    </div>
                                    {c.name}
                                </div>
                                <Badge variant="outline">{c.accounts.length} accts</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div className="text-center p-2 bg-green-50 rounded-lg">
                                    <p className="text-[10px] text-gray-500 uppercase">Debit</p>
                                    <p className="text-sm font-bold text-green-600">{fmt(c.income)}</p>
                                </div>
                                <div className="text-center p-2 bg-red-50 rounded-lg">
                                    <p className="text-[10px] text-gray-500 uppercase">Credit</p>
                                    <p className="text-sm font-bold text-red-600">{fmt(c.expense)}</p>
                                </div>
                                <div className={`text-center p-2 rounded-lg ${c.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                    <p className="text-[10px] text-gray-500 uppercase">Net</p>
                                    <p className={`text-sm font-bold ${c.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {fmt(Math.abs(c.net))}
                                    </p>
                                </div>
                            </div>
                            {/* Top 5 accounts in this center */}
                            <div className="space-y-1">
                                {c.accounts
                                    .sort((a, b) => Math.abs(parseFloat(b.balance || 0)) - Math.abs(parseFloat(a.balance || 0)))
                                    .slice(0, 5)
                                    .map((a: any) => {
                                        const bal = parseFloat(a.balance || 0)
                                        const total = Math.max(c.income, c.expense, 1)
                                        const pct = (Math.abs(bal) / total * 100)
                                        return (
                                            <div key={a.id} className="flex items-center gap-2 text-xs">
                                                <span className="font-mono text-gray-400 w-14">{a.code}</span>
                                                <span className="flex-1 truncate">{a.name}</span>
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-300 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className="font-bold w-20 text-right">{fmt(Math.abs(bal))}</span>
                                            </div>
                                        )
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
