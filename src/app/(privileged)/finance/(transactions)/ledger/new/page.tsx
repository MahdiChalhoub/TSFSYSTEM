import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import JournalEntryForm from './form'

export default async function NewJournalEntryPage() {
    const accounts = await getChartOfAccounts()
    const fiscalYears = await getFiscalYears()

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-stone-900 font-serif mb-6">New Journal Entry</h1>
            <JournalEntryForm accounts={JSON.parse(JSON.stringify(accounts))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}