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
/**
 * Fetches public product catalog for the storefront.
 */
export async function getPublicProducts(slug: string) {
    try {
        // We use a specific endpoint or filter by slug. 
        // For now, we'll fetch from a public-facing API or use a service account token if needed.
        // But since it's a "Storefront", we want it to be light.
        const res = await fetch(`http://127.0.0.1:8000/api/products/storefront/?organization_slug=${slug}`, {
            next: { revalidate: 300 } // Cache for 5 mins
        });
        if (!res.ok) return [];
        return await res.json();
    } catch (error) {
        console.error("[STOREFRONT] Failed to fetch products:", error);
        return [];
    }
}
