'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export type SiteState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
    };
};

export async function getSites() {
    try {
        const result = await erpFetch('sites/')
        return result.map((site: any) => ({
            ...site,
            _count: {
                warehouses: 0, // Django doesn't provide this by default, but we can add it later if needed
                users: 0
            }
        }))
    } catch (error: any) {
        // Suppress auth errors or 404s (e.g. valid for root domain or logged out state)
        // We just return empty list so the Layout doesn't crash
        if (error.message && (
            error.message.includes('Authentication credentials') ||
            error.message.includes('Not Found') ||
            error.message.includes('No organization context')
        )) {
            return []
        }
        console.error("Failed to fetch sites:", error)
        return []
    }
}

export async function initializeMultiSite() {
    // Migration logic should be on backend. 
    // For compatibility with old code, we return success.
    return { success: true, siteId: 1 };
}

export async function createSite(prevState: SiteState, formData: FormData): Promise<SiteState> {
    const data = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string)?.toUpperCase(),
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        phone: formData.get('phone') as string,
        vat_number: formData.get('vatNumber') as string, // snake_case for Django
        is_active: formData.get('isActive') === 'on'
    }

    if (!data.name || data.name.length < 2) {
        return { message: 'Validation Error', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await erpFetch('sites/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/admin/settings/sites');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function updateSite(id: number, prevState: SiteState, formData: FormData): Promise<SiteState> {
    const data = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string)?.toUpperCase(),
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        phone: formData.get('phone') as string,
        vat_number: formData.get('vatNumber') as string,
        is_active: formData.get('isActive') === 'on'
    }

    try {
        await erpFetch(`sites/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/admin/settings/sites');
        return { message: 'success' };
    } catch (e: any) {
        return { message: 'Database Error: ' + e.message };
    }
}

export async function deleteSite(id: number) {
    try {
        await erpFetch(`sites/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/admin/settings/sites');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
