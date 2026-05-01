'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"
import { z } from 'zod'

const ContactSchema = z.object({
    name: z.string().min(1, 'Contact name is required'),
    type: z.enum(['PARTNER', 'SUPPLIER', 'CUSTOMER']).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    company: z.string().optional(),
    tax_id: z.string().optional(),
    notes: z.string().optional(),
}).passthrough()

export async function getContacts() {
    try {
        const data = await erpFetch('contacts/')
        return Array.isArray(data) ? data : []
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    try {
        const all = await erpFetch('contacts/')
        return Array.isArray(all) ? all.filter((c: Record<string, any>) => c.type === type) : []
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

export async function getContact(id: number) {
    try {
        return await erpFetch(`contacts/${id}/`)
    } catch (error) {
        handleAuthError(error)
        return null
    }
}

export async function getContactSummary(contactId: number) {
    return await erpFetch(`contacts/${contactId}/summary/`)
}

export async function createContact(data: unknown) {
    const parsed = ContactSchema.parse(data)
    return await erpFetch('contacts/', {
        method: 'POST',
        body: JSON.stringify(parsed)
    })
}

export async function updateContact(id: number, data: unknown) {
    const parsed = ContactSchema.partial().parse(data)
    return await erpFetch(`contacts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(parsed)
    })
}

export async function deleteContact(id: number) {
    return await erpFetch(`contacts/${id}/`, {
        method: 'DELETE'
    })
}
export async function getContactTags() {
    return await erpFetch('crm/tags/');
}
export async function createContactTag(data: unknown) {
    return await erpFetch('crm/tags/', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateContactTag(id: number, data: unknown) {
    return await erpFetch(`crm/tags/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteContactTag(id: number) {
    return await erpFetch(`crm/tags/${id}/`, { method: 'DELETE' });
}
export async function getFollowUpContacts(params?: unknown) {
    return await erpFetch('crm/contacts/follow-ups/');
}

export async function searchContacts(query: string) {
    try {
        const data = await erpFetch(`contacts/?search=${encodeURIComponent(query)}`)
        return Array.isArray(data) ? data : (data as any)?.results || []
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

export async function getSupplierScorecard(supplierId: number) {
    if (!supplierId) return null
    try {
        return await erpFetch(`contacts/${supplierId}/scorecard/`)
    } catch (error) {
        handleAuthError(error)
        console.error("Failed to fetch supplier scorecard:", error)
        return null
    }
}
