'use server'

import { revalidatePath } from "next/cache"

import { erpFetch } from "@/lib/erp-api"

export async function getOrganizations() {
    try {
        return await erpFetch('organizations/')
    } catch (error: any) {
        // Suppress auth or context errors (expected for unauthenticated users or during SaaS root layout load)
        if (error.message && (
            error.message.includes('Authentication credentials') ||
            error.message.includes('No organization context')
        )) {
            return []
        }
        console.error("[SaaS] Error fetching organizations:", error);
        return []
    }
}

export async function createOrganization(data: { name: string, slug: string }) {
    try {
        const result = await erpFetch('organizations/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        revalidatePath('/saas/organizations')
        revalidatePath('/saas/dashboard')
        return result
    } catch (error: any) {
        console.error("CRITICAL: Organization Provisioning Failed", error);
        throw error;
    }
}

export async function toggleOrganizationStatus(id: string, currentStatus: boolean) {
    try {
        await erpFetch(`organizations/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus })
        })
        revalidatePath('/saas/organizations')
    } catch (error) {
        console.error("Failed to toggle organization status:", error)
    }
}
