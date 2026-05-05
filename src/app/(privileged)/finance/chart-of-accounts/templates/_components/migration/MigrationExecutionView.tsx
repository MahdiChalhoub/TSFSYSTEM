'use client'

import { useState } from 'react'
import {
    CheckCircle2, Zap, FileText, Loader2,
    DollarSign, UserPlus, X, ArrowRightLeft,
} from 'lucide-react'
import { MigrationExecutionSection } from './MigrationExecutionSection'

// ═══════════════════════════════════════════════════════════════════════════════
// Migration Execution View — Dedicated screen for executing COA migration
// Shows: accounts with balance, accounts with transactions, custom sub-accounts
// ═══════════════════════════════════════════════════════════════════════════════

export function MigrationExecutionView({
    preview,
    targetTemplateKey,
    sourceTemplateKey,
    onApply,
    onCancel,
    isPending,
}: {
    preview: import('@/app/actions/finance/coa-templates').MigrationPreview
    targetTemplateKey: string
    sourceTemplateKey: string
    onApply: (accountMapping: Record<string, string>) => void
    onCancel: () => void
    isPending: boolean
}) {
    const [overrides, setOverrides] = useState<Record<string, string>>({})
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        HAS_BALANCE: true,
        HAS_TRANSACTIONS: true,
        CUSTOM: true,
    })

    const withBalance = preview.accounts.filter(a => a.category === 'HAS_BALANCE')
    const withTxns = preview.accounts.filter(a => a.category === 'HAS_TRANSACTIONS')
    const customAccounts = preview.accounts.filter(a => a.is_custom)
    const cleanAccounts = preview.accounts.filter(a => a.category === 'CLEAN' && !a.is_custom)

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
            description: 'These accounts have non-zero balances. Journal entries referencing them will be remapped.',
        },
        {
            key: 'HAS_TRANSACTIONS',
            label: 'Accounts with Transactions',
            icon: <FileText size={15} />,
            color: 'var(--app-warning, #f59e0b)',
            bgColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
            accounts: withTxns,
            description: 'Zero balance but have journal entries. Transactions will be migrated to the target account.',
        },
        {
            key: 'CUSTOM',
            label: 'Custom Sub-Accounts',
            icon: <UserPlus size={15} />,
            color: 'var(--app-info, #3b82f6)',
            bgColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
            accounts: customAccounts,
            description: 'User-added accounts not in the target template (clients, suppliers, manual). Suggested target based on parent.',
        },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="flex-shrink-0 px-5 py-4" style={{
                background: 'var(--app-surface)',
                borderBottom: '1px solid var(--app-border)',
            }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                            <ArrowRightLeft size={18} style={{ color: 'var(--app-primary)' }} />
                        </div>
                        <div>
                            <h2 style={{ color: 'var(--app-foreground)' }}>
                                Migration Execution
                            </h2>
                            <p className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                {sourceTemplateKey.replace(/_/g, ' ')} → {targetTemplateKey.replace(/_/g, ' ')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-tp-sm font-bold rounded-xl border transition-all"
                            style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                            <X size={13} /> Cancel
                        </button>
                        <button onClick={() => {
                                // Build account mapping: source_code → target_code
                                const mapping: Record<string, string> = {}
                                for (const acc of preview.accounts) {
                                    const targetCode = getTargetCode(acc.code, acc.suggested_target)
                                    if (targetCode) {
                                        mapping[acc.code] = targetCode
                                    }
                                }
                                onApply(mapping)
                            }} disabled={isPending}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-tp-sm font-bold rounded-xl transition-all"
                            style={{
                                background: isPending ? 'var(--app-muted)' : 'var(--app-primary)',
                                color: 'white',
                                opacity: isPending ? 0.6 : 1,
                                cursor: isPending ? 'wait' : 'pointer',
                            }}>
                            {isPending ? (
                                <><Loader2 size={13} className="animate-spin" /> Migrating...</>
                            ) : (
                                <><Zap size={13} /> Apply Migration &amp; Import</>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Summary Stats ── */}
                <div className="flex items-center gap-3 mt-3">
                    {[
                        { label: 'Total Accounts', value: preview.summary.total_accounts, color: 'var(--app-foreground)' },
                        { label: 'With Balance', value: preview.summary.with_balance, color: 'var(--app-danger, #ef4444)' },
                        { label: 'With Transactions', value: preview.summary.with_transactions, color: 'var(--app-warning, #f59e0b)' },
                        { label: 'Custom', value: preview.summary.custom_accounts, color: 'var(--app-info, #3b82f6)' },
                        { label: 'Clean', value: cleanAccounts.length, color: 'var(--app-success, #22c55e)' },
                    ].map(stat => (
                        <div key={stat.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-tp-xs"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                            <span className="font-bold" style={{ color: stat.color }}>{stat.value}</span>
                            <span style={{ color: 'var(--app-muted-foreground)' }}>{stat.label}</span>
                        </div>
                    ))}
                    {preview.summary.total_balance !== 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-tp-xs"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                            <span className="font-bold" style={{
                                color: preview.summary.total_balance > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)',
                            }}>
                                {preview.summary.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span style={{ color: 'var(--app-muted-foreground)' }}>Net Balance</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Sections ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {sections.map(section => (
                    section.accounts.length > 0 && (
                        <MigrationExecutionSection
                            key={section.key}
                            section={section}
                            expanded={!!expandedSections[section.key]}
                            onToggle={() => setExpandedSections(p => ({ ...p, [section.key]: !p[section.key] }))}
                            preview={preview}
                            getTargetCode={getTargetCode}
                            setOverride={(code, value) => setOverrides(p => ({ ...p, [code]: value }))}
                        />
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
                            <span className="text-tp-md font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                                {cleanAccounts.length} Clean Accounts
                            </span>
                            <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                — No data, exist in both templates. Will be migrated automatically.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
