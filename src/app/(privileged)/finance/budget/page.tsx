'use client'

import { useState, useEffect, useMemo } from "react"
import type { ChartOfAccount } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Calculator, DollarSign, TrendingUp, TrendingDown, AlertTriangle
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function BudgetPlanningPage() {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('coa/')
            const accts = Array.isArray(data) ? data : data.results || []
            // Only show income and expense accounts for budget view
            setAccounts(accts.filter((a: Record<string, any>) =>
                a.type === 'INCOME' || a.type === 'EXPENSE'
            ))
        } catch {
            toast.error("Failed to load account data")
        } finally {
            setLoading(false)
        }
    }

    const incomeAccounts = accounts.filter(a => a.type === 'INCOME')
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE')

    const totalIncome = incomeAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)
    const totalExpense = expenseAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)
    const netResult = totalIncome - totalExpense

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    const renderAccountTable = (accts: Record<string, any>[], title: string, icon: React.ReactNode, color: string) => (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                    {icon} {title}
                    <Badge className="ml-auto bg-app-surface-2 text-app-muted-foreground">{accts.length} accounts</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {accts.length === 0 ? (
                    <div className="text-center py-8 text-app-muted-foreground">No accounts</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-app-surface/50">
                                <TableHead>Code</TableHead>
                                <TableHead>Account Name</TableHead>
                                <TableHead className="text-right">Current Balance</TableHead>
                                <TableHead className="text-right">% of Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accts
                                .sort((a, b) => Math.abs(Number(b.balance || 0)) - Math.abs(Number(a.balance || 0)))
                                .map((a: Record<string, any>) => {
                                    const bal = Number(a.balance || 0)
                                    const total = title.includes('Income') ? totalIncome : totalExpense
                                    const pct = total !== 0 ? (Math.abs(bal) / Math.abs(total) * 100) : 0
                                    return (
                                        <TableRow key={a.id} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-xs text-app-muted-foreground">{a.code}</TableCell>
                                            <TableCell className="font-medium text-sm">{a.name}</TableCell>
                                            <TableCell className={`text-right font-bold ${color}`}>
                                                {fmt(Math.abs(bal))}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <div className="w-16 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${color.includes('emerald') ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                                            style={{ width: `${Math.min(pct, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs text-app-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center">
                        <Calculator size={20} className="text-white" />
                    </div>
                    Budget Overview
                </h1>
                <p className="text-sm text-app-muted-foreground mt-1">Income vs Expense breakdown by COA accounts</p>
            </header>

            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Income</p>
                                <p className="text-xl font-bold text-app-success">{fmt(Math.abs(totalIncome))}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <TrendingDown size={24} className="text-app-error" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Expenses</p>
                                <p className="text-xl font-bold text-app-error">{fmt(Math.abs(totalExpense))}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border-l-4 ${netResult >= 0 ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-white' : 'border-l-red-500 bg-gradient-to-r from-red-50 to-white'}`}>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className={netResult >= 0 ? 'text-app-success' : 'text-app-error'} />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Net Result</p>
                                <p className={`text-xl font-bold ${netResult >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                                    {fmt(Math.abs(netResult))}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Calculator size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Margin</p>
                                <p className="text-xl font-bold text-app-info">
                                    {totalIncome !== 0 ? ((netResult / Math.abs(totalIncome)) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Income/Expense Ratio Bar */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-medium text-app-success">Income</span>
                        <div className="flex-1 h-4 bg-app-surface-2 rounded-full overflow-hidden flex">
                            {Math.abs(totalIncome) + Math.abs(totalExpense) > 0 && (
                                <>
                                    <div
                                        className="h-full bg-emerald-400 rounded-l-full"
                                        style={{ width: `${(Math.abs(totalIncome) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100}%` }}
                                    />
                                    <div
                                        className="h-full bg-rose-400 rounded-r-full"
                                        style={{ width: `${(Math.abs(totalExpense) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100}%` }}
                                    />
                                </>
                            )}
                        </div>
                        <span className="text-xs font-medium text-app-error">Expense</span>
                    </div>
                </CardContent>
            </Card>

            {renderAccountTable(
                incomeAccounts, 'Income Accounts',
                <TrendingUp size={18} className="text-app-success" />,
                'text-app-success'
            )}

            {renderAccountTable(
                expenseAccounts, 'Expense Accounts',
                <TrendingDown size={18} className="text-app-error" />,
                'text-app-error'
            )}
        </div>
    )
}
