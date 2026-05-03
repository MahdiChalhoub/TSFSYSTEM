'use server'

import { erpFetch } from '@/lib/erp-api'
import {
    DEFAULT_RECOVERY_POLICY,
    type PipelineRecoveryPolicy,
} from '@/lib/procurement-status'

const SETTING_KEY = 'procurement_recovery_policy'

/**
 * Read the active per-tenant procurement recovery policy. Uses the
 * generic key/value settings endpoint
 *   GET /api/settings/item/<key>/
 * which routes through `ConfigurationService.get_setting` and pulls
 * the JSON out of `Organization.settings`. Tenant-wide — every user in
 * the org sees the same policy.
 *
 * Falls back to DEFAULT_RECOVERY_POLICY when no override is stored or
 * the call fails (so the UI renders something sensible on first load).
 */
export async function getRecoveryPolicy(): Promise<PipelineRecoveryPolicy> {
    try {
        const value = await erpFetch(`settings/item/${SETTING_KEY}/`)
        if (!value || typeof value !== 'object') return DEFAULT_RECOVERY_POLICY
        // Shallow-merge with defaults so a partial override still works
        // (admin only saved CANCELLED → keep DEFAULT for the others).
        const v = value as Partial<PipelineRecoveryPolicy>
        return {
            RECEIVED:  { ...DEFAULT_RECOVERY_POLICY.RECEIVED,  ...(v.RECEIVED  || {}) },
            CANCELLED: { ...DEFAULT_RECOVERY_POLICY.CANCELLED, ...(v.CANCELLED || {}) },
            REJECTED:  {
                ...DEFAULT_RECOVERY_POLICY.REJECTED,
                ...(v.REJECTED || {}),
                perReasonDays: {
                    ...(DEFAULT_RECOVERY_POLICY.REJECTED.perReasonDays || {}),
                    ...(v.REJECTED?.perReasonDays || {}),
                },
            },
            FAILED:    { ...DEFAULT_RECOVERY_POLICY.FAILED,    ...(v.FAILED    || {}) },
        }
    } catch {
        return DEFAULT_RECOVERY_POLICY
    }
}

/** Persist the policy on the org row. Returns `{ ok: true }` or
 *  `{ ok: false, error }` so the caller can toast accordingly. */
export async function saveRecoveryPolicy(
    policy: PipelineRecoveryPolicy,
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        await erpFetch(`settings/item/${SETTING_KEY}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(policy),
        })
        return { ok: true }
    } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e)
        return { ok: false, error }
    }
}

/** Reset to defaults — wipes the override on the org row. */
export async function resetRecoveryPolicy(): Promise<{ ok: true } | { ok: false; error: string }> {
    // POST an empty object — the get-side merge will fall back to
    // DEFAULT_RECOVERY_POLICY for every field.
    return saveRecoveryPolicy({} as PipelineRecoveryPolicy)
}
