'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from '@/lib/utils/currency'
import type { ChartOfAccount, JournalEntry } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { DollarSign, BarChart3, AlertTriangle, Percent, Receipt } from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

import { useAdmin } from "@/context/AdminContext"

export default function ExpenseTrackerPage() {
 const { viewScope } = useAdmin()
 const { fmt } = useCurrency()
 const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
 const [journals, setJournals] = useState<JournalEntry[]>([])
 const [loading, setLoading] = useState(true)
 const settings = useListViewSettings('fin_expenses', {
 columns: ['code', 'name', 'absBalance', 'pct', 'journalCount'],
 pageSize: 25, sortKey: 'absBalance', sortDir: 'desc'
 })

 useEffect(() => { loadData() }, [viewScope])

 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const [accts, jrnls] = await Promise.all([
 erpFetch('coa/'),
 erpFetch('finance/journal/'),
 ])
 setAccounts((Array.isArray(accts) ? accts : accts.results || []).filter((a: Record<string, any>) => a.type === 'EXPENSE'))
 setJournals(Array.isArray(jrnls) ? jrnls : jrnls.results || [])
 } catch {
 toast.error("Failed to load expense data")
 } finally {
 setLoading(false)
 }
 }

 const enriched = useMemo(() => {
 return accounts.map(a => {
 const entries = journals.filter(j =>
 String(j.account) === String(a.id) || String(j.account_id) === String(a.id) ||
 String(j.credit_account) === String(a.id) || String(j.debit_account) === String(a.id)
 )
 const bal = Math.abs(parseFloat(String(a.balance || 0)))
 return { ...a, journalCount: entries.length, absBalance: bal }
 }).sort((a, b) => b.absBalance - a.absBalance)
 }, [accounts, journals])

 const totalExpense = enriched.reduce((s, a) => s + a.absBalance, 0)
 const topAccount = enriched[0]
 const accountsWithActivity = enriched.filter(a => a.journalCount > 0).length
 const top3Pct = enriched.length >= 3
 ? ((enriched[0].absBalance + enriched[1].absBalance + enriched[2].absBalance) / totalExpense * 100)
 : 100

 const columns: ColumnDef<any>[] = useMemo(() => [
 { key: 'code', label: 'Code', sortable: true, render: (a) => <span className="font-mono text-xs">{a.code}</span> },
 { key: 'name', label: 'Account Name', sortable: true, render: (a) => <span className="font-medium text-sm">{a.name}</span> },
 { key: 'absBalance', label: 'Balance', align: 'right', sortable: true, render: (a) => <span className="font-bold text-rose-600">{fmt(a.absBalance)}</span> },
 {
 key: 'pct',
 label: '% of Expenses',
 align: 'right',
 render: (a) => {
 const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
 return (
 <div className="flex items-center gap-2 justify-end">
 <div className="w-12 h-1.5 bg-app-surface-2 rounded-full overflow-hidden">
 <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
 </div>
 <span className="text-xs text-app-text-muted w-10 text-right">{pct.toFixed(1)}%</span>
 </div>
 )
 }
 },
 { key: 'journalCount', label: 'Journal Entries', align: 'right', sortable: true },
 ], [fmt, totalExpense])

 if (loading) {
 return (
 <div className="page-container">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
 <Skeleton className="h-96" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 <header>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
 <Receipt size={28} className="text-app-text" />
 </div>
 Expense <span className="text-rose-600">Accounts</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Track & Manage</p>
 </header>

 <div className="grid grid-cols-4 gap-4">
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-rose-200/60 flex items-center justify-center">
 <DollarSign size={24} className="text-rose-600" />
 </div>
 <div>
 <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Total Expenses</p>
 <p className="text-2xl font-bold text-rose-900 mt-0.5">{fmt(totalExpense)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
 <BarChart3 size={24} className="text-blue-600" />
 </div>
 <div>
 <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Accounts</p>
 <p className="text-2xl font-bold text-blue-900 mt-0.5">{accounts.length}</p>
 <p className="text-[10px] text-blue-500 font-bold uppercase">{accountsWithActivity} active</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
 <AlertTriangle size={24} className="text-amber-600" />
 </div>
 <div>
 <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Top Account</p>
 <p className="text-sm font-bold text-amber-900 mt-0.5 truncate max-w-[150px]">{topAccount?.name || '\u2014'}</p>
 <p className="text-[10px] text-amber-500 font-bold uppercase">{topAccount ? fmt(topAccount.absBalance) : ''}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-purple-200/60 flex items-center justify-center">
 <Percent size={24} className="text-purple-600" />
 </div>
 <div>
 <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Conc. (Top 3)</p>
 <p className="text-2xl font-bold text-purple-900 mt-0.5">{top3Pct.toFixed(0)}%</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Expense Distribution Bars */}
 <Card className="rounded-2xl shadow-sm border-0 overflow-hidden">
 <CardHeader className="py-4 border-b bg-stone-50/50">
 <CardTitle className="text-sm font-bold uppercase tracking-wider text-app-text-muted">Expense Distribution</CardTitle>
 </CardHeader>
 <CardContent className="pt-6">
 <div className="space-y-4">
 {enriched.filter(a => a.absBalance > 0).slice(0, 8).map((a: Record<string, any>) => {
 const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
 return (
 <div key={a.id} className="flex items-center gap-4">
 <div className="w-20 font-mono text-[10px] text-app-text-faint font-bold uppercase">{a.code}</div>
 <div className="flex-1">
 <div className="flex justify-between items-end mb-1.5">
 <span className="text-xs font-semibold text-stone-700">{a.name}</span>
 <span className="text-xs font-bold text-app-text">{fmt(a.absBalance)}</span>
 </div>
 <div className="h-2 bg-app-surface-2 rounded-full overflow-hidden">
 <div
 className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-1000"
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 <div className="w-12 text-right">
 <span className="text-[10px] font-black text-app-text-faint bg-app-surface-2 px-1.5 py-0.5 rounded-md">
 {pct.toFixed(1)}%
 </span>
 </div>
 </div>
 )
 })}
 </div>
 </CardContent>
 </Card>

 <TypicalListView
 title="Account Details"
 data={enriched}
 loading={loading}
 getRowId={(item) => item.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-2xl shadow-sm border-0 overflow-hidden"
 />
 </div>
 )
}
