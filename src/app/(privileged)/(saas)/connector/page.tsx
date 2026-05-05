'use client'

/**
 * Connector Admin Panel - Dashboard & Overview
 * ==============================================
 * SuperAdmin panel for monitoring and configuring the Connector Module.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Activity, Settings, Database, FileText,
    RefreshCw, CheckCircle2, XCircle, Clock,
    AlertTriangle, Zap, Shield, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { getConnectorDashboard, getModuleStates, cleanupExpiredBuffers } from '@/app/actions/saas/connector'

// Types
interface DashboardData {
    summary: {
        total_modules: number
        active_policies: number
        contracts_registered: number
    }
    buffer_stats: {
        pending: number
        replayed: number
        failed: number
        expired: number
    }
    decision_distribution: Record<string, number>
    recent_logs: Array<{
        id: number
        source_module: string
        target_module: string
        decision: string
        success: boolean
        created_at: string
    }>
}

interface ModuleStateInfo {
    module_code: string
    module_name: string
    state: 'available' | 'missing' | 'disabled' | 'unauthorized'
    is_available: boolean
    pending_buffers: number
    last_activity: string | null
}

const stateColors = {
    available: 'bg-app-primary',
    missing: 'bg-app-warning',
    disabled: 'bg-app-info',
    unauthorized: 'bg-app-error'
}

const stateLabels = {
    available: '🟢 Available',
    missing: '🟡 Missing',
    disabled: '🔵 Disabled',
    unauthorized: '🔴 Unauthorized'
}

export default function ConnectorDashboardPage() {
    const [dashboard, setDashboard] = useState<DashboardData | null>(null)
    const [moduleStates, setModuleStates] = useState<ModuleStateInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [dashData, states] = await Promise.all([
                getConnectorDashboard(),
                getModuleStates()
            ])
            setDashboard(dashData)
            setModuleStates(states)
        } catch {
            toast.error('Failed to load connector data')
        } finally {
            setLoading(false)
        }
    }

    async function handleRefresh() {
        setRefreshing(true)
        await loadData()
        setRefreshing(false)
        toast.success('Dashboard refreshed')
    }

    async function handleCleanup() {
        try {
            const res = await cleanupExpiredBuffers()
            if (res.success) {
                toast.success(`Cleaned up ${res.data?.expired_count || 0} expired buffers`)
                await loadData()
            } else {
                toast.error((res as any).error ?? (res as any).message)
            }
        } catch {
            toast.error('Cleanup failed')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-app-success" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-app-primary text-white shadow-lg">
                            <Zap size={28} />
                        </div>
                        <Badge className="bg-app-accent-bg text-app-accent border-app-accent px-3 py-1 font-black uppercase text-[10px]">
                            Core Infrastructure
                        </Badge>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-app-foreground tracking-tight">Connector Control</h2>
                    <p className="text-app-muted-foreground mt-2 font-medium">Module communication broker & state management</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? '...' : 'Refresh'}
                    </Button>
                    <Button
                        onClick={handleCleanup}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold text-app-warning border-app-warning hover:bg-app-warning-bg"
                    >
                        <AlertTriangle size={18} />
                        Cleanup Expired
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-app-primary border-0 text-white rounded-3xl shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white/80">Active Policies</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-black">{dashboard?.summary.active_policies || 0}</div>
                        <p className="text-app-success text-sm mt-2">Routing rules configured</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-info border-0 text-white rounded-3xl shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white/80">Registered Contracts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-black">{dashboard?.summary.contracts_registered || 0}</div>
                        <p className="text-app-info text-sm mt-2">Module declarations</p>
                    </CardContent>
                </Card>

                <Card className="bg-app-warning border-0 text-white rounded-3xl shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white/80">Pending Buffers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-black">{dashboard?.buffer_stats.pending || 0}</div>
                        <p className="text-app-warning text-sm mt-2">Awaiting replay</p>
                    </CardContent>
                </Card>
            </div>

            {/* Buffer Stats */}
            <Card className="rounded-3xl shadow-xl border-app-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Database size={24} className="text-app-accent" />
                        Buffer Queue Status
                    </CardTitle>
                    <CardDescription>Writes queued for unavailable modules</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-app-warning-bg p-6 rounded-2xl border border-app-warning">
                            <Clock className="text-app-warning mb-2" size={24} />
                            <div className="text-3xl font-black text-app-warning">{dashboard?.buffer_stats.pending || 0}</div>
                            <div className="text-sm text-app-warning font-medium">Pending</div>
                        </div>
                        <div className="bg-app-success-bg p-6 rounded-2xl border border-app-success">
                            <CheckCircle2 className="text-app-success mb-2" size={24} />
                            <div className="text-3xl font-black text-app-success">{dashboard?.buffer_stats.replayed || 0}</div>
                            <div className="text-sm text-app-success font-medium">Replayed</div>
                        </div>
                        <div className="bg-app-error-bg p-6 rounded-2xl border border-app-error">
                            <XCircle className="text-app-error mb-2" size={24} />
                            <div className="text-3xl font-black text-app-error">{dashboard?.buffer_stats.failed || 0}</div>
                            <div className="text-sm text-app-error font-medium">Failed</div>
                        </div>
                        <div className="bg-app-surface p-6 rounded-2xl border border-app-border">
                            <AlertTriangle className="text-app-muted-foreground mb-2" size={24} />
                            <div className="text-3xl font-black text-app-muted-foreground">{dashboard?.buffer_stats.expired || 0}</div>
                            <div className="text-sm text-app-muted-foreground font-medium">Expired</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Module States Grid */}
            <Card className="rounded-3xl shadow-xl border-app-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Activity size={24} className="text-app-success" />
                        Module States
                    </CardTitle>
                    <CardDescription>Current state of all registered modules</CardDescription>
                </CardHeader>
                <CardContent>
                    {moduleStates.length === 0 ? (
                        <div className="text-center py-12 text-app-muted-foreground">
                            No module states available
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {moduleStates.map((mod) => (
                                <div
                                    key={mod.module_code}
                                    className="p-5 rounded-2xl bg-app-surface border border-app-border hover:border-app-border transition-all"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-app-foreground">{mod.module_name}</span>
                                        <Badge
                                            className={`${stateColors[mod.state]} text-white border-0 text-[10px] font-bold`}
                                        >
                                            {mod.state.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-app-muted-foreground font-mono mb-2">{mod.module_code}</div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-app-muted-foreground">Pending buffers:</span>
                                        <span className={`font-bold ${mod.pending_buffers > 0 ? 'text-app-warning' : 'text-app-muted-foreground'}`}>
                                            {mod.pending_buffers}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/connector/policies">
                    <Card className="rounded-3xl border-app-border hover:border-app-accent hover:shadow-lg transition-all cursor-pointer group">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-4 rounded-2xl bg-app-accent-bg text-app-accent group-hover:bg-app-accent group-hover:text-white transition-all">
                                <Settings size={28} />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-app-foreground text-lg">Configure Policies</div>
                                <div className="text-sm text-app-muted-foreground">Set fallback behaviors</div>
                            </div>
                            <ArrowRight className="text-app-faint group-hover:text-app-accent transition-all" />
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/connector/buffer">
                    <Card className="rounded-3xl border-app-border hover:border-app-warning hover:shadow-lg transition-all cursor-pointer group">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-4 rounded-2xl bg-app-warning-bg text-app-warning group-hover:bg-app-warning group-hover:text-white transition-all">
                                <Database size={28} />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-app-foreground text-lg">Manage Buffer</div>
                                <div className="text-sm text-app-muted-foreground">View & replay requests</div>
                            </div>
                            <ArrowRight className="text-app-faint group-hover:text-app-warning transition-all" />
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/connector/logs">
                    <Card className="rounded-3xl border-app-border hover:border-app-success hover:shadow-lg transition-all cursor-pointer group">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-4 rounded-2xl bg-app-success-bg text-app-success group-hover:bg-app-primary group-hover:text-white transition-all">
                                <FileText size={28} />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-app-foreground text-lg">Routing Logs</div>
                                <div className="text-sm text-app-muted-foreground">Audit trail & debugging</div>
                            </div>
                            <ArrowRight className="text-app-faint group-hover:text-app-success transition-all" />
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Recent Activity */}
            {dashboard?.recent_logs && dashboard.recent_logs.length > 0 && (
                <Card className="rounded-3xl shadow-xl border-app-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Shield size={24} className="text-app-muted-foreground" />
                            Recent Routing Decisions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {dashboard.recent_logs.slice(0, 5).map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-center justify-between p-4 rounded-xl bg-app-surface border border-app-border"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-app-primary' : 'bg-app-error'}`} />
                                        <div>
                                            <span className="font-mono text-sm text-app-foreground">
                                                {log.source_module} → {log.target_module}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {log.decision}
                                        </Badge>
                                        <span className="text-xs text-app-muted-foreground">
                                            {new Date(log.created_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
