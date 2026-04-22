import { AttributesClient } from './AttributesClient'

export const dynamic = 'force-dynamic'

export default async function AttributesPage() {
    // Data is fetched client-side via the Attributes tree endpoint so the
    // template can refresh after mutations without a server round-trip.
    return <AttributesClient />
}
