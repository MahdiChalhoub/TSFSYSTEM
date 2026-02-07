'use server'

/**
 * CRM Module - Contacts Actions (Stub)
 * These are placeholder exports for when CRM module is not installed.
 * Returns empty data gracefully.
 */

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    // Stub: Return empty when CRM module not installed
    return []
}

export async function getContacts() {
    return []
}

export async function getContact(id: number) {
    return null
}

export async function createContact(data: any) {
    throw new Error('CRM module not installed')
}

export async function updateContact(id: number, data: any) {
    throw new Error('CRM module not installed')
}

export async function deleteContact(id: number) {
    throw new Error('CRM module not installed')
}