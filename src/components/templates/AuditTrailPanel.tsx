// @ts-nocheck
'use client'

/**
 * AuditTrailPanel — Reusable audit log slide-out panel
 * =====================================================
 * Shows a timeline of audit entries for a given resource type.
 * Each entry supports: Verify, Confirm, Undo/Cancel, Create Task.
 *
 * Built into TreeMasterPage so any page can add it via config.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    X, Loader2, CheckCircle2, ShieldCheck, RotateCcw,
    ClipboardList, Clock, User, ChevronDown, ChevronUp,
    AlertTriangle, ArrowRight, Send,
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'

export interface AuditTrailConfig {
    /** API endpoint prefix: e.g. "inventory/audit-trail" */
    endpoint: string
    /** resource_type filter: e.g. "category", "brand" */
    resourceType: string
    /** Panel title override */
    title?: string
}

interface AuditEntry {
    id: number
    action: string
    resource_type: string
    resource_id: number | null
    resource_repr: string
    username: string
    timestamp: string
    severity: string
    success: boolean
    details: Record<string, any>
    field_changes: Array<{
        field_name: string
        old_value: string | null
        new_value: string | null
        field_type: string
    }>
    verified_by: string | null
    verified_at: string | null
    confirmed_by: string | null
    confirmed_at: string | null
    undo_requested: boolean
}

interface Props {
    config: AuditTrailConfig
    isOpen: boolean
    onClose: () => void
}

const ACTION_COLORS: Record<string, { bg: string; fg: string; icon: string }> = {
    create: { bg: 'var(--app-success, #22c55e)', fg: 'white', icon: '＋' },
    update: { bg: 'var(--app-info, #3b82f6)', fg: 'white', icon: '✎' },
    delete: { bg: 'var(--app-error, #ef4444)', fg: 'white', icon: '✕' },
}

function getActionStyle(action: string) {
    const type = action.split('.').pop() || ''
    return ACTION_COLORS[type] || ACTION_COLORS['update']
}

