import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getOrgCurrencies } from '@/app/actions/reference'
import { COAGateway } from './COAGateway'
import { cookies } from 'next/headers'

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    // Parallel-fetch the org-enabled currencies (Regional Settings) so the
    // AccountForm can render a proper currency picker instead of free-text.
    const [accounts, orgCurrencies] = await Promise.all([
        getChartOfAccounts(true, scope),
        getOrgCurrencies(),
    ])

    return (
        <div className="h-full flex flex-col">
            <COAGateway
                accounts={JSON.parse(JSON.stringify(accounts))}
                orgCurrencies={JSON.parse(JSON.stringify(orgCurrencies))}
            />
        </div>
    )
}