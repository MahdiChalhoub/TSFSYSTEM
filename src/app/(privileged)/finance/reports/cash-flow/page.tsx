'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import { getCashFlowStatement } from "@/app/actions/finance/reports"
import { useScope } from '@/hooks/useScope'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  TrendingUp, TrendingDown, DollarSign, ArrowUpCircle,
  ArrowDownCircle, Activity, Calendar, RefreshCw
} from "lucide-react"

export default function CashFlowReportPage() {
  const { fmt } = useCurrency()
  const { scope: viewScope } = useScope()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of month
    return date.toISOString().split('T')[0]
  })

  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    return date.toISOString().split('T')[0]
  })

  // Backend payload — many fields render directly into formatters that
  // accept loose primitives. A typed-narrow pass over this report would
  // ripple through ~25 call sites; deferred. Loose `any` for now.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CashFlowReport = any

  const [method, setMethod] = useState<'INDIRECT' | 'DIRECT'>('INDIRECT')
  const [report, setReport] = useState<CashFlowReport>(null)
  const [loading, setLoading] = useState(false)

  // Refetch on first mount AND whenever the OFFICIAL/INTERNAL toggle flips.
  // The action reads the live scope cookie so no param is needed.
  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScope])

  async function loadReport() {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates')
      return
    }

    setLoading(true)
    try {
      const data = await getCashFlowStatement(startDate, endDate, method)
      setReport(data)
    } catch (error) {
      toast.error("Failed to load cash flow statement")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !report) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const netCashChange = report?.net_cash_change || 0
  const isPositive = parseFloat(netCashChange) >= 0

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
            <Activity size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Cash Flow <span className="text-app-primary">Statement</span>
            </h1>
            <p className="text-sm text-app-muted-foreground mt-1">
              {method} Method - {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="start_date" className="text-xs font-bold uppercase tracking-wider">
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="end_date" className="text-xs font-bold uppercase tracking-wider">
                End Date
              </Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="method" className="text-xs font-bold uppercase tracking-wider">
                Method
              </Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'INDIRECT' | 'DIRECT')}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIRECT">Indirect Method</SelectItem>
                  <SelectItem value="DIRECT">Direct Method</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={loadReport}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-app-primary hover:bg-app-primary/90 gap-2"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          {/* Summary Card */}
          <Card className={`rounded-2xl border-2 ${isPositive ? 'border-app-success bg-app-success/5' : 'border-app-error bg-app-error/5'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                    Net Cash Change
                  </p>
                  <div className="flex items-center gap-3">
                    {isPositive ? (
                      <TrendingUp size={32} className="text-app-success" />
                    ) : (
                      <TrendingDown size={32} className="text-app-error" />
                    )}
                    <span className={`text-4xl font-black ${isPositive ? 'text-app-success' : 'text-app-error'}`}>
                      {fmt(Math.abs(parseFloat(netCashChange)))}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                    Ending Cash Balance
                  </p>
                  <span className="text-2xl font-black text-app-primary">
                    {fmt(report.ending_cash)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operating Activities */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-app-info-bg flex items-center justify-center">
                  <DollarSign size={20} className="text-app-info" />
                </div>
                <CardTitle>Operating Activities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.operating_activities?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{item.description || item.label}</span>
                    <span className="font-mono font-bold">{fmt(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t-2">
                  <span className="text-sm font-bold uppercase tracking-wider">Net Cash from Operating</span>
                  <span className={`text-lg font-black ${parseFloat(report.operating_activities?.total || 0) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(report.operating_activities?.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investing Activities */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <ArrowUpCircle size={20} className="text-purple-700" />
                </div>
                <CardTitle>Investing Activities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.investing_activities?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{item.description || item.label}</span>
                    <span className="font-mono font-bold">{fmt(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t-2">
                  <span className="text-sm font-bold uppercase tracking-wider">Net Cash from Investing</span>
                  <span className={`text-lg font-black ${parseFloat(report.investing_activities?.total || 0) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(report.investing_activities?.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financing Activities */}
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-app-warning-soft flex items-center justify-center">
                  <ArrowDownCircle size={20} className="text-app-warning" />
                </div>
                <CardTitle>Financing Activities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.financing_activities?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{item.description || item.label}</span>
                    <span className="font-mono font-bold">{fmt(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t-2">
                  <span className="text-sm font-bold uppercase tracking-wider">Net Cash from Financing</span>
                  <span className={`text-lg font-black ${parseFloat(report.financing_activities?.total || 0) >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {fmt(report.financing_activities?.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="rounded-2xl bg-app-surface-2">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="font-bold">Beginning Cash Balance</span>
                  <span className="font-mono font-bold">{fmt(report.beginning_cash)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-bold">Net Cash Change</span>
                  <span className={`font-mono font-bold ${isPositive ? 'text-app-success' : 'text-app-error'}`}>
                    {isPositive ? '+' : ''}{fmt(netCashChange)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-t-2 border-app-border">
                  <span className="text-lg font-black uppercase tracking-wider">Ending Cash Balance</span>
                  <span className="text-2xl font-black text-app-primary">{fmt(report.ending_cash)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!report && !loading && (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Calendar size={48} className="mx-auto text-app-muted-foreground mb-4" />
            <p className="text-app-muted-foreground">
              Select date range and click "Generate Report" to view cash flow statement
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
