'use server'

import { revalidatePath } from "next/cache"
import { erpFetch } from "@/lib/erp-api"

export async function getOrganizations() {
    try {
        const result = await erpFetch('organizations/')
        return Array.isArray(result) ? result : (result?.results || [])
    } catch (error: unknown) {
        if ((error instanceof Error ? error.message : String(error)) && (
            (error instanceof Error ? error.message : String(error)).includes('Authentication credentials') ||
            (error instanceof Error ? error.message : String(error)).includes('No organization context')
        )) {
            return []
        }
        console.error("[SaaS] Error fetching organizations:", error);
        return []
    }
}

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
