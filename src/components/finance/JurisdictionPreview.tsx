'use client'

/**
 * JurisdictionPreview
 * ====================
 * An inline card that shows the resolved tax jurisdiction for a destination.
 * Meant to be embedded in order/checkout forms to give real-time feedback
 * about which tax rules apply based on the selected destination.
 *
 * Usage:
 *   <JurisdictionPreview
 *     originCountry="CI"
 *     destinationCountry="FR"
 *     destinationRegion=""
 *     isExport={true}
 *     isB2B={false}
 *   />
 */

import { useState, useEffect, useCallback } from 'react'
import { Globe, MapPin, ArrowRight, AlertTriangle, Check, RefreshCw } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

interface JurisdictionPreviewProps {
    originCountry: string
    destinationCountry: string
    destinationRegion?: string
    isExport?: boolean
    isB2B?: boolean
    taxType?: string
    counterpartyCountry?: string
    className?: string
}

interface ResolvedJurisdiction {
    jurisdiction_code: string
    resolved_rate: string | number
    place_of_supply: string
    is_reverse_charge: boolean
    is_zero_rated: boolean
    matched_rule_name?: string
    [key: string]: any
}

export function JurisdictionPreview({
    originCountry, destinationCountry, destinationRegion,
    isExport, isB2B, taxType = 'VAT', counterpartyCountry,
    className
}: JurisdictionPreviewProps) {
    const [result, setResult] = useState<ResolvedJurisdiction | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const resolve = useCallback(async () => {
        if (!originCountry || !destinationCountry) return
        setLoading(true)
        setError(null)
        try {
            const data = await erpFetch('finance/tax-jurisdiction-rules/resolve/', {
                method: 'POST',
                body: JSON.stringify({
                    origin_country: originCountry,
                    destination_country: destinationCountry,
                    destination_region: destinationRegion || '',
                    counterparty_country: counterpartyCountry || destinationCountry,
                    is_export: isExport ?? (originCountry !== destinationCountry),
                    is_b2b: isB2B ?? false,
                    tax_type: taxType,
                }),
            })
            setResult(data)
        } catch (err: any) {
            setError(err?.message || 'Resolution failed')
        } finally {
            setLoading(false)
        }
    }, [originCountry, destinationCountry, destinationRegion, isExport, isB2B, taxType, counterpartyCountry])

    useEffect(() => {
        resolve()
    }, [resolve])

    if (!originCountry || !destinationCountry) return null

    const isDomestic = originCountry === destinationCountry

    return (
        <div className={`rounded-xl border border-white/5 bg-app-surface/30 overflow-hidden ${className || ''}`}>
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Globe size={14} style={{ color: 'var(--app-accent)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-accent)' }}>
                        Tax Jurisdiction
                    </span>
                </div>
                <button onClick={resolve} disabled={loading}
                    className="p-1 rounded-md hover:bg-white/5 transition-colors">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--app-muted)' }} />
                </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
                {loading && (
                    <div className="text-[11px] animate-pulse" style={{ color: 'var(--app-muted)' }}>Resolving jurisdiction...</div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-[11px] text-rose-400">
                        <AlertTriangle size={12} /> {error}
                    </div>
                )}

                {result && !loading && (
                    <div className="space-y-2.5">
                        {/* Route visualization */}
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <MapPin size={12} style={{ color: 'var(--app-muted)' }} />
                                <span className="font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>{originCountry}</span>
                            </div>
                            <ArrowRight size={12} style={{ color: isDomestic ? 'var(--app-muted)' : 'var(--app-accent)' }} />
                            <div className="flex items-center gap-1">
                                <MapPin size={12} style={{ color: isDomestic ? 'var(--app-muted)' : 'var(--app-accent)' }} />
                                <span className="font-mono font-semibold" style={{ color: isDomestic ? 'var(--app-foreground)' : 'var(--app-accent)' }}>
                                    {destinationCountry}
                                    {destinationRegion && <span className="text-[10px]">-{destinationRegion}</span>}
                                </span>
                            </div>
                            {isDomestic && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold uppercase">Domestic</span>}
                            {isExport && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[9px] font-bold uppercase">Export</span>}
                        </div>

                        {/* Resolution details */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                            <span style={{ color: 'var(--app-muted)' }}>Jurisdiction:</span>
                            <span className="font-mono font-semibold" style={{ color: 'var(--app-foreground)' }}>{result.jurisdiction_code}</span>

                            <span style={{ color: 'var(--app-muted)' }}>Rate:</span>
                            <span className="font-mono font-bold" style={{ color: 'var(--app-accent)' }}>
                                {typeof result.resolved_rate === 'number'
                                    ? `${(result.resolved_rate * 100).toFixed(2)}%`
                                    : `${(parseFloat(result.resolved_rate) * 100).toFixed(2)}%`}
                            </span>

                            <span style={{ color: 'var(--app-muted)' }}>Supply Mode:</span>
                            <span className={`font-semibold ${result.place_of_supply === 'REVERSE_CHARGE' ? 'text-amber-400' :
                                    result.place_of_supply === 'DESTINATION' ? 'text-teal-400' : ''
                                }`} style={result.place_of_supply === 'ORIGIN' ? { color: 'var(--app-foreground)' } : {}}>
                                {result.place_of_supply}
                            </span>

                            {result.is_reverse_charge && (
                                <>
                                    <span style={{ color: 'var(--app-muted)' }}>Reverse Charge:</span>
                                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                        <Check size={10} /> Yes
                                    </span>
                                </>
                            )}

                            {result.is_zero_rated && (
                                <>
                                    <span style={{ color: 'var(--app-muted)' }}>Zero-Rated:</span>
                                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                        <Check size={10} /> Yes (export)
                                    </span>
                                </>
                            )}

                            {result.matched_rule_name && (
                                <>
                                    <span style={{ color: 'var(--app-muted)' }}>Matched Rule:</span>
                                    <span className="text-[10px]" style={{ color: 'var(--app-foreground)' }}>{result.matched_rule_name}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
