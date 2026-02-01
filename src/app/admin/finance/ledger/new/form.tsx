'use client'

import { useState, useTransition, useMemo } from 'react'
import { createJournalEntry, updateJournalEntry } from '@/app/actions/finance/ledger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, FileText, Send, CheckCircle2 } from 'lucide-react'

// Helper to find the correct Fiscal Year/Period for a date
function findFiscalContext(date: string, years: any[]) {
    const d = new Date(date)
    const year = years.find((y: any) => new Date(y.startDate) <= d && new Date(y.endDate) >= d)
    if (!year) return { yearId: null, periodId: null }

    const period = year.periods.find((p: any) => new Date(p.startDate) <= d && new Date(p.endDate) >= d)
    return { yearId: year.id, periodId: period?.id }
}

export default function JournalEntryForm({ accounts, fiscalYears, initialEntry }: { accounts: any[], fiscalYears: any[], initialEntry?: any }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // ... rest of state ...

    const [header, setHeader] = useState({
        transactionDate: initialEntry ? new Date(initialEntry.transactionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: initialEntry?.description || '',
        reference: initialEntry?.reference || ''
    })

    const [lines, setLines] = useState(initialEntry?.lines.map((l: any) => ({
        accountId: l.accountId.toString(),
        searchString: `${l.account?.code || ''} ${l.account?.name || ''}`.trim(),
        debit: Number(l.debit) || '',
        credit: Number(l.credit) || '',
        description: l.description || ''
    })) || [
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
        if (lines.length <= 2) return
        setLines(lines.filter((_, i) => i !== index))
    }

    const updateLine = (index: number, field: string, value: string) => {
        const newLines = [...lines]
        // @ts-ignore
        newLines[index][field] = value

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

        // Auto-clear logic: If entering debit, clear credit and vice-versa
        if (field === 'debit' && value !== '') {
            // @ts-ignore
            newLines[index].credit = ''
        } else if (field === 'credit' && value !== '') {
            // @ts-ignore
            newLines[index].debit = ''
        }

        setLines(newLines)
    }

    const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
    const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
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
            alert('Cannot post an unbalanced entry.')
            return
        }

        const { yearId, periodId } = findFiscalContext(header.transactionDate, fiscalYears)
        if (!yearId) {
            alert('No active Fiscal Year found for this date.')
            return
        }

        startTransition(async () => {
            try {
                const payload = {
                    transactionDate: new Date(header.transactionDate),
                    description: header.description,
                    reference: header.reference,
                    fiscalYearId: yearId,
                    fiscalPeriodId: periodId,
                    status,
                    lines: lines.map((l: any) => ({
                        accountId: Number(l.accountId),
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

                router.push('/admin/finance/ledger')
                router.refresh()
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
                    <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Transaction Date</label>
                        <input
                            type="date"
                            required
                            value={header.transactionDate}
                            onChange={e => setHeader({ ...header, transactionDate: e.target.value })}
                            className="w-full border border-stone-300 rounded p-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Description</label>
                        <input
                            required
                            value={header.description}
                            onChange={e => setHeader({ ...header, description: e.target.value })}
                            className="w-full border border-stone-300 rounded p-2 text-sm"
                            placeholder="e.g. Monthly Rent Payment"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Reference</label>
                        <input
                            value={header.reference}
                            onChange={e => setHeader({ ...header, reference: e.target.value })}
                            className="w-full border border-stone-300 rounded p-2 text-sm"
                            placeholder="e.g. INV-001"
                        />
                    </div>
                    <div className="bg-stone-50 p-2 rounded border border-dashed border-stone-200">
                        <div className="text-[10px] font-bold text-stone-400 uppercase">Fiscal Context</div>
                        <div className="text-xs font-medium text-stone-700 truncate">
                            {fiscalContext.yearId ? (
                                <span className="flex items-center gap-1 text-green-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    {fiscalYears.find(y => y.id === fiscalContext.yearId)?.name}
                                    {fiscalContext.periodId && ` - Period ${fiscalYears.find(y => y.id === fiscalContext.yearId)?.periods.find((p: any) => p.id === fiscalContext.periodId)?.number}`}
                                </span>
                            ) : (
                                <span className="text-red-500">INVALID DATE: Out of Fiscal Scope</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-left">
                            <th className="p-2 font-bold text-stone-600">Account</th>
                            <th className="p-2 font-bold text-stone-600 w-32 text-right">Debit</th>
                            <th className="p-2 font-bold text-stone-600 w-32 text-right">Credit</th>
                            <th className="p-2 font-bold text-stone-600">Line Description</th>
                            <th className="p-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line, idx) => (
                            <tr key={idx} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                                <td className="p-2 relative">
                                    <div className="flex items-center gap-2">
                                        <input
                                            list="accounts-list"
                                            placeholder="Type code or name..."
                                            value={line.searchString}
                                            onChange={e => updateLine(idx, 'searchString', e.target.value)}
                                            className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-black outline-none font-medium transition-all ${line.accountId ? 'border-emerald-200 bg-emerald-50/10 text-stone-900' : 'border-stone-300 text-stone-700'
                                                }`}
                                        />
                                        {line.accountId && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!selectableAccounts.find(a => a.id.toString() === line.accountId)?.isActive && (
                                                    <span className="text-[8px] bg-stone-100 text-stone-400 px-1 rounded border border-stone-200 font-bold">INACTIVE</span>
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
                                        <div className="absolute left-2 top-full z-10 text-[9px] text-red-500 font-bold bg-white px-1 shadow-sm">
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
                                        className="w-full p-1.5 border border-stone-300 rounded text-right font-mono focus:ring-1 focus:ring-black outline-none"
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
                                        className="w-full p-1.5 border border-stone-300 rounded text-right font-mono focus:ring-1 focus:ring-black outline-none"
                                    />
                                </td>
                                <td className="p-2">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            value={line.description}
                                            onChange={e => updateLine(idx, 'description', e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, idx, 'description')}
                                            className="w-full p-1.5 border border-stone-300 rounded text-xs focus:ring-1 focus:ring-black outline-none"
                                            placeholder={header.description}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAutoBalance(idx)}
                                            title="Plug Balance"
                                            className="text-stone-300 hover:text-stone-600 transition-colors"
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
                        <tr className="font-bold text-stone-900 bg-stone-50">
                            <td className="p-3 text-right text-stone-500 uppercase text-[10px] tracking-wider">Totals</td>
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
                                            className="text-[10px] text-stone-400 hover:text-stone-900 underline uppercase font-bold"
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
                        className="flex items-center gap-2 text-stone-500 hover:text-stone-900 text-sm font-medium"
                    >
                        <Plus size={16} /> Add Line
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-stone-200">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 text-stone-600 font-bold text-sm hover:bg-stone-50 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => handleAction('DRAFT')}
                        disabled={isPending}
                        className="flex items-center gap-2 bg-stone-100 text-stone-700 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-200 disabled:opacity-50 transition-all border border-stone-200"
                    >
                        <FileText size={18} />
                        {isPending ? '...' : 'Save as Draft'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAction('POSTED')}
                        disabled={isPending || !isBalanced}
                        className="flex items-center gap-2 bg-black text-white px-8 py-2.5 rounded-lg font-bold text-sm hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
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
