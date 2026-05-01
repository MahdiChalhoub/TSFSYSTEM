'use client'

import { useMemo } from 'react'
import { Globe, MapPin, Building2 } from 'lucide-react'
import type { RefGateway, RefCountryLite } from './shared'
import { getFlagEmoji, REGION_COLORS } from './shared'

type Props = {
    gateways: RefGateway[]
    countries: RefCountryLite[]
    orgGateways: Array<Record<string, unknown>>
    regionFilter: string
    onGotoGateway: (gatewayId: number) => void
    focusCountryIso2: string | null
}

export default function ViewByCountry({
    gateways, countries, orgGateways, regionFilter, onGotoGateway, focusCountryIso2,
}: Props) {
    const globalGateways = useMemo(
        () => gateways.filter(g => g.is_global),
        [gateways],
    )

    // Build map: ISO2 -> regional gateways available there
    const gatewaysByIso2 = useMemo(() => {
        const map: Record<string, RefGateway[]> = {}
        gateways.forEach(gw => {
            if (gw.is_global) return
            ;(gw.country_codes || []).forEach(code => {
                const k = code.toUpperCase()
                if (!map[k]) map[k] = []
                map[k].push(gw)
            })
        })
        return map
    }, [gateways])

    // Group countries by region; only countries that have at least one gateway
    // (regional or global; if any gateway exists with non-empty country_codes hitting it,
    // OR if there are global gateways, every country gets that global row)
    const regionGroups = useMemo(() => {
        const eligible = countries.filter(c => {
            const has = (gatewaysByIso2[c.iso2.toUpperCase()] || []).length > 0
            return has || globalGateways.length > 0
        })
        const groups: Record<string, RefCountryLite[]> = {}
        eligible.forEach(c => {
            const region = c.region || 'Other'
            if (regionFilter && region !== regionFilter) return
            if (!groups[region]) groups[region] = []
            groups[region].push(c)
        })
        Object.values(groups).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)))
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    }, [countries, gatewaysByIso2, globalGateways, regionFilter])

    if (regionGroups.length === 0) {
        return (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-app-border">
                <MapPin size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-bold text-app-muted-foreground">No countries match</p>
                <p className="text-[11px] text-app-muted-foreground mt-1">Try changing the region filter or search.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Global gateways banner */}
            {globalGateways.length > 0 && (
                <div className="rounded-2xl p-3 flex flex-col gap-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                    }}>
                    <div className="flex items-center gap-2">
                        <Globe size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info, #3b82f6)' }}>
                            Worldwide Gateways
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                            {globalGateways.length}
                        </span>
                        <span className="text-[10px] text-app-muted-foreground">— available in every country below</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {globalGateways.map(gw => (
                            <GatewayChip key={gw.id} gw={gw} onClick={() => onGotoGateway(gw.id)} />
                        ))}
                    </div>
                </div>
            )}

            {regionGroups.map(([region, list]) => {
                const regionColor = REGION_COLORS[region] || 'var(--app-muted-foreground)'
                return (
                    <div key={region} className="space-y-3">
                        <div className="flex items-center gap-2 pt-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: regionColor }} />
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: regionColor }}>
                                {region}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: `color-mix(in srgb, ${regionColor} 10%, transparent)`, color: regionColor }}>
                                {list.length}
                            </span>
                            <div className="flex-1 border-t border-app-border/30" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {list.map(c => {
                                const regional = gatewaysByIso2[c.iso2.toUpperCase()] || []
                                const totalCount = regional.length + globalGateways.length
                                const orgsHere = orgGateways.filter(og => {
                                    const matchedGw = gateways.find(g => g.id === og.gateway)
                                    if (!matchedGw) return false
                                    if (matchedGw.is_global) return true
                                    return (matchedGw.country_codes || []).map(s => s.toUpperCase()).includes(c.iso2.toUpperCase())
                                }).length
                                const isFocused = focusCountryIso2?.toUpperCase() === c.iso2.toUpperCase()

                                return (
                                    <div
                                        key={c.id}
                                        id={`country-card-${c.iso2.toUpperCase()}`}
                                        className="rounded-2xl p-3.5 flex flex-col gap-2.5 transition-all"
                                        style={{
                                            background: isFocused
                                                ? `color-mix(in srgb, ${regionColor} 8%, var(--app-surface))`
                                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                            border: `1.5px solid ${isFocused
                                                ? `color-mix(in srgb, ${regionColor} 60%, transparent)`
                                                : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                            boxShadow: isFocused ? `0 4px 20px color-mix(in srgb, ${regionColor} 22%, transparent)` : undefined,
                                        }}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)' }}>
                                                {getFlagEmoji(c.iso2)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-[13px] font-black text-app-foreground truncate">{c.name}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[9px] font-mono font-bold text-app-muted-foreground">
                                                        {c.iso2.toUpperCase()}{c.iso3 ? ` · ${c.iso3.toUpperCase()}` : ''}
                                                    </span>
                                                    {c.subregion && (
                                                        <span className="text-[9px] font-bold text-app-muted-foreground">· {c.subregion}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Gateways</div>
                                                <div className="text-base font-black text-app-foreground tabular-nums leading-none">{totalCount}</div>
                                            </div>
                                        </div>

                                        {regional.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {regional.map(gw => (
                                                    <GatewayChip key={gw.id} gw={gw} onClick={() => onGotoGateway(gw.id)} />
                                                ))}
                                            </div>
                                        ) : globalGateways.length > 0 ? (
                                            <div className="text-[10px] font-bold text-app-muted-foreground italic flex items-center gap-1">
                                                <Globe size={10} /> Only worldwide gateways available here
                                            </div>
                                        ) : (
                                            <div className="text-[10px] font-bold text-app-muted-foreground italic">
                                                No gateways configured for this country
                                            </div>
                                        )}

                                        {orgsHere > 0 && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold pt-1.5 mt-0.5"
                                                style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                                <Building2 size={10} />
                                                {orgsHere} org-activation{orgsHere > 1 ? 's' : ''} here
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function GatewayChip({ gw, onClick }: { gw: RefGateway; onClick: () => void }) {
    const color = gw.color || '#6366f1'
    return (
        <button
            onClick={onClick}
            title={`${gw.name}${gw.description ? ' — ' + gw.description : ''}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.03]"
            style={{
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                color: gw.is_active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                opacity: gw.is_active ? 1 : 0.55,
            }}
        >
            <span className="text-[14px] leading-none">{gw.logo_emoji || '💳'}</span>
            <span className="truncate max-w-[120px]">{gw.name}</span>
            {!gw.is_active && (
                <span className="text-[7px] font-black px-1 rounded"
                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 15%, transparent)' }}>
                    DRAFT
                </span>
            )}
        </button>
    )
}
