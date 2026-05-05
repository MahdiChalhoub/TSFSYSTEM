'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    ClipboardList, Search, Maximize2, Minimize2,
    Calendar, User, Clock, CheckCircle2, ShieldCheck,
    AlertTriangle, ArrowRight, RotateCcw, Send, Loader2,
    Filter, RefreshCcw, History, Tag, Box, Info
} from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { format } from 'date-fns'

/* ─── Types ────────────────────────────────────────────────────── */
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

/* ─── Config ───────────────────────────────────────────────────── */
type IconLike = React.ComponentType<React.HTMLAttributes<HTMLElement> & { size?: number | string }>;
const ACTION_COLORS: Record<string, { bg: string; fg: string; icon: IconLike; colorToken: string }> = {
    create: { bg: 'var(--app-success, #22c55e)', fg: 'white', icon: PlusIcon, colorToken: '--app-success' },
    update: { bg: 'var(--app-info, #3b82f6)', fg: 'white', icon: PencilIcon, colorToken: '--app-info' },
    delete: { bg: 'var(--app-error, #ef4444)', fg: 'white', icon: TrashIcon, colorToken: '--app-error' },
    test: { bg: 'var(--app-primary, #6366f1)', fg: 'white', icon: Tag as unknown as IconLike, colorToken: '--app-primary' },
}

function PlusIcon(props: React.HTMLAttributes<HTMLSpanElement>) { return <span {...props}>＋</span> }
function PencilIcon(props: React.HTMLAttributes<HTMLSpanElement>) { return <span {...props}>✎</span> }
function TrashIcon(props: React.HTMLAttributes<HTMLSpanElement>) { return <span {...props}>✕</span> }

function getActionStyle(action: string) {
    const type = action.split('.').pop() || ''
    return ACTION_COLORS[type] || { bg: 'var(--app-muted-foreground)', fg: 'white', icon: Info, colorToken: '--app-muted-foreground' }
}

function DynamicIcon({ icon: Icon, size = 14, ...props }: { icon: React.ReactNode | React.ComponentType<{ size?: number | string }>; size?: number | string;[key: string]: unknown }) {
    if (!Icon) return null;
    // If it's already a React element (e.g. <History size={14} />)
    if (typeof Icon === 'object' && Icon !== null && '$$typeof' in (Icon as object) && (Icon as { props?: unknown }).props !== undefined) {
        return Icon as React.ReactElement;
    }
    // If it's a component (function or ForwardRef object)
    if (typeof Icon === 'function' || (typeof Icon === 'object' && Icon !== null && '$$typeof' in (Icon as object))) {
        const C = Icon as React.ComponentType<{ size?: number | string }>;
        return <C size={size} {...props} />
    }
    return Icon as React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════════════
 *  COMPONENT: Global Audit Trail Page
 * ═══════════════════════════════════════════════════════════════════ */
export default function GlobalAuditTrailPage() {
    /* ─── State ─────────────────────────────────────────────────── */
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [resourceFilter, setResourceFilter] = useState('all')
    const [actionFilter, setActionFilter] = useState('all')
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
    const [actionInProgress, setActionInProgress] = useState<string | null>(null)

    /* ─── Data Fetching ─────────────────────────────────────────── */
    const fetchEntries = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch all entries (kernel endpoint)
            const data = await erpFetch('audit-trail/')
            setEntries(Array.isArray(data) ? data : data?.results || [])
        } catch (err: unknown) {
            console.error('[AuditTrail] Fetch error:', err)
            const m = err instanceof Error ? err.message : String(err)
            toast.error(`Failed to load audit trail: ${m}`)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    /* ─── Keyboard Shortcuts ───────────────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.getElementById('audit-search')?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    /* ─── Actions ───────────────────────────────────────────────── */
    const handleAction = async (entryId: number, actionPath: string, label: string) => {
        const actingKey = `${entryId}-${actionPath}`
        setActionInProgress(actingKey)
        try {
            const updated = await erpFetch(`audit-trail/${entryId}/${actionPath}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...updated } : e))
            toast.success(`${label} recorded`)
        } catch (err: unknown) {
            const e = err as { detail?: string; message?: string } | null
            toast.error(e?.detail || e?.message || `Failed to ${label.toLowerCase()}`)
        } finally {
            setActionInProgress(null)
        }
    }

    const toggleExpand = (id: number) => {
        const next = new Set(expandedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedIds(next)
    }

    /* ─── Filtering ─────────────────────────────────────────────── */
    const uniqueResources = useMemo(() => {
        const set = new Set(entries.map(e => e.resource_type))
        return Array.from(set).sort()
    }, [entries])

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = searchQuery === '' || 
                e.resource_repr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.resource_type?.toLowerCase().includes(searchQuery.toLowerCase())
            
            const matchesResource = resourceFilter === 'all' || e.resource_type === resourceFilter
            const matchesAction = actionFilter === 'all' || e.action.split('.').pop() === actionFilter

            return matchesSearch && matchesResource && matchesAction
        })
    }, [entries, searchQuery, resourceFilter, actionFilter])

    /* ─── KPI Logic ──────────────────────────────────────────────── */
    const kpis = [
        { label: 'Total Logs', value: entries.length, icon: <History size={14} />, color: 'var(--app-primary)' },
        { label: 'Verified', value: entries.filter(e => e.verified_by).length, icon: <CheckCircle2 size={14} />, color: 'var(--app-success)' },
        { label: 'Undo Flagged', value: entries.filter(e => e.undo_requested).length, icon: <AlertTriangle size={14} />, color: 'var(--app-warning)' },
        { label: 'Resources', value: uniqueResources.length, icon: <Box size={14} />, color: 'var(--app-info)' },
    ]

    /* ═══════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════ */
    return (
        <div className={`flex flex-col h-full bg-app-background animate-in fade-in duration-300 transition-all ${focusMode ? 'p-0' : 'p-4 md:p-6'}`}>
            
            {/* ── Page Header ── */}
            <div className={`flex items-start justify-between gap-4 mb-4 ${focusMode ? 'px-6 pt-4 pb-2 bg-app-surface/40 border-b border-app-border/40' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <ClipboardList size={20} className="text-white" />
                    </div>
                    <div>
                        <h1>System Audit Trail</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {filteredEntries.length} entries · Compliance Dashboard
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={fetchEntries} disabled={loading}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                        <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button onClick={() => setFocusMode(!focusMode)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                        {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                </div>
            </div>

            {/* ── KPI Strip ── */}
            {!focusMode && (
                <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                <DynamicIcon icon={s.icon} size={14} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground truncate">{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Filters & Search ── */}
            <div className={`flex flex-wrap items-center gap-2 mb-4 ${focusMode ? 'px-6 py-2 bg-app-surface/20' : ''}`}>
                <div className="flex-1 relative min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        id="audit-search"
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search repr, username, resource... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground outline-none focus:bg-app-surface/80 transition-all"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border/50 bg-app-surface/30">
                        <Filter size={12} className="text-app-muted-foreground" />
                        <select 
                            value={resourceFilter} 
                            onChange={e => setResourceFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] font-bold text-app-foreground focus:ring-0"
                        >
                            <option value="all">All Resources</option>
                            {uniqueResources.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-app-border/50 bg-app-surface/30">
                        <Tag size={12} className="text-app-muted-foreground" />
                        <select 
                            value={actionFilter} 
                            onChange={e => setActionFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-[11px] font-bold text-app-foreground focus:ring-0"
                        >
                            <option value="all">All Actions</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Main Content Area ── */}
            <div className={`flex-1 min-h-0 bg-app-surface/30 border-app-border/50 overflow-hidden flex flex-col ${focusMode ? 'border-none' : 'border rounded-2xl'}`}>
                
                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-8 flex-shrink-0" /> {/* Icon spacer */}
                    <div className="w-32 hidden sm:block">Action</div>
                    <div className="flex-1">Resource</div>
                    <div className="w-24 hidden md:block">User</div>
                    <div className="w-32 hidden lg:block">Time</div>
                    <div className="w-24 text-right">Status</div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                            <p className="text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Scanning logs...</p>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <History size={40} className="text-app-muted-foreground mb-3 opacity-30" />
                            <p className="text-sm font-bold text-app-muted-foreground">No audit entries matching your filters</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">Try adjusting your search or resource filters.</p>
                        </div>
                    ) : filteredEntries.map(entry => {
                        const style = getActionStyle(entry.action)
                        const isExpanded = expandedIds.has(entry.id)
                        const actionType = entry.action.split('.').pop()
                        const entryDate = new Date(entry.timestamp)

                        return (
                            <div key={entry.id}
                                 className={`rounded-xl transition-all border border-app-border/40 ${isExpanded ? 'bg-app-surface/40' : 'bg-app-background hover:bg-app-surface/20 hover:translate-x-0.5'}`}>
                                
                                <button 
                                    onClick={() => toggleExpand(entry.id)}
                                    className="w-full px-4 py-3 flex items-center gap-3 text-left group"
                                >
                                    {/* Action dot */}
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black"
                                         style={{ background: style.bg, color: style.fg, boxShadow: `0 4px 10px color-mix(in srgb, ${style.bg} 25%, transparent)` }}>
                                        <DynamicIcon icon={style.icon} size={14} />
                                    </div>

                                    {/* Action Label */}
                                    <div className="w-32 hidden sm:block">
                                        <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: style.bg }}>
                                            {actionType}
                                        </div>
                                        <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                            {entry.resource_type}
                                        </div>
                                    </div>

                                    {/* Resource */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-bold text-app-foreground truncate">
                                            {entry.resource_repr || `#${entry.resource_id}`}
                                        </div>
                                        <div className="flex items-center gap-2 sm:hidden">
                                            <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1">
                                                <User size={9} /> {entry.username}
                                            </span>
                                            <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1">
                                                <Clock size={9} /> {format(entryDate, 'HH:mm')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* User (Desktop) */}
                                    <div className="w-24 hidden md:block text-[12px] font-medium text-app-foreground">
                                        {entry.username}
                                    </div>

                                    {/* Time (Desktop) */}
                                    <div className="w-32 hidden lg:block">
                                        <div className="text-[12px] font-medium text-app-foreground">
                                            {format(entryDate, 'MMM d, yyyy')}
                                        </div>
                                        <div className="text-[10px] font-bold text-app-muted-foreground uppercase">
                                            {format(entryDate, 'HH:mm:ss')}
                                        </div>
                                    </div>

                                    {/* Status Badges */}
                                    <div className="w-24 text-right flex justify-end gap-1">
                                        {entry.verified_by && (
                                            <div title="Verified" className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-success) 15%, transparent)', color: 'var(--app-success)' }}>
                                                <CheckCircle2 size={12} />
                                            </div>
                                        )}
                                        {entry.confirmed_by && (
                                            <div title="Confirmed" className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>
                                                <ShieldCheck size={12} />
                                            </div>
                                        )}
                                        {entry.undo_requested && (
                                            <div title="Undo Flagged" className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-warning)' }}>
                                                <AlertTriangle size={12} />
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-5 pb-4 pt-2 border-t border-app-border/30 animate-in slide-in-from-top-1 duration-200">
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Left: Changes Timeline */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-3 flex items-center gap-1.5">
                                                    <History size={10} /> Field Changes
                                                </p>
                                                
                                                {entry.field_changes.length === 0 ? (
                                                    <div className="p-4 rounded-xl bg-app-surface/20 border border-app-border/20 text-center">
                                                        <p className="text-[11px] font-medium text-app-muted-foreground italic">No discrete field changes recorded</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {entry.field_changes.map((fc, idx) => (
                                                            <div key={idx} className="flex flex-col p-2.5 rounded-xl bg-app-surface/20 border border-app-border/30">
                                                                <div className="text-[10px] font-black uppercase tracking-wider text-app-primary mb-1">
                                                                    {fc.field_name.replace(/_/g, ' ')}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1 min-w-0 p-1.5 rounded-lg bg-app-error/5 text-[11px] font-mono text-app-error/80 line-through truncate border border-app-error/10">
                                                                        {fc.old_value || '(empty)'}
                                                                    </div>
                                                                    <ArrowRight size={10} className="text-app-muted-foreground shrink-0" />
                                                                    <div className="flex-1 min-w-0 p-1.5 rounded-lg bg-app-success/5 text-[11px] font-mono text-app-success font-bold truncate border border-app-success/20">
                                                                        {fc.new_value || '(empty)'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Annotations & Actions */}
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-3 flex items-center gap-1.5">
                                                        <ShieldCheck size={10} /> Verification & Status
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <AnnotationCard 
                                                            label="Verified"
                                                            isActive={!!entry.verified_by}
                                                            user={entry.verified_by}
                                                            at={entry.verified_at}
                                                            icon={<CheckCircle2 size={12} />}
                                                            color="var(--app-success)"
                                                            onAction={() => handleAction(entry.id, 'verify', 'Verified')}
                                                            loading={actionInProgress === `${entry.id}-verify`}
                                                        />
                                                        <AnnotationCard 
                                                            label="Confirmed"
                                                            isActive={!!entry.confirmed_by}
                                                            user={entry.confirmed_by}
                                                            at={entry.confirmed_at}
                                                            icon={<ShieldCheck size={12} />}
                                                            color="var(--app-info)"
                                                            onAction={() => handleAction(entry.id, 'confirm', 'Confirmed')}
                                                            loading={actionInProgress === `${entry.id}-confirm`}
                                                        />
                                                        <AnnotationCard 
                                                            label="Undo Requested"
                                                            isActive={entry.undo_requested}
                                                            user={entry.details?.undo_requested_by}
                                                            at={entry.details?.undo_requested_at}
                                                            icon={<RotateCcw size={12} />}
                                                            color="var(--app-warning)"
                                                            onAction={() => handleAction(entry.id, 'undo', 'Undo Flag')}
                                                            loading={actionInProgress === `${entry.id}-undo`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Meta Details */}
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-3 flex items-center gap-1.5">
                                                        <Tag size={10} /> Raw Payload
                                                    </p>
                                                    <pre className="p-3 rounded-xl bg-app-surface/40 border border-app-border/40 text-[10px] font-mono text-app-foreground overflow-auto max-h-32 custom-scrollbar">
                                                        {JSON.stringify(entry.details, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Footer / Summary */}
                {!focusMode && (
                    <div className="px-6 py-3 flex items-center justify-between bg-app-surface/40 border-t border-app-border/50 text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                        <span>Showing {filteredEntries.length} of {entries.length} entries</span>
                        <span>Dajingo Compliance Engine v2.0</span>
                    </div>
                )}
            </div>

            {/* Global Styles */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--app-border); border-radius: 10px; }
            `}</style>
        </div>
    )
}

/* ─── Sub-Components ────────────────────────────────────────────── */
function AnnotationCard({ label, isActive, user, at, icon, color, onAction, loading }: {
    label: string;
    isActive: boolean;
    user: string | null;
    at: string | null;
    icon: React.ReactNode | React.ComponentType<{ size?: number | string }>;
    color: string;
    onAction: () => void;
    loading: boolean;
}) {
    return (
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between h-full transition-all ${isActive ? 'bg-app-background border-app-border/40' : 'bg-app-surface/20 border-app-border/20 grayscale opacity-70'}`}
             style={isActive ? { borderLeft: `3px solid ${color}` } : {}}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                         style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
                        <DynamicIcon icon={icon} size={12} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-app-foreground">{label}</span>
                </div>
                {!isActive && (
                    <button 
                        onClick={e => { e.stopPropagation(); onAction(); }}
                        disabled={loading}
                        className="p-1 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <PlusIcon className="text-[12px] font-black" />}
                    </button>
                )}
            </div>
            
            {isActive ? (
                <div className="mt-1">
                    <div className="text-[10px] font-bold text-app-foreground flex items-center gap-1">
                        <User size={8} className="text-app-muted-foreground" /> {user}
                    </div>
                    <div className="text-[9px] font-medium text-app-muted-foreground flex items-center gap-1">
                        <Clock size={8} className="text-app-muted-foreground" /> {at ? format(new Date(at), 'MMM d, HH:mm') : '—'}
                    </div>
                </div>
            ) : (
                <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest italic mt-1">Pending</div>
            )}
        </div>
    )
}
