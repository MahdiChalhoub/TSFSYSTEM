// @ts-nocheck
'use client'

import { useState, useMemo, useTransition } from 'react'
import { X, Search, FolderTree, ArrowLeft, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { reparentCategory } from '@/app/actions/inventory/categories'
import { useBackHandler, useEscapeKey } from '@/hooks/use-back-handler'
import type { CategoryNode } from '../components/types'

/* ═══════════════════════════════════════════════════════════
 *  MobileMoveDialog — pick new parent for a category
 *  Lists all categories (excluding the node itself and its descendants
 *  to prevent cycles). Also offers "Make root".
 * ═══════════════════════════════════════════════════════════ */

interface Props {
    node: CategoryNode | null
    allCategories: any[]
    onClose: () => void
}

function collectDescendantIds(id: number, all: any[]): Set<number> {
    const set = new Set<number>([id])
    let added = true
    while (added) {
        added = false
        for (const c of all) {
            if (c.parent != null && set.has(c.parent) && !set.has(c.id)) {
                set.add(c.id); added = true
            }
        }
    }
    return set
}

export function MobileMoveDialog({ node, allCategories, onClose }: Props) {
    const [q, setQ] = useState('')
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const blocked = useMemo(() => node ? collectDescendantIds(node.id, allCategories) : new Set<number>(), [node, allCategories])

    useBackHandler(node !== null, onClose, 'mobile-move-dialog')
    useEscapeKey(node !== null, onClose)

    const matches = useMemo(() => {
        if (!node) return []
        const query = q.toLowerCase().trim()
        return allCategories
            .filter(c => !blocked.has(c.id))
            .filter(c => !query || c.name?.toLowerCase().includes(query) || c.code?.toLowerCase().includes(query))
            .slice(0, 80)
    }, [allCategories, blocked, q, node])

    const move = (newParentId: number | null) => {
        if (!node) return
        if (node.parent === newParentId) { toast.info('Already in this location'); return }
        startTransition(async () => {
            const r = await reparentCategory(node.id, newParentId)
            if (r.success) {
                toast.success(`Moved "${node.name}"`)
                router.refresh()
                onClose()
            } else {
                toast.error(r.message || 'Move failed')
            }
        })
    }

    return (
        <AnimatePresence>
            {node && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80]"
                        style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)' }}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                        className="fixed inset-x-0 bottom-0 z-[81] flex flex-col rounded-t-3xl overflow-hidden"
                        style={{
                            height: '88dvh',
                            background: 'var(--app-surface)',
                            borderTop: '1px solid var(--app-border)',
                            boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
                        }}>
                        {/* Drag handle */}
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }} />
                        </div>

                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2">
                            <button onClick={onClose} className="p-2 rounded-lg active:scale-95 transition-transform"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="text-tp-lg font-bold text-app-foreground truncate">Move "{node.name}"</div>
                                <div className="text-tp-sm font-bold text-app-muted-foreground">Pick a new parent</div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-lg active:scale-95 transition-transform"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="flex-shrink-0 px-3 pb-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    autoFocus={false}
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Search destination…"
                                    className="w-full pl-9 pr-3 text-tp-xl bg-app-surface/50 border border-app-border/60 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 outline-none"
                                    style={{ height: 42 }}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3 custom-scrollbar">
                            {/* Make root */}
                            <button
                                disabled={isPending || node.parent === null}
                                onClick={() => move(null)}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-2 active:scale-[0.99] transition-all"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    opacity: node.parent === null ? 0.5 : 1,
                                }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 22%, transparent)',
                                }}>
                                    <FolderTree size={16} />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-tp-xl font-bold text-app-foreground">Make Root</div>
                                    <div className="text-tp-sm font-bold text-app-muted-foreground">No parent · top-level category</div>
                                </div>
                                {node.parent === null && <Check size={16} style={{ color: 'var(--app-primary)' }} />}
                            </button>

                            {matches.length === 0 ? (
                                <div className="text-center py-10 text-tp-md font-bold text-app-muted-foreground">
                                    No matching categories
                                </div>
                            ) : matches.map(c => {
                                const isCurrent = node.parent === c.id
                                return (
                                    <button
                                        key={c.id}
                                        disabled={isPending || isCurrent}
                                        onClick={() => move(c.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 active:scale-[0.99] transition-all"
                                        style={{
                                            background: isCurrent
                                                ? 'color-mix(in srgb, var(--app-primary) 7%, transparent)'
                                                : 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                                            border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                            opacity: isCurrent ? 0.6 : 1,
                                        }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 10,
                                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            color: 'var(--app-muted-foreground)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <FolderTree size={14} />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="text-tp-lg font-bold text-app-foreground truncate">{c.name}</div>
                                            {c.code && (
                                                <div className="text-tp-xs font-mono font-bold text-app-muted-foreground truncate">{c.code}</div>
                                            )}
                                        </div>
                                        {isCurrent && (
                                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                                Current
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
