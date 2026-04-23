import { getProfitAndLossReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import PnlViewer from '@/app/(privileged)/finance/reports/pnl/viewer'
import { cookies } from 'next/headers'

export default async function ProfitAndLossPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Prior period = previous calendar month of the same length as current
    const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const priorEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const [initialData, priorData, fiscalYears] = await Promise.all([
        getProfitAndLossReport(start, end, scope),
        getProfitAndLossReport(priorStart, priorEnd, scope),
        getFiscalYears(),
    ])

    return (
        <PnlViewer
            initialData={JSON.parse(JSON.stringify(initialData))}
            initialPriorData={JSON.parse(JSON.stringify(priorData))}
            fiscalYears={JSON.parse(JSON.stringify(fiscalYears))}
        />
    )
}
