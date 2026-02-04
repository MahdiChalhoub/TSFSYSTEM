'use server'

/**
 * Server Actions for Connector Module
 * =====================================
 * Data fetching and mutations for the Connector admin panel.
 */

import { erpFetch } from '@/lib/erp-api'

// =============================================================================
// DASHBOARD & STATES
// =============================================================================

export async function getConnectorDashboard() {
    try {
        const res = await erpFetch('connector/dashboard/')
        return res
    } catch (e) {
        console.error('Failed to fetch connector dashboard:', e)
        return {
            summary: { total_modules: 0, active_policies: 0, contracts_registered: 0 },
            buffer_stats: { pending: 0, replayed: 0, failed: 0, expired: 0 },
            decision_distribution: {},
            recent_logs: []
        }
    }
}

export async function getModuleStates(organizationId?: number) {
    try {
        const url = organizationId
            ? `connector/states/?organization_id=${organizationId}`
            : 'connector/states/'
        return await erpFetch(url) || []
    } catch (e) {
        console.error('Failed to fetch module states:', e)
        return []
    }
}

// =============================================================================
// POLICIES
// =============================================================================

export async function getConnectorPolicies() {
    try {
        return await erpFetch('connector/policies/') || []
    } catch (e) {
        console.error('Failed to fetch policies:', e)
        return []
    }
}

export async function createConnectorPolicy(data: {
    target_module: string
    target_endpoint: string
    when_missing_read: string
    when_missing_write: string
    when_disabled_read: string
    when_disabled_write: string
    when_unauthorized_read: string
    when_unauthorized_write: string
    cache_ttl_seconds?: number
    buffer_ttl_seconds?: number
    max_buffer_size?: number
    priority?: number
}) {
    try {
        const res = await erpFetch('connector/policies/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return { success: true, data: res }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to create policy' }
    }
}

export async function updateConnectorPolicy(id: number, data: Record<string, unknown>) {
    try {
        const res = await erpFetch(`connector/policies/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
        return { success: true, data: res }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to update policy' }
    }
}

export async function deleteConnectorPolicy(id: number) {
    try {
        await erpFetch(`connector/policies/${id}/`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to delete policy' }
    }
}

// =============================================================================
// BUFFERED REQUESTS
// =============================================================================

export async function getBufferedRequests(filters?: {
    module?: string
    status?: string
    organization?: number
}) {
    try {
        const params = new URLSearchParams()
        if (filters?.module) params.append('module', filters.module)
        if (filters?.status) params.append('status', filters.status)
        if (filters?.organization) params.append('organization', String(filters.organization))

        const url = `connector/buffer/?${params.toString()}`
        return await erpFetch(url) || []
    } catch (e) {
        console.error('Failed to fetch buffered requests:', e)
        return []
    }
}

export async function retryBufferedRequest(id: number) {
    try {
        const res = await erpFetch(`connector/buffer/${id}/retry/`, {
            method: 'POST'
        })
        return { success: true, data: res }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to retry request' }
    }
}

export async function replayAllBuffered(module: string, organizationId: number) {
    try {
        const res = await erpFetch('connector/buffer/replay_all/', {
            method: 'POST',
            body: JSON.stringify({ module, organization_id: organizationId })
        })
        return { success: true, data: res }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to replay buffers' }
    }
}

export async function cleanupExpiredBuffers() {
    try {
        const res = await erpFetch('connector/buffer/cleanup_expired/', {
            method: 'POST'
        })
        return { success: true, data: res }
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to cleanup' }
    }
}

// =============================================================================
// LOGS
// =============================================================================

export async function getConnectorLogs(filters?: {
    module?: string
    decision?: string
    organization?: number
    from?: string
    to?: string
}) {
    try {
        const params = new URLSearchParams()
        if (filters?.module) params.append('module', filters.module)
        if (filters?.decision) params.append('decision', filters.decision)
        if (filters?.organization) params.append('organization', String(filters.organization))
        if (filters?.from) params.append('from', filters.from)
        if (filters?.to) params.append('to', filters.to)

        const url = `connector/logs/?${params.toString()}`
        return await erpFetch(url) || []
    } catch (e) {
        console.error('Failed to fetch logs:', e)
        return []
    }
}

// =============================================================================
// CONTRACTS
// =============================================================================

export async function getModuleContracts() {
    try {
        return await erpFetch('connector/contracts/') || []
    } catch (e) {
        console.error('Failed to fetch contracts:', e)
        return []
    }
}
