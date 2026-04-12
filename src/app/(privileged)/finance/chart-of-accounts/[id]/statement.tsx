'use client'

import { useState } from 'react'
import { ChevronLeft, Printer } from 'lucide-react'
import Link from 'next/link'

interface StatementProps {
    data: {
        account: Record<string, any>
        openingBalance: number
        lines: Record<string, any>[]
    }
    dateRange: { start: string, end: string }
}

export default function AccountStatementView({ data, dateRange }: StatementProps) {
    const [currentRange, setCurrentRange] = useState(dateRange)

    // Running Balance Calculation
    let runningBalance = data.openingBalance

    // Determine sign for display
    // Asset/Exp: Dr positive. Liab/Eq/Inc: Cr positive (Negative number)
    // Actually, usually Statement shows Dr/Cr side by side and "Balance" column with Dr/Cr indicator.

    return (
        <div className="bg-app-surface shadow-sm border border-app-border rounded-lg min-h-[800px]">
            {/* Header */}
            <div className="p-8 border-b border-app-border flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground font-serif mb-1">{data.account.name}</h1>
                    <div className="text-app-muted-foreground font-mono text-sm">Account Code: {data.account.code}</div>
                    <div className="mt-2 text-xs uppercase font-bold tracking-wider text-app-muted-foreground">{data.account.type}</div>
                </div>

                <div className="text-right">
                    <h2 className="text-xs font-bold uppercase text-app-muted-foreground mb-1">Statement Period</h2>
                    <div className="font-medium text-app-foreground">
                        {new Date(currentRange.start).toLocaleDateString()} — {new Date(currentRange.end).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Filter Bar (Simplified) */}
            <div className="p-4 bg-app-surface border-b border-app-border flex gap-4 items-center">
                <form className="flex gap-2 items-center text-sm">
                    <span className="font-medium text-app-muted-foreground">Period:</span>
                    <input
                        type="date"
                        name="start"
                        defaultValue={currentRange.start}
                        className="border border-app-border rounded p-1"
                    />
                    <span className="text-app-muted-foreground">-</span>
                    <input
                        type="date"
                        name="end"
                        defaultValue={currentRange.end}
                        className="border border-app-border rounded p-1"
                    />
                    <button type="submit" className="bg-app-foreground text-white px-3 py-1 rounded hover:bg-app-surface">
                        Filter
                    </button>
                </form>

                <div className="flex-1"></div>

                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 text-app-muted-foreground hover:text-black"
                >
                    <Printer size={16} /> Print
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-app-surface border-b border-app-border text-app-muted-foreground font-bold uppercase text-xs tracking-wider">
                            <th className="px-6 py-3 text-left w-32">Date</th>
                            <th className="px-6 py-3 text-left w-24">Ref</th>
                            <th className="px-6 py-3 text-left">Description</th>
                            <th className="px-6 py-3 text-right w-32">Debit</th>
                            <th className="px-6 py-3 text-right w-32">Credit</th>
                            <th className="px-6 py-3 text-right w-40">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border">
                        {/* Opening Balance Row */}
                        <tr className="bg-app-surface/50 italic text-app-muted-foreground">
                            <td className="px-6 py-3">{new Date(currentRange.start).toLocaleDateString()}</td>
                            <td className="px-6 py-3">-</td>
                            <td className="px-6 py-3 font-medium">Opening Balance</td>
                            <td className="px-6 py-3 text-right">
                                {data.openingBalance > 0 ? data.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="px-6 py-3 text-right">
                                {data.openingBalance < 0 ? Math.abs(data.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="px-6 py-3 text-right font-mono font-bold">
                                {Math.abs(data.openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="ml-1 text-xs text-app-muted-foreground">{data.openingBalance >= 0 ? 'Dr' : 'Cr'}</span>
                            </td>
                        </tr>

                        {/* Transactions */}
                        {data.lines.map((line) => {
                            runningBalance += (line.debit - line.credit)

                            return (
                                <tr key={line.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-3 text-app-muted-foreground">
                                        {new Date(line.journalEntry.transactionDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-3 text-app-muted-foreground font-mono text-xs">
                                        <Link href={`/finance/ledger?id=${line.journalEntry.id}`} className="hover:underline hover:text-blue-600">
                                            #{line.journalEntry.id}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-3 text-app-foreground font-medium">
                                        {line.description || line.journalEntry.description}
                                        {line.journalEntry.reference && (
                                            <span className="ml-2 bg-app-surface-2 text-app-muted-foreground px-1.5 py-0.5 rounded text-[10px] font-mono">
                                                {line.journalEntry.reference}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-app-foreground">
                                        {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-app-foreground">
                                        {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-app-foreground group-hover:text-blue-700">
                                        {Math.abs(runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        <span className="ml-1 text-xs text-app-muted-foreground">{runningBalance >= 0 ? 'Dr' : 'Cr'}</span>
                                    </td>
                                </tr>
                            )
                        })}

                        {data.lines.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-app-muted-foreground italic">
                                    No transactions in this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-app-surface font-bold border-t border-app-border">
                        <tr>
                            <td colSpan={3} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-app-muted-foreground">
                                Closing Balance
                            </td>
                            <td className="px-6 py-4 text-right">
                                {/* Total Debits in Period Only */}
                                {data.lines.reduce((s, l) => s + l.debit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {/* Total Credits in Period Only */}
                                {data.lines.reduce((s, l) => s + l.credit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right bg-app-surface-2">
                                {Math.abs(runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="ml-1 text-xs text-app-muted-foreground">{runningBalance >= 0 ? 'Dr' : 'Cr'}</span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}