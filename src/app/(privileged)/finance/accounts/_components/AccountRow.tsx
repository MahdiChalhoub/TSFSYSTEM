'use client'

import Link from 'next/link'
import {
    Wallet, Building, Smartphone, Briefcase, PiggyBank, Globe2, Lock, TrendingUp,
    Link as LinkIcon, AlertCircle, User as UserIcon, Trash2, BookOpen, BarChart3
} from 'lucide-react'

const TYPE_ICONS: Record<string, any> = {
    CASH: Wallet, BANK: Building, MOBILE: Smartphone, PETTY_CASH: Briefcase,
    SAVINGS: PiggyBank, FOREIGN: Globe2, ESCROW: Lock, INVESTMENT: TrendingUp
}

export function AccountRow({ account: a, onDelete, onTogglePOS }: {
    account: any; onDelete: () => void; onTogglePOS: () => void
}) {
    const TypeIcon = TYPE_ICONS[a.type] || Wallet
    const balance = parseFloat(a.balance || 0)
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Math.abs(balance))
    const isLinked = !!a.ledgerAccount
    const userCount = a.assignedUsers?.length || 0

    return (
        <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2"
            style={{
                paddingLeft: '32px', paddingRight: '12px',
                borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                marginLeft: '22px'
            }}>
            {/* Dot */}
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: a.is_active !== false ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }} />
            </div>
            {/* Icon */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                <TypeIcon size={13} />
            </div>
            {/* Name + Badges */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <Link href={`/finance/accounts/${a.id}`}
                    className="truncate text-[13px] font-medium text-app-foreground hover:underline">
                    {a.name}
                </Link>
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: 'var(--app-muted-foreground)' }}>
                    {a.type}
                </span>
                {a.is_active === false && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                        INACTIVE
                    </span>
                )}
                <span className="hidden lg:inline text-[10px] font-bold text-app-muted-foreground">{a.currency}</span>
            </div>
            {/* COA Link */}
            <div className="hidden sm:flex w-24 flex-shrink-0 items-center gap-1 truncate">
                {isLinked ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-success, #22c55e)' }}>
                        <LinkIcon size={9} />
                        <span className="truncate">{a.ledgerAccount.code}</span>
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                        <AlertCircle size={9} /> Missing
                    </span>
                )}
            </div>
            {/* POS Toggle */}
            <div className="hidden md:flex w-16 flex-shrink-0 justify-center">
                <button onClick={e => { e.stopPropagation(); onTogglePOS() }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.is_pos_enabled ? 'bg-app-primary' : 'bg-app-border'}`}
                    title={a.is_pos_enabled ? 'POS enabled — click to disable' : 'POS disabled — click to enable'}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-app-surface transition-transform ${a.is_pos_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
            </div>
            {/* Users */}
            <div className="hidden md:flex w-16 flex-shrink-0 justify-center items-center gap-1">
                <UserIcon size={10} className="text-app-muted-foreground" />
                <span className="text-[11px] font-bold text-app-muted-foreground tabular-nums">{userCount}</span>
            </div>
            {/* Balance */}
            <div className="w-28 text-right font-mono text-[12px] font-bold flex-shrink-0 tabular-nums"
                style={{ color: balance >= 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>
                {balance < 0 ? '-' : ''}{formatted}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-0.5 w-16 flex-shrink-0 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                {isLinked && (
                    <Link href={`/finance/ledger?account=${a.ledgerAccount.id}`}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                        title="View Ledger">
                        <BookOpen size={12} />
                    </Link>
                )}
                {isLinked && (
                    <Link href={`/finance/bank-reconciliation?account_id=${a.ledgerAccount.id}`}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                        title="Statement">
                        <BarChart3 size={12} />
                    </Link>
                )}
                <button onClick={onDelete}
                    className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors"
                    title="Delete">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}
