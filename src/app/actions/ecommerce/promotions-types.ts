// Types for ecommerce promotions (no 'use server' directive needed)

export type RuleType = 'SPEND_THRESHOLD' | 'BOGO' | 'BUNDLE' | 'MIN_QUANTITY'

export interface CartPromotion {
    id: number
    name: string
    description: string
    rule_type: RuleType
    conditions: Record<string, unknown>
    reward: Record<string, unknown>
    priority: number
    stackable: boolean
    max_uses: number | null
    used_count: number
    one_per_customer: boolean
    valid_from: string | null
    valid_until: string | null
    is_active: boolean
    created_at: string
}

export interface PromotionPayload {
    name: string
    description?: string
    rule_type: RuleType
    conditions: Record<string, unknown>
    reward: Record<string, unknown>
    priority?: number
    stackable?: boolean
    max_uses?: number | null
    one_per_customer?: boolean
    valid_from?: string | null
    valid_until?: string | null
    is_active?: boolean
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
    SPEND_THRESHOLD: 'Spend Threshold',
    BOGO: 'Buy X Get Y Free',
    BUNDLE: 'Bundle Discount',
    MIN_QUANTITY: 'Min Quantity',
}
