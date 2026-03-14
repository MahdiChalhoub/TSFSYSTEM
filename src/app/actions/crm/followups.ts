'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ── RELATIONSHIP ASSIGNMENTS ──────────────────────────────────────────────

export async function getAssignments(contactId?: number) {
    const query = contactId ? `?contact=${contactId}` : ''
    try {
        const data = await erpFetch(`relationship-assignments/${query}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function assignRelationship(data: any) {
    try {
        const res = await erpFetch('relationship-assignments/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath(`/crm/contacts/${data.contact}`, 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

// ── FOLLOW-UP POLICIES ───────────────────────────────────────────────────

export async function getPolicies(contactId?: number) {
    const query = contactId ? `?contact=${contactId}` : ''
    try {
        const data = await erpFetch(`followup-policies/${query}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createPolicy(data: any) {
    try {
        const res = await erpFetch('followup-policies/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath(`/crm/contacts/${data.contact}`, 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function updatePolicy(id: number, data: any) {
    try {
        const res = await erpFetch(`followup-policies/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
        revalidatePath('/crm/contacts', 'layout')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function triggerPolicyTask(id: number) {
    try {
        return await erpFetch(`followup-policies/${id}/trigger_task/`, {
            method: 'POST'
        })
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function runPolicyScan() {
    try {
        const res = await erpFetch('followup-policies/run_scan/', {
            method: 'POST'
        })
        revalidatePath('/crm/followups', 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

// ── SCHEDULED ACTIVITIES ─────────────────────────────────────────────────

export async function getActivities(params?: Record<string, string>) {
    const qp = new URLSearchParams(params)
    try {
        const data = await erpFetch(`activities/?${qp.toString()}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function completeActivity(id: number, outcome: string, notes: string) {
    try {
        const res = await erpFetch(`activities/${id}/complete/`, {
            method: 'POST',
            body: JSON.stringify({ outcome, notes })
        })
        revalidatePath('/crm/contacts/[id]', 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function rescheduleActivity(id: number, data: { new_date: string, reason: string }) {
    try {
        const res = await erpFetch(`activities/${id}/reschedule/`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/crm/contacts/[id]', 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function getActivityStats() {
    try {
        return await erpFetch('activities/dashboard_stats/')
    } catch {
        return { due_today: 0, overdue: 0, upcoming: 0, completed_today: 0 }
    }
}

// ── INTERACTION LOGS ──────────────────────────────────────────────────────

export async function getInteractions(contactId?: number) {
    const query = contactId ? `?contact=${contactId}` : ''
    try {
        const data = await erpFetch(`interactions/${query}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function recordInteraction(data: any) {
    try {
        const res = await erpFetch('interactions/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath('/crm/contacts/[id]', 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}

// ── SUPPLIER PRODUCT POLICIES ─────────────────────────────────────────────

export async function getSupplierProductPolicies(supplierId?: number) {
    const query = supplierId ? `?supplier=${supplierId}` : ''
    try {
        const data = await erpFetch(`supplier-product-policies/${query}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
        return []
    }
}

export async function createSupplierProductPolicy(data: any) {
    try {
        const res = await erpFetch('supplier-product-policies/', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        revalidatePath(`/crm/contacts/${data.supplier}`, 'page')
        return res
    } catch (e: any) {
        return { error: e.message }
    }
}
