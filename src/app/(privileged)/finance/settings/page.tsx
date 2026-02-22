import { getFinancialSettings, getSettingsLockStatus } from '@/app/actions/finance/settings'
import { getCurrencies } from '@/app/actions/currencies'
import FinancialSettingsForm from './form'

export default async function SettingsPage() {
    let settings: any = {}, lock: any = {}, currencies: any = []
    try { settings = await getFinancialSettings() } catch { }
    try { lock = await getSettingsLockStatus() } catch { }
    try { currencies = await getCurrencies() } catch { }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-6 font-serif">Financial Settings</h1>
            <FinancialSettingsForm settings={settings} lock={lock} currencies={currencies} />
        </div>
    )
}