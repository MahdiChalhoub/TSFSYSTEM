'use server'


import { handleAuthError } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ─── V1 Types (kept for backward compat) ──────────────────────────────────

export type PostingRulesConfig = {
    sales: { receivable: number | null; revenue: number | null; cogs: number | null; inventory: number | null }
    purchases: { payable: number | null; inventory: number | null; tax: number | null }
    inventory: { adjustment: number | null; transfer: number | null }
    automation: { customerRoot: number | null; supplierRoot: number | null; payrollRoot: number | null }
    fixedAssets: { depreciationExpense: number | null; accumulatedDepreciation: number | null }
    suspense: { reception: number | null }
    partners: { capital: number | null; loan: number | null; withdrawal: number | null }
}

// ─── V2 Types ─────────────────────────────────────────────────────────────

export type PostingRuleV2 = {
    id: number
    event_code: string
    account: number        // FK id (Django serializer returns 'account' not 'account_id')
    account_code: string
    account_name: string
    module: string
    source: string
    description: string
    is_active: boolean
}

export type CatalogEvent = {
    code: string
    label: string
    description: string
    criticality: string
    normal_balance: string
    document_type: string
    line_role: string
}

export type CatalogModule = {
    key: string
    label: string
    events: CatalogEvent[]
}

export type AutoDetectResult = {
    matched: boolean
    account_id: number | null
    account_code: string
    account_name: string
    confidence: number
    strategy: string
}

export type CompletenessReport = {
    total_events: number
    mapped_events: number
    coverage_pct: number
    unmapped: string[]
    by_criticality: Record<string, { total: number; mapped: number }>
}

// ─── V1 Actions (legacy JSON config) ──────────────────────────────────────

export async function getPostingRules(): Promise<PostingRulesConfig> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('settings/posting_rules/')
    } catch {
        return {
            sales: { receivable: null, revenue: null, cogs: null, inventory: null },
            purchases: { payable: null, inventory: null, tax: null },
            inventory: { adjustment: null, transfer: null },
            automation: { customerRoot: null, supplierRoot: null, payrollRoot: null },
            fixedAssets: { depreciationExpense: null, accumulatedDepreciation: null },
            suspense: { reception: null },
            partners: { capital: null, loan: null, withdrawal: null },
        }
    }
}

export async function savePostingRules(config: PostingRulesConfig) {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('settings/posting_rules/', {
            method: 'POST',
            body: JSON.stringify(config),
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch {
        return { success: false }
    }
}

export async function applySmartPostingRules() {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('settings/smart_apply/', { method: 'POST' })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch {
        return { success: false }
    }
}

// ─── V2 Actions (PostingRule model-based) ─────────────────────────────────

export async function getPostingRulesByModule(): Promise<Record<string, PostingRuleV2[]>> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('posting-rules/by-module/')
    } catch (error) {
        handleAuthError(error)
        return {}
    }
}

export async function getEventCatalog(): Promise<{ modules: CatalogModule[]; total_events: number }> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('posting-rules/event-catalog/')
    } catch {
        return { modules: [], total_events: 0 }
    }
}

export async function autoDetectRules(): Promise<{ results: Record<string, AutoDetectResult>; summary: any }> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('posting-rules/auto-detect/')
    } catch {
        return { results: {}, summary: {} }
    }
}

export async function autoDetectAndApply(minConfidence: number = 70): Promise<{ applied: number; summary: any; message: string }> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        const result = await erpFetch('posting-rules/auto-detect-apply/', {
            method: 'POST',
            body: JSON.stringify({ min_confidence: minConfidence }),
        })
        revalidatePath('/finance/settings/posting-rules')
        return result
    } catch {
        return { applied: 0, summary: {}, message: 'Auto-detect failed' }
    }
}

export async function bulkSaveRules(
    rules: { event_code: string; account_id: number }[],
    reason?: string,
): Promise<{ created: number; updated: number; skipped: number; errors: string[]; message: string }> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        const result = await erpFetch('posting-rules/bulk-save/', {
            method: 'POST',
            body: JSON.stringify({ rules, reason: reason || 'Saved from posting rules console' }),
        })
        revalidatePath('/finance/settings/posting-rules')
        return result
    } catch {
        return { created: 0, updated: 0, skipped: 0, errors: ['Save failed'], message: 'Error' }
    }
}

export async function getCompleteness(): Promise<CompletenessReport> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('posting-rules/completeness/')
    } catch {
        return { total_events: 0, mapped_events: 0, coverage_pct: 0, unmapped: [], by_criticality: {} }
    }
}

export async function syncFromTemplate(templateKey?: string): Promise<{ synced: number; updated: number; unmatched: number; message: string }> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        const result = await erpFetch('posting-rules/sync-from-template/', {
            method: 'POST',
            body: JSON.stringify(templateKey ? { template_key: templateKey } : {}),
        })
        revalidatePath('/finance/settings/posting-rules')
        return result
    } catch {
        return { synced: 0, updated: 0, unmatched: 0, message: 'Sync failed' }
    }
}

export async function getRuleHistory(): Promise<any[]> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('posting-rules/history/')
    } catch (error) {
        handleAuthError(error)
        return []
    }
}
