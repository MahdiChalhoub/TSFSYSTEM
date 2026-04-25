import { Calendar, BarChart3, ShieldCheck, Link2, Maximize2, Minimize2 } from 'lucide-react'

export type PageTab = 'years' | 'multiyear' | 'snapshots' | 'integrity'

const TABS: { id: PageTab; label: string; icon: typeof Calendar }[] = [
    { id: 'years', label: 'Fiscal Years', icon: Calendar },
    { id: 'multiyear', label: 'Multi-Year', icon: BarChart3 },
    { id: 'snapshots', label: 'Snapshots', icon: Link2 },
    { id: 'integrity', label: 'Integrity', icon: ShieldCheck },
]

interface PageTabsProps {
    activeTab: PageTab
    onTabChange: (tab: PageTab) => void
    focusMode: boolean
    setFocusMode: (fn: (prev: boolean) => boolean) => void
}

export function PageTabs({ activeTab, onTabChange, focusMode, setFocusMode }: PageTabsProps) {
    return (
        <div className="flex items-center gap-1 flex-shrink-0 mb-3 px-1 py-1 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            {TABS.map(t => {
                const Icon = t.icon
                const isActive = activeTab === t.id
                return (
                    <button
                        key={t.id}
                        onClick={() => onTabChange(t.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-tp-sm font-bold transition-all flex-1 justify-center"
                        style={{
                            background: isActive ? 'var(--app-primary)' : 'transparent',
                            color: isActive ? 'white' : 'var(--app-muted-foreground)',
                            boxShadow: isActive ? '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'none',
                        }}
                    >
                        <Icon size={13} />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                )
            })}
            <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: 'var(--app-border)' }} />
            <button
                onClick={() => setFocusMode(p => !p)}
                title={focusMode ? 'Exit focus mode — Ctrl+Q' : 'Focus mode — Ctrl+Q'}
                aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0 text-tp-sm font-bold"
                style={{
                    color: focusMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    background: focusMode ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                }}
            >
                {focusMode ? <><Minimize2 size={13} /><span className="hidden sm:inline">Exit</span></> : <Maximize2 size={13} />}
            </button>
        </div>
    )
}
