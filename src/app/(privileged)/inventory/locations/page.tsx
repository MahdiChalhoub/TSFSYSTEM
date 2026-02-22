import { Metadata } from 'next'
import WarehouseLocationsPage from './page-client'

export const metadata: Metadata = {
    title: 'Location Management | Inventory',
    description: 'Manage warehouse zones, aisles, racks, shelves and bins with full location hierarchy.',
}

export default function Page() {
    return <WarehouseLocationsPage />
}
