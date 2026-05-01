'use client'
/**
 * FX Management — orchestrator data hook.
 *
 * Holds the entire data layer (load + derived state + sync handlers)
 * extracted from FxRedesigned.tsx so the JSX orchestrator stays slim.
 *
 * Behavior is byte-identical to the original inline implementation. No
 * timing, ordering, or guard logic was changed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
    getCurrencies, getExchangeRates, getRevaluations,
    deleteRatePolicy, syncRatePolicy, syncAllRatePolicies,
    getRatePolicies, bulkCreateRatePolicies,
    type Currency, type ExchangeRate, type CurrencyRevaluation, type CurrencyRatePolicy,
} from '@/app/actions/finance/currency'
import { erpFetch } from '@/lib/erp-api'
import { msg, type FiscalYear } from '../fx/_shared'
import { type HealthKey } from './constants'

export function useFxState() {
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [rates, setRates] = useState<ExchangeRate[]>([])
    const [revals, setRevals] = useState<CurrencyRevaluation[]>([])
    const [policies, setPolicies] = useState<CurrencyRatePolicy[]>([])
    const [years, setYears] = useState<FiscalYear[]>([])
    const [loading, setLoading] = useState(true)

    // Per-row sync indicators
    const [syncingId, setSyncingId] = useState<number | null>(null)
    const [syncingAll, setSyncingAll] = useState(false)
    const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
    const [bulkBusy, setBulkBusy] = useState(false)

    /** Per-endpoint error map shown in the diagnostic strip when something
     *  failed. Empty when everything succeeded. Surfaced inline (no more
     *  silent toast that vanishes after 5 seconds). */
    const [loadErrors, setLoadErrors] = useState<Record<string, string>>({})

    /** Concurrency guard — prevents duplicate loadAll calls from
     *  React Strict Mode double-fires, fast hot-reload remounts, or rapid
     *  back-to-back retry clicks. If a load is in-flight, subsequent
     *  callers await the same promise instead of starting a new one. */
    const loadInFlight = useRef<Promise<void> | null>(null)

    useEffect(() => { void loadAll() }, [])
    async function loadAll() {
        if (loadInFlight.current) return loadInFlight.current
        const p = (async () => {
            await _doLoadAll()
        })()
        loadInFlight.current = p
        try { await p } finally { loadInFlight.current = null }
    }

    async function _doLoadAll() {
        setLoading(true)
        // Use allSettled so one failed endpoint doesn't tank the whole page.
        // Each endpoint reports its own success/failure into loadErrors so the
        // user sees exactly what's broken instead of an empty UI.
        const [cs, rs, vs, ps, ys] = await Promise.allSettled([
            getCurrencies(),
            getExchangeRates(),
            getRevaluations(),
            getRatePolicies(),
            erpFetch('finance/fiscal-years/')
                .then((r: any) => Array.isArray(r) ? r : (r?.results ?? [])),
        ])
        const next: Record<string, string> = {}
        if (cs.status === 'fulfilled') setCurrencies(cs.value); else next.currencies = msg(cs.reason)
        if (rs.status === 'fulfilled') setRates(rs.value); else next.rates = msg(rs.reason)
        if (vs.status === 'fulfilled') setRevals(vs.value); else next.revaluations = msg(vs.reason)
        if (ps.status === 'fulfilled') setPolicies(ps.value); else next.policies = msg(ps.reason)
        if (ys.status === 'fulfilled') setYears(ys.value); else next.fiscal_years = msg(ys.reason)
        setLoadErrors(next)
        if (Object.keys(next).length) {
            // Log full errors to the browser console so the user can copy them
            // even if the banner is below the fold.
            console.group('%c[FX] loadAll failures', 'color:#e11; font-weight:bold')
            for (const [k, v] of Object.entries(next)) console.error(`  ${k}: ${v}`)
            console.groupEnd()
            toast.error(`Failed to load: ${Object.keys(next).join(', ')} — see banner for details`)
        }
        setLoading(false)
    }

    /* ─── Derived state ─────────────────────────────────────────── */
    const baseCurrency = useMemo(() => currencies.find(c => c.is_base), [currencies])
    const periods = useMemo(
        () => years.flatMap(y => (y.periods ?? []).map(p => ({ ...p, fiscal_year_name: y.name }))),
        [years],
    )

    /** Latest stored rate per (from→to, rate_type, side=MID) for live row display. */
    const latestRateByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate>()
        for (const r of rates) {
            // Default to MID when reading the live rate; bid/ask are surfaced
            // separately on the policy detail drawer.
            if (r.rate_side && r.rate_side !== 'MID') continue
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const prev = m.get(k)
            if (!prev || r.effective_date > prev.effective_date) m.set(k, r)
        }
        return m
    }, [rates])

    /** All-sides lookup per (from→to, rate_type) → { MID?, BID?, ASK? }.
     *  Drives the three-side rate readout on a policy card whenever the
     *  policy has non-zero bid_spread_pct or ask_spread_pct. */
    const latestSidesByKey = useMemo(() => {
        const m = new Map<string, { MID?: ExchangeRate; BID?: ExchangeRate; ASK?: ExchangeRate }>()
        for (const r of rates) {
            const side = (r.rate_side ?? 'MID') as 'MID' | 'BID' | 'ASK'
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const slot = m.get(k) ?? {}
            const prev = slot[side]
            if (!prev || r.effective_date > prev.effective_date) slot[side] = r
            m.set(k, slot)
        }
        return m
    }, [rates])

    /** Last 30 MID rates per (from→to, rate_type) — drives the sparkline on
     *  each policy card. Sorted ascending so SVG draws left-to-right. */
    const historyByKey = useMemo(() => {
        const m = new Map<string, ExchangeRate[]>()
        for (const r of rates) {
            if (r.rate_side && r.rate_side !== 'MID') continue
            const k = `${r.from_code}→${r.to_code}|${r.rate_type}`
            const arr = m.get(k) ?? []
            arr.push(r); m.set(k, arr)
        }
        for (const arr of m.values()) {
            arr.sort((a, b) => a.effective_date.localeCompare(b.effective_date))
            if (arr.length > 30) arr.splice(0, arr.length - 30)
        }
        return m
    }, [rates])

    function policyHealth(p: CurrencyRatePolicy): HealthKey {
        if (p.provider === 'MANUAL') return 'manual'
        if (!p.last_synced_at) return 'never'
        if (p.last_sync_status === 'FAIL') return 'fail'
        const ageH = (Date.now() - new Date(p.last_synced_at).getTime()) / 36e5
        return ageH > 36 ? 'stale' : 'fresh'
    }

    /* ─── KPI / health roll-up for the rates tab — memoized so it doesn't
     *  recompute on every keystroke in the search filter. ── */
    const healthByPolicy = useMemo(() => {
        const m = new Map<number, HealthKey>()
        for (const p of policies) m.set(p.id, policyHealth(p))
        return m
    }, [policies])
    const healthCounts = useMemo(() => {
        const acc: Record<HealthKey, number> = { fresh: 0, stale: 0, fail: 0, never: 0, manual: 0 }
        for (const h of healthByPolicy.values()) acc[h] = (acc[h] ?? 0) + 1
        return acc
    }, [healthByPolicy])

    /* ─── Stale-warning banner — fires when ANY policy is approaching the
     *  36h staleness threshold (within 6h) and isn't fail/manual. Encourages
     *  the operator to hit Sync All before the cron next ticks. ── */
    const approachingStale = useMemo(() => {
        const now = Date.now()
        return policies.filter(p => {
            if (p.provider === 'MANUAL') return false
            if (!p.last_synced_at) return false
            if (p.last_sync_status === 'FAIL') return false
            const ageH = (now - new Date(p.last_synced_at).getTime()) / 36e5
            return ageH >= 30 && ageH <= 36
        }).length
    }, [policies])

    /* ─── Handlers ──────────────────────────────────────────────── */
    async function handleSyncOne(id: number) {
        setSyncingId(id)
        try {
            const r = await syncRatePolicy(id)
            if (r.success) toast.success(r.message || 'Synced')
            else toast.error(r.message || r.error || 'Sync failed')
            await loadAll()
        } finally { setSyncingId(null) }
    }
    async function handleSyncAll() {
        const eligible = policies.filter(p => p.provider !== 'MANUAL')
        if (eligible.length === 0) return
        setSyncingAll(true)
        setSyncProgress({ done: 0, total: eligible.length })
        let ok = 0, fail = 0
        try {
            if (eligible.length > 25) {
                const r = await syncAllRatePolicies()
                if (!r.success) { toast.error(r.error || 'Sync-all failed'); return }
                ok = (r.results ?? []).filter(x => x.ok).length
                fail = (r.results ?? []).filter(x => !x.ok).length
            } else {
                for (let i = 0; i < eligible.length; i++) {
                    const r = await syncRatePolicy(eligible[i].id)
                    if (r.success) ok++; else fail++
                    setSyncProgress({ done: i + 1, total: eligible.length })
                }
            }
            toast.success(`${ok} synced${fail ? ` · ${fail} failed` : ''}`)
            await loadAll()
        } finally { setSyncingAll(false); setSyncProgress(null) }
    }
    async function handleDelete(p: CurrencyRatePolicy) {
        if (!confirm(`Delete policy ${p.from_code}→${p.to_code}? Rate history is preserved.`)) return
        const r = await deleteRatePolicy(p.id)
        if (!r.success) { toast.error(r.error || 'Delete failed'); return }
        toast.success(`Removed ${p.from_code}→${p.to_code}`)
        await loadAll()
    }
    async function handleAutoConfigure() {
        setBulkBusy(true)
        try {
            const r = await bulkCreateRatePolicies({ provider: 'ECB', rate_type: 'SPOT', auto_sync: true })
            if (!r.success) { toast.error(r.error || 'Failed'); return }
            const made = r.created?.length ?? 0
            const skipped = r.skipped?.length ?? 0
            if (made === 0 && skipped > 0) toast.info('All currencies already covered')
            else toast.success(`${made} polic${made === 1 ? 'y' : 'ies'} created${skipped ? ` · ${skipped} skipped` : ''}`)
            await loadAll()
        } finally { setBulkBusy(false) }
    }

    return {
        // raw data
        currencies, rates, revals, policies, periods, years,
        loading, loadErrors, setLoadErrors,
        baseCurrency,
        // derived
        latestRateByKey, latestSidesByKey, historyByKey,
        healthByPolicy, healthCounts, approachingStale,
        // sync state
        syncingId, syncingAll, syncProgress, bulkBusy,
        // actions
        loadAll,
        handleSyncOne, handleSyncAll, handleDelete, handleAutoConfigure,
    }
}
