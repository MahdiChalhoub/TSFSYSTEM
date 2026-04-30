'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { runTimed } from '@/lib/perf-timing'

/**
 * Drop-in replacement for `<button>` that auto-times its async onClick.
 * Use this for buttons whose handler does network I/O (server actions,
 * API calls, navigations). Pure presentation buttons don't need it.
 *
 * Required: `perfLabel="<page>:<action>"`.
 *
 * Example:
 *   <TimedButton perfLabel="purchases.po:reject" onClick={handleReject}>
 *     Reject
 *   </TimedButton>
 */
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
    perfLabel: string
    perfTags?: Record<string, string | number | boolean>
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
}

export const TimedButton = forwardRef<HTMLButtonElement, Props>(
    function TimedButton({ perfLabel, perfTags, onClick, ...rest }, ref) {
        return (
            <button
                ref={ref}
                {...rest}
                onClick={(e) => {
                    if (!onClick) return
                    const result = onClick(e)
                    if (result && typeof (result as any).then === 'function') {
                        // Wrap the in-flight promise in a timer. We can't await it
                        // on the click handler's behalf (React event handlers are
                        // sync) but runTimed only needs to start a timer.
                        void runTimed(perfLabel, () => result as Promise<void>, perfTags)
                    }
                }}
            />
        )
    },
)
