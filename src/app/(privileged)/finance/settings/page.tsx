import { getFinancialSettings, getSettingsLockStatus } from '@/app/actions/finance/settings'
import { getCurrencies } from '@/app/actions/currencies'
import { getFinancialAccounts } from '@/app/actions/finance/financial-accounts'
import FinancialSettingsForm from './form'
import { Settings } from 'lucide-react'

export default async function SettingsPage() {
    let settings: any = {}, lock: any = {}, currencies: any = [], accounts: any = []
    try { settings = await getFinancialSettings() } catch { }
    try { lock = await getSettingsLockStatus() } catch { }
    try { currencies = await getCurrencies() } catch { }
    try { accounts = await getFinancialAccounts() } catch { }

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-stone-700 flex items-center justify-center shadow-lg shadow-stone-300">
                        <Settings size={28} className="text-white" />
                    </div>
                    Financial <span className="text-stone-600">Settings</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Configuration & Defaults</p>
            </header>
            <FinancialSettingsForm settings={settings} lock={lock} currencies={currencies} accounts={accounts} />
        </div>
    )
}