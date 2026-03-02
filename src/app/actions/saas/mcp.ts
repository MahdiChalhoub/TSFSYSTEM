'use server'

/**
 * MCP AI Connector - Server Actions
 * =================================
 * Server-side functions for MCP API calls.
 */

import { erpFetch } from '@/lib/erp-api'
import { z } from 'zod'

const MCPProviderUpdateSchema = z.object({
 name: z.string().min(1).optional(),
 provider_type: z.string().optional(),
 api_key: z.string().optional(),
 api_base_url: z.string().url().optional().or(z.literal('')),
 model_name: z.string().optional(),
 max_tokens: z.number().int().positive().optional(),
 temperature: z.number().min(0).max(2).optional(),
 timeout_seconds: z.number().int().positive().optional(),
 is_default: z.boolean().optional(),
}).passthrough()

const MCPToolSchema = z.object({
 name: z.string().min(1, 'Tool name is required'),
 description: z.string().optional(),
 tool_type: z.string().optional(),
 endpoint_url: z.string().optional(),
 parameters_schema: z.record(z.any()).optional(),
 is_active: z.boolean().optional(),
}).passthrough()

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
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function updateMCPProvider(id: number, data: unknown) {
 const parsed = MCPProviderUpdateSchema.parse(data)
 try {
 const result = await erpFetch(`/mcp/providers/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(parsed)
 })
 return { success: true, data: result }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function deleteMCPProvider(id: number) {
 try {
 await erpFetch(`/mcp/providers/${id}/`, { method: 'DELETE' })
 return { success: true }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function testMCPProvider(id: number) {
 try {
 const result = await erpFetch(`/mcp/providers/${id}/test/`, { method: 'POST' })
 return result
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function setDefaultProvider(id: number) {
 try {
 await erpFetch(`/mcp/providers/${id}/set_default/`, { method: 'POST' })
 return { success: true }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
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

export async function createMCPTool(data: unknown) {
 const parsed = MCPToolSchema.parse(data)
 try {
 const result = await erpFetch('/mcp/tools/', {
 method: 'POST',
 body: JSON.stringify(parsed)
 })
 return { success: true, data: result }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function updateMCPTool(id: number, data: unknown) {
 const parsed = MCPToolSchema.partial().parse(data)
 try {
 const result = await erpFetch(`/mcp/tools/${id}/`, {
 method: 'PATCH',
 body: JSON.stringify(parsed)
 })
 return { success: true, data: result }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function deleteMCPTool(id: number) {
 try {
 await erpFetch(`/mcp/tools/${id}/`, { method: 'DELETE' })
 return { success: true }
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
 }
}

export async function registerDefaultTools() {
 try {
 const result = await erpFetch('/mcp/tools/register_defaults/', { method: 'POST' })
 return result
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
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
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
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
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
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
 } catch (e: unknown) {
 return { success: false, message: (e instanceof Error ? e.message : String(e)) }
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
