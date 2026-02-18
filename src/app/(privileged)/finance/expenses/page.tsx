'use client'

import { useState, useEffect, useMemo } from "react"
import type { ChartOfAccount, JournalEntry } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    TrendingDown, DollarSign, BarChart3, AlertTriangle, Percent
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function ExpenseTrackerPage() {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [journals, setJournals] = useState<JournalEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [accts, jrnls] = await Promise.all([
                erpFetch('coa/'),
                erpFetch('finance/journal/'),
            ])
            setAccounts((Array.isArray(accts) ? accts : accts.results || []).filter((a: Record<string, any>) => a.type === 'EXPENSE'))
            setJournals(Array.isArray(jrnls) ? jrnls : jrnls.results || [])
        } catch {
            toast.error("Failed to load expense data")
        } finally {
            setLoading(false)
        }
    }

    const enriched = useMemo(() => {
        return accounts.map(a => {
            const entries = journals.filter(j =>
                j.account === a.id || j.account_id === a.id ||
                j.credit_account === a.id || j.debit_account === a.id
            )
            const bal = Math.abs(parseFloat(a.balance || 0))
            return { ...a, journalCount: entries.length, absBalance: bal }
        }).sort((a, b) => b.absBalance - a.absBalance)
    }, [accounts, journals])

    const totalExpense = enriched.reduce((s, a) => s + a.absBalance, 0)
    const topAccount = enriched[0]
    const accountsWithActivity = enriched.filter(a => a.journalCount > 0).length
    const top3Pct = enriched.length >= 3
        ? ((enriched[0].absBalance + enriched[1].absBalance + enriched[2].absBalance) / totalExpense * 100)
        : 100

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
                        <TrendingDown size={20} className="text-white" />
                    </div>
                    Expense Tracker
                </h1>
                <p className="text-sm text-gray-500 mt-1">Detailed analysis of all expense accounts</p>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-rose-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Expenses</p>
                                <p className="text-xl font-bold text-rose-700">{fmt(totalExpense)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 size={24} className="text-blue-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Expense Accounts</p>
                                <p className="text-2xl font-bold text-blue-700">{accounts.length}</p>
                                <p className="text-[10px] text-gray-400">{accountsWithActivity} active</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={24} className="text-amber-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Top Expense</p>
                                <p className="text-sm font-bold text-amber-700 truncate">{topAccount?.name || '\u2014'}</p>
                                <p className="text-[10px] text-gray-400">{topAccount ? fmt(topAccount.absBalance) : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Percent size={24} className="text-purple-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Top 3 Concentration</p>
                                <p className="text-2xl font-bold text-purple-700">{top3Pct.toFixed(0)}%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Expense Distribution Bars */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Expense Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {enriched.filter(a => a.absBalance > 0).map((a: Record<string, any>) => {
                            const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
                            return (
                                <div key={a.id} className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-gray-400 w-14">{a.code}</span>
                                    <span className="text-sm w-48 truncate">{a.name}</span>
                                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                        {pct > 10 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                                {pct.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold w-28 text-right">{fmt(a.absBalance)}</span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Detail Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead>#</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">% of Expenses</TableHead>
                                <TableHead className="text-right">Journal Entries</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enriched.map((a: Record<string, any>, i: number) => {
                                const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
                                return (
                                    <TableRow key={a.id} className="hover:bg-gray-50/50">
                                        <TableCell className="font-bold text-gray-400">{i + 1}</TableCell>
                                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                                        <TableCell className="font-medium text-sm">{a.name}</TableCell>
                                        <TableCell className="text-right font-bold text-rose-600">{fmt(a.absBalance)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-gray-500">{a.journalCount}</TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
