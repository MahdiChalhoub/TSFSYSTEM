import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { FilePlus } from 'lucide-react';
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import JournalEntryForm from './form'

export default async function NewJournalEntryPage() {
    let accounts: any = [], fiscalYears: any = []
    try { accounts = await getChartOfAccounts() } catch { }
    try { fiscalYears = await getFiscalYears() } catch { }

    return (
        <div className="p-6">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                    <FilePlus size={28} className="text-white" />
                </div>
                New Journal <span className="text-emerald-600">Entry</span>
            </h1>
            <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Create Manual Entry</p>
            <JournalEntryForm accounts={JSON.parse(JSON.stringify(accounts))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}