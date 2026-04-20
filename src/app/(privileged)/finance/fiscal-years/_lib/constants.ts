/** Status style map shared across fiscal-year components. */
export const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    OPEN:      { color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', label: 'Open' },
    CLOSED:    { color: 'var(--app-muted-foreground)',  bg: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',  label: 'Closed' },
    FUTURE:    { color: 'var(--app-info, #3b82f6)',     bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',     label: 'Future' },
    FINALIZED: { color: 'var(--app-error, #ef4444)',    bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',    label: 'Finalized' },
}

export const getStatusStyle = (s: string) => STATUS_STYLE[s] || STATUS_STYLE.OPEN
