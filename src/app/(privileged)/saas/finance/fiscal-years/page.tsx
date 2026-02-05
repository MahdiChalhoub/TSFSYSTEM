import { getFiscalYears, getFiscalGaps } from '@/app/actions/finance/fiscal-year'
import FiscalYearWizard from './wizard'
import FiscalYearCard from './year-card'
import { AlertTriangle } from 'lucide-react'

export default async function FiscalYearsPage() {
    const years = await getFiscalYears()
    const gaps = await getFiscalGaps()

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 font-serif">Fiscal Years</h1>
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
                                    <strong>{(g as any).days} Day Gap</strong> after {(g as any).after}:
                                    <span className="ml-1 opacity-70">
                                        {new Date(g.startDate).toLocaleDateString()} — {new Date(g.endDate).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {years.map((y: any, idx: number) => (
                    <FiscalYearCard
                        key={y.id}
                        year={y}
                        nextYear={years[idx - 1]} // Assuming desc order, idx-1 is the more recent year
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
