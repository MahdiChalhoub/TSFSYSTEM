'use client';

import React, { useState } from 'react';
import {
    FileText,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    CreditCard,
    History,
    Info,
    Fuel
} from 'lucide-react';
import LogExpenseModal from './LogExpenseModal';

interface StatementEntry {
    id: number;
    date: string;
    description: string;
    reference: string;
    debit: string;
    credit: string;
    amount: string;
}

interface DriverStatementProps {
    entries: StatementEntry[];
    balance: string;
    driverName: string;
    onLogExpense?: () => void;
}

export default function DriverStatement({ entries, balance, driverName, onLogExpense }: DriverStatementProps) {
    const currentBalance = parseFloat(balance);

    return (
        <div className="space-y-6">
            {/* Balance Summary Header */}
            <div
                className="GlassCard p-8 rounded-2xl border border-white/5 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-info) 10%, transparent), color-mix(in srgb, var(--app-accent) 10%, transparent))' }}
            >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <History className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <span className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 block italic">Earnings Statement</span>
                        <h2 className="mb-1">{driverName}</h2>
                        <div className="flex items-center gap-3 text-sm text-white/40">
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Lifecycle History</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> All posted entries</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1 block">Account Balance</span>
                        <div className={`text-4xl font-black ${currentBalance >= 0 ? 'text-app-success' : 'text-app-error'}`}>
                            {currentBalance >= 0 ? '+' : ''}{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg opacity-50 font-medium">USD</span>
                        </div>
                        <p className="text-[10px] text-white/30 mt-2 uppercase tracking-tighter">Due for next payout cycle</p>
                    </div>
                </div>
            </div>

            {/* Transaction List */}
            <div className="GlassCard rounded-xl border border-white/5 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <h3 className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-app-info" />
                        Transaction History
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={onLogExpense}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-white/10"
                        >
                            <Fuel className="w-3.5 h-3.5 text-app-info" /> Log Expense
                        </button>
                        <button className="px-4 py-2 bg-app-info hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
                            <CreditCard className="w-3.5 h-3.5" /> Request Payout
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-white/40 bg-white/[0.02]">
                                <th className="px-6 py-4">Date & Reference</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Debit (Paid)</th>
                                <th className="px-6 py-4">Credit (Earned)</th>
                                <th className="px-6 py-4 text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {entries.length > 0 ? (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-white/[0.04] transition-colors group">
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-medium">{new Date(entry.date).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-white/30 font-mono mt-0.5 tracking-tight group-hover:text-app-info transition-colors uppercase cursor-help">{entry.reference}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm text-white/80">{entry.description}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            {parseFloat(entry.debit) > 0 ? (
                                                <div className="flex items-center gap-2 text-app-error font-medium">
                                                    <ArrowUpRight className="w-3 h-3" />
                                                    <span>{parseFloat(entry.debit).toLocaleString()}</span>
                                                </div>
                                            ) : <span className="opacity-10">—</span>}
                                        </td>
                                        <td className="px-6 py-5">
                                            {parseFloat(entry.credit) > 0 ? (
                                                <div className="flex items-center gap-2 text-app-success font-medium">
                                                    <ArrowDownLeft className="w-3 h-3" />
                                                    <span>{parseFloat(entry.credit).toLocaleString()}</span>
                                                </div>
                                            ) : <span className="opacity-10">—</span>}
                                        </td>
                                        <td className="px-6 py-5 text-right font-bold text-sm">
                                            {parseFloat(entry.amount) > 0 ? (
                                                <span className="text-app-success">+{parseFloat(entry.amount).toLocaleString()}</span>
                                            ) : (
                                                <span className="text-app-error">{parseFloat(entry.amount).toLocaleString()}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <History className="w-12 h-12" />
                                            <p className="text-sm font-medium">No ledger history found for this driver</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
