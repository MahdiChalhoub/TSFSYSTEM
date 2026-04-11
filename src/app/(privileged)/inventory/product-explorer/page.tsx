export const dynamic = 'force-dynamic'

import { getExplorerData } from "@/app/actions/inventory/explorer"
import ExplorerClient from "./ExplorerClient"

export default async function ProductExplorerPage() {
    const data = await getExplorerData()
    return <ExplorerClient data={data} />
}
