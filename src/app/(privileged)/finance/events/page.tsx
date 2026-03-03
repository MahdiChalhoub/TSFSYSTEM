// @ts-nocheck
'use client'

import { useCurrency } from '@/lib/utils/currency'
import { safeDateSort } from '@/lib/utils/safe-date'

import { useState, useEffect, useMemo } from "react"
import type { FinancialEvent } from '@/types/erp'
import { getFinancialEvents } from "@/app/actions/finance/financial-events"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import Link from "next/link"
import {
 Zap, Search, ArrowUpCircle, ArrowDownCircle, Wallet, Briefcase
, Calendar } from "lucide-react"

const EVENT_CONFIG: Record<string, { icon: string, color: string, bg: string, label: string }> = {
 PARTNER_WITHDRAWAL: { icon: '🔻', color: 'text-app-error', bg: 'bg-app-error-bg', label: 'Withdrawal' },
 PARTNER_INJECTION: { icon: '💰', color: 'text-app-success', bg: 'bg-app-primary-light', label: 'Injection' },
 CAPITAL_INJECTION: { icon: '🏦', color: 'text-app-success', bg: 'bg-app-success-bg', label: 'Capital' },
 PARTNER_LOAN: { icon: '🤝', color: 'text-app-info', bg: 'bg-app-info-bg', label: 'Partner Loan' },
 LOAN_DISBURSEMENT: { icon: '📤', color: 'text-orange-700', bg: 'bg-orange-50', label: 'Disbursement' },
 LOAN_REPAYMENT: { icon: '📥', color: 'text-teal-700', bg: 'bg-teal-50', label: 'Repayment' },
 EXPENSE: { icon: '💸', color: 'text-app-error', bg: 'bg-app-error-bg', label: 'Expense' },
 SALARY_PAYMENT: { icon: '👤', color: 'text-purple-700', bg: 'bg-purple-50', label: 'Salary' },
 DEFERRED_EXPENSE_CREATION: { icon: '📋', color: 'text-app-warning', bg: 'bg-app-warning-bg', label: 'Deferred Create' },
 DEFERRED_EXPENSE_RECOGNITION: { icon: '📊', color: 'text-app-warning', bg: 'bg-app-warning-bg', label: 'Deferred Recog' },
 ASSET_ACQUISITION: { icon: '🏗️', color: 'text-app-primary', bg: 'bg-app-primary/5', label: 'Asset Purchase' },
 ASSET_DEPRECIATION: { icon: '📉', color: 'text-app-muted-foreground', bg: 'bg-app-surface-2', label: 'Depreciation' },
 ASSET_DISPOSAL: { icon: '🗑️', color: 'text-app-muted-foreground', bg: 'bg-app-background', label: 'Disposal' },
}

const STATUS_COLOR: Record<string, string> = {
 PENDING: 'bg-app-warning-bg text-app-warning',
 POSTED: 'bg-app-success-bg text-app-success',
 REVERSED: 'bg-app-surface-2 text-app-muted-foreground',
 FAILED: 'bg-app-error-bg text-app-error',
}

