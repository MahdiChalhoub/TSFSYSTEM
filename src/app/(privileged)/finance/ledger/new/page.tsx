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
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 animate-in fade-in duration-300 transition-all overflow-hidden">
            <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col min-h-0 gap-4">
                
                {/* ── Page Header (Dajingo Pro V2) ── */}
                <div className="shrink-0 flex items-center gap-4 border-b border-app-border/40 pb-2">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <FileEdit size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Post Manual Journal</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
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