import { getChartOfAccounts, getCoaNumberingRules } from '@/app/actions/finance/accounts'
import { getOrgCurrencies } from '@/app/actions/reference'
import { COAGateway } from './COAGateway'
import { cookies } from 'next/headers'

export default async function ChartOfAccountsPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'
    // Parallel-fetch: org currencies (Regional Settings) drive the currency
    // picker; numbering rules drive AccountForm's child-code suggestion per
    // the org's active template (PCG/SYSCOHADA prefix-extend vs GAAP/IFRS
    // fixed-step).
    const [accounts, orgCurrencies, numberingRules] = await Promise.all([
        getChartOfAccounts(true, scope),
        getOrgCurrencies(),
        getCoaNumberingRules(),
    ])

    return (
        <div className="h-full flex flex-col">
            <COAGateway
                accounts={JSON.parse(JSON.stringify(accounts))}
                orgCurrencies={JSON.parse(JSON.stringify(orgCurrencies))}
                numberingRules={JSON.parse(JSON.stringify(numberingRules))}
            />
        </div>
    )
}