import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import TrialBalanceViewer from '@/app/(privileged)/saas/finance/reports/trial-balance/viewer'

import { cookies } from 'next/headers'

export default async function TrialBalancePage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const accounts = await getChartOfAccounts(false, scope)
    const fiscalYears = await getFiscalYears()

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Trial Balance</h1>
                <p className="text-stone-500 text-sm uppercase tracking-widest font-bold">General Ledger Integrity Report</p>
            </div>

            <TrialBalanceViewer initialAccounts={accounts} fiscalYears={fiscalYears} />
        </div>
    )
}
