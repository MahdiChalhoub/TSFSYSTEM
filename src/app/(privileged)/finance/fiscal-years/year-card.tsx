'use client'

import { useState, useTransition } from 'react'
import { deleteFiscalYear, updatePeriodStatus, closeFiscalYear, hardLockFiscalYear, transferBalancesToNextYear } from '@/app/actions/finance/fiscal-year'
import { Trash2, Lock, Unlock, Edit2, PlayCircle, Clock, ShieldCheck, Forward } from 'lucide-react'
import PeriodEditor from './period-editor'

export default function FiscalYearCard({ year, nextYear }: { year: any, nextYear?: any }) {
    const [isPending, startTransition] = useTransition()
    const [editingPeriod, setEditingPeriod] = useState<any>(null)

    // ... (logic)
    const handleRollForward = () => {
        if (!nextYear) return
        if (!confirm(`This will calculate all Asset, Liability, and Equity balances for ${year.name} and create an Opening Entry in ${nextYear.name}. Continue?`)) return

        startTransition(async () => {
            try {
                await transferBalancesToNextYear(year.id, nextYear.id)
                alert("Balances transferred successfully!")
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    const handleDelete = () => {
        if (!confirm('Are you sure you want to delete this Fiscal Year? check will be performed...')) return

        startTransition(async () => {
            try {
                await deleteFiscalYear(year.id)
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    const handleCloseYear = () => {
        if (!confirm('Are you sure you want to CLOSE this Fiscal Year? This acts as a Soft Close.')) return

        startTransition(async () => {
            await closeFiscalYear(year.id)
        })
    }

    const handleHardLock = () => {
        if (!confirm('CRITICAL: Hard Locking is permanent and ensures compliance. You will NOT be able to reopen periods. Proceed?')) return
        startTransition(async () => {
            await hardLockFiscalYear(year.id)
        })
    }

    const handleChangeStatus = (periodId: number, status: 'OPEN' | 'CLOSED' | 'FUTURE') => {
        startTransition(async () => {
            try {
                await updatePeriodStatus(periodId, status)
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    return (
        <div className={`
            bg-white border rounded-lg p-5 shadow-sm transition-all hover:shadow-md
            ${year.isHardLocked ? 'border-red-200 bg-stone-50/50' : 'border-stone-200'}
        `}>
            <div className="flex justify-between items-start mb-6 border-b border-stone-100 pb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-stone-900 flex items-center gap-3">
                            {year.name}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${year.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                                year.isHardLocked ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600'
                                }`}>
                                {year.isHardLocked ? 'FINALIZED' : year.status}
                            </span>
                        </h3>
                        <p className="text-sm text-stone-500 mt-1 font-medium">
                            {new Date(year.startDate).toLocaleDateString()} ΓÇö {new Date(year.endDate).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {year.status === 'OPEN' && (
                        <button
                            onClick={handleCloseYear}
                            disabled={isPending}
                            className="text-stone-400 hover:text-orange-600 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-stone-200 rounded hover:bg-orange-50 transition-colors"
                        >
                            Soft Close
                        </button>
                    )}

                    {year.status === 'CLOSED' && nextYear && (
                        <button
                            onClick={handleRollForward}
                            disabled={isPending}
                            className="text-stone-400 hover:text-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-stone-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                        >
                            <Forward size={14} /> Roll Forward
                        </button>
                    )}

                    {year.status === 'CLOSED' && !year.isHardLocked && (
                        <button
                            onClick={handleHardLock}
                            disabled={isPending}
                            className="text-red-500 hover:text-red-700 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-red-200 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
                        >
                            <Lock size={12} /> Hard Lock
                        </button>
                    )}

                    {year.isHardLocked && (
                        <div className="bg-red-100 text-red-700 px-3 py-1 text-[10px] font-extrabold uppercase rounded flex items-center gap-1 border border-red-200">
                            <ShieldCheck size={12} /> IMMUTABLE
                        </div>
                    )}

                    <button
                        onClick={handleDelete}
                        disabled={isPending || year.isHardLocked}
                        className={`p-2 rounded-full transition-colors ${year.isHardLocked ? 'text-stone-300' : 'text-stone-400 hover:text-red-600 hover:bg-red-50'}`}
                        title="Delete Year"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
                {year.periods?.map((p: any) => (
                    <div
                        key={p.id}
                        className={`
                            relative group p-3 rounded-lg border text-center transition-all
                            ${p.status === 'OPEN' ? 'bg-white border-green-200 shadow-sm' : ''}
                            ${p.status === 'CLOSED' || p.status === 'LOCKED' ? 'bg-stone-50 border-stone-200 opacity-75' : ''}
                            ${p.status === 'FUTURE' ? 'bg-blue-50 border-blue-100 text-blue-700' : ''}
                            ${p.type === 'ADJUSTMENT' ? 'border-dashed border-stone-400' : ''}
                        `}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
                            {p.type === 'ADJUSTMENT' ? 'Audit' : `P${p.number}`}
                        </div>
                        <div className="font-semibold text-xs truncate">{p.name.split(' ')[0]}</div>

                        <div className="flex justify-center items-center gap-1 mt-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                                (p.status === 'CLOSED' || p.status === 'LOCKED') ? 'bg-stone-200 text-stone-600' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                {p.status === 'LOCKED' ? 'CLOSED' : p.status}
                            </span>
                        </div>

                        {/* Hover Actions */}
                        {!year.isHardLocked && (
                            <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-lg z-10 p-2 text-stone-600">

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleChangeStatus(p.id, 'OPEN')}
                                        className={`p-1.5 rounded hover:bg-green-100 hover:text-green-700 ${p.status === 'OPEN' ? 'bg-green-50 text-green-700' : ''}`}
                                        title="Open"
                                    >
                                        <PlayCircle size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleChangeStatus(p.id, 'CLOSED')}
                                        className={`p-1.5 rounded hover:bg-stone-200 hover:text-stone-800 ${p.status === 'CLOSED' || p.status === 'LOCKED' ? 'bg-stone-200 text-stone-800' : ''}`}
                                        title="Close"
                                    >
                                        <Lock size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleChangeStatus(p.id, 'FUTURE')}
                                        className={`p-1.5 rounded hover:bg-blue-100 hover:text-blue-700 ${p.status === 'FUTURE' ? 'bg-blue-50 text-blue-700' : ''}`}
                                        title="Future"
                                    >
                                        <Clock size={14} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => setEditingPeriod(p)}
                                    className="text-[9px] font-bold uppercase hover:underline mt-1"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {editingPeriod && (
                <PeriodEditor period={editingPeriod} onClose={() => setEditingPeriod(null)} />
            )}
        </div>
    )
}