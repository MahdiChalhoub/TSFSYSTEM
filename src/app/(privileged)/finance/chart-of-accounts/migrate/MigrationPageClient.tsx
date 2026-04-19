'use client'

import { useState, useCallback, useMemo } from 'react'
import {
    ArrowRightLeft, DollarSign, FileText, UserPlus, ChevronDown,
    CheckCircle2, Zap, Loader2, X, AlertTriangle, Shield,
    Database, BarChart3, Search, Filter, ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    getMigrationPreview,
    importChartOfAccountsTemplate,
    type MigrationPreview,
    type MigrationPreviewAccount,
} from '@/app/actions/finance/coa-templates'

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

    return (
        // Use --mobile-chrome when inside the mobile shell (set by MobileAdminShell),
        // falling back to desktop's 120px header+tabs allowance.
        <div className="flex flex-col h-full" style={{ height: 'calc(100dvh - var(--mobile-chrome, 120px))' }}>
            {/* ═══ TOP HEADER ═══ */}
            <div className="flex-shrink-0 rounded-t-2xl" style={{
                background: 'var(--app-surface)',
                borderBottom: '1px solid var(--app-border)',
                border: '1px solid var(--app-border)',
            }}>
                {/* Title Row */}
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                            <ArrowRightLeft size={20} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold" style={{ color: 'var(--app-foreground)' }}>
                                Account Migration
                            </h1>
                            <p className="text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                Transform your chart of accounts without losing history
                            </p>
                        </div>
                    </div>
                    {preview && (
                        <button onClick={handleExecute} disabled={executing}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                            style={{
                                background: executing ? 'var(--app-muted)' : 'var(--app-primary)',
                                color: 'white',
                                opacity: executing ? 0.6 : 1,
                                cursor: executing ? 'wait' : 'pointer',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}>
                            {executing ? (
                                <><Loader2 size={14} className="animate-spin" /> Migrating...</>
                            ) : (
                                <><Zap size={14} /> Apply Migration &amp; Import</>
                            )}
                        </button>
                    )}
                </div>

                {/* Current State KPIs — wraps on narrow viewports so the "Migration Required" badge
                    doesn't clip off the right edge on mobile. */}
                <div className="flex items-center gap-2 px-4 md:px-5 pb-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                        <Database size={12} style={{ color: 'var(--app-primary)' }} />
                        <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>
                            {currentTemplateKey.replace(/_/g, ' ') || 'None'}
                        </span>
                        <span style={{ color: 'var(--app-muted-foreground)' }}>Current Template</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                        <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>{accountCount}</span>
                        <span style={{ color: 'var(--app-muted-foreground)' }}>Accounts</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                        <span className="font-bold" style={{
                            color: journalEntryCount > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-foreground)',
                        }}>{journalEntryCount}</span>
                        <span style={{ color: 'var(--app-muted-foreground)' }}>Journal Entries</span>
                    </div>
                    {hasData && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px]"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                            }}>
                            <AlertTriangle size={11} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <span className="font-bold" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                Migration Required
                            </span>
                        </div>
                    )}
                </div>

                {/* Target Template Selection */}
                <div className="flex items-center gap-3 px-5 pb-4">
                    <div className="flex items-center gap-2 flex-1">
                        <ArrowRight size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                        <select
                            value={targetKey}
                            onChange={(e) => { setTargetKey(e.target.value); setPreview(null) }}
                            className="flex-1 text-[12px] font-bold px-3 py-2 rounded-xl border transition-all"
                            style={{
                                color: 'var(--app-foreground)',
                                borderColor: 'var(--app-border)',
                                background: 'var(--app-background)',
                            }}>
                            <option value="">Select target template...</option>
                            {templateList.filter(t => t.key !== currentTemplateKey).map(t => (
                                <option key={t.key} value={t.key}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleLoadPreview}
                        disabled={!targetKey || loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all"
                        style={{
                            background: loading ? 'var(--app-muted)' : 'var(--app-info, #3b82f6)',
                            color: 'white',
                            opacity: !targetKey ? 0.4 : 1,
                            cursor: !targetKey ? 'not-allowed' : loading ? 'wait' : 'pointer',
                        }}>
                        {loading ? (
                            <><Loader2 size={13} className="animate-spin" /> Analyzing...</>
                        ) : (
                            <><BarChart3 size={13} /> Analyze Migration</>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ MAIN CONTENT ═══ */}
            {!preview ? (
                /* Empty State */
                <div className="flex-1 flex flex-col items-center justify-center rounded-b-2xl"
                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', borderTop: 'none' }}>
                    <Shield size={48} className="mb-4 opacity-20" style={{ color: 'var(--app-muted-foreground)' }} />
                    <p className="text-sm font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                        Select a target template and click &quot;Analyze Migration&quot;
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                        The system will scan all accounts and show what needs attention before migration.
                    </p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden rounded-b-2xl"
                    style={{ border: '1px solid var(--app-border)', borderTop: 'none' }}>

                    {/* ── Summary Stats Bar ── */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
                        style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                        {[
                            { label: 'Total', value: preview.summary.total_accounts, color: 'var(--app-foreground)' },
                            { label: 'With Balance', value: preview.summary.with_balance, color: 'var(--app-danger, #ef4444)' },
                            { label: 'With Txns', value: preview.summary.with_transactions, color: 'var(--app-warning, #f59e0b)' },
                            { label: 'Custom', value: preview.summary.custom_accounts, color: 'var(--app-info, #3b82f6)' },
                            { label: 'Clean', value: cleanAccounts.length, color: 'var(--app-success, #22c55e)' },
                        ].map(stat => (
                            <div key={stat.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px]"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <span className="font-bold" style={{ color: stat.color }}>{stat.value}</span>
                                <span style={{ color: 'var(--app-muted-foreground)' }}>{stat.label}</span>
                            </div>
                        ))}
                        {preview.summary.total_balance !== 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px]"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <span className="font-bold" style={{
                                    color: preview.summary.total_balance > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)',
                                }}>
                                    {preview.summary.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span style={{ color: 'var(--app-muted-foreground)' }}>Net Balance</span>
                            </div>
                        )}

                        {/* Search & Filter */}
                        <div className="ml-auto flex items-center gap-2">
                            <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--app-muted-foreground)' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search accounts..."
                                    className="text-[11px] pl-7 pr-3 py-1.5 rounded-lg border"
                                    style={{
                                        color: 'var(--app-foreground)',
                                        background: 'var(--app-background)',
                                        borderColor: 'var(--app-border)',
                                        width: '160px',
                                    }}
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="text-[10px] font-bold px-2 py-1.5 rounded-lg border"
                                style={{
                                    color: 'var(--app-foreground)',
                                    background: 'var(--app-background)',
                                    borderColor: 'var(--app-border)',
                                }}>
                                <option value="all">All Categories</option>
                                <option value="HAS_BALANCE">🔴 With Balance</option>
                                <option value="HAS_TRANSACTIONS">🟡 With Transactions</option>
                                <option value="CUSTOM">🔵 Custom</option>
                                <option value="CLEAN">🟢 Clean</option>
                            </select>
                        </div>
                    </div>

                    {/* ── Scrollable Sections ── */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3"
                        style={{ background: 'var(--app-background)' }}>
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
                </div>
            )}
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
