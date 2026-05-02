'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder, FileText, Pencil, Plus, Power, Lock } from 'lucide-react'
import { TYPE_CONFIG } from './types'
import { useTranslation } from '@/hooks/use-translation'

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
                        style={{ color: 'var(--app-foreground, var(--app-text, #F1F5F9))' }}
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

                {/* Balance + scope chip — the chip explains whether this
                    balance reacts to a branch filter. Tenant-wide accounts
                    (AR/AP/Bank/Equity) ALWAYS show the same number regardless
                    of branch selection — the chip makes that explicit so
                    users don't think the filter is broken. */}
                <div className="w-28 text-right flex-shrink-0 flex flex-col items-end">
                    <span className="font-mono text-tp-md font-bold tabular-nums"
                        style={{ color: node.balance < 0 ? 'var(--app-error, #EF4444)' : 'var(--app-foreground, var(--app-text, #F1F5F9))' }}>
                        {node.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    {node.scope_mode && (
                        <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5 leading-none"
                            title={
                                node.scope_mode === 'tenant_wide'
                                    ? 'Tenant-wide — balance does NOT change with branch filter (AR/AP/Bank/Equity).'
                                    : node.scope_mode === 'branch_split'
                                        ? 'Branch-split — balance is filtered to the selected branch (Revenue/Expense/COGS).'
                                        : 'Branch-located — balance reflects only the selected branch (Inventory/WIP).'
                            }
                            style={{
                                color:
                                    node.scope_mode === 'tenant_wide' ? 'var(--app-muted-foreground, #94A3B8)'
                                    : node.scope_mode === 'branch_split' ? 'var(--app-info, #3b82f6)'
                                    : 'var(--app-warning, #f59e0b)',
                            }}>
                            {node.scope_mode === 'tenant_wide' ? '🌐 tenant-wide'
                                : node.scope_mode === 'branch_split' ? '🏢 branch-split'
                                : '📦 branch-located'}
                        </span>
                    )}
                </div>

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
