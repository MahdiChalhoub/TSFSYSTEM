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
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    try {
        const data = await erpFetch(`contacts/?type=${type}`)
        const all = Array.isArray(data) ? data : (data?.results ?? [])
        return all.filter((c: Record<string, any>) => c.type === type)
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
        if (data?.error) return { error: `Backend: ${data.error}`, detail: data.detail || null }
        return data
    } catch (e: any) {
        return { error: e?.message || 'Failed to load contact summary' }
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

// ── CONTACT TAGS ──────────────────────────────────────────────────────────

export async function getContactTags() {
    try {
        const data = await erpFetch('crm/contact-tags/')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createContactTag(data: unknown) {
    try {
        return await erpFetch('crm/contact-tags/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to create tag' }
    }
}

export async function updateContactTag(id: number, data: unknown) {
    try {
        return await erpFetch(`crm/contact-tags/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to update tag' }
    }
}

export async function deleteContactTag(id: number) {
    try {
        return await erpFetch(`crm/contact-tags/${id}/`, {
            method: 'DELETE'
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to delete tag' }
    }
}

// ── FOLLOW-UP CONTACTS ──────────────────────────────────────────────────

export async function getFollowUpContacts(status?: string) {
    try {
        const query = status ? `?followup_status=${status}` : ''
        const data = await erpFetch(`contacts/${query}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

// ── CONTACT PERSONS (Contact Book) ──────────────────────────────────────

export async function getContactPersons(contactId: number) {
    try {
        const data = await erpFetch(`crm/contact-persons/?contact=${contactId}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createContactPerson(data: Record<string, any>) {
    try {
        return await erpFetch('crm/contact-persons/', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to create contact person' }
    }
}

// ── INTERACTIONS (Timeline) ──────────────────────────────────────────────

export async function getInteractions(contactId: number) {
    try {
        const data = await erpFetch(`crm/interactions/?contact=${contactId}&ordering=-interaction_at`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createInteraction(data: Record<string, any>) {
    try {
        return await erpFetch('crm/interactions/', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to log interaction' }
    }
}

// ── ACTIVITIES (Scheduled Tasks) ─────────────────────────────────────────

export async function getActivitiesForContact(contactId: number) {
    try {
        const data = await erpFetch(`crm/activities/?contact=${contactId}&ordering=due_date`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createActivity(data: Record<string, any>) {
    try {
        return await erpFetch('crm/activities/', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to create activity' }
    }
}

export async function completeActivityById(id: number) {
    try {
        return await erpFetch(`crm/activities/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'DONE', completed_at: new Date().toISOString() }),
        })
    } catch (e: any) {
        return { error: e?.message || 'Failed to complete activity' }
    }
}