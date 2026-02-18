import { erpFetch } from '@/lib/erp-fetch'
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
                <h1 className="text-2xl font-bold">Quotations & Proforma</h1>
                <p className="text-sm text-gray-500 mt-1">
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
