import { getProfitAndLossReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import PnlViewer from '@/app/(privileged)/finance/reports/pnl/viewer'

import { cookies } from 'next/headers'

export default async function ProfitAndLossPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

    // Default to current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    let initialData: any = {}, fiscalYears: any = []
    try { initialData = await getProfitAndLossReport(start, end, scope) } catch { }
    try { fiscalYears = await getFiscalYears() } catch { }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <h1 className="page-header-title  text-stone-900 font-serif mb-2">Profit & Loss Statement</h1>
                <p className="text-stone-500 text-sm uppercase tracking-widest font-bold">Income & Expenditure Report</p>
            </div>

            <PnlViewer initialData={JSON.parse(JSON.stringify(initialData))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}