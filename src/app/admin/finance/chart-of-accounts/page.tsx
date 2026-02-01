import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { ChartOfAccountsViewer } from './viewer'

export default async function ChartOfAccountsPage() {
    const accounts = await getChartOfAccounts(true)

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-6 font-serif">Chart of Accounts</h1>
            <ChartOfAccountsViewer accounts={JSON.parse(JSON.stringify(accounts))} />
        </div>
    )
}
