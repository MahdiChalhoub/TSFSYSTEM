import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import OpeningBalanceForm from './form'

export default async function OpeningBalancePage() {
    const accounts = await getChartOfAccounts()

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-stone-900 font-serif mb-8 text-center">System Setup: Opening Balances</h1>
            <OpeningBalanceForm accounts={accounts} />
        </div>
    )
}