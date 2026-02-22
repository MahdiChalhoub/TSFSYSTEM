/**
 * Safe date utilities to prevent RangeError: Invalid time value
 * 
 * Use these instead of raw `new Date(value)` when the value
 * could be null, undefined, empty string, or an invalid date string.
 */

/**
 * Safely parse a date value. Returns null if the value is falsy or produces an invalid Date.
 */
export function safeDate(value: unknown): Date | null {
    if (!value) return null
    const d = new Date(value as string | number)
    return isNaN(d.getTime()) ? null : d
}

/**
 * Get a safe timestamp for sorting. Returns 0 for invalid/missing dates,
 * which pushes them to the end of a descending sort.
 */
export function safeDateSort(value: unknown): number {
    const d = safeDate(value)
    return d ? d.getTime() : 0
}

/**
 * Safely format a date for display. Returns the fallback string if the date is invalid.
 */
export function safeDateFormat(
    value: unknown,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
    fallback: string = '—'
): string {
    const d = safeDate(value)
    if (!d) return fallback
    try {
        return d.toLocaleDateString(locale, options)
    } catch {
        return fallback
    }
}
