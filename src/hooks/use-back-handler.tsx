// @ts-nocheck
'use client'

import { useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════
 *  useBackHandler — wire Android hardware back / browser back
 *  to close an overlay (drawer, sheet, dialog) before the
 *  browser navigates away.
 *
 *  Usage:
 *    useBackHandler(open, onClose, 'drawer')
 *
 *  When `open` becomes true, a history entry is pushed. Pressing
 *  back triggers popstate → we call onClose. If the overlay is
 *  closed programmatically (not via back), we pop the entry so
 *  the history stack stays clean.
 * ═══════════════════════════════════════════════════════════ */

export function useBackHandler(open: boolean, onClose: () => void, id: string = 'overlay') {
    useEffect(() => {
        if (!open) return

        window.history.pushState({ __overlay_id: id }, '')

        const onPop = () => onClose()
        window.addEventListener('popstate', onPop)

        return () => {
            window.removeEventListener('popstate', onPop)
            // Intentionally do NOT call history.back() here. Programmatic
            // close paths (e.g., clicking a link inside the overlay that
            // calls router.push + onClose) race with Next.js's own
            // history pushState and any forced back() call during cleanup
            // cancels the forward navigation. Leaving the pushed entry in
            // place means users may need one extra back press after close,
            // which is the lesser evil.
        }
    }, [open, onClose, id])
}

/* ═══════════════════════════════════════════════════════════
 *  useEscapeKey — close an overlay on Escape
 * ═══════════════════════════════════════════════════════════ */
export function useEscapeKey(open: boolean, onClose: () => void) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open, onClose])
}
