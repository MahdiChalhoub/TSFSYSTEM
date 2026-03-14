'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type PostingRuleEntry = {
    id: number
    event_code: string
    account: number
    account_code: string
    account_name: string
    module: string
    source: string
    description: string
    is_active: boolean
}

export type PostingRulesByModule = {
    [module: string]: PostingRuleEntry[]
}

export type CompletenessReport = {
    total_events: number
    configured: number
    coverage_pct: number
    missing_critical: { code: string; module: string; description: string }[]
    missing_standard: { code: string; module: string; description: string }[]
    missing_optional: { code: string; module: string; description: string }[]
    missing_conditional: { code: string; module: string; description: string }[]
    is_ready: boolean
    summary: string
    blockers: string[]
}

export type ModuleCoverage = {
    [module: string]: {
        total: number
        configured: number
        coverage_pct: number
        missing: string[]
    }
}

export type HistoryEntry = {
    event_code: string
    change_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'AUTO'
    old_account: string | null
    new_account: string | null
    source: string
    changed_by: string | null
    reason: string
    timestamp: string
}

export type AutoDetectResult = {
    event_code: string
    account_id: number | null
    account_code: string
    account_name: string
    confidence: number
    strategy: string
    tier: number
    matched: boolean
}

export type DetectionSummary = {
    total: number
    matched: number
    unmatched_count: number
    avg_confidence: number
    by_tier: Record<number, number>
    tier_labels: Record<number, string>
    unmatched: string[]
}

export type AutoDetectResponse = {
    results: Record<string, AutoDetectResult>
    summary: DetectionSummary
}

export type AutoDetectApplyResponse = {
    applied: number
    min_confidence: number
    summary: DetectionSummary
    message: string
}
// Legacy types (backward compat)
export type PostingRulesConfig = {
    sales: { receivable: number | null; revenue: number | null; cogs: number | null; inventory: number | null; round_off: number | null; discount: number | null; vat_collected: number | null }
    purchases: { payable: number | null; inventory: number | null; expense: number | null; vat_recoverable: number | null; vat_suspense: number | null; airsi_payable: number | null; reverse_charge_vat: number | null; discount_earned: number | null; delivery_fees: number | null; airsi: number | null }
    inventory: { adjustment: number | null; transfer: number | null }
    automation: { customerRoot: number | null; supplierRoot: number | null; payrollRoot: number | null }
    fixedAssets: { depreciationExpense: number | null; accumulatedDepreciation: number | null }
    suspense: { reception: number | null }
    partners: { capital: number | null; loan: number | null; withdrawal: number | null }
    equity: { capital: number | null; draws: number | null }
    tax: { vat_payable: number | null; vat_refund_receivable: number | null }
}

export type PostingRuleImpact = {
    rule: string
    old_account: string
    new_account: string
    journal_entries: number
    balance: number
    risk: 'HIGH' | 'LOW'
}

export type PostingRulesResponse = {
    success: boolean
    message?: string
    changes?: number
    impact?: PostingRuleImpact[]
    has_high_risk?: boolean
    reclassifications?: Array<{
        rule: string
        status: string
        je_id?: string
        amount?: number
        error?: string
        reason?: string
    }>
}

// ═══════════════════════════════════════════════════════════════
// PostingRule Model API (Phase A)
// ═══════════════════════════════════════════════════════════════

export async function getPostingRulesByModule(): Promise<PostingRulesByModule> {
    try {
        return await erpFetch('api/finance/posting-rules/by-module/')
    } catch (error) {
        console.error("Failed to fetch posting rules by module:", error)
        return {}
    }
}

export async function getPostingRulesList(): Promise<PostingRuleEntry[]> {
    try {
        return await erpFetch('api/finance/posting-rules/')
    } catch (error) {
        console.error("Failed to fetch posting rules:", error)
        return []
    }
}

