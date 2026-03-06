import { getFinancialSettings, getSettingsLockStatus } from '@/app/actions/finance/settings'
import { getCurrencies } from '@/app/actions/currencies'
import { getFinancialAccounts } from '@/app/actions/finance/financial-accounts'
import FinancialSettingsForm from './form'
import { Settings, Settings2 } from 'lucide-react'

export default async function SettingsPage() {
  let settings: any = {}, lock: any = {}, currencies: any = [], accounts: any = []
  try { settings = await getFinancialSettings() } catch { }
  try { lock = await getSettingsLockStatus() } catch { }
  try { currencies = await getCurrencies() } catch { }
  try { accounts = await getFinancialAccounts() } catch { }

  return (
    <div className="page-container">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
            <Settings2 size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Finance <span className="text-app-primary">Settings</span>
            </h1>
          </div>
        </div>
      </header>
      <FinancialSettingsForm settings={settings} lock={lock} currencies={currencies} accounts={accounts} />
    </div>
  )
}