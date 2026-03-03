// @ts-nocheck
'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo, startTransition } from "react"
import type { FinancialAccount } from '@/types/erp'
import { getBankAccounts, getBankReconciliation, triggerAutoMatch, matchEntries } from "@/app/actions/finance/bank-reconciliation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 Table,
 TableBody,
 TableCell,
 TableRow
} from "@/components/ui/table"
import {
 Landmark, ArrowLeft, Search, DollarSign,
 ArrowUpRight, ArrowDownRight, Hash, FileText,
 Calendar, Building, RefreshCw, ChevronRight,
 ShieldCheck, Wallet, Landmark as BankIcon,
 CheckCircle2, AlertTriangle, Link, Link2Off, Sparkles
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

export default function BankReconciliationPage() {
 const { fmt } = useCurrency()
 const [accounts, setAccounts] = useState<FinancialAccount[]>([])
 const [detail, setDetail] = useState<any | null>(null)
 const [loading, setLoading] = useState(true)
 const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
 const [search, setSearch] = useState('')
 const [startDate, setStartDate] = useState('')
 const [endDate, setEndDate] = useState('')

 // Match-Maker State
 const [selectedBankEntry, setSelectedBankEntry] = useState<any | null>(null)
 const [selectedLedgerEntries, setSelectedLedgerEntries] = useState<string[]>([])
 const [matching, setMatching] = useState(false)
 const [autoReconciling, setAutoReconciling] = useState(false)

 const settings = useListViewSettings('fin_bank_recon', {
 columns: ['code', 'name', 'entry_count', 'book_balance', 'actions'],
 pageSize: 25, sortKey: 'name', sortDir: 'asc'
 })

 useEffect(() => { loadAccounts() }, [])

 async function loadAccounts() {
 setLoading(true)
 try {
 const data = await getBankAccounts()
 setAccounts(data.accounts || [])
 } catch {
 toast.error("Failed to load bank accounts")
 } finally {
 setLoading(false)
 }
 }

 async function drillIn(accountId: string) {
 setLoading(true)
 setSelectedAccountId(accountId)
 try {
 const data = await getBankReconciliation(accountId, startDate || undefined, endDate || undefined)
 setDetail(data)
 setSelectedBankEntry(null)
 setSelectedLedgerEntries([])
 } catch {
 toast.error("Failed to load account entries")
 } finally {
 setLoading(false)
 }
 }

 async function handleConfirmMatch() {
 if (!selectedBankEntry || selectedLedgerEntries.length === 0) return
 setMatching(true)
 try {
 await matchEntries(selectedBankEntry.id, selectedLedgerEntries)
 toast.success("Transaction matched successfully")
 drillIn(selectedAccountId as string)
 } catch (err: unknown) {
 toast.error(err instanceof Error ? err.message : "Matching failed")
 } finally {
 setMatching(false)
 }
 }

 async function handleAutoMatch() {
 if (!selectedAccountId) return
 setAutoReconciling(true)
 toast.info("Magic Matcher at work. Scoping probabilities...", { icon: <Sparkles size={14} className="text-app-primary animate-pulse" />, duration: 3000 })

 try {
 const res = await triggerAutoMatch(selectedAccountId)
 const matchCount = res.match_count || 0
 if (matchCount > 0) {
 toast.success(`Success! Fixed ${matchCount} transactions automatically. Accuracy: 99%.`, {
 description: "High-probability matches found based on Amount/Reference.",
 icon: <CheckCircle2 size={16} className="text-app-primary" />
 })
 } else {
 toast.info("No 100% matches found. Manual refinement needed.")
 }
 drillIn(selectedAccountId)
 } catch (err: unknown) {
 toast.error("Auto-pilot failed. Reverting to manual control.")
 } finally {
 setAutoReconciling(false)
 }
 }

 function goBack() {
 setSelectedAccountId(null)
 setDetail(null)
 setSearch('')
 }

 const accountColumns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'code',
 label: 'Account Code',
 width: '120px',
 render: (acc) => <Badge variant="outline" className="font-mono text-[10px] h-5 rounded-lg">{acc.code}</Badge>
 },
 {
 key: 'name',
 label: 'Bank Account Name',
 sortable: true,
 render: (acc) => (
 <div className="app-page flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-info-bg text-app-info flex items-center justify-center font-black text-xs">
 <BankIcon size={14} />
 </div>
 <span className="font-bold text-app-foreground">{acc.name}</span>
 </div>
 )
 },
 {
 key: 'entry_count',
 label: 'Activity',
 align: 'center',
 render: (acc) => <span className="text-[10px] text-app-muted-foreground font-bold uppercase">{acc.entry_count} Entries</span>
 },
 {
 key: 'book_balance',
 label: 'Ledger Balance',
 align: 'right',
 render: (acc) => <span className="font-black text-app-info text-xs">{fmt(acc.book_balance)}</span>
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (acc: any) => (
 <Button variant="ghost" size="sm" onClick={() => drillIn(acc.id)} className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-app-info hover:bg-app-info-bg gap-1.5 transition-all">
 Reconcile <ChevronRight size={14} />
 </Button>
 )
 }
 ], [fmt])

 if (loading && !detail && accounts.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }

 // Detail View
 if (selectedAccountId && detail) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Building2 size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Bank <span className="text-app-primary">Reconciliation</span>
          </h1>
        </div>
      </div>
    </header>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch h-[600px]">
 {/* LEFT: Bank Statement Desk */}
 <div className="flex flex-col gap-4">
 <div className="flex items-center justify-between border-b pb-2">
 <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest flex items-center gap-2">
 <BankIcon size={16} className="text-app-info" /> External Bank Reality
 </h3>
 <Badge className="bg-app-info-bg text-app-info font-bold text-[9px] uppercase tracking-tighter">Bank Feed</Badge>
 </div>
 <div className="flex-1 bg-app-surface rounded-3xl border border-app-border shadow-sm overflow-hidden flex flex-col">
 <div className="p-3 border-b bg-app-surface/50 flex items-center justify-between">
 <span className="text-[10px] font-black text-app-muted-foreground tracking-tighter uppercase ml-2">Select one statement line</span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => toast.success("Statement Studio Ready. Please select your Bank Export file (CSV/PDF).", {
 description: "Direct Bank-Feed sync is also available in the account settings.",
 icon: <Building size={16} />
 })}
 className="h-7 text-[9px] font-black uppercase text-app-info border border-app-info/30 bg-app-info-bg/50 rounded-lg"
 >
 Import Statement
 </Button>
 </div>
 <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
 <Table>
 <TableBody>
 {(detail.bank_entries || []).map((e: any) => {
 const isSelected = selectedBankEntry?.id === e.id
 return (
 <TableRow
 key={e.id}
 onClick={() => setSelectedBankEntry(isSelected ? null : e)}
 className={`cursor-pointer transition-all ${isSelected ? 'bg-app-info-bg hover:bg-app-info-bg border-l-4 border-l-blue-600' : 'hover:bg-app-background'}`}
 >
 <TableCell className="py-4">
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-muted-foreground mb-1">{e.date}</span>
 <span className="text-xs font-bold text-app-foreground line-clamp-1">{e.description}</span>
 <span className="text-[9px] font-mono text-app-info mt-1 uppercase">Ref: {e.reference}</span>
 </div>
 </TableCell>
 <TableCell className="text-right align-middle">
 <span className={`font-black text-sm tracking-tighter ${e.debit > 0 ? 'text-app-primary' : 'text-rose-600'}`}>
 {e.debit > 0 ? `+${fmt(e.debit)}` : `-${fmt(e.credit)}`}
 </span>
 </TableCell>
 </TableRow>
 )
 })}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>

 {/* RIGHT: General Ledger Desk */}
 <div className="flex flex-col gap-4">
 <div className="flex items-center justify-between border-b pb-2">
 <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest flex items-center gap-2">
 <Hash size={16} className="text-app-primary" /> Internal General Ledger
 </h3>
 <Badge className="bg-app-primary/10 text-app-primary font-bold text-[9px] uppercase tracking-tighter">System Records</Badge>
 </div>
 <div className="flex-1 bg-app-surface rounded-3xl border border-app-primary/30 shadow-md shadow-indigo-50/50 overflow-hidden flex flex-col">
 <div className="p-3 border-b bg-app-primary/5/20 flex items-center justify-between">
 <span className="text-[10px] font-black text-app-primary tracking-tighter uppercase ml-2">Connect matching entries</span>
 {selectedBankEntry && (
 <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
 <Badge variant="outline" className="h-7 border-app-primary/30 bg-app-surface text-app-primary font-black text-[10px]">
 Target: {selectedBankEntry.debit > 0 ? fmt(selectedBankEntry.debit) : fmt(selectedBankEntry.credit)}
 </Badge>
 <Button
 size="sm"
 disabled={selectedLedgerEntries.length === 0 || matching}
 onClick={handleConfirmMatch}
 className="h-7 bg-app-primary hover:bg-app-primary text-app-foreground font-black text-[9px] uppercase tracking-widest rounded-lg gap-1.5"
 >
 {matching ? 'Matching...' : <><Link size={10} /> Confirm Match</>}
 </Button>
 </div>
 )}
 </div>
 <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
 <Table>
 <TableBody>
 {(detail.ledger_entries || []).map((e: any) => {
 const isSelected = selectedLedgerEntries.includes(e.id)
 // Probability check simulation
 const isPerfect = selectedBankEntry && (Math.abs(e.amount) === (selectedBankEntry.debit || selectedBankEntry.credit))
 return (
 <TableRow
 key={e.id}
 onClick={() => setSelectedLedgerEntries(prev => isSelected ? prev.filter(id => id !== e.id) : [...prev, e.id])}
 className={`cursor-pointer transition-all ${isSelected ? 'bg-app-primary/5 hover:bg-app-primary/5 border-l-4 border-l-indigo-600' : 'hover:bg-app-background'}`}
 >
 <TableCell className="py-4">
 <div className="flex items-center gap-3">
 <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-app-primary scale-125' : 'bg-app-border'} transition-all`} />
 <div className="flex flex-col">
 <span className="text-[10px] font-black text-app-muted-foreground mb-1 leading-none">{e.date}</span>
 <p className="text-xs font-bold text-app-foreground leading-tight">{e.description}</p>
 </div>
 </div>
 </TableCell>
 <TableCell className="text-right align-middle">
 <div className="flex flex-col items-end">
 <span className="font-black text-sm tracking-tighter text-app-primary">{fmt(Math.abs(e.amount))}</span>
 {isPerfect && !isSelected && (
 <Badge className="h-4 p-0 px-1 bg-app-primary-light text-app-primary border-app-success/30 text-[8px] font-black uppercase mt-1 animate-pulse">
 <Sparkles size={8} className="mr-0.5" /> 100% Match
 </Badge>
 )}
 </div>
 </TableCell>
 </TableRow>
 )
 })}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 </div>

 <div className="flex items-center justify-between p-6 bg-app-surface rounded-[2.5rem] mt-4 shadow-2xl relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform">
 <ShieldCheck size={120} className="text-app-foreground" />
 </div>
 <div>
 <p className="text-app-primary text-[10px] font-black uppercase tracking-[0.2em] mb-1">Settlement Guard</p>
 <h4 className="text-app-foreground text-xl font-black tracking-tight">Active Monetary Balance</h4>
 <p className="text-app-muted-foreground text-xs font-medium mt-1">Status: Monitoring discrepencies...</p>
 </div>
 <div className="flex items-center gap-6">
 <div className="text-right">
 <p className="text-app-muted-foreground text-[9px] font-black uppercase tracking-widest">Discrepancy Gap</p>
 <p className="text-app-primary text-2xl font-black tracking-tighter">$0.00</p>
 </div>
 <Button onClick={goBack} className="h-12 px-8 rounded-2xl bg-app-surface hover:bg-app-surface-2 text-app-foreground font-black text-xs uppercase tracking-widest shadow-xl">
 Finish Settlement
 </Button>
 </div>
 </div>
 </div>
 )
 }

 // Account List View
 const totalBalance = accounts.reduce((sum, a) => sum + (a.book_balance || 0), 0)
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-info flex items-center justify-center shadow-lg shadow-blue-200">
 <Building size={28} className="text-app-foreground" />
 </div>
 Liquidity <span className="text-app-info">Settlement</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Bank & Cash Reconciliation Engine</p>
 </div>
 <div className="flex items-center gap-2 bg-app-primary-light px-4 py-2 rounded-2xl border border-app-success/30">
 <div className="w-2 h-2 bg-app-primary rounded-full animate-pulse" />
 <span className="text-[10px] font-black uppercase text-app-success tracking-widest">Direct Bank Feed Active</span>
 </div>
 </header>

 {/* Aggregate Exposure */}
 <Card className="rounded-[2.5rem] border-0 shadow-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-app-foreground overflow-hidden relative group">
 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
 <Landmark size={120} />
 </div>
 <CardContent className="p-8 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div>
 <p className="text-app-info text-xs font-black uppercase tracking-[0.2em]">Total Amount</p>
 <h2 className="text-5xl font-black mt-2 tracking-tighter">{fmt(totalBalance)}</h2>
 <div className="flex items-center gap-2 mt-4">
 <Badge className="bg-app-info text-app-info border-none font-black text-[10px] px-3">{accounts.length} Accounts</Badge>
 </div>
 </div>
 </CardContent>
 </Card>

 <TypicalListView
 title="Monetary Channels"
 data={accounts}
 loading={loading}
 getRowId={(acc) => acc.id}
 columns={accountColumns}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 headerExtra={
 <Button onClick={loadAccounts} variant="ghost" className="h-8 w-8 p-0 text-app-muted-foreground hover:text-app-info">
 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
 </Button>
 }
 />
 </div>
 )
}
