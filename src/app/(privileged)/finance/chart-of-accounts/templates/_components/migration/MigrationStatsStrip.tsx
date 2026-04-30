'use client'

import { LEVEL_COLORS, LEVEL_LABELS } from './MigrationConstants'

// Stats strip with filter buttons for migration mapping levels
export function MigrationStatsStrip({
    fullMappingCount, stats, filterLevel, setFilterLevel,
}: {
    fullMappingCount: number
    stats: Record<string, number>
    filterLevel: string
    setFilterLevel: (level: string) => void
}) {
    return (
        <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
            <button onClick={() => setFilterLevel('ALL')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                style={{
                    background: filterLevel === 'ALL' ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                    border: filterLevel === 'ALL' ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                <div className="text-tp-xs font-bold uppercase tracking-wider text-app-muted-foreground">All</div>
                <div className="text-sm font-bold text-app-foreground tabular-nums ml-auto">{fullMappingCount}</div>
            </button>
            {(['HINT', 'CODE', 'NAME', 'MERGE', 'SPLIT'] as const).map(level => (
                <button key={level} onClick={() => setFilterLevel(filterLevel === level ? 'ALL' : level)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                    style={{
                        background: filterLevel === level ? `color-mix(in srgb, ${LEVEL_COLORS[level]} 8%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                        border: filterLevel === level ? `1px solid color-mix(in srgb, ${LEVEL_COLORS[level]} 30%, transparent)` : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LEVEL_COLORS[level] }} />
                    <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground">{LEVEL_LABELS[level]}</div>
                    <div className="text-sm font-bold text-app-foreground tabular-nums ml-auto">{stats[level] || 0}</div>
                </button>
            ))}
        </div>
    )
}
