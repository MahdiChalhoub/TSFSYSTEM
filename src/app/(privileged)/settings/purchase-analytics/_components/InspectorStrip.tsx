'use client'

import { useState } from 'react'
import { Activity, Heart, ChevronDown, ChevronUp } from 'lucide-react'
import { card } from '../_lib/constants'
import { usePASettings } from '../_hooks/PASettingsContext'

type ScoreCheck = { label: string; pass: boolean; impact: string }

type Props = {
    configScore: number
    scoreBreakdown: ScoreCheck[]
    isProfileMode: boolean
}

export function InspectorStrip({ configScore, scoreBreakdown, isProfileMode }: Props) {
    const [open, setOpen] = useState(true)
    const s = usePASettings()

    if (!isProfileMode) return null

    const previewData = [
        { product: 'Widget A', sold: 450, stock: 30 },
        { product: 'Gadget B', sold: 120, stock: 80 },
        { product: 'Part C', sold: 900, stock: 5 },
    ]

    const days = s.val('sales_avg_period_days') || 180
    const lead = s.val('proposed_qty_lead_days') || 30
    const safety = s.val('proposed_qty_safety_multiplier') || 1.0
    const preview = previewData.map(r => {
        const avgDaily = r.sold / days
        const proposed = Math.max(0, Math.round(avgDaily * lead * safety - r.stock))
        return { ...r, avgDaily: avgDaily.toFixed(1), proposed }
    })

    return (
        <div className="mt-4 mb-2">
            <button type="button" onClick={() => setOpen(!open)}
                className="flex items-center gap-2 mb-1.5 text-app-muted-foreground hover:text-app-foreground transition-colors w-full">
                <Activity size={12} className="text-app-primary" />
                <h3 className="text-[12px] font-bold text-app-foreground">Live Preview & Health</h3>
                <span className="text-[9px] text-app-muted-foreground">Simulated grid output with current settings</span>
                <span className="ml-auto">{open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
            </button>
            {open && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className={`${card} lg:col-span-2`}>
                        <div className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-3 py-1.5 border-b border-app-border/40 bg-app-background/30">
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Product</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Sold</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Stock</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Avg/Day</div>
                            <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Proposed</div>
                        </div>
                        {preview.map((r, i) => (
                            <div key={i} className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-3 py-1.5 border-b border-app-border/10 last:border-0">
                                <span className="text-[11px] text-app-foreground font-medium">{r.product}</span>
                                <span className="text-[11px] text-app-muted-foreground">{r.sold}</span>
                                <span className="text-[11px] text-app-muted-foreground">{r.stock}</span>
                                <span className="text-[11px] text-blue-500 font-bold">{r.avgDaily}</span>
                                <span className={`text-[11px] font-bold ${r.proposed > 0 ? 'text-emerald-500' : 'text-app-muted-foreground'}`}>{r.proposed > 0 ? `+${r.proposed}` : '—'}</span>
                            </div>
                        ))}
                    </div>
                    <div className={`${card}`}>
                        <div className="px-3 py-1.5 border-b border-app-border/40 bg-app-background/30 flex items-center gap-2">
                            <Heart size={11} className={configScore >= 80 ? 'text-emerald-500' : configScore >= 50 ? 'text-amber-500' : 'text-red-500'} />
                            <span className="text-[10px] font-black text-app-foreground">Health {configScore}%</span>
                        </div>
                        <div className="px-3 py-2 space-y-1">
                            {scoreBreakdown.map((c, ci) => (
                                <div key={ci} className="flex items-center justify-between text-[9px]">
                                    <div className="flex items-center gap-1">
                                        <span className={c.pass ? 'text-emerald-500' : 'text-red-500'}>{c.pass ? '✓' : '✗'}</span>
                                        <span className={c.pass ? 'text-app-muted-foreground' : 'text-app-foreground font-bold'}>{c.label}</span>
                                    </div>
                                    {!c.pass && <span className="text-red-500 font-bold">{c.impact}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
