// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileBottomSheet — draggable 3-snap sheet
 *  Snaps: closed (below viewport) / peek (40% visible) / expanded (90%)
 *  Drag-down past threshold closes. Backdrop tap closes.
 * ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, ReactNode } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'

type Snap = 'peek' | 'expanded' | 'closed'

interface Props {
    open: boolean
    onClose: () => void
    children: ReactNode
    initialSnap?: 'peek' | 'expanded'
}

export function MobileBottomSheet({ open, onClose, children, initialSnap = 'peek' }: Props) {
    const [snap, setSnap] = useState<Snap>('closed')
    const [vh, setVh] = useState(0)

    useEffect(() => {
        const update = () => setVh(window.innerHeight)
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    useEffect(() => {
        if (open) setSnap(initialSnap)
        else setSnap('closed')
    }, [open, initialSnap])

    // Snap-point y-offsets (distance sheet top is from viewport top)
    const yFor = (s: Snap) => {
        if (!vh) return 0
        if (s === 'closed') return vh
        if (s === 'peek') return Math.round(vh * 0.55)       // sheet covers bottom 45%
        return Math.round(vh * 0.08)                          // covers 92%
    }

    const handleDragEnd = (_: any, info: PanInfo) => {
        const { velocity, offset } = info
        const currentY = yFor(snap)
        const newY = currentY + offset.y

        // Velocity-driven snap when fast
        if (velocity.y > 500) {
            if (snap === 'expanded') setSnap('peek')
            else onClose()
            return
        }
        if (velocity.y < -500) {
            setSnap('expanded')
            return
        }

        // Position-driven snap
        if (newY > vh * 0.8) { onClose(); return }
        if (newY < vh * 0.3) { setSnap('expanded'); return }
        setSnap('peek')
    }

    const y = snap === 'closed' ? vh : yFor(snap)

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60]"
                        style={{
                            background: 'rgba(0, 0, 0, 0.45)',
                            backdropFilter: 'blur(3px)',
                        }}
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: vh }}
                        animate={{ y }}
                        exit={{ y: vh }}
                        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                        drag="y"
                        dragConstraints={{ top: yFor('expanded'), bottom: vh }}
                        dragElastic={{ top: 0.05, bottom: 0.15 }}
                        onDragEnd={handleDragEnd}
                        className="fixed left-0 right-0 top-0 z-[61] flex flex-col rounded-t-3xl shadow-2xl overflow-hidden"
                        style={{
                            height: '100dvh',
                            background: 'var(--app-surface)',
                            borderTop: '1px solid var(--app-border)',
                            touchAction: 'none',
                        }}>
                        {/* Drag handle — tap toggles peek↔expanded */}
                        <button
                            onClick={() => setSnap(snap === 'expanded' ? 'peek' : 'expanded')}
                            className="flex-shrink-0 flex flex-col items-center justify-center pt-2 pb-1 active:opacity-70 transition-opacity"
                            style={{ touchAction: 'none', minHeight: 28 }}
                            aria-label={snap === 'expanded' ? 'Collapse to peek' : 'Expand sheet'}>
                            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }} />
                        </button>
                        {/* Content — pointerEvents auto inside; outer is draggable */}
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ touchAction: 'auto' }}>
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
