'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
    ArrowRightLeft, DollarSign, FileText, UserPlus, ChevronDown,
    CheckCircle2, Zap, Loader2, X, AlertTriangle, Shield,
    Database, BarChart3, Search, Filter, ArrowRight, ChevronLeft,
    Maximize2, Minimize2, Layers,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
    getMigrationPreview,
    importChartOfAccountsTemplate,
    type MigrationPreview,
    type MigrationPreviewAccount,
} from '@/app/actions/finance/coa-templates'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-coa-migrate'

interface Props {
    templateList: { key: string; name: string }[]
    currentTemplateKey: string
    accountCount: number
    journalEntryCount: number
    hasData: boolean
}

export default function MigrationPageClient({
    templateList,
    currentTemplateKey,
    accountCount,
    journalEntryCount,
    hasData,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const cameFromCOA = searchParams.get('from') === 'coa'
    const [targetKey, setTargetKey] = useState('')
    const [preview, setPreview] = useState<MigrationPreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [executing, setExecuting] = useState(false)
    const [overrides, setOverrides] = useState<Record<string, string>>({})
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        HAS_BALANCE: true,
        HAS_TRANSACTIONS: true,
        CUSTOM: true,
    })
    const [searchQuery, setSearchQuery] = useState('')
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcuts — matches Templates / COA philosophy
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ── Load Preview ──────────────────────────────────────────────
    const handleLoadPreview = useCallback(async () => {
        if (!targetKey) return
        setLoading(true)
        try {
            const data = await getMigrationPreview(targetKey)
            if (data) {
                setPreview(data)
                toast.success(`Preview loaded: ${data.summary.total_accounts} accounts analyzed`)
            } else {
                toast.error('Failed to load migration preview')
            }
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setLoading(false)
        }
    }, [targetKey])

    // ── Execute Migration ─────────────────────────────────────────
    const handleExecute = useCallback(async () => {
        if (!targetKey || !preview) return
        setExecuting(true)
        try {
            // Build account_mapping: source_code → target_code
            // Uses user overrides first, then suggested targets from preview
            const accountMapping: Record<string, string> = {}
            for (const acc of preview.accounts) {
                // Skip clean accounts that exist in both templates (same code)
                if (acc.category === 'CLEAN' && !acc.is_custom) continue

                // User override takes priority
                const targetCode = overrides[acc.code]
                    || acc.suggested_target?.code
                    || ''

                if (targetCode && targetCode !== acc.code) {
                    accountMapping[acc.code] = targetCode
                }
            }

            const result = await importChartOfAccountsTemplate(targetKey, {
                reset: true,
                account_mapping: accountMapping,
            })

            // Show detailed result
            const parts = [`Migration complete → ${targetKey.replace(/_/g, ' ')}`]
            if (result.journal_lines_remapped > 0) {
                parts.push(`${result.journal_lines_remapped} journal lines remapped`)
            }
            if (result.posting_rules_synced > 0) {
                parts.push(`${result.posting_rules_synced} posting rules synced`)
            }
            toast.success(parts.join(' • '))

            if (result.remap_errors?.length > 0) {
                toast.warning(`${result.remap_errors.length} remap warnings`, {
                    description: result.remap_errors.slice(0, 3).join('\n'),
                })
            }

            router.push('/finance/chart-of-accounts')
        } catch (e: unknown) {
            toast.error('Migration failed: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setExecuting(false)
        }
    }, [targetKey, preview, overrides, router])

    // ── Filter accounts ───────────────────────────────────────────
    const filteredAccounts = useMemo(() => {
        if (!preview) return []
        let accounts = preview.accounts
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            accounts = accounts.filter(a =>
                a.code.toLowerCase().includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.parent_name?.toLowerCase().includes(q)
            )
        }
        if (filterCategory !== 'all') {
            if (filterCategory === 'CUSTOM') {
                accounts = accounts.filter(a => a.is_custom)
            } else {
                accounts = accounts.filter(a => a.category === filterCategory)
            }
        }
        return accounts
    }, [preview, searchQuery, filterCategory])

    const withBalance = preview?.accounts.filter(a => a.category === 'HAS_BALANCE') || []
    const withTxns = preview?.accounts.filter(a => a.category === 'HAS_TRANSACTIONS') || []
    const customAccounts = preview?.accounts.filter(a => a.is_custom) || []
    const cleanAccounts = preview?.accounts.filter(a => a.category === 'CLEAN' && !a.is_custom) || []

    const getTargetCode = (code: string, suggested: any) => {
        return overrides[code] || (suggested?.code ?? '')
    }

    // Interactive tour step actions — drives target select + Analyze so the preview
    // loads during the walkthrough. Uses firstAvailable directly (not state) to
    // avoid stale-closure issues between steps 3 and 4.
    const tourStepActions = useMemo(() => {
        const firstAvailable = templateList.find(t => t.key !== currentTemplateKey)?.key
        return {
            3: () => {
                if (!firstAvailable) return
                setTargetKey(firstAvailable)
                setPreview(null)
            },
            4: async () => {
                if (!firstAvailable) return
                setLoading(true)
                try {
                    const data = await getMigrationPreview(firstAvailable)
                    if (data) setPreview(data)
                } catch { /* silent during tour */ } finally {
                    setLoading(false)
                }
            },
        }
    }, [templateList, currentTemplateKey])

    const sections = [
        {
            key: 'HAS_BALANCE',
            label: 'Accounts with Balance',
            icon: <DollarSign size={15} />,
            color: 'var(--app-danger, #ef4444)',
            bgColor: 'color-mix(in srgb, var(--app-danger, #ef4444) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--app-danger, #ef4444) 25%, transparent)',
            accounts: withBalance,
            description: 'Non-zero balances — journal entries will be remapped to target accounts.',
        },
        {
            key: 'HAS_TRANSACTIONS',
            label: 'Accounts with Transactions',
            icon: <FileText size={15} />,
            color: 'var(--app-warning, #f59e0b)',
            bgColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
            accounts: withTxns,
            description: 'Zero balance but have journal entries that need remapping.',
        },
        {
            key: 'CUSTOM',
            label: 'Custom Sub-Accounts',
            icon: <UserPlus size={15} />,
            color: 'var(--app-info, #3b82f6)',
            bgColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
            accounts: customAccounts,
            description: 'User-added accounts not in the template. Target suggested by parent.',
        },
    ]

    // ── KPI Data (mirrors Templates/COA KPI strip pattern) ──
    const baseKpis = [
        { label: 'Current Template', value: currentTemplateKey.replace(/_/g, ' ') || 'None', icon: <Database size={14} />, color: 'var(--app-primary)' },
        { label: 'Accounts', value: accountCount, icon: <Layers size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Journal Entries', value: journalEntryCount, icon: <FileText size={14} />, color: journalEntryCount > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)' },
        { label: 'Status', value: hasData ? 'Migration Required' : 'Safe', icon: hasData ? <AlertTriangle size={14} /> : <Shield size={14} />, color: hasData ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' },
    ]
    const previewKpis = preview ? [
        { label: 'With Balance', value: preview.summary.with_balance, icon: <DollarSign size={14} />, color: 'var(--app-danger, #ef4444)' },
        { label: 'With Txns', value: preview.summary.with_transactions, icon: <FileText size={14} />, color: 'var(--app-warning, #f59e0b)' },
        { label: 'Custom', value: preview.summary.custom_accounts, icon: <UserPlus size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Clean', value: cleanAccounts.length, icon: <CheckCircle2 size={14} />, color: 'var(--app-success, #22c55e)' },
    ] : []
    const kpis = [...baseKpis, ...previewKpis]

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Page Header (hidden in focus mode) ── */}
            {!focusMode && (
                <div data-tour="migrate-header" className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {cameFromCOA && (
                            <button
                                onClick={() => router.push('/finance/chart-of-accounts')}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl border transition-all mr-1"
                                style={{
                                    color: 'var(--app-muted-foreground)',
                                    borderColor: 'var(--app-border)',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        )}
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <ArrowRightLeft size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Account Migration
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                Transform Your Chart of Accounts · No History Lost
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <PageTour tourId="finance-coa-migrate" stepActions={tourStepActions} />
                        {preview && (
                            <button data-tour="migrate-apply-btn" onClick={handleExecute} disabled={executing}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                                style={{
                                    background: executing ? 'var(--app-muted)' : 'var(--app-primary)',
                                    color: 'white',
                                    opacity: executing ? 0.6 : 1,
                                    cursor: executing ? 'wait' : 'pointer',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                }}>
                                {executing ? (
                                    <><Loader2 size={13} className="animate-spin" /> Migrating...</>
                                ) : (
                                    <><Zap size={13} /> Apply Migration &amp; Import</>
                                )}
                            </button>
                        )}
                        <button onClick={() => setFocusMode(true)} title="Focus mode (Ctrl+Q)"
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── KPI Strip (hidden in focus mode) ── */}
            {!focusMode && (
                <div data-tour="migrate-state-kpis" className="mb-4 flex-shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Unified Toolbar: target selector + analyze + search/filter ── */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
                {focusMode && (
                    <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <ArrowRightLeft size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Migration</span>
                    </div>
                )}
                <div data-tour="migrate-target-select" className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <ArrowRight size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                    <select
                        value={targetKey}
                        onChange={(e) => { setTargetKey(e.target.value); setPreview(null) }}
                        className="flex-1 text-[12px] md:text-[13px] font-bold px-3 py-2 rounded-xl outline-none transition-all"
                        style={{
                            color: 'var(--app-foreground)',
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <option value="">Select target template...</option>
                        {templateList.filter(t => t.key !== currentTemplateKey).map(t => (
                            <option key={t.key} value={t.key}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <button
                    data-tour="migrate-analyze-btn"
                    onClick={handleLoadPreview}
                    disabled={!targetKey || loading}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-all flex-shrink-0"
                    style={{
                        background: targetKey ? (loading ? 'var(--app-muted)' : 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)') : 'transparent',
                        color: targetKey ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                        borderColor: targetKey ? 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' : 'var(--app-border)',
                        opacity: !targetKey ? 0.5 : 1,
                        cursor: !targetKey ? 'not-allowed' : loading ? 'wait' : 'pointer',
                    }}>
                    {loading ? (
                        <><Loader2 size={13} className="animate-spin" /><span className="hidden sm:inline">Analyzing...</span></>
                    ) : (
                        <><BarChart3 size={13} /><span className="hidden sm:inline">Analyze Migration</span></>
                    )}
                </button>
                {preview && (
                    <>
                        <div className="relative flex-shrink-0">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search accounts... (Ctrl+K)"
                                className="w-full md:w-[180px] pl-8 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="text-[11px] font-bold px-2.5 py-2 rounded-xl border flex-shrink-0"
                            style={{
                                color: 'var(--app-foreground)',
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <option value="all">All Categories</option>
                            <option value="HAS_BALANCE">🔴 With Balance</option>
                            <option value="HAS_TRANSACTIONS">🟡 With Transactions</option>
                            <option value="CUSTOM">🔵 Custom</option>
                            <option value="CLEAN">🟢 Clean</option>
                        </select>
                    </>
                )}
                {focusMode && (
                    <button onClick={() => setFocusMode(false)} title="Exit focus mode (Ctrl+Q)"
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                )}
            </div>

            {/* ── Content ── */}
            <div data-tour="migrate-sections" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl"
                style={{
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                }}>
                {!preview ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                        <Shield size={40} className="mb-3 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                            Select a target template and click &quot;Analyze Migration&quot;
                        </p>
                        <p className="text-[11px] mt-1 max-w-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                            The system will scan all accounts and show what needs attention before migration.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {sections.map(section => (
                            section.accounts.length > 0 && (
                                <div key={section.key} className="rounded-xl overflow-hidden"
                                    style={{ border: `1px solid ${section.borderColor}` }}>
                                    {/* Section Header */}
                                    <button
                                        onClick={() => setExpandedSections(p => ({ ...p, [section.key]: !p[section.key] }))}
                                        className="w-full flex items-center justify-between px-4 py-2.5 transition-all"
                                        style={{ background: section.bgColor }}>
                                        <div className="flex items-center gap-2">
                                            <span style={{ color: section.color }}>{section.icon}</span>
                                            <span className="text-[12px] font-bold" style={{ color: section.color }}>
                                                {section.label}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                                style={{ background: section.color, color: 'white' }}>
                                                {section.accounts.length}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] hidden lg:inline" style={{ color: 'var(--app-muted-foreground)' }}>
                                                {section.description}
                                            </span>
                                            <ChevronDown size={14}
                                                className="transition-transform"
                                                style={{
                                                    color: section.color,
                                                    transform: expandedSections[section.key] ? 'rotate(0)' : 'rotate(-90deg)',
                                                }} />
                                        </div>
                                    </button>

                                    {/* Section Table */}
                                    {expandedSections[section.key] && (
                                        <div style={{ background: 'var(--app-surface)' }}>
                                            {/* Table Header */}
                                            <div className="grid gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                                                style={{
                                                    gridTemplateColumns: '80px 1fr 100px 70px 1fr 90px',
                                                    color: 'var(--app-muted-foreground)',
                                                    borderBottom: '1px solid var(--app-border)',
                                                }}>
                                                <span>Code</span>
                                                <span>Source Account</span>
                                                <span className="text-right">Balance</span>
                                                <span className="text-center">Txns</span>
                                                <span>→ Target Account</span>
                                                <span className="text-center">Match</span>
                                            </div>
                                            {/* Rows */}
                                            {section.accounts.map(acc => (
                                                <AccountRow
                                                    key={acc.code}
                                                    acc={acc}
                                                    targetCode={getTargetCode(acc.code, acc.suggested_target)}
                                                    targetAccounts={preview.target_template_accounts}
                                                    onOverride={(code, value) => setOverrides(p => ({ ...p, [code]: value }))}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        ))}

                        {/* ── Clean Accounts Summary ── */}
                        {cleanAccounts.length > 0 && (
                            <div className="rounded-xl px-4 py-3" style={{
                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 5%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                            }}>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} style={{ color: 'var(--app-success, #22c55e)' }} />
                                    <span className="text-[12px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                                        {cleanAccounts.length} Clean Accounts
                                    </span>
                                    <span className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                        — No data, exist in both templates. Will be migrated automatically.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold rounded-b-2xl"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none', marginTop: '-1px',
                    color: 'var(--app-muted-foreground)', backdropFilter: 'blur(10px)',
                }}>
                <div className="flex items-center gap-3 flex-wrap">
                    {preview ? (
                        <>
                            <span>{filteredAccounts.length} of {preview.summary.total_accounts} accounts shown</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{Object.keys(overrides).length} overrides</span>
                        </>
                    ) : (
                        <>
                            <span>{accountCount} current accounts</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{journalEntryCount} journal entries</span>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    Status: <span style={{ color: preview ? 'var(--app-info, #3b82f6)' : hasData ? 'var(--app-warning, #f59e0b)' : 'var(--app-success)' }}>
                        {preview ? 'Preview Loaded' : hasData ? 'Migration Required' : 'Ready'}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AccountRow — Single account row in the migration table
// ═══════════════════════════════════════════════════════════════════════════════

function AccountRow({
    acc,
    targetCode,
    targetAccounts,
    onOverride,
}: {
    acc: MigrationPreviewAccount
    targetCode: string
    targetAccounts: { code: string; name: string; type: string; parent_code: string | null }[]
    onOverride: (code: string, value: string) => void
}) {
    return (
        <div className="grid gap-2 px-4 py-2 text-[11px] items-center transition-colors hover:brightness-95"
            style={{
                gridTemplateColumns: '80px 1fr 100px 70px 1fr 90px',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            {/* Source Code */}
            <span className="font-mono font-bold" style={{ color: 'var(--app-foreground)' }}>
                {acc.code}
            </span>
            {/* Source Name + Parent */}
            <div className="truncate">
                <span style={{ color: 'var(--app-foreground)' }}>{acc.name}</span>
                {acc.parent_code && (
                    <span className="text-[9px] ml-1" style={{ color: 'var(--app-muted-foreground)' }}>
                        ← {acc.parent_code}
                    </span>
                )}
            </div>
            {/* Balance */}
            <span className="text-right font-mono font-bold" style={{
                color: acc.balance > 0 ? 'var(--app-success, #22c55e)'
                    : acc.balance < 0 ? 'var(--app-danger, #ef4444)'
                        : 'var(--app-muted-foreground)',
            }}>
                {acc.balance !== 0 ? acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
            </span>
            {/* Transaction Count */}
            <span className="text-center font-mono" style={{
                color: acc.txn_count > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-muted-foreground)',
            }}>
                {acc.txn_count > 0 ? acc.txn_count : '—'}
            </span>
            {/* Target Account Dropdown */}
            <select
                value={targetCode}
                onChange={(e) => onOverride(acc.code, e.target.value)}
                className="text-[11px] px-2 py-1 rounded-lg border bg-transparent truncate"
                style={{
                    color: 'var(--app-foreground)',
                    borderColor: 'var(--app-border)',
                    background: 'var(--app-surface)',
                }}>
                <option value="">— Unmapped —</option>
                {targetAccounts.map(ta => (
                    <option key={ta.code} value={ta.code}>
                        {ta.code} — {ta.name}
                    </option>
                ))}
            </select>
            {/* Match Badge */}
            <div className="flex justify-center">
                {acc.suggestion_reason ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                        background: acc.suggestion_reason === 'EXACT_MATCH'
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                            : acc.suggestion_reason === 'PARENT_MATCH'
                                ? 'color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)'
                                : 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)',
                        color: acc.suggestion_reason === 'EXACT_MATCH'
                            ? 'var(--app-success, #22c55e)'
                            : acc.suggestion_reason === 'PARENT_MATCH'
                                ? 'var(--app-info, #3b82f6)'
                                : 'var(--app-warning, #f59e0b)',
                    }}>
                        {acc.suggestion_reason === 'EXACT_MATCH' ? '✓ Exact'
                            : acc.suggestion_reason === 'PARENT_MATCH' ? '↑ Parent'
                                : '~ Type'}
                    </span>
                ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{
                            background: 'color-mix(in srgb, var(--app-danger, #ef4444) 12%, transparent)',
                            color: 'var(--app-danger, #ef4444)',
                        }}>
                        ✗ Manual
                    </span>
                )}
            </div>
        </div>
    )
}
