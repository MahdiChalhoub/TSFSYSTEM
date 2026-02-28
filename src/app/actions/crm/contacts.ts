'use server'

import { erpFetch } from "@/lib/erp-api"
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
    } catch {
        return []
    }
}

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    try {
        const all = await erpFetch('contacts/')
        return Array.isArray(all) ? all.filter((c: Record<string, any>) => c.type === type) : []
    } catch {
        return []
    }
}

export async function getContact(id: number) {
    try {
        return await erpFetch(`contacts/${id}/`)
    } catch {
        return null
    }
}

export async function getContactSummary(contactId: number) {
    try {
        const data = await erpFetch(`contacts/${contactId}/summary/`)
        // Backend returns {error, detail} on 5xx
        if (data?.error) throw new Error(`Backend: ${data.error}`)
        return data
    } catch (e: unknown) {
        throw e  // Re-throw so loadData's catch can show a toast
    }
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

export async function searchContacts(query: string = '', limit: number = 20) {
    try {
        const queryParams = new URLSearchParams();
        if (query) queryParams.append('search', query);
        queryParams.append('limit', String(limit));
        // POS should only show clients (customers), not suppliers or other contact types
        queryParams.append('type', 'CUSTOMER');

        const data = await erpFetch(`contacts/?${queryParams.toString()}`);
        return Array.isArray(data) ? data : (data?.results || []);
    } catch {
        return [];
    }
}