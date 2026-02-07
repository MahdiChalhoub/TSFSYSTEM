import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getAllTemplates } from '@/app/actions/finance/coa-templates'
import CoaMigrationTool from '@/app/admin/finance/chart-of-accounts/migrate/viewer'

export default async function CoaMigrationPage() {
    // We get ALL accounts (including inactive) to catch balances stuck in old accounts
    const accounts = await getChartOfAccounts(true)

    // Get all available templates
    const templates = await getAllTemplates()

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Account Migration Tool</h1>
                <p className="text-stone-500 font-medium uppercase tracking-widest text-xs">Transform your layout without losing your history</p>
            </div>

            <CoaMigrationTool currentAccounts={accounts} availableTemplates={templates} />
        </div>
    )
}