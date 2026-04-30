/**
 * Perf-log endpoint — receives click→action duration samples from the client.
 *
 * Today: logs to stdout. Future: forward to Django for aggregation, or pipe
 * into your APM of choice. The frontend posts fire-and-forget, so this never
 * needs to be fast.
 */
import { NextResponse } from 'next/server'

interface PerfPayload {
    label?: unknown
    durationMs?: unknown
    success?: unknown
    route?: unknown
    clickedAt?: unknown
    tags?: unknown
}

const SLOW_MS = 800

export async function POST(req: Request) {
    let payload: PerfPayload | null = null
    try {
        payload = await req.json()
    } catch {
        return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    const label = typeof payload?.label === 'string' ? payload.label : 'unknown'
    const durationMs = Number(payload?.durationMs)
    if (!Number.isFinite(durationMs) || durationMs < 0) {
        return NextResponse.json({ ok: false, error: 'invalid_duration' }, { status: 400 })
    }

    const route = typeof payload?.route === 'string' ? payload.route : ''
    const success = !!payload?.success
    const tags = payload?.tags && typeof payload.tags === 'object' ? payload.tags : undefined

    // Structured single-line log; easy to grep, easy to forward to a sink later.
    const slow = durationMs >= SLOW_MS
    const line = JSON.stringify({
        kind: 'perf',
        label,
        durationMs,
        success,
        slow,
        route,
        ts: Date.now(),
        ...(tags ? { tags } : {}),
    })
    if (slow) {
        // eslint-disable-next-line no-console
        console.warn(line)
    } else {
        // eslint-disable-next-line no-console
        console.log(line)
    }

    return NextResponse.json({ ok: true })
}
