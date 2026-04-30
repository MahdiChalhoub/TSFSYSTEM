// ── Level color/label maps for migration mapping table ──
export const LEVEL_COLORS: Record<string, string> = {
    HINT: 'var(--app-success, #22c55e)',
    CODE: 'var(--app-info, #3b82f6)',
    NAME: 'var(--app-info)',
    MERGE: 'var(--app-warning, #f59e0b)',
    SPLIT: 'var(--app-error)',
}

export const LEVEL_LABELS: Record<string, string> = {
    HINT: 'Override', CODE: 'Exact Code', NAME: 'Name Match',
    MERGE: 'N→1 Merge', SPLIT: '1→N Split',
}
