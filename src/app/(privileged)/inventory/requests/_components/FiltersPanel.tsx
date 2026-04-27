'use client'

import { STATUS_OPTIONS, TYPE_OPTIONS, PRIORITY_OPTIONS, type Filters } from '../_lib/constants'

export function FiltersPanel({
    isOpen, filters, setFilters,
}: {
    isOpen: boolean
    filters: Filters
    setFilters: (f: Filters) => void
}) {
    if (!isOpen) return null
    const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters({ ...filters, [key]: value })
    return (
        <div className="rounded-2xl border border-app-border/50 bg-app-surface/40 px-3 py-2.5 mt-2 animate-in slide-in-from-top-2 duration-150 grid gap-x-4 gap-y-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <SegmentedField label="Type" value={filters.type}
                onChange={v => update('type', v as Filters['type'])}
                options={['ALL', ...TYPE_OPTIONS]} />
            <SegmentedField label="Status" value={filters.status}
                onChange={v => update('status', v as Filters['status'])}
                options={['ALL', ...STATUS_OPTIONS]} />
            <SegmentedField label="Priority" value={filters.priority}
                onChange={v => update('priority', v as Filters['priority'])}
                options={['ALL', ...PRIORITY_OPTIONS]} />
            <label className="flex items-center gap-2 text-[11px] font-bold text-app-foreground cursor-pointer">
                <input type="checkbox" checked={filters.onlyBumped}
                    onChange={e => update('onlyBumped', e.target.checked)}
                    className="accent-app-primary" />
                Show only bumped requests
            </label>
        </div>
    )
}

function SegmentedField({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: readonly string[] | string[]
}) {
    return (
        <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">{label}</div>
            <div className="flex flex-wrap gap-1">
                {options.map(o => (
                    <button key={o} type="button" onClick={() => onChange(o)}
                        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                        style={{
                            background: value === o ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            color: value === o ? 'white' : 'var(--app-muted-foreground)',
                            border: `1px solid color-mix(in srgb, var(--app-border) ${value === o ? '0' : '50'}%, transparent)`,
                        }}>
                        {o === 'ALL' ? 'All' : o}
                    </button>
                ))}
            </div>
        </div>
    )
}
