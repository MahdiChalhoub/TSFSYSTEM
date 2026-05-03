/**
 * Procurement Recovery Policy — local persistence layer.
 *
 * For now, the per-tenant override is kept in localStorage so the UI is
 * self-contained (no backend migration needed yet). When the backend
 * adds an `OrgProcurementPolicy` model, swap this module's read/write
 * for server actions — the call sites stay the same.
 */
'use client'

import {
    DEFAULT_RECOVERY_POLICY,
    type PipelineRecoveryPolicy,
} from './procurement-status'

const STORAGE_KEY = 'tsf.procurement_recovery_policy.v1'

/** Read the active policy. Falls back to the canonical default if no
 *  override exists or the stored JSON is corrupt. Safe to call from
 *  any client component. */
export function loadRecoveryPolicy(): PipelineRecoveryPolicy {
    if (typeof window === 'undefined') return DEFAULT_RECOVERY_POLICY
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_RECOVERY_POLICY
        const parsed = JSON.parse(raw) as Partial<PipelineRecoveryPolicy>
        // Shallow-merge with defaults so a partial override still works
        // (admin only saved CANCELLED → keep DEFAULT for the others).
        return {
            RECEIVED:  { ...DEFAULT_RECOVERY_POLICY.RECEIVED,  ...(parsed.RECEIVED  || {}) },
            CANCELLED: { ...DEFAULT_RECOVERY_POLICY.CANCELLED, ...(parsed.CANCELLED || {}) },
            REJECTED:  {
                ...DEFAULT_RECOVERY_POLICY.REJECTED,
                ...(parsed.REJECTED || {}),
                perReasonDays: {
                    ...(DEFAULT_RECOVERY_POLICY.REJECTED.perReasonDays || {}),
                    ...(parsed.REJECTED?.perReasonDays || {}),
                },
            },
            FAILED:    { ...DEFAULT_RECOVERY_POLICY.FAILED,    ...(parsed.FAILED    || {}) },
        }
    } catch {
        return DEFAULT_RECOVERY_POLICY
    }
}

/** Persist the policy. Returns true on success, false on quota/private-mode failure. */
export function saveRecoveryPolicy(policy: PipelineRecoveryPolicy): boolean {
    if (typeof window === 'undefined') return false
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(policy))
        return true
    } catch {
        return false
    }
}

/** Reset to defaults (deletes the override). */
export function resetRecoveryPolicy(): void {
    if (typeof window === 'undefined') return
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
