// @ts-nocheck
'use client'

/**
 * SupplierScorecard — Inline tooltip showing supplier reliability metrics
 * =======================================================================
 * Fetches scorecard data for the selected supplier and displays it
 * as a compact badge with hover tooltip showing detailed KPIs.
 */

import { useState, useEffect, useRef } from 'react'
import { Star, TrendingUp, Clock, Loader2, Award, AlertTriangle } from 'lucide-react'
import { getSupplierScorecard } from '@/app/actions/crm/contacts'

interface SupplierScorecardProps {
    supplierId: number
}

export function SupplierScorecard({ supplierId }: SupplierScorecardProps) {
    const [scorecard, setScorecard] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!supplierId || supplierId <= 0) { setScorecard(null); return }
        let cancelled = false
        setLoading(true)
        getSupplierScorecard(supplierId).then(data => {
            if (cancelled) return
            setScorecard(data)
            setLoading(false)
        }).catch(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [supplierId])

    if (!supplierId || loading) {
        return loading ? (
            <span className="inline-flex items-center gap-1 text-[9px] text-app-muted-foreground px-1.5 py-0.5 rounded">
                <Loader2 size={9} className="animate-spin" /> Loading...
            </span>
        ) : null
    }

    if (!scorecard) return null

    const composite = scorecard.composite_score
    const obj = scorecard.objective
    const subj = scorecard.subjective

    // No data at all
    if (composite === null && !obj?.score && !subj?.score) {
        return (
            <span className="inline-flex items-center gap-1 text-[9px] text-app-muted-foreground/50 px-1.5 py-0.5">
                <Star size={9} /> No rating
            </span>
        )
    }

    const score = composite ?? obj?.score ?? subj?.score ?? 0
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
    const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'

    const RatingBar = ({ label, value, max = 5 }: { label: string; value: number; max?: number }) => {
        const pct = (value / max) * 100
        return (
            <div className="flex items-center gap-2">
                <span className="text-[9px] text-app-muted-foreground w-16 text-right">{label}</span>
                <div className="flex-1 h-1.5 bg-app-background/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-[9px] font-bold text-app-foreground w-6">{value.toFixed(1)}</span>
            </div>
        )
    }

    return (
        <div className="relative inline-flex"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {/* Badge */}
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full cursor-help transition-all"
                style={{
                    background: `color-mix(in srgb, ${scoreColor} 10%, transparent)`,
                    color: scoreColor,
                    border: `1px solid color-mix(in srgb, ${scoreColor} 20%, transparent)`,
                }}>
                <Award size={9} />
                {Math.round(score)}/100
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div ref={tooltipRef}
                    className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-app-surface border border-app-border rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
                    style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))' }}
                >
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-app-border" />

                    {/* Score Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-app-border/30">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${scoreColor} 12%, transparent)` }}>
                                <Award size={13} style={{ color: scoreColor }} />
                            </div>
                            <div>
                                <div className="text-[11px] font-black text-app-foreground">Supplier Score</div>
                                <div className="text-[8px] text-app-muted-foreground">{scoreLabel}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>{Math.round(score)}</div>
                            <div className="text-[7px] text-app-muted-foreground uppercase tracking-wider">/ 100</div>
                        </div>
                    </div>

                    {/* Objective KPIs */}
                    {obj && obj.total_orders > 0 && (
                        <div className="mb-3">
                            <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">Performance (Auto)</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                <div>
                                    <div className={`text-xs font-black ${(obj.on_time_rate ?? 0) >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {obj.on_time_rate != null ? `${obj.on_time_rate}%` : '—'}
                                    </div>
                                    <div className="text-[7px] text-app-muted-foreground">On-Time Rate</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-app-foreground">{obj.avg_lead_time_days?.toFixed(1) ?? '—'}d</div>
                                    <div className="text-[7px] text-app-muted-foreground">Avg Lead Time</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-app-foreground">{obj.total_orders}</div>
                                    <div className="text-[7px] text-app-muted-foreground">Total Orders</div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-app-foreground">
                                        {obj.total_purchase_amount ? `${(obj.total_purchase_amount / 1000).toFixed(0)}K` : '—'}
                                    </div>
                                    <div className="text-[7px] text-app-muted-foreground">Total Spend</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Subjective Ratings */}
                    {subj && subj.total_ratings > 0 && (
                        <div>
                            <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider mb-1.5">
                                Ratings ({subj.total_ratings} reviews)
                            </div>
                            <div className="space-y-1">
                                <RatingBar label="Quality" value={subj.quality_rating} />
                                <RatingBar label="Delivery" value={subj.delivery_rating} />
                                <RatingBar label="Pricing" value={subj.pricing_rating} />
                                <RatingBar label="Service" value={subj.service_rating} />
                            </div>
                        </div>
                    )}

                    {/* No data fallback */}
                    {(!obj || obj.total_orders === 0) && (!subj || subj.total_ratings === 0) && (
                        <div className="text-center py-2">
                            <AlertTriangle size={14} className="text-app-muted-foreground/40 mx-auto mb-1" />
                            <p className="text-[9px] text-app-muted-foreground">Insufficient data for detailed breakdown</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
