import React from 'react'
import ConsignmentManager from './manager'
import { getAvailableConsignmentStock, getPendingConsignmentItems, getConsignmentSettlements } from '@/app/actions/consignment'
import { getContacts } from '@/app/actions/crm'

export default async function ConsignmentPage() {
    const [availableStock, pendingItems, settlements, contacts] = await Promise.all([
        getAvailableConsignmentStock(),
        getPendingConsignmentItems(),
        getConsignmentSettlements(),
        getContacts()
    ])

    const suppliers = contacts.filter((c: any) => c.type === 'SUPPLIER')

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Consignment Management</h1>
                    <p className="text-muted-foreground">Depot Vente: Manage supplier-owned stock and settlements.</p>
                </div>
            </div>

            <ConsignmentManager
                availableStock={availableStock}
                pendingItems={pendingItems}
                settlements={settlements}
                suppliers={suppliers}
            />
        </div>
    )
}
