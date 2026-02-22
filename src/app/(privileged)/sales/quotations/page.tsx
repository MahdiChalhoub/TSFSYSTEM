import { erpFetch } from '@/lib/erp-fetch'
import { FileText } from 'lucide-react';
import QuotationManager from './manager'

interface Contact {
    id: number
    name: string
}

interface Quotation {
    id: number
    reference: string | null
    status: string
    contact_name: string | null
    user_name: string | null
    total_ht: number
    total_tax: number
    total_ttc: number
    discount: number
    valid_until: string | null
    notes: string | null
    line_count: number
    converted_order: number | null
    created_at: string
    lines: Record<string, any>[]
}

export default async function QuotationsPage() {
    let quotations: Quotation[] = []
    let contacts: Contact[] = []
    let products: Record<string, any>[] = []

    try {
        const [qRes, cRes, pRes] = await Promise.all([
            erpFetch('/quotations/'),
            erpFetch('/contacts/'),
            erpFetch('/products/'),
        ])
        quotations = Array.isArray(qRes) ? qRes : qRes.results || []
        contacts = Array.isArray(cRes) ? cRes : cRes.results || []
        products = Array.isArray(pRes) ? pRes : pRes.results || []
    } catch { /* empty */ }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <FileText size={28} className="text-white" />
                    </div>
                    Quote <span className="text-blue-600">Management</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Proposals & Estimates</p>
                    Create proformas, manage line items, and convert accepted quotations into sale orders.
                </p>
            </div>
            <QuotationManager
                initialQuotations={quotations}
                contacts={contacts}
                products={products}
            />
        </div>
    )
}
