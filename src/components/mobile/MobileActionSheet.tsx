// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileActionSheet — iOS-style action menu anchored to bottom
 *  Items render as large tap targets. Destructive variant colors red.
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
}

interface Props {
    open: boolean
    onClose: () => void
    title?: string
    subtitle?: string
    items: ActionItem[]
}

export function MobileActionSheet({ open, onClose, title, subtitle, items }: Props) {
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
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.35)',
                        }}>
                        {(title || subtitle) && (
                            <div className="px-4 pt-3 pb-2 border-b" style={{ borderColor: 'var(--app-border)' }}>
                                {title && <div className="text-[15px] font-black text-app-foreground truncate">{title}</div>}
                                {subtitle && <div className="text-[11px] font-bold text-app-muted-foreground truncate">{subtitle}</div>}
                            </div>
                        )}
                        <div className="flex flex-col py-1">
                            {items.map((it) => (
                                <button
                                    key={it.key}
                                    onClick={() => { if (!it.disabled) { it.onClick(); onClose() } }}
                                    disabled={it.disabled}
                                    className="flex items-center gap-3 px-4 py-3.5 text-left active:bg-app-primary/10 transition-colors"
                                    style={{
                                        opacity: it.disabled ? 0.4 : 1,
                                        color: it.destructive ? 'var(--app-error, #ef4444)' : 'var(--app-foreground)',
                                    }}>
                                    {it.icon && (
                                        <span className="flex-shrink-0 flex items-center justify-center"
                                            style={{
                                                width: 34, height: 34, borderRadius: 10,
                                                color: it.destructive ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)',
                                                background: it.destructive
                                                    ? 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)'
                                                    : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                                            }}>
                                            {it.icon}
                                        </span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] font-bold truncate">{it.label}</div>
                                        {it.hint && (
                                            <div className="text-[11px] font-medium text-app-muted-foreground truncate">{it.hint}</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            className="mx-3 mb-3 mt-1 py-3 rounded-2xl text-[14px] font-black active:scale-[0.98] transition-all"
                            style={{
                                background: 'color-mix(in srgb, var(--app-border) 35%, transparent)',
                                color: 'var(--app-muted-foreground)',
                            }}>
                            Cancel
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
