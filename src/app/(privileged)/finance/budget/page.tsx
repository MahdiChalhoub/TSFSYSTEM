'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { ChartOfAccount } from '@/types/erp'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Calculator, DollarSign, TrendingUp, TrendingDown,
    PieChart, Target
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

export default function BudgetPlanningPage() {
    const { fmt } = useCurrency()
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [loading, setLoading] = useState(true)
    const settings = useListViewSettings('fin_budget', {
        columns: ['code', 'name', 'balance', 'percentage'],
        pageSize: 25, sortKey: 'balance', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('coa/')
            const accts = Array.isArray(data) ? data : data.results || []
            setAccounts(accts.filter((a: Record<string, any>) =>
                a.type === 'INCOME' || a.type === 'EXPENSE'
            ))
        } catch {
            toast.error("Failed to load account data")
        } finally {
            setLoading(false)
        }
    }

    const incomeAccounts = useMemo(() => accounts.filter(a => a.type === 'INCOME'), [accounts])
    const expenseAccounts = useMemo(() => accounts.filter(a => a.type === 'EXPENSE'), [accounts])

    const totalIncome = useMemo(() => incomeAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0), [incomeAccounts])
    const totalExpense = useMemo(() => expenseAccounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0), [expenseAccounts])
    const netResult = totalIncome - totalExpense

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'code',
            label: 'Code',
            sortable: true,
            render: (a) => <span className="font-mono text-xs text-gray-500">{a.code}</span>
        },
        {
            key: 'name',
            label: 'Account Name',
            sortable: true,
            render: (a) => <span className="font-medium text-sm">{a.name}</span>
        },
        {
            key: 'balance',
            label: 'Current Balance',
            align: 'right',
            sortable: true,
            render: (a) => {
                const bal = parseFloat(a.balance || 0)
                const isPositive = a.type === 'INCOME' ? bal >= 0 : bal <= 0
                return (
                    <span className={`font-bold ${a.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {fmt(Math.abs(bal))}
                    </span>
                )
            }
        },
        {
            key: 'percentage',
            label: '% of Total',
            align: 'right',
            render: (a) => {
                const bal = parseFloat(a.balance || 0)
                const total = a.type === 'INCOME' ? totalIncome : totalExpense
                const pct = total !== 0 ? (Math.abs(bal) / Math.abs(total) * 100) : 0
                const color = a.type === 'INCOME' ? 'bg-emerald-400' : 'bg-rose-400'
                return (
                    <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                            <div className={`h-full rounded-full ${color}`}
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                )
            }
        }
    ], [fmt, totalIncome, totalExpense])

    if (loading) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                </div>
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                            <PieChart size={28} className="text-white" />
                        </div>
                        Budget <span className="text-violet-600">Management</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Financial Planning & Variance Tracking</p>
                </div>
                <Badge variant="outline" className="h-10 px-4 rounded-xl border-violet-200 bg-violet-50 text-violet-700 font-bold gap-2">
                    <Target size={16} /> Fiscal Year 2026
                </Badge>
            </header>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <TrendingUp size={22} className="text-emerald-700" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Total Income</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-0.5">{fmt(Math.abs(totalIncome))}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-200/60 flex items-center justify-center">
                                <TrendingDown size={22} className="text-rose-700" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Total Expenses</p>
                                <p className="text-2xl font-bold text-rose-900 mt-0.5">{fmt(Math.abs(totalExpense))}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`rounded-2xl border-0 shadow-sm ${netResult >= 0 ? 'bg-gradient-to-br from-green-50 to-green-100/50' : 'bg-gradient-to-br from-red-50 to-red-100/50'}`}>
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl ${netResult >= 0 ? 'bg-green-200/60' : 'bg-red-200/60'} flex items-center justify-center`}>
                                <DollarSign size={22} className={netResult >= 0 ? 'text-green-700' : 'text-red-700'} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest">Net Result</p>
                                <p className={`text-2xl font-bold mt-0.5 ${netResult >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                                    {fmt(Math.abs(netResult))}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100/50">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-200/60 flex items-center justify-center">
                                <Calculator size={22} className="text-cyan-700" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-cyan-600 uppercase tracking-widest">Global Margin</p>
                                <p className="text-2xl font-bold text-cyan-900 mt-0.5">
                                    {totalIncome !== 0 ? ((netResult / Math.abs(totalIncome)) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Income/Expense Ratio Bar */}
            <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <CardContent className="py-6 px-8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black uppercase tracking-tighter text-emerald-600">Assets / Income</span>
                        <span className="text-xs font-black uppercase tracking-tighter text-rose-600">Liabilities / Expenses</span>
                    </div>
                    <div className="h-6 bg-stone-100 rounded-2xl overflow-hidden flex shadow-inner">
                        {Math.abs(totalIncome) + Math.abs(totalExpense) > 0 ? (
                            <>
                                <div
                                    className="h-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-900"
                                    style={{ width: `${(Math.abs(totalIncome) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100}%` }}
                                >
                                    {((Math.abs(totalIncome) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100).toFixed(0)}%
                                </div>
                                <div
                                    className="h-full bg-rose-400 flex items-center justify-center text-[10px] font-bold text-rose-900"
                                    style={{ width: `${(Math.abs(totalExpense) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100}%` }}
                                >
                                    {((Math.abs(totalExpense) / (Math.abs(totalIncome) + Math.abs(totalExpense))) * 100).toFixed(0)}%
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-[10px] text-stone-400 uppercase font-bold">No Data Available</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <TypicalListView
                    title="Revenue Streams"
                    data={incomeAccounts}
                    loading={loading}
                    getRowId={(a) => a.id}
                    columns={columns}
                    className="rounded-2xl border-0 shadow-sm overflow-hidden"
                    visibleColumns={settings.visibleColumns}
                    onToggleColumn={settings.toggleColumn}
                    pageSize={settings.pageSize}
                    onPageSizeChange={settings.setPageSize}
                    sortKey={settings.sortKey}
                    sortDir={settings.sortDir}
                    onSort={settings.setSort}
                />

                <TypicalListView
                    title="Operating Expenses"
                    data={expenseAccounts}
                    loading={loading}
                    getRowId={(a) => a.id}
                    columns={columns}
                    className="rounded-2xl border-0 shadow-sm overflow-hidden"
                    visibleColumns={settings.visibleColumns}
                    onToggleColumn={settings.toggleColumn}
                    pageSize={settings.pageSize}
                    onPageSizeChange={settings.setPageSize}
                    sortKey={settings.sortKey}
                    sortDir={settings.sortDir}
                    onSort={settings.setSort}
                />
            </div>
        </div>
    )
}
