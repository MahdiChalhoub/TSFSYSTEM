'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    LayoutDashboard, DollarSign, ShoppingCart, Package,
    Users, TrendingUp, AlertTriangle, ArrowUpCircle,
    Clock, Banknote, Building2, BarChart3
} from "lucide-react"

function fmt(n: number, currency = 'XOF') {
    try {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
    } catch {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
    }
}

interface SalesSummary {
    sales?: { total?: number | string; count?: number }
    net_revenue?: number | string
    payment_methods?: Record<string, { count: number; total: number }>
    user_stats?: Record<string, { count: number; total: number }>
    hourly?: number[]
    [key: string]: unknown
}

interface InventoryMovement {
    type?: 'IN' | 'OUT' | 'UPDATE' | string
    product_name?: string
    product?: number | string
    quantity?: number | string
    created_at?: string
    [key: string]: unknown
}

interface EmployeeRow {
    salary?: number | string
    [key: string]: unknown
}

interface ContactRow {
    type?: string
    [key: string]: unknown
}

interface AccountRow {
    type?: string
    balance?: number | string
    [key: string]: unknown
}

interface WidgetData {
    salesSummary: SalesSummary | null
    lowStock: Record<string, unknown>[]
    employees: EmployeeRow[]
    contacts: ContactRow[]
    accounts: AccountRow[]
    movements: InventoryMovement[]
}

function asArr<T = Record<string, unknown>>(d: unknown): T[] {
    if (Array.isArray(d)) return d as T[]
    if (d && typeof d === 'object' && 'results' in d) {
        const r = (d as { results?: unknown }).results
        if (Array.isArray(r)) return r as T[]
    }
    return []
}

