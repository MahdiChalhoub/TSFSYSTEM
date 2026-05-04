'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

/**
 * Phase 7 — operator wizard for AI-ranked category-creation-rule
 * suggestions. Backend pipeline:
 *
 *   GET  /api/inventory/category-rules/rule-suggestions/?ai=1
 *     → list of suggestion dicts (see category_rule_suggester docstring)
 *
 *   POST /api/inventory/category-rules/apply-rule/
 *     body: { category_id, requires_barcode, ... }
 *     → creates a CategoryCreationRule from the accepted payload
 *
 * AI ranking shares the AIScopeSuggesterConfig with the scope wizard,
 * so the toggle on /inventory/attributes/scope-wizard turns AI on for
 * THIS wizard too. Same daily token cap, same provider.
 */

export type CategoryRuleAIReview = {
    verdict: 'accept' | 'partial' | 'reject' | 'error'
    confidence: number
    rationale: string
    /** Per-field LLM endorsement. Wizard de-emphasises fields the LLM disagrees with. */
    fields: Partial<Record<RuleField, boolean>>
    cached?: boolean
    capped?: boolean
}

export type RuleField =
    | 'requires_barcode'
    | 'requires_brand'
    | 'requires_unit'
    | 'requires_photo'
    | 'requires_supplier'

export type CategoryRuleSuggestion = {
    category_id: number
    category_name: string
    product_count: number
    products_sample: { id: number; name: string }[]
    products_sample_truncated: boolean
    suggested_rule: Record<RuleField, boolean>
    /** 0..1 — proportion of `requires_*` flags the deterministic pass would flip ON. */
    completeness_score: number
    ai_review?: CategoryRuleAIReview
}

export async function listCategoryRuleSuggestions(
    categoryIds?: number[],
    opts?: { ai?: boolean; aiTopN?: number },
): Promise<CategoryRuleSuggestion[]> {
    const params = new URLSearchParams()
    if (categoryIds && categoryIds.length) params.set('category_ids', categoryIds.join(','))
    if (opts?.ai) params.set('ai', '1')
    if (opts?.aiTopN) params.set('ai_top_n', String(opts.aiTopN))
    const qs = params.toString() ? `?${params.toString()}` : ''
    try {
        const r = await erpFetch(`inventory/category-rules/rule-suggestions/${qs}`)
        return Array.isArray(r) ? r : []
    } catch (e) {
        console.warn('[category-rule-suggestions] list failed', e)
        return []
    }
}

export async function applyCategoryRuleSuggestion(
    categoryId: number,
    rule: Partial<Record<RuleField, boolean>>,
): Promise<{ success: boolean; ruleId?: number; message?: string }> {
    try {
        const r = await erpFetch(`inventory/category-rules/apply-rule/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_id: categoryId, ...rule }),
        })
        revalidatePath('/inventory/categories')
        return { success: true, ruleId: (r as any)?.rule_id }
    } catch (e: any) {
        return { success: false, message: e?.message || 'Apply failed' }
    }
}
