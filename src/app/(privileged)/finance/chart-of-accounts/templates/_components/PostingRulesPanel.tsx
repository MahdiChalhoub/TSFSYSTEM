'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Workflow, BookMarked } from 'lucide-react'
import { EmptyState } from './EmptyState'

// ══════════════════════════════════════════════════════════════════
// Posting Rules Panel
// ══════════════════════════════════════════════════════════════════
export function PostingRulesPanel({ groupedRules, accent }: { groupedRules: Record<string, any[]>; accent: string }) {
    const [openModules, setOpenModules] = useState<Set<string>>(new Set(Object.keys(groupedRules)))

    const toggleModule = (mod: string) => {
        setOpenModules(prev => {
            const next = new Set(prev)
            next.has(mod) ? next.delete(mod) : next.add(mod)
            return next
        })
    }

    if (Object.keys(groupedRules).length === 0) {
        return <EmptyState icon={Workflow} text="No posting rules match your search" />
    }

    return (
        <div className="p-3 space-y-2">
            {Object.entries(groupedRules).sort(([a], [b]) => a.localeCompare(b)).map(([mod, rules]) => (
                <div key={mod} className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--app-border)' }}>
                    {/* Module header */}
                    <button onClick={() => toggleModule(mod)}
                        className="w-full flex items-center gap-2 px-3 py-2 transition-all"
                        style={{ background: `color-mix(in srgb, ${accent} 4%, var(--app-surface))` }}>
                        <div className="w-5 text-app-muted-foreground">
                            {openModules.has(mod) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </div>
                        <BookMarked size={13} style={{ color: accent }} />
                        <span className="text-tp-md font-bold text-app-foreground uppercase">{mod}</span>
                        <span className="text-tp-xs font-bold text-app-muted-foreground ml-auto">{rules.length} rules</span>
                    </button>
                    {/* Rules list */}
                    {openModules.has(mod) && (
                        <div className="animate-in fade-in duration-150">
                            {/* Column header */}
                            <div className="flex items-center gap-2 px-3 py-1.5 text-tp-xxs font-bold text-app-muted-foreground uppercase tracking-wider"
                                style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
                                <div className="flex-1 min-w-0">Event Code</div>
                                <div className="w-16 flex-shrink-0 text-center">Account</div>
                                <div className="flex-1 min-w-0 hidden md:block">Description</div>
                            </div>
                            {rules.map((r: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 transition-all hover:bg-app-surface/40"
                                    style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-tp-sm font-mono font-bold text-app-foreground">{r.event_code}</span>
                                    </div>
                                    <div className="w-16 flex-shrink-0 text-center">
                                        <span className="text-tp-sm font-mono font-bold px-1.5 py-0.5 rounded tabular-nums"
                                            style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)`, color: accent }}>
                                            {r.account_code}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0 hidden md:block">
                                        <span className="text-tp-sm font-medium text-app-muted-foreground truncate block">
                                            {r.description || '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
