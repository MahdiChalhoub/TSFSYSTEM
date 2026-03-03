import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import TrialBalanceViewer from '@/app/(privileged)/finance/reports/trial-balance/viewer'

import { cookies } from 'next/headers'

export default async function TrialBalancePage() {
 const cookieStore = await cookies()
 const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
 let accounts: any = [], fiscalYears: any = []
 try { accounts = await getChartOfAccounts(false, scope) } catch { }
 try { fiscalYears = await getFiscalYears() } catch { }

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 <div className="text-center mb-10">
 <h1 className="page-header-title text-app-foreground font-serif mb-2">Trial Balance</h1>
 <p className="text-app-muted-foreground text-sm uppercase tracking-widest font-bold">General Ledger Integrity Report</p>
 </div>

 <TrialBalanceViewer initialAccounts={accounts} fiscalYears={fiscalYears} />
 </div>
 )
}