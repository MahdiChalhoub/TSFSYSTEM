import type React from 'react'
import {
    Coins, RefreshCcw, TrendingUp,
} from 'lucide-react'
import type { ExchangeRate, CurrencyRatePolicy } from '@/app/actions/finance/currency'

export type Period = {
    id: number
    name: string
    start_date: string
    end_date: string
    status: string
    fiscal_year: number
}

export type FiscalYear = {
    id: number
    name: string
    periods: Period[]
}

export const RATE_TYPES: ExchangeRate['rate_type'][] = ['SPOT', 'AVERAGE', 'CLOSING', 'BUDGET']

/* ─── Local design helpers (mirror /settings/regional/client.tsx) ── */
export const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))` })
export const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` })

export const SUB_TABS = [
    { key: 'rates' as const, label: 'Rates', icon: TrendingUp, color: '--app-success' },
    { key: 'policies' as const, label: 'Auto-Sync', icon: RefreshCcw, color: '--app-info' },
    { key: 'revaluations' as const, label: 'Revaluations', icon: Coins, color: '--app-warning' },
]

export type FxView = 'rates' | 'policies' | 'revaluations';

/* Health classification — keyed by the policyHealth() return value above. */
export const HEALTH_COLOR = {
    fresh:  '--app-success',
    stale:  '--app-warning',
    fail:   '--app-error',
    never:  '--app-muted-foreground',
    manual: '--app-info',
} as const
export const HEALTH_LABEL = {
    fresh:  'Healthy — synced in the last 36h',
    stale:  'Stale — last sync was over 36h ago, cron may not be running',
    fail:   'Failing — last attempt errored',
    never:  'Never synced — auto-sync hasn\'t run yet',
    manual: 'Manual provider — does not auto-sync',
} as const

/* ─── Form input styling tokens (kept inline so the file stays a single
       drop-in replacement; copy these to a shared util if reused) ── */
export const INPUT_CLS = 'px-2 py-1.5 rounded-lg text-[11px] outline-none focus:ring-2 transition-all w-full'
export const INPUT_STYLE: React.CSSProperties = {
    background: 'var(--app-background)',
    border: '1px solid var(--app-border)',
    color: 'var(--app-foreground)',
}

export function statusPill(s: string): React.CSSProperties {
    if (s === 'OPEN') return { ...soft('--app-success', 12), color: 'var(--app-success)' }
    if (s === 'CLOSED') return { ...soft('--app-muted-foreground', 12), color: 'var(--app-muted-foreground)' }
    return { ...soft('--app-info', 12), color: 'var(--app-info)' }
}

/** Classify a policy's freshness based on its last successful sync.
 *  This is the freshness rule the UI surfaces — *not* the backend's own
 *  truth. Backend-side, OK + stale rates remain valid; we just warn. */
export function policyHealth(p: CurrencyRatePolicy): 'manual' | 'never' | 'fail' | 'stale' | 'fresh' {
    if (p.provider === 'MANUAL') return 'manual'
    if (!p.last_synced_at) return 'never'
    if (p.last_sync_status === 'FAIL') return 'fail'
    const ageH = (Date.now() - new Date(p.last_synced_at).getTime()) / 36e5
    if (ageH > 36) return 'stale'
    return 'fresh'
}