export default function CustomDashboard() {
    const [data, setData] = useState<WidgetData | null>(null)
    const [loading, setLoading] = useState(true)
    const [currency, setCurrency] = useState('XOF')

    useEffect(() => { loadAll() }, [])

    async function loadAll() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [sales, stock, employees, contacts, accounts, movements, orgSettings] = await Promise.all([
                erpFetch('pos/pos/daily-summary/?days=30').catch(() => null),
                erpFetch('inventory/low-stock/').catch(() => []),
                erpFetch('hr/employees/').catch(() => []),
                erpFetch('crm/contacts/').catch(() => []),
                erpFetch('coa/').catch(() => []),
                erpFetch('inventory/inventory-movements/').catch(() => []),
                erpFetch('settings/global_financial/').catch(() => null),
            ])
            const orgCurrency = (orgSettings as { currency_code?: string } | null)?.currency_code
            if (orgCurrency) setCurrency(orgCurrency)
            setData({
                salesSummary: (sales as SalesSummary | null) ?? null,
                lowStock: asArr(stock),
                employees: asArr<EmployeeRow>(employees),
                contacts: asArr<ContactRow>(contacts),
                accounts: asArr<AccountRow>(accounts),
                movements: asArr<InventoryMovement>(movements),
            })
        } catch {
            toast.error("Failed to load dashboard data")
        } finally {
            setLoading(false)
        }
    }

    if (loading || !data) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}</div>
            </div>
        )
    }

    const num = (v: unknown): number => {
        if (typeof v === 'number') return v
        const n = parseFloat(String(v ?? '0'))
        return isNaN(n) ? 0 : n
    }
    const totalRevenue = num(data.salesSummary?.sales?.total)
    const totalOrders = data.salesSummary?.sales?.count ?? 0
    const netRevenue = num(data.salesSummary?.net_revenue)
    const totalPayroll = data.employees.reduce((s, e) => s + num(e.salary), 0)
    const lowStockCount = data.lowStock.length
    const customerCount = data.contacts.filter(c => c.type === 'CLIENT' || c.type === 'CUSTOMER').length
    const supplierCount = data.contacts.filter(c => c.type === 'SUPPLIER').length

    const incomeAccounts = data.accounts.filter(a => a.type === 'INCOME')
    const expenseAccounts = data.accounts.filter(a => a.type === 'EXPENSE')
    const totalIncome = incomeAccounts.reduce((s, a) => s + Math.abs(num(a.balance)), 0)
    const totalExpense = expenseAccounts.reduce((s, a) => s + Math.abs(num(a.balance)), 0)

    const recentMovements = [...data.movements]
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, 5)

    const paymentMethods: Record<string, { count: number; total: number }> = data.salesSummary?.payment_methods || {}
    const topSellers = Object.entries(data.salesSummary?.user_stats || {})
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 5)

    return (
        <div className="p-6 space-y-6 bg-app-bg min-h-full">
            <header>
                <h1 className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center shadow-lg shadow-app-primary/20">
                        <LayoutDashboard size={20} className="text-white" />
                    </div>
                    Command Center
                </h1>
                <p className="text-sm text-app-muted-foreground mt-1">Real-time overview of all business modules</p>
            </header>

            {/* Primary KPI Row */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-app-primary text-white border-0 shadow-lg shadow-app-primary/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <DollarSign size={28} className="opacity-80" />
                            <div>
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">30d Revenue</p>
                                <p className="text-2xl font-black">{fmt(totalRevenue, currency)}</p>
                                <p className="text-xs font-medium opacity-60">Net: {fmt(netRevenue, currency)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-app-success text-white border-0 shadow-lg shadow-app-success/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={28} className="opacity-80" />
                            <div>
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Orders</p>
                                <p className="text-2xl font-black">{totalOrders}</p>
                                <p className="text-xs font-medium opacity-60">Avg: {totalOrders > 0 ? fmt(totalRevenue / totalOrders, currency) : '—'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-app-info text-white border-0 shadow-lg shadow-app-info/10">
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <Users size={28} className="opacity-80" />
                            <div>
                                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Contacts</p>
                                <p className="text-2xl font-black">{data.contacts.length}</p>
                                <p className="text-xs font-medium opacity-60">{customerCount} clients · {supplierCount} suppliers</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br ${lowStockCount > 0 ? 'from-orange-500 to-red-600' : 'from-gray-500 to-gray-600'} text-white border-0`}>
                    <CardContent className="py-5">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={28} className="opacity-80" />
                            <div>
                                <p className="text-xs uppercase opacity-80">Low Stock Alerts</p>
                                <p className="text-2xl font-bold">{lowStockCount}</p>
                                <p className="text-xs opacity-60">items need restock</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary KPI Row */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-app-success bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <TrendingUp size={20} className="text-app-success" />
                            <div>
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">GL Income</p>
                                <p className="text-lg font-black text-app-success">{fmt(totalIncome, currency)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-error bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <ArrowUpCircle size={20} className="text-app-error" />
                            <div>
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">GL Expenses</p>
                                <p className="text-lg font-black text-app-error">{fmt(totalExpense, currency)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-info bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <Banknote size={20} className="text-app-info" />
                            <div>
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Monthly Payroll</p>
                                <p className="text-lg font-black text-app-info">{fmt(totalPayroll, currency)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-app-primary bg-app-surface/40">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                            <Building2 size={20} className="text-app-primary" />
                            <div>
                                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Headcount</p>
                                <p className="text-lg font-black text-app-primary">{data.employees.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Widget Row */}
            <div className="grid grid-cols-3 gap-6">
                {/* Recent Stock Movements */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package size={16} className="text-app-muted-foreground" /> Recent Stock Movements
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentMovements.length === 0 ? (
                            <p className="text-center py-4 text-app-muted-foreground text-sm">No movements</p>
                        ) : recentMovements.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full ${m.type === 'IN' ? 'bg-app-success' : m.type === 'OUT' ? 'bg-app-error' : 'bg-app-warning'}`} />
                                <span className="flex-1 truncate font-medium">{m.product_name || `Product #${m.product}`}</span>
                                <span className={`font-bold ${m.type === 'IN' ? 'text-app-success' : 'text-app-error'}`}>
                                    {m.type === 'IN' ? '+' : '−'}{num(m.quantity).toFixed(0)}
                                </span>
                                <span className="text-app-muted-foreground w-14 text-right">
                                    {m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Payment Methods */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart3 size={16} className="text-app-muted-foreground" /> Payment Methods (30d)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.keys(paymentMethods).length === 0 ? (
                            <p className="text-center py-4 text-app-muted-foreground text-sm">No data</p>
                        ) : Object.entries(paymentMethods).map(([method, stats]) => (
                            <div key={method} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium">{method}</span>
                                    <span className="text-app-muted-foreground">{stats.count} txns</span>
                                </div>
                                <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-app-accent rounded-full"
                                        style={{ width: `${totalRevenue > 0 ? (stats.total / totalRevenue * 100) : 0}%` }}
                                    />
                                </div>
                                <p className="text-xs text-right font-bold">{fmt(stats.total, currency)}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Top Sellers */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Users size={16} className="text-app-muted-foreground" /> Top Sellers (30d)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {topSellers.length === 0 ? (
                            <p className="text-center py-4 text-app-muted-foreground text-sm">No data</p>
                        ) : topSellers.map(([name, stats], i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-6 h-6 rounded-full bg-app-info-bg flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-app-info">{(name || '?').charAt(0)}</span>
                                </div>
                                <span className="flex-1 truncate font-medium">{name}</span>
                                <span className="text-app-muted-foreground">{stats.count} orders</span>
                                <span className="font-bold w-20 text-right">{fmt(stats.total, currency)}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Hourly Sales Distribution */}
            {data.salesSummary?.hourly && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock size={16} className="text-app-muted-foreground" /> Hourly Sales Distribution (30d)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-0.5 h-20">
                            {data.salesSummary.hourly.map((val, h) => {
                                const max = Math.max(...(data.salesSummary?.hourly ?? []))
                                const pct = max ? (val / max * 100) : 0
                                return (
                                    <div key={h} className="flex-1 flex flex-col items-center group">
                                        <div className="invisible group-hover:visible text-[8px] text-app-muted-foreground whitespace-nowrap mb-0.5">
                                            {fmt(val, currency)}
                                        </div>
                                        <div
                                            className={`w-full rounded-t transition-all ${pct > 60 ? 'bg-app-accent' : pct > 20 ? 'bg-app-accent/60' : 'bg-app-accent-bg'}`}
                                            style={{ height: `${Math.max(pct, 3)}%` }}
                                        />
                                        {h % 3 === 0 && (
                                            <span className="text-[8px] text-app-muted-foreground mt-1">{h}h</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
