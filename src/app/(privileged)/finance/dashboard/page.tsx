import { getFinancialDashboardStats } from '@/app/actions/finance/dashboard'
import FinanceDashboardViewer from '@/app/(privileged)/finance/dashboard/viewer'

import { cookies } from 'next/headers'

export default async function FinanceDashboardPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const stats = await getFinancialDashboardStats(scope)

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-bold text-app-foreground font-serif">Finance Overview</h1>
                    <p className="text-app-muted-foreground font-medium">Real-time performance & liquidity tracking</p>
                </div>
                <div className="bg-app-surface border border-app-border px-4 py-2 rounded-xl text-xs font-bold text-app-muted-foreground uppercase tracking-widest">
                    Last Updated: {new Date().toLocaleTimeString()}
                </div>
            </div>

            <FinanceDashboardViewer initialStats={JSON.parse(JSON.stringify(stats))} />
        </div>
    )
}