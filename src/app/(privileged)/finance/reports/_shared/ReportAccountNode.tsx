'use client'

/* ═══════════════════════════════════════════════════════════
 *  ReportAccountNode
 *  A read-only clone of COA's AccountNode adapted for financial
 *  reports (Trial Balance / P&L / Balance Sheet). Imports
 *  TYPE_CONFIG from COA so colours / icons / labels stay in
 *  sync automatically — but renders differently:
 *   - no edit / add / reactivate actions
 *   - pluggable balance slot (single Amount or Debit / Credit)
 *   - hides SYSCOHADA column (not needed in reports)
 *   - hides zero-balance leaves by default
 *   - reacts to Expand All / Collapse All toggles
 *
 *  CRITICAL: this file must never mutate COA state or styling —
 *  COA's AccountNode remains the source of truth for the tree
 *  UX; this is a read-only sibling that borrows only the types.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, type ReactNode } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder, FileText } from 'lucide-react'
import { TYPE_CONFIG } from '@/app/(privileged)/finance/chart-of-accounts/_components/types'

type ColumnMode = 'amount' | 'debit-credit'

interface Props {
    node: Record<string, any>
    level: number
    accounts: Record<string, any>[]
    formatAmount: (v: number) => string
    /** 'amount' → one balance column; 'debit-credit' → two columns. */
    columns?: ColumnMode
    /** Force-open / close from an "Expand all" button. */
    forceOpen?: boolean
    forceOpenKey?: number
    /** Hide rows whose balance is effectively zero and have no children. */
    hideZero?: boolean
}

export function ReportAccountNode({
    node, level, accounts, formatAmount,
    columns = 'amount', forceOpen, forceOpenKey, hideZero = true,
}: Props) {
    const [isOpen, setIsOpen] = useState(level < 1)
    const isParent = node.children && node.children.length > 0
    const typeConf = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.ASSET
    const isRoot = level === 0

    useEffect(() => {
        if (forceOpen !== undefined) setIsOpen(forceOpen)
    }, [forceOpen, forceOpenKey])

    const bal = Number(node.balance) || 0
    if (hideZero && Math.abs(bal) < 0.001 && !isParent) return null

    return (
        <div>
            {/* Row — identical paddings / hover / borders to COA for visual parity */}
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b"
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px',
                    paddingTop: isRoot ? '10px' : '7px',
                    paddingBottom: isRoot ? '10px' : '7px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : 'transparent',
                    borderLeft: isRoot ? '3px solid var(--app-primary)' : '3px solid transparent',
                    borderBottomColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
                onMouseEnter={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-hover, rgba(255,255,255,0.04))'
                }}
                onMouseLeave={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
            >
                {/* Toggle chevron */}
                <button
                    onClick={() => isParent && setIsOpen(o => !o)}
                    className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0"
                    style={{ color: isParent ? 'var(--app-muted-foreground, #94A3B8)' : 'var(--app-border)' }}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                    {isParent
                        ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeConf.color, opacity: 0.5 }} />}
                </button>

                {/* Type icon */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: typeConf.bg, color: typeConf.color }}>
                    {isParent
                        ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
                        : <FileText size={13} />}
                </div>

                {/* Code + name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-mono text-tp-sm font-bold flex-shrink-0"
                        style={{ color: 'var(--app-muted-foreground, #94A3B8)' }}>
                        {node.code}
                    </span>
                    <span className={`truncate text-tp-lg ${isRoot ? 'font-bold' : 'font-medium'}`}
                        style={{ color: 'var(--app-foreground, var(--app-text, #F1F5F9))' }}>
                        {node.name}
                    </span>
                </div>

                {/* Type badge — same pill as COA */}
                <div className="w-24 flex-shrink-0 hidden sm:flex items-center">
                    <span className="text-tp-xxs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.bg}` }}>
                        {typeConf.icon}
                        {typeConf.label}
                    </span>
                </div>

                {/* Balance slot — either one Amount column or Debit/Credit split */}
                {columns === 'amount' ? (
                    <div className="w-28 text-right font-mono text-tp-md font-bold flex-shrink-0 tabular-nums"
                        style={{ color: bal < 0 ? 'var(--app-error, #EF4444)' : 'var(--app-foreground)' }}>
                        {formatAmount(bal)}
                    </div>
                ) : (
                    <>
                        <div className="w-28 text-right font-mono text-tp-md flex-shrink-0 tabular-nums"
                            style={{
                                color: bal > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                opacity: bal > 0 ? 1 : 0.3,
                                fontWeight: isParent ? 700 : 500,
                            }}>
                            {bal > 0 ? formatAmount(bal) : '—'}
                        </div>
                        <div className="w-28 text-right font-mono text-tp-md flex-shrink-0 tabular-nums"
                            style={{
                                color: bal < 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                opacity: bal < 0 ? 1 : 0.3,
                                fontWeight: isParent ? 700 : 500,
                            }}>
                            {bal < 0 ? formatAmount(Math.abs(bal)) : '—'}
                        </div>
                    </>
                )}
            </div>

            {/* Children */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: Record<string, any>) => (
                        <ReportAccountNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            accounts={accounts}
                            formatAmount={formatAmount}
                            columns={columns}
                            forceOpen={forceOpen}
                            forceOpenKey={forceOpenKey}
                            hideZero={hideZero}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/** Column-header row that matches ReportAccountNode's cell widths. */
export function ReportAccountHeader({ columns = 'amount' }: { columns?: ColumnMode }) {
    return (
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 border-b border-app-border/50 text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground bg-app-surface/60">
            <div className="w-5 flex-shrink-0" />
            <div className="w-7 flex-shrink-0" />
            <div className="flex-1">Account</div>
            <div className="w-24 hidden sm:block">Type</div>
            {columns === 'amount' ? (
                <div className="w-28 text-right">Balance</div>
            ) : (
                <>
                    <div className="w-28 text-right">Debit</div>
                    <div className="w-28 text-right">Credit</div>
                </>
            )}
        </div>
    )
}
