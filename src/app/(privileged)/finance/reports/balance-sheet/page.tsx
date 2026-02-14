import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import BalanceSheetViewer from '@/app/(privileged)/finance/reports/balance-sheet/viewer'

import { cookies } from 'next/headers'

export default async function BalanceSheetPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

    const now = new Date()
    const initialData = await getBalanceSheetReport(now, scope)
    const fiscalYears = await getFiscalYears()

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Balance Sheet</h1>
                <p className="text-stone-500 text-sm uppercase tracking-widest font-bold">Statement of Financial Position</p>
            </div>

            <BalanceSheetViewer initialData={JSON.parse(JSON.stringify(initialData))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}