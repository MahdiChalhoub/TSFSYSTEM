'use client'

import { Layers, TrendingUp, Calculator, ShoppingCart, BarChart3, Activity } from 'lucide-react'

export type SectionId = 'profiles' | 'sales' | 'quantity' | 'pricing' | 'scoring' | 'flow'

const SECTIONS: { id: SectionId; label: string; icon: any; color: string; keywords: string }[] = [
    { id: 'profiles', label: 'Page Profiles', icon: Layers, color: 'var(--app-accent)', keywords: 'profiles pages override' },
    { id: 'sales', label: 'Sales Analysis', icon: TrendingUp, color: 'var(--app-info)', keywords: 'sales analysis average period window exclusion' },
    { id: 'quantity', label: 'Proposed Qty', icon: Calculator, color: 'var(--app-success)', keywords: 'proposed quantity formula lead days safety multiplier replenishment' },
    { id: 'pricing', label: 'Pricing', icon: ShoppingCart, color: 'var(--app-warning)', keywords: 'supplier pricing best price period purchase context retail wholesale' },
    { id: 'scoring', label: 'Scoring', icon: BarChart3, color: 'var(--app-accent)', keywords: 'scoring data po count source financial weights margin velocity stock health' },
    { id: 'flow', label: 'Request Flow', icon: Activity, color: 'var(--app-accent-cyan)', keywords: 'request flow mode dialog instant cart purchase transfer button' },
]

type Props = {
    active: SectionId
    onSelect: (id: SectionId) => void
    overrideCounts?: Partial<Record<SectionId, number>>
    warningCounts?: Partial<Record<SectionId, number>>
    cardVisible: (keywords: string) => boolean
}

export function SectionNav({ active, onSelect, overrideCounts = {}, warningCounts = {}, cardVisible }: Props) {
    const visible = SECTIONS.filter(s => cardVisible(s.keywords))
    return (
        <nav className="flex flex-col gap-1">
            <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest px-3 mb-2">Sections</div>
            {visible.map(s => {
                const Icon = s.icon
                const isActive = active === s.id
                const ovr = overrideCounts[s.id] || 0
                const warn = warningCounts[s.id] || 0
                return (
                    <button key={s.id} type="button" onClick={() => onSelect(s.id)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left group"
                        style={isActive ? {
                            background: `color-mix(in srgb, ${s.color} 10%, var(--app-surface))`,
                            border: `1.5px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
                            boxShadow: `0 2px 8px color-mix(in srgb, ${s.color} 10%, transparent)`,
                        } : {
                            background: 'transparent',
                            border: '1.5px solid transparent',
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                            style={{
                                background: isActive ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                color: isActive ? s.color : 'var(--app-muted-foreground)',
                            }}>
                            <Icon size={13} />
                        </div>
                        <span className={`flex-1 text-[11px] font-bold transition-colors ${isActive ? 'text-app-foreground font-black' : 'text-app-muted-foreground group-hover:text-app-foreground'}`}>
                            {s.label}
                        </span>
                        {warn > 0 && (
                            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black tabular-nums"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>{warn}</span>
                        )}
                        {ovr > 0 && (
                            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black tabular-nums"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>{ovr}</span>
                        )}
                    </button>
                )
            })}
        </nav>
    )
}

export const SECTION_KEYWORDS: Record<SectionId, string> = Object.fromEntries(
    SECTIONS.map(s => [s.id, s.keywords])
) as Record<SectionId, string>
