'use client'

import { useState, useEffect } from 'react'

/** Returns true when viewport width is below `breakpoint` (default 640 = Tailwind `sm`). */
export function useIsMobile(breakpoint = 640) {
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
        const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
        handler(mql)
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [breakpoint])

    return isMobile
}
