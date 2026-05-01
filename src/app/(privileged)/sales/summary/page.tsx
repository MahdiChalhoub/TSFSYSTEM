'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from "react"
import type { SalesAnalyticsData } from '@/types/erp'
import { getSalesAnalytics } from "@/app/actions/pos/sales-analytics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  CalendarDays, DollarSign, TrendingUp, ShoppingCart, Users,
  Package, CreditCard, Receipt, Clock, BarChart3
} from "lucide-react"

const PAYMENT_ICONS: Record<string, string> = {
  CASH: '💵', CARD: '💳', MOBILE: '📱', TRANSFER: '🏦', CHECK: '📝', CREDIT: '🧾'
}

import { useAdmin } from "@/context/AdminContext"

export default function DailySummaryPage() {
  const { viewScope } = useAdmin()
  const { fmt } = useCurrency()
  const [data, setData] = useState<SalesAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [viewScope])

  async function loadData() {
    setLoading(true)
    try {
      const result = await getSalesAnalytics(1) // Today only
      setData(result)
    } catch {
      toast.error("Failed to load daily summary")
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="app-page space-y-[var(--layout-section-spacing)] layout-container-padding animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-4 gap-[var(--layout-element-gap)]">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 layout-card-radius" />)}</div>
        <Skeleton className="h-64 layout-card-radius" />
        <div className="grid grid-cols-2 gap-[var(--layout-element-gap)]">{[1, 2].map(i => <Skeleton key={i} className="h-64 layout-card-radius" />)}</div>
      </div>
    )
  }

  const { overall, top_products, top_customers, payment_methods } = data
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-[var(--layout-section-spacing)] layout-container-padding animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 layout-card-radius flex items-center justify-center shrink-0" style={{
            background: 'var(--theme-primary)',
            opacity: 0.1,
            border: '1px solid var(--theme-primary)'
          }}>
            <BarChart3 size={32} className="theme-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">Sales</p>
            <h1 className="text-4xl font-black tracking-tight theme-text italic">
              Sales <span className="theme-primary">Summary</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--layout-element-gap)]">
        <Card className="bg-app-gradient-primary layout-card-radius border-0 shadow-xl relative overflow-hidden">
          <CardContent className="layout-card-padding">
            <div className="absolute top-0 right-0 w-32 h-32 bg-app-surface/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="relative text-white">
              <DollarSign size={24} className="mb-3 opacity-80" />
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Today's Revenue</div>
              <div className="text-3xl font-black tracking-tight">{fmt(overall?.revenue || 0)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="layout-card-radius border-0 shadow-sm theme-surface">
          <CardContent className="layout-card-padding">
            <ShoppingCart size={24} className="text-app-info mb-3" />
            <div className="text-[10px] font-black theme-text-muted uppercase tracking-widest mb-1">Total Orders</div>
            <div className="text-3xl font-black theme-text tracking-tight">{overall?.orders || 0}</div>
          </CardContent>
        </Card>

        <Card className="layout-card-radius border-0 shadow-sm theme-surface">
          <CardContent className="layout-card-padding">
            <TrendingUp size={24} className="theme-primary mb-3" />
            <div className="text-[10px] font-black theme-text-muted uppercase tracking-widest mb-1">Avg. Order</div>
            <div className="text-3xl font-black theme-text tracking-tight">{fmt(overall?.avg_order || 0)}</div>
          </CardContent>
        </Card>

        <Card className="layout-card-radius border-0 shadow-sm theme-surface">
          <CardContent className="layout-card-padding">
            <Receipt size={24} className="text-app-error mb-3" />
            <div className="text-[10px] font-black theme-text-muted uppercase tracking-widest mb-1">Tax Collected</div>
            <div className="text-3xl font-black theme-text tracking-tight">{fmt(overall?.tax || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown Banner */}
      <Card className="layout-card-radius border-0 shadow-lg theme-surface">
        <CardContent className="layout-card-padding">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex gap-10">
              <div>
                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Gross Revenue</div>
                <div className="text-2xl font-bold">{fmt((overall?.revenue || 0) + (overall?.discount || 0))}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Discounts</div>
                <div className="text-2xl font-bold text-orange-400">−{fmt(overall?.discount || 0)}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Tax</div>
                <div className="text-2xl font-bold text-app-error">{fmt(overall?.tax || 0)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Net Revenue</div>
              <div className="text-4xl font-black text-app-primary tracking-tighter">{fmt(overall?.revenue || 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top Products Today */}
        <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
          <CardHeader className="py-4 bg-app-background border-b">
            <CardTitle className="text-base flex items-center gap-2 font-black">
              <Package size={18} className="text-app-primary" /> Top Products Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-app-surface-2/50 text-[10px] uppercase tracking-widest text-app-muted-foreground">
                  <TableHead className="font-black">#</TableHead>
                  <TableHead className="font-black">Product</TableHead>
                  <TableHead className="text-right font-black">Qty</TableHead>
                  <TableHead className="text-right font-black">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top_products?.map((p: Record<string, any>, i: number) => (
                  <TableRow key={i} className="hover:bg-app-primary-light/30 transition-colors">
                    <TableCell className="font-bold text-app-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold text-app-foreground">{p.name || 'Unknown'}</TableCell>
                    <TableCell className="text-right text-sm text-app-muted-foreground">{Math.round(p.qty)}</TableCell>
                    <TableCell className="text-right font-bold text-app-primary">{fmt(p.revenue)}</TableCell>
                  </TableRow>
                ))}
                {(!top_products?.length) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-app-muted-foreground">
                      <Package size={32} className="mx-auto mb-2 text-app-foreground" />
                      No sales recorded today
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Customers Today */}
        <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
          <CardHeader className="py-4 bg-app-background border-b">
            <CardTitle className="text-base flex items-center gap-2 font-black">
              <Users size={18} className="text-app-info" /> Top Customers Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-app-surface-2/50 text-[10px] uppercase tracking-widest text-app-muted-foreground">
                  <TableHead className="font-black">#</TableHead>
                  <TableHead className="font-black">Customer</TableHead>
                  <TableHead className="text-right font-black">Orders</TableHead>
                  <TableHead className="text-right font-black">Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top_customers?.map((c: Record<string, any>, i: number) => (
                  <TableRow key={i} className="hover:bg-app-info-bg/30 transition-colors">
                    <TableCell className="font-bold text-app-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold text-app-foreground">{c.name || 'Walk-in'}</TableCell>
                    <TableCell className="text-right text-sm text-app-muted-foreground">{c.orders}</TableCell>
                    <TableCell className="text-right font-bold text-app-info">{fmt(c.spent)}</TableCell>
                  </TableRow>
                ))}
                {(!top_customers?.length) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-app-muted-foreground">
                      <Users size={32} className="mx-auto mb-2 text-app-foreground" />
                      No customer data today
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card className="rounded-[2rem] border shadow-sm overflow-hidden">
        <CardHeader className="py-4 bg-app-background border-b">
          <CardTitle className="text-base flex items-center gap-2 font-black">
            <CreditCard size={18} className="text-app-primary" /> Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {payment_methods?.map((p: Record<string, any>, i: number) => {
              const totalRev = overall?.revenue || 1
              const pct = (p.total / totalRev * 100)
              return (
                <div key={i} className="bg-app-background rounded-2xl p-5 flex items-center gap-4 hover:bg-app-surface-2 transition-all">
                  <div className="text-3xl">{PAYMENT_ICONS[p.method] || '💳'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-bold text-app-foreground">{p.method}</span>
                      <span className="text-xs text-app-muted-foreground font-medium">{p.count} orders</span>
                    </div>
                    <div className="h-2 bg-app-border rounded-full overflow-hidden">
                      <div className="h-full bg-app-gradient-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-right text-sm font-bold text-app-primary">{fmt(p.total)}</div>
                  </div>
                </div>
              )
            })}
            {(!payment_methods?.length) && (
              <div className="col-span-3 text-center py-12 text-app-muted-foreground">
                <CreditCard size={32} className="mx-auto mb-2 text-app-foreground" />
                No payment data today
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
