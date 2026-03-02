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
 PARTNER_WITHDRAWAL: { icon: '🔻', color: 'text-red-700', bg: 'bg-red-50', label: 'Withdrawal' },
 PARTNER_INJECTION: { icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Injection' },
 CAPITAL_INJECTION: { icon: '🏦', color: 'text-green-700', bg: 'bg-green-50', label: 'Capital' },
 PARTNER_LOAN: { icon: '🤝', color: 'text-blue-700', bg: 'bg-blue-50', label: 'Partner Loan' },
 LOAN_DISBURSEMENT: { icon: '📤', color: 'text-orange-700', bg: 'bg-orange-50', label: 'Disbursement' },
 LOAN_REPAYMENT: { icon: '📥', color: 'text-teal-700', bg: 'bg-teal-50', label: 'Repayment' },
 EXPENSE: { icon: '💸', color: 'text-red-600', bg: 'bg-red-50', label: 'Expense' },
 SALARY_PAYMENT: { icon: '👤', color: 'text-purple-700', bg: 'bg-purple-50', label: 'Salary' },
 DEFERRED_EXPENSE_CREATION: { icon: '📋', color: 'text-amber-700', bg: 'bg-amber-50', label: 'Deferred Create' },
 DEFERRED_EXPENSE_RECOGNITION: { icon: '📊', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Deferred Recog' },
 ASSET_ACQUISITION: { icon: '🏗️', color: 'text-indigo-700', bg: 'bg-indigo-50', label: 'Asset Purchase' },
 ASSET_DEPRECIATION: { icon: '📉', color: 'text-gray-700', bg: 'bg-app-surface-2', label: 'Depreciation' },
 ASSET_DISPOSAL: { icon: '🗑️', color: 'text-app-text-muted', bg: 'bg-app-bg', label: 'Disposal' },
}

const STATUS_COLOR: Record<string, string> = {
 PENDING: 'bg-yellow-100 text-yellow-700',
 POSTED: 'bg-green-100 text-green-700',
 REVERSED: 'bg-app-surface-2 text-app-text-muted',
 FAILED: 'bg-red-100 text-red-700',
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
 <header className="flex items-center justify-between">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
 <Calendar size={28} className="text-white" />
 </div>
 Financial <span className="text-indigo-600">Events</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Scheduled & Recurring</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative w-56">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
 <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
 </div>
 <Link href="/finance/events/new">
 <Button size="sm">+ New Event</Button>
 </Link>
 </div>
 </header>

 <div className="grid grid-cols-4 gap-4">
 <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <ArrowDownCircle size={24} className="text-emerald-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Inflows</p>
 <p className="text-xl font-bold text-emerald-700">{fmt(totalInflows)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <ArrowUpCircle size={24} className="text-red-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Outflows</p>
 <p className="text-xl font-bold text-red-700">{fmt(totalOutflows)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Wallet size={24} className="text-yellow-600" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Pending</p>
 <p className="text-xl font-bold text-yellow-700">{pendingCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Briefcase size={24} className="text-green-600" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Posted</p>
 <p className="text-xl font-bold text-green-700">{postedCount}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setTypeFilter(null)}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!typeFilter ? 'bg-gray-900 text-white' : 'bg-app-surface-2 text-app-text-muted hover:bg-gray-200'
 }`}
 >
 All ({events.length})
 </button>
 {Object.entries(typeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => {
 const cfg = EVENT_CONFIG[type] || { icon: '📋', color: 'text-gray-700', bg: 'bg-app-bg', label: type }
 return (
 <button
 key={type}
 onClick={() => setTypeFilter(typeFilter === type ? null : type)}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${typeFilter === type ? 'bg-gray-900 text-white' : `${cfg.bg} ${cfg.color} hover:opacity-80`
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
 <div className="text-center py-16 text-app-text-faint">
 <Zap size={48} className="mx-auto mb-3 opacity-30" />
 <p>No financial events found</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow className="bg-gray-50/50">
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
 const cfg = EVENT_CONFIG[e.event_type] || { icon: '📋', color: 'text-gray-700', bg: 'bg-app-bg', label: e.event_type }
 return (
 <TableRow key={e.id} className="hover:bg-gray-50/50">
 <TableCell>
 <Badge className={`${cfg.bg} ${cfg.color}`}>
 {cfg.icon} {cfg.label}
 </Badge>
 </TableCell>
 <TableCell className="text-sm">
 {e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}
 </TableCell>
 <TableCell className="font-mono text-xs text-blue-600">{e.reference || '—'}</TableCell>
 <TableCell className="text-sm text-app-text-muted max-w-xs truncate">{e.notes || '—'}</TableCell>
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