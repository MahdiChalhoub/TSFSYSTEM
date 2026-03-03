// @ts-nocheck
'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { getTrialBalanceReport } from '@/app/actions/finance/accounts'
import { FileText, Printer, Calendar, AlertCircle, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react'

export default function TrialBalanceViewer({ initialAccounts, fiscalYears }: { initialAccounts: Record<string, any>[], fiscalYears: Record<string, any>[] }) {
 const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
 const [accounts, setAccounts] = useState(initialAccounts)
 const [isPending, startTransition] = useTransition()
 const [mounted, setMounted] = useState(false)

 useEffect(() => {
 setMounted(true)
 }, [])

 const handleRefresh = () => {
 const dateObj = new Date(asOfDate)
 if (isNaN(dateObj.getTime())) {
 return
 }
 startTransition(async () => {
 const data = await getTrialBalanceReport(dateObj)
 setAccounts(data)
 })
 }

 const grouped = useMemo(() => {
 const types = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
 return types.map(type => ({
 type,
 items: accounts.filter(a => a.type === type && !a.parentId).sort((a, b) => a.code.localeCompare(b.code))
 }))
 }, [accounts])

 // Strict Summary Calculation (Only Leaf Nodes for true TB, but rollup works too if we only use roots)
 // Actually, Trial Balance usually shows EVERY account with a balance.
 // Professional TB: Sum of all accounts MUST be 0.
 const totals = useMemo(() => {
 let debit = 0
 let credit = 0

 // We only sum ROOT nodes to avoid double counting, as they contain rollups
 // OR we sum only LEAF nodes. Let's sum ROOT nodes for easier grouping logic.
 accounts.filter(a => !a.parentId).forEach(acc => {
 if (acc.balance > 0) debit += acc.balance
 else credit += Math.abs(acc.balance)
 })

 return { debit, credit, diff: Math.abs(debit - credit) }
 }, [accounts])

 const formatAmount = (val: number | null) => {
 if (val === null) return '-'
 if (!mounted) return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
 return val.toLocaleString(undefined, { minimumFractionDigits: 2 })
 }

 const isBalanced = totals.diff < 0.01

 return (
 <div className="space-y-8 print:space-y-4">
 {/* Controls */}
 <div className="bg-app-surface p-6 rounded-2xl shadow-sm border border-app-border flex flex-wrap items-end justify-between gap-4 print:hidden">
 <div className="flex gap-4 items-end">
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold uppercase text-app-muted-foreground flex items-center gap-1">
 <Calendar size={12} /> Balance As Of Date
 </label>
 <input
 type="date"
 value={asOfDate}
 onChange={e => setAsOfDate(e.target.value)}
 className="border border-app-border rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-stone-900 outline-none transition-all"
 />
 </div>
 <button
 onClick={handleRefresh}
 disabled={isPending}
 className="bg-app-surface text-app-foreground px-6 py-2.5 rounded-lg hover:bg-app-background font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
 >
 {isPending ? 'Updating...' : 'Generate Report'}
 </button>
 </div>

 <div className="flex gap-2">
 <button
 onClick={() => window.print()}
 className="bg-app-surface text-app-muted-foreground border border-app-border px-4 py-2.5 rounded-lg hover:bg-app-background font-bold text-sm shadow-sm flex items-center gap-2"
 >
 <Printer size={18} /> Print PDF
 </button>
 </div>
 </div>

 {/* Status Banner */}
 {!isPending && (
 <div className={`p-4 rounded-xl border flex items-center justify-between ${isBalanced ? 'bg-app-primary-light border-app-success/30 text-app-success' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
 <div className="flex items-center gap-3">
 {isBalanced ? <CheckCircle2 className="text-app-primary" /> : <AlertCircle className="text-rose-500" />}
 <div>
 <p className="font-bold text-sm">
 {isBalanced ? 'Trial Balance Verified' : 'System Out of Balance'}
 </p>
 <p className="text-xs opacity-80">
 {isBalanced ? 'All accounts net to zero. Integrity check passed.' : `Warning: Total Debits do not match Total Credits. Difference: ${totals.diff.toFixed(2)}`}
 </p>
 </div>
 </div>
 <div className="text-right">
 <div className="text-[10px] font-bold uppercase opacity-60">Status</div>
 <div className="font-mono font-bold">{isBalanced ? 'HEALTHY' : 'CRITICAL'}</div>
 </div>
 </div>
 )}

 {/* Trial Balance Table */}
 <div className="bg-app-surface rounded-2xl shadow-sm border border-app-border overflow-hidden print:border-none print:shadow-none">
 <table className="w-full text-sm border-collapse">
 <thead>
 <tr className="bg-app-surface text-app-foreground uppercase text-[10px] tracking-[0.2em] font-bold">
 <th className="p-4 text-left w-24">Code</th>
 <th className="p-4 text-left">Description</th>
 <th className="p-4 text-right w-36">Debit</th>
 <th className="p-4 text-right w-36">Credit</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {grouped.map(group => (
 <GroupRows key={group.type} group={group} allAccounts={accounts} level={0} formatAmount={formatAmount} />
 ))}
 </tbody>
 <tfoot>
 <tr className="bg-app-background font-bold border-t-2 border-app-border">
 <td colSpan={2} className="p-4 text-right uppercase tracking-widest text-xs text-app-muted-foreground">Statement Totals</td>
 <td className="p-4 text-right font-mono text-lg border-double border-b-4 border-app-border">
 {formatAmount(totals.debit)}
 </td>
 <td className="p-4 text-right font-mono text-lg border-double border-b-4 border-app-border text-app-muted-foreground">
 {formatAmount(totals.credit)}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>

 <div className="text-[10px] text-app-muted-foreground text-center font-medium uppercase tracking-widest py-8">
 Generated by TSF-ERP Financial Engine • {mounted ? new Date().toLocaleString() : ''}
 </div>
 </div>
 )
}

function GroupRows({ group, allAccounts, formatAmount, level = 0 }: { group: Record<string, any>, allAccounts: Record<string, any>[], formatAmount: Record<string, any>, level: number }) {
 if (group.items.length === 0) return null

 return (
 <>
 <tr className="bg-app-surface/50">
 <td colSpan={4} className="p-3 text-[11px] font-black text-app-muted-foreground uppercase tracking-widest border-l-4 border-app-border">
 {group.type}s
 </td>
 </tr>
 {group.items.map((acc: Record<string, any>) => (
 <AccountRow key={acc.id} account={acc} level={level} allAccounts={allAccounts} formatAmount={formatAmount} />
 ))}
 </>
 )
}

function AccountRow({ account, level, allAccounts, formatAmount }: { account: Record<string, any>, level: number, allAccounts: Record<string, any>[], formatAmount: Record<string, any> }) {
 const [expanded, setExpanded] = useState(level < 1) // Expand roots by default
 const isParent = account.children && account.children.length > 0
 const hasBalance = Math.abs(account.balance) > 0.001

 if (!hasBalance && !isParent) return null

 return (
 <>
 <tr className={`hover:bg-app-surface/50 transition-colors group ${isParent ? 'font-bold' : ''}`}>
 <td className="p-3 font-mono text-app-muted-foreground text-xs pl-4">
 {account.code}
 </td>
 <td className="p-3" style={{ paddingLeft: `${level * 24 + 12}px` }}>
 <div className="flex items-center gap-2">
 {isParent && (
 <button onClick={() => setExpanded(!expanded)} className="text-app-muted-foreground hover:text-app-foreground">
 {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
 </button>
 )}
 <span className={isParent ? 'text-app-foreground' : 'text-app-muted-foreground'}>{account.name}</span>
 </div>
 </td>
 <td className="p-3 text-right font-mono font-medium">
 {account.balance > 0 ? formatAmount(account.balance) : '-'}
 </td>
 <td className="p-3 text-right font-mono font-medium text-app-muted-foreground">
 {account.balance < 0 ? formatAmount(Math.abs(account.balance)) : '-'}
 </td>
 </tr>
 {isParent && expanded && account.children.map((childId: Record<string, any>) => {
 const child = typeof childId === 'object' ? childId : allAccounts.find(a => a.id === childId)
 if (!child) return null
 return <AccountRow key={child.id} account={child} level={level + 1} allAccounts={allAccounts} formatAmount={formatAmount} />
 })}
 </>
 )
}