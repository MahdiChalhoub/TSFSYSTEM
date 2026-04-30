'use client'
/**
 * FX Management — sub-tab bar (only used in standalone mode).
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { Coins, RefreshCcw, TrendingUp } from 'lucide-react'
import { grad, FG_PRIMARY } from '../fx/_shared'
import type { FxView } from './constants'

export function SubTabBar({ tab, setTab, counts }: {
    tab: FxView
    setTab: (t: FxView) => void
    counts: { rates: number; history: number; reval: number }
}) {
    const items: { key: FxView; label: string; icon: any; count: number }[] = [
        { key: 'rates', label: 'Rate History', icon: TrendingUp, count: counts.history },
        { key: 'policies', label: 'Rate Rules', icon: RefreshCcw, count: counts.rates },
        { key: 'revaluations', label: 'Revaluations', icon: Coins, count: counts.reval },
    ]
    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
            {items.map(it => {
                const Icon = it.icon; const active = tab === it.key
                return (
                    <button key={it.key} onClick={() => setTab(it.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all duration-200"
                        style={active
                            ? { ...grad('--app-primary'), color: FG_PRIMARY, boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 30%, transparent)' }
                            : { color: 'var(--app-muted-foreground)', background: 'transparent' }}>
                        <Icon size={12} /> {it.label}
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded tabular-nums"
                            style={active
                                ? { background: 'color-mix(in srgb, var(--app-primary-foreground, #fff) 22%, transparent)' }
                                : { background: 'var(--app-background)' }}>
                            {it.count}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
