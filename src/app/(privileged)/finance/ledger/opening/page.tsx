import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import OpeningBalanceForm from './form'

export default async function OpeningBalancePage() {
    let accounts: any = []
    try { accounts = await getChartOfAccounts() } catch { /* empty fallback */ }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-stone-900 font-serif mb-8 text-center">System Setup: Opening Balances</h1>
            <OpeningBalanceForm accounts={accounts} />
        </div>
    )
}