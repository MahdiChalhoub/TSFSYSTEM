'use client'

import { useEffect, useState } from 'react'
import { getFiscalYears, getFiscalGaps } from '@/app/actions/finance/fiscal-year'
import type { FiscalYear } from '@/types/erp'
import FiscalYearWizard from './wizard'
import FiscalYearCard from './year-card'
import { AlertTriangle, Loader2 , CalendarDays } from 'lucide-react'

export default function FiscalYearsPage() {
    const [years, setYears] = useState<FiscalYear[]>([])
    const [gaps, setGaps] = useState<{ days: number; after: string; startDate: string; endDate: string }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const [yearsData, gapsData] = await Promise.all([
                    getFiscalYears(),
                    getFiscalGaps()
                ])
                setYears(Array.isArray(yearsData) ? yearsData : [])
                setGaps(Array.isArray(gapsData) ? gapsData : [])
            } catch (err) {
                console.error('Failed to load fiscal years:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 size={40} className="animate-spin text-stone-400 mx-auto" />
                    <p className="text-stone-400 font-medium text-sm">Loading fiscal years...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-stone-600 flex items-center justify-center shadow-lg shadow-stone-200">
                            <CalendarDays size={28} className="text-white" />
                        </div>
                        Fiscal <span className="text-stone-600">Years</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Periods & Closing</p>
                    <p className="text-sm text-stone-500">Manage your accounting periods and closing cycles.</p>
                </div>
                <FiscalYearWizard lastCreatedYear={years[0]} />
            </div>

            {gaps.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-amber-100 p-2 rounded-full">
                        <AlertTriangle className="text-amber-600" size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-900">Fiscal Timeline Gaps Detected</h4>
                        <p className="text-xs text-amber-700 mb-2">Transactions occurring during these dates cannot be recorded in any period.</p>
                        <div className="space-y-1">
                            {gaps.map((g, i) => (
                                <div key={i} className="text-xs text-amber-800 bg-white/50 px-2 py-1 rounded inline-block mr-2 border border-amber-100">
                                    <strong>{g.days} Day Gap</strong> after {g.after}:
                                    <span className="ml-1 opacity-70">
                                        {g.startDate ? new Date(g.startDate).toLocaleDateString() : '—'} — {g.endDate ? new Date(g.endDate).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {years.map((y: Record<string, any>, idx: number) => (
                    <FiscalYearCard
                        key={y.id}
                        year={y}
                        nextYear={years[idx - 1]}
                    />
                ))}

                {years.length === 0 && (
                    <div className="text-center py-12 bg-stone-50 rounded-lg border-2 border-dashed border-stone-200">
                        <p className="text-stone-500">No fiscal years configured.</p>
                        <p className="text-sm text-stone-400 mt-1">Create a year to start recording transactions.</p>
                    </div>
                )}
            </div>
        </div>
    )
}