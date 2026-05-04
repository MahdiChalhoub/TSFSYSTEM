'use client'

/**
 * MCP Usage Analytics — Dajingo Pro redesign
 * ===========================================
 * Token consumption, costs, and usage trends. Replaces the old
 * gradient-card layout with the canonical KPI strip + theme-token
 * bar chart, conformant to design-language.md.
 */

import { useEffect, useState } from 'react'
import {
    ArrowLeft, BarChart3, RefreshCw, Zap, DollarSign, Calendar, Brain, TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, SectionCard,
} from '../_design'

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
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7' | '30' | '90'>('30')

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        setLoading(true)
        try {
            const res = await apiFetch(`/mcp/usage/?days=${period}`)
            if (res.ok) setUsage(await res.json())
        } catch {
            toast.error('Failed to load usage data')
        } finally {
            setLoading(false)
        }
    }

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
                subtitle={`${period}-day window · Token consumption, costs, trends`}
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

            {loading ? (
                <Loading />
            ) : (
                <div className="flex-1 min-h-0 grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
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
                                                title={`${d.date}: ${fmt(d.tokens)} tokens · ${d.requests} requests`}>
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
