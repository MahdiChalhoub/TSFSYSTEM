'use client'

import { useState, useEffect, useMemo } from "react"
import { getAuditLogs } from "@/app/actions/finance/audit-trail"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    History, Search, Plus, Edit, Trash2, Send, RotateCcw,
    User, Clock, ChevronLeft, ChevronRight, FileText, Filter, Eye
} from "lucide-react"

const ACTION_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
    CREATE: { icon: Plus, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    UPDATE: { icon: Edit, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    DELETE: { icon: Trash2, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    POST: { icon: Send, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    REVERSE: { icon: RotateCcw, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
}

export default function AuditTrailPage() {
    const [data, setData] = useState<any>({ results: [], count: 0 })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [filterModel, setFilterModel] = useState('')
    const [filterAction, setFilterAction] = useState('')
    const [expandedRow, setExpandedRow] = useState<number | null>(null)

    useEffect(() => { loadData() }, [page, filterModel, filterAction])

    async function loadData() {
        setLoading(true)
        try {
            const result = await getAuditLogs({
                model_name: filterModel || undefined,
                change_type: filterAction || undefined,
                page,
            })
            setData(result)
        } catch {
            toast.error("Failed to load audit logs")
        } finally {
            setLoading(false)
        }
    }

    const logs = useMemo(() => {
        const items = data.results || []
        if (!search) return items
        const s = search.toLowerCase()
        return items.filter((log: any) =>
            log.model_name?.toLowerCase().includes(s) ||
            log.object_id?.toLowerCase().includes(s) ||
            JSON.stringify(log.payload)?.toLowerCase().includes(s)
        )
    }, [data, search])

    // Extract unique model names for filter
    const modelNames = useMemo(() => {
        const all = (data.results || []).map((l: any) => l.model_name).filter(Boolean)
        return [...new Set(all)] as string[]
    }, [data])

    const totalPages = Math.ceil((data.count || 0) / 50)

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <header>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                        <History size={20} className="text-white" />
                    </div>
                    Audit Trail
                </h1>
                <p className="text-sm text-gray-500 mt-2">Track all changes — who changed what, when</p>
            </header>

            {/* Filters */}
            <Card>
                <CardContent className="py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search logs..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <select
                            value={filterAction}
                            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
                            className="border rounded-lg px-3 py-2 text-sm bg-white h-9"
                        >
                            <option value="">All Actions</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                            <option value="POST">Post</option>
                            <option value="REVERSE">Reverse</option>
                        </select>
                        <select
                            value={filterModel}
                            onChange={e => { setFilterModel(e.target.value); setPage(1) }}
                            className="border rounded-lg px-3 py-2 text-sm bg-white h-9"
                        >
                            <option value="">All Models</option>
                            {modelNames.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <div className="text-xs text-gray-400 font-medium">
                            {data.count || 0} total records
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 space-y-3">
                            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <History size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No audit records found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Object ID</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead className="w-20">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log: any) => {
                                    const cfg = ACTION_CONFIG[log.change_type] || ACTION_CONFIG.UPDATE
                                    const Icon = cfg.icon
                                    const isExpanded = expandedRow === log.id
                                    return (
                                        <>
                                            <TableRow
                                                key={log.id}
                                                className="hover:bg-gray-50/50 cursor-pointer"
                                                onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                            >
                                                <TableCell>
                                                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                                                        <Icon size={14} className={cfg.color} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium text-gray-900">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString('fr-FR') : '—'}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('fr-FR') : ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${cfg.bg} ${cfg.color} border`}>
                                                        {log.change_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">{log.model_name}</TableCell>
                                                <TableCell className="font-mono text-xs text-gray-500">
                                                    {log.object_id}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <User size={14} className="text-gray-400" />
                                                        <span>{log.actor_name || log.actor || 'System'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {log.payload && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : log.id) }}
                                                        >
                                                            <Eye size={14} className="text-gray-400" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && log.payload && (
                                                <TableRow key={`${log.id}-detail`}>
                                                    <TableCell colSpan={7} className="bg-gray-50 p-0">
                                                        <div className="p-4 mx-4 my-2 bg-gray-900 rounded-lg">
                                                            <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-48">
                                                                {JSON.stringify(log.payload, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft size={16} /> Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
