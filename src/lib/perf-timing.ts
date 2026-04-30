/**
 * Click → Action Timing
 * =====================
 * Permanent observability primitive: wrap a user-triggered async action,
 * record how long it took from click to settled, and surface slowness.
 *
 * Two outputs from the same primitive:
 *   - Dev: dispatches a `tsf:perf-sample` window event so a floating overlay
 *     can flash slow ones (>800ms by default). Engineers see slowness while
 *     developing — not after users complain.
 *   - Prod: fire-and-forget POST to `/api/perf-log` for samples over the
 *     slow threshold. Sampled at 10% otherwise so the endpoint stays cheap.
 *
 * Convention:
 *   - Labels MUST be `<page>:<action>` — e.g. `purchases.po:reject`,
 *     `inventory.products:bump`, `finance.coa:save-account`.
 *   - Anything generic like "submit" or "click" is useless on the dashboard.
 */
'use client'

import { useCallback } from 'react'

export interface PerfSample {
    label: string
    durationMs: number
    success: boolean
    route: string
    /** Browser timestamp (ms since epoch) when the click happened. */
    clickedAt: number
    /** Optional structured tags (e.g. {category: 'PRICE_HIGH'}). */
    tags?: Record<string, string | number | boolean>
}

const SLOW_THRESHOLD_MS = 800
const PROD_SAMPLE_RATE = 0.1
const PERF_ENDPOINT = '/api/perf-log'

/**
 * Wrap an async action, time it, emit a sample.
 * The wrapped fn's return value (and thrown error) flows through unchanged —
 * this is observability only, never functional.
 */
export async function runTimed<T>(
    label: string,
    fn: () => Promise<T>,
    tags?: PerfSample['tags'],
): Promise<T> {
    const clickedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const wallClickedAt = Date.now()
    let success = true
    try {
        return await fn()
    } catch (e) {
        success = false
        throw e
    } finally {
        const settledAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const durationMs = Math.round(settledAt - clickedAt)
        emit({
            label,
            durationMs,
            success,
            route: typeof window !== 'undefined' ? window.location.pathname : '',
            clickedAt: wallClickedAt,
            tags,
        })
    }
}

/**
 * Hook form — returns a stable callback that times whatever you pass it.
 * Use when you want to wrap multiple disparate actions in the same component.
 */
export function useActionTiming() {
    return useCallback(
        <T,>(label: string, fn: () => Promise<T>, tags?: PerfSample['tags']) =>
            runTimed(label, fn, tags),
        [],
    )
}

function emit(sample: PerfSample) {
    if (typeof window === 'undefined') return

    // Dev: always emit a window event so the overlay can show it.
    if (process.env.NODE_ENV === 'development') {
        try {
            window.dispatchEvent(new CustomEvent('tsf:perf-sample', { detail: sample }))
        } catch { /* never throw from observability */ }
        if (sample.durationMs >= SLOW_THRESHOLD_MS) {
            // eslint-disable-next-line no-console
            console.warn(
                `[perf] slow action ${sample.label} took ${sample.durationMs}ms`,
                sample,
            )
        }
    }

    // Prod (and dev): post slow samples + 10% of fast ones to the perf endpoint.
    const shouldShip =
        sample.durationMs >= SLOW_THRESHOLD_MS || Math.random() < PROD_SAMPLE_RATE
    if (!shouldShip) return

    try {
        if (typeof fetch !== 'undefined') {
            fetch(PERF_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sample),
                keepalive: true,
            }).catch(() => { })
        }
    } catch { /* never throw */ }
}
