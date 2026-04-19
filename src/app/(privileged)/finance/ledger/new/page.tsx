import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { getContacts } from '@/app/actions/crm/contacts'
import JournalEntryForm from './form'
import { FileEdit } from 'lucide-react'

export default async function NewJournalEntryPage() {
    const accounts = await getChartOfAccounts()
    const fiscalYears = await getFiscalYears()
    const contacts = await getContacts()

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-app-surface/30">
            <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">
                
                {/* ── Page Header (Dajingo Pro V2) ── */}
                <div className="flex items-center gap-4 border-b border-app-border/40 pb-6 mb-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-app-primary shadow-[0_4px_24px_color-mix(in_srgb,var(--app-primary)_40%,transparent)]">
                        <FileEdit size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-app-foreground tracking-tight">Post Manual Journal</h1>
                        <p className="text-[12px] font-bold text-app-muted-foreground uppercase tracking-widest mt-0.5">
                            General Ledger • V2 Dimensional Engine
                        </p>
                    </div>
                </div>

                {/* ── Advanced Form ── */}
                <JournalEntryForm 
                    accounts={JSON.parse(JSON.stringify(accounts))} 
                    fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} 
                    contacts={JSON.parse(JSON.stringify(contacts))} 
                />
            </div>
        </div>
    )
}