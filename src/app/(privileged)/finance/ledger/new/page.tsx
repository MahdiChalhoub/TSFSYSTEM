import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { FilePlus } from 'lucide-react';
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import JournalEntryForm from './form'

export default async function NewJournalEntryPage() {
 let accounts: any = [], fiscalYears: any = []
 try { accounts = await getChartOfAccounts() } catch { }
 try { fiscalYears = await getFiscalYears() } catch { }

 return (
 <div className="app-page p-6">
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-emerald-200">
 <FilePlus size={28} className="text-app-foreground" />
 </div>
 New Journal <span className="text-app-primary">Entry</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Create Manual Entry</p>
 <JournalEntryForm accounts={JSON.parse(JSON.stringify(accounts))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
 </div>
 )
}