import { getChartOfAccounts } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import StatementGenerator from './form'

export default async function StatementReportPage() {
    const accounts = await getChartOfAccounts()
    const fiscalYears = await getFiscalYears()

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-stone-900 font-serif mb-8 text-center">Financial Reports</h1>
            <StatementGenerator accounts={accounts} fiscalYears={fiscalYears} />
        </div>
    )
}
