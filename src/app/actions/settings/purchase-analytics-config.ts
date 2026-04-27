'use server'

import { erpFetch } from '@/lib/erp-api'

export interface PurchaseAnalyticsConfig {
    sales_avg_period_days: number;
    sales_avg_exclude_types: string[];
    sales_window_size_days: number;
    best_price_period_days: number;
    proposed_qty_formula: 'AVG_DAILY_x_LEAD_DAYS' | 'MONTHLY_AVG_x_MONTHS';
    proposed_qty_lead_days: number;
    proposed_qty_safety_multiplier: number;
    purchase_context: 'RETAIL' | 'WHOLESALE';
    po_count_source: 'PURCHASE_INVOICE' | 'PURCHASE_ORDER';
    financial_score_weights: {
        margin: number;
        velocity: number;
        stock_health: number;
    };
    request_flow_mode: 'INSTANT' | 'DIALOG' | 'CART';
    // Audit metadata (from backend)
    _last_modified_by?: string;
    _last_modified_at?: string;
    _version_count?: number;
    // RBAC
    _user_role?: 'viewer' | 'editor' | 'admin';
    _restricted_fields?: string[];
    // Presence
    _active_editors?: string[];
}

export interface ConfigHistoryEntry {
    config: Record<string, any>;
    changed_by: string;
    changed_at: string;
    action: string;
    changes: Array<{ field: string; old: any; new: any }>;
}

const DEFAULTS: PurchaseAnalyticsConfig = {
    sales_avg_period_days: 180,
    sales_avg_exclude_types: [],
    sales_window_size_days: 15,
    best_price_period_days: 180,
    proposed_qty_formula: 'AVG_DAILY_x_LEAD_DAYS',
    proposed_qty_lead_days: 14,
    proposed_qty_safety_multiplier: 1.5,
    purchase_context: 'RETAIL',
    po_count_source: 'PURCHASE_INVOICE',
    financial_score_weights: { margin: 40, velocity: 30, stock_health: 30 },
    request_flow_mode: 'DIALOG',
};

export async function getPurchaseAnalyticsConfig(): Promise<PurchaseAnalyticsConfig> {
    try {
        const data = await erpFetch('settings/purchase-analytics-config/');
        if (data && typeof data === 'object' && !data.error) {
            return { ...DEFAULTS, ...data } as PurchaseAnalyticsConfig;
        }
        return DEFAULTS;
    } catch {
        return DEFAULTS;
    }
}

export async function savePurchaseAnalyticsConfig(config: Partial<PurchaseAnalyticsConfig>): Promise<{ success: boolean; message?: string; changed_by?: string; changed_at?: string; changes_count?: number }> {
    try {
        // Strip metadata fields before sending
        const { _last_modified_by, _last_modified_at, _version_count, ...cleanConfig } = config as any;
        const data = await erpFetch('settings/purchase-analytics-config/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanConfig),
        });
        if (data?.error) {
            return { success: false, message: data.error };
        }
        return {
            success: true,
            message: data?.message || 'Saved',
            changed_by: data?.changed_by,
            changed_at: data?.changed_at,
            changes_count: data?.changes_count,
        };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to save' };
    }
}

export async function getConfigHistory(): Promise<{ history: ConfigHistoryEntry[]; total: number }> {
    try {
        const data = await erpFetch('settings/purchase-analytics-config/?action=history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return { history: data?.history || [], total: data?.total || 0 };
    } catch {
        return { history: [], total: 0 };
    }
}

export async function rollbackConfig(versionIndex: number): Promise<{ success: boolean; message?: string }> {
    try {
        const data = await erpFetch('settings/purchase-analytics-config/?action=rollback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version_index: versionIndex }),
        });
        if (data?.error) {
            return { success: false, message: data.error };
        }
        return { success: true, message: data?.message || 'Rolled back' };
    } catch (e: any) {
        return { success: false, message: e?.message || 'Failed to rollback' };
    }
}
