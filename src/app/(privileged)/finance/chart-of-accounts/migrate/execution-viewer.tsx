'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import {
    Play, Shield, AlertTriangle, CheckCircle2, XCircle, Loader2,
    ArrowRight, Database, Zap, Lock, Unlock, RefreshCcw, ChevronDown,
    ChevronRight, FileText, BarChart3, AlertCircle, Eye
} from 'lucide-react'
import {
    createMigrationSession, runMigrationDryRun, getMigrationSession,
    getMigrationBlockers, approveMigrationSession, executeMigrationSession,
    type MigrationSession, type MigrationPlan, type MigrationBlocker
} from '@/app/actions/finance/coa-templates'

const MODE_COLORS: Record<string, { bg: string, text: string, label: string }> = {
    RENAME_IN_PLACE: { bg: 'bg-app-info/15', text: 'text-app-info', label: 'Rename' },
    REPOINT_AND_ARCHIVE: { bg: 'bg-app-warning/15', text: 'text-app-warning', label: 'Archive' },
    MERGE_FORWARD: { bg: 'bg-[#8b5cf6]/15', text: 'text-[#8b5cf6]', label: 'Merge' },
    SPLIT_BY_OPENING_ENTRY: { bg: 'bg-app-info/15', text: 'text-app-info', label: 'Split' },
    DELETE_UNUSED: { bg: 'bg-app-error/15', text: 'text-app-error', label: 'Delete' },
    MANUAL_REVIEW: { bg: 'bg-app-warning/15', text: 'text-app-warning', label: 'Manual' },
}

const STATUS_STYLES: Record<string, { bg: string, text: string, icon: any }> = {
    DRAFT: { bg: 'bg-app-muted-foreground/15', text: 'text-app-muted-foreground', icon: FileText },
    DRY_RUN: { bg: 'bg-app-info/15', text: 'text-app-info', icon: BarChart3 },
    APPROVED: { bg: 'bg-app-success/15', text: 'text-app-success', icon: Shield },
    EXECUTING: { bg: 'bg-app-warning/15', text: 'text-app-warning', icon: Zap },
    COMPLETED: { bg: 'bg-app-success/15', text: 'text-app-success', icon: CheckCircle2 },
    FAILED: { bg: 'bg-app-error/15', text: 'text-app-error', icon: XCircle },
    PARTIAL: { bg: 'bg-app-warning/15', text: 'text-app-warning', icon: AlertTriangle },
    ROLLED_BACK: { bg: 'bg-app-muted-foreground/15', text: 'text-app-muted-foreground', icon: RefreshCcw },
}

interface Props {
    templates: { key: string; name: string }[]
    currentTemplateKey?: string
}

