import { Calendar, BarChart3, Maximize2, Minimize2, Search } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

export type PageTab = 'years' | 'multiyear'

interface PageTabsProps {
    activeTab: PageTab
    onTabChange: (tab: PageTab) => void
    focusMode: boolean
    setFocusMode: (fn: (prev: boolean) => boolean) => void
    searchQuery: string
    setSearchQuery: (q: string) => void
}

export function PageTabs({ activeTab, onTabChange, focusMode, setFocusMode, searchQuery, setSearchQuery }: PageTabsProps) {
    const { t } = useTranslation()
    const TABS: { id: PageTab; label: string; icon: typeof Calendar }[] = [
        { id: 'years', label: t('finance.fiscal_years_page.tab_years'), icon: Calendar },
        { id: 'multiyear', label: t('finance.fiscal_years_page.tab_multi_year'), icon: BarChart3 },
    ]
    return (
        <div className="flex items-center gap-1 flex-shrink-0 mb-3 px-1 py-1 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                    <button
                        key={tab.id}
                        data-tour={`${tab.id}-tab`}
                        onClick={() => onTabChange(tab.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all justify-center"
                        style={{
                            background: isActive ? 'var(--app-primary)' : 'transparent',
                            color: isActive ? 'white' : 'var(--app-muted-foreground)',
                            boxShadow: isActive ? '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'none',
                        }}
                    >
                        <Icon size={13} />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                )
            })}
            <div className="flex-1 relative mx-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                <input
                    id="fy-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('finance.fiscal_years_page.search_placeholder')}
                    className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg outline-none transition-all"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)', color: 'var(--app-foreground)' }}
                />
            </div>
            <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--app-border)' }} />
            <button
                onClick={() => setFocusMode(p => !p)}
                title={focusMode ? t('finance.fiscal_years_page.focus_exit') : t('finance.fiscal_years_page.focus_enter')}
                aria-label={focusMode ? t('finance.fiscal_years_page.focus_exit') : t('finance.fiscal_years_page.focus_enter')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0 text-[11px] font-bold"
                style={{
                    color: focusMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    background: focusMode ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                }}
            >
                {focusMode ? <><Minimize2 size={13} /><span className="hidden sm:inline">{t('finance.fiscal_years_page.focus_exit_label')}</span></> : <Maximize2 size={13} />}
            </button>
        </div>
    )
}
