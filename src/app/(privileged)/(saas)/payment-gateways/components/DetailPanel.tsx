'use client'

import { X, Pencil, Pin, Power, Trash2, Globe, Lock, Settings2, MapPin, Building2, ExternalLink, Layers, CreditCard } from 'lucide-react'
import type { GatewayTreeNode, RefCountryLite } from './types'
import { getFlagEmoji } from './types'

interface Props {
    node: GatewayTreeNode
    countriesByIso2: Record<string, RefCountryLite>
    orgGateways: Array<Record<string, unknown>>
    /** Worldwide (is_global) gateways — shown in country detail since they apply everywhere. */
    globalGateways: import('./types').RefGateway[]
    onClose: () => void
    onPin?: (n: GatewayTreeNode) => void
    onEdit: (n: GatewayTreeNode) => void
    onToggle: (n: GatewayTreeNode) => void
    onAskDelete: (n: GatewayTreeNode) => void
    onGotoCountry: (iso2: string) => void
    onGotoGateway: (gatewayId: number) => void
}

export function DetailPanel({
    node, countriesByIso2, orgGateways, globalGateways,
    onClose, onPin, onEdit, onToggle, onAskDelete, onGotoCountry, onGotoGateway,
}: Props) {
    if (node._kind === 'gateway') return <GatewayDetail
        node={node}
        countriesByIso2={countriesByIso2}
        orgGateways={orgGateways}
        onClose={onClose}
        onPin={onPin}
        onEdit={onEdit}
        onToggle={onToggle}
        onAskDelete={onAskDelete}
        onGotoCountry={onGotoCountry}
    />
    if (node._kind === 'country') return <CountryDetail
        node={node}
        orgGateways={orgGateways}
        globalGateways={globalGateways}
        onClose={onClose}
        onPin={onPin}
        onGotoGateway={onGotoGateway}
    />
    return null
}

function PanelShell({ title, subtitle, kindLabel, accent, icon, onClose, onPin, node, children }: {
    title: string
    subtitle?: string
    kindLabel: string
    accent: string
    icon: React.ReactNode
    onClose: () => void
    onPin?: (n: GatewayTreeNode) => void
    node: GatewayTreeNode
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
                style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 5%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                    style={{
                        background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 75%, var(--app-accent)))`,
                        boxShadow: `0 3px 10px color-mix(in srgb, ${accent} 30%, transparent)`,
                    }}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-tp-xxs font-bold uppercase tracking-widest leading-none mb-0.5"
                        style={{ color: accent }}>{kindLabel}</p>
                    <h3 className="text-tp-lg font-bold tracking-tight truncate leading-tight"
                        style={{ color: 'var(--app-foreground)' }}>{title}</h3>
                    {subtitle && (
                        <p className="text-tp-xs font-medium truncate mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 px-1 py-1 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid var(--app-border)' }}>
                    {onPin && (
                        <button onClick={() => onPin(node)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/10"
                            title="Pin sidebar">
                            <Pin size={13} />
                        </button>
                    )}
                    <button onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-app-muted-foreground hover:text-app-error hover:bg-app-error/10"
                        title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {children}
            </div>
        </div>
    )
}

function StatTile({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                {icon}
            </div>
            <div>
                <div className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground leading-none">{label}</div>
                <div className="text-tp-md font-black text-app-foreground tabular-nums leading-tight mt-0.5">{value}</div>
            </div>
        </div>
    )
}

function GatewayDetail({ node, countriesByIso2, orgGateways, onClose, onPin, onEdit, onToggle, onAskDelete, onGotoCountry }: {
    node: GatewayTreeNode
    countriesByIso2: Record<string, RefCountryLite>
    orgGateways: Array<Record<string, unknown>>
    onClose: () => void
    onPin?: (n: GatewayTreeNode) => void
    onEdit: (n: GatewayTreeNode) => void
    onToggle: (n: GatewayTreeNode) => void
    onAskDelete: (n: GatewayTreeNode) => void
    onGotoCountry: (iso2: string) => void
}) {
    const gw = node._gw!
    const color = gw.color || '#6366f1'
    const fields = gw.config_schema || []
    const countryList = gw.country_codes || []
    const activations = orgGateways.filter(og => og.gateway === gw.id)

    return (
        <PanelShell
            title={gw.name}
            subtitle={gw.description}
            kindLabel="Payment Gateway"
            accent={color}
            icon={<span className="text-base">{gw.logo_emoji || '💳'}</span>}
            onClose={onClose}
            onPin={onPin}
            node={node}
        >
            {/* Status + actions */}
            <div className="flex items-center gap-2 flex-wrap">
                {gw.is_active ? (
                    <span className="inline-flex items-center gap-1 text-tp-xs font-black px-2 py-1 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                        ● LIVE
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-tp-xs font-black px-2 py-1 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        ○ DRAFT
                    </span>
                )}
                {gw.is_global && (
                    <span className="inline-flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                        <Globe size={10} /> Worldwide
                    </span>
                )}
                <span className="font-mono text-tp-xs font-bold px-2 py-1 rounded"
                    style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                    {gw.code}
                </span>
                {gw.provider_family && (
                    <span className="text-tp-xs font-bold text-app-muted-foreground px-2 py-1">
                        {gw.provider_family} family
                    </span>
                )}
                {gw.website_url && (
                    <a href={gw.website_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground ml-auto">
                        <ExternalLink size={11} /> Website
                    </a>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatTile label="Countries" value={gw.is_global ? '∞' : countryList.length} color="var(--app-info, #3b82f6)" icon={<MapPin size={14} />} />
                <StatTile label="Config Fields" value={fields.length} color="var(--app-accent)" icon={<Lock size={14} />} />
                <StatTile label="Org Activations" value={activations.length} color="var(--app-success, #22c55e)" icon={<Building2 size={14} />} />
            </div>

            {/* Config schema */}
            {fields.length > 0 && (
                <section>
                    <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1">
                        <Settings2 size={10} /> Config Schema
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {fields.map(f => (
                            <div key={f.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-tp-xs"
                                style={{ background: `color-mix(in srgb, ${color} 5%, transparent)` }}>
                                <span className="font-mono font-bold" style={{ color }}>{f.key}</span>
                                <span className="text-app-muted-foreground flex-1 truncate">{f.label || f.type}</span>
                                {f.required && (
                                    <span className="text-[8px] font-black px-1 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 12%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                        REQ
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Countries */}
            {!gw.is_global && (
                <section>
                    <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin size={10} /> Available Countries ({countryList.length})
                    </div>
                    {countryList.length === 0 ? (
                        <p className="text-tp-xs italic text-app-muted-foreground">
                            No countries selected — this gateway is invisible to all tenants. Edit and add countries, or mark it Global.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {countryList.map(cc => {
                                const c = countriesByIso2[cc.toUpperCase()]
                                return (
                                    <button key={cc}
                                        onClick={() => onGotoCountry(cc)}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-tp-xs font-bold transition-all hover:scale-[1.03]"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                                            color: 'var(--app-foreground)',
                                        }}>
                                        <span className="text-[14px] leading-none">{getFlagEmoji(cc)}</span>
                                        <span>{cc.toUpperCase()}</span>
                                        {c?.name && <span className="text-app-muted-foreground font-normal">· {c.name}</span>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* Activations */}
            <section>
                <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1">
                    <Building2 size={10} /> Tenant Activations
                </div>
                {activations.length === 0 ? (
                    <p className="text-tp-xs italic text-app-muted-foreground">
                        No organization has activated this gateway yet.
                    </p>
                ) : (
                    <div className="px-3 py-2 rounded-lg flex items-center gap-2"
                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                        <Building2 size={14} style={{ color: 'var(--app-success, #22c55e)' }} />
                        <span className="text-tp-sm font-bold">
                            <span className="font-black">{activations.length}</span> organization{activations.length > 1 ? 's' : ''} actively using this gateway
                        </span>
                    </div>
                )}
            </section>

            {/* Action bar */}
            <div className="flex items-center justify-end gap-2 pt-3"
                style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <button onClick={() => onToggle(node)}
                    className="flex items-center gap-1 text-tp-xs font-bold px-3 py-1.5 rounded-lg hover:bg-app-surface-hover transition-all"
                    style={{ color: gw.is_active ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}>
                    <Power size={12} /> {gw.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => onEdit(node)}
                    className="flex items-center gap-1 text-tp-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:shadow-md"
                    style={{ background: 'var(--app-primary)' }}>
                    <Pencil size={12} /> Edit
                </button>
                <button onClick={() => onAskDelete(node)}
                    className="flex items-center gap-1 text-tp-xs font-bold px-3 py-1.5 rounded-lg hover:bg-app-error/10 transition-all"
                    style={{ color: 'var(--app-error, #ef4444)' }}>
                    <Trash2 size={12} /> Delete
                </button>
            </div>
        </PanelShell>
    )
}

function CountryDetail({ node, orgGateways, globalGateways, onClose, onPin, onGotoGateway }: {
    node: GatewayTreeNode
    orgGateways: Array<Record<string, unknown>>
    globalGateways: import('./types').RefGateway[]
    onClose: () => void
    onPin?: (n: GatewayTreeNode) => void
    onGotoGateway: (gatewayId: number) => void
}) {
    const regional = node._gateways || []
    const global = globalGateways
    const allHere = [...regional, ...global]
    const activeHere = allHere.filter(g => g.is_active)
    const orgsHere = orgGateways.filter(og => {
        return allHere.some(g => g.id === og.gateway)
    }).length

    const accent = 'var(--app-info, #3b82f6)'

    return (
        <PanelShell
            title={node.name}
            subtitle={[node.region, node.subregion].filter(Boolean).join(' · ')}
            kindLabel={`Country · ${node.code || ''}${node.iso3 ? ' / ' + node.iso3.toUpperCase() : ''}`}
            accent={accent}
            icon={<span className="text-xl">{getFlagEmoji(node.iso2)}</span>}
            onClose={onClose}
            onPin={onPin}
            node={node}
        >
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Total Gateways" value={allHere.length} color="var(--app-primary)" icon={<Layers size={14} />} />
                <StatTile label="Active" value={activeHere.length} color="var(--app-success, #22c55e)" icon={<CreditCard size={14} />} />
                <StatTile label="Worldwide" value={global.length} color="var(--app-info, #3b82f6)" icon={<Globe size={14} />} />
                <StatTile label="Regional" value={regional.length} color="var(--app-accent)" icon={<MapPin size={14} />} />
            </div>

            {/* Regional gateways */}
            <section>
                <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin size={10} /> Regional Gateways ({regional.length})
                </div>
                {regional.length === 0 ? (
                    <p className="text-tp-xs italic text-app-muted-foreground">
                        No region-specific gateways listed for {node.name}. Worldwide gateways below still apply.
                    </p>
                ) : (
                    <div className="space-y-1">
                        {regional.map(gw => (
                            <button key={gw.id}
                                onClick={() => onGotoGateway(gw.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-app-surface-hover"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    opacity: gw.is_active ? 1 : 0.6,
                                }}>
                                <span className="text-base">{gw.logo_emoji || '💳'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-tp-sm font-bold truncate">{gw.name}</span>
                                        {!gw.is_active && (
                                            <span className="text-[8px] font-black px-1 rounded text-app-muted-foreground"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 12%, transparent)' }}>DRAFT</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="font-mono text-tp-xxs text-app-muted-foreground">{gw.code}</span>
                                        {gw.provider_family && <span className="text-tp-xxs text-app-muted-foreground">· {gw.provider_family}</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* Global gateways */}
            {global.length > 0 && (
                <section>
                    <div className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1">
                        <Globe size={10} /> Worldwide Gateways ({global.length}) — also available
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {global.map(gw => (
                            <button key={gw.id}
                                onClick={() => onGotoGateway(gw.id)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-tp-xs font-bold transition-all hover:scale-[1.03]"
                                style={{
                                    background: `color-mix(in srgb, ${gw.color || '#6366f1'} 10%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${gw.color || '#6366f1'} 25%, transparent)`,
                                    opacity: gw.is_active ? 1 : 0.55,
                                }}>
                                <span className="text-[13px] leading-none">{gw.logo_emoji || '💳'}</span>
                                <span>{gw.name}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {orgsHere > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                    <Building2 size={13} style={{ color: 'var(--app-success, #22c55e)' }} />
                    <span className="text-tp-xs font-bold">
                        <span className="font-black">{orgsHere}</span> tenant activation{orgsHere > 1 ? 's' : ''} associated with gateways available here
                    </span>
                </div>
            )}
        </PanelShell>
    )
}
