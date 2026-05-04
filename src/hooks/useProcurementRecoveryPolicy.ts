'use client'

import { useEffect, useState } from 'react'
import {
    DEFAULT_RECOVERY_POLICY,
    type PipelineRecoveryPolicy,
} from '@/lib/procurement-status'
import { getRecoveryPolicy } from '@/app/actions/settings/procurement-recovery'

/**
 * Loads the tenant-wide procurement recovery policy ONCE per session
 * and caches it in module memory. Every chip renderer can call this
 * without each one firing its own server roundtrip.
 *
 * SSR-safe: returns DEFAULT_RECOVERY_POLICY synchronously, then the
 * effect upgrades it to the tenant override after first hydration.
 */

let cached: PipelineRecoveryPolicy | null = null
let inflight: Promise<PipelineRecoveryPolicy> | null = null

/** Reset the in-memory cache. Call from the settings page after a save
 *  so other open tabs / pages refresh on the next render. */
export function invalidateRecoveryPolicyCache(next?: PipelineRecoveryPolicy) {
    cached = next ?? null
    inflight = null
}

export function useProcurementRecoveryPolicy(): PipelineRecoveryPolicy {
    const [policy, setPolicy] = useState<PipelineRecoveryPolicy>(
        cached ?? DEFAULT_RECOVERY_POLICY,
    )
    useEffect(() => {
        if (cached) { setPolicy(cached); return }
        if (!inflight) {
            inflight = getRecoveryPolicy().then(p => {
                cached = p
                return p
            }).catch(() => {
                inflight = null
                return DEFAULT_RECOVERY_POLICY
            })
        }
        let alive = true
        inflight.then(p => { if (alive) setPolicy(p) })
        return () => { alive = false }
    }, [])
    return policy
}