export default function FinancialEventsPage() {
 const { fmt } = useCurrency()
 const [events, setEvents] = useState<FinancialEvent[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [typeFilter, setTypeFilter] = useState<string | null>(null)

 useEffect(() => { loadEvents() }, [])

 async function loadEvents() {
 setLoading(true)
 try {
 const data = await getFinancialEvents()
 setEvents(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load events")
 } finally {
 setLoading(false)
 }
 }

 const filtered = useMemo(() => {
 let items = events
 if (typeFilter) items = items.filter(e => e.event_type === typeFilter)
 if (search) {
 const s = search.toLowerCase()
 items = items.filter(e =>
 e.reference?.toLowerCase().includes(s) ||
 e.notes?.toLowerCase().includes(s) ||
 e.event_type?.toLowerCase().includes(s)
 )
 }
 return items.sort((a: Record<string, any>, b: Record<string, any>) => (safeDateSort(b.date || b.created_at)) - (safeDateSort(a.date || a.created_at)))
 }, [events, typeFilter, search])

 const totalInflows = events
 .filter(e => ['PARTNER_INJECTION', 'CAPITAL_INJECTION', 'PARTNER_LOAN', 'LOAN_DISBURSEMENT'].includes(e.event_type))
 .reduce((s, e) => s + parseFloat(e.amount || 0), 0)
 const totalOutflows = events
 .filter(e => ['PARTNER_WITHDRAWAL', 'EXPENSE', 'SALARY_PAYMENT', 'LOAN_REPAYMENT'].includes(e.event_type))
 .reduce((s, e) => s + parseFloat(e.amount || 0), 0)
 const pendingCount = events.filter(e => e.status === 'PENDING').length
 const postedCount = events.filter(e => e.status === 'POSTED').length

 const typeCounts: Record<string, number> = {}
 events.forEach(e => { typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1 })

 if (loading && events.length === 0) {
 return (
 <div className="page-container">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
 <Skeleton className="h-96" />
 </div>
 )
 }

 return (
 <div className="page-container">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Zap size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Financial <span className="text-app-primary">Events</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-4 gap-4">
 <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <ArrowDownCircle size={24} className="text-app-primary" />
 <div>
 <p className="text-xs text-app-muted-foreground uppercase">Inflows</p>
 <p className="text-xl font-bold text-app-success">{fmt(totalInflows)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <ArrowUpCircle size={24} className="text-app-error" />
 <div>
 <p className="text-xs text-app-muted-foreground uppercase">Outflows</p>
 <p className="text-xl font-bold text-app-error">{fmt(totalOutflows)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Wallet size={24} className="text-app-warning" />
 <div>
 <p className="text-xs text-app-muted-foreground uppercase">Pending</p>
 <p className="text-xl font-bold text-app-warning">{pendingCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Briefcase size={24} className="text-app-success" />
 <div>
 <p className="text-xs text-app-muted-foreground uppercase">Posted</p>
 <p className="text-xl font-bold text-app-success">{postedCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setTypeFilter(null)}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!typeFilter ? 'bg-app-surface text-app-foreground' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-border'
 }`}
 >
 All ({events.length})
 </button>
 {Object.entries(typeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => {
 const cfg = EVENT_CONFIG[type] || { icon: '📋', color: 'text-app-muted-foreground', bg: 'bg-app-background', label: type }
 return (
 <button
 key={type}
 onClick={() => setTypeFilter(typeFilter === type ? null : type)}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${typeFilter === type ? 'bg-app-surface text-app-foreground' : `${cfg.bg} ${cfg.color} hover:opacity-80`
 }`}
 >
 <span>{cfg.icon}</span> {cfg.label} ({count})
 </button>
 )
 })}
 </div>

 <Card>
 <CardContent className="p-0">
 {filtered.length === 0 ? (
 <div className="text-center py-16 text-app-muted-foreground">
 <Zap size={48} className="mx-auto mb-3 opacity-30" />
 <p>No financial events found</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow className="bg-app-surface-2/50">
 <TableHead>Type</TableHead>
 <TableHead>Date</TableHead>
 <TableHead>Reference</TableHead>
 <TableHead>Notes</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.map((e: Record<string, any>) => {
 const cfg = EVENT_CONFIG[e.event_type] || { icon: '📋', color: 'text-app-muted-foreground', bg: 'bg-app-background', label: e.event_type }
 return (
 <TableRow key={e.id} className="hover:bg-app-surface-2/50">
 <TableCell>
 <Badge className={`${cfg.bg} ${cfg.color}`}>
 {cfg.icon} {cfg.label}
 </Badge>
 </TableCell>
 <TableCell className="text-sm">
 {e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}
 </TableCell>
 <TableCell className="font-mono text-xs text-app-info">{e.reference || '—'}</TableCell>
 <TableCell className="text-sm text-app-muted-foreground max-w-xs truncate">{e.notes || '—'}</TableCell>
 <TableCell>
 <Badge className={STATUS_COLOR[e.status] || 'bg-app-surface-2'}>
 {e.status}
 </Badge>
 </TableCell>
 <TableCell className="text-right font-bold">{fmt(parseFloat(e.amount || 0))}</TableCell>
 </TableRow>
 )
 })}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </div>
 )
}