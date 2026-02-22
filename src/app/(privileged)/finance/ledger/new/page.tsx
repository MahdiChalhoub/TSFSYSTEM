import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import JournalEntryForm from './form'

export default async function NewJournalEntryPage() {
    let accounts: any = [], fiscalYears: any = []
    try { accounts = await getChartOfAccounts() } catch { }
    try { fiscalYears = await getFiscalYears() } catch { }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 font-serif mb-6">New Journal Entry</h1>
            <JournalEntryForm accounts={JSON.parse(JSON.stringify(accounts))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}