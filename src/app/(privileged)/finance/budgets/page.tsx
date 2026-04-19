'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import { getBudgets, getBudgetDashboard, getAllVarianceAlerts, deleteBudget } from "@/app/actions/finance/budgets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Calculator, TrendingUp, TrendingDown, AlertTriangle,
  BarChart3, Plus, Eye, Edit, Trash2, RefreshCw,
  CheckCircle2, Clock, Lock, FileText
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BudgetsPage() {
  const { fmt } = useCurrency()
  const router = useRouter()
  const [budgets, setBudgets] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const settings = useListViewSettings('fin_budgets', {
    columns: ['name', 'fiscal_year', 'version', 'status', 'utilization', 'variance', 'actions'],
    pageSize: 25,
    sortKey: 'fiscal_year',
    sortDir: 'desc'
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [budgetsData, dashboardData, alertsData] = await Promise.all([
        getBudgets(),
        getBudgetDashboard(),
        getAllVarianceAlerts(10)
      ])

      setBudgets(Array.isArray(budgetsData) ? budgetsData : budgetsData.results || [])
      setDashboard(dashboardData)
      setAlerts(alertsData.alerts || [])
    } catch (error) {
      toast.error("Failed to load budget data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this budget?')) return

    try {
      await deleteBudget(id)
      toast.success('Budget deleted successfully')
      loadData()
    } catch (error) {
      toast.error('Failed to delete budget')
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Clock size={14} className="text-app-muted-foreground" />
      case 'APPROVED': return <CheckCircle2 size={14} className="text-app-success" />
      case 'LOCKED': return <Lock size={14} className="text-app-error" />
      default: return null
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-app-muted-foreground/10 text-app-muted-foreground'
      case 'APPROVED': return 'bg-app-success/10 text-app-success'
      case 'LOCKED': return 'bg-app-error/10 text-app-error'
      default: return 'bg-app-surface-2 text-app-foreground'
    }
  }

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      key: 'name',
      label: 'Budget Name',
      sortable: true,
      render: (budget) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-app-primary/10 flex items-center justify-center">
            <FileText size={18} className="text-app-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-app-foreground">{budget.name}</p>
            {budget.description && (
              <p className="text-xs text-app-muted-foreground line-clamp-1">{budget.description}</p>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'fiscal_year',
      label: 'Fiscal Year',
      sortable: true,
      render: (budget) => (
        <span className="font-mono text-sm text-app-foreground">
          {budget.fiscal_year_name || `FY ${budget.fiscal_year}`}
        </span>
      )
    },
    {
      key: 'version',
      label: 'Version',
      align: 'center',
      render: (budget) => (
        <Badge variant="outline" className="font-mono text-xs">
          v{budget.version}
        </Badge>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (budget) => (
        <Badge className={`${statusColor(budget.status)} font-bold text-xs gap-1.5`}>
          {statusIcon(budget.status)}
          {budget.status}
        </Badge>
      )
    },
    {
      key: 'utilization',
      label: 'Utilization',
      align: 'right',
      render: (budget) => {
        const util = parseFloat(budget.utilization_rate || 0)
        const color = util > 100 ? 'text-app-error' : util > 80 ? 'text-orange-600' : 'text-app-success'
        return (
          <span className={`font-bold text-sm ${color}`}>
            {util.toFixed(1)}%
          </span>
        )
      }
    },
    {
      key: 'variance',
      label: 'Variance',
      align: 'right',
      render: (budget) => {
        const variance = parseFloat(budget.variance_percentage || 0)
        const isOver = variance < 0
        return (
          <div className="flex items-center gap-2 justify-end">
            {isOver ? (
              <TrendingDown size={14} className="text-app-error" />
            ) : (
              <TrendingUp size={14} className="text-app-success" />
            )}
            <span className={`font-bold text-sm ${isOver ? 'text-app-error' : 'text-app-success'}`}>
              {Math.abs(variance).toFixed(1)}%
            </span>
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (budget) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/finance/budgets/${budget.id}`)}
            className="h-8 px-3 rounded-xl"
          >
            <Eye size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/finance/budgets/${budget.id}/edit`)}
            className="h-8 px-3 rounded-xl"
          >
            <Edit size={14} />
          </Button>
          {budget.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(budget.id)}
              className="h-8 px-3 rounded-xl text-app-error hover:bg-app-error/10"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      )
    }
  ], [fmt, router])

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  const totalBudgetsCount = budgets.length
  const approvedBudgets = budgets.filter(b => b.status === 'APPROVED' || b.status === 'LOCKED')
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length
  const warningAlerts = alerts.filter(a => a.severity === 'WARNING').length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
            <BarChart3 size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Budget <span className="text-app-primary">Management</span>
            </h1>
            <p className="text-sm text-app-muted-foreground mt-1">
              Variance Analysis & Financial Planning
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-10 px-4 rounded-xl"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Link href="/finance/budgets/new">
            <Button className="h-10 px-6 rounded-xl bg-app-primary hover:bg-app-primary/90 text-white font-bold gap-2">
              <Plus size={16} />
              New Budget
            </Button>
          </Link>
        </div>
      </header>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-primary/10 flex items-center justify-center">
                <FileText size={22} className="text-app-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-primary uppercase tracking-widest">Total Budgets</p>
                <p className="text-2xl font-bold text-app-primary mt-0.5">{totalBudgetsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-success/20 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-app-success" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-success uppercase tracking-widest">Active</p>
                <p className="text-2xl font-bold text-app-success mt-0.5">{approvedBudgets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-200/60 flex items-center justify-center">
                <AlertTriangle size={22} className="text-orange-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">Warnings</p>
                <p className="text-2xl font-bold text-orange-900 mt-0.5">{warningAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-error/20 flex items-center justify-center">
                <TrendingDown size={22} className="text-app-error" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-error uppercase tracking-widest">Critical</p>
                <p className="text-2xl font-bold text-app-error mt-0.5">{criticalAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Section */}
      {criticalAlerts > 0 && (
        <Card className="rounded-2xl border-2 border-app-error bg-app-error/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-app-error flex items-center gap-2 text-lg">
                <AlertTriangle size={20} />
                Critical Budget Overruns
              </CardTitle>
              <Link href="/finance/budgets/alerts">
                <Button variant="outline" size="sm" className="rounded-xl">
                  View All Alerts
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts
                .filter(a => a.severity === 'CRITICAL')
                .slice(0, 3)
                .map((alert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-app-surface rounded-xl border border-app-error/20"
                  >
                    <div>
                      <p className="font-bold text-sm text-app-foreground">
                        {alert.account_name}
                      </p>
                      <p className="text-xs text-app-muted-foreground">
                        Budget: {fmt(alert.budgeted_amount)} | Actual: {fmt(alert.actual_amount)}
                      </p>
                    </div>
                    <Badge className="bg-app-error text-white font-bold">
                      +{parseFloat(alert.over_budget_percentage).toFixed(1)}% Over
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budgets List */}
      <TypicalListView
        title="All Budgets"
        data={budgets}
        loading={loading}
        getRowId={(budget) => budget.id}
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
  )
}
