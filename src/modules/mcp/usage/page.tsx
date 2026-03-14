// @ts-nocheck
'use client'

/**
 * MCP Usage & Billing — V2 Dajingo Pro Redesign
 * ===============================================
 * Premium analytics with theme-aware cards,
 * visual bar chart, and provider breakdown.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    BarChart3, RefreshCw, TrendingUp,
    Zap, DollarSign, Calendar, ArrowUpRight, Brain, Activity
} from 'lucide-react'
import { toast } from 'sonner'

async function apiFetch(path: string, opts?: RequestInit) {
    return fetch(`/api${path}`, { credentials: 'include', ...opts })
}

interface UsageData {
    total_tokens: number
    total_requests: number
    total_cost: number
    avg_tokens_per_request: number
    period_days: number
    daily_breakdown: Array<{ date: string; tokens: number; requests: number; cost: number }>
    provider_breakdown: Array<{ provider: string; tokens: number; requests: number; cost: number; percentage: number }>
}

const PROVIDER_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1']

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

    const formatNumber = (n: number) => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
        return n.toString()
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Page Header ──────────────────────────────────────── */}
            <div
                className="rounded-[28px] p-6 md:p-8"
                style={{
                    background: 'linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-2) 100%)',
                    border: '1px solid var(--app-border)',
                    boxShadow: 'var(--app-shadow-lg)',
                }}
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-hover))',
                                boxShadow: '0 8px 24px var(--app-primary-glow)',
                            }}
                        >
                            <BarChart3 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                Usage & Billing
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                Token consumption, costs, and usage trends
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {/* Period Selector */}
                        <div className="flex rounded-xl p-1" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            {[
                                { value: '7', label: '7D' },
                                { value: '30', label: '30D' },
                                { value: '90', label: '90D' },
                            ].map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setPeriod(p.value as '7' | '30' | '90')}
                                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                                    style={period === p.value ? {
                                        background: 'var(--app-primary)',
                                        color: '#fff',
                                        boxShadow: '0 2px 8px var(--app-primary-glow)',
                                    } : {
                                        color: 'var(--app-text-muted)',
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <Button onClick={loadData} disabled={loading} variant="outline"
                            className="rounded-xl px-4 h-11 font-bold" style={{ borderColor: 'var(--app-border)' }}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>Loading analytics...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Summary Cards ─────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Tokens', value: formatNumber(usage?.total_tokens || 0), icon: Zap, desc: `Last ${period} days` },
                            { label: 'Total Requests', value: formatNumber(usage?.total_requests || 0), icon: Brain, desc: 'AI interactions' },
                            { label: 'Estimated Cost', value: `$${(usage?.total_cost || 0).toFixed(2)}`, icon: DollarSign, desc: 'Total spend' },
                            { label: 'Avg Tokens/Req', value: formatNumber(usage?.avg_tokens_per_request || 0), icon: TrendingUp, desc: 'Efficiency' },
                        ].map((stat, i) => (
                            <div
                                key={i}
                                className="rounded-[20px] p-5 transition-all duration-300 hover:translate-y-[-2px]"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                    boxShadow: 'var(--app-shadow-md)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: 'var(--app-primary-light)' }}>
                                        <stat.icon size={18} style={{ color: 'var(--app-primary)' }} />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                        style={{ background: 'var(--app-bg)', color: 'var(--app-text-muted)' }}>
                                        <ArrowUpRight size={10} className="inline mr-0.5" />
                                        {period}D
                                    </span>
                                </div>
                                <p className="text-2xl font-black" style={{ color: 'var(--app-text)' }}>{stat.value}</p>
                                <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── Provider Breakdown ────────────────────────── */}
                    <div
                        className="rounded-[28px] p-6"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                        }}
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'var(--app-primary-light)' }}>
                                <Brain size={18} style={{ color: 'var(--app-primary)' }} />
                            </div>
                            <div>
                                <h2 className="font-black text-lg" style={{ color: 'var(--app-text)' }}>Provider Breakdown</h2>
                                <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>Token consumption by AI provider</p>
                            </div>
                        </div>

                        {usage?.provider_breakdown && usage.provider_breakdown.length > 0 ? (
                            <div className="space-y-4">
                                {usage.provider_breakdown.map((provider, i) => {
                                    const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                                                    <span className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>{provider.provider}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs">
                                                    <span style={{ color: 'var(--app-text-muted)' }}>{formatNumber(provider.tokens)} tokens</span>
                                                    <span style={{ color: 'var(--app-text-muted)' }}>{provider.requests} reqs</span>
                                                    <span className="font-bold" style={{ color: 'var(--app-text)' }}>${provider.cost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--app-bg)' }}>
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000"
                                                    style={{ width: `${provider.percentage}%`, background: color }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--app-text-muted)' }} />
                                <p className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>No provider data</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Start making AI requests to see breakdown</p>
                            </div>
                        )}
                    </div>

                    {/* ── Daily Activity ────────────────────────────── */}
                    <div
                        className="rounded-[28px] p-6"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                        }}
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'var(--app-primary-light)' }}>
                                <Activity size={18} style={{ color: 'var(--app-primary)' }} />
                            </div>
                            <div>
                                <h2 className="font-black text-lg" style={{ color: 'var(--app-text)' }}>Daily Activity</h2>
                                <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                                    Requests and tokens over the last {period} days
                                </p>
                            </div>
                        </div>

                        {usage?.daily_breakdown && usage.daily_breakdown.length > 0 ? (
                            <div>
                                <div className="flex items-end gap-[2px] h-40 px-1">
                                    {usage.daily_breakdown.map((day, i) => {
                                        const maxTokens = Math.max(...usage.daily_breakdown.map(d => d.tokens), 1)
                                        const height = (day.tokens / maxTokens) * 100
                                        return (
                                            <div key={i} className="flex-1 group relative">
                                                <div
                                                    className="w-full rounded-t-md transition-all duration-500 min-h-[2px]"
                                                    style={{
                                                        height: `${Math.max(height, 2)}%`,
                                                        background: `var(--app-primary)`,
                                                        opacity: 0.6 + (height / 250),
                                                    }}
                                                />
                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 text-[10px]"
                                                    style={{ background: 'var(--app-text)', color: 'var(--app-bg)', boxShadow: 'var(--app-shadow-lg)' }}>
                                                    <div className="font-bold">{day.date}</div>
                                                    <div>{formatNumber(day.tokens)} tokens</div>
                                                    <div>{day.requests} requests</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between px-1 mt-2">
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                                        {usage.daily_breakdown[0]?.date}
                                    </span>
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-text-muted)' }}>
                                        {usage.daily_breakdown[usage.daily_breakdown.length - 1]?.date}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--app-text-muted)' }} />
                                <p className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>No daily data</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Usage history will appear here</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
