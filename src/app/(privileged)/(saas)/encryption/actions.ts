'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getOrganizations() {
    try {
        const data = await erpFetch('organizations/')
        return Array.isArray(data) ? data : (data?.results || [])
    } catch (error) {
        console.error('[Encryption] Error fetching orgs:', error)
        return []
    }
}

export async function getEncryptionStatus() {
    try {
        return await erpFetch('saas/modules/encryption/status/')
    } catch (error) {
        console.error('[Encryption] Error fetching status:', error)
        return null
    }
}

export async function activateEncryption(organizationId: string) {
    try {
        return await erpFetch('saas/modules/encryption/activate/', {
            method: 'POST',
            body: JSON.stringify({
                organization_id: organizationId,
                force: true
            }),
        })
    } catch (error: unknown) {
        console.error('[Encryption] Error activating:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to activate encryption' }
    }
}

export async function deactivateEncryption(organizationId: string) {
    try {
        return await erpFetch('saas/modules/encryption/deactivate/', {
            method: 'POST',
            body: JSON.stringify({ organization_id: organizationId }),
        })
    } catch (error: unknown) {
        console.error('[Encryption] Error deactivating:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate encryption' }
    }
}

export async function rotateEncryptionKey(organizationId: string) {
    try {
        return await erpFetch('saas/modules/encryption/rotate-key/', {
            method: 'POST',
            body: JSON.stringify({ organization_id: organizationId }),
        })
    } catch (error: unknown) {
        console.error('[Encryption] Error rotating key:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Failed to rotate key' }
    }
}
