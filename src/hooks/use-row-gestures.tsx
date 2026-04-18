// @ts-nocheck
'use client'

import { useEffect, useRef, useState, RefObject } from 'react'

/* ═══════════════════════════════════════════════════════════
 *  useRowGestures — pointer-based gesture detection
 *  Currently: long-press (fires after threshold with no significant movement)
 *  Cancels if the user scrolls vertically (>10px Δy) before the threshold.
 * ═══════════════════════════════════════════════════════════ */

interface Handlers {
    onLongPress?: (e: PointerEvent) => void
}

interface Options {
    longPressMs?: number       // default 450
    moveTolerancePx?: number   // default 10
}

export function useRowGestures<T extends HTMLElement>(
    ref: RefObject<T>,
    handlers: Handlers,
    options: Options = {}
) {
    const longPressMs = options.longPressMs ?? 450
    const moveTolerance = options.moveTolerancePx ?? 10
    const [isLongPressing, setIsLongPressing] = useState(false)
    const timerRef = useRef<any>(null)
    const startPosRef = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onDown = (e: PointerEvent) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return
            startPosRef.current = { x: e.clientX, y: e.clientY }
            timerRef.current = setTimeout(() => {
                setIsLongPressing(true)
                handlers.onLongPress?.(e)
                // Haptic pulse (supported on most Android, ignored on iOS Safari)
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate?.(15) } catch {}
                }
            }, longPressMs)
        }

        const cancel = () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = null
            startPosRef.current = null
            setIsLongPressing(false)
        }

        const onMove = (e: PointerEvent) => {
            const s = startPosRef.current
            if (!s) return
            const dx = Math.abs(e.clientX - s.x)
            const dy = Math.abs(e.clientY - s.y)
            if (dx > moveTolerance || dy > moveTolerance) cancel()
        }

        el.addEventListener('pointerdown', onDown, { passive: true })
        el.addEventListener('pointermove', onMove, { passive: true })
        el.addEventListener('pointerup', cancel)
        el.addEventListener('pointercancel', cancel)
        el.addEventListener('pointerleave', cancel)

        return () => {
            el.removeEventListener('pointerdown', onDown)
            el.removeEventListener('pointermove', onMove)
            el.removeEventListener('pointerup', cancel)
            el.removeEventListener('pointercancel', cancel)
            el.removeEventListener('pointerleave', cancel)
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [ref, handlers, longPressMs, moveTolerance])

    return { isLongPressing }
}
