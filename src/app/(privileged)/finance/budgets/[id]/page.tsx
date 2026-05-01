'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, use } from "react"
import {
  getBudget,
  getVarianceReport,
  getVarianceAlerts,
  getBudgetPerformance,
  refreshBudgetActuals
} from "@/app/actions/finance/budgets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, BarChart3, PieChart, Target, Calendar,
  CheckCircle2, Clock, Lock
} from "lucide-react"
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { fmt } = useCurrency()
  const router = useRouter()

  // Loose payloads from getBudget/getVariance.../getBudgetPerformance.
  // Read-only fields are typed loose since downstream rendering accepts
  // string/number unions for currency/percent inputs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type BudgetData = any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type VarianceData = any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AlertsData = any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PerformanceData = any

  const [budget, setBudget] = useState<BudgetData>(null)
  const [variance, setVariance] = useState<VarianceData>(null)
  const [alerts, setAlerts] = useState<AlertsData>(null)
  const [performance, setPerformance] = useState<PerformanceData>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const [budgetData, varianceData, alertsData, performanceData] = await Promise.all([
        getBudget(parseInt(id)),
        getVarianceReport(parseInt(id)),
        getVarianceAlerts(parseInt(id), 10),
        getBudgetPerformance(parseInt(id))
      ])

      setBudget(budgetData)
      setVariance(varianceData)
      setAlerts(alertsData)
      setPerformance(performanceData)
    } catch (error) {
      toast.error("Failed to load budget details")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshActuals() {
    setRefreshing(true)
    try {
      await refreshBudgetActuals(parseInt(id), true)
      toast.success('Actuals refreshed from journal entries')
      await loadData()
    } catch (error) {
      toast.error('Failed to refresh actuals')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!budget || !variance || !performance) {
    return (
      <div className="p-6">
        <p className="text-app-muted-foreground">Budget not found</p>
      </div>
    )
  }

  const statusIcon: Record<string, React.ReactNode> = {
    DRAFT: <Clock size={16} className="text-app-muted-foreground" />,
    APPROVED: <CheckCircle2 size={16} className="text-app-success" />,
    LOCKED: <Lock size={16} className="text-app-error" />
  }

  const currentStatusIcon = statusIcon[budget?.status || 'DRAFT']

  const utilizationRate = parseFloat(performance.utilization_rate)
  const variancePercentage = parseFloat(variance.variance_percentage)
  const isOverBudget = variancePercentage < 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/finance/budgets">
            <Button variant="ghost" size="sm" className="mb-3 gap-2">
              <ArrowLeft size={16} />
              Back to Budgets
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
              <BarChart3 size={32} className="text-app-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                  {budget.name}
                </h1>
                <Badge className="gap-1.5">
                  {currentStatusIcon}
                  {budget.status}
                </Badge>
              </div>
              <p className="text-sm text-app-muted-foreground mt-1">
                {variance.fiscal_year} • Version {budget.version}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefreshActuals}
            disabled={refreshing}
            className="h-10 px-4 rounded-xl gap-2"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Actuals
          </Button>
          <Button
            onClick={() => router.push(`/finance/budgets/${id}/edit`)}
            className="h-10 px-6 rounded-xl bg-app-primary hover:bg-app-primary/90"
          >
            Edit Budget
          </Button>
        </div>
      </header>

      {/* Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-app-gradient-info-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-primary/20 flex items-center justify-center">
                <DollarSign size={22} className="text-app-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-primary uppercase tracking-widest">Total Budget</p>
                <p className="text-2xl font-bold text-app-primary mt-0.5">{fmt(variance.total_budget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-app-gradient-primary-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-success/20 flex items-center justify-center">
                <Target size={22} className="text-app-success" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-success uppercase tracking-widest">Actual Spent</p>
                <p className="text-2xl font-bold text-app-success mt-0.5">{fmt(variance.total_actual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-app-gradient-accent-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-200/60 flex items-center justify-center">
                <PieChart size={22} className="text-purple-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Utilization</p>
                <p className={`text-2xl font-bold mt-0.5 ${utilizationRate > 100 ? 'text-app-error' : 'text-purple-900'}`}>
                  {utilizationRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl border-0 shadow-sm ${isOverBudget ? 'bg-app-gradient-error-soft/50' : 'bg-app-gradient-primary/50'}`}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${isOverBudget ? 'bg-app-error/20' : 'bg-emerald-200/60'} flex items-center justify-center`}>
                {isOverBudget ? <TrendingDown size={22} className="text-app-error" /> : <TrendingUp size={22} className="text-app-success" />}
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${isOverBudget ? 'text-app-error' : 'text-app-success'}`}>
                  Variance
                </p>
                <p className={`text-2xl font-bold mt-0.5 ${isOverBudget ? 'text-app-error' : 'text-emerald-900'}`}>
                  {isOverBudget ? '-' : '+'}{Math.abs(variancePercentage).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="by-account" className="rounded-xl">By Account</TabsTrigger>
          <TabsTrigger value="by-period" className="rounded-xl">By Period</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-xl">
            Alerts
            {alerts && alerts.total_alerts > 0 && (
              <Badge className="ml-2 h-5 px-1.5 bg-app-error text-white text-xs">
                {alerts.total_alerts}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Budget Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-app-muted-foreground mb-2">Budget vs Actual</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-app-muted-foreground">Budget</span>
                    <span className="text-sm font-bold">{fmt(variance.total_budget)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-app-muted-foreground">Actual</span>
                    <span className="text-sm font-bold">{fmt(variance.total_actual)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs font-bold">Variance</span>
                    <span className={`text-sm font-bold ${isOverBudget ? 'text-app-error' : 'text-app-success'}`}>
                      {fmt(variance.total_variance)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-app-muted-foreground mb-2">Available Budget</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-app-muted-foreground">Committed</span>
                    <span className="text-sm font-bold">{fmt(variance.total_committed)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-app-muted-foreground">Available</span>
                    <span className="text-sm font-bold">{fmt(variance.total_available)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs font-bold">Over Budget Items</span>
                    <span className="text-sm font-bold text-app-error">
                      {variance.over_budget_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Utilization Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Budget Utilization</span>
                  <span className="text-sm font-bold">{utilizationRate.toFixed(1)}%</span>
                </div>
                <div className="h-4 bg-app-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${utilizationRate > 100 ? 'bg-app-error' : utilizationRate > 80 ? 'bg-orange-500' : 'bg-app-success'}`}
                    style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-account" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Variance by Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {variance.by_account?.slice(0, 10).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-app-surface rounded-xl">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{item.account_name}</p>
                      <p className="text-xs text-app-muted-foreground">
                        Budget: {fmt(item.budgeted)} | Actual: {fmt(item.actual)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${parseFloat(item.variance_percentage) < 0 ? 'text-app-error' : 'text-app-success'}`}>
                        {parseFloat(item.variance_percentage).toFixed(1)}%
                      </p>
                      <p className="text-xs text-app-muted-foreground">
                        {fmt(item.variance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-period" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Variance by Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {variance.by_period?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-app-surface rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-app-primary/10 flex items-center justify-center">
                        <Calendar size={18} className="text-app-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.period_name || `Period ${item.period}`}</p>
                        <p className="text-xs text-app-muted-foreground">
                          Budget: {fmt(item.budgeted)} | Actual: {fmt(item.actual)}
                        </p>
                      </div>
                    </div>
                    <Badge className={parseFloat(item.variance_percentage) < 0 ? 'bg-app-error/10 text-app-error' : 'bg-app-success/10 text-app-success'}>
                      {parseFloat(item.variance_percentage).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Variance Alerts</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-app-error/10 text-app-error">
                    {alerts?.critical_count || 0} Critical
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-700">
                    {alerts?.warning_count || 0} Warning
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {alerts && alerts.alerts.length > 0 ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {alerts.alerts.map((alert: any, idx: number) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 ${alert.severity === 'CRITICAL' ? 'bg-app-error/5 border-app-error/20' : 'bg-orange-50 border-orange-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          size={20}
                          className={alert.severity === 'CRITICAL' ? 'text-app-error' : 'text-orange-600'}
                        />
                        <div>
                          <p className="font-bold text-sm">{alert.account_name}</p>
                          <p className="text-xs text-app-muted-foreground">
                            Budgeted: {fmt(alert.budgeted_amount)} | Actual: {fmt(alert.actual_amount)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={alert.severity === 'CRITICAL' ? 'bg-app-error text-white' : 'bg-orange-600 text-white'}>
                          +{parseFloat(alert.over_budget_percentage).toFixed(1)}% Over
                        </Badge>
                        <p className="text-xs text-app-muted-foreground mt-1">
                          Exceeded by {fmt(alert.over_budget_amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="mx-auto text-app-success mb-3" />
                  <p className="text-app-muted-foreground">No variance alerts - budget is on track!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
