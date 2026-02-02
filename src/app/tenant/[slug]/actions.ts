'use server'

import { erpFetch } from "@/lib/erp-api"

/**
 * Fetches organization data by slug to establish tenant context.
 * Used for routing, branding, and security isolation.
 */
export async function getOrganizationBySlug(slug: string) {
    try {
        const response = await erpFetch(`tenant/resolve/?slug=${slug}`);
        if (!response || response.error) return null;

        // Map backend response to frontend expectation
        return {
            ...response,
            isActive: true, // Assuming if resolved it is active
            _count: { sites: 0, users: 0 } // dummy counts or enhance API later
        }
    } catch (error) {
        console.error("[TENANT_CONTEXT] Failed to fetch org:", error)
        return null
    }
}

/**
 * Validates if the current request is coming from a valid tenant.
 */
export async function validateTenantAccess(slug: string) {
    const org = await getOrganizationBySlug(slug)
    if (!org || (org as any).error) return false
    return true
}
