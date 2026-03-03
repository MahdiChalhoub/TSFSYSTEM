// @ts-nocheck
'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from '@/lib/utils/currency'
import type { ChartOfAccount, JournalEntry } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { TrendingUp, DollarSign, BarChart3, Percent } from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

export default function RevenueBreakdownPage() {
 const { fmt } = useCurrency()
 const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
 const [journals, setJournals] = useState<JournalEntry[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('fin_revenue', {
 columns: ['code', 'name', 'balance', 'pct', 'journalCount'],
 pageSize: 25, sortKey: 'balance', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const [accts, jrnls] = await Promise.all([
 erpFetch('coa/'),
 erpFetch('finance/journal/'),
 ])
 setAccounts((Array.isArray(accts) ? accts : accts.results || []).filter((a: Record<string, any>) => a.type === 'INCOME'))
 setJournals(Array.isArray(jrnls) ? jrnls : jrnls.results || [])
 } catch {
 toast.error("Failed to load revenue data")
 } finally {
 setLoading(false)
 }
 }

 // Enrich income accounts with journal entry counts
 const enriched = useMemo(() => {
 return accounts.map(a => {
 const entries = journals.filter(j =>
 j.account === a.id || j.account_id === a.id ||
 j.credit_account === a.id || j.debit_account === a.id
 )
 const bal = Math.abs(parseFloat(a.balance || 0))
 return { ...a, journalCount: entries.length, balance: bal }
 }).sort((a, b) => b.balance - a.balance)
 }, [accounts, journals])

 const totalRevenue = enriched.reduce((s, a) => s + a.balance, 0)
 const topAccount = enriched[0]
 const avgBalance = enriched.length > 0 ? totalRevenue / enriched.length : 0

 const columns: ColumnDef<any>[] = useMemo(() => [
 { key: 'code', label: 'Code', sortable: true, render: (a) => <span className="font-mono text-xs">{a.code}</span> },
 { key: 'name', label: 'Account Name', sortable: true, render: (a) => <span className="font-medium text-sm">{a.name}</span> },
 { key: 'balance', label: 'Balance', align: 'right', sortable: true, render: (a) => <span className="font-bold text-app-primary">{fmt(a.balance)}</span> },
 {
 key: 'pct',
 label: '% of Revenue',
 align: 'right',
 render: (a) => {
 const pct = totalRevenue > 0 ? Math.round(a.balance * 100 / totalRevenue) : 0
 return (
 <div className="app-page flex items-center gap-2 justify-end">
 <div className="w-12 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
 <div className="h-full bg-app-success/10 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
 </div>
 <span className="text-xs text-app-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
 </div>
 )
 }
 },
 { key: 'journalCount', label: 'Journal Entries', align: 'right', sortable: true },
 ], [fmt, totalRevenue])

 if (loading) {
 return (
 <>
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
 <Skeleton className="h-96" />
 </>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <TrendingUp size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Revenue <span className="text-app-primary">Center</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-4 gap-4">
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-success/10/60 flex items-center justify-center">
 <DollarSign size={24} className="text-app-primary" />
 </div>
 <div>
 <p className="text-xs font-bold text-app-primary uppercase tracking-wider">Total Revenue</p>
 <p className="text-2xl font-bold text-app-success mt-0.5">{fmt(totalRevenue)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-info/10/60 flex items-center justify-center">
 <BarChart3 size={24} className="text-app-info" />
 </div>
 <div>
 <p className="text-xs font-bold text-app-info uppercase tracking-wider">Income Accounts</p>
 <p className="text-2xl font-bold text-app-info mt-0.5">{accounts.length}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-primary/10/60 flex items-center justify-center">
 <TrendingUp size={24} className="text-app-primary" />
 </div>
 <div>
 <p className="text-xs font-bold text-app-primary uppercase tracking-wider">Avg per Account</p>
 <p className="text-2xl font-bold text-app-primary mt-0.5">{fmt(avgBalance)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-warning/10/60 flex items-center justify-center">
 <Percent size={24} className="text-app-warning" />
 </div>
 <div>
 <p className="text-xs font-bold text-app-warning uppercase tracking-wider">Top Account</p>
 <p className="text-sm font-bold text-app-warning mt-0.5 truncate max-w-[150px]">{topAccount?.name || '\u2014'}</p>
 <p className="text-[10px] text-app-warning font-bold uppercase">{topAccount ? (Math.round(topAccount.balance * 100 / (totalRevenue || 1)) + '% of total') : ''}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Revenue Waterfall */}
 <Card className="rounded-2xl shadow-sm border-0 overflow-hidden">
 <CardHeader className="py-4 border-b bg-app-surface/50">
 <CardTitle className="text-sm font-bold uppercase tracking-wider text-app-muted-foreground">Revenue Distribution</CardTitle>
 </CardHeader>
 <CardContent className="pt-6">
 <div className="space-y-4">
 {enriched.slice(0, 8).map((a: Record<string, any>) => {
 const denominator = totalRevenue || 1
 const pct = Math.round(a.balance * 100 / denominator)
 return (
 <div key={a.id} className="flex items-center gap-4">
 <div className="w-20 font-mono text-[10px] text-app-muted-foreground font-bold uppercase">{a.code}</div>
 <div className="flex-1">
 <div className="flex justify-between items-end mb-1.5">
 <span className="text-xs font-semibold text-app-muted-foreground">{a.name}</span>
 <span className="text-xs font-bold text-app-foreground">{fmt(a.balance)}</span>
 </div>
 <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000" style={{ width: String(pct) + "%" }} />
 </div>
 </div>
 <div className="w-12 text-right">
 <span className="text-[10px] font-black text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded-md">
 {pct.toFixed(1)}%
 </span>
 </div>
 </div>
 )
 })}
 </div>
 </CardContent>
 </Card>
 </div>
 )
}
