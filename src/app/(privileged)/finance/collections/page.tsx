import { getOverdueCustomers } from '@/app/actions/finance/collections'
import { CollectionsClient } from './CollectionsClient'

export default async function CollectionsPage() {
    const report = await getOverdueCustomers()
    return (
        <div className="h-full flex flex-col">
            <CollectionsClient initialReport={JSON.parse(JSON.stringify(report))} />
        </div>
    )
}
