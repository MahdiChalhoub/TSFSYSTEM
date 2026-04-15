import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import FiscalYearsViewer from './viewer'

export default async function FiscalYearsPage() {
    const years = await getFiscalYears()

    return (
        <div className="h-full flex flex-col">
            <FiscalYearsViewer initialYears={JSON.parse(JSON.stringify(years))} />
        </div>
    )
}
