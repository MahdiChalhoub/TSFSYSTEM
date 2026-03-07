import React from 'react'
import ConsignmentManager from './manager'
import { getAvailableConsignmentStock, getPendingConsignmentItems, getConsignmentSettlements } from '@/app/actions/consignment'
import { getContacts } from '@/app/actions/crm/contacts'
import { Handshake, Package } from 'lucide-react'

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
 <div className="app-page p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Package size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Consignment <span className="text-app-primary">Hub</span>
          </h1>
        </div>
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
