import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { ChartOfAccountsViewer } from './viewer'
import { cookies } from 'next/headers'

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const accounts = await getChartOfAccounts(true, scope)

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-6 font-serif">Chart of Accounts</h1>
            <ChartOfAccountsViewer accounts={JSON.parse(JSON.stringify(accounts))} />
        </div>
    )
}
