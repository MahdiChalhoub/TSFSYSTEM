'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import { getAllVarianceAlerts } from "@/app/actions/finance/budgets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, RefreshCw, Search, TrendingDown, Filter } from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BudgetAlertsPage() {
  const { fmt } = useCurrency()
  const router = useRouter()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [threshold, setThreshold] = useState(10)
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const settings = useListViewSettings('fin_budget_alerts', {
    columns: ['severity', 'budget', 'account', 'budgeted', 'actual', 'variance', 'actions'],
    pageSize: 25,
    sortKey: 'over_budget_percentage',
    sortDir: 'desc'
  })

  useEffect(() => {
    loadData()
  }, [threshold])

  async function loadData() {
    setLoading(true)
    try {
      const data = await getAllVarianceAlerts(threshold)
      setAlerts(data.alerts || [])
    } catch (error) {
      toast.error("Failed to load variance alerts")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Alerts refreshed')
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter
      const matchesSearch = !search ||
        alert.account_name?.toLowerCase().includes(search.toLowerCase()) ||
        alert.budget_name?.toLowerCase().includes(search.toLowerCase())
      return matchesSeverity && matchesSearch
    })
  }, [alerts, severityFilter, search])

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length
  const infoCount = alerts.filter(a => a.severity === 'INFO').length

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-app-error text-white'
      case 'WARNING': return 'bg-app-warning text-white'
      case 'INFO': return 'bg-app-info text-white'
      default: return 'bg-app-surface-2'
    }
  }

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      key: 'severity',
      label: 'Severity',
      width: '100px',
      render: (alert) => (
        <Badge className={`${severityColor(alert.severity)} font-bold text-xs`}>
          {alert.severity}
        </Badge>
      )
    },
    {
      key: 'budget',
      label: 'Budget',
      sortable: true,
      render: (alert) => (
        <div>
          <p className="font-bold text-sm">{alert.budget_name}</p>
          <p className="text-xs text-app-muted-foreground">{alert.fiscal_year}</p>
        </div>
      )
    },
    {
      key: 'account',
      label: 'Account',
      sortable: true,
      render: (alert) => (
        <div>
          <p className="font-bold text-sm">{alert.account_name}</p>
          <p className="text-xs text-app-muted-foreground font-mono">{alert.account_code}</p>
        </div>
      )
    },
    {
      key: 'budgeted',
      label: 'Budgeted',
      align: 'right',
      render: (alert) => (
        <span className="font-mono text-sm">{fmt(alert.budgeted_amount)}</span>
      )
    },
    {
      key: 'actual',
      label: 'Actual',
      align: 'right',
      render: (alert) => (
        <span className="font-mono text-sm font-bold">{fmt(alert.actual_amount)}</span>
      )
    },
    {
      key: 'variance',
      label: 'Over Budget',
      align: 'right',
      sortable: true,
      render: (alert) => (
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <TrendingDown size={14} className="text-app-error" />
            <span className="font-bold text-sm text-app-error">
              {parseFloat(alert.over_budget_percentage).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-app-muted-foreground mt-1">
            {fmt(alert.over_budget_amount)}
          </p>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (alert) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/finance/budgets/${alert.budget_id}`)}
          className="h-8 px-3 rounded-xl"
        >
          View Budget
        </Button>
      )
    }
  ], [fmt, router])

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

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
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-error/10 border border-app-error/20">
              <AlertTriangle size={32} className="text-app-error" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
              <h1 className="italic">
                Budget <span className="text-app-error">Alerts</span>
              </h1>
              <p className="text-sm text-app-muted-foreground mt-1">
                Variance Analysis & Overrun Monitoring
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-10 px-4 rounded-xl gap-2"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-app-gradient-surface-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-200/60 flex items-center justify-center">
                <AlertTriangle size={22} className="text-app-foreground" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-widest">Total Alerts</p>
                <p className="text-2xl font-bold text-app-foreground mt-0.5">{alerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-app-error-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-app-error/20 flex items-center justify-center">
                <TrendingDown size={22} className="text-app-error" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-error uppercase tracking-widest">Critical</p>
                <p className="text-2xl font-bold text-app-error mt-0.5">{criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-app-warning-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-200/60 flex items-center justify-center">
                <AlertTriangle size={22} className="text-app-warning" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-warning uppercase tracking-widest">Warning</p>
                <p className="text-2xl font-bold text-orange-900 mt-0.5">{warningCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-app-info-soft/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                <AlertTriangle size={22} className="text-app-info" />
              </div>
              <div>
                <p className="text-xs font-bold text-app-info uppercase tracking-widest">Info</p>
                <p className="text-2xl font-bold text-app-info mt-0.5">{infoCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter size={18} />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2 block">
                Severity
              </label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical Only</SelectItem>
                  <SelectItem value="WARNING">Warning Only</SelectItem>
                  <SelectItem value="INFO">Info Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2 block">
                Threshold
              </label>
              <Select value={threshold.toString()} onValueChange={(v) => setThreshold(parseInt(v))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5% Over Budget</SelectItem>
                  <SelectItem value="10">10% Over Budget</SelectItem>
                  <SelectItem value="15">15% Over Budget</SelectItem>
                  <SelectItem value="20">20% Over Budget</SelectItem>
                  <SelectItem value="25">25% Over Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search budget or account..."
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <TypicalListView
        title={`Variance Alerts (${filteredAlerts.length})`}
        data={filteredAlerts}
        loading={loading}
        getRowId={(alert: any) => `${alert.budget_id}-${alert.account_code}`}
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
