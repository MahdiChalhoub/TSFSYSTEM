import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import OpeningBalanceForm from './form'

export default async function OpeningBalancePage() {
  const accounts = await getChartOfAccounts()

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <OpeningBalanceForm accounts={accounts} />
    </div>
  )
}