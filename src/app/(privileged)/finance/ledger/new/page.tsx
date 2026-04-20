import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { getContacts } from '@/app/actions/crm/contacts'
import JournalEntryForm from './form'

export default async function NewJournalEntryPage() {
    const accounts = await getChartOfAccounts()
    const fiscalYears = await getFiscalYears()
    const contacts = await getContacts()

    return (
        <div className="h-full flex flex-col">
            <JournalEntryForm
                accounts={JSON.parse(JSON.stringify(accounts))} 
                fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} 
                contacts={JSON.parse(JSON.stringify(contacts))}
            />
        </div>
    )
}