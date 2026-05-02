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
    /** What kind of measurement this is — 'action' = click-driven async work,
     *  'page' = navigation/page-open timing reported from the browser
     *  Performance API. Defaults to 'action'. */
    kind?: 'action' | 'page'
    /** Browser timestamp (ms since epoch) when the click/navigation happened. */
    clickedAt: number
    /** Optional structured tags (e.g. {category: 'PRICE_HIGH', metric: 'TTFB'}). */
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

/**
 * Capture page-load timings from the browser Performance API and emit them
 * on the same `tsf:perf-sample` channel as click-driven actions.
 *
 * Two flavors of "page load":
 *   1. Hard load — fresh document; reported ONCE per session as
 *        page<route>::ttfb  — backend response time
 *        page<route>::fcp   — first contentful paint
 *   2. Soft nav — Next.js client-side navigation (Link click); no new
 *      document, no new paint entry. Reported as
 *        page<route>::soft  — pathname change → next animation frame
 *      so each client navigation gets its own number.
 *
 * If LCP/INP/CLS becomes load-bearing later, install `web-vitals`.
 */

let _hardLoadReported = false

export function reportPageTimings(route: string) {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return

    // ── Soft navigation: time pathname-change → next paint frame.
    // The hard-load metrics below only fire ONCE per real document load;
    // after that, this branch handles every Link click.
    if (_hardLoadReported) {
        const startedAt = performance.now()
        // requestAnimationFrame fires when the browser is about to paint —
        // a decent proxy for "the new route is on screen and interactive."
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                emit({
                    label: `page${route}::soft`,
                    durationMs: Math.round(performance.now() - startedAt),
                    success: true, route, kind: 'page',
                    clickedAt: Date.now(),
                    tags: { metric: 'SOFT_NAV' },
                })
            })
        })
        return
    }

    // ── Hard load (first mount only).
    _hardLoadReported = true

    try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        if (nav && nav.responseStart > 0) {
            emit({
                label: `page${route}::ttfb`,
                durationMs: Math.round(nav.responseStart - nav.requestStart),
                success: true, route, kind: 'page',
                clickedAt: Date.now(),
                tags: { metric: 'TTFB' },
            })
        }
    } catch { /* never throw from observability */ }

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                    emit({
                        label: `page${route}::fcp`,
                        durationMs: Math.round(entry.startTime),
                        success: true, route, kind: 'page',
                        clickedAt: Date.now(),
                        tags: { metric: 'FCP' },
                    })
                    observer.disconnect()
                    return
                }
            }
        })
        observer.observe({ type: 'paint', buffered: true })
    } catch { /* fall through */ }
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

    // Self-disable after the first 4xx — when the reverse proxy routes
    // /api/* to Django (which doesn't own /api/perf-log), every emit
    // would 404 and clutter the console with red network entries.
    // We back off for the rest of the session so the first failure is
    // the only one the user sees.
    if (perfShipDisabled) return
    try {
        if (typeof fetch !== 'undefined') {
            fetch(PERF_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sample),
                keepalive: true,
            }).then(res => {
                if (res.status >= 400 && res.status < 500) {
                    perfShipDisabled = true
                }
            }).catch(() => { })
        }
    } catch { /* never throw */ }
}

// Module-scoped — reset only on a full page reload. Keeps emit() cheap
// after the endpoint has been confirmed unreachable.
let perfShipDisabled = false
