'use client'

import { useMemo } from 'react'
import {
    Globe, ExternalLink, Eye, EyeOff,
    Building2, MapPin, Lock, Settings2, Pencil, Trash2, Power,
} from 'lucide-react'
import type { RefGateway, RefCountryLite } from './shared'
import { getFlagEmoji } from './shared'

type Props = {
    gateways: RefGateway[]
    orgGateways: Array<Record<string, unknown>>
    countriesByIso2: Record<string, RefCountryLite>
    expanded: number | null
    setExpanded: (id: number | null) => void
    focusGatewayId: number | null
    onGotoCountry: (iso2: string) => void
    onToggle: (gw: RefGateway) => void
    onEdit: (gw: RefGateway) => void
    onAskDelete: (gw: RefGateway) => void
}

export default function ViewByGateway({
    gateways, orgGateways, countriesByIso2, expanded, setExpanded,
    focusGatewayId, onGotoCountry, onToggle, onEdit, onAskDelete,
}: Props) {
    const familyGroups = useMemo(() => {
        const groups: Record<string, RefGateway[]> = {}
        gateways.forEach(gw => {
            const fam = gw.provider_family || 'Other'
            if (!groups[fam]) groups[fam] = []
            groups[fam].push(gw)
        })
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    }, [gateways])

    if (gateways.length === 0) return null

    return (
        <>
            {familyGroups.map(([family, list]) => (
                <div key={family} className="space-y-3">
                    <div className="flex items-center gap-2 pt-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{family}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                            {list.length}
                        </span>
                        <div className="flex-1 border-t border-app-border/30" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {list.map(gw => {
                            const color = gw.color || '#6366f1'
                            const fieldCount = gw.config_schema?.length || 0
                            const countryList: string[] = gw.country_codes || []
                            const isExpanded = expanded === gw.id
                            const isFocused = focusGatewayId === gw.id
                            const activations = orgGateways.filter(og => og.gateway === gw.id)

                            return (
                                <div
                                    key={gw.id}
                                    id={`gw-card-${gw.id}`}
                                    className="rounded-2xl p-4 flex flex-col gap-2.5 transition-all group hover:shadow-lg relative overflow-hidden cursor-pointer"
                                    onClick={() => setExpanded(isExpanded ? null : gw.id)}
                                    style={{
                                        background: isFocused
                                            ? `color-mix(in srgb, ${color} 10%, var(--app-surface))`
                                            : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                        border: `1.5px solid ${isFocused
                                            ? `color-mix(in srgb, ${color} 60%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                        opacity: gw.is_active ? 1 : 0.6,
                                        boxShadow: isFocused ? `0 4px 20px color-mix(in srgb, ${color} 25%, transparent)` : undefined,
                                    }}>
                                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                                        {gw.is_active ? (
                                            <span className="inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                                <Eye size={7} /> LIVE
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                <EyeOff size={7} /> DRAFT
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                                            {gw.logo_emoji || '💳'}
                                        </div>
                                        <div className="min-w-0 flex-1 pr-12">
                                            <h3 className="text-[13px] font-black text-app-foreground truncate">{gw.name}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-mono font-bold text-app-muted-foreground">{gw.code}</span>
                                                {gw.is_global && (
                                                    <span className="inline-flex items-center gap-0.5 text-[7px] font-bold px-1 py-px rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                        <Globe size={7} /> GLOBAL
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[10px] font-bold text-app-muted-foreground leading-relaxed line-clamp-2 min-h-[28px]">
                                        {gw.description || 'No description available'}
                                    </p>

                                    {/* Country flag strip — clickable to pivot */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-wrap gap-1 min-w-0">
                                            {gw.is_global ? (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                    <Globe size={9} /> Worldwide
                                                </span>
                                            ) : countryList.length === 0 ? (
                                                <span className="text-[9px] font-bold text-app-muted-foreground italic">No countries set</span>
                                            ) : (
                                                <>
                                                    {countryList.slice(0, 6).map((code) => {
                                                        const c = countriesByIso2[code.toUpperCase()]
                                                        return (
                                                            <button
                                                                key={code}
                                                                title={c?.name || code}
                                                                onClick={(e) => { e.stopPropagation(); onGotoCountry(code) }}
                                                                className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded hover:scale-110 hover:bg-app-surface transition-all"
                                                            >
                                                                <span className="text-[13px] leading-none">{getFlagEmoji(code)}</span>
                                                            </button>
                                                        )
                                                    })}
                                                    {countryList.length > 6 && (
                                                        <span className="text-[8px] font-bold text-app-muted-foreground self-center">
                                                            +{countryList.length - 6}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {fieldCount > 0 && (
                                                <span className="text-[8px] font-bold text-app-muted-foreground flex items-center gap-0.5">
                                                    <Lock size={7} /> {fieldCount}
                                                </span>
                                            )}
                                            {gw.website_url && (
                                                <a href={gw.website_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-app-muted-foreground hover:text-app-foreground transition-colors"
                                                    onClick={e => e.stopPropagation()}>
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="space-y-2.5 pt-2 border-t animate-in fade-in slide-in-from-top-2 duration-200"
                                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                            {fieldCount > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1">
                                                        <Settings2 size={9} /> Config Schema ({fieldCount})
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {(gw.config_schema || []).map((f) => (
                                                            <div key={f.key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px]"
                                                                style={{ background: `color-mix(in srgb, ${color} 5%, transparent)` }}>
                                                                <span className="font-mono font-bold" style={{ color }}>{f.key}</span>
                                                                <span className="text-app-muted-foreground">{f.type}</span>
                                                                {f.required && <span className="text-[7px] font-black" style={{ color: 'var(--app-error, #ef4444)' }}>REQ</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {countryList.length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1">
                                                        <MapPin size={9} /> Available Countries ({countryList.length})
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {countryList.map((code) => {
                                                            const c = countriesByIso2[code.toUpperCase()]
                                                            return (
                                                                <button
                                                                    key={code}
                                                                    onClick={(e) => { e.stopPropagation(); onGotoCountry(code) }}
                                                                    className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-app-surface transition-all"
                                                                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', color: 'var(--app-info, #3b82f6)' }}
                                                                >
                                                                    <span className="text-[11px] leading-none">{getFlagEmoji(code)}</span>
                                                                    <span>{code.toUpperCase()}</span>
                                                                    {c?.name && <span className="text-app-muted-foreground font-normal">· {c.name}</span>}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {activations.length > 0 ? (
                                                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                                                    <Building2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} />
                                                    <span className="text-[10px] font-bold text-app-foreground">
                                                        Used by <span className="font-black">{activations.length}</span> org(s)
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-app-muted-foreground text-center py-1">
                                                    Not yet activated by any organization
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end gap-1 pt-2"
                                                 style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                <button onClick={(e) => { e.stopPropagation(); onToggle(gw) }}
                                                    title={gw.is_active ? 'Deactivate' : 'Activate'}
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-surface-hover transition-all"
                                                    style={{ color: gw.is_active ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}>
                                                    <Power size={10} /> {gw.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onEdit(gw) }}
                                                    title="Edit"
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-surface-hover transition-all text-app-muted-foreground hover:text-app-foreground">
                                                    <Pencil size={10} /> Edit
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onAskDelete(gw) }}
                                                    title="Delete"
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-error/10 transition-all"
                                                    style={{ color: 'var(--app-error, #ef4444)' }}>
                                                    <Trash2 size={10} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </>
    )
}
