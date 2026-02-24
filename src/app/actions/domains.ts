'use server'

import { erpFetch } from "@/lib/erp-api"

/**
 * Resolve a custom domain to an organization slug.
 * Used by middleware to route custom domain traffic.
 */
export async function resolveCustomDomain(domain: string): Promise<{
    slug: string
    domain_type: 'SHOP' | 'PLATFORM'
    organization_name: string
} | null> {
    try {
        const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000'
        const res = await fetch(`${djangoUrl}/api/domains/resolve/?domain=${encodeURIComponent(domain)}`, {
            cache: 'no-store',
        })
        if (!res.ok) return null
        return await res.json()
    } catch {
        return null
    }
}

/**
 * List custom domains for the current organization.
 */
export async function listCustomDomains() {
    try {
        const data = await erpFetch('domains/')
        return Array.isArray(data) ? data : (data?.results || [])
    } catch {
        return []
    }
}

/**
 * Add a new custom domain.
 */
export async function addCustomDomain(domain: string, domainType: 'SHOP' | 'PLATFORM') {
    try {
        const data = await erpFetch('domains/', {
            method: 'POST',
            body: JSON.stringify({ domain, domain_type: domainType }),
        })
        if (data?.id) {
            return { success: true, data }
        }
        // Extract first validation error from DRF response
        const firstError = data?.domain?.[0] || data?.organization?.[0] || data?.non_field_errors?.[0] || data?.detail || (typeof data === 'string' ? data : JSON.stringify(data))
        return { success: false, error: firstError || 'Failed to add domain' }
    } catch (err: any) {
        return { success: false, error: err.message || 'Network error' }
    }
}

/**
 * Remove a custom domain.
 */
export async function removeCustomDomain(id: string) {
    try {
        await erpFetch(`domains/${id}/`, { method: 'DELETE' })
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to remove domain' }
    }
}

/**
 * Verify a custom domain's DNS TXT record.
 */
export async function verifyCustomDomain(id: string) {
    try {
        const data = await erpFetch(`domains/${id}/verify/`, { method: 'POST' })
        return data
    } catch (err: any) {
        return { status: 'error', message: err.message || 'Verification failed' }
    }
}

/**
 * Set a domain as primary.
 */
export async function setPrimaryDomain(id: string) {
    try {
        const data = await erpFetch(`domains/${id}/set-primary/`, { method: 'POST' })
        return data
    } catch (err: any) {
        return { status: 'error', message: err.message || 'Failed to set primary' }
    }
}

/**
 * Trigger a CNAME check for a verified domain.
 */
export async function checkDomainCname(id: string) {
    try {
        const data = await erpFetch(`domains/${id}/check-cname/`, { method: 'POST' })
        return data
    } catch (err: any) {
        return { status: 'error', message: err.message || 'CNAME check failed' }
    }
}

/**
 * Trigger SSL provisioning for a verified domain.
 */
export async function requestDomainSsl(id: string) {
    try {
        const data = await erpFetch(`domains/${id}/provision-ssl/`, { method: 'POST' })
        return data
    } catch (err: any) {
        return { status: 'error', message: err.message || 'SSL provisioning failed' }
    }
}
