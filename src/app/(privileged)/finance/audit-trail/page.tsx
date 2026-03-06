// @ts-nocheck
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
  User, Clock, FileText, Filter, Eye, Shield, Activity
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const ACTION_CONFIG: Record<string, { icon: any, color: string, bg: string, glow: string }> = {
  CREATE: { icon: Plus, color: 'text-app-success', bg: 'bg-app-primary-light border-app-success', glow: 'shadow-[0_0_15px_var(--app-success)]' },
  UPDATE: { icon: Edit, color: 'text-app-info', bg: 'bg-app-info-bg border-app-info', glow: 'shadow-[0_0_15px_var(--app-info)]' },
  DELETE: { icon: Trash2, color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', glow: 'shadow-[0_0_15px_color-mix(in srgb, var(--app-error) 30%, transparent)]' },
  POST: { icon: Send, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]' },
  REVERSE: { icon: RotateCcw, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]' },
}

export default function AuditTrailPage() {
  const [data, setData] = useState<AuditTrailResponse>({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterModel, setFilterModel] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const settings = useListViewSettings('fin_audit_trail', {
    columns: ['timestamp', 'change_type', 'model_name', 'object_id', 'actor'],
    pageSize: 25, sortKey: 'timestamp', sortDir: 'desc'
  })

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
        <div className="app-page flex flex-col">
          <span className="font-medium text-app-foreground text-sm">
            {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '—'}
          </span>
          <span className="text-[10px] text-app-muted-foreground font-mono">
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
      render: (log) => <span className="font-bold text-app-muted-foreground text-sm">{log.model_name}</span>
    },
    {
      key: 'object_id',
      label: 'Object ID',
      render: (log) => <span className="font-mono text-[10px] text-app-muted-foreground">ID:{log.object_id}</span>
    },
    {
      key: 'actor',
      label: 'Performed By',
      render: (log) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-app-surface-2 flex items-center justify-center">
            <User size={12} className="text-app-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-app-muted-foreground truncate max-w-[120px]">
            {log.actor_name || log.actor || 'System'}
          </span>
        </div>
      )
    }
  ], [])

  if (loading && data.results.length === 0) {
    return (
      <div className="page-container animate-in fade-in duration-700">
        <div className="flex justify-between items-center">
          <div><Skeleton className="h-14 w-80 rounded-2xl" /><Skeleton className="h-6 w-64 mt-3 rounded-lg" /></div>
        </div>
        <Skeleton className="h-[60vh] rounded-[2rem]" />
      </div>
    )
  }

  return (
    <div className="page-container animate-in fade-in duration-700">
      {/* Standard Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
            <Activity size={32} className="text-app-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Finance</p>
            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
              Audit <span className="text-app-primary">Trail</span>
            </h1>
          </div>
        </div>
      </header>

      <TypicalListView
        title="Activity Log"
        data={data.results || []}
        loading={loading}
        getRowId={(log) => log.id}
        columns={columns}
        className="card-premium overflow-hidden border-0"
        visibleColumns={settings.visibleColumns}
        onToggleColumn={settings.toggleColumn}
        pageSize={settings.pageSize}
        onPageSizeChange={settings.setPageSize}
        sortKey={settings.sortKey}
        sortDir={settings.sortDir}
        onSort={settings.setSort}
        expandable={{
          render: (log) => (
            <div className="p-8 bg-app-surface-2/50 backdrop-blur-md border-y border-app-border overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center shadow-lg group">
                  <FileText size={18} className="text-app-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-xs font-black uppercase tracking-widest text-app-foreground">Forensic Data Payload</h4>
                  <p className="text-[10px] font-bold text-app-muted-foreground mt-1 uppercase tracking-tighter italic">Immutable Object State Snapshot</p>
                </div>
              </div>
              <div className="bg-app-background rounded-3xl p-8 shadow-2xl border border-app-border/50 max-h-[500px] overflow-y-auto custom-scrollbar relative">
                <div className="absolute top-4 right-4 text-[10px] font-black text-app-primary/30 uppercase tracking-[0.3em]">JSON Data</div>
                <pre className="text-[13px] text-app-primary/90 font-mono whitespace-pre-wrap leading-relaxed selection:bg-app-primary/30 selection:text-app-foreground">
                  {JSON.stringify(log.payload, null, 4)}
                </pre>
              </div>
            </div>
          )
        }}
        headerExtra={
          <div className="flex items-center gap-4">
            <div className="flex bg-app-background p-1 rounded-2xl border border-app-border shadow-inner px-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <Filter size={14} className="text-app-muted-foreground" />
                <select
                  value={filterAction}
                  onChange={e => { setFilterAction(e.target.value); setPage(1) }}
                  className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-app-muted-foreground focus:ring-0 outline-none cursor-pointer"
                >
                  <option value="">Actions: All</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="POST">Post</option>
                  <option value="REVERSE">Reverse</option>
                </select>
              </div>
              <div className="w-[1px] h-6 bg-app-border my-auto" />
              <div className="flex items-center gap-2 px-3 py-2">
                <Shield size={14} className="text-app-muted-foreground" />
                <select
                  value={filterModel}
                  onChange={e => { setFilterModel(e.target.value); setPage(1) }}
                  className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-app-muted-foreground focus:ring-0 outline-none cursor-pointer"
                >
                  <option value="">Resources: All</option>
                  {modelNames.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
