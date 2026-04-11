'use server';

import { erpFetch } from '@/lib/erp-api';

// ── My Summary ────────────────────────────────────────────────────

export async function getWorkforceSummary() {
    try { return await erpFetch('/workforce/summaries/my_summary/'); }
    catch { return null; }
}

export async function getWorkforceSummaryForEmployee(employeeId: string | number) {
    try {
        return await erpFetch(`/workforce/summaries/?employee=${employeeId}&limit=1`)
            .then((r: any) => Array.isArray(r) ? r[0] : r?.results?.[0] ?? null);
    }
    catch { return null; }
}

export async function getWorkforceLeaderboard(limit = 10) {
    try { return await erpFetch(`/workforce/summaries/leaderboard/?limit=${limit}`); }
    catch { return []; }
}

export async function getWorkforceRiskHeatmap() {
    try { return await erpFetch('/workforce/summaries/risk_heatmap/'); }
    catch { return []; }
}

// ── Events Ledger ─────────────────────────────────────────────────

export async function getWorkforceEvents(opts?: { employee?: number; module?: string; direction?: string }) {
    const params = new URLSearchParams();
    if (opts?.employee) params.set('employee', String(opts.employee));
    if (opts?.module) params.set('module', opts.module);
    if (opts?.direction) params.set('direction', opts.direction);
    try { return await erpFetch(`/workforce/events/?${params.toString()}`); }
    catch { return { results: [] }; }
}

export async function getWorkforceEventsForEmployee(employeeId: string | number) {
    try { return await erpFetch(`/workforce/events/?employee=${employeeId}&ordering=-event_at&limit=50`); }
    catch { return { results: [] }; }
}

export async function reverseWorkforceEvent(eventId: number): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        return await erpFetch(`/workforce/events/${eventId}/reverse/`, { method: 'POST' });
    } catch (e: any) {
        return { success: false, error: e.message || 'Failed to reverse event.' };
    }
}

// ── Badges ────────────────────────────────────────────────────────

export async function getWorkforceBadges(employeeId?: number) {
    const query = employeeId ? `?employee=${employeeId}` : '';
    try { return await erpFetch(`/workforce/badges/${query}`); }
    catch { return []; }
}

// ── Historical Periods ────────────────────────────────────────────

export async function getWorkforcePeriods(employeeId?: number, type = 'MONTHLY') {
    const params = new URLSearchParams({ period_type: type });
    if (employeeId) params.set('employee', String(employeeId));
    try { return await erpFetch(`/workforce/periods/?${params.toString()}`); }
    catch { return []; }
}

export async function getWorkforcePeriodsForEmployee(employeeId: string | number) {
    try {
        return await erpFetch(`/workforce/periods/?employee=${employeeId}&ordering=period_key&limit=24`);
    }
    catch { return { results: [] }; }
}

// ── Rules ────────────────────────────────────────────────────────

export async function getWorkforceRules(module?: string) {
    const query = module ? `?module=${module}` : '';
    try { return await erpFetch(`/workforce/rules/by_module/${query}`); }
    catch { return []; }
}

export async function getWorkforceRulesAll() {
    try { return await erpFetch('/workforce/rules/?limit=200&ordering=module'); }
    catch { return []; }
}

// ── Org Statistics ───────────────────────────────────────────────

export interface WorkforceStatistics {
    total_employees: number;
    avg_global_score: number | null;
    min_global_score: number | null;
    max_global_score: number | null;
    avg_performance_score: number | null;
    avg_trust_score: number | null;
    avg_compliance_score: number | null;
    avg_reliability_score: number | null;
    avg_leadership_score: number | null;
    avg_attendance_score: number | null;
    avg_event_count: number | null;
    at_risk_count: number;
    risk_distribution: Record<string, number>;
    badge_distribution: Record<string, number>;
}

export async function getWorkforceStatistics(): Promise<WorkforceStatistics | null> {
    try { return await erpFetch('/workforce/summaries/statistics/'); }
    catch { return null; }
}

// ── Manual Adjustment ───────────────────────────────────────────

/**
 * Apply a manual score adjustment. Accepts FormData (from client forms)
 * or a plain object.
 */
export async function applyWorkforceAdjustment(
    data: FormData | {
        employee_id: number | string;
        points: number;
        dimension: string;
        score_family?: string;
        reason: string;
        adjustment_type: 'BONUS' | 'PENALTY' | 'CORRECTION';
    }
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        let payload: Record<string, any>;
        if (data instanceof FormData) {
            payload = {
                employee_id: data.get('employee_id'),
                points: Number(data.get('points')),
                dimension: data.get('dimension'),
                score_family: data.get('score_family') || 'PERFORMANCE',
                reason: data.get('reason'),
                adjustment_type: data.get('adjustment_type'),
            };
        } else {
            payload = { ...data };
        }

        return await erpFetch('/workforce/summaries/adjust/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e: any) {
        return { success: false, error: e.message || 'Adjustment failed.' };
    }
}

// ── Bulk Operations ──────────────────────────────────────────────

/**
 * Re-scores all active employees in the org using the current rule set.
 * Call after rule changes to propagate new base_points immediately.
 * POST /api/workforce/rules/bulk_recalculate/
 */
export async function bulkRecalculateWise(): Promise<{
    success: boolean;
    total?: number;
    errors?: number;
    error?: string;
}> {
    try {
        return await erpFetch('/workforce/rules/bulk_recalculate/', { method: 'POST' });
    } catch (e: any) {
        return { success: false, error: e.message || 'Recalculation failed.' };
    }
}

/**
 * Takes a period snapshot of all current summaries.
 * Should be called at month/week close or triggered manually by admin.
 * POST /api/workforce/rules/snapshot_period/
 */
export async function snapshotWisePeriod(
    period_type: 'MONTHLY' | 'WEEKLY' | 'DAILY' = 'MONTHLY'
): Promise<{
    success: boolean;
    created?: number;
    updated?: number;
    period_key?: string;
    error?: string;
}> {
    try {
        return await erpFetch('/workforce/rules/snapshot_period/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period_type }),
        });
    } catch (e: any) {
        return { success: false, error: e.message || 'Snapshot failed.' };
    }
}
