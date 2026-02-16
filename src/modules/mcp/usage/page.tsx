'use client'

/**
 * MCP Usage Analytics
 * ====================
 * Comprehensive usage analytics for AI token consumption, costs, and trends.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ArrowLeft, BarChart3, RefreshCw, TrendingUp, TrendingDown,
    Zap, DollarSign, Clock, Calendar, ArrowUpRight, Brain
} from 'lucide-react'
import { toast } from 'sonner'

/** Client-safe API fetch (erpFetch uses server-only cookies) */
async function apiFetch(path: string, opts?: RequestInit) {
    return fetch(`/api${path}`, { credentials: 'include', ...opts })
}

interface UsageData {
    total_tokens: number
    total_requests: number
    total_cost: number
    avg_tokens_per_request: number
    period_days: number
    daily_breakdown: Array<{
        date: string
        tokens: number
        requests: number
        cost: number
    }>
    provider_breakdown: Array<{
        provider: string
        tokens: number
        requests: number
        cost: number
        percentage: number
    }>
}

export default function MCPUsagePage() {
    const [usage, setUsage] = useState<UsageData | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7' | '30' | '90'>('30')

    useEffect(() => {
        loadData()
    }, [period])

    async function loadData() {
        setLoading(true)
        try {
            const res = await apiFetch(`/mcp/usage/?days=${period}`)
            if (res.ok) {
                const data = await res.json()
                setUsage(data)
            }
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
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/mcp" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium transition-colors">
                        <ArrowLeft size={16} />
                        Back to MCP Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
                            <BarChart3 size={28} />
                        </div>
                        <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 px-3 py-1 font-black uppercase text-[10px]">
                            Analytics
                        </Badge>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Usage Analytics</h2>
                    <p className="text-gray-500 mt-2 font-medium">
                        Token consumption, costs, and usage trends
                    </p>
                </div>
                <div className="flex gap-3">
                    {/* Period Selector */}
                    <div className="flex bg-gray-100 rounded-2xl p-1">
                        {[
                            { value: '7', label: '7D' },
                            { value: '30', label: '30D' },
                            { value: '90', label: '90D' },
                        ].map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value as '7' | '30' | '90')}
                                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all ${period === p.value
                                    ? 'bg-white text-gray-900 shadow-lg'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        onClick={loadData}
                        disabled={loading}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="w-10 h-10 animate-spin text-cyan-500" />
                        <p className="text-gray-400 font-medium">Loading analytics...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 border-0 text-white rounded-3xl shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Zap size={120} className="-mt-4 -mr-4" />
                            </div>
                            <CardContent className="p-6 relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <Zap size={20} className="text-cyan-200" />
                                    <div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                                        <ArrowUpRight size={12} />
                                        {period}D
                                    </div>
                                </div>
                                <div className="text-4xl font-black">{formatNumber(usage?.total_tokens || 0)}</div>
                                <p className="text-cyan-100 text-sm mt-1 font-medium">Total tokens</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-500 to-violet-600 border-0 text-white rounded-3xl shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 opacity-10">
                                <Brain size={120} className="-mt-4 -mr-4" />
                            </div>
                            <CardContent className="p-6 relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <Brain size={20} className="text-purple-200" />
                                    <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Requests</Badge>
                                </div>
                                <div className="text-4xl font-black">{formatNumber(usage?.total_requests || 0)}</div>
                                <p className="text-purple-100 text-sm mt-1 font-medium">Total requests</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 text-white rounded-3xl shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 opacity-10">
                                <DollarSign size={120} className="-mt-4 -mr-4" />
                            </div>
                            <CardContent className="p-6 relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <DollarSign size={20} className="text-emerald-200" />
                                    <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Cost</Badge>
                                </div>
                                <div className="text-4xl font-black">${(usage?.total_cost || 0).toFixed(2)}</div>
                                <p className="text-emerald-100 text-sm mt-1 font-medium">Est. cost</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white rounded-3xl shadow-xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 opacity-10">
                                <TrendingUp size={120} className="-mt-4 -mr-4" />
                            </div>
                            <CardContent className="p-6 relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <TrendingUp size={20} className="text-amber-200" />
                                    <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold">Average</Badge>
                                </div>
                                <div className="text-4xl font-black">{formatNumber(usage?.avg_tokens_per_request || 0)}</div>
                                <p className="text-amber-100 text-sm mt-1 font-medium">Tokens/request</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Provider Breakdown */}
                    <Card className="rounded-3xl shadow-xl border-gray-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Brain size={24} className="text-purple-500" />
                                Provider Breakdown
                            </CardTitle>
                            <CardDescription>Token consumption by AI provider</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {usage?.provider_breakdown && usage.provider_breakdown.length > 0 ? (
                                <div className="space-y-4">
                                    {usage.provider_breakdown.map((provider, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500'][i % 5]
                                                        }`} />
                                                    <span className="font-bold text-gray-900">{provider.provider}</span>
                                                </div>
                                                <div className="flex items-center gap-6 text-sm">
                                                    <span className="text-gray-500">{formatNumber(provider.tokens)} tokens</span>
                                                    <span className="text-gray-500">{provider.requests} reqs</span>
                                                    <span className="font-bold text-gray-900">${provider.cost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500'][i % 5]
                                                        }`}
                                                    style={{ width: `${provider.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">No provider data available</p>
                                    <p className="text-sm mt-1">Start making AI requests to see breakdown</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Daily Activity */}
                    <Card className="rounded-3xl shadow-xl border-gray-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Calendar size={24} className="text-cyan-500" />
                                Daily Activity
                            </CardTitle>
                            <CardDescription>Requests and tokens over the last {period} days</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {usage?.daily_breakdown && usage.daily_breakdown.length > 0 ? (
                                <div className="space-y-1">
                                    {/* Visual bar chart */}
                                    <div className="flex items-end gap-1 h-40 px-2">
                                        {usage.daily_breakdown.map((day, i) => {
                                            const maxTokens = Math.max(...usage.daily_breakdown.map(d => d.tokens), 1)
                                            const height = (day.tokens / maxTokens) * 100
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex-1 group relative"
                                                    title={`${day.date}: ${day.tokens} tokens, ${day.requests} requests`}
                                                >
                                                    <div
                                                        className="w-full bg-gradient-to-t from-cyan-500 to-blue-400 rounded-t-lg transition-all duration-500 hover:from-cyan-400 hover:to-blue-300 min-h-[2px]"
                                                        style={{ height: `${Math.max(height, 2)}%` }}
                                                    />
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                                                        <div className="font-bold">{day.date}</div>
                                                        <div>{formatNumber(day.tokens)} tokens</div>
                                                        <div>{day.requests} requests</div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Date labels */}
                                    <div className="flex justify-between px-2 text-[10px] text-gray-400 font-medium mt-2">
                                        <span>{usage.daily_breakdown[0]?.date}</span>
                                        <span>{usage.daily_breakdown[usage.daily_breakdown.length - 1]?.date}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">No daily data available</p>
                                    <p className="text-sm mt-1">Usage history will appear here</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
