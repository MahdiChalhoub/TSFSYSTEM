'use client'

import { useEffect, useState } from 'react'

/**
 * Returns a debounced copy of `value` — updates lag the source by `delayMs`.
 * Use in list filters so we don't re-render the whole list on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 200): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs)
        return () => clearTimeout(id)
    }, [value, delayMs])
    return debounced
}
