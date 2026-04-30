'use client'

import { ChevronDown } from 'lucide-react'

// Renders one collapsible section in the MigrationExecutionView (HAS_BALANCE / HAS_TRANSACTIONS / CUSTOM)
export function MigrationExecutionSection({
    section, expanded, onToggle, preview, getTargetCode, setOverride,
}: {
    section: {
        key: string
        label: string
        icon: any
        color: string
        bgColor: string
        borderColor: string
        accounts: any[]
        description: string
    }
    expanded: boolean
    onToggle: () => void
    preview: import('@/app/actions/finance/coa-templates').MigrationPreview
    getTargetCode: (code: string, suggested: any) => string
    setOverride: (code: string, value: string) => void
}) {
    return (
        <div className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${section.borderColor}` }}>
            {/* Section Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-2.5 transition-all"
                style={{ background: section.bgColor }}>
                <div className="flex items-center gap-2">
                    <span style={{ color: section.color }}>{section.icon}</span>
                    <span className="text-tp-md font-bold" style={{ color: section.color }}>
                        {section.label}
                    </span>
                    <span className="text-tp-xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: section.color, color: 'white' }}>
                        {section.accounts.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                        {section.description}
                    </span>
                    <ChevronDown size={14}
                        className="transition-transform"
                        style={{
                            color: section.color,
                            transform: expanded ? 'rotate(0)' : 'rotate(-90deg)',
                        }} />
                </div>
            </button>

            {/* Section Table */}
            {expanded && (
                <div style={{ background: 'var(--app-background)' }}>
                    {/* Table Header */}
                    <div className="grid gap-2 px-4 py-2 text-tp-xs font-bold uppercase tracking-wider"
                        style={{
                            gridTemplateColumns: '80px 1fr 100px 80px 1fr 100px',
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
                        <div key={acc.code}
                            className="grid gap-2 px-4 py-2 text-tp-sm items-center transition-colors hover:bg-[var(--app-surface)]"
                            style={{
                                gridTemplateColumns: '80px 1fr 100px 80px 1fr 100px',
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
                                    <span className="text-tp-xxs ml-1" style={{ color: 'var(--app-muted-foreground)' }}>
                                        ← {acc.parent_code} {acc.parent_name}
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
                            {/* Target Account (Dropdown) */}
                            <div className="flex items-center gap-1">
                                <select
                                    value={getTargetCode(acc.code, acc.suggested_target)}
                                    onChange={(e) => setOverride(acc.code, e.target.value)}
                                    className="flex-1 text-tp-sm px-2 py-1 rounded-lg border bg-transparent truncate"
                                    style={{
                                        color: 'var(--app-foreground)',
                                        borderColor: 'var(--app-border)',
                                        background: 'var(--app-surface)',
                                    }}>
                                    <option value="">— Unmapped —</option>
                                    {preview.target_template_accounts.map(ta => (
                                        <option key={ta.code} value={ta.code}>
                                            {ta.code} — {ta.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Match Badge */}
                            <div className="flex justify-center">
                                {acc.suggestion_reason ? (
                                    <span className="text-tp-xxs px-1.5 py-0.5 rounded-full font-bold" style={{
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
                                    <span className="text-tp-xxs px-1.5 py-0.5 rounded-full font-bold"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-danger, #ef4444) 12%, transparent)',
                                            color: 'var(--app-danger, #ef4444)',
                                        }}>
                                        ✗ Manual
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
