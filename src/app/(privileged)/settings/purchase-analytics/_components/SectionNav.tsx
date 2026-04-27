'use client'

import { Layers, TrendingUp, Calculator, ShoppingCart, BarChart3, Activity } from 'lucide-react'

export type SectionId = 'profiles' | 'sales' | 'quantity' | 'pricing' | 'scoring' | 'flow'

const SECTIONS: { id: SectionId; label: string; icon: any; color: string; keywords: string }[] = [
    { id: 'profiles', label: 'Page Profiles', icon: Layers, color: 'text-indigo-500', keywords: 'profiles pages override' },
    { id: 'sales', label: 'Sales Analysis', icon: TrendingUp, color: 'text-blue-500', keywords: 'sales analysis average period window exclusion' },
    { id: 'quantity', label: 'Proposed Quantity', icon: Calculator, color: 'text-emerald-500', keywords: 'proposed quantity formula lead days safety multiplier replenishment' },
    { id: 'pricing', label: 'Supplier & Pricing', icon: ShoppingCart, color: 'text-amber-500', keywords: 'supplier pricing best price period purchase context retail wholesale' },
    { id: 'scoring', label: 'Scoring & Sources', icon: BarChart3, color: 'text-purple-500', keywords: 'scoring data po count source financial weights margin velocity stock health' },
    { id: 'flow', label: 'Request Flow', icon: Activity, color: 'text-cyan-500', keywords: 'request flow mode dialog instant cart purchase transfer button' },
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
        <nav className="flex flex-col gap-0.5">
            <div className="text-[9px] font-black text-app-muted-foreground/60 uppercase tracking-widest px-2 mb-1">Sections</div>
            {visible.map(s => {
                const Icon = s.icon
                const isActive = active === s.id
                const ovr = overrideCounts[s.id] || 0
                const warn = warningCounts[s.id] || 0
                return (
                    <button key={s.id} type="button" onClick={() => onSelect(s.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left ${
                            isActive ? 'bg-app-primary/10 ring-1 ring-app-primary/30' : 'hover:bg-app-background/40'
                        }`}>
                        <Icon size={13} className={isActive ? 'text-app-primary' : s.color} />
                        <span className={`flex-1 text-[11px] font-bold ${isActive ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>{s.label}</span>
                        {warn > 0 && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 font-black tabular-nums">{warn}</span>
                        )}
                        {ovr > 0 && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-app-primary/10 text-app-primary font-black tabular-nums">{ovr}</span>
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
