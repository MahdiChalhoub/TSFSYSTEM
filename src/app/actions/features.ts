'use server'

/**
 * Organization Feature Flags Server Actions
 * ==========================================
 * Reads/writes feature flags from the Organization.settings JSON,
 * gated by the org's SubscriptionPlan.limits.
 *
 * Backend: GET/PATCH /api/organizations/features/
 *
 * Architecture:
 *   - SaaS Admin → configures which features each plan includes (plan.limits)
 *   - Org Admin → toggles features on/off within plan allowance (org.settings)
 *   - Module Settings → module-specific config lives in each module's settings page
 */

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"

export interface FeatureStatus {
    key: string
    enabled: boolean
    plan_allows: boolean
    org_enabled: boolean
    plan_name: string | null
    label: string
    description: string
    icon: string
}

export type FeatureMap = Record<string, FeatureStatus>

/**
 * Static feature registry — used as fallback when API is unavailable.
 * Mirrors the backend FEATURE_REGISTRY in feature_gate.py.
 */
const STATIC_FEATURES: FeatureMap = {
    multi_currency: {
        key: 'multi_currency',
        enabled: false,
        plan_allows: false,
        org_enabled: false,
        plan_name: null,
        label: 'Multi-Currency',
        description: 'Enter transactions in foreign currencies with exchange rate conversion',
        icon: 'banknote',
    },
    multi_country: {
        key: 'multi_country',
        enabled: false,
        plan_allows: false,
        org_enabled: false,
        plan_name: null,
        label: 'Multi-Country Branches',
        description: 'Assign branches to different countries with per-country tax regimes',
        icon: 'globe',
    },
    dual_scope: {
        key: 'dual_scope',
        enabled: false,
        plan_allows: false,
        org_enabled: false,
        plan_name: null,
        label: 'Dual View (Official + Internal)',
        description: 'Maintain parallel official and internal accounting scopes',
        icon: 'eye',
    },
    encryption: {
        key: 'encryption',
        enabled: false,
        plan_allows: false,
        org_enabled: false,
        plan_name: null,
        label: 'AES-256 Encryption',
        description: 'Field-level encryption for sensitive data at rest',
        icon: 'shield',
    },
}

/**
 * Get all feature statuses for the current organization.
 * Falls back to static registry if the API is unavailable.
 */
export async function getOrgFeatures(): Promise<FeatureMap> {
    try {
        const result = await erpFetch('organizations/features/')
        if (result && typeof result === 'object' && Object.keys(result).length > 0) {
            return result as FeatureMap
        }
        return { ...STATIC_FEATURES }
    } catch (error) {
        console.error("[Features] Failed to fetch, using static fallback:", error)
        return { ...STATIC_FEATURES }
    }
}

/**
 * Toggle a specific feature on/off.
 * Returns the updated feature status, or an error.
 */
export async function toggleOrgFeature(
    key: string,
    enabled: boolean
): Promise<{ success: boolean; feature?: FeatureStatus; error?: string }> {
    try {
        const result = await erpFetch('organizations/features/', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, enabled }),
        })

        if (result?.error) {
            return { success: false, error: result.error }
        }

        revalidatePath('/settings')
        return { success: true, feature: result as FeatureStatus }
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to toggle feature' }
    }
}