function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export function AuditTrailPanel({ config, isOpen, onClose }: Props) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [actionInProgress, setActionInProgress] = useState<string | null>(null)
    const [showTaskForm, setShowTaskForm] = useState<number | null>(null)
    const [taskTitle, setTaskTitle] = useState('')
    const [taskPriority, setTaskPriority] = useState('medium')

    const fetchEntries = useCallback(async () => {
        setLoading(true)
        try {
            const data = await erpFetch(`${config.endpoint}/?resource_type=${config.resourceType}`)
            setEntries(Array.isArray(data) ? data : data?.results || [])
        } catch {
            toast.error('Failed to load audit trail')
        } finally {
            setLoading(false)
        }
    }, [config.endpoint, config.resourceType])

    useEffect(() => {
        if (isOpen) fetchEntries()
    }, [isOpen, fetchEntries])

    // Esc to close
    useEffect(() => {
        if (!isOpen) return
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [isOpen, onClose])

    const handleAction = async (entryId: number, actionPath: string, label: string) => {
        setActionInProgress(`${entryId}-${actionPath}`)
        try {
            const updated = await erpFetch(`${config.endpoint}/${entryId}/${actionPath}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updated } : e))
            toast.success(`${label} recorded`)
        } catch (err: any) {
            toast.error(err?.detail || err?.message || `Failed to ${label.toLowerCase()}`)
        } finally {
            setActionInProgress(null)
        }
    }

    const handleCreateTask = async (entry: AuditEntry) => {
        setActionInProgress(`${entry.id}-task`)
        try {
            await erpFetch(`${config.endpoint}/${entry.id}/create-task/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: taskTitle || undefined,
                    priority: taskPriority,
                }),
            })
            toast.success('Task created → check your taskboard')
            setShowTaskForm(null)
            setTaskTitle('')
            fetchEntries()
        } catch (err: any) {
            toast.error(err?.detail || 'Failed to create task')
        } finally {
            setActionInProgress(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end"
             style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-8 duration-300"
                 style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)', boxShadow: '-20px 0 60px rgba(0,0,0,0.25)' }}>

                {/* ── Header ── */}
                <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 10%, var(--app-surface)) 0%, var(--app-surface) 100%)', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                             style={{ background: 'var(--app-primary)', boxShadow: '0 6px 16px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                            <ClipboardList size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                {config.title || 'Audit Trail'}
                            </h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                {entries.length} entries · {config.resourceType}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-app-border/40"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Timeline ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-20">
                            <ClipboardList size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                            <p className="text-[13px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No audit entries yet</p>
                            <p className="text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>Changes will appear here automatically</p>
                        </div>
                    ) : entries.map(entry => {
                        const style = getActionStyle(entry.action)
                        const isExpanded = expandedId === entry.id
                        const actionType = entry.action.split('.').pop()

                        return (
                            <div key={entry.id}
                                 className="rounded-xl transition-all"
                                 style={{
                                     background: entry.undo_requested
                                         ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-background))'
                                         : 'var(--app-background)',
                                     border: `1px solid ${entry.undo_requested ? 'color-mix(in srgb, var(--app-warning) 25%, transparent)' : 'var(--app-border)'}`,
                                 }}>
                                {/* Entry header — always visible */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                    className="w-full px-3 py-2.5 flex items-start gap-2.5 text-left"
                                >
                                    {/* Action dot */}
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-black"
                                         style={{ background: style.bg, color: style.fg, boxShadow: `0 2px 8px color-mix(in srgb, ${style.bg} 30%, transparent)` }}>
                                        {style.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] font-black uppercase tracking-wide"
                                                  style={{ color: style.bg }}>
                                                {actionType}
                                            </span>
                                            <span className="text-[11px] font-bold truncate"
                                                  style={{ color: 'var(--app-foreground)' }}>
                                                {entry.resource_repr || `#${entry.resource_id}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold flex items-center gap-1"
                                                  style={{ color: 'var(--app-muted-foreground)' }}>
                                                <User size={9} /> {entry.username}
                                            </span>
                                            <span className="text-[10px] font-bold flex items-center gap-1"
                                                  style={{ color: 'var(--app-muted-foreground)' }}>
                                                <Clock size={9} /> {timeAgo(entry.timestamp)}
                                            </span>
                                        </div>

                                        {/* Status badges */}
                                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                            {entry.verified_by && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                                      style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                                    <CheckCircle2 size={8} /> Verified
                                                </span>
                                            )}
                                            {entry.confirmed_by && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                                      style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                                    <ShieldCheck size={8} /> Confirmed
                                                </span>
                                            )}
                                            {entry.undo_requested && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                                      style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                                                    <AlertTriangle size={8} /> Undo flagged
                                                </span>
                                            )}
                                            {entry.details?.tasks_created?.length > 0 && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                                      style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                                    📋 {entry.details.tasks_created.length} task{entry.details.tasks_created.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expand chevron */}
                                    <div className="flex-shrink-0 mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="px-3 pb-3 space-y-2.5 animate-in slide-in-from-top-1 duration-150"
                                         style={{ borderTop: '1px solid var(--app-border)' }}>

                                        {/* Field changes */}
                                        {entry.field_changes.length > 0 && (
                                            <div className="mt-2.5">
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5"
                                                   style={{ color: 'var(--app-muted-foreground)' }}>Field Changes</p>
                                                <div className="space-y-1">
                                                    {entry.field_changes.map((fc, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold">
                                                            <span className="font-mono px-1 py-0.5 rounded"
                                                                  style={{ background: 'var(--app-surface)', color: 'var(--app-foreground)' }}>
                                                                {fc.field_name}
                                                            </span>
                                                            {fc.old_value != null && (
                                                                <>
                                                                    <span style={{ color: 'var(--app-error)' }}>{fc.old_value || '(empty)'}</span>
                                                                    <ArrowRight size={8} style={{ color: 'var(--app-muted-foreground)' }} />
                                                                </>
                                                            )}
                                                            <span style={{ color: 'var(--app-success)' }}>{fc.new_value || '(empty)'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Timestamp full */}
                                        <p className="text-[9px] font-bold font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                            {new Date(entry.timestamp).toLocaleString()}
                                        </p>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                            {!entry.verified_by && (
                                                <button
                                                    onClick={() => handleAction(entry.id, 'verify', 'Verified')}
                                                    disabled={actionInProgress === `${entry.id}-verify`}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                                    style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 25%, transparent)' }}>
                                                    {actionInProgress === `${entry.id}-verify` ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                                                    Verify
                                                </button>
                                            )}
                                            {!entry.confirmed_by && (
                                                <button
                                                    onClick={() => handleAction(entry.id, 'confirm', 'Confirmed')}
                                                    disabled={actionInProgress === `${entry.id}-confirm`}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                                    style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 25%, transparent)' }}>
                                                    {actionInProgress === `${entry.id}-confirm` ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                                                    Confirm
                                                </button>
                                            )}
                                            {!entry.undo_requested && (
                                                <button
                                                    onClick={() => handleAction(entry.id, 'undo', 'Undo flagged')}
                                                    disabled={actionInProgress === `${entry.id}-undo`}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                                                    {actionInProgress === `${entry.id}-undo` ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                                    Undo
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const actionDisplay = entry.action.replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase())
                                                    setTaskTitle(`Review: ${actionDisplay} on ${entry.resource_repr}`)
                                                    setShowTaskForm(showTaskForm === entry.id ? null : entry.id)
                                                }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:-translate-y-0.5"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                                <ClipboardList size={10} />
                                                Create Task
                                            </button>
                                        </div>

                                        {/* Quick task creation form */}
                                        {showTaskForm === entry.id && (
                                            <div className="mt-2 p-3 rounded-xl space-y-2 animate-in slide-in-from-top-1 duration-150"
                                                 style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>
                                                    Quick Task
                                                </p>
                                                <input
                                                    value={taskTitle}
                                                    onChange={e => setTaskTitle(e.target.value)}
                                                    placeholder="Task title..."
                                                    className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold outline-none"
                                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <select value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
                                                            className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold outline-none"
                                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                        <option value="urgent">Urgent</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleCreateTask(entry)}
                                                        disabled={actionInProgress === `${entry.id}-task`}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                                        style={{ background: 'var(--app-primary)' }}>
                                                        {actionInProgress === `${entry.id}-task` ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                                        Send
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* ── Footer ── */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                        {entries.filter(e => e.verified_by).length}/{entries.length} verified
                    </span>
                    <button onClick={fetchEntries}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    )
}
