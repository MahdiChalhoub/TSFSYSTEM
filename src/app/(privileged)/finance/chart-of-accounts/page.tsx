import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { ChartOfAccountsViewer } from './viewer'
import { cookies } from 'next/headers'

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    const accounts = await getChartOfAccounts(true, scope)

    return (
        <div className="h-full flex flex-col">
            <ChartOfAccountsViewer accounts={JSON.parse(JSON.stringify(accounts))} />
        </div>
    )
}