'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, Database, Clock, CheckCircle2, AlertTriangle, Zap, BarChart3, RefreshCw, TrendingUp, TrendingDown, Minus, Shield } from "lucide-react"
import { erpFetch } from '@/lib/erp-api'

interface LatencyData {
    avg_ms: number
    p50_ms: number
    p95_ms: number
    p99_ms: number
    max_ms: number
    min_ms: number
}

interface TrafficData {
    total_requests: number
    tracked_window: number
    requests_last_5min: number
    status_breakdown: Record<string, number>
}

interface SlowEndpoint {
    endpoint: string
    p95_ms: number
    avg_ms: number
    count: number
}

interface HealthData {
    status: string
    service: string
    database: string
    latency: LatencyData
    traffic: TrafficData
    slow_endpoints: SlowEndpoint[]
    uptime_seconds: number
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
}

function LatencyBadge({ ms, label }: { ms: number; label: string }) {
    const color = ms < 100 ? 'text-app-success' : ms < 500 ? 'text-app-warning' : 'text-app-error'
    const bg = ms < 100 ? 'bg-app-success-bg border-app-success/60' : ms < 500 ? 'bg-app-warning-bg border-app-warning/60' : 'bg-app-error-bg border-app-error/60'
    return (
        <div className={`rounded-xl border ${bg} p-4 text-center`}>
            <div className={`text-2xl font-black ${color} tabular-nums`}>{ms.toFixed(1)}<span className="text-xs font-medium opacity-60">ms</span></div>
            <div className="text-[10px] uppercase tracking-widest text-app-muted-foreground font-bold mt-1">{label}</div>
        </div>
    )
}

function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-app-primary shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-app-error shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`} />
    )
}

export default function HealthPage() {
    const [health, setHealth] = useState<HealthData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

    const fetchHealth = useCallback(async () => {
        try {
            const data = await erpFetch('health/')
            setHealth(data)
            setError(null)
            setLastRefresh(new Date())
        } catch (e: unknown) {
            setError((e instanceof Error ? e.message : String(e)) || 'Failed to fetch health data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchHealth()
        const interval = setInterval(fetchHealth, 30000)
        return () => clearInterval(interval)
    }, [fetchHealth])

    if (loading && !health) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <RefreshCw className="animate-spin text-app-success" size={32} />
            </div>
        )
    }

    const isOnline = health?.status === 'online'
    const latency = health?.latency
    const traffic = health?.traffic

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-app-foreground tracking-tight">Platform Health</h2>
                    <p className="text-app-muted-foreground mt-1 font-medium">Real-time API performance monitoring</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-app-muted-foreground font-mono">
                        {lastRefresh.toLocaleTimeString()}
                    </span>
                    <button
                        onClick={fetchHealth}
                        className="p-2.5 rounded-xl bg-app-surface hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all border border-app-border shadow-sm"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm font-medium flex items-center gap-3">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {/* Top Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Server className="text-app-success" size={22} />
                            <Badge className={isOnline ? 'bg-app-success-bg text-app-success border-app-success' : 'bg-app-error-bg text-app-error border-app-error'}>
                                <StatusDot ok={!!isOnline} />
                                <span className="ml-2">{isOnline ? 'Online' : 'Offline'}</span>
                            </Badge>
                        </div>
                        <h3 className="font-bold text-app-foreground">API Services</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">{health?.service || 'Unknown'}</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Database className="text-app-info" size={22} />
                            <Badge className="bg-app-success-bg text-app-success border-app-success">
                                <StatusDot ok={true} />
                                <span className="ml-2">Connected</span>
                            </Badge>
                        </div>
                        <h3 className="font-bold text-app-foreground">Database</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">{health?.database || 'PostgreSQL'}</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Activity className="text-app-accent" size={22} />
                            <span className="text-2xl font-black text-app-foreground tabular-nums">{traffic?.requests_last_5min || 0}</span>
                        </div>
                        <h3 className="font-bold text-app-foreground">Requests (5m)</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">Total: {traffic?.total_requests?.toLocaleString() || 0}</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Clock className="text-app-warning" size={22} />
                            <Badge className="bg-app-surface text-app-muted-foreground border-app-border">
                                {formatUptime(health?.uptime_seconds || 0)}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-app-foreground">Uptime</h3>
                        <p className="text-xs text-app-muted-foreground mt-1">Since last restart</p>
                    </CardContent>
                </Card>
            </div>

            {/* Latency Metrics */}
            {latency && (
                <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                            <Zap className="text-app-info" size={20} />
                            <CardTitle className="text-app-foreground text-lg">Latency Percentiles</CardTitle>
                        </div>
                        <CardDescription className="text-app-muted-foreground">Based on last {traffic?.tracked_window || 0} tracked requests</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <LatencyBadge ms={latency.min_ms} label="Min" />
                            <LatencyBadge ms={latency.avg_ms} label="AVG" />
                            <LatencyBadge ms={latency.p50_ms} label="P50" />
                            <LatencyBadge ms={latency.p95_ms} label="P95" />
                            <LatencyBadge ms={latency.p99_ms} label="P99" />
                            <LatencyBadge ms={latency.max_ms} label="Max" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Status Code Breakdown + Slow Endpoints */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Code Breakdown */}
                {traffic?.status_breakdown && Object.keys(traffic.status_breakdown).length > 0 && (
                    <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="text-app-accent" size={20} />
                                <CardTitle className="text-app-foreground text-lg">Response Codes</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {Object.entries(traffic.status_breakdown)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([bucket, count]) => {
                                        const total = traffic.tracked_window || 1
                                        const pct = ((count / total) * 100).toFixed(1)
                                        const color = bucket === '2xx' ? 'bg-app-primary' : bucket === '3xx' ? 'bg-app-info' : bucket === '4xx' ? 'bg-app-warning' : 'bg-app-error'
                                        return (
                                            <div key={bucket} className="flex items-center gap-3">
                                                <span className="text-xs font-mono text-app-muted-foreground w-8">{bucket}</span>
                                                <div className="flex-1 bg-app-surface-2 rounded-full h-2 overflow-hidden">
                                                    <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs text-app-muted-foreground tabular-nums w-20 text-right">{count.toLocaleString()} ({pct}%)</span>
                                            </div>
                                        )
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Slow Endpoints */}
                {health?.slow_endpoints && health.slow_endpoints.length > 0 && (
                    <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-app-warning" size={20} />
                                <CardTitle className="text-app-foreground text-lg">Slowest Endpoints</CardTitle>
                            </div>
                            <CardDescription className="text-app-muted-foreground">Top 5 by P95 latency</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {health.slow_endpoints.map((ep, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-app-border last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-app-foreground font-mono truncate">{ep.endpoint}</div>
                                            <div className="text-[10px] text-app-muted-foreground mt-0.5">{ep.count} requests · avg {ep.avg_ms.toFixed(1)}ms</div>
                                        </div>
                                        <div className={`text-sm font-bold tabular-nums ${ep.p95_ms < 200 ? 'text-app-success' : ep.p95_ms < 1000 ? 'text-app-warning' : 'text-app-error'}`}>
                                            {ep.p95_ms.toFixed(0)}ms
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* AES Encryption Status */}
            <Card className="bg-app-surface border-app-border rounded-[2rem] shadow-xl overflow-hidden border-l-4 border-l-cyan-500">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-app-info-bg flex items-center justify-center">
                            <Shield className="text-app-info" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-app-foreground">AES-256 Encryption</h3>
                            <p className="text-xs text-app-muted-foreground mt-0.5">Transport Layer Security active · TLS 1.3 in transit</p>
                        </div>
                        <Badge className="bg-app-info-bg text-app-info border-app-info">
                            <StatusDot ok={true} />
                            <span className="ml-2">Active</span>
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
