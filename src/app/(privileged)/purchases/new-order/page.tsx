import { erpFetch } from "@/lib/erp-api";
import { getContactsByType } from "@/app/actions/crm/contacts";
import FormalOrderForm from "./form";
import { FileText } from "lucide-react";
import { serializeDecimals } from "@/lib/utils/serialization";

export const dynamic = 'force-dynamic';

async function getSitesAndWarehouses() {
 try {
 return await erpFetch('sites/?include_warehouses=true');
 } catch (e) {
 console.error("Failed to fetch sites", e);
 return [];
 }
}

export default async function NewFormalOrderPage() {
 const [suppliers, sites] = await Promise.all([
 getContactsByType('SUPPLIER'),
 getSitesAndWarehouses(),
 ]);

 return (
 <div className="space-y-6 animate-in fade-in duration-700">
 {/* Header */}
 <header>
 <h1 className="page-header-title tracking-tighter flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
 <FileText size={28} className="text-white" />
 </div>
 Request for <span className="text-indigo-500">Quotation</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Purchasing & Supplier Management</p>
 </header>

 <FormalOrderForm
 suppliers={serializeDecimals(suppliers)}
 sites={sites}
 />
 </div>
 );
}
