import { getBalanceSheetReport } from '@/app/actions/finance/accounts'
import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import BalanceSheetViewer from '@/app/(privileged)/finance/reports/balance-sheet/viewer'
import { cookies } from 'next/headers'

export default async function BalanceSheetPage() {
    const cookieStore = await cookies()
    const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

    const now = new Date()
    const initialData = await getBalanceSheetReport(now, scope)
    const fiscalYears = await getFiscalYears()

    return (
        <BalanceSheetViewer
            initialData={JSON.parse(JSON.stringify(initialData))}
            fiscalYears={JSON.parse(JSON.stringify(fiscalYears))}
        />
    )
}
