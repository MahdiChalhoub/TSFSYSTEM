import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import StatementGenerator from './form'
import { serialize } from '@/lib/utils'

import { cookies } from 'next/headers'

export default async function StatementReportPage() {
 const cookieStore = await cookies()
 const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
 let accounts: any = [], fiscalYears: any = []
 try { accounts = await getChartOfAccounts(false, scope) } catch { }
 try { fiscalYears = await getFiscalYears() } catch { }

 return (
 <div className="space-y-6 animate-in fade-in duration-500">
 <h1 className="page-header-title text-app-text font-serif mb-8 text-center">Financial Reports</h1>
 <StatementGenerator
 accounts={serialize(accounts)}
 fiscalYears={serialize(fiscalYears)}
 />
 </div>
 )
}