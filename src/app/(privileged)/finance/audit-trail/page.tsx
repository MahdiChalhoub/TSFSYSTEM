'use client'

import { useState, useEffect, useMemo } from "react"
import type { AuditTrailResponse } from '@/types/erp'
import { getAuditLogs } from "@/app/actions/finance/audit-trail"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    History, Plus, Edit, Trash2, Send, RotateCcw,
    User, Clock, FileText, Filter, Eye, Shield
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"

const ACTION_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
    CREATE: { icon: Plus, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    UPDATE: { icon: Edit, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    DELETE: { icon: Trash2, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    POST: { icon: Send, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    REVERSE: { icon: RotateCcw, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
}

export default function AuditTrailPage() {
    const [data, setData] = useState<AuditTrailResponse>({ results: [], count: 0 })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [filterModel, setFilterModel] = useState('')
    const [filterAction, setFilterAction] = useState('')

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

    const modelNames = useMemo(() => {
        const all = (data.results || []).map((l: any) => l.model_name).filter(Boolean)
        return [...new Set(all)] as string[]
    }, [data])

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'timestamp',
            label: 'Timestamp',
            sortable: true,
            render: (log) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900 text-sm">
                        {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                    </span>
                </div>
            )
        },
        {
            key: 'change_type',
            label: 'Action',
            sortable: true,
            render: (log) => {
                const cfg = ACTION_CONFIG[log.change_type] || ACTION_CONFIG.UPDATE
                const Icon = cfg.icon
                return (
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <Icon size={12} className={cfg.color} />
                        </div>
                        <Badge className={`${cfg.bg} ${cfg.color} border-none shadow-none text-[10px] h-5 rounded-lg px-2`}>
                            {log.change_type}
                        </Badge>
                    </div>
                )
            }
        },
        {
            key: 'model_name',
            label: 'Model / Resource',
            sortable: true,
            render: (log) => <span className="font-bold text-gray-700 text-sm">{log.model_name}</span>
        },
        {
            key: 'object_id',
            label: 'Object ID',
            render: (log) => <span className="font-mono text-[10px] text-gray-400">ID:{log.object_id}</span>
        },
        {
            key: 'actor',
            label: 'Performed By',
            render: (log) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <User size={12} className="text-gray-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-600 truncate max-w-[120px]">
                        {log.actor_name || log.actor || 'System'}
                    </span>
                </div>
            )
        }
    ], [])

    if (loading && data.results.length === 0) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                </div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
                            <Shield size={28} className="text-white" />
                        </div>
                        Financial <span className="text-slate-600">Audit Trail</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Entry Lifecycle & Security Logging</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-stone-100 p-1 rounded-2xl shadow-inner h-12 items-center px-4">
                        <History size={18} className="text-stone-400 mr-3" />
                        <span className="text-sm font-bold text-stone-600">{data.count || 0} <span className="text-stone-400 font-medium">Logged Actions</span></span>
                    </div>
                </div>
            </header>

            <TypicalListView
                title="System Activity Logs"
                data={data.results || []}
                loading={loading}
                getRowId={(log) => log.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                expandable={{
                    render: (log) => (
                        <div className="p-6 bg-slate-50 border-t border-b border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-slate-200 rounded-lg">
                                    <FileText size={14} className="text-slate-600" />
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Raw Data Payload</h4>
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
                                <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
                                    {JSON.stringify(log.payload, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )
                }}
                headerExtra={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/50">
                            <Filter size={12} className="text-stone-400" />
                            <select
                                value={filterAction}
                                onChange={e => { setFilterAction(e.target.value); setPage(1) }}
                                className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider text-stone-600 focus:ring-0 active:ring-0 outline-none"
                            >
                                <option value="">All Actions</option>
                                <option value="CREATE">Create</option>
                                <option value="UPDATE">Update</option>
                                <option value="DELETE">Delete</option>
                                <option value="POST">Post</option>
                                <option value="REVERSE">Reverse</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200/50">
                            <Shield size={12} className="text-stone-400" />
                            <select
                                value={filterModel}
                                onChange={e => { setFilterModel(e.target.value); setPage(1) }}
                                className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider text-stone-600 focus:ring-0 active:ring-0 outline-none"
                            >
                                <option value="">All Models</option>
                                {modelNames.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                }
            />
        </div>
    )
}
