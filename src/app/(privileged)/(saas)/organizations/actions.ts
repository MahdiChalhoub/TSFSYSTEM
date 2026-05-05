'use server'

import { cache } from "react"
import { revalidatePath, revalidateTag } from "next/cache"
import { erpFetch } from "@/lib/erp-api"

// React.cache() — per-SSR-render dedup. Safe because it lives within one
// request scope and respects cookies/headers. The HTTP fetch inside is
// also tagged for cross-request caching (5 min, per-user via Authorization
// header). Do NOT use unstable_cache: erpFetch reads cookies(), which is
// unavailable in the cache runtime → 401 → NEXT_REDIRECT (auth loss).
export const getOrganizations = cache(async function getOrganizations() {
    try {
        return await erpFetch('organizations/', {
            next: { revalidate: 300, tags: ['organizations'] },
        } as any)
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('Authentication credentials') || msg.includes('No organization context')) {
            return []
        }
        console.error("[SaaS] Error fetching organizations:", error);
        return []
    }
})

export async function createOrganization(data: {
    name: string,
    slug: string,
    business_email?: string,
    phone?: string,
    country?: string,
    timezone?: string,
    business_type?: string,
}) {
    try {
        const result = await erpFetch('organizations/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        revalidatePath('/organizations')
        revalidatePath('/dashboard')
        revalidateTag('organizations')
        return result
    } catch (error: unknown) {
        console.error("CRITICAL: Organization Provisioning Failed", error);
        throw error;
    }
}

export async function toggleOrganizationStatus(id: string, currentStatus: boolean) {
    try {
        const result = await erpFetch(`organizations/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus })
        })
        revalidatePath('/organizations')
        revalidateTag('organizations')
        return result
    } catch (error) {
        console.error("Failed to toggle organization status:", error)
        throw error
    }
}

export async function deleteOrganization(id: string) {
    try {
        const result = await erpFetch(`organizations/${id}/`, {
            method: 'DELETE'
        })
        revalidatePath('/organizations')
        revalidatePath('/dashboard')
        revalidateTag('organizations')
        return result
    } catch (error) {
        console.error("Failed to delete organization:", error)
        throw error
    }
}

export async function getOrgPermissions(id: string) {
    try {
        return await erpFetch(`organizations/${id}/permissions_list/`)
    } catch (error) {
        console.error("Failed to get org permissions:", error)
        return {
            can_suspend: false,
            can_activate: false,
            can_delete: false,
            can_manage_features: false,
            can_edit: false,
            is_protected: true
        }
    }
}

export async function getBusinessTypes() {
    try {
        return await erpFetch('saas/org-modules/business_types/')
    } catch (error) {
        console.error("[SaaS] Error fetching business types:", error)
        return []
    }
}

export async function getCurrencies() {
    try {
        // We use the common currencies endpoint
        return await erpFetch('currencies/')
    } catch (error) {
        console.error("[SaaS] Error fetching currencies:", error)
        return []
    }
}
