'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgTaxPolicy, getCounterpartyTaxProfiles } from '@/app/actions/finance/tax-engine'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Shield, Users, FileText, TrendingUp, TrendingDown,
  DollarSign, Calculator, Settings, ArrowRight,
  CheckCircle2, Percent, Building2, List, BarChart3, FileCheck
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

export default function TaxPolicyDashboard() {
  const { fmt } = useCurrency()
  const router = useRouter()

  const [policy, setPolicy] = useState<any>(null)
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [pol, profs] = await Promise.all([
        getOrgTaxPolicy(),
        getCounterpartyTaxProfiles(),
      ])

      const p = Array.isArray(pol) ? pol[0] : pol?.results?.[0]
      setPolicy(p || null)
      setProfiles(Array.isArray(profs) ? profs : profs?.results || [])
    } catch (error) {
      toast.error('Failed to load tax policy')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
              <Shield size={32} className="text-app-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
              <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                Tax Policy <span className="text-app-primary">Engine</span>
              </h1>
              <p className="text-sm text-app-muted-foreground mt-1">
                Organization Tax Policy · Counterparty Profiles · AIRSI · VAT · Periodic Tax
              </p>
            </div>
          </div>
        </div>

        {policy && (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-xl px-3 py-1.5">
              <Building2 size={14} className="mr-2" />
              Policy ID #{policy.id}
            </Badge>
            <Badge className="rounded-xl px-3 py-1.5 bg-app-success">
              <CheckCircle2 size={14} className="mr-2" />
              Active
            </Badge>
          </div>
        )}
      </header>

      {/* 6 Tax Types Overview */}
      {policy && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tax Type 1: VAT (TVA) */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600/10 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-widest">1. VAT (TVA)</p>
                  <p className="text-lg font-black text-green-900 mt-0.5">
                    Out: {policy.vat_output_enabled ? 'YES' : 'NO'} · In: {(parseFloat(policy.vat_input_recoverability) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Type 2: AIRSI */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center">
                  <Shield size={20} className="text-purple-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">2. AIRSI</p>
                  <p className="text-sm font-black text-purple-900 mt-0.5">
                    {policy.airsi_treatment}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Type 3: Purchase Tax */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                  <TrendingDown size={20} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">3. Purchase Tax</p>
                  <p className="text-lg font-black text-blue-900 mt-0.5">
                    {(parseFloat(policy.purchase_tax_rate) * 100).toFixed(2)}% · {policy.purchase_tax_mode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Type 4: Sales/Turnover Tax */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-orange-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-700 uppercase tracking-widest">4. Sales/Turnover Tax</p>
                  <p className="text-lg font-black text-orange-900 mt-0.5">
                    {(parseFloat(policy.sales_tax_rate) * 100).toFixed(2)}% · {policy.sales_tax_trigger}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Type 5: Periodic/Forfait */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/10 flex items-center justify-center">
                  <Calculator size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">5. Periodic/Forfait</p>
                  <p className="text-lg font-black text-amber-900 mt-0.5">
                    {fmt(policy.periodic_amount)} {policy.periodic_interval}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Type 6: Profit Tax */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                  <DollarSign size={20} className="text-red-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-widest">6. Profit Tax</p>
                  <p className="text-sm font-black text-red-900 mt-0.5">
                    {policy.profit_tax_mode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Engine Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Organization Tax Policies */}
        <Card className="rounded-2xl border-2 border-app-primary/20 hover:border-app-primary/40 transition-colors cursor-pointer" onClick={() => router.push('/finance/org-tax-policies')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-app-primary/10 flex items-center justify-center">
                  <Building2 size={24} className="text-app-primary" />
                </div>
                <div>
                  <CardTitle>Organization Tax Policies</CardTitle>
                  <CardDescription className="mt-1">
                    Configure how your organization handles all 6 tax types
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-app-surface border">
                <p className="text-xs text-app-muted-foreground uppercase font-bold">Active Policy</p>
                <p className="text-xl font-black text-app-foreground mt-1">{policy ? policy.name : 'None'}</p>
              </div>
              <div className="p-3 rounded-xl bg-app-surface border">
                <p className="text-xs text-app-muted-foreground uppercase font-bold">Country</p>
                <p className="text-xl font-black text-app-foreground mt-1">{policy ? policy.country_code : '—'}</p>
              </div>
            </div>
            <Button className="w-full mt-4 rounded-xl gap-2" variant="outline">
              <Settings size={16} />
              Manage Policies
            </Button>
          </CardContent>
        </Card>

        {/* Counterparty Tax Profiles */}
        <Card className="rounded-2xl border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/counterparty-tax-profiles')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Users size={24} className="text-green-700" />
                </div>
                <div>
                  <CardTitle>Counterparty Tax Profiles</CardTitle>
                  <CardDescription className="mt-1">
                    Tax treatment presets for suppliers and customers
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-black text-green-900">{profiles.length}</p>
                <p className="text-xs text-green-700 mt-1 uppercase font-bold">Total</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-black text-green-900">{profiles.filter(p => p.vat_registered).length}</p>
                <p className="text-xs text-green-700 mt-1 uppercase font-bold">VAT Reg</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-center">
                <p className="text-2xl font-black text-green-900">{profiles.filter(p => p.airsi_subject).length}</p>
                <p className="text-xs text-green-700 mt-1 uppercase font-bold">AIRSI</p>
              </div>
            </div>
            <Button className="w-full mt-4 rounded-xl gap-2 bg-green-600 hover:bg-green-700 text-white">
              <List size={16} />
              Manage Profiles
            </Button>
          </CardContent>
        </Card>

        {/* Periodic Tax Accruals */}
        <Card className="rounded-2xl border-2 border-amber-200 hover:border-amber-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/periodic-tax')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calculator size={24} className="text-amber-700" />
                </div>
                <div>
                  <CardTitle>Periodic Tax Accruals</CardTitle>
                  <CardDescription className="mt-1">
                    Automated sales tax and forfait provisions
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="rounded-xl bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                Background service generates periodic tax provisions based on revenue/profit
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4 rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <BarChart3 size={16} />
              View Accruals
            </Button>
          </CardContent>
        </Card>

        {/* VAT Returns & Settlement */}
        <Card className="rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/vat-return')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FileCheck size={24} className="text-blue-700" />
                </div>
                <div>
                  <CardTitle>VAT Returns & Settlement</CardTitle>
                  <CardDescription className="mt-1">
                    VAT reports, returns, and settlement posting
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                className="w-full rounded-xl gap-2"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push('/finance/vat-return')
                }}
              >
                <FileText size={16} />
                VAT Return Reports
              </Button>
              <Button
                className="w-full rounded-xl gap-2"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push('/finance/vat-settlement')
                }}
              >
                <DollarSign size={16} />
                VAT Settlement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom Tax Rules */}
        <Card className="rounded-2xl border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/custom-tax-rules')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Settings size={24} className="text-purple-700" />
                </div>
                <div>
                  <CardTitle>Custom Tax Rules</CardTitle>
                  <CardDescription className="mt-1">
                    Product/category-specific tax overrides
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="rounded-xl bg-purple-50 border-purple-200">
              <Info className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-900 text-sm">
                Override default tax rates for specific products or categories
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4 rounded-xl gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <List size={16} />
              Manage Rules
            </Button>
          </CardContent>
        </Card>

        {/* Tax Groups */}
        <Card className="rounded-2xl border-2 border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/tax-groups')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Percent size={24} className="text-indigo-700" />
                </div>
                <div>
                  <CardTitle>Tax Groups</CardTitle>
                  <CardDescription className="mt-1">
                    Grouped tax rates for products (e.g. TVA 18%, TVA 0%)
                  </CardDescription>
                </div>
              </div>
              <ArrowRight size={20} className="text-app-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="rounded-xl bg-indigo-50 border-indigo-200">
              <Info className="h-4 w-4 text-indigo-600" />
              <AlertDescription className="text-indigo-900 text-sm">
                Standard VAT rates applied to products and invoices
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <List size={16} />
              Manage Groups
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tax Reports */}
      <Card className="rounded-2xl border-2 border-slate-200 hover:border-slate-400 transition-colors cursor-pointer" onClick={() => router.push('/finance/tax-reports')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <BarChart3 size={24} className="text-slate-700" />
              </div>
              <div>
                <CardTitle>Tax Reports & Analytics</CardTitle>
                <CardDescription className="mt-1">
                  Comprehensive tax reports and analytics dashboard
                </CardDescription>
              </div>
            </div>
            <ArrowRight size={20} className="text-app-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full rounded-xl gap-2 bg-slate-600 hover:bg-slate-700 text-white">
            <BarChart3 size={16} />
            View Tax Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
