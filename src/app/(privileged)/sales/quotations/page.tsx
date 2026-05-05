import { erpFetch } from '@/lib/erp-api'
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
    let quotations: any[] = []
    let contacts: any[] = []
    let products: any[] = []

    try {
        const [qRes, cRes, pRes] = await Promise.all([
            erpFetch('/quotations/'),
            erpFetch('/contacts/'),
            erpFetch('/products/'),
        ])
        quotations = Array.isArray(qRes) ? qRes : (qRes as any)?.results || []
        contacts = Array.isArray(cRes) ? cRes : (cRes as any)?.results || []
        products = Array.isArray(pRes) ? pRes : (pRes as any)?.results || []
    } catch { /* empty */ }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1>Quotations & Proforma</h1>
                <p className="text-sm text-app-muted-foreground mt-1">
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
