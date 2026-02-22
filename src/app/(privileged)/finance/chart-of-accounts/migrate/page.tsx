import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getAllTemplates } from '@/app/actions/finance/coa-templates'
import CoaMigrationTool from '@/app/(privileged)/finance/chart-of-accounts/migrate/viewer'

export default async function CoaMigrationPage() {
    let accounts: any = [], templates: any = []
    try { accounts = await getChartOfAccounts(true) } catch { }
    try { templates = await getAllTemplates() } catch { }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Account Migration Tool</h1>
                <p className="text-stone-500 font-medium uppercase tracking-widest text-xs">Transform your layout without losing your history</p>
            </div>

            <CoaMigrationTool currentAccounts={accounts} availableTemplates={templates} />
        </div>
    )
}