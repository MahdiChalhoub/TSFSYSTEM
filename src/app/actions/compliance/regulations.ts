'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

const BASE = 'compliance/regulations'
const RULES_BASE = 'compliance/rules'
const AUDIT_BASE = 'compliance/audit-log'

// ── Price Regulation CRUD ──

export async function listRegulations(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return erpFetch(`${BASE}/${qs}`)
}

export async function getRegulation(id: number) {
    return erpFetch(`${BASE}/${id}/`)
}

export async function createRegulation(data: Record<string, any>) {
    const res = await erpFetch(`${BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function updateRegulation(id: number, data: Record<string, any>) {
    const res = await erpFetch(`${BASE}/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function deleteRegulation(id: number) {
    const res = await erpFetch(`${BASE}/${id}/`, { method: 'DELETE' })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function createNewVersion(id: number, data: Record<string, any>) {
    const res = await erpFetch(`${BASE}/${id}/new-version/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function getComplianceSummary() {
    return erpFetch(`${BASE}/summary/`)
}

export async function runBulkCheck(autoFix: boolean = false) {
    const res = await erpFetch(`${BASE}/bulk-check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_fix: autoFix }),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

// ── Regulation Rules CRUD ──

export async function listRules(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return erpFetch(`${RULES_BASE}/${qs}`)
}

export async function createRule(data: Record<string, any>) {
    const res = await erpFetch(`${RULES_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function updateRule(id: number, data: Record<string, any>) {
    const res = await erpFetch(`${RULES_BASE}/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function deleteRule(id: number) {
    const res = await erpFetch(`${RULES_BASE}/${id}/`, { method: 'DELETE' })
    revalidatePath('/inventory/price-regulations')
    return res
}

export async function previewRuleMatches(ruleId: number) {
    return erpFetch(`${RULES_BASE}/${ruleId}/preview-matches/`)
}

// ── Audit Log (read-only) ──

export async function listAuditLogs(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return erpFetch(`${AUDIT_BASE}/${qs}`)
}
