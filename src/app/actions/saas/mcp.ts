'use server'

/**
 * MCP AI Connector - Server Actions
 * =================================
 * Server-side functions for MCP API calls.
 */

import { erpFetch } from '@/lib/erp-api'

// =============================================================================
// PROVIDERS
// =============================================================================

export async function getMCPProviders() {
    const res = await erpFetch('/mcp/providers/')
    return res.results || res
}

export async function getMCPProvider(id: number) {
    return await erpFetch(`/mcp/providers/${id}/`)
}

export async function createMCPProvider(data: {
    name: string
    provider_type: string
    api_key?: string
    api_base_url?: string
    model_name?: string
    max_tokens?: number
    temperature?: number
    timeout_seconds?: number
}) {
    try {
        const result = await erpFetch('/mcp/providers/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function updateMCPProvider(id: number, data: any) {
    try {
        const result = await erpFetch(`/mcp/providers/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteMCPProvider(id: number) {
    try {
        await erpFetch(`/mcp/providers/${id}/`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function testMCPProvider(id: number) {
    try {
        const result = await erpFetch(`/mcp/providers/${id}/test/`, { method: 'POST' })
        return result
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

export async function setDefaultProvider(id: number) {
    try {
        await erpFetch(`/mcp/providers/${id}/set_default/`, { method: 'POST' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// =============================================================================
// TOOLS
// =============================================================================

export async function getMCPTools() {
    const res = await erpFetch('/mcp/tools/')
    return res.results || res
}

export async function getMCPTool(id: number) {
    return await erpFetch(`/mcp/tools/${id}/`)
}

export async function createMCPTool(data: any) {
    try {
        const result = await erpFetch('/mcp/tools/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function updateMCPTool(id: number, data: any) {
    try {
        const result = await erpFetch(`/mcp/tools/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteMCPTool(id: number) {
    try {
        await erpFetch(`/mcp/tools/${id}/`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function registerDefaultTools() {
    try {
        const result = await erpFetch('/mcp/tools/register_defaults/', { method: 'POST' })
        return result
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// =============================================================================
// CHAT
// =============================================================================

export async function sendMCPChat(data: {
    message: string
    conversation_id?: number
    provider_id?: number
    include_tools?: boolean
}) {
    try {
        const result = await erpFetch('/mcp/chat/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return { success: true, ...result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function executeMCPTool(data: {
    tool_name: string
    arguments: Record<string, any>
}) {
    try {
        const result = await erpFetch('/mcp/tools/execute/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        return result
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// =============================================================================
// CONVERSATIONS
// =============================================================================

export async function getMCPConversations() {
    const res = await erpFetch('/mcp/conversations/')
    return res.results || res
}

export async function getMCPConversation(id: number) {
    return await erpFetch(`/mcp/conversations/${id}/`)
}

export async function getMCPConversationMessages(id: number) {
    return await erpFetch(`/mcp/conversations/${id}/messages/`)
}

export async function deleteMCPConversation(id: number) {
    try {
        await erpFetch(`/mcp/conversations/${id}/`, { method: 'DELETE' })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getMCPDashboard() {
    return await erpFetch('/mcp/dashboard/')
}

// =============================================================================
// USAGE
// =============================================================================

export async function getMCPUsageLogs(params?: { start_date?: string; end_date?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.start_date) searchParams.set('start_date', params.start_date)
    if (params?.end_date) searchParams.set('end_date', params.end_date)

    const query = searchParams.toString()
    const res = await erpFetch(`/mcp/usage/${query ? '?' + query : ''}`)
    return res.results || res
}
