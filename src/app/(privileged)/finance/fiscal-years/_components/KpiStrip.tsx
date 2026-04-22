import { X } from 'lucide-react'
import type { KpiItem } from '../_lib/types'

interface KpiStripProps {
    kpis: KpiItem[]
    statusFilter: string | null
    setStatusFilter: (f: string | null) => void
}

export function KpiStrip({ kpis, statusFilter, setStatusFilter }: KpiStripProps) {
    return (
        <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
            {kpis.map(k => {
                const isActive = statusFilter === k.filterKey || (k.filterKey === 'ALL' && statusFilter === null)
                const Icon = k.icon as any
                return (
                    <button key={k.label}
                        onClick={() => {
                            if (k.filterKey === 'ALL' || statusFilter === k.filterKey) setStatusFilter(null)
                            else setStatusFilter(k.filterKey)
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                        style={{
                            background: isActive ? `color-mix(in srgb, ${k.color} 8%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: isActive ? `2px solid color-mix(in srgb, ${k.color} 40%, transparent)` : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            cursor: 'pointer',
                            transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${k.color} ${isActive ? '18' : '10'}%, transparent)`, color: k.color }}>
                            <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-tp-xxs font-bold uppercase tracking-wider truncate"
                                style={{ color: isActive ? k.color : 'var(--app-muted-foreground)' }}>{k.label}</div>
                            <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>{k.value}</div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}
