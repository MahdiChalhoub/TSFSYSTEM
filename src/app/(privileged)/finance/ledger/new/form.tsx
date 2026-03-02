'use client'

import { useState, useTransition, useMemo } from 'react'
import { createJournalEntry, updateJournalEntry } from '@/app/actions/finance/ledger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, FileText, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

// Helper to find the correct Fiscal Year/Period for a date
function findFiscalContext(date: string, years: Record<string, any>[]) {
 if (!date) return { yearId: null, periodId: null }
 const d = new Date(date)
 if (isNaN(d.getTime())) return { yearId: null, periodId: null }
 const year = years.find((y: Record<string, any>) => {
 const s = y.startDate || y.start_date
 const e = y.endDate || y.end_date
 return s && e && new Date(s) <= d && new Date(e) >= d
 })
 if (!year) return { yearId: null, periodId: null }

 const period = (year.periods || []).find((p: Record<string, any>) => {
 const s = p.startDate || p.start_date
 const e = p.endDate || p.end_date
 return s && e && new Date(s) <= d && new Date(e) >= d
 })
 return { yearId: year.id, periodId: period?.id }
}

export default function JournalEntryForm({ accounts, fiscalYears, initialEntry }: { accounts: Record<string, any>[], fiscalYears: Record<string, any>[], initialEntry?: Record<string, any> }) {
 const router = useRouter()
 const [isPending, startTransition] = useTransition()

 // ... rest of state ...

 const [header, setHeader] = useState({
 transactionDate: initialEntry ? new Date(initialEntry.transactionDate || initialEntry.transaction_date || new Date()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
 description: initialEntry?.description || '',
 reference: initialEntry?.reference || ''
 })

 const [lines, setLines] = useState(initialEntry?.lines?.map((l: Record<string, any>) => {
 const accId = (l.accountId || l.account_id || l.account || '').toString()
 const acc = accounts.find((a: any) => a.id.toString() === accId)
 return {
 accountId: accId,
 searchString: acc ? `${acc.code} ${acc.name}`.trim() : `${l.account?.code || ''} ${l.account?.name || ''}`.trim(),
 debit: (l.debit !== undefined && l.debit !== null && l.debit !== '') ? Number(l.debit) : '',
 credit: (l.credit !== undefined && l.credit !== null && l.credit !== '') ? Number(l.credit) : '',
 description: l.description || ''
 }
 }) || [
 { accountId: '', searchString: '', debit: '', credit: '', description: '' },
 { accountId: '', searchString: '', debit: '', credit: '', description: '' }
 ])

 // Filter to only Leaf accounts (No children) OR Dirty Parents (for cleanup)
 // We now include Inactive accounts but with a warning, to allow fixing migration errors.
 const selectableAccounts = useMemo(() => {
 return accounts.sort((a, b) => a.code.localeCompare(b.code))
 }, [accounts])

 const addLine = () => {
 setLines([...lines, { accountId: '', searchString: '', debit: '', credit: '', description: '' }])
 }

 const removeLine = (index: number) => {
 if (lines.length <= 2) return toast.error('A journal entry requires at least 2 lines')
 setLines(lines.filter((_: any, i: number) => i !== index))
 }

 const updateLine = (index: number, field: string, value: string) => {
 const newLines = [...lines]
 newLines[index] = { ...newLines[index], [field]: value }

 // Enforce single-sided entry per line
 if (field === 'debit' && value !== '') newLines[index].credit = ''
 if (field === 'credit' && value !== '') newLines[index].debit = ''

 // Handle Quick Split:
 if (field === 'debit' && value.includes('/')) {
 const parts = value.split('/')
 if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
 const total = Number(parts[0])
 const divisor = Number(parts[1])
 const splitValue = (total / divisor).toFixed(2)

 newLines[index].debit = splitValue
 const addedLines = []
 for (let i = 1; i < divisor; i++) {
 addedLines.push({ accountId: '', searchString: '', debit: splitValue, credit: '', description: newLines[index].description || '' })
 }
 setLines([...newLines.slice(0, index + 1), ...addedLines, ...newLines.slice(index + 1)])
 return
 }
 }
 if (field === 'credit' && value.includes('/')) {
 const parts = value.split('/')
 if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
 const total = Number(parts[0])
 const divisor = Number(parts[1])
 const splitValue = (total / divisor).toFixed(2)

 newLines[index].credit = splitValue
 const addedLines = []
 for (let i = 1; i < divisor; i++) {
 addedLines.push({ accountId: '', searchString: '', debit: '', credit: splitValue, description: newLines[index].description || '' })
 }
 setLines([...newLines.slice(0, index + 1), ...addedLines, ...newLines.slice(index + 1)])
 return
 }
 }

 if (field === 'searchString') {
 const val = value.toLowerCase()
 // Match exactly by code or try to find a match in the list
 const acc = selectableAccounts.find(a =>
 a.code === value.split(' ')[0] ||
 `${a.code} ${a.name}`.toLowerCase() === val
 )

 if (acc) {
 // @ts-ignore
 newLines[index].accountId = acc.id.toString()
 // Auto-fix the search string to the standard format
 // @ts-ignore
 newLines[index].searchString = `${acc.code} ${acc.name}`
 } else {
 // @ts-ignore
 newLines[index].accountId = ''
 }
 }

 setLines(newLines)
 }

 const totalDebit = lines.reduce((sum: number, line: any) => sum + (Number(line.debit) || 0), 0)
 const totalCredit = lines.reduce((sum: number, line: any) => sum + (Number(line.credit) || 0), 0)
 const diff = totalDebit - totalCredit
 const isBalanced = Math.abs(diff) < 0.01

 const fiscalContext = useMemo(() => findFiscalContext(header.transactionDate, fiscalYears), [header.transactionDate, fiscalYears])

 const handleAutoBalance = (idx: number) => {
 const targetDiff = totalCredit - totalDebit // If positive, we need more debits. If negative, we need more credits.
 const newLines = [...lines]
 if (targetDiff > 0) {
 newLines[idx].debit = targetDiff.toFixed(2)
 newLines[idx].credit = ''
 } else if (targetDiff < 0) {
 newLines[idx].credit = Math.abs(targetDiff).toFixed(2)
 newLines[idx].debit = ''
 }
 setLines(newLines)
 }

 const handleKeyDown = (e: React.KeyboardEvent, idx: number, field: string) => {
 if (e.key === 'Enter') {
 e.preventDefault()
 if (idx === lines.length - 1) {
 addLine()
 }
 }
 }

 const handleAction = async (status: 'DRAFT' | 'POSTED') => {
 if (status === 'POSTED' && !isBalanced) {
 toast.error('Cannot post an unbalanced entry.')
 return
 }

 const { yearId, periodId } = findFiscalContext(header.transactionDate, fiscalYears)
 if (!yearId) {
 toast.error('No active Fiscal Year found for this date.')
 return
 }

 // Anomaly Guard: Scan for abnormal VAT values
 let vatAmount = 0
 let revenueAmount = 0
 for (const line of lines) {
 const acc = accounts.find((a: any) => a.id.toString() === line.accountId)
 if (acc) {
 const name = (acc.name || '').toLowerCase()
 if (name.includes('vat') || name.includes('tax')) {
 vatAmount += (Number(line.credit) || 0) + (Number(line.debit) || 0)
 }
 if (name.includes('revenue') || name.includes('sale') || name.includes('income')) {
 revenueAmount += (Number(line.credit) || 0) + (Number(line.debit) || 0)
 }
 }
 }

 if (vatAmount > 0 && revenueAmount > 0 && vatAmount > (revenueAmount * 0.5)) {
 if (!confirm(`🚨 ANOMALY GUARD: The VAT/Tax amount ($${vatAmount.toFixed(2)}) is unusually high relative to the revenue ($${revenueAmount.toFixed(2)}). This is mathematically improbable. Are you sure you want to proceed?`)) {
 return
 }
 }

 startTransition(async () => {
 try {
 const payload = {
 transaction_date: header.transactionDate,
 description: header.description,
 reference: header.reference,
 fiscal_year_id: yearId,
 fiscal_period_id: periodId,
 status,
 lines: lines.map((l: Record<string, any>) => ({
 account_id: Number(l.accountId),
 debit: Number(l.debit) || 0,
 credit: Number(l.credit) || 0,
 description: l.description || header.description
 }))
 }

 if (initialEntry) {
 await updateJournalEntry(initialEntry.id, payload)
 } else {
 await createJournalEntry(payload)
 }

 router.push('/finance/ledger')
 router.refresh()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)))
 }
 })
 }

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault()
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="bg-app-surface p-6 rounded-lg shadow-sm border border-app-border">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">Transaction Date</label>
 <input
 type="date"
 required
 value={header.transactionDate}
 onChange={e => setHeader({ ...header, transactionDate: e.target.value })}
 className="w-full border border-app-border rounded p-2 text-sm"
 />
 </div>
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">Description</label>
 <input
 required
 value={header.description}
 onChange={e => setHeader({ ...header, description: e.target.value })}
 className="w-full border border-app-border rounded p-2 text-sm"
 placeholder="e.g. Monthly Rent Payment"
 />
 </div>
 <div>
 <label className="block text-xs font-bold uppercase text-app-text-muted mb-1">Reference</label>
 <input
 value={header.reference}
 onChange={e => setHeader({ ...header, reference: e.target.value })}
 className="w-full border border-app-border rounded p-2 text-sm"
 placeholder="e.g. INV-001"
 />
 </div>
 <div className="bg-app-bg p-2 rounded border border-dashed border-app-border">
 <div className="text-[10px] font-bold text-app-text-faint uppercase">Fiscal Context</div>
 <div className="text-xs font-medium text-stone-700 truncate">
 {fiscalContext.yearId ? (
 <span className="flex items-center gap-1 text-green-700">
 <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
 {fiscalYears.find(y => y.id === fiscalContext.yearId)?.name}
 {fiscalContext.periodId && ` - Period ${fiscalYears.find(y => y.id === fiscalContext.yearId)?.periods.find((p: Record<string, any>) => p.id === fiscalContext.periodId)?.number}`}
 </span>
 ) : (
 <span className="text-red-500">INVALID DATE: Out of Fiscal Scope</span>
 )}
 </div>
 </div>
 </div>
 </div>

 <div className="bg-app-surface p-6 rounded-lg shadow-sm border border-app-border">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-app-bg border-b border-app-border text-left">
 <th className="p-2 font-bold text-app-text-muted">Account</th>
 <th className="p-2 font-bold text-app-text-muted w-32 text-right">Debit</th>
 <th className="p-2 font-bold text-app-text-muted w-32 text-right">Credit</th>
 <th className="p-2 font-bold text-app-text-muted">Line Description</th>
 <th className="p-2 w-10"></th>
 </tr>
 </thead>
 <tbody>
 {lines.map((line, idx) => (
 <tr key={idx} className="border-b border-app-border last:border-0 hover:bg-stone-50/50">
 <td className="p-2 relative">
 <div className="flex items-center gap-2">
 <input
 list="accounts-list"
 placeholder="Type code or name..."
 value={line.searchString}
 onChange={e => updateLine(idx, 'searchString', e.target.value)}
 className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-black outline-none font-medium transition-all ${line.accountId ? 'border-emerald-200 bg-emerald-50/10 text-app-text' : 'border-app-border text-stone-700'
 }`}
 />
 {line.accountId && (
 <div className="flex items-center gap-1 shrink-0">
 {!selectableAccounts.find(a => a.id.toString() === line.accountId)?.isActive && (
 <span className="text-[8px] bg-app-surface-2 text-app-text-faint px-1 rounded border border-app-border font-bold">INACTIVE</span>
 )}
 <CheckCircle2 size={12} className="text-emerald-500" />
 </div>
 )}
 </div>
 <datalist id="accounts-list">
 {selectableAccounts.map(acc => (
 <option key={acc.id} value={`${acc.code} ${acc.name}`}>
 {acc.type} {acc.isActive ? '' : '(INACTIVE)'}
 </option>
 ))}
 </datalist>
 {!line.accountId && line.searchString && (
 <div className="absolute left-2 top-full z-10 text-[9px] text-red-500 font-bold bg-app-surface px-1 shadow-sm">
 Account not found. Select from list.
 </div>
 )}
 </td>
 <td className="p-2">
 <input
 type="number"
 step="0.01"
 min="0"
 value={line.debit}
 onKeyDown={e => handleKeyDown(e, idx, 'debit')}
 onChange={e => updateLine(idx, 'debit', e.target.value)}
 className="w-full p-1.5 border border-app-border rounded text-right font-mono focus:ring-1 focus:ring-black outline-none"
 />
 </td>
 <td className="p-2">
 <input
 type="number"
 step="0.01"
 min="0"
 value={line.credit}
 onKeyDown={e => handleKeyDown(e, idx, 'credit')}
 onChange={e => updateLine(idx, 'credit', e.target.value)}
 className="w-full p-1.5 border border-app-border rounded text-right font-mono focus:ring-1 focus:ring-black outline-none"
 />
 </td>
 <td className="p-2">
 <div className="flex gap-2 items-center">
 <input
 value={line.description}
 onChange={e => updateLine(idx, 'description', e.target.value)}
 onKeyDown={e => handleKeyDown(e, idx, 'description')}
 className="w-full p-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-black outline-none"
 placeholder={header.description}
 />
 <button
 type="button"
 onClick={() => handleAutoBalance(idx)}
 title="Plug Balance"
 className="text-stone-300 hover:text-app-text-muted transition-colors"
 >
 <Send size={14} />
 </button>
 </div>
 </td>
 <td className="p-2 text-center">
 <button
 type="button"
 onClick={() => removeLine(idx)}
 className="text-stone-300 hover:text-red-500 transition-colors"
 >
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr className="font-bold text-app-text bg-app-bg">
 <td className="p-3 text-right text-app-text-muted uppercase text-[10px] tracking-wider">Totals</td>
 <td className="p-3 text-right font-mono border-t-2 border-stone-800">
 {totalDebit > 0 ? totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
 </td>
 <td className="p-3 text-right font-mono border-t-2 border-stone-800">
 {totalCredit > 0 ? totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
 </td>
 <td colSpan={2} className="p-3 align-middle">
 {isBalanced ? (
 <div className="flex items-center gap-2 text-green-600 text-[10px] font-bold uppercase tracking-widest animate-pulse">
 <div className="w-2 h-2 rounded-full bg-green-500"></div>
 Perfectly Balanced
 </div>
 ) : (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest">
 <div className="w-2 h-2 rounded-full bg-red-500"></div>
 Difference: {Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
 </div>
 <button
 type="button"
 onClick={() => addLine()}
 className="text-[10px] text-app-text-faint hover:text-app-text underline uppercase font-bold"
 >
 Add Offset Line
 </button>
 </div>
 )}
 </td>
 </tr>
 </tfoot>
 </table>

 <div className="mt-4">
 <button
 type="button"
 onClick={addLine}
 className="flex items-center gap-2 text-app-text-muted hover:text-app-text text-sm font-medium"
 >
 <Plus size={16} /> Add Line
 </button>
 </div>
 </div>

 <div className="flex justify-between items-center bg-app-surface p-4 rounded-xl shadow-sm border border-app-border">
 <button
 type="button"
 onClick={() => router.back()}
 className="px-6 py-2.5 text-app-text-muted font-bold text-sm hover:bg-app-bg rounded-lg transition-colors"
 >
 Cancel
 </button>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => handleAction('DRAFT')}
 disabled={isPending}
 className="flex items-center gap-2 bg-app-surface-2 text-stone-700 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-200 disabled:opacity-50 transition-all border border-app-border"
 >
 <FileText size={18} />
 {isPending ? '...' : 'Save as Draft'}
 </button>
 <button
 type="button"
 onClick={() => handleAction('POSTED')}
 disabled={isPending || !isBalanced}
 className="flex items-center gap-2 bg-black text-app-text px-8 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
 >
 {isPending ? (
 <>Processing...</>
 ) : (
 <>
 <Send size={18} />
 Post Entry
 </>
 )}
 </button>
 </div>
 </div>
 </form>
 )
}