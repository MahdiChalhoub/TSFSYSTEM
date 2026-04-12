// @ts-nocheck
'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
    Wrench, AlertTriangle, RotateCcw, Trash2, Activity,
    FileText, CheckCircle2, XCircle, Clock, Loader2,
    Printer, RefreshCw, ShieldCheck, Bug, Zap,
} from 'lucide-react'
import {
    retryPrintSession, cancelPrintSession, listPrintSessions,
} from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })
const grad = (varName: string) => ({ background: `linear-gradient(135deg, ${v(varName)}, color-mix(in srgb, ${v(varName)} 80%, black))` })

interface Props {
    sessions: any[]
    printers: any[]
    templates: any[]
    kpi: any
    onRefresh: () => void
}

export default function MaintenanceTab({ sessions, printers, templates, kpi, onRefresh }: Props) {
    const [isPending, startTransition] = useTransition()

    // Failed sessions
    const failedSessions = useMemo(() => sessions.filter(s => s.status === 'FAILED'), [sessions])

    // Stuck sessions (PRINTING for > 30 min — approximation since we don't have started_at from list view)
    const stuckSessions = useMemo(() => {
        const threshold = Date.now() - 30 * 60 * 1000
        return sessions.filter(s => {
            if (s.status !== 'PRINTING') return false
            const started = s.started_at ? new Date(s.started_at).getTime() : s.created_at ? new Date(s.created_at).getTime() : Date.now()
            return started < threshold
        })
    }, [sessions])

    // Orphan templates (inactive or no sessions)
    const orphanTemplates = useMemo(() => templates.filter(t => !t.is_active && !t.is_system), [templates])

    // Offline printers
    const offlinePrinters = useMemo(() => printers.filter(p => p.test_status === 'FAIL' || !p.is_active), [printers])

    const handleRetry = useCallback((sessionId: number) => {
        startTransition(async () => {
            const res = await retryPrintSession(sessionId)
            if (res?.id) { toast.success(`${res.session_code} requeued`); onRefresh() }
            else toast.error('Retry failed')
        })
    }, [onRefresh])

    const handleForceCancel = useCallback((sessionId: number) => {
        startTransition(async () => {
            const res = await cancelPrintSession(sessionId)
            if (res?.id) { toast.success(`${res.session_code} force-cancelled`); onRefresh() }
            else toast.error('Cancel failed')
        })
    }, [onRefresh])

    const cardStyle = "bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden"

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── Failed Sessions Recovery ── */}
            <div className={cardStyle}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background flex items-center justify-between">
                    <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><XCircle size={14} style={{ color: v('--app-error') }} /> Failed Sessions ({failedSessions.length})</h3>
                </div>
                <div className="p-3 space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {failedSessions.length === 0 ? (
                        <div className="py-8 text-center"><CheckCircle2 size={24} className="mx-auto" style={{ color: v('--app-success'), opacity: 0.3 }} /><p className="text-[10px] text-app-muted-foreground mt-2">No failed sessions ✓</p></div>
                    ) : failedSessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-app-border/30">
                            <div>
                                <span className="text-[11px] font-mono font-bold text-app-foreground">{s.session_code}</span>
                                <span className="text-[10px] text-app-muted-foreground ml-2">{s.total_labels} labels</span>
                                {s.failure_reason && <p className="text-[9px] text-rose-500 mt-0.5 max-w-[200px] truncate">{s.failure_reason}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleRetry(s.id)} disabled={isPending} className="flex items-center gap-1 px-2 h-7 rounded-lg text-[9px] font-bold hover:bg-app-primary/10" style={{ color: v('--app-primary') }}><RotateCcw size={11} /> Retry</button>
                                <button onClick={() => handleForceCancel(s.id)} disabled={isPending} className="flex items-center gap-1 px-2 h-7 rounded-lg text-[9px] font-bold hover:bg-rose-500/10 text-rose-500"><Trash2 size={11} /> Discard</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Stuck Sessions Fixer ── */}
            <div className={cardStyle}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background flex items-center justify-between">
                    <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><Clock size={14} style={{ color: v('--app-warning') }} /> Stuck Sessions ({stuckSessions.length})</h3>
                </div>
                <div className="p-3 space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {stuckSessions.length === 0 ? (
                        <div className="py-8 text-center"><Activity size={24} className="mx-auto text-app-muted-foreground opacity-20" /><p className="text-[10px] text-app-muted-foreground mt-2">No stuck sessions</p></div>
                    ) : stuckSessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-yellow-500/30" style={soft('--app-warning', 5)}>
                            <div>
                                <span className="text-[11px] font-mono font-bold text-app-foreground">{s.session_code}</span>
                                <p className="text-[9px] text-app-warning">PRINTING for &gt; 30 min</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleRetry(s.id)} disabled={isPending} className="flex items-center gap-1 px-2 h-7 rounded-lg text-[9px] font-bold hover:bg-app-warning/10" style={{ color: v('--app-warning') }}><RefreshCw size={11} /> Requeue</button>
                                <button onClick={() => handleForceCancel(s.id)} disabled={isPending} className="flex items-center gap-1 px-2 h-7 rounded-lg text-[9px] font-bold hover:bg-rose-500/10 text-rose-500"><XCircle size={11} /> Force Cancel</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Printer Diagnostics ── */}
            <div className={cardStyle}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background">
                    <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><Printer size={14} style={{ color: v('--app-info') }} /> Printer Health ({printers.length})</h3>
                </div>
                <div className="p-3 space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {printers.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-app-border/30">
                            <div className="flex items-center gap-2">
                                {p.test_status === 'PASS' ? <CheckCircle2 size={14} style={{ color: v('--app-success') }} /> : p.test_status === 'FAIL' ? <XCircle size={14} style={{ color: v('--app-error') }} /> : <AlertTriangle size={14} style={{ color: v('--app-warning') }} />}
                                <div>
                                    <span className="text-[11px] font-bold text-app-foreground">{p.name}</span>
                                    <span className="text-[9px] text-app-muted-foreground ml-2">{p.printer_type} / {p.connection_type}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-bold" style={{ color: v(p.is_active ? '--app-success' : '--app-error') }}>{p.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                                {p.last_tested_at && <p className="text-[8px] text-app-muted-foreground">{new Date(p.last_tested_at).toLocaleDateString()}</p>}
                            </div>
                        </div>
                    ))}
                    {printers.length === 0 && <p className="text-[10px] text-app-muted-foreground text-center py-4">No printers configured</p>}
                </div>
            </div>

            {/* ── Template Health ── */}
            <div className={cardStyle}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background">
                    <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><Bug size={14} style={{ color: v('--app-warning') }} /> Template Health</h3>
                </div>
                <div className="p-3 space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {orphanTemplates.length > 0 ? (
                        <>
                            <p className="text-[10px] font-bold text-app-warning">{orphanTemplates.length} inactive template(s)</p>
                            {orphanTemplates.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-app-border/30">
                                    <span className="text-[10px] text-app-foreground">{t.name} <span className="text-app-muted-foreground">({t.label_type})</span></span>
                                    <span className="text-[8px] text-app-muted-foreground">v{t.version}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="py-8 text-center"><ShieldCheck size={24} className="mx-auto" style={{ color: v('--app-success'), opacity: 0.3 }} /><p className="text-[10px] text-app-muted-foreground mt-2">All templates healthy ✓</p></div>
                    )}

                    {/* Variable validation hints */}
                    <div className="mt-3 pt-3 border-t border-app-border/30">
                        <p className="text-[9px] font-bold text-app-muted-foreground uppercase mb-1.5">Supported Variables</p>
                        <div className="flex flex-wrap gap-1">
                            {['name', 'price', 'barcode', 'sku', 'unit', 'category', 'supplier', 'packaging_name', 'date', 'note', 'variant', 'lot', 'weight'].map(v2 => (
                                <span key={v2} className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-app-background text-app-muted-foreground border border-app-border/20">{'{'}{v2}{'}'}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── System Summary (KPI) ── */}
            <div className={`${cardStyle} lg:col-span-2`}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background">
                    <h3 className="text-[12px] font-black text-app-foreground flex items-center gap-2"><Activity size={14} style={{ color: v('--app-primary') }} /> System Summary</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                        { label: 'Total Sessions', value: kpi?.total_sessions || 0, color: '--app-foreground' },
                        { label: 'Total Labels', value: kpi?.total_labels || 0, color: '--app-primary' },
                        { label: 'Printed', value: kpi?.labels_printed || 0, color: '--app-success' },
                        { label: 'Pending', value: kpi?.labels_pending || 0, color: '--app-info' },
                        { label: 'Failed', value: kpi?.failed || 0, color: '--app-error' },
                        { label: 'Cancelled', value: kpi?.cancelled || 0, color: '--app-muted-foreground' },
                        { label: 'Stuck', value: kpi?.stuck_sessions || 0, color: '--app-warning' },
                    ].map(k => (
                        <div key={k.label} className="text-center p-3 rounded-xl border border-app-border/30">
                            <p className="text-[22px] font-black" style={{ color: v(k.color) }}>{k.value}</p>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase">{k.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
