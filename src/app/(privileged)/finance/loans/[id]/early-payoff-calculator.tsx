// @ts-nocheck
'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState } from "react"
import { calculateEarlyPayoff } from "@/app/actions/finance/loans"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Calculator, TrendingDown, DollarSign, Calendar } from "lucide-react"

export function EarlyPayoffCalculator({ loanId }: { loanId: number }) {
  const { fmt } = useCurrency()

  const [payoffDate, setPayoffDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1) // Default: 1 month from now
    return date.toISOString().split('T')[0]
  })

  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function handleCalculate() {
    if (!payoffDate) {
      toast.error('Please select a payoff date')
      return
    }

    setCalculating(true)
    try {
      const data = await calculateEarlyPayoff(loanId, payoffDate)
      setResult(data)
      toast.success('Early payoff calculation complete!')
    } catch (error) {
      toast.error('Failed to calculate early payoff')
      console.error(error)
    } finally {
      setCalculating(false)
    }
  }

  const savings = result ? parseFloat(result.interest_saved || 0) : 0
  const payoffAmount = result ? parseFloat(result.payoff_amount || 0) : 0
  const remainingPrincipal = result ? parseFloat(result.remaining_principal || 0) : 0
  const remainingInterest = result ? parseFloat(result.remaining_interest || 0) : 0

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payoff_date" className="text-xs font-bold uppercase tracking-wider">
            Proposed Payoff Date
          </Label>
          <Input
            id="payoff_date"
            type="date"
            value={payoffDate}
            onChange={(e) => setPayoffDate(e.target.value)}
            className="mt-2 rounded-xl"
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-app-muted-foreground mt-2">
            Select a future date to see early payoff savings
          </p>
        </div>

        <div className="flex items-end">
          <Button
            onClick={handleCalculate}
            disabled={calculating || !payoffDate}
            className="w-full h-10 rounded-xl bg-app-primary hover:bg-app-primary/90 gap-2"
          >
            <Calculator size={16} className={calculating ? 'animate-spin' : ''} />
            {calculating ? 'Calculating...' : 'Calculate Payoff'}
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="h-px bg-app-border" />

          {/* Main KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Payoff Amount */}
            <div className="p-4 rounded-xl bg-app-primary/5 border border-app-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-app-primary/10 flex items-center justify-center">
                  <DollarSign size={20} className="text-app-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">
                    Total Payoff Amount
                  </p>
                </div>
              </div>
              <p className="text-3xl font-black text-app-primary">
                {fmt(payoffAmount)}
              </p>
              <p className="text-xs text-app-muted-foreground mt-2">
                Amount needed to pay off on {new Date(payoffDate).toLocaleDateString()}
              </p>
            </div>

            {/* Interest Saved */}
            <div className="p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingDown size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wider">
                    Interest Saved
                  </p>
                </div>
              </div>
              <p className="text-3xl font-black text-green-700">
                {fmt(savings)}
              </p>
              <p className="text-xs text-green-600 mt-2">
                By paying off early vs scheduled maturity
              </p>
            </div>

            {/* Days Saved */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar size={20} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Time Saved
                  </p>
                </div>
              </div>
              <p className="text-3xl font-black text-blue-700">
                {result.months_saved || 0}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Months earlier than scheduled
              </p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-app-surface border">
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                Remaining Principal
              </p>
              <p className="text-2xl font-black text-app-foreground">
                {fmt(remainingPrincipal)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-app-surface border">
              <p className="text-sm font-bold text-app-muted-foreground uppercase tracking-wider mb-3">
                Accrued Interest (to date)
              </p>
              <p className="text-2xl font-black text-orange-700">
                {fmt(remainingInterest)}
              </p>
            </div>
          </div>

          {/* Summary Message */}
          <div className="p-4 rounded-xl bg-app-success/10 border border-app-success/20">
            <p className="text-sm font-medium text-app-success">
              <strong>Summary:</strong> By paying off this loan on {new Date(payoffDate).toLocaleDateString()},
              you would save <strong>{fmt(savings)}</strong> in interest charges and complete the loan{' '}
              <strong>{result.months_saved || 0} months</strong> earlier than the original schedule.
            </p>
          </div>

          {/* Remaining Installments Info */}
          {result.remaining_installments && (
            <div className="text-center text-sm text-app-muted-foreground">
              <p>
                <strong>{result.remaining_installments}</strong> scheduled payments would be eliminated
              </p>
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="text-center py-8 text-app-muted-foreground">
          <Calculator size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            Select a payoff date and click "Calculate Payoff" to see potential savings
          </p>
        </div>
      )}
    </div>
  )
}
