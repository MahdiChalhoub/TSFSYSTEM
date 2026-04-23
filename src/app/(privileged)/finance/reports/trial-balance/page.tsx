import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import TrialBalanceViewer from '@/app/(privileged)/finance/reports/trial-balance/viewer'
import { cookies } from 'next/headers'

export default async function TrialBalancePage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const accounts = await getChartOfAccounts(false, scope)
    const fiscalYears = await getFiscalYears()

    return <TrialBalanceViewer initialAccounts={accounts} fiscalYears={fiscalYears} />
}
