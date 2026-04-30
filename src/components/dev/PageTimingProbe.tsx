'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { reportPageTimings } from '@/lib/perf-timing'

/**
 * Mount once at the top of any layout that brackets every page.
 * On each route change it emits TTFB / FCP / LCP samples on the same
 * `tsf:perf-sample` event channel as click-driven actions, so they show
 * up in the bottom-right perf overlay alongside button durations.
 */
export function PageTimingProbe() {
    const pathname = usePathname() || '/'
    useEffect(() => {
        reportPageTimings(pathname)
    }, [pathname])
    return null
}
