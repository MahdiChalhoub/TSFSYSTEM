/**
 * Purchase Analytics Settings — Validation & Scoring
 * =====================================================
 */

import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'

/* ── Field validation rules ── */
export const fieldValidation: Record<string, (v: any) => 'ok' | 'warn' | 'error'> = {
    sales_avg_period_days: (v) => v >= 30 && v <= 365 ? 'ok' : v < 30 ? 'error' : 'warn',
    sales_window_size_days: (v) => v >= 7 && v <= 90 ? 'ok' : v < 7 ? 'error' : 'warn',
    proposed_qty_lead_days: (v) => v >= 5 && v <= 60 ? 'ok' : v < 5 ? 'error' : 'warn',
    proposed_qty_safety_multiplier: (v) => v >= 1.0 && v <= 2.0 ? 'ok' : v < 1.0 ? 'error' : 'warn',
    best_price_period_days: (v) => v >= 30 && v <= 365 ? 'ok' : v < 30 ? 'error' : 'warn',
}

export const getFieldStatus = (field: string, value: any): 'ok' | 'warn' | 'error' | null => {
    const fn = fieldValidation[field]
    return fn ? fn(value) : null
}

/* ── Config health score ── */
export function computeConfigScore(config: PurchaseAnalyticsConfig): number {
    let s = 100
    if (config.proposed_qty_safety_multiplier < 1.0) s -= 15
    if (config.proposed_qty_safety_multiplier > 3.0) s -= 10
    if (config.sales_avg_period_days < 30) s -= 10
    if (config.proposed_qty_lead_days < 3) s -= 15
    if (config.proposed_qty_lead_days > 60) s -= 5
    const w = config.financial_score_weights
    if (w && (w.margin + w.velocity + w.stock_health) !== 100) s -= 20
    return Math.max(0, Math.min(100, s))
}

export function computeScoreBreakdown(config: PurchaseAnalyticsConfig): Array<{ label: string; pass: boolean; impact: string }> {
    const checks: Array<{ label: string; pass: boolean; impact: string }> = []
    checks.push({ label: 'Safety multiplier ≥ 1.0', pass: config.proposed_qty_safety_multiplier >= 1.0, impact: '-15%' })
    checks.push({ label: 'Safety multiplier ≤ 3.0', pass: config.proposed_qty_safety_multiplier <= 3.0, impact: '-10%' })
    checks.push({ label: 'Sales avg period ≥ 30 days', pass: config.sales_avg_period_days >= 30, impact: '-10%' })
    checks.push({ label: 'Lead days ≥ 3', pass: config.proposed_qty_lead_days >= 3, impact: '-15%' })
    checks.push({ label: 'Lead days ≤ 60', pass: config.proposed_qty_lead_days <= 60, impact: '-5%' })
    const w = config.financial_score_weights
    checks.push({ label: 'Weights sum to 100%', pass: w ? (w.margin + w.velocity + w.stock_health) === 100 : true, impact: '-20%' })
    return checks
}

/* ── Completeness meter ── */
export function computeCompleteness(config: PurchaseAnalyticsConfig): number {
    const fields = ['sales_avg_period_days', 'sales_window_size_days', 'proposed_qty_formula',
        'proposed_qty_lead_days', 'proposed_qty_safety_multiplier', 'best_price_period_days',
        'purchase_context', 'po_count_source'] as const
    let filled = 0
    fields.forEach(f => {
        const v = (config as any)[f]
        if (v !== undefined && v !== null && v !== '' && v !== 0) filled++
    })
    return Math.round((filled / fields.length) * 100)
}

/* ── Optimization suggestions ── */
export function computeSuggestions(config: PurchaseAnalyticsConfig, val: (k: string) => any, valWeight: (k: string) => any) {
    const s: Array<{ field: string; current: any; suggested: any; reason: string }> = []
    if (config.proposed_qty_safety_multiplier < 1.0) {
        s.push({ field: 'proposed_qty_safety_multiplier', current: config.proposed_qty_safety_multiplier, suggested: 1.3, reason: 'Below 1.0 risks frequent stockouts' })
    }
    if (config.proposed_qty_safety_multiplier > 2.5) {
        s.push({ field: 'proposed_qty_safety_multiplier', current: config.proposed_qty_safety_multiplier, suggested: 1.5, reason: 'Excess safety stock ties up capital' })
    }
    if (config.sales_avg_period_days < 30) {
        s.push({ field: 'sales_avg_period_days', current: config.sales_avg_period_days, suggested: 90, reason: 'Short windows are noisy — 90 days balances trend vs recency' })
    }
    if (config.proposed_qty_lead_days < 5) {
        s.push({ field: 'proposed_qty_lead_days', current: config.proposed_qty_lead_days, suggested: 14, reason: 'Very short lead time assumes instant delivery' })
    }
    const w = config.financial_score_weights
    if (w && (w.margin + w.velocity + w.stock_health) !== 100) {
        s.push({ field: 'financial_score_weights', current: w.margin + w.velocity + w.stock_health, suggested: 100, reason: 'Weights must sum to 100% for accurate scoring' })
    }
    return s
}

/* ── Validation warnings ── */
export function computeWarnings(val: (k: string) => any, valWeight: (k: string) => any) {
    const warnings: { field: string; message: string; severity: 'warn' | 'danger' }[] = []
    const safetyMult = val('proposed_qty_safety_multiplier')
    const leadDays = val('proposed_qty_lead_days')
    const weightSum = (valWeight('margin') || 0) + (valWeight('velocity') || 0) + (valWeight('stock_health') || 0)
    if (safetyMult < 1.0) warnings.push({ field: 'proposed_qty_safety_multiplier', message: 'Safety multiplier below 1.0 may cause stockouts', severity: 'danger' })
    if (safetyMult > 3.0) warnings.push({ field: 'proposed_qty_safety_multiplier', message: 'Safety multiplier above 3.0 may cause overstock', severity: 'warn' })
    if (leadDays > 90) warnings.push({ field: 'proposed_qty_lead_days', message: 'Lead time above 90 days is unusually long', severity: 'warn' })
    if (leadDays < 1) warnings.push({ field: 'proposed_qty_lead_days', message: 'Lead time must be at least 1 day', severity: 'danger' })
    if (weightSum !== 100 && weightSum > 0) warnings.push({ field: 'financial_score_weights', message: `Score weights sum to ${weightSum}% instead of 100%`, severity: 'warn' })
    return warnings
}
