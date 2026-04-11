'use server'

import { erpFetch } from '@/lib/erp-api'

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsProfile {
    id: string;
    name: string;
    page_context: string;
    is_system: boolean;
    is_active: boolean;
    visibility?: 'organization' | 'personal';
    created_by?: string;
    overrides: Record<string, any>;
}

export interface AnalyticsProfilesData {
    profiles: AnalyticsProfile[];
    active_profile_per_page: Record<string, string | null>;
}

export interface ResolvedConfig {
    sales_avg_period_days: number;
    sales_avg_exclude_types: string[];
    best_price_period_days: number;
    proposed_qty_formula: string;
    proposed_qty_lead_days: number;
    proposed_qty_safety_multiplier: number;
    purchase_context: string;
    po_count_source: string;
    financial_score_weights: { margin: number; velocity: number; stock_health: number };
    [key: string]: any;
}

// PAGE_CONTEXT_LABELS moved to @/lib/analytics-constants.ts
// (server action files can only export async functions)

// ═══════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════

export async function getAnalyticsProfiles(pageContext?: string): Promise<AnalyticsProfilesData> {
    try {
        const url = pageContext
            ? `settings/analytics-profiles/?page_context=${pageContext}`
            : 'settings/analytics-profiles/';
        const data = await erpFetch(url);
        return data as AnalyticsProfilesData;
    } catch {
        return { profiles: [], active_profile_per_page: {} };
    }
}

export async function getResolvedConfig(pageContext: string): Promise<ResolvedConfig> {
    try {
        const data = await erpFetch(`settings/analytics-profiles/?page_context=${pageContext}&resolve=true`);
        return (data?.resolved_config || {}) as ResolvedConfig;
    } catch {
        return {} as ResolvedConfig;
    }
}

export async function createProfile(
    name: string,
    pageContext: string,
    overrides: Record<string, any> = {},
    visibility: 'organization' | 'personal' = 'organization'
): Promise<{ success: boolean; profile?: AnalyticsProfile; error?: string }> {
    try {
        const data = await erpFetch('settings/analytics-profiles/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name, page_context: pageContext, overrides, visibility }),
        });
        if (data?.error) return { success: false, error: data.error };
        return { success: true, profile: data?.profile };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to create profile' };
    }
}

export async function updateProfile(
    profileId: string,
    updates: { name?: string; overrides?: Record<string, any> }
): Promise<{ success: boolean; error?: string }> {
    try {
        const data = await erpFetch('settings/analytics-profiles/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', profile_id: profileId, ...updates }),
        });
        if (data?.error) return { success: false, error: data.error };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to update' };
    }
}

export async function deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const data = await erpFetch(`settings/analytics-profiles/?profile_id=${profileId}`, {
            method: 'DELETE',
        });
        if (data?.error) return { success: false, error: data.error };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to delete' };
    }
}

export async function activateProfile(
    pageContext: string,
    profileId: string | null
): Promise<{ success: boolean; error?: string }> {
    try {
        const data = await erpFetch('settings/analytics-profiles/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'activate', page_context: pageContext, profile_id: profileId }),
        });
        if (data?.error) return { success: false, error: data.error };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to activate' };
    }
}
