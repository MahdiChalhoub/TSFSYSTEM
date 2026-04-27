export function formatRelative(input: string | Date | null | undefined): string {
    if (!input) return ''
    const date = input instanceof Date ? input : new Date(input)
    if (isNaN(date.getTime())) return ''
    const diffMs = Date.now() - date.getTime()
    const sec = Math.round(diffMs / 1000)
    if (sec < 60) return `${Math.max(0, sec)}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    const mo = Math.round(day / 30)
    if (mo < 12) return `${mo}mo ago`
    return `${Math.round(mo / 12)}y ago`
}

export function formatDateTime(input: string | Date | null | undefined): string {
    if (!input) return '—'
    const date = input instanceof Date ? input : new Date(input)
    if (isNaN(date.getTime())) return '—'
    return (
        date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    )
}

export function fmtQty(n: number | string | null | undefined): string {
    if (n == null || n === '') return '—'
    const v = typeof n === 'string' ? parseFloat(n) : n
    if (isNaN(v)) return '—'
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v)
}
