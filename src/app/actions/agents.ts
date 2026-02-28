'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export async function getAgents() {
    try {
        const result = await erpFetch('mcp/agents/')
        return Array.isArray(result) ? result : (result?.results || [])
    } catch (e) {
        console.error("Failed to fetch agents:", e)
        return []
    }
}

export async function getAgentLogs(agentId?: number) {
    try {
        const query = agentId ? `?agent_id=${agentId}` : ''
        const result = await erpFetch(`mcp/agent-logs/${query}`)
        return Array.isArray(result) ? result : (result?.results || [])
    } catch (e) {
        console.error("Failed to fetch agent logs:", e)
        return []
    }
}

export async function updateAgent(id: number, data: any) {
    try {
        const result = await erpFetch(`mcp/agents/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/mcp/agents')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function runAgentNow(id: number) {
    try {
        const result = await erpFetch(`mcp/agents/${id}/run_now/`, {
            method: 'POST'
        })
        revalidatePath('/mcp/agents')
        return { success: true, data: result }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
