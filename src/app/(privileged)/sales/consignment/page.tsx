import React from 'react'
import ConsignmentManager from './manager'
import { getAvailableConsignmentStock, getPendingConsignmentItems, getConsignmentSettlements } from '@/app/actions/consignment'
import { getContacts } from '@/app/actions/crm/contacts'
import { Handshake } from 'lucide-react'

export default async function ConsignmentPage() {
 let availableStock: any = [], pendingItems: any = [], settlements: any = [], contacts: any = [];
 try {
 [availableStock, pendingItems, settlements, contacts] = await Promise.all([
 getAvailableConsignmentStock(),
 getPendingConsignmentItems(),
 getConsignmentSettlements(),
 getContacts()
 ]);
 } catch { }

 const suppliers = (contacts || []).filter((c: Record<string, any>) => c.type === 'SUPPLIER')

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex justify-between items-center">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
 <Handshake size={28} className="text-white" />
 </div>
 Consignment <span className="text-violet-600">Control</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Dépôt Vente · Supplier-Owned Stock & Settlements</p>
 </div>
 </header>

 <ConsignmentManager
 availableStock={availableStock}
 pendingItems={pendingItems}
 settlements={settlements}
 suppliers={suppliers}
 />
 </div>
 )
}
