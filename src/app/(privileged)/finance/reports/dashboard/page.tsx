'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import { getFinancialReportsDashboard } from "@/app/actions/finance/reports"
import { useScope } from '@/hooks/useScope'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  TrendingUp, TrendingDown, DollarSign, PieChart,
  BarChart3, Activity, Calendar, RefreshCw, ArrowRight
} from "lucide-react"
import Link from 'next/link'

export default function FinancialReportsDashboardPage() {
  const { fmt } = useCurrency()
  const { scope: viewScope } = useScope()

  const [period, setPeriod] = useState<'CURRENT_MONTH' | 'CURRENT_QUARTER' | 'CURRENT_YEAR' | 'YTD'>('CURRENT_MONTH')
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Refetch on period change OR scope toggle. The action reads the cookie
  // for scope so no param plumbing is needed here.
  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, viewScope])

  async function loadDashboard() {
    setLoading(true)
    try {
      const data = await getFinancialReportsDashboard(period)
      setDashboard(data)
    } catch (error) {
      toast.error("Failed to load financial dashboard")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
    toast.success('Dashboard refreshed')
  }

  if (loading && !dashboard) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const netIncome = parseFloat(dashboard?.profit_loss?.net_income || 0)
  const isProfit = netIncome >= 0
  const netMargin = parseFloat(dashboard?.profit_loss?.net_margin || 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
            <BarChart3 size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Financial <span className="text-app-primary">Dashboard</span>
            </h1>
            <p className="text-sm text-app-muted-foreground mt-1">
              {period.replace(/_/g, ' ')} - {new Date(dashboard?.start_date).toLocaleDateString()} to {new Date(dashboard?.end_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-48 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CURRENT_MONTH">Current Month</SelectItem>
              <SelectItem value="CURRENT_QUARTER">Current Quarter</SelectItem>
              <SelectItem value="CURRENT_YEAR">Current Year</SelectItem>
              <SelectItem value="YTD">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-10 px-4 rounded-xl gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </header>

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-app-success/20 flex items-center justify-center">
                    <TrendingUp size={22} className="text-app-success" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-app-success uppercase tracking-widest">Revenue</p>
                    <p className="text-2xl font-bold text-app-success mt-0.5">
                      {fmt(dashboard.profit_loss.revenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-200/60 flex items-center justify-center">
                    <TrendingDown size={22} className="text-orange-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Expenses</p>
                    <p className="text-2xl font-bold text-orange-900 mt-0.5">
                      {fmt(Math.abs(parseFloat(dashboard.profit_loss.expenses)))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`rounded-2xl border-0 shadow-sm ${isProfit ? 'bg-gradient-to-br from-blue-50 to-blue-100/50' : 'bg-gradient-to-br from-red-50 to-red-100/50'}`}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${isProfit ? 'bg-app-primary/20' : 'bg-app-error/20'} flex items-center justify-center`}>
                    <DollarSign size={22} className={isProfit ? 'text-app-primary' : 'text-app-error'} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${isProfit ? 'text-app-primary' : 'text-app-error'}`}>
                      Net Income
                    </p>
                    <p className={`text-2xl font-bold mt-0.5 ${isProfit ? 'text-app-primary' : 'text-app-error'}`}>
                      {fmt(Math.abs(netIncome))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-200/60 flex items-center justify-center">
                    <PieChart size={22} className="text-purple-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Net Margin</p>
                    <p className="text-2xl font-bold text-purple-900 mt-0.5">
                      {netMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit & Loss Summary */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <TrendingUp size={20} className="text-green-700" />
                  </div>
                  <CardTitle>Profit & Loss Summary</CardTitle>
                </div>
                <Link href="/finance/reports/pnl">
                  <Button variant="outline" size="sm" className="rounded-xl gap-2">
                    View Full Report
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Revenue
                  </p>
                  <p className="text-3xl font-black text-app-success">
                    {fmt(dashboard.profit_loss.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Expenses
                  </p>
                  <p className="text-3xl font-black text-orange-600">
                    {fmt(Math.abs(parseFloat(dashboard.profit_loss.expenses)))}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Net Income
                  </p>
                  <p className={`text-3xl font-black ${isProfit ? 'text-app-primary' : 'text-app-error'}`}>
                    {isProfit ? '+' : ''}{fmt(netIncome)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Sheet Summary */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <BarChart3 size={20} className="text-blue-700" />
                  </div>
                  <CardTitle>Balance Sheet Summary</CardTitle>
                </div>
                <Link href="/finance/reports/balance-sheet">
                  <Button variant="outline" size="sm" className="rounded-xl gap-2">
                    View Full Report
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Total Assets
                  </p>
                  <p className="text-3xl font-black text-app-primary">
                    {fmt(dashboard.balance_sheet.total_assets)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Total Liabilities
                  </p>
                  <p className="text-3xl font-black text-orange-600">
                    {fmt(dashboard.balance_sheet.total_liabilities)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                    Total Equity
                  </p>
                  <p className="text-3xl font-black text-app-success">
                    {fmt(dashboard.balance_sheet.total_equity)}
                  </p>
                </div>
              </div>

              {dashboard.balance_sheet.is_balanced && (
                <div className="mt-6 pt-6 border-t flex items-center justify-center gap-2">
                  <Badge className="bg-app-success/10 text-app-success border-app-success/30 font-bold">
                    ✓ Balanced
                  </Badge>
                  <span className="text-xs text-app-muted-foreground">
                    Assets = Liabilities + Equity
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Flow Summary */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Activity size={20} className="text-purple-700" />
                  </div>
                  <CardTitle>Cash Flow Summary</CardTitle>
                </div>
                <Link href="/finance/reports/cash-flow">
                  <Button variant="outline" size="sm" className="rounded-xl gap-2">
                    View Full Report
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="font-bold">Operating Activities</span>
                  <span className={`font-mono font-bold ${parseFloat(dashboard.cash_flow.operating_cash) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(dashboard.cash_flow.operating_cash)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="font-bold">Investing Activities</span>
                  <span className={`font-mono font-bold ${parseFloat(dashboard.cash_flow.investing_cash) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(dashboard.cash_flow.investing_cash)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="font-bold">Financing Activities</span>
                  <span className={`font-mono font-bold ${parseFloat(dashboard.cash_flow.financing_cash) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(dashboard.cash_flow.financing_cash)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t-2">
                  <span className="text-lg font-black uppercase tracking-wider">Ending Cash</span>
                  <span className="text-2xl font-black text-app-primary">
                    {fmt(dashboard.cash_flow.ending_cash)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
