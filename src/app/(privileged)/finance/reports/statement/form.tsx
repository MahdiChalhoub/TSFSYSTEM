'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Calendar, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
 accounts: Record<string, any>[]
 fiscalYears: Record<string, any>[]
}

export default function StatementGenerator({ accounts, fiscalYears }: Props) {
 const router = useRouter()

 // Default to first account? Or null.
 const [selectedAccountId, setSelectedAccountId] = useState(accounts.length > 0 ? accounts[0].id : '')

 const [dateMode, setDateMode] = useState<'FISCAL' | 'CUSTOM'>('FISCAL')

 // Default to latest open year
 const defaultYear = fiscalYears.find(y => y.status === 'OPEN') || fiscalYears[0]
 const [selectedYearId, setSelectedYearId] = useState(defaultYear?.id || '')

 // Custom Dates
 const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0])
 const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0])

 const handleGenerate = (e: React.FormEvent) => {
 e.preventDefault()

 if (!selectedAccountId) {
 toast.error("Please select an account")
 return
 }

 let start, end

 if (dateMode === 'FISCAL') {
 const year = fiscalYears.find(y => y.id == selectedYearId)
 if (!year) return
 start = year.start_date ? new Date(year.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
 end = year.end_date ? new Date(year.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
 } else {
 start = customStart
 end = customEnd
 }

 // Navigate to the statement view
 router.push(`/finance/chart-of-accounts/${selectedAccountId}?start=${start}&end=${end}`)
 }

 return (
 <div className="max-w-xl mx-auto bg-app-surface rounded-lg shadow-sm border border-app-border overflow-hidden">
 <div className="p-6 border-b border-app-border bg-app-bg">
 <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
 <FileText className="text-app-text-faint" size={20} />
 Account Statement
 </h2>
 <p className="text-sm text-app-text-muted mt-1">Select an account and period to generate a detailed ledger.</p>
 </div>

 <form onSubmit={handleGenerate} className="p-6 space-y-6">

 {/* 1. Account Selection */}
 <div>
 <label className="block text-sm font-bold text-stone-700 mb-2">Select Account</label>
 <select
 value={selectedAccountId}
 onChange={e => setSelectedAccountId(e.target.value)}
 className="w-full p-2.5 border border-app-border rounded-md focus:ring-2 focus:ring-black focus:border-black outline-none bg-app-surface"
 size={10} // Show list
 >
 {accounts.map(acc => (
 <option key={acc.id} value={acc.id} className="py-1">
 {acc.code} - {acc.name} ({Number(acc.balance).toFixed(2)})
 </option>
 ))}
 </select>
 </div>

 {/* 2. Period Selection */}
 <div className="bg-app-bg p-4 rounded-lg border border-app-border">
 <label className="block text-sm font-bold text-stone-700 mb-2">Time Period</label>

 <div className="flex gap-4 mb-4 text-sm">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="mode"
 checked={dateMode === 'FISCAL'}
 onChange={() => setDateMode('FISCAL')}
 className="text-black focus:ring-black"
 />
 Fiscal Year
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="mode"
 checked={dateMode === 'CUSTOM'}
 onChange={() => setDateMode('CUSTOM')}
 className="text-black focus:ring-black"
 />
 Custom Date Range
 </label>
 </div>

 {dateMode === 'FISCAL' ? (
 <select
 value={selectedYearId}
 onChange={e => setSelectedYearId(e.target.value)}
 className="w-full p-2 border border-app-border rounded"
 >
 {fiscalYears.map(y => (
 <option key={y.id} value={y.id}>
 {y.name} ({y.start_date ? new Date(y.start_date).toLocaleDateString() : '—'} - {y.end_date ? new Date(y.end_date).toLocaleDateString() : '—'})
 </option>
 ))}
 </select>
 ) : (
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-xs uppercase text-app-text-muted font-bold mb-1">Start Date</label>
 <input
 type="date"
 value={customStart}
 onChange={e => setCustomStart(e.target.value)}
 className="w-full p-2 border border-app-border rounded"
 />
 </div>
 <div>
 <label className="block text-xs uppercase text-app-text-muted font-bold mb-1">End Date</label>
 <input
 type="date"
 value={customEnd}
 onChange={e => setCustomEnd(e.target.value)}
 className="w-full p-2 border border-app-border rounded"
 />
 </div>
 </div>
 )}
 </div>

 <button
 type="submit"
 className="w-full bg-black text-app-text font-bold py-3 rounded-md hover:bg-stone-800 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
 >
 <Search size={18} />
 Generate Statement
 </button>
 </form>
 </div>
 )
}