'use client'

import { useState, useEffect, useMemo } from "react"
import type { ChartOfAccount, JournalEntry } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    TrendingUp, DollarSign, BarChart3, Percent
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function RevenueBreakdownPage() {
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
            setAccounts((Array.isArray(accts) ? accts : accts.results || []).filter((a: Record<string, any>) => a.type === 'INCOME'))
            setJournals(Array.isArray(jrnls) ? jrnls : jrnls.results || [])
        } catch {
            toast.error("Failed to load revenue data")
        } finally {
            setLoading(false)
        }
    }

    // Enrich income accounts with journal entry counts
    const enriched = useMemo(() => {
        return accounts.map(a => {
            const entries = journals.filter(j =>
                j.account === a.id || j.account_id === a.id ||
                j.credit_account === a.id || j.debit_account === a.id
            )
            const bal = Math.abs(Number(a.balance || 0))
            return { ...a, journalCount: entries.length, balance: bal }
        }).sort((a, b) => b.balance - a.balance)
    }, [accounts, journals])

    const totalRevenue = enriched.reduce((s, a) => s + a.balance, 0)
    const topAccount = enriched[0]
    const avgBalance = enriched.length > 0 ? totalRevenue / enriched.length : 0

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
                <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    Revenue Breakdown
                </h1>
                <p className="text-sm text-app-muted-foreground mt-1">Detailed analysis of all income accounts</p>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Revenue</p>
                                <p className="text-xl font-bold text-app-success">{fmt(totalRevenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Income Accounts</p>
                                <p className="text-2xl font-bold text-app-info">{accounts.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-violet-500" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Avg per Account</p>
                                <p className="text-xl font-bold text-violet-700">{fmt(avgBalance)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Percent size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Top Account</p>
                                <p className="text-sm font-bold text-app-warning truncate">{topAccount?.name || '\u2014'}</p>
                                <p className="text-[10px] text-app-muted-foreground">{topAccount ? `${(topAccount.balance / totalRevenue * 100).toFixed(1)}% of total` : ''}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue Waterfall */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Revenue Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {enriched.map((a: Record<string, any>) => {
                            const pct = totalRevenue > 0 ? (a.balance / totalRevenue * 100) : 0
                            return (
                                <div key={a.id} className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-app-muted-foreground w-14">{a.code}</span>
                                    <span className="text-sm w-48 truncate">{a.name}</span>
                                    <div className="flex-1 h-5 bg-app-surface-2 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                        {pct > 10 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                                {pct.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-sm font-bold w-28 text-right">{fmt(a.balance)}</span>
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
                            <TableRow className="bg-app-surface/50">
                                <TableHead>#</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">% of Revenue</TableHead>
                                <TableHead className="text-right">Journal Entries</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enriched.map((a: Record<string, any>, i: number) => {
                                const pct = totalRevenue > 0 ? (a.balance / totalRevenue * 100) : 0
                                return (
                                    <TableRow key={a.id} className="hover:bg-app-surface/50">
                                        <TableCell className="font-bold text-app-muted-foreground">{i + 1}</TableCell>
                                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                                        <TableCell className="font-medium text-sm">{a.name}</TableCell>
                                        <TableCell className="text-right font-bold text-app-success">{fmt(a.balance)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <div className="w-12 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className="text-xs text-app-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-app-muted-foreground">{a.journalCount}</TableCell>
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
