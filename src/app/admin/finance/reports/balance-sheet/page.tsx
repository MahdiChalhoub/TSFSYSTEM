import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import BalanceSheetViewer from '@/app/admin/finance/reports/balance-sheet/viewer'

export default async function BalanceSheetPage() {
    const now = new Date()
    const initialData = await getBalanceSheetReport(now)
    const fiscalYears = await getFiscalYears()

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Balance Sheet</h1>
                <p className="text-stone-500 text-sm uppercase tracking-widest font-bold">Statement of Financial Position</p>
            </div>

            <BalanceSheetViewer initialData={JSON.parse(JSON.stringify(initialData))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}
