import { getFinancialDashboardStats } from '@/app/actions/finance/dashboard'
import FinanceDashboardViewer from '@/app/(privileged)/finance/dashboard/viewer'

import { cookies } from 'next/headers'

export default async function FinanceDashboardPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    let stats: any = {}
    try { stats = await getFinancialDashboardStats(scope) } catch { /* empty fallback */ }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-bold text-stone-900 font-serif">Finance Overview</h1>
                    <p className="text-stone-500 font-medium">Real-time performance & liquidity tracking</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 px-4 py-2 rounded-xl text-xs font-bold text-stone-400 uppercase tracking-widest">
                    Last Updated: {new Date().toLocaleTimeString()}
                </div>
            </div>

            <FinanceDashboardViewer initialStats={JSON.parse(JSON.stringify(stats))} />
        </div>
    )
}