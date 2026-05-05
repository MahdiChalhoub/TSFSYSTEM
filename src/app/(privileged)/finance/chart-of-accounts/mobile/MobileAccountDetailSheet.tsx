'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileAccountDetailSheet — mobile-native detail panel for a
 *  single Chart-of-Account node. Rendered inside MobileBottomSheet.
 * ═══════════════════════════════════════════════════════════ */

import {
    X, Pencil, Wallet, TrendingDown, TrendingUp, BarChart3, Scale,
    Plus, BookOpen, Power, EyeOff, RefreshCcw,
} from 'lucide-react'
import Link from 'next/link'

const TYPE_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
    ASSET:     { color: 'var(--app-info, #3B82F6)',    icon: Wallet,       label: 'Asset' },
    LIABILITY: { color: 'var(--app-error, #EF4444)',   icon: TrendingDown, label: 'Liability' },
    EQUITY:    { color: 'var(--app-info)',                     icon: Scale,        label: 'Equity' },
    INCOME:    { color: 'var(--app-success, #10B981)', icon: TrendingUp,   label: 'Income' },
    EXPENSE:   { color: 'var(--app-warning, #F59E0B)', icon: BarChart3,    label: 'Expense' },
    REVENUE:   { color: 'var(--app-success, #10B981)', icon: TrendingUp,   label: 'Revenue' },
}

function fmt(n: number | undefined): string {
    if (n == null || isNaN(n)) return '—'
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
    node: any
    onEdit: (n: any) => void
    onAddChild: (parentId: number) => void
    onReactivate?: (n: any) => void
    onRecalc?: (n: any) => void
    onClose: () => void
}

export function MobileAccountDetailSheet({ node, onEdit, onAddChild, onReactivate, onRecalc, onClose }: Props) {
    const typeConf = TYPE_CONFIG[node.type] ?? TYPE_CONFIG.ASSET
    const TypeIcon = typeConf.icon
    const directBalance = node.directBalance ?? node.balance ?? 0
    const rollupBalance = node.rollupBalance ?? node.rollup_balance ?? node.balance ?? 0
    const childCount = node.children?.length ?? 0
    const isInactive = node.isActive === false

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${typeConf.color} 10%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: `linear-gradient(135deg, ${typeConf.color}, color-mix(in srgb, ${typeConf.color} 70%, #000))`,
                        boxShadow: `0 4px 14px color-mix(in srgb, ${typeConf.color} 30%, transparent)`,
                        color: '#fff',
                    }}>
                    <TypeIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-app-foreground truncate leading-tight" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {node.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold" style={{ fontSize: 'var(--tp-sm)', color: typeConf.color }}>
                            {node.code}
                        </span>
                        <span className="font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                            style={{
                                fontSize: 'var(--tp-xxs)',
                                background: `color-mix(in srgb, ${typeConf.color} 14%, transparent)`,
                                color: typeConf.color,
                            }}>
                            {typeConf.label}
                        </span>
                        {isInactive && (
                            <span className="flex items-center gap-1 font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                                style={{
                                    fontSize: 'var(--tp-xxs)',
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                }}>
                                <EyeOff size={10} /> Inactive
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">

                {/* Balance cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: `color-mix(in srgb, ${typeConf.color} 6%, var(--app-surface))`,
                            border: `1px solid color-mix(in srgb, ${typeConf.color} 20%, transparent)`,
                        }}>
                        <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>
                            Direct Balance
                        </div>
                        <div className="font-mono font-bold tabular-nums text-app-foreground mt-1"
                            style={{ fontSize: 'var(--tp-stat)' }}>
                            {fmt(directBalance)}
                        </div>
                    </div>
                    <div className="rounded-2xl px-3 py-3"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        <div className="font-bold uppercase tracking-wide text-app-muted-foreground"
                            style={{ fontSize: 'var(--tp-xxs)' }}>
                            Rollup Balance
                        </div>
                        <div className="font-mono font-bold tabular-nums text-app-foreground mt-1"
                            style={{ fontSize: 'var(--tp-stat)' }}>
                            {fmt(rollupBalance)}
                        </div>
                    </div>
                </div>

                {/* Meta */}
                <div className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    {[
                        ['Type', typeConf.label],
                        ['Sub-type', node.subType || node.sub_type || '—'],
                        ['Parent', node.parentName || node.parent_name || (node.parentId || node.parent ? `#${node.parentId || node.parent}` : '— (Root)')],
                        ['Children', String(childCount)],
                        ['SYSCOHADA', (node.syscohadaCode || node.syscohada_code) ? `${node.syscohadaCode || node.syscohada_code} · ${node.syscohadaClass || node.syscohada_class || ''}` : '—'],
                        ['Status', node.isActive === false ? 'Inactive' : 'Active'],
                    ].map(([label, value], i) => (
                        <div key={label}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                            style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                            <span className="font-bold uppercase tracking-wide text-app-muted-foreground"
                                style={{ fontSize: 'var(--tp-xxs)' }}>
                                {label}
                            </span>
                            <span className="font-bold text-app-foreground truncate text-right"
                                style={{ fontSize: 'var(--tp-md)' }}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Quick links */}
                <div className="space-y-1.5">
                    <Link
                        href={`/finance/chart-of-accounts/${node.id}`}
                        onClick={onClose}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:scale-[0.99] transition-transform"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 7%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                            minHeight: 48,
                        }}>
                        <BookOpen size={15} style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <span className="flex-1 font-bold text-app-foreground" style={{ fontSize: 'var(--tp-lg)' }}>
                            Full statement & detail
                        </span>
                    </Link>
                </div>
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                    background: 'var(--app-surface)',
                }}>
                <button
                    onClick={() => onAddChild(node.id)}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)',
                        height: 42, padding: '0 14px',
                        color: 'var(--app-primary)',
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <Plus size={14} /> Sub
                </button>
                {onRecalc && (
                    <button
                        onClick={() => onRecalc(node)}
                        className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                        style={{
                            fontSize: 'var(--tp-md)',
                            height: 42, width: 42,
                            color: 'var(--app-muted-foreground)',
                            background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        }}
                        aria-label="Recalculate balance">
                        <RefreshCcw size={14} />
                    </button>
                )}
                {isInactive ? (
                    <button
                        onClick={() => onReactivate?.(node)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
                        style={{
                            fontSize: 'var(--tp-md)',
                            height: 42,
                            color: '#fff',
                            background: 'var(--app-success, #10b981)',
                            boxShadow: '0 2px 10px color-mix(in srgb, var(--app-success, #10b981) 30%, transparent)',
                        }}>
                        <Power size={14} /> Reactivate
                    </button>
                ) : (
                    <button
                        onClick={() => onEdit(node)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
                        style={{
                            fontSize: 'var(--tp-md)',
                            height: 42,
                            color: '#fff',
                            background: 'var(--app-primary)',
                            boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        <Pencil size={14} /> Edit
                    </button>
                )}
            </div>
        </div>
    )
}
