'use server'

import { erpFetch } from "@/lib/erp-api"

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
        return Array.isArray(all) ? all.filter((c: any) => c.type === type) : []
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
    return await erpFetch(`contacts/${contactId}/summary/`)
}

export async function createContact(data: any) {
    return await erpFetch('contacts/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

export async function updateContact(id: number, data: any) {
    return await erpFetch(`contacts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

export async function deleteContact(id: number) {
    return await erpFetch(`contacts/${id}/`, {
        method: 'DELETE'
    })
}