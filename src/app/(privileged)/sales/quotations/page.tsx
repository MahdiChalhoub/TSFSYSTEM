import { erpFetchJSON } from '@/lib/erp-fetch'
import { FileText } from 'lucide-react';
import QuotationManager from './manager'

interface Contact {
 id: number
 name: string
}

interface Product {
 id: number
 sku: string
 name: string
 selling_price_ttc: number
 tva_rate: number
}

interface QuotationLine {
 id: number
 product: number
 product_name: string
 product_sku: string
 quantity: number
 unit_price_ttc: number
 total_ttc: number
 discount: number
}

interface Quotation {
 id: number
 reference: string | null
 status: string
 contact_name: string | null
 contact: number | null
 total_ht: number
 total_tax: number
 total_ttc: number
 discount: number
 valid_until: string | null
 notes: string | null
 line_count: number
 converted_order: number | null
 created_at: string
 lines: QuotationLine[]
}

export default async function QuotationsPage() {
 let quotations: Quotation[] = []
 let contacts: Contact[] = []
 let products: Product[] = []

 try {
 const [qRes, cRes, pRes] = await Promise.all([
 erpFetchJSON<any>('/quotations/'),
 erpFetchJSON<any>('/contacts/'),
 erpFetchJSON<any>('/products/'),
 ])
 quotations = Array.isArray(qRes) ? qRes : (qRes as any)?.results || []
 contacts = Array.isArray(cRes) ? cRes : (cRes as any)?.results || []
 products = Array.isArray(pRes) ? pRes : (pRes as any)?.results || []
 } catch { /* empty */ }

 return (
 <div className="page-container">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
 <FileText size={28} className="text-app-text" />
 </div>
 Quote <span className="text-blue-600">Management</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Proposals & Estimates</p>
 </div>
 <QuotationManager
 initialQuotations={quotations}
 contacts={contacts}
 products={products}
 />
 </div>
 )
}
