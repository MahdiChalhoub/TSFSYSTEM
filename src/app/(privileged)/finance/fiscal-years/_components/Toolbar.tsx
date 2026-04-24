import { Search, Plus, Maximize2, Minimize2, Calendar, X } from 'lucide-react'
import type { FiscalYearStats } from '../_lib/types'

interface ToolbarProps {
    focusMode: boolean
    setFocusMode: (fn: (prev: boolean) => boolean) => void
    searchQuery: string
    setSearchQuery: (q: string) => void
    statusFilter: string | null
    setStatusFilter: (f: string | null) => void
    stats: FiscalYearStats
    openWizard: () => void
}

export function Toolbar({ focusMode, setFocusMode, searchQuery, setSearchQuery, statusFilter, setStatusFilter, stats, openWizard }: ToolbarProps) {
    return (
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            {focusMode && (
                <div className="flex items-center gap-2 flex-shrink-0 mr-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-tp-sm font-bold"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                        <Calendar size={12} /> {stats.total} years
                    </div>
                    {statusFilter && (
                        <button onClick={() => setStatusFilter(null)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-tp-xs font-bold transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)', color: 'var(--app-primary)' }}>
                            {statusFilter} <X size={10} />
                        </button>
                    )}
                </div>
            )}
            <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                <input id="fy-search-input" type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search fiscal years... (Ctrl+K)"
                    className="w-full pl-9 pr-3 py-2 text-tp-md md:text-tp-lg rounded-xl outline-none transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.background = 'var(--app-surface)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            </div>
            {focusMode && (
                <button onClick={openWizard} className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                    <Plus size={11} /> New
                </button>
            )}
            <button onClick={() => setFocusMode(p => !p)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all flex-shrink-0 text-tp-sm font-bold"
                style={{ color: focusMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)', borderColor: focusMode ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'var(--app-border)', background: focusMode ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent' }}>
                {focusMode ? <><Minimize2 size={13} /> Exit</> : <Maximize2 size={13} />}
            </button>
        </div>
    )
}
