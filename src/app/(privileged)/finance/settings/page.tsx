import { getAccountingSetupStatus } from '@/app/actions/finance/settings'
import { getCurrencies } from '@/app/actions/currencies'
import AccountingSetupHub from './AccountingSetupHub'

export default async function SettingsPage() {
    const [setupStatus, currencies] = await Promise.all([
        getAccountingSetupStatus(),
        getCurrencies(),
    ])

    return <AccountingSetupHub setupStatus={setupStatus} currencies={currencies} />
}