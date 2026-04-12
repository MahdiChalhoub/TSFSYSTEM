import { getFinancialSettings, getSettingsLockStatus } from '@/app/actions/finance/settings'
import { getCurrencies } from '@/app/actions/currencies'
import FinancialSettingsForm from './form'

export default async function SettingsPage() {
    const settings = await getFinancialSettings()
    const lock = await getSettingsLockStatus()
    const currencies = await getCurrencies()

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-app-foreground mb-6 font-serif">Financial Settings</h1>
            <FinancialSettingsForm settings={settings} lock={lock} currencies={currencies} />
        </div>
    )
}