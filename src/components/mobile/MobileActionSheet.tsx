// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileActionSheet — compact iOS-style action menu
 *  Layout: header → 2-col view-action grid → divider → list of
 *  management actions → destructive row → sticky Cancel.
 *  The entire content area scrolls internally if it exceeds
 *  the max-height, so nothing is ever clipped off-screen.
 * ═══════════════════════════════════════════════════════════ */

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ActionItem {
    key: string
    label: string
    icon?: ReactNode
    onClick: () => void
    destructive?: boolean
    disabled?: boolean
    hint?: string
    /** 'grid' renders as a compact tile in the top grid; 'list' (default) as a full-width row */
    variant?: 'grid' | 'list'
}

interface Props {
    open: boolean
    onClose: () => void
    title?: string
    subtitle?: string
    items: ActionItem[]
}

export function MobileActionSheet({ open, onClose, title, subtitle, items }: Props) {
    const gridItems = items.filter(i => i.variant === 'grid')
    const listItems = items.filter(i => i.variant !== 'grid' && !i.destructive)
    const destructiveItems = items.filter(i => i.destructive)

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[70]"
                        style={{
                            background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)',
                            backdropFilter: 'blur(3px)',
                        }}
                    />
                    <motion.div
                        initial={{ y: '110%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '110%' }}
                        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                        className="fixed left-2 right-2 z-[71] flex flex-col rounded-3xl overflow-hidden"
                        style={{
                            bottom: 'calc(12px + env(safe-area-inset-bottom, 0))',
                            maxHeight: 'calc(92dvh - env(safe-area-inset-bottom, 0))',
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 -14px 44px rgba(0,0,0,0.4)',
                        }}>

                        {/* Drag handle (visual only) */}
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }} />
                        </div>

                        {/* Header */}
                        {(title || subtitle) && (
                            <div className="flex-shrink-0 px-4 pt-1 pb-3 border-b" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                {title && <div className="text-tp-xl font-black text-app-foreground truncate leading-tight">{title}</div>}
                                {subtitle && <div className="text-tp-sm font-bold text-app-muted-foreground truncate mt-0.5">{subtitle}</div>}
                            </div>
                        )}

                        {/* Scrollable body */}
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
                            {/* 2-col view-action grid */}
                            {gridItems.length > 0 && (
                                <div className="p-2.5 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                    {gridItems.map(it => (
                                        <button
                                            key={it.key}
                                            disabled={it.disabled}
                                            onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
                                            className="flex items-center gap-2 px-2.5 py-2.5 rounded-xl active:scale-[0.97] transition-all text-left"
                                            style={{
                                                opacity: it.disabled ? 0.45 : 1,
                                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                                border: '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                                            }}>
                                            {it.icon && (
                                                <span className="flex-shrink-0 flex items-center justify-center"
                                                    style={{
                                                        width: 30, height: 30, borderRadius: 9,
                                                        color: 'var(--app-primary)',
                                                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                                    }}>{it.icon}</span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-tp-md font-black text-app-foreground leading-tight truncate">{it.label}</div>
                                                {it.hint && <div className="text-tp-xs font-bold text-app-muted-foreground truncate">{it.hint}</div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {gridItems.length > 0 && listItems.length > 0 && (
                                <div className="mx-4 my-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-border) 55%, transparent)' }} />
                            )}

                            {/* List of management actions — compact rows */}
                            {listItems.length > 0 && (
                                <div className="flex flex-col py-1">
                                    {listItems.map(it => (
                                        <button
                                            key={it.key}
                                            disabled={it.disabled}
                                            onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
                                            className="flex items-center gap-3 px-4 py-2.5 text-left active:bg-app-primary/10 transition-colors"
                                            style={{ opacity: it.disabled ? 0.4 : 1, color: 'var(--app-foreground)' }}>
                                            {it.icon && (
                                                <span className="flex-shrink-0 flex items-center justify-center"
                                                    style={{
                                                        width: 28, height: 28, borderRadius: 8,
                                                        color: 'var(--app-muted-foreground)',
                                                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                                                    }}>{it.icon}</span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-tp-lg font-bold truncate leading-tight">{it.label}</div>
                                                {it.hint && <div className="text-tp-sm font-medium text-app-muted-foreground truncate leading-tight">{it.hint}</div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {destructiveItems.length > 0 && (
                                <div className="mx-4 my-1 h-px" style={{ background: 'color-mix(in srgb, var(--app-border) 55%, transparent)' }} />
                            )}

                            {/* Destructive actions at the bottom */}
                            {destructiveItems.map(it => (
                                <button
                                    key={it.key}
                                    disabled={it.disabled}
                                    onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-app-primary/10 transition-colors"
                                    style={{
                                        opacity: it.disabled ? 0.4 : 1,
                                        color: 'var(--app-error, #ef4444)',
                                    }}>
                                    {it.icon && (
                                        <span className="flex-shrink-0 flex items-center justify-center"
                                            style={{
                                                width: 28, height: 28, borderRadius: 8,
                                                color: 'var(--app-error, #ef4444)',
                                                background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                                            }}>{it.icon}</span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-tp-lg font-black truncate leading-tight">{it.label}</div>
                                        {it.hint && <div className="text-tp-sm font-medium truncate leading-tight" style={{ color: 'color-mix(in srgb, var(--app-error, #ef4444) 75%, transparent)' }}>{it.hint}</div>}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Sticky Cancel */}
                        <div className="flex-shrink-0 p-2.5 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 55%, transparent)', background: 'var(--app-surface)' }}>
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 rounded-2xl text-tp-lg font-black active:scale-[0.98] transition-all"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-border) 35%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                }}>
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
