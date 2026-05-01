'use client'

import { useState, useRef, useEffect } from 'react'
import {
    ChevronRight, Pencil, Trash2, Monitor, BookOpen, Zap,
    FolderTree,
} from 'lucide-react'
import type { AccountCategoryNode } from './types'
import { getIcon, DEFAULT_COLOR } from '../_components/constants'

/* ═══════════════════════════════════════════════════════════
 *  AccountCategoryRow — flat row for TreeMasterPage
 *  Modeled after inventory CategoryRow visual pattern.
 * ═══════════════════════════════════════════════════════════ */
export function AccountCategoryRow({
    node, onEdit, onDelete, onSelect, searchQuery, compact,
}: {
    node: AccountCategoryNode
    onEdit: (n: AccountCategoryNode) => void
    onDelete: (n: AccountCategoryNode) => void
    onSelect?: (n: AccountCategoryNode) => void
    searchQuery: string
    compact?: boolean
}) {
    const Icon = getIcon(node.icon)
    const color = node.color || DEFAULT_COLOR
    const accountCount = node.account_count ?? 0
    const coaInfo = node.coa_parent_name
        ? `${node.coa_parent_code || ''} — ${node.coa_parent_name}`
        : null

    return (
        <div>
            <div
                className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
                onClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(node)
                }}
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}
            >
                {/* Left accent bar with category color */}
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                    style={{ background: color }} />

                {/* Row body */}
                <div
                    className="relative flex items-center gap-2.5 flex-1 min-w-0 py-2.5"
                    style={{ paddingLeft: '16px', paddingRight: '12px' }}
                >
                    {/* Icon */}
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: `color-mix(in srgb, ${color} 12%, transparent)`,
                            color: color,
                        }}
                    >
                        <Icon size={18} />
                    </div>

                    {/* Name block */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-tp-lg font-bold text-app-foreground">
                                {node.name}
                            </span>
                            {!node.is_active && (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                        color: 'var(--app-error)',
                                    }}>
                                    INACTIVE
                                </span>
                            )}
                        </div>
                        {/* Feature badges */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.default_pos_enabled && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                        color: 'var(--app-success)',
                                    }}>
                                    <Monitor size={8} /> POS
                                </span>
                            )}
                            {node.default_has_account_book && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-info) 10%, transparent)',
                                        color: 'var(--app-info)',
                                    }}>
                                    <BookOpen size={8} /> BOOK
                                </span>
                            )}
                            {node.is_digital && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)',
                                        color: 'var(--app-accent)',
                                    }}>
                                    <Zap size={8} /> DIGITAL
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Secondary columns — hidden when compact ── */}
                    {!compact && (
                        <>
                            {/* Code */}
                            <div className="hidden sm:flex w-20 flex-shrink-0 justify-center">
                                <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                        background: `color-mix(in srgb, ${color} 10%, transparent)`,
                                        color: color,
                                    }}>
                                    {node.code}
                                </span>
                            </div>

                            {/* Account count */}
                            <div className="hidden sm:flex w-[72px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{
                                        color: accountCount > 0
                                            ? 'var(--app-info)'
                                            : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)',
                                    }}>
                                    {accountCount}
                                </span>
                            </div>

                            {/* COA link */}
                            <div className="hidden sm:flex w-20 flex-shrink-0 justify-center">
                                {coaInfo ? (
                                    <span className="inline-flex items-center gap-1 text-tp-xxs font-bold truncate max-w-full"
                                        style={{ color: 'var(--app-warning)' }}
                                        title={coaInfo}>
                                        <FolderTree size={9} />
                                        <span className="truncate">{node.coa_parent_code}</span>
                                    </span>
                                ) : (
                                    <span className="text-tp-xs tabular-nums"
                                        style={{ color: 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                        –
                                    </span>
                                )}
                            </div>

                            {/* Sort order */}
                            <div className="hidden sm:flex w-[72px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-bold tabular-nums text-app-muted-foreground">
                                    #{node.sort_order}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Actions — appear on hover */}
                    <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(node) }}
                            className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(node) }}
                            className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors"
                            title="Delete">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
