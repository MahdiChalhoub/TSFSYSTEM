'use client'

/**
 * TaxLinePreviewTable
 * ====================
 * Reusable component that displays the detailed breakdown of tax lines
 * from a TaxCalculator result. Shows each tax type, base, rate, amount,
 * and behavior in a compact, visually rich table.
 *
 * Usage:
 *   <TaxLinePreviewTable taxLines={result.tax_lines} baseHT={1000} />
 */

import { Eye, Info } from 'lucide-react'

interface TaxLine {
    type: string
    rate: number | string
    amount: number | string
    base_amount?: number | string
    behavior?: string
    treatment?: string
    name?: string
}

interface TaxLinePreviewTableProps {
    taxLines: TaxLine[]
    baseHT?: number
    totalTTC?: number
    apAmount?: number
    costOfficial?: number
    compact?: boolean
    className?: string
}

const TYPE_COLORS: Record<string, string> = {
    VAT: 'text-indigo-400',
    CUSTOM: 'text-violet-400',
    AIRSI: 'text-amber-400',
    WITHHOLDING: 'text-amber-400',
    PURCHASE_TAX: 'text-teal-400',
    EXCISE: 'text-orange-400',
}

const BEHAVIOR_BADGES: Record<string, { label: string; cls: string }> = {
    ADDED_TO_TTC: { label: '+ TTC', cls: 'bg-app-info/15 text-blue-400' },
    WITHHELD_FROM_AP: { label: '− AP', cls: 'bg-app-warning/15 text-amber-400' },
    EMBEDDED_IN_PRICE: { label: '∈ Price', cls: 'bg-purple-500/15 text-purple-400' },
    RECOVERED: { label: 'Recovered', cls: 'bg-app-success/15 text-emerald-400' },
    NON_RECOVERABLE: { label: 'Non-rec', cls: 'bg-app-error/15 text-rose-400' },
}

function formatN(v: number | string | undefined, fallback = '—') {
    if (v === undefined || v === null) return fallback
    const n = typeof v === 'string' ? parseFloat(v) : v
    return isNaN(n) ? fallback : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPct(v: number | string | undefined) {
    if (v === undefined || v === null) return '—'
    const n = typeof v === 'string' ? parseFloat(v) : v
    return isNaN(n) ? '—' : `${(n * 100).toFixed(2)}%`
}

export function TaxLinePreviewTable({
    taxLines, baseHT, totalTTC, apAmount, costOfficial, compact, className
}: TaxLinePreviewTableProps) {
    if (!taxLines || taxLines.length === 0) {
        return (
            <div className={`rounded-xl border border-white/5 bg-app-surface/30 p-4 text-center text-[11px] ${className || ''}`}
                style={{ color: 'var(--app-muted)' }}>
                <Info size={14} className="inline mr-1" /> No tax lines to display.
            </div>
        )
    }

    return (
        <div className={`rounded-xl border border-white/5 bg-app-surface/30 overflow-hidden ${className || ''}`}>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                <Eye size={14} style={{ color: 'var(--app-accent)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-accent)' }}>
                    Tax Line Breakdown
                </span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--app-muted)' }}>
                    {taxLines.length} line{taxLines.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Type</th>
                            {!compact && <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Base</th>}
                            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Rate</th>
                            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Amount</th>
                            <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>Behavior</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taxLines.map((line, idx) => {
                            const behavior = BEHAVIOR_BADGES[line.behavior || ''] || null
                            return (
                                <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`font-semibold ${TYPE_COLORS[line.type] || 'text-app-muted-foreground'}`}>{line.type}</span>
                                            {line.name && <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>({line.name})</span>}
                                        </div>
                                    </td>
                                    {!compact && (
                                        <td className="text-right px-3 py-2 font-mono" style={{ color: 'var(--app-foreground)' }}>
                                            {formatN(line.base_amount)}
                                        </td>
                                    )}
                                    <td className="text-right px-3 py-2 font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>
                                        {formatPct(line.rate)}
                                    </td>
                                    <td className="text-right px-3 py-2 font-mono font-bold" style={{ color: 'var(--app-accent)' }}>
                                        {formatN(line.amount)}
                                    </td>
                                    <td className="text-center px-3 py-2">
                                        {behavior ? (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${behavior.cls}`}>
                                                {behavior.label}
                                            </span>
                                        ) : (
                                            <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            {(baseHT !== undefined || totalTTC !== undefined || apAmount !== undefined || costOfficial !== undefined) && (
                <div className="px-4 py-3 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
                    {baseHT !== undefined && (
                        <div><span style={{ color: 'var(--app-muted)' }}>Base HT:&nbsp;</span><span className="font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>{formatN(baseHT)}</span></div>
                    )}
                    {totalTTC !== undefined && (
                        <div><span style={{ color: 'var(--app-muted)' }}>Total TTC:&nbsp;</span><span className="font-mono font-bold" style={{ color: 'var(--app-accent)' }}>{formatN(totalTTC)}</span></div>
                    )}
                    {apAmount !== undefined && (
                        <div><span style={{ color: 'var(--app-muted)' }}>AP Amount:&nbsp;</span><span className="font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>{formatN(apAmount)}</span></div>
                    )}
                    {costOfficial !== undefined && (
                        <div><span style={{ color: 'var(--app-muted)' }}>Cost (Official):&nbsp;</span><span className="font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>{formatN(costOfficial)}</span></div>
                    )}
                </div>
            )}
        </div>
    )
}
