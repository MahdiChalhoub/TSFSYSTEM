// @ts-nocheck
'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Calculator, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createOpeningBalanceEntry } from '@/app/actions/finance/ledger'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
 accounts: Record<string, any>[]
}

// Simple Row for user input
type EntryRow = {
 id: number
 accountId: string
 balance: number | '' // Positive numbers only. Logic determines Dr/Cr
}

export default function OpeningBalanceForm({ accounts }: Props) {
 const router = useRouter()
 const [isPending, startTransition] = useTransition()

 // Sort accounts for easier selection (maybe alpha or by code)
 // Filter: Only Leaf accounts (No children allowed for posting)
 const sortedAccounts = useMemo(() => {
 return accounts
 .filter(acc => !acc.children || acc.children.length === 0)
 .sort((a, b) => a.code.localeCompare(b.code))
 }, [accounts])

 // Default leaf accounts only? Or allow all? Usually allow all valid posting accounts.
 // For safety, let's filter out known "Containers" if we had that flag, or check if they have children.
 // In current data model, accounts with children can have balances.

 const [date, setDate] = useState(new Date().toISOString().split('T')[0])

 // Simple Mode: Just Account + Amount. 
 // We infer Dr/Cr based on Account Type + Positive Sign.
 const [rows, setRows] = useState<EntryRow[]>([
 { id: 1, accountId: '', balance: '' },
 { id: 2, accountId: '', balance: '' },
 { id: 3, accountId: '', balance: '' },
 { id: 4, accountId: '', balance: '' },
 { id: 5, accountId: '', balance: '' },
 ])

 const addRow = () => setRows([...rows, { id: Date.now(), accountId: '', balance: '' }])

 const updateRow = (id: number, field: keyof EntryRow, val: Record<string, any>) => {
 setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r))
 }

 // Helper to calculate Preview
 const calculatePreview = () => {
 let totalDebit = 0
 let totalCredit = 0

 rows.forEach(r => {
 const acc = accounts.find(a => a.id.toString() === r.accountId)
 const amount = Number(r.balance) || 0
 if (!acc || amount === 0) return

 // Standard: Assets/Exp = Dr. Liab/Eq/Inc = Cr.
 // If user enters NEGATIVE, we flip.

 const isNormalDebit = ['ASSET', 'EXPENSE'].includes(acc.type)

 if (isNormalDebit) {
 if (amount >= 0) totalDebit += amount
 else totalCredit += Math.abs(amount)
 } else {
 // Liability/Equity/Income normally Credit
 if (amount >= 0) totalCredit += amount
 else totalDebit += Math.abs(amount)
 }
 })

 return { totalDebit, totalCredit, diff: totalDebit - totalCredit }
 }

 const { totalDebit, totalCredit, diff } = calculatePreview()

 const [showBalanceWarning, setShowBalanceWarning] = useState(false)

 const doSubmit = () => {
 const linesToPost: Record<string, any>[] = []

 rows.forEach(r => {
 const acc = accounts.find(a => a.id.toString() === r.accountId)
 const amount = Number(r.balance) || 0
 if (!acc || amount === 0) return

 const isNormalDebit = ['ASSET', 'EXPENSE'].includes(acc.type)

 let debit = 0
 let credit = 0

 if (isNormalDebit) {
 if (amount >= 0) debit = amount
 else credit = Math.abs(amount)
 } else {
 if (amount >= 0) credit = amount
 else debit = Math.abs(amount)
 }

 linesToPost.push({
 accountId: parseInt(r.accountId),
 debit,
 credit
 })
 })

 if (linesToPost.length === 0) {
 toast.error('Please enter at least one balance.')
 return
 }

 startTransition(async () => {
 try {
 await createOpeningBalanceEntry({
 transactionDate: new Date(date),
 lines: linesToPost,
 description: "Initial Opening Balance Import",
 autoBalance: true
 })
 toast.success('Opening balances updated.')
 router.push('/finance/chart-of-accounts')
 } catch (e: unknown) {
 toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
 }
 })
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()

 if (Math.abs(diff) > 0.01) {
 setShowBalanceWarning(true)
 return
 }

 doSubmit()
 }

 const removeRow = (id: number) => setRows(rows.filter(r => r.id !== id))

 return (
 <div className="bg-app-surface rounded-lg shadow-sm border border-app-border">
 <div className="p-6 border-b border-app-border bg-app-background flex justify-between items-start">
 <div>
 <h2 className="text-lg font-bold text-app-foreground">Simple Opening Balance Setup</h2>
 <p className="text-sm text-app-muted-foreground mt-1">
 Enter the balance for each account as of your start date. <br />
 Positive numbers indicate normal balance (e.g. Asset = +Debit, Liability = +Credit).
 </p>
 </div>
 <div>
 <label className="block text-xs font-bold uppercase text-app-muted-foreground mb-1">Opening Date</label>
 <input
 type="date"
 value={date}
 onChange={e => setDate(e.target.value)}
 className="border border-app-border rounded px-2 py-1 text-sm font-medium focus:ring-black focus:border-black"
 />
 </div>
 </div>

 <div className="p-6">
 {/* Input Table */}
 <div className="border rounded-lg overflow-hidden border-app-border mb-6">
 <table className="w-full text-sm">
 <thead className="bg-app-surface-2 text-app-muted-foreground font-bold uppercase text-xs">
 <tr>
 <th className="px-4 py-3 text-left w-1/2">Account</th>
 <th className="px-4 py-3 text-left w-1/4">Type</th>
 <th className="px-4 py-3 text-right w-1/4">Balance Amount</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {rows.map((row, idx) => {
 const selectedAcc = sortedAccounts.find(a => a.id.toString() === row.accountId)
 // Extract search string from the row if we had it, or just use account name
 const searchString = selectedAcc ? `${selectedAcc.code} - ${selectedAcc.name}` : ''

 return (
 <tr key={row.id} className="hover:bg-app-background transition-colors group">
 <td className="px-4 py-2 border-r border-stone-50">
 <div className="relative">
 <input
 list={`accounts-list-${row.id}`}
 value={searchString}
 onChange={e => {
 const val = e.target.value
 const found = sortedAccounts.find(a => `${a.code} - ${a.name}` === val)
 if (found) updateRow(row.id, 'accountId', found.id.toString())
 }}
 placeholder="Type code or name..."
 className="w-full p-2 text-sm border-none focus:ring-0 bg-transparent placeholder:text-app-muted-foreground font-medium"
 />
 <datalist id={`accounts-list-${row.id}`}>
 {sortedAccounts.map(acc => (
 <option key={acc.id} value={`${acc.code} - ${acc.name}`}>
 {acc.type}
 </option>
 ))}
 </datalist>
 </div>
 </td>
 <td className="px-4 py-2 text-app-muted-foreground font-bold text-[10px] uppercase border-r border-stone-50">
 {selectedAcc ? (
 <span className={`px-2 py-0.5 rounded-full border ${selectedAcc.type === 'ASSET' ? 'bg-app-primary-light text-app-success border-app-success/30' : 'bg-app-surface-2 text-app-muted-foreground border-app-border'}`}>
 {selectedAcc.type}
 </span>
 ) : '-'}
 </td>
 <td className="px-4 py-2">
 <input
 type="number" step="0.01"
 placeholder="0.00"
 value={row.balance}
 onChange={e => updateRow(row.id, 'balance', e.target.value)}
 className="w-full text-right p-2 border-none focus:ring-0 bg-transparent font-mono font-bold text-app-muted-foreground"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault()
 if (idx === rows.length - 1) addRow()
 }
 }}
 />
 </td>
 <td className="px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => removeRow(row.id)} className="text-app-muted-foreground hover:text-app-error">
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 <button onClick={addRow} className="w-full py-2 bg-app-background text-app-muted-foreground text-sm font-medium hover:bg-app-surface-2 border-t border-app-border">
 + Add Line
 </button>
 </div>

 {/* Preview / Summary */}
 <div className="grid grid-cols-2 gap-8 items-start">
 <div className="p-4 bg-app-info-bg rounded-lg text-sm text-app-info">
 <h4 className="font-bold mb-2 flex items-center gap-2">
 <AlertTriangle size={16} /> Auto-Balancing
 </h4>
 <p>
 Double-entry accounting requires Debits = Credits.
 If your inputs don't match, we will automatically create an entry in
 <strong> "Opening Balance Equity"</strong> to make up the difference.
 </p>
 </div>

 <div className="bg-app-surface text-app-foreground p-6 rounded-lg shadow-lg">
 <div className="flex justify-between mb-2 opacity-80 text-sm">
 <span>Total Assets/Exp (Dr)</span>
 <span className="font-mono">{totalDebit.toFixed(2)}</span>
 </div>
 <div className="flex justify-between mb-4 opacity-80 text-sm">
 <span>Total Liab/Eq/Inc (Cr)</span>
 <span className="font-mono">{totalCredit.toFixed(2)}</span>
 </div>
 <div className="border-t border-app-border pt-4 flex justify-between items-center font-bold text-lg">
 <span>Auto-Adjustment</span>
 <span className={`font-mono ${Math.abs(diff) === 0 ? 'text-app-primary' : 'text-app-warning'}`}>
 {Math.abs(diff) === 0 ? 'Balanced' : `${Math.abs(diff).toFixed(2)} (Equity)`}
 </span>
 </div>
 </div>
 </div>

 <div className="mt-8 flex justify-end">
 <button
 onClick={handleSubmit}
 disabled={isPending}
 className="bg-app-background text-app-foreground px-8 py-3 rounded-lg font-bold text-sm hover:bg-app-surface-2 disabled:opacity-50 flex items-center gap-2"
 >
 <Save size={18} />
 {isPending ? 'Processing...' : 'Save Opening Balances'}
 </button>
 </div>
 </div>

 <ConfirmDialog
 open={showBalanceWarning}
 onOpenChange={setShowBalanceWarning}
 onConfirm={() => { setShowBalanceWarning(false); doSubmit() }}
 title="Unbalanced Opening Balances"
 description={`Your opening balances are not equal (Difference: ${diff.toFixed(2)}). The system will automatically post the difference to "Opening Balance Equity" to ensure the ledger balances.`}
 confirmText="Proceed Anyway"
 variant="warning"
 />
 </div>
 )
}