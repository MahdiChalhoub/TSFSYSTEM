'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder, FileText, Pencil, Plus, Power, Lock } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useTranslation } from '@/hooks/use-translation'

/**
 * Mirror of the backend's ChartOfAccount.scope_mode property. Used as a
 * client-side fallback for accounts whose API response doesn't yet carry
 * the field (e.g., before a backend deploy / cache miss). When the
 * backend value is present, that takes precedence.
 *
 * Resolution order (most specific first):
 *   1. system_role (precise, when admins have classified it)
 *   2. SYSCOHADA code (class 3 = stocks → branch-located)
 *   3. Code prefix pattern (e.g. starts with "3" or "31")
 *   4. Name keywords ("stock", "inventory", "marchandise", "WIP")
 *   5. Account type fallback (INCOME/EXPENSE → split)
 *
 * Without (2)–(4) most ASSET inventory accounts default to tenant-wide,
 * which is wrong — they're physically branch-scoped.
 */
function deriveScopeMode(node: Record<string, any>): 'tenant_wide' | 'branch_split' | 'branch_located' {
    const role = String(node.system_role || '').toUpperCase()
    // 1) Explicit system role — most precise.
    if (role === 'INVENTORY' || role === 'INVENTORY_ASSET' || role === 'WIP') return 'branch_located'
    if (['AR_CONTROL','AP_CONTROL','CASH_ACCOUNT','BANK_ACCOUNT','TAX_PAYABLE','TAX_RECEIVABLE',
         'RETAINED_EARNINGS','P_L_SUMMARY','OPENING_BALANCE_OFFSET','RECEIVABLE','PAYABLE',
         'CAPITAL','WITHDRAWAL','LOAN','WITHHOLDING','ACCUM_DEPRECIATION'].includes(role)) {
        return 'tenant_wide'
    }
    if (['REVENUE','REVENUE_CONTROL','COGS','COGS_CONTROL','EXPENSE','DISCOUNT_GIVEN',
         'DISCOUNT_RECEIVED','FX_GAIN','FX_LOSS','DEPRECIATION_EXP','BAD_DEBT',
         'DELIVERY_FEES','VAT_INPUT','VAT_OUTPUT','GRNI'].includes(role)) {
        return 'branch_split'
    }

    // 2) SYSCOHADA classes:
    //    3 = Stocks (inventory) → branch-located
    //    6 = Charges (expenses) → branch-split
    //    7 = Produits (income) → branch-split
    const syscoCode = String(node.syscohadaCode || node.syscohada_code || '')
    if (syscoCode) {
        const first = syscoCode[0]
        if (first === '3') return 'branch_located'
        if (first === '6' || first === '7') return 'branch_split'
    }

    // 3) Code prefix — works for SYSCOHADA-styled codes even if syscohadaCode wasn't set.
    const code = String(node.code || '')
    if (node.type === 'ASSET' && /^3\d/.test(code)) return 'branch_located'

    // 4) Name keyword sniff — last resort for inventory-shaped accounts.
    const name = String(node.name || '').toLowerCase()
    if (node.type === 'ASSET' && /\b(stock|inventory|inventaire|marchandise|matiere|matière|wip|work[-\s]in[-\s]progress|en[-\s]cours)\b/.test(name)) {
        return 'branch_located'
    }

    // 5) Type fallback.
    if (node.type === 'INCOME' || node.type === 'EXPENSE') return 'branch_split'
    if (node.type === 'LIABILITY' || node.type === 'EQUITY') return 'tenant_wide'
    return 'tenant_wide'
}

interface AccountNodeProps {
    node: Record<string, any>
    level: number
    accounts: Record<string, any>[]
    onEdit: (node: Record<string, any>) => void
    onAddChild: (parentId: number) => void
    onReactivate: (id: number) => void
}

export const AccountNode = ({
    node, level, accounts, onEdit, onAddChild, onReactivate
}: AccountNodeProps) => {
    const { t } = useTranslation()
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(level < 1)
    const typeConf = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.ASSET
    const isRoot = level === 0

    return (
        <div className={!node.isActive ? 'opacity-40' : ''}>
            {/* Row */}
            <div
                className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b"
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px',
                    paddingTop: isRoot ? '10px' : '7px',
                    paddingBottom: isRoot ? '10px' : '7px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : 'transparent',
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : `3px solid transparent`,
                    borderBottomColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
                onMouseEnter={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-hover, rgba(255,255,255,0.04))'
                }}
                onMouseLeave={e => {
                    if (!isRoot) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
            >
                {/* Toggle */}
                <button
                    onClick={() => isParent && setIsOpen(o => !o)}
                    className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0"
                    style={{ color: isParent ? 'var(--app-muted-foreground, #94A3B8)' : 'var(--app-border)' }}
                >
                    {isParent
                        ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
                        : <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeConf.color, opacity: 0.5 }} />
                    }
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: typeConf.bg, color: typeConf.color }}
                >
                    {isParent
                        ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
                        : <FileText size={13} />
                    }
                </div>

                {/* Code + Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                        className="font-mono text-tp-sm font-bold flex-shrink-0"
                        style={{ color: 'var(--app-muted-foreground, #94A3B8)' }}
                    >
                        {node.code}
                    </span>
                    <span
                        className={`truncate text-tp-lg ${isRoot ? 'font-bold' : 'font-medium'}`}
                        style={{ color: 'var(--app-foreground, var(--app-foreground, #F1F5F9))' }}
                    >
                        {node.name}
                    </span>
                    {node.subType && (
                        <span
                            className="text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden md:inline"
                            style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.bg}` }}
                        >
                            {node.subType}
                        </span>
                    )}
                    {!node.isActive && (
                        <span className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'var(--app-error-bg, rgba(239,68,68,0.12))', color: 'var(--app-error, #EF4444)' }}>
                            {t('finance.coa.inactive')}
                        </span>
                    )}
                    {node.isInternal && (
                        <span
                            title={t('finance.coa.tooltip_internal')}
                            className="text-tp-xxs font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 inline-flex items-center gap-1"
                            style={{ background: 'color-mix(in srgb, var(--app-warning, #F59E0B) 15%, transparent)', color: 'var(--app-warning, #F59E0B)' }}
                        >
                            <Lock size={9} />
                            {t('finance.coa.badge_internal')}
                        </span>
                    )}
                </div>

                {/* SYSCOHADA */}
                <div className="w-36 hidden lg:flex items-center gap-1.5 flex-shrink-0">
                    {node.syscohadaCode && (
                        <>
                            <span
                                className="text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    color: 'var(--app-muted-foreground, #94A3B8)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                }}
                            >
                                {node.syscohadaCode}
                            </span>
                            {node.syscohadaClass && (
                                <span className="text-tp-xxs truncate max-w-[80px]"
                                    style={{ color: 'var(--app-muted-foreground, #94A3B8)' }}>
                                    {node.syscohadaClass}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Type Badge */}
                <div className="w-24 flex-shrink-0 hidden sm:flex items-center">
                    <span
                        className="text-tp-xxs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: typeConf.bg, color: typeConf.color, border: `1px solid ${typeConf.bg}` }}
                    >
                        {typeConf.icon}
                        {typeConf.label}
                    </span>
                </div>

                {/* Scope column — its own slot, parallel to the Type
                    badge. Compact pill that's instantly readable across the
                    whole list. Hover for full explanation. */}
                {(() => {
                    const scopeMode = (node.scope_mode as 'tenant_wide' | 'branch_split' | 'branch_located' | undefined) || deriveScopeMode(node)
                    const isTenant = scopeMode === 'tenant_wide'
                    const isSplit = scopeMode === 'branch_split'
                    const color = isTenant ? 'var(--app-muted-foreground, #94A3B8)'
                        : isSplit ? 'var(--app-info, #3b82f6)'
                        : 'var(--app-warning, #f59e0b)'
                    return (
                        <div className="w-24 flex-shrink-0 hidden md:flex items-center justify-center">
                            <span
                                className="text-tp-xxs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                                style={{
                                    background: `color-mix(in srgb, ${color} 10%, transparent)`,
                                    color,
                                    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                                }}
                                title={
                                    isTenant ? 'Tenant-wide — balance does NOT change with branch filter (AR/AP/Bank/Equity).'
                                    : isSplit ? 'Branch-split — balance is filtered to the selected branch (Revenue/Expense/COGS).'
                                    : 'Branch-located — balance reflects only the selected branch (Inventory/WIP).'
                                }>
                                <span className="leading-none">{isTenant ? '🌐' : isSplit ? '🏢' : '📦'}</span>
                                <span>{isTenant ? 'Tenant' : isSplit ? 'Split' : 'Located'}</span>
                            </span>
                        </div>
                    )
                })()}

                {/* Balance — single number when no branch selected;
                    twin "branch / tenant" stack when a branch IS selected
                    AND the account's scope_mode is branch-split or located.
                    Tenant-wide accounts always show one number (their
                    branch balance == tenant balance by definition). */}
                {(() => {
                    const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2 })
                    const balance = Number(node.balance) || 0
                    const tenant = node.tenant_balance != null ? Number(node.tenant_balance) : null
                    const branch = node.branch_balance != null ? Number(node.branch_balance) : null
                    const scopeMode = (node.scope_mode as 'tenant_wide' | 'branch_split' | 'branch_located' | undefined) || deriveScopeMode(node)
                    const showTwin = branch != null && tenant != null && scopeMode !== 'tenant_wide'
                    return (
                        <div className="w-28 text-right flex-shrink-0 flex flex-col items-end leading-tight">
                            <span className="font-mono text-tp-md font-bold tabular-nums"
                                style={{ color: balance < 0 ? 'var(--app-error, #EF4444)' : 'var(--app-foreground, var(--app-foreground, #F1F5F9))' }}>
                                {fmt(balance)}
                            </span>
                            {showTwin && (
                                <span className="font-mono text-[9px] tabular-nums opacity-60 mt-0.5"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                    title={`Tenant total = ${fmt(tenant!)} (sum across all branches)`}>
                                    of {fmt(tenant!)}
                                </span>
                            )}
                        </div>
                    )
                })()}

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-16 justify-end">
                    <button
                        title={t('finance.coa.action_edit')}
                        onClick={() => onEdit(node)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        title={t('finance.coa.action_add_sub')}
                        onClick={() => onAddChild(node.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}
                    >
                        <Plus size={13} />
                    </button>
                    {!node.isActive && (
                        <button
                            title={t('finance.coa.action_reactivate')}
                            onClick={() => onReactivate(node.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--app-success, #10B981)' }}
                        >
                            <Power size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Children */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: Record<string, any>) => (
                        <AccountNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            accounts={accounts}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onReactivate={onReactivate}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
