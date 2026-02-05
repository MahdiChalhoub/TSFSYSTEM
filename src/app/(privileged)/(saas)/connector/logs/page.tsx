'use client'

/**
 * Connector Routing Logs
 * ========================
 * Audit trail of all routing decisions made by the Connector.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft, RefreshCw, FileText, Search,
    CheckCircle2, XCircle, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { getConnectorLogs } from '@/app/actions/saas/connector'

interface LogEntry {
    id: number
    source_module: string
    target_module: string
    target_endpoint: string
    operation: string
    module_state: string
    decision: string
    policy_applied: number | null
    organization: number
    organization_name: string
    user: number | null
    user_email: string | null
    success: boolean
    response_time_ms: number
    error_message: string | null
    created_at: string
}

const decisionColors: Record<string, string> = {
    forwarded: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cached: 'bg-blue-100 text-blue-700 border-blue-200',
    empty: 'bg-gray-100 text-gray-700 border-gray-200',
    buffered: 'bg-amber-100 text-amber-700 border-amber-200',
    dropped: 'bg-red-100 text-red-700 border-red-200',
    error: 'bg-red-100 text-red-700 border-red-200',
}

const stateColors: Record<string, string> = {
    available: 'bg-emerald-500',
    missing: 'bg-amber-500',
    disabled: 'bg-blue-500',
    unauthorized: 'bg-red-500',
}

export default function ConnectorLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [filterModule, setFilterModule] = useState<string>('')
    const [filterDecision, setFilterDecision] = useState<string>('all')

    useEffect(() => {
        loadLogs()
    }, [filterModule, filterDecision])

    async function loadLogs() {
        setLoading(true)
        try {
            const filters: { module?: string; decision?: string } = {}
            if (filterModule) filters.module = filterModule
            if (filterDecision !== 'all') filters.decision = filterDecision

            const data = await getConnectorLogs(filters)
            setLogs(data)
        } catch {
            toast.error('Failed to load logs')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/connector" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium">
                        <ArrowLeft size={16} />
                        Back to Connector Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600">
                            <FileText size={28} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Routing Logs</h2>
                    <p className="text-gray-500 mt-2 font-medium">Audit trail of Connector routing decisions</p>
                </div>
                <Button
                    onClick={() => loadLogs()}
                    disabled={loading}
                    variant="outline"
                    className="rounded-2xl px-6 py-5 font-bold"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <Card className="rounded-2xl border-gray-100">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Search size={18} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Filters:</span>
                    </div>
                    <Input
                        placeholder="Filter by module..."
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="w-[200px]"
                    />
                    <Select value={filterDecision} onValueChange={setFilterDecision}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Decision" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Decisions</SelectItem>
                            <SelectItem value="forwarded">Forwarded</SelectItem>
                            <SelectItem value="cached">Cached</SelectItem>
                            <SelectItem value="empty">Empty</SelectItem>
                            <SelectItem value="buffered">Buffered</SelectItem>
                            <SelectItem value="dropped">Dropped</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Logs List */}
            <Card className="rounded-3xl shadow-xl border-gray-100">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No routing logs found</p>
                            <p className="text-sm mt-1">Logs are created when the Connector routes requests</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {logs.map((log) => (
                                <div key={log.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center justify-between gap-4 mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                {log.source_module}
                                            </span>
                                            <ArrowRight size={14} className="text-gray-300" />
                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                {log.target_module}
                                            </span>
                                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                                {log.operation}
                                            </Badge>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(log.created_at).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <Badge
                                            className={`${stateColors[log.module_state] || 'bg-gray-400'} text-white border-0 text-[10px] font-bold`}
                                        >
                                            {log.module_state?.toUpperCase() || 'UNKNOWN'}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={decisionColors[log.decision] || 'border-gray-200'}
                                        >
                                            {log.decision}
                                        </Badge>
                                        {log.response_time_ms > 0 && (
                                            <span className="text-xs text-gray-400 font-mono">
                                                {log.response_time_ms}ms
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-xs text-gray-500 font-mono">
                                        {log.target_endpoint}
                                    </div>

                                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                                        {log.organization_name && (
                                            <span>Org: {log.organization_name}</span>
                                        )}
                                        {log.user_email && (
                                            <span>User: {log.user_email}</span>
                                        )}
                                        {log.policy_applied && (
                                            <span>Policy #{log.policy_applied}</span>
                                        )}
                                    </div>

                                    {log.error_message && (
                                        <div className="mt-2 p-2 rounded bg-red-50 text-red-600 text-xs font-mono">
                                            {log.error_message}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Footer */}
            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-500">
                <strong className="text-gray-700">Note:</strong> Logs are capped at 1,000 entries for performance.
                Use filters to narrow down results. Logs older than 30 days may be automatically archived.
            </div>
        </div>
    )
}
