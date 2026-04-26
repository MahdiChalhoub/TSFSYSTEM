import { getFiscalYears } from '@/app/actions/finance/fiscal-year'
import { FiscalYearsGateway } from './FiscalYearsGateway'

export default async function FiscalYearsPage() {
    const years = await getFiscalYears()

    return (
        <div className="h-full flex flex-col">
            <FiscalYearsGateway initialYears={JSON.parse(JSON.stringify(years))} />
        </div>
    )
}
