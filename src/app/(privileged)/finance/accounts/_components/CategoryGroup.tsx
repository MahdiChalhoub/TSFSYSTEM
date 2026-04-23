'use client'

import {
    Wallet, Building, Smartphone, Briefcase, PiggyBank, Globe2, Lock, TrendingUp,
    Layers, CreditCard, Banknote, ChevronDown, ChevronRight, AlertCircle, FolderTree
} from 'lucide-react'
import { AccountRow } from './AccountRow'

/* ── Icon Map ── */
const ICON_MAP: Record<string, any> = {
    banknote: Banknote, building: Building, smartphone: Smartphone,
    briefcase: Briefcase, 'piggy-bank': PiggyBank, 'globe-2': Globe2,
    lock: Lock, 'trending-up': TrendingUp, wallet: Wallet, layers: Layers,
    'credit-card': CreditCard
}
const getIcon = (name: string) => ICON_MAP[name] || Wallet

/* ── Category Group (Root Row + children) ── */
export function CategoryGroup({ category: cat, accounts, isOpen, onToggle, onDeleteAccount, onTogglePOS }: {
    category: any; accounts: any[]; isOpen: boolean; onToggle: () => void
    onDeleteAccount: (id: number) => void; onTogglePOS: (id: number, current: boolean) => void
}) {
    const Icon = getIcon(cat.icon)
    const color = cat.color || 'var(--app-primary)'

    return (
        <div>
            {/* Category Root Row */}
            <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3"
                style={{ paddingLeft: '12px', paddingRight: '12px', background: `color-mix(in srgb, ${color} 4%, var(--app-surface))`, borderLeft: `3px solid ${color}` }}
                onClick={onToggle}>
                <button className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 hover:bg-app-border/50 text-app-muted-foreground">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-app-foreground">{cat.name}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
                        {cat.code}
                    </span>
                    {cat.coa_parent_name && (
                        <span className="hidden lg:flex items-center gap-1 text-[10px] text-app-muted-foreground font-bold">
                            <FolderTree size={9} /> {cat.coa_parent_code} — {cat.coa_parent_name}
                        </span>
                    )}
                </div>
                <div className="hidden sm:block w-24 flex-shrink-0" />
                <div className="hidden md:block w-16 flex-shrink-0" />
                <div className="hidden md:block w-16 flex-shrink-0" />
                <div className="w-28 text-right flex-shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 justify-end"
                        style={{ color: 'var(--app-success, #22c55e)', background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' }}>
                        <Layers size={10} /> {accounts.length}
                    </span>
                </div>
                <div className="w-16 flex-shrink-0" />
            </div>

            {/* Account Child Rows */}
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {accounts.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-app-muted-foreground italic" style={{ paddingLeft: '52px' }}>
                            No accounts in this category
                        </div>
                    ) : accounts.map(acct => (
                        <AccountRow key={acct.id} account={acct}
                            onDelete={() => onDeleteAccount(acct.id)}
                            onTogglePOS={() => onTogglePOS(acct.id, acct.is_pos_enabled)} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ── Uncategorized Group ── */
export function UncategorizedGroup({ accounts, isOpen, onToggle, onDeleteAccount, onTogglePOS }: {
    accounts: any[]; isOpen: boolean; onToggle: () => void
    onDeleteAccount: (id: number) => void; onTogglePOS: (id: number, current: boolean) => void
}) {
    if (accounts.length === 0) return null

    return (
        <div>
            <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3"
                style={{ paddingLeft: '12px', paddingRight: '12px', background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, var(--app-surface))', borderLeft: '3px solid var(--app-warning, #f59e0b)' }}
                onClick={onToggle}>
                <button className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 hover:bg-app-border/50 text-app-muted-foreground">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                    <AlertCircle size={14} />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-app-foreground">Uncategorized</span>
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)' }}>
                        UNCAT
                    </span>
                </div>
                <div className="hidden sm:block w-24 flex-shrink-0" />
                <div className="hidden md:block w-16 flex-shrink-0" />
                <div className="hidden md:block w-16 flex-shrink-0" />
                <div className="w-28 text-right flex-shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 justify-end"
                        style={{ color: 'var(--app-warning, #f59e0b)', background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)' }}>
                        <Layers size={10} /> {accounts.length}
                    </span>
                </div>
                <div className="w-16 flex-shrink-0" />
            </div>
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {accounts.map(acct => (
                        <AccountRow key={acct.id} account={acct}
                            onDelete={() => onDeleteAccount(acct.id)}
                            onTogglePOS={() => onTogglePOS(acct.id, acct.is_pos_enabled)} />
                    ))}
                </div>
            )}
        </div>
    )
}
