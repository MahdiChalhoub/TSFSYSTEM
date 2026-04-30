'use client'

import { useState } from 'react'
import { Activity, Heart, ChevronDown, ChevronUp } from 'lucide-react'
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

    const scoreColor = configScore >= 80 ? 'var(--app-success, #22c55e)' : configScore >= 50 ? '#f59e0b' : 'var(--app-error, #ef4444)'

    return (
        <div className="mt-5 mb-2">
            <button type="button" onClick={() => setOpen(!open)}
                className="flex items-center gap-2.5 mb-2 w-full group">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                    <Activity size={12} style={{ color: 'var(--app-primary)' }} />
                </div>
                <h3 className="text-[12px] font-black text-app-foreground">Live Preview & Health</h3>
                <span className="text-[9px] font-bold text-app-muted-foreground">Simulated grid output</span>
                <span className="ml-auto text-app-muted-foreground group-hover:text-app-foreground transition-colors">
                    {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
            </button>
            {open && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Preview Table */}
                    <div className="lg:col-span-2 rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-4 py-2 border-b"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)', background: 'color-mix(in srgb, var(--app-bg) 40%, transparent)' }}>
                            {['Product', 'Sold', 'Stock', 'Avg/Day', 'Proposed'].map(h => (
                                <div key={h} className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">{h}</div>
                            ))}
                        </div>
                        {preview.map((r, i) => (
                            <div key={i} className="grid grid-cols-[120px_60px_60px_70px_70px] gap-2 px-4 py-2 border-b last:border-0"
                                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                                <span className="text-[11px] text-app-foreground font-bold">{r.product}</span>
                                <span className="text-[11px] text-app-muted-foreground tabular-nums">{r.sold}</span>
                                <span className="text-[11px] text-app-muted-foreground tabular-nums">{r.stock}</span>
                                <span className="text-[11px] font-black tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{r.avgDaily}</span>
                                <span className={`text-[11px] font-black tabular-nums`}
                                    style={{ color: r.proposed > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)' }}>
                                    {r.proposed > 0 ? `+${r.proposed}` : '—'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Health panel */}
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="px-4 py-2.5 border-b flex items-center gap-2"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)', background: 'color-mix(in srgb, var(--app-bg) 40%, transparent)' }}>
                            <Heart size={12} style={{ color: scoreColor }} />
                            <span className="text-[10px] font-black text-app-foreground">Health</span>
                            <span className="text-[12px] font-black tabular-nums ml-auto" style={{ color: scoreColor }}>{configScore}%</span>
                        </div>
                        <div className="px-4 py-3 space-y-1.5">
                            {scoreBreakdown.map((c, ci) => (
                                <div key={ci} className="flex items-center justify-between text-[9px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-black text-white"
                                            style={{ background: c.pass ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                            {c.pass ? '✓' : '✗'}
                                        </span>
                                        <span className={`font-bold ${c.pass ? 'text-app-muted-foreground' : 'text-app-foreground'}`}>{c.label}</span>
                                    </div>
                                    {!c.pass && <span className="font-black" style={{ color: 'var(--app-error, #ef4444)' }}>{c.impact}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
