'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, use } from "react"
import { getLoan, getAmortizationSchedule } from "@/app/actions/finance/loans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Calendar, TrendingDown, DollarSign, ArrowLeft,
  FileText, Clock, Target, PiggyBank
} from "lucide-react"
import Link from 'next/link'

export default function LoanAmortizationSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { fmt } = useCurrency()
  const { id } = use(params)

  const [loan, setLoan] = useState<any>(null)
  const [schedule, setSchedule] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const [loanData, scheduleData] = await Promise.all([
        getLoan(parseInt(id)),
        getAmortizationSchedule(parseInt(id))
      ])

      setLoan(loanData)
      setSchedule(scheduleData)
    } catch (error) {
      toast.error("Failed to load amortization schedule")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!loan || !schedule) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <FileText size={48} className="mx-auto text-app-muted-foreground mb-4" />
            <p className="text-app-muted-foreground">
              Loan or amortization schedule not found
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPrincipal = schedule.installments?.reduce((sum: number, inst: any) =>
    sum + parseFloat(inst.principal_amount || 0), 0) || 0

  const totalInterest = schedule.installments?.reduce((sum: number, inst: any) =>
    sum + parseFloat(inst.interest_amount || 0), 0) || 0

  const totalPayments = totalPrincipal + totalInterest

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href={`/finance/loans/${id}`}>
            <Button variant="ghost" size="sm" className="mb-3 gap-2">
              <ArrowLeft size={16} />
              Back to Loan Details
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
              <Calendar size={32} className="text-app-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
              <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                Amortization <span className="text-app-primary">Schedule</span>
              </h1>
              <p className="text-sm text-app-muted-foreground mt-1">
                {loan.contact_name} • {schedule.method || loan.interest_type}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                <DollarSign size={20} className="text-blue-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Principal</p>
                <p className="text-xl font-black text-blue-900 mt-0.5">{fmt(loan.principal_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center">
                <TrendingDown size={20} className="text-orange-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-orange-700 uppercase tracking-widest">Total Interest</p>
                <p className="text-xl font-black text-orange-900 mt-0.5">{fmt(totalInterest)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center">
                <Target size={20} className="text-purple-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Total Payments</p>
                <p className="text-xl font-black text-purple-900 mt-0.5">{fmt(totalPayments)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center">
                <Clock size={20} className="text-green-700" />
              </div>
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Installments</p>
                <p className="text-xl font-black text-green-900 mt-0.5">{schedule.installments?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Details */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Interest Rate
              </p>
              <p className="text-lg font-bold">{loan.interest_rate}%</p>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Interest Type
              </p>
              <Badge variant="outline" className="rounded-xl">
                {loan.interest_type || schedule.method}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Payment Frequency
              </p>
              <Badge variant="outline" className="rounded-xl">
                {loan.payment_frequency}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Start Date
              </p>
              <p className="text-sm font-bold">
                {loan.start_date ? new Date(loan.start_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Maturity Date
              </p>
              <p className="text-sm font-bold">
                {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Term
              </p>
              <p className="text-sm font-bold">{loan.term_months} months</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule Table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Schedule</CardTitle>
            <div className="flex items-center gap-2">
              <PiggyBank size={18} className="text-app-primary" />
              <span className="text-sm font-bold text-app-muted-foreground">
                {schedule.installments?.length || 0} payments
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-app-border">
                  <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Due Date
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Payment Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Principal
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Interest
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Balance After
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-black uppercase tracking-wider text-app-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedule.installments?.map((installment: any, idx: number) => {
                  const isPaid = installment.status === 'PAID'
                  const isOverdue = installment.status === 'OVERDUE'
                  const isDue = installment.status === 'DUE'

                  return (
                    <tr
                      key={installment.id || idx}
                      className={`border-b border-app-border/50 hover:bg-app-surface transition-colors ${
                        isPaid ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="w-8 h-8 rounded-lg bg-app-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-app-primary">
                            {installment.installment_number || idx + 1}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-app-muted-foreground" />
                          <span className="text-sm font-medium">
                            {installment.due_date
                              ? new Date(installment.due_date).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-app-foreground">
                          {fmt(installment.total_amount || (parseFloat(installment.principal_amount || 0) + parseFloat(installment.interest_amount || 0)))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm">
                          {fmt(installment.principal_amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm text-orange-700">
                          {fmt(installment.interest_amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-app-primary">
                          {fmt(installment.balance_after || installment.remaining_balance)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={isPaid ? 'default' : isOverdue ? 'destructive' : 'outline'}
                          className="rounded-xl"
                        >
                          {installment.status || 'PENDING'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-app-border bg-app-surface">
                  <td colSpan={2} className="py-4 px-4 text-sm font-black uppercase tracking-wider">
                    TOTALS
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-lg font-black text-app-foreground">
                      {fmt(totalPayments)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-lg font-black">
                      {fmt(totalPrincipal)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-lg font-black text-orange-700">
                      {fmt(totalInterest)}
                    </span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Interest Cost Analysis */}
      <Card className="rounded-2xl bg-app-surface-2">
        <CardHeader>
          <CardTitle>Interest Cost Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Total Interest Cost
              </p>
              <p className="text-3xl font-black text-orange-700">{fmt(totalInterest)}</p>
              <p className="text-xs text-app-muted-foreground mt-1">
                Over {loan.term_months} months
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Interest as % of Principal
              </p>
              <p className="text-3xl font-black text-app-primary">
                {loan.principal_amount > 0
                  ? ((totalInterest / parseFloat(loan.principal_amount)) * 100).toFixed(2)
                  : '0.00'}%
              </p>
              <p className="text-xs text-app-muted-foreground mt-1">
                Cost of borrowing
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-2">
                Effective Monthly Rate
              </p>
              <p className="text-3xl font-black text-app-foreground">
                {loan.term_months > 0
                  ? ((totalInterest / parseFloat(loan.principal_amount)) / loan.term_months * 100).toFixed(3)
                  : '0.000'}%
              </p>
              <p className="text-xs text-app-muted-foreground mt-1">
                Average per month
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
