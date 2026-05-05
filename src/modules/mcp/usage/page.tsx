'use client'

/**
 * MCP Usage Analytics — Dajingo Pro redesign + cost projections
 * ==============================================================
 * Token consumption, costs, usage trends, monthly projection, and
 * daily-cap headroom. Conformant to design-language.md (no raw hex,
 * auto-fit grids, theme tokens).
 *
 * The projection panel multiplies the current daily run-rate by the
 * remaining days in the calendar month, so an org sees "we're on
 * track for $42 this month" before the bill lands. Combined with the
 * per-org daily token cap from AIScopeSuggesterConfig, the headroom
 * gauge shows how close they are to the cap right now.
 */

import { useEffect, useMemo, useState } from 'react'
import {
    ArrowLeft, BarChart3, RefreshCw, Zap, DollarSign, Calendar, Brain,
    TrendingUp, TrendingDown, Gauge, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, SectionCard,
} from '../_design'
import { getAIScopeConfig, type AIScopeConfig } from '@/app/actions/inventory/scope-suggestions'

async function apiFetch(path: string, opts?: RequestInit) {
    return fetch(`/api${path}`, { credentials: 'include', ...opts })
}

interface UsageData {
    total_tokens: number
    total_requests: number
    total_cost: number
    avg_tokens_per_request: number
    period_days: number
    daily_breakdown: { date: string; tokens: number; requests: number; cost: number }[]
    provider_breakdown: { provider: string; tokens: number; requests: number; cost: number; percentage: number }[]
}

const SERIES_COLORS = [
    'var(--app-primary)',
    'var(--app-info, #3b82f6)',
    'var(--app-success, #22c55e)',
    'var(--app-warning, #f59e0b)',
    '#8b5cf6',
]

const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
}

