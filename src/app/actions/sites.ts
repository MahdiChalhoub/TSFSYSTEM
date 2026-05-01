'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"
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
        return result.map((site: Record<string, any>) => ({
            ...site,
            _count: {
                warehouses: 0, // Django doesn't provide this by default, but we can add it later if needed
                users: 0
            }
        }))
    } catch (error: unknown) {
        handleAuthError(error)
        // Suppress auth errors or 404s (e.g. valid for root domain or logged out state)
        // We just return empty list so the Layout doesn't crash
        if ((error instanceof Error ? error.message : String(error)) && (
            (error instanceof Error ? error.message : String(error)).includes('Authentication credentials') ||
            (error instanceof Error ? error.message : String(error)).includes('Not Found') ||
            (error instanceof Error ? error.message : String(error)).includes('No organization context')
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
        revalidatePath('/settings/sites');
        return { message: 'success' };
    } catch (e: unknown) {
        return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) };
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
        revalidatePath('/settings/sites');
        return { message: 'success' };
    } catch (e: unknown) {
        return { message: 'Database Error: ' + (e instanceof Error ? e.message : String(e)) };
    }
}

export async function deleteSite(id: number) {
    try {
        await erpFetch(`sites/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/settings/sites');
        return { success: true };
    } catch (e: unknown) {
        return { success: false, message: (e instanceof Error ? e.message : String(e)) };
    }
}
