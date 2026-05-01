'use client'

import { useState } from 'react'
import {
    X, Pencil, Pin, Settings2,
    Monitor, BookOpen, Zap, FolderTree, Hash, Info,
    Layers, CreditCard,
} from 'lucide-react'
import type { AccountCategoryNode, PanelTab } from './types'
import { getIcon, DEFAULT_COLOR } from '../_components/constants'

/* ═══════════════════════════════════════════════════════════
 *  AccountCategoryDetailPanel — sidebar detail view
 *  Modeled after inventory CategoryDetailPanel.
 * ═══════════════════════════════════════════════════════════ */
export function AccountCategoryDetailPanel({
    node, onEdit, onDelete, onClose, onPin, orgGateways,
}: {
    node: AccountCategoryNode
    onEdit: (n: AccountCategoryNode) => void
    onDelete: (n: AccountCategoryNode) => void
    onClose: () => void
    onPin?: (n: AccountCategoryNode) => void
    orgGateways: any[]
}) {
    const [tab, setTab] = useState<PanelTab>('overview')
    const Icon = getIcon(node.icon)
    const color = node.color || DEFAULT_COLOR
    const accountCount = node.account_count ?? 0
    const coaInfo = node.coa_parent_name
        ? `${node.coa_parent_code || ''} — ${node.coa_parent_name}`
        : null
    const gatewayInfo = node.is_digital && node.digital_gateway
        ? orgGateways.find((g: any) => g.id === node.digital_gateway)
        : null

    const tabs: { key: PanelTab; label: string; icon: React.ReactNode; count?: number; color?: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Settings2 size={13} /> },
        { key: 'accounts', label: 'Accounts', icon: <CreditCard size={13} />, count: accountCount, color: 'var(--app-info)' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
                style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, ${color} 5%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid var(--app-border)',
                }}>
                {/* Icon tile */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, var(--app-accent)))`,
                        color: 'white',
                        boxShadow: `0 3px 10px color-mix(in srgb, ${color} 30%, transparent)`,
                    }}>
                    <Icon size={15} />
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-tp-lg font-bold tracking-tight truncate leading-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        {node.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-tp-xxs font-bold">
                            <span className="uppercase tracking-widest opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>Code</span>
                            <span className="font-mono px-1.5 py-0.5 rounded"
                                style={{
                                    background: `color-mix(in srgb, ${color} 10%, transparent)`,
                                    color: color,
                                }}>
                                {node.code}
                            </span>
                        </span>
                        {!node.is_active && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                    color: 'var(--app-error)',
                                }}>
                                INACTIVE
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 px-1 py-1 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid var(--app-border)' }}>
                    <button onClick={() => onEdit(node)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
                        title="Edit">
                        <Pencil size={13} />
                    </button>
                    {onPin && (
                        <button onClick={() => onPin(node)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
                            title="Pin sidebar">
                            <Pin size={13} />
                        </button>
                    )}
                    <button onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
                        title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tab Strip */}
            <div className="flex-shrink-0 flex items-center px-1 py-1"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-tp-sm font-semibold transition-colors relative"
                        style={tab === t.key ? {
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                        } : {
                            color: 'var(--app-muted-foreground)',
                        }}>
                        {t.icon} {t.label}
                        {t.count != null && t.count > 0 && (
                            <span className="ml-0.5 text-tp-xxs font-bold px-1 py-[1px] rounded-full min-w-[16px] text-center"
                                style={{
                                    background: tab === t.key
                                        ? `color-mix(in srgb, ${t.color || 'var(--app-primary)'} 15%, transparent)`
                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    color: tab === t.key ? (t.color || 'var(--app-primary)') : 'var(--app-muted-foreground)',
                                }}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {tab === 'overview' && (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <OverviewContent
                            node={node}
                            color={color}
                            coaInfo={coaInfo}
                            gatewayInfo={gatewayInfo}
                            accountCount={accountCount}
                        />
                    </div>
                )}
                {tab === 'accounts' && (
                    <div className="h-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center py-16 px-4 text-center">
                        <CreditCard size={32} className="mb-3 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-sm font-bold text-app-muted-foreground">
                            {accountCount} account{accountCount !== 1 ? 's' : ''} in this category
                        </p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1 max-w-xs">
                            View and manage accounts from the Financial Accounts page.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Overview Content ── */
function OverviewContent({
    node, color, coaInfo, gatewayInfo, accountCount,
}: {
    node: AccountCategoryNode
    color: string
    coaInfo: string | null
    gatewayInfo: any
    accountCount: number
}) {
    return (
        <div className="p-4 space-y-4">
            {/* Description */}
            {node.description && (
                <div className="rounded-xl px-3 py-2.5"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    <p className="text-tp-sm text-app-muted-foreground leading-relaxed">{node.description}</p>
                </div>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <StatCard label="Accounts" value={accountCount} color="var(--app-info)" icon={<CreditCard size={12} />} />
                <StatCard label="Sort Order" value={`#${node.sort_order}`} color="var(--app-muted-foreground)" icon={<Hash size={12} />} />
            </div>

            {/* Feature Toggles Status */}
            <div className="space-y-2">
                <SectionLabel icon={<Layers size={11} />} label="Child Account Defaults" color={color} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <FeatureBadge
                        label="POS Enabled"
                        active={node.default_pos_enabled}
                        icon={<Monitor size={11} />}
                        color="var(--app-success)"
                    />
                    <FeatureBadge
                        label="Account Book"
                        active={node.default_has_account_book}
                        icon={<BookOpen size={11} />}
                        color="var(--app-info)"
                    />
                </div>
            </div>

            {/* COA Linkage */}
            <div className="space-y-2">
                <SectionLabel icon={<FolderTree size={11} />} label="COA Linkage" color="var(--app-warning)" />
                {coaInfo ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))',
                            border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)',
                        }}>
                        <FolderTree size={12} style={{ color: 'var(--app-warning)' }} />
                        <span className="text-[11px] font-black text-app-foreground">{coaInfo}</span>
                    </div>
                ) : (
                    <div className="px-3 py-2 rounded-xl text-[10px] font-bold text-app-muted-foreground"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                        }}>
                        No COA parent linked
                    </div>
                )}
            </div>

            {/* Digital Integration */}
            {node.is_digital && (
                <div className="space-y-2">
                    <SectionLabel icon={<Zap size={11} />} label="Digital Integration" color="var(--app-accent)" />
                    {gatewayInfo ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                            style={{
                                background: `color-mix(in srgb, ${gatewayInfo.gateway_color || 'var(--app-accent)'} 6%, var(--app-surface))`,
                                border: `1px solid color-mix(in srgb, ${gatewayInfo.gateway_color || 'var(--app-accent)'} 20%, transparent)`,
                            }}>
                            <span className="text-base shrink-0">{gatewayInfo.gateway_emoji || '💳'}</span>
                            <div className="min-w-0">
                                <div className="text-[11px] font-black text-app-foreground">{gatewayInfo.gateway_name}</div>
                                <div className="text-[9px] font-bold text-app-muted-foreground">{gatewayInfo.gateway_family || gatewayInfo.gateway_code}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                            style={{
                                background: 'color-mix(in srgb, var(--app-accent) 6%, var(--app-surface))',
                                color: 'var(--app-accent)',
                                border: '1px solid color-mix(in srgb, var(--app-accent) 15%, transparent)',
                            }}>
                            Digital account — no specific gateway selected
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ── Primitives ── */
function SectionLabel({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{label}</span>
        </div>
    )
}

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
            }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground">{label}</div>
                <div className="text-sm font-black tabular-nums" style={{ color }}>{value}</div>
            </div>
        </div>
    )
}

function FeatureBadge({ label, active, icon, color }: { label: string; active: boolean; icon: React.ReactNode; color: string }) {
    const c = active ? color : 'var(--app-muted-foreground)'
    return (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
            style={{
                background: active
                    ? `color-mix(in srgb, ${color} 8%, var(--app-surface))`
                    : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                border: `1px solid color-mix(in srgb, ${active ? color : 'var(--app-border)'} ${active ? '25' : '40'}%, transparent)`,
            }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-bold" style={{ color: c }}>{label}</div>
                <div className="text-[8px] font-bold text-app-muted-foreground">
                    {active ? 'Enabled' : 'Disabled'}
                </div>
            </div>
        </div>
    )
}
