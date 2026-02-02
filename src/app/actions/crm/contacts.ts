'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getContactsByType(type: 'PARTNER' | 'SUPPLIER' | 'CUSTOMER') {
    try {
        return await erpFetch(`contacts/?type=${type}`);
    } catch (e) {
        console.error("Failed to fetch contacts:", e);
        return [];
    }
}

export async function searchContacts(query: string) {
    try {
        return await erpFetch(`contacts/?search=${query}`);
    } catch (e) {
        console.error("Failed to search contacts:", e);
        return [];
    }
}
