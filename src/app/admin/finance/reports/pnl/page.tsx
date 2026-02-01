import { getProfitAndLossReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import PnlViewer from '@/app/admin/finance/reports/pnl/viewer'

export default async function ProfitAndLossPage() {
    // Default to current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const initialData = await getProfitAndLossReport(start, end)
    const fiscalYears = await getFiscalYears()

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">Profit & Loss Statement</h1>
                <p className="text-stone-500 text-sm uppercase tracking-widest font-bold">Income & Expenditure Report</p>
            </div>

            <PnlViewer initialData={JSON.parse(JSON.stringify(initialData))} fiscalYears={JSON.parse(JSON.stringify(fiscalYears))} />
        </div>
    )
}