export default function MigrationExecutionViewer({ templates, currentTemplateKey }: Props) {
    const [isPending, startTransition] = useTransition()
    const [sourceKey, setSourceKey] = useState(currentTemplateKey || '')
    const [targetKey, setTargetKey] = useState('')
    const [session, setSession] = useState<MigrationSession | null>(null)
    const [plans, setPlans] = useState<MigrationPlan[]>([])
    const [blockers, setBlockers] = useState<MigrationBlocker[]>([])
    const [canProceed, setCanProceed] = useState(false)
    const [error, setError] = useState('')
    const [expandedModes, setExpandedModes] = useState<Set<string>>(new Set(['MANUAL_REVIEW']))
    const [activeReport, setActiveReport] = useState<'dry_run' | 'execution' | 'validation' | null>(null)

    // ── Step 1: Create Session ──
    const handleCreateSession = useCallback(() => {
        setError('')
        startTransition(async () => {
            try {
                const result = await createMigrationSession(sourceKey, targetKey)
                if (result.error) {
                    setError(result.error)
                    if (result.session_id) {
                        // Existing session — load it
                        const data = await getMigrationSession(result.session_id)
                        setSession(data.session)
                        setPlans(data.plans)
                    }
                    return
                }
                setSession({ ...result, status: 'DRAFT' } as unknown as MigrationSession)
                setPlans([])
            } catch (e: any) {
                setError(e.message || 'Failed to create session')
            }
        })
    }, [sourceKey, targetKey, startTransition])

    // ── Step 2: Run Dry-Run ──
    const handleDryRun = useCallback(() => {
        if (!session) return
        setError('')
        startTransition(async () => {
            try {
                await runMigrationDryRun(session.id)
                const data = await getMigrationSession(session.id)
                setSession(data.session)
                setPlans(data.plans)
            } catch (e: any) {
                setError(e.message || 'Dry-run failed')
            }
        })
    }, [session, startTransition])

    // ── Step 3: Check Blockers ──
    const handleCheckBlockers = useCallback(() => {
        if (!session) return
        setError('')
        startTransition(async () => {
            try {
                const result = await getMigrationBlockers(session.id)
                setBlockers(result.blockers || [])
                setCanProceed(result.can_proceed)
            } catch (e: any) {
                setError(e.message || 'Blocker check failed')
            }
        })
    }, [session, startTransition])

    // ── Step 4: Approve ──
    const handleApprove = useCallback(() => {
        if (!session) return
        setError('')
        startTransition(async () => {
            try {
                const result = await approveMigrationSession(session.id)
                if (result.error) {
                    setError(result.error)
                    return
                }
                const data = await getMigrationSession(session.id)
                setSession(data.session)
            } catch (e: any) {
                setError(e.message || 'Approval failed')
            }
        })
    }, [session, startTransition])

    // ── Step 5: Execute ──
    const handleExecute = useCallback(() => {
        if (!session) return
        if (!confirm('⚠️ This will execute the migration. Organization finances will be frozen during execution. Continue?')) return
        setError('')
        startTransition(async () => {
            try {
                const result = await executeMigrationSession(session.id)
                if (result.error) {
                    setError(result.error)
                }
                const data = await getMigrationSession(session.id)
                setSession(data.session)
                setPlans(data.plans)
            } catch (e: any) {
                setError(e.message || 'Execution failed')
            }
        })
    }, [session, startTransition])

    // ── Refresh session data ──
    const handleRefresh = useCallback(() => {
        if (!session) return
        startTransition(async () => {
            const data = await getMigrationSession(session.id)
            setSession(data.session)
            setPlans(data.plans)
        })
    }, [session, startTransition])

    // Auto-check blockers after dry-run
    useEffect(() => {
        if (session?.status === 'DRY_RUN') {
            startTransition(async () => {
                const result = await getMigrationBlockers(session.id)
                setBlockers(result.blockers || [])
                setCanProceed(result.can_proceed)
            })
        }
    }, [session?.status])

    // Group plans by mode
    const plansByMode = plans.reduce((acc, p) => {
        acc[p.migration_mode] = acc[p.migration_mode] || []
        acc[p.migration_mode].push(p)
        return acc
    }, {} as Record<string, MigrationPlan[]>)

    const statusStyle = session ? STATUS_STYLES[session.status] || STATUS_STYLES.DRAFT : null

    return (
        <div className="space-y-6">
            {/* ── Header: Template Selection ── */}
            {!session && (
                <div className="rounded-2xl border border-app-border bg-app-surface/60 p-6">
                    <h2 className="text-sm font-black text-app-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Database size={16} className="text-app-primary" />
                        Create Migration Session
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-[9px] text-app-muted-foreground uppercase tracking-widest mb-1.5 font-black">Source Template</label>
                            <select
                                value={sourceKey}
                                onChange={(e) => setSourceKey(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-foreground text-[13px] font-bold focus:border-app-primary focus:ring-1 focus:ring-app-primary/30 transition-all"
                            >
                                <option value="">Select source...</option>
                                {templates.map(t => (
                                    <option key={t.key} value={t.key}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] text-app-muted-foreground uppercase tracking-widest mb-1.5 font-black">Target Template</label>
                            <select
                                value={targetKey}
                                onChange={(e) => setTargetKey(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-foreground text-[13px] font-bold focus:border-app-primary focus:ring-1 focus:ring-app-primary/30 transition-all"
                            >
                                <option value="">Select target...</option>
                                {templates.filter(t => t.key !== sourceKey).map(t => (
                                    <option key={t.key} value={t.key}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleCreateSession}
                        disabled={!sourceKey || !targetKey || isPending}
                        className="w-full py-3 rounded-xl bg-app-primary text-white font-black text-[11px] uppercase tracking-widest hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Create Session & Analyze
                    </button>
                </div>
            )}

            {/* ── Error Display ── */}
            {error && (
                <div className="rounded-xl border bg-app-surface/50 p-4 flex items-start gap-3"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                    <AlertCircle size={16} className="text-app-error mt-0.5 shrink-0" />
                    <p className="text-[13px] font-bold text-app-error">{error}</p>
                    <button onClick={() => setError('')} className="ml-auto text-app-error hover:text-app-error/80">✕</button>
                </div>
            )}

            {/* ── Session Status Bar ── */}
            {session && statusStyle && (
                <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${statusStyle.bg} flex items-center justify-center`}>
                                <statusStyle.icon size={18} className={statusStyle.text} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-app-foreground uppercase tracking-wider">
                                    Session #{session.id} — <span className={statusStyle.text}>{session.status}</span>
                                </h3>
                                <p className="text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {session.source_name || session.source_key} → {session.target_name || session.target_key}
                                    {session.is_locked && <span className="ml-2 text-app-warning">🔒 Org Frozen</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleRefresh} disabled={isPending}
                                className="w-8 h-8 rounded-lg border border-app-border hover:bg-app-surface flex items-center justify-center transition-all">
                                <RefreshCcw size={14} className={`text-app-muted-foreground ${isPending ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* ── Step Progress Bar ── */}
                    <div className="flex items-center gap-1 mb-4">
                        {['DRAFT', 'DRY_RUN', 'APPROVED', 'EXECUTING', 'COMPLETED'].map((step, i) => {
                            const stepOrder = ['DRAFT', 'DRY_RUN', 'APPROVED', 'EXECUTING', 'COMPLETED']
                            const currentIdx = stepOrder.indexOf(session.status)
                            const isActive = i <= currentIdx
                            const isCurrent = step === session.status
                            return (
                                <div key={step} className="flex-1 flex items-center gap-1">
                                    <div className={`h-1.5 flex-1 rounded-full transition-all ${isActive ? 'bg-app-primary' : 'bg-app-border'
                                        } ${isCurrent ? 'animate-pulse' : ''}`} />
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex justify-between text-[10px] text-app-muted-foreground uppercase tracking-wider">
                        <span>Draft</span><span>Dry-Run</span><span>Approved</span><span>Executing</span><span>Complete</span>
                    </div>
                </div>
            )}

            {/* ── Action Buttons ── */}
            {session && (
                <div className="flex flex-wrap gap-2">
                    {session.status === 'DRAFT' && (
                        <button onClick={handleDryRun} disabled={isPending}
                            className="flex-1 min-w-[200px] py-2.5 rounded-xl bg-app-info text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:brightness-110"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info) 25%, transparent)' }}>
                            {isPending ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                            Run Dry-Run Analysis
                        </button>
                    )}
                    {session.status === 'DRY_RUN' && (
                        <>
                            <button onClick={handleDryRun} disabled={isPending}
                                className="flex-1 min-w-[160px] py-2.5 rounded-xl border border-app-border hover:bg-app-surface text-app-foreground font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
                                <RefreshCcw size={14} /> Re-Run
                            </button>
                            <button onClick={handleApprove} disabled={isPending || !canProceed}
                                className="flex-1 min-w-[160px] py-2.5 rounded-xl bg-app-success text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:brightness-110"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-success) 25%, transparent)' }}
                                title={!canProceed ? 'Resolve blockers first' : 'Approve for execution'}>
                                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                                Approve Migration
                            </button>
                        </>
                    )}
                    {session.status === 'APPROVED' && (
                        <button onClick={handleExecute} disabled={isPending}
                            className="flex-1 min-w-[200px] py-2.5 rounded-xl bg-app-error text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:brightness-110"
                            style={{ boxShadow: '0 4px 12px color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
                            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Execute Migration
                        </button>
                    )}
                    {session.status === 'PARTIAL' && (
                        <button onClick={handleExecute} disabled={isPending}
                            className="flex-1 min-w-[200px] py-2.5 rounded-xl bg-app-warning text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:brightness-110">
                            {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            Retry Phase B
                        </button>
                    )}
                </div>
            )}

            {/* ── Blocker Panel ── */}
            {blockers.length > 0 && (
                <div className="rounded-2xl border border-app-border bg-app-surface/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-app-border flex items-center gap-2">
                        <AlertTriangle size={14} className="text-app-warning" />
                        <h3 className="text-sm font-black text-app-foreground uppercase tracking-wider">
                            Pre-Execution Checks
                        </h3>
                        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${canProceed ? 'bg-app-success/15 text-app-success' : 'bg-app-error/15 text-app-error'
                            }`}>
                            {canProceed ? '✓ All Clear' : `${blockers.filter(b => b.severity === 'BLOCKER').length} Blockers`}
                        </span>
                    </div>
                    <div className="divide-y divide-app-border/50">
                        {blockers.map((b, i) => (
                            <div key={i} className="px-5 py-3 flex items-start gap-3">
                                {b.severity === 'BLOCKER'
                                    ? <XCircle size={14} className="text-app-error mt-0.5 shrink-0" />
                                    : <AlertCircle size={14} className="text-app-warning mt-0.5 shrink-0" />
                                }
                                <div className="min-w-0">
                                    <p className="text-[11px] font-mono font-bold text-app-muted-foreground">{b.type}</p>
                                    <p className="text-[13px] font-bold text-app-foreground">{b.message}</p>
                                    {b.accounts && b.accounts.length > 0 && (
                                        <p className="text-xs text-app-muted-foreground mt-1 font-mono">
                                            {b.accounts.slice(0, 5).join(', ')}{b.accounts.length > 5 ? ` +${b.accounts.length - 5} more` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Dry-Run Report Stats ── */}
            {session?.dry_run_report?.stats && (
                <div className="rounded-2xl border border-app-border bg-app-surface/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-app-border">
                        <h3 className="text-sm font-black text-app-foreground uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 size={16} className="text-app-primary" />
                            Dry-Run Summary — {session.dry_run_report.stats.total} Accounts
                        </h3>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-0 divide-x divide-app-border/50">
                        {Object.entries(MODE_COLORS).map(([mode, style]) => {
                            const count = session.dry_run_report!.stats[mode] || 0
                            return (
                                <div key={mode} className="p-4 text-center">
                                    <div className={`text-2xl font-bold ${style.text}`}>{count}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-app-muted-foreground mt-1">{style.label}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Account Plans Table ── */}
            {plans.length > 0 && (
                <div className="rounded-2xl border border-app-border bg-app-surface/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-app-border">
                        <h3 className="text-sm font-black text-app-foreground uppercase tracking-wider flex items-center gap-2">
                            <Database size={16} className="text-app-primary" />
                            Account Migration Plans — {plans.length} total
                        </h3>
                    </div>
                    <div className="divide-y divide-app-border/30">
                        {Object.entries(plansByMode).map(([mode, modePlans]) => {
                            const style = MODE_COLORS[mode] || MODE_COLORS.MANUAL_REVIEW
                            const isExpanded = expandedModes.has(mode)
                            return (
                                <div key={mode}>
                                    <button
                                        onClick={() => {
                                            const next = new Set(expandedModes)
                                            isExpanded ? next.delete(mode) : next.add(mode)
                                            setExpandedModes(next)
                                        }}
                                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-app-surface/80 transition-colors"
                                    >
                                        {isExpanded ? <ChevronDown size={14} className="text-app-muted-foreground" /> : <ChevronRight size={14} className="text-app-muted-foreground" />}
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                            {style.label}
                                        </span>
                                        <span className="text-sm font-black text-app-foreground">{modePlans.length} accounts</span>
                                        <span className="ml-auto text-xs text-app-muted-foreground">
                                            {modePlans.filter(p => p.historically_locked).length > 0 && (
                                                <span className="mr-2">🔒 {modePlans.filter(p => p.historically_locked).length} locked</span>
                                            )}
                                            {modePlans.reduce((s, p) => s + p.balance, 0) !== 0 && (
                                                <span>Σ {modePlans.reduce((s, p) => s + p.balance, 0).toFixed(2)}</span>
                                            )}
                                        </span>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-app-border/30">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-app-muted-foreground uppercase tracking-wider">
                                                        <th className="px-5 py-2 text-left">Source</th>
                                                        <th className="px-2 py-2 text-center">→</th>
                                                        <th className="px-2 py-2 text-left">Target</th>
                                                        <th className="px-2 py-2 text-right">Balance</th>
                                                        <th className="px-2 py-2 text-right">JL</th>
                                                        <th className="px-2 py-2 text-right">PR</th>
                                                        <th className="px-2 py-2 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-app-border/20">
                                                    {modePlans.map(p => (
                                                        <tr key={p.id} className={`hover:bg-app-surface/50 ${p.is_executed ? 'opacity-60' : ''}`}>
                                                            <td className="px-5 py-2">
                                                                <span className="font-mono font-bold text-app-primary">{p.source_code}</span>
                                                                <span className="ml-2 font-bold text-app-foreground">{p.source_name}</span>
                                                            </td>
                                                            <td className="px-2 py-2 text-center text-app-muted-foreground">→</td>
                                                            <td className="px-2 py-2">
                                                                {p.target_code ? (
                                                                    <>
                                                                        <span className="font-mono font-bold text-app-success">{p.target_code}</span>
                                                                        <span className="ml-2 font-bold text-app-foreground">{p.target_name}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-app-muted-foreground italic">—</span>
                                                                )}
                                                                {p.allocation_percent && (
                                                                    <span className="ml-1 text-indigo-400 font-medium">{p.allocation_percent}%</span>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2 text-right font-mono">
                                                                {p.balance !== 0 ? (
                                                                    <span className={p.balance > 0 ? 'text-app-success' : 'text-app-error'}>
                                                                        {p.balance.toFixed(2)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-app-muted-foreground">0</span>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2 text-right font-mono text-app-muted-foreground">{p.journal_lines || '—'}</td>
                                                            <td className="px-2 py-2 text-right font-mono text-app-muted-foreground">{p.posting_rules || '—'}</td>
                                                            <td className="px-2 py-2 text-center">
                                                                {p.is_executed ? (
                                                                    <CheckCircle2 size={13} className="text-app-success inline" />
                                                                ) : p.historically_locked ? (
                                                                    <Lock size={13} className="text-app-warning inline" />
                                                                ) : null}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Reports (Execution / Validation) ── */}
            {session?.status === 'COMPLETED' && session.dry_run_report && (
                <div className="rounded-2xl border p-6 text-center"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-success) 30%, transparent)', background: 'color-mix(in srgb, var(--app-success) 5%, transparent)' }}>
                    <CheckCircle2 size={36} className="text-app-success mx-auto mb-3" />
                    <h3 className="text-lg font-black text-app-success mb-1">Migration Completed</h3>
                    <p className="text-[13px] font-bold text-app-muted-foreground">
                        All account plans have been executed. Your Chart of Accounts is now on the new template.
                    </p>
                </div>
            )}

            {session?.status === 'FAILED' && (
                <div className="rounded-2xl border p-6 text-center"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-error) 30%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                    <XCircle size={36} className="text-app-error mx-auto mb-3" />
                    <h3 className="text-lg font-black text-app-error mb-1">Migration Failed</h3>
                    <p className="text-[13px] font-bold text-app-muted-foreground">
                        Check the error report for details. The organization has been unfrozen.
                    </p>
                    {session.dry_run_report?.error && (
                        <pre className="mt-3 text-xs text-left bg-app-surface rounded-xl p-4 overflow-auto max-h-60 text-red-300">
                            {JSON.stringify(session.dry_run_report, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    )
}
