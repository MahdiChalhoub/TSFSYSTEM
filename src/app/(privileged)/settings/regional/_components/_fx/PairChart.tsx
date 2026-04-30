'use client'
/**
 * FX Management — pair history chart + small sparkline.
 * Extracted verbatim from FxRedesigned.tsx.
 */
import { type ExchangeRate } from '@/app/actions/finance/currency'
import type { HealthKey } from './constants'

/** Larger pair-history chart for Rate History "Chart" view. Same SVG style
 *  as Sparkline but with min/max/latest dot labels and a 3-tick date axis.
 *  Sorts ascending so x-axis is left-to-right time. */
export function PairChart({ list }: { list: ExchangeRate[] }) {
    if (list.length < 2) {
        return (
            <div className="px-4 py-8 text-center italic" style={{ fontSize: 11, color: 'var(--app-muted-foreground)' }}>
                Need ≥2 snapshots to draw a chart. {list.length === 1 && 'Run another sync.'}
            </div>
        )
    }
    // list is newest-first; reverse for chronological plotting.
    const sorted = [...list].sort((a, b) => a.effective_date.localeCompare(b.effective_date))
    const values = sorted.map(r => Number(r.rate))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || max * 0.001 || 1
    const W = 800, H = 180, ML = 50, MR = 20, MT = 16, MB = 32
    const xOf = (i: number) => ML + (i / (sorted.length - 1)) * (W - ML - MR)
    const yOf = (v: number) => MT + (1 - (v - min) / span) * (H - MT - MB)
    const pts = sorted.map((r, i) => [xOf(i), yOf(values[i])] as const)
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(2)},${H - MB} L${pts[0][0].toFixed(2)},${H - MB} Z`
    const trend = values[values.length - 1] - values[0]
    const tone = trend > 0 ? '--app-success' : trend < 0 ? '--app-error' : '--app-muted-foreground'
    const minIdx = values.indexOf(min)
    const maxIdx = values.indexOf(max)
    const xTicks = sorted.length <= 4 ? sorted.map((_, i) => i)
        : [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
    return (
        <div className="px-4 py-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
                {/* Min / mid / max horizontal grid lines */}
                {[0, 0.5, 1].map((p, i) => {
                    const v = min + span * (1 - p)
                    return (
                        <g key={i}>
                            <line x1={ML} x2={W - MR} y1={MT + p * (H - MT - MB)} y2={MT + p * (H - MT - MB)}
                                stroke="color-mix(in srgb, var(--app-border) 80%, transparent)" strokeWidth="1" strokeDasharray={i === 1 ? '0' : '3,3'} />
                            <text x={ML - 6} y={MT + p * (H - MT - MB) + 3} textAnchor="end"
                                fontSize="9" fill="var(--app-muted-foreground)" fontFamily="ui-monospace, SFMono-Regular, monospace">
                                {v.toFixed(4)}
                            </text>
                        </g>
                    )
                })}
                {/* Area + line */}
                <path d={areaPath} fill={`color-mix(in srgb, var(${tone}) 14%, transparent)`} />
                <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                {/* Min / max / latest markers */}
                <circle cx={pts[minIdx][0]} cy={pts[minIdx][1]} r="3" fill="var(--app-error)" />
                <circle cx={pts[maxIdx][0]} cy={pts[maxIdx][1]} r="3" fill="var(--app-success)" />
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={`var(${tone})`}
                    stroke="var(--app-surface)" strokeWidth="2" />
                {/* Date axis */}
                {xTicks.map(i => (
                    <text key={i} x={xOf(i)} y={H - MB + 14} textAnchor={i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'middle'}
                        fontSize="9" fill="var(--app-muted-foreground)" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {sorted[i].effective_date}
                    </text>
                ))}
            </svg>
            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-success)' }} />
                    <span className="text-app-muted-foreground">Max</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{max.toFixed(6)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--app-error)' }} />
                    <span className="text-app-muted-foreground">Min</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{min.toFixed(6)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: `var(${tone})` }} />
                    <span className="text-app-muted-foreground">Latest</span>
                    <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>{values[values.length - 1].toFixed(6)}</span>
                </span>
            </div>
        </div>
    )
}

/** Generic numeric-array sparkline. Used by Revaluations to plot net-impact
 *  over time. Tone is directional: green if rising, red if falling. */
/** Mini SVG sparkline — uses theme tokens, no external dependency. Draws a
 *  filled area below the line for visual weight, with the latest dot
 *  highlighted. Tone derives from health: stale → warning, fail → error,
 *  healthy → directional (green if rising, red if falling, muted if flat). */
export function Sparkline({ rates, health }: { rates: ExchangeRate[]; health: HealthKey }) {
    if (rates.length < 2) return null
    const values = rates.map(r => Number(r.rate))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || max * 0.001 || 1   // avoid divide-by-zero on flat series
    const W = 100, H = 28, P = 2                  // viewBox + padding
    const pts = values.map((v, i) => {
        const x = P + (i / (values.length - 1)) * (W - P * 2)
        const y = P + (1 - (v - min) / span) * (H - P * 2)
        return [x, y] as const
    })
    const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(2)},${H - P} L${pts[0][0].toFixed(2)},${H - P} Z`
    const lastY = pts[pts.length - 1][1]
    const lastX = pts[pts.length - 1][0]
    const trend = values[values.length - 1] - values[0]
    const tone = health === 'fail'  ? '--app-error'
              : health === 'stale' ? '--app-warning'
              : trend > 0          ? '--app-success'
              : trend < 0          ? '--app-error'
              : '--app-muted-foreground'
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
            className="w-full h-7 mt-1.5"
            aria-label={`${rates.length}-snapshot rate trend`}>
            <path d={areaPath} fill={`color-mix(in srgb, var(${tone}) 14%, transparent)`} />
            <path d={linePath} fill="none" stroke={`var(${tone})`} strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r="1.8" fill={`var(${tone})`} />
        </svg>
    )
}
