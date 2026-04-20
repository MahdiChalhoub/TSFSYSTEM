'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Makes a bespoke `fixed inset-0` modal dismissible via:
 * - Escape key
 * - Click on the backdrop (not inside the modal content)
 *
 * Pair with a backdrop div that spreads `backdropProps` and a content div that
 * spreads `contentProps`.
 *
 * Example:
 *   const { backdropProps, contentProps } = useModalDismiss(open, onClose)
 *   return open ? (
 *     <div {...backdropProps} className="fixed inset-0 bg-black/50 ...">
 *       <div {...contentProps} className="rounded-2xl ..."> ... </div>
 *     </div>
 *   ) : null
 *
 * Why this exists: shadcn's `<Dialog>` handles both dismissals automatically,
 * but the finance/fiscal-years page uses several bespoke modals that don't.
 * Users get stuck in them. See silent-bug audit 2026-04-19.
 */
export function useModalDismiss(open: boolean, onClose: () => void) {
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose }, [onClose])

    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onCloseRef.current()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open])

    const onBackdropClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if (e.target === e.currentTarget) onCloseRef.current()
    }, [])

    return {
        backdropProps: { onClick: onBackdropClick } as const,
        contentProps: { onClick: (e: React.MouseEvent) => e.stopPropagation() } as const,
    }
}