export default function MCPUsagePage() {
    const [usage, setUsage] = useState<UsageData | null>(null)
    const [prevPeriod, setPrevPeriod] = useState<UsageData | null>(null)
    const [aiConfig, setAIConfig] = useState<AIScopeConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7' | '30' | '90'>('30')

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        setLoading(true)
        try {
            // Current window + prior window (for the trend arrow) + AI scope
            // config (for the daily-cap headroom gauge). Parallel fetches —
            // none of them block each other.
            const [curRes, prevRes, cfg] = await Promise.all([
                apiFetch(`/mcp/usage/?days=${period}`),
                apiFetch(`/mcp/usage/?days=${period}&offset=${period}`),
                getAIScopeConfig(),
            ])
            if (curRes.ok)  setUsage(await curRes.json())
            if (prevRes.ok) setPrevPeriod(await prevRes.json())
            setAIConfig(cfg)
        } catch {
            toast.error('Failed to load usage data')
        } finally {
            setLoading(false)
        }
    }

    // Trend vs prior identical-length window. `null` when no prior data
    // (clean install) so the UI hides the arrow rather than showing 0%.
    const tokenTrend = useMemo(() => {
        if (!usage || !prevPeriod || prevPeriod.total_tokens === 0) return null
        return ((usage.total_tokens - prevPeriod.total_tokens) / prevPeriod.total_tokens) * 100
    }, [usage, prevPeriod])

    const costTrend = useMemo(() => {
        if (!usage || !prevPeriod || prevPeriod.total_cost === 0) return null
        return ((usage.total_cost - prevPeriod.total_cost) / prevPeriod.total_cost) * 100
    }, [usage, prevPeriod])

    // Monthly projection. Extrapolate the average DAILY cost of the
    // current window across the remaining days in the calendar month.
    // Conservative: only counts days where we have actual data.
    const projection = useMemo(() => {
        if (!usage || !usage.daily_breakdown?.length) return null
        const sumCost   = usage.daily_breakdown.reduce((s, d) => s + d.cost, 0)
        const sumTokens = usage.daily_breakdown.reduce((s, d) => s + d.tokens, 0)
        const days = usage.daily_breakdown.length
        const avgCost   = sumCost   / days
        const avgTokens = sumTokens / days
        const now = new Date()
        const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const daysLeftInMonth = Math.max(0, eom.getDate() - now.getDate())
        const elapsedThisMonth = now.getDate()
        const monthEndCost   = (avgCost   * elapsedThisMonth) + (avgCost   * daysLeftInMonth)
        const monthEndTokens = (avgTokens * elapsedThisMonth) + (avgTokens * daysLeftInMonth)
        return {
            avgDailyCost: avgCost,
            avgDailyTokens: avgTokens,
            monthEndCost,
            monthEndTokens,
            daysLeftInMonth,
        }
    }, [usage])

    // Daily-cap headroom: how much of today's per-org token budget has
    // already been consumed by the AI ranker (Phase 6/7 features).
    const capPct = useMemo(() => {
        if (!aiConfig?.daily_token_cap) return null
        return Math.min(100, (aiConfig.tokens_used_today / aiConfig.daily_token_cap) * 100)
    }, [aiConfig])

    const capColor = capPct === null
        ? 'var(--app-muted-foreground)'
        : capPct >= 90 ? 'var(--app-error, #ef4444)'
        : capPct >= 70 ? 'var(--app-warning, #f59e0b)'
        :                'var(--app-success, #22c55e)'

    const kpis = [
        { label: `Tokens ${period}d`,    value: fmt(usage?.total_tokens ?? 0),        icon: <Zap size={14} />,        color: 'var(--app-primary)' },
        { label: `Requests ${period}d`,  value: fmt(usage?.total_requests ?? 0),      icon: <Brain size={14} />,      color: '#8b5cf6' },
        { label: `Cost ${period}d`,      value: `$${(usage?.total_cost ?? 0).toFixed(2)}`, icon: <DollarSign size={14} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Avg Tokens/req',       value: fmt(usage?.avg_tokens_per_request ?? 0), icon: <TrendingUp size={14} />, color: 'var(--app-warning, #f59e0b)' },
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<BarChart3 size={20} className="text-white" />}
                title="Usage Analytics"
                subtitle={`${period}-day window · Tokens · Costs · Trends · Projection`}
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        {/* Period selector — segmented control */}
                        <div className="flex rounded-xl border border-app-border overflow-hidden">
                            {(['7', '30', '90'] as const).map(p => (
                                <button key={p} onClick={() => setPeriod(p)}
                                    className="text-[11px] font-bold px-3 py-1.5 transition-all"
                                    style={{
                                        background: period === p ? 'var(--app-primary)' : 'transparent',
                                        color: period === p ? 'white' : 'var(--app-muted-foreground)',
                                    }}>
                                    {p}D
                                </button>
                            ))}
                        </div>
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
                            label="Refresh" onClick={loadData} disabled={loading} />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            {/* Cap-near alert banner — surfaces when daily token cap is
                ≥90% used. This catches the "stuck wizard burning tokens"
                scenario before it locks the org out for the day. */}
            {capPct !== null && capPct >= 90 && (
                <div className="mb-3 rounded-2xl px-3 py-2.5 flex items-start gap-2.5 flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                        <AlertTriangle size={15} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-[12px] font-black text-app-foreground">
                            Daily AI cap nearly exhausted
                        </h4>
                        <p className="text-[11px] text-app-muted-foreground mt-0.5">
                            <span className="font-bold tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>
                                {Math.round(capPct)}%
                            </span> of {(aiConfig?.daily_token_cap ?? 0).toLocaleString()} tokens used.
                            Remaining AI suggestion calls today will fall back to deterministic-only output until midnight UTC.
                            Raise the cap under <a href="/mcp/settings" className="underline">MCP Settings</a>.
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <Loading />
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignContent: 'start' }}>

                    {/* Trend vs prior period */}
                    {tokenTrend !== null && (
                        <SectionCard title={`Trend vs Prior ${period}d`} icon={<TrendingUp size={11} />}>
                            <div className="px-2 py-2 grid gap-2"
                                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                                <TrendTile label="Tokens" current={fmt(usage?.total_tokens ?? 0)} pct={tokenTrend} />
                                <TrendTile label="Cost"   current={`$${(usage?.total_cost ?? 0).toFixed(2)}`} pct={costTrend} invertGood />
                            </div>
                        </SectionCard>
                    )}

                    {/* Monthly projection */}
                    {projection && (
                        <SectionCard title="Month-End Projection" icon={<DollarSign size={11} />}>
                            <div className="px-2 py-2 space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Projected cost</span>
                                    <span className="text-lg font-black tabular-nums text-app-foreground">${projection.monthEndCost.toFixed(2)}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Projected tokens</span>
                                    <span className="text-[12px] font-black tabular-nums text-app-foreground">{fmt(projection.monthEndTokens)}</span>
                                </div>
                                <div className="flex items-baseline justify-between pt-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <span className="text-[10px] font-medium text-app-muted-foreground">
                                        Avg <span className="font-bold tabular-nums">${projection.avgDailyCost.toFixed(2)}</span>/day · <span className="font-bold tabular-nums">{projection.daysLeftInMonth}d</span> remaining this month
                                    </span>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {/* Daily cap headroom (today's AI-ranker budget) */}
                    {capPct !== null && (
                        <SectionCard title="Today's AI Cap" icon={<Gauge size={11} />}>
                            <div className="px-2 py-2 space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: capColor }}>
                                        {Math.round(capPct)}% used
                                    </span>
                                    <span className="text-[11px] font-bold tabular-nums text-app-muted-foreground">
                                        {(aiConfig?.tokens_used_today ?? 0).toLocaleString()} / {(aiConfig?.daily_token_cap ?? 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${capPct}%`, background: capColor }} />
                                </div>
                                <p className="text-[10px] text-app-muted-foreground font-medium">
                                    Resets at UTC midnight. Counts AI-ranker tokens (scope + category-rule wizards) only — chat tokens not metered against this cap.
                                </p>
                            </div>
                        </SectionCard>
                    )}

                    {/* Provider breakdown */}
                    <SectionCard title="Provider Breakdown" icon={<Brain size={11} />}>
                        {usage?.provider_breakdown?.length ? (
                            <div className="space-y-2 px-1 py-1">
                                {usage.provider_breakdown.map((p, i) => {
                                    const c = SERIES_COLORS[i % SERIES_COLORS.length]
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
                                                    <span className="text-[12px] font-bold text-app-foreground truncate">{p.provider}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-app-muted-foreground tabular-nums whitespace-nowrap">
                                                    <span>{fmt(p.tokens)} tok</span>
                                                    <span>{p.requests} req</span>
                                                    <span className="text-app-foreground">${p.cost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden"
                                                style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${p.percentage}%`, background: c }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <EmptyState icon={<BarChart3 size={28} />} title="No provider data"
                                description="Make AI requests to populate this breakdown." />
                        )}
                    </SectionCard>

                    {/* Daily activity */}
                    <SectionCard title="Daily Activity" icon={<Calendar size={11} />}>
                        {usage?.daily_breakdown?.length ? (
                            <div className="px-1">
                                <div className="flex items-end gap-1 h-36">
                                    {usage.daily_breakdown.map((d, i) => {
                                        const max = Math.max(...usage!.daily_breakdown.map(x => x.tokens), 1)
                                        const h = Math.max((d.tokens / max) * 100, 2)
                                        return (
                                            <div key={i} className="flex-1 group relative"
                                                title={`${d.date}: ${fmt(d.tokens)} tokens · ${d.requests} requests · $${d.cost.toFixed(2)}`}>
                                                <div className="w-full rounded-t-md transition-all duration-500 min-h-[2px]"
                                                    style={{ height: `${h}%`, background: 'var(--app-primary)' }} />
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between text-[10px] text-app-muted-foreground font-medium mt-2 tabular-nums">
                                    <span>{usage.daily_breakdown[0]?.date}</span>
                                    <span>{usage.daily_breakdown[usage.daily_breakdown.length - 1]?.date}</span>
                                </div>
                            </div>
                        ) : (
                            <EmptyState icon={<Calendar size={28} />} title="No daily data"
                                description="Usage history will appear here." />
                        )}
                    </SectionCard>
                </div>
            )}
        </ModulePage>
    )
}

function TrendTile({
    label, current, pct, invertGood,
}: {
    label: string
    current: string
    pct: number | null
    /** When true, "down" is good (e.g. cost trending down = positive). */
    invertGood?: boolean
}) {
    if (pct === null) return null
    const isUp = pct >= 0
    const isGood = invertGood ? !isUp : isUp
    const c = isGood ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)'
    const Icon = isUp ? TrendingUp : TrendingDown
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</span>
            <span className="text-[14px] font-black tabular-nums text-app-foreground">{current}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums" style={{ color: c }}>
                <Icon size={10} />
                {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
        </div>
    )
}