export async function updatePostingRule(id: number, data: { account: number }): Promise<{ success: boolean }> {
    try {
        await erpFetch(`api/finance/posting-rules/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch (error) {
        console.error("Failed to update posting rule:", error)
        return { success: false }
    }
}

export async function getCompletenessReport(): Promise<CompletenessReport | null> {
    try {
        return await erpFetch('api/finance/posting-rules/completeness/')
    } catch (error) {
        console.error("Failed to fetch completeness report:", error)
        return null
    }
}

export async function getCompletenessByModule(): Promise<ModuleCoverage | null> {
    try {
        return await erpFetch('api/finance/posting-rules/completeness/by-module/')
    } catch (error) {
        console.error("Failed to fetch module coverage:", error)
        return null
    }
}

export async function getPostingRuleHistory(eventCode?: string): Promise<HistoryEntry[]> {
    try {
        const url = eventCode
            ? `api/finance/posting-rules/history/?event_code=${encodeURIComponent(eventCode)}`
            : 'api/finance/posting-rules/history/'
        return await erpFetch(url)
    } catch (error) {
        console.error("Failed to fetch posting rule history:", error)
        return []
    }
}

export async function syncFromJson(): Promise<{ success: boolean; synced?: number }> {
    try {
        const result = await erpFetch('api/finance/posting-rules/sync-from-json/', {
            method: 'POST'
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true, synced: result.synced }
    } catch (error) {
        console.error("Failed to sync from JSON:", error)
        return { success: false }
    }
}

export async function runAutoDetect(): Promise<AutoDetectResponse | null> {
    try {
        return await erpFetch('api/finance/posting-rules/auto-detect/')
    } catch (error) {
        console.error("Failed to run auto-detect:", error)
        return null
    }
}

export async function applyAutoDetect(minConfidence: number = 70): Promise<AutoDetectApplyResponse | null> {
    try {
        const result = await erpFetch('api/finance/posting-rules/auto-detect-apply/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ min_confidence: minConfidence })
        })
        revalidatePath('/finance/settings/posting-rules')
        return result
    } catch (error) {
        console.error("Failed to apply auto-detect:", error)
        return null
    }
}
// ═══════════════════════════════════════════════════════════════
// Legacy API (backward compat — still used for save/impact)
// ═══════════════════════════════════════════════════════════════

export async function getPostingRules(): Promise<PostingRulesConfig> {
    try {
        return await erpFetch('settings/posting_rules/')
    } catch (error) {
        console.error("Failed to fetch posting rules:", error)
        return {
            sales: { receivable: null, revenue: null, cogs: null, inventory: null, round_off: null, discount: null, vat_collected: null },
            purchases: { payable: null, inventory: null, expense: null, vat_recoverable: null, vat_suspense: null, airsi_payable: null, reverse_charge_vat: null, discount_earned: null, delivery_fees: null, airsi: null },
            inventory: { adjustment: null, transfer: null },
            automation: { customerRoot: null, supplierRoot: null, payrollRoot: null },
            fixedAssets: { depreciationExpense: null, accumulatedDepreciation: null },
            suspense: { reception: null },
            partners: { capital: null, loan: null, withdrawal: null },
            equity: { capital: null, draws: null },
            tax: { vat_payable: null, vat_refund_receivable: null },
        }
    }
}

export async function analyzePostingRulesImpact(config: PostingRulesConfig): Promise<PostingRulesResponse> {
    try {
        const result = await erpFetch('settings/posting_rules/?dry_run=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        return { success: true, ...result }
    } catch (error) {
        console.error("Failed to analyze posting rules impact:", error)
        return { success: false }
    }
}

export async function savePostingRules(config: PostingRulesConfig): Promise<PostingRulesResponse> {
    try {
        const result = await erpFetch('settings/posting_rules/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true, ...result }
    } catch (error) {
        console.error("Failed to save posting rules:", error)
        return { success: false }
    }
}

export async function savePostingRulesWithReclassification(config: PostingRulesConfig): Promise<PostingRulesResponse> {
    try {
        const result = await erpFetch('settings/posting_rules/?reclassify=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        revalidatePath('/finance/settings/posting-rules')
        revalidatePath('/finance/ledger')
        return { success: true, ...result }
    } catch (error) {
        console.error("Failed to save posting rules with reclassification:", error)
        return { success: false }
    }
}

export async function applySmartPostingRules() {
    try {
        await erpFetch('settings/smart_apply/', {
            method: 'POST'
        })
        revalidatePath('/finance/settings/posting-rules')
        return { success: true }
    } catch (error) {
        console.error("Failed to apply smart posting rules:", error)
        return { success: false }
    }
}