'use client'

import { useState, useMemo, useTransition, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
    CreditCard, Plus, Layers, Check, Globe, MapPin, Filter,
    LayoutGrid, MapPinned, Building2, AlertTriangle,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { runTimed } from '@/lib/perf-timing'
import {
    deleteRefPaymentGateway, toggleRefPaymentGateway,
} from '@/app/actions/reference'
import { GatewayEditorDialog } from './GatewayEditorDialog'
import {
    type RefGateway, type RefCountryLite, type GatewayTreeNode, type ViewMode,
    buildGatewayTreeData, buildCountryTreeData,
} from './components/types'
import { GatewayTreeRow } from './components/GatewayTreeRow'
import { CountryTreeRow } from './components/CountryTreeRow'
import { DetailPanel } from './components/DetailPanel'

interface Props {
    allGateways: RefGateway[]
    initialOrgGateways: Array<Record<string, unknown>>
    countries: RefCountryLite[]
}

export default function PaymentGatewaysClient({ allGateways, initialOrgGateways, countries }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    const [mode, setMode] = useState<ViewMode>('gateway')
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorTarget, setEditorTarget] = useState<RefGateway | null>(null)
    const [pendingDelete, setPendingDelete] = useState<RefGateway | null>(null)

    /* ── Lookups ────────────────────────────────── */
    const countriesByIso2 = useMemo(() => {
        const m: Record<string, RefCountryLite> = {}
        countries.forEach(c => { m[c.iso2.toUpperCase()] = c })
        return m
    }, [countries])

    /* ── Synthetic tree data per mode ───────────── */
    const gatewayTreeData = useMemo(() => buildGatewayTreeData(allGateways), [allGateways])
    const countryTreeData = useMemo(
        () => buildCountryTreeData(countries, allGateways),
        [countries, allGateways],
    )
    const treeData = mode === 'gateway' ? gatewayTreeData : countryTreeData
    const globalGateways = useMemo(() => allGateways.filter(g => g.is_global), [allGateways])
    const hasRegionalCoverage = useMemo(
        () => allGateways.some(g => !g.is_global && (g.country_codes || []).length > 0),
        [allGateways],
    )

    /* ── Action handlers ──────────────────────── */
    const openCreate = useCallback(() => { setEditorTarget(null); setEditorOpen(true) }, [])
    const openEdit = useCallback((n: GatewayTreeNode) => {
        if (n._gw) { setEditorTarget(n._gw); setEditorOpen(true) }
    }, [])
    const handleToggle = useCallback(async (n: GatewayTreeNode) => {
        const gw = n._gw
        if (!gw) return
        const res = await runTimed(
            'saas.payment-gateways:toggle-active',
            () => toggleRefPaymentGateway(gw.id),
        )
        if (res.success) {
            toast.success(`${gw.name} ${gw.is_active ? 'deactivated' : 'activated'}`)
            startTransition(() => router.refresh())
        } else toast.error(res.error || 'Failed to toggle')
    }, [router, startTransition])
    const askDelete = useCallback((n: GatewayTreeNode) => {
        const gw = n._gw
        if (!gw) return
        if (initialOrgGateways.some(og => og.gateway === gw.id)) {
            toast.error('In use by one or more orgs — deactivate instead.')
            return
        }
        setPendingDelete(gw)
    }, [initialOrgGateways])
    const handleConfirmDelete = useCallback(async () => {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        const res = await runTimed(
            'saas.payment-gateways:delete',
            () => deleteRefPaymentGateway(target.id),
        )
        if (res.success) {
            toast.success(`${target.name} removed`)
            startTransition(() => router.refresh())
        } else toast.error(res.error || 'Failed to delete')
    }, [pendingDelete, router, startTransition])

    /* ── Cross-pivot navigation ───────────────── */
    // Render-prop ref so we can drive the template's selection state on pivot.
    type TreeRenderRef = {
        setSidebarNode?: (n: GatewayTreeNode | null) => void
        setSidebarTab?: (tab: string) => void
    }
    const renderRef = useRef<TreeRenderRef | null>(null)

    const gotoCountry = useCallback((iso2: string) => {
        const code = iso2.toUpperCase()
        setMode('country')
        // Defer until after the mode-driven tree rebuild commits.
        setTimeout(() => {
            const node = countryTreeData.find(n => n.id === `cty:${code}`)
            if (node) renderRef.current?.setSidebarNode?.(node)
            const el = document.querySelector(`[data-row-id="cty:${code}"]`)
            ;(el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 60)
    }, [countryTreeData])

    const gotoGateway = useCallback((gatewayId: number) => {
        setMode('gateway')
        setTimeout(() => {
            const node = gatewayTreeData.find(n => n.id === `gw:${gatewayId}`)
            if (node) renderRef.current?.setSidebarNode?.(node)
            const el = document.querySelector(`[data-row-id="gw:${gatewayId}"]`)
            ;(el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 60)
    }, [gatewayTreeData])

    /* ── Counters used by the segmented toggle and KPIs ─── */
    const activeCount = allGateways.filter(g => g.is_active).length
    const globalCount = allGateways.filter(g => g.is_global).length
    const familiesCount = useMemo(
        () => new Set(allGateways.map(g => g.provider_family || 'Other')).size,
        [allGateways],
    )
    const countriesCovered = useMemo(() => {
        const s = new Set<string>()
        allGateways.forEach(g => (g.country_codes || []).forEach(cc => s.add(cc.toUpperCase())))
        return s.size
    }, [allGateways])
    const regionsCount = useMemo(
        () => new Set(countries.map(c => c.region || 'Other').filter(Boolean)).size,
        [countries],
    )
    const usedCount = useMemo(
        () => allGateways.filter(g => initialOrgGateways.some(og => og.gateway === g.id)).length,
        [allGateways, initialOrgGateways],
    )

    /* ── KPI predicates per mode ────────────────── */
    const gatewayKpiPredicates = useMemo(() => ({
        active: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            if (item._kind === 'family') {
                return all.some(g => (g as GatewayTreeNode).parent === item.id && (g as GatewayTreeNode)._gw?.is_active === true)
            }
            return (item as GatewayTreeNode)._gw?.is_active === true
        },
        global: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            if (item._kind === 'family') {
                return all.some(g => (g as GatewayTreeNode).parent === item.id && (g as GatewayTreeNode)._gw?.is_global === true)
            }
            return (item as GatewayTreeNode)._gw?.is_global === true
        },
        regional: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            if (item._kind === 'family') {
                return all.some(g => (g as GatewayTreeNode).parent === item.id && (g as GatewayTreeNode)._gw?.is_global === false)
            }
            const n = item as GatewayTreeNode
            return n._kind === 'gateway' && n._gw?.is_global === false
        },
        used: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            const isUsed = (gid: number) => initialOrgGateways.some(og => og.gateway === gid)
            if (item._kind === 'family') {
                return all.some(g => (g as GatewayTreeNode).parent === item.id && (g as GatewayTreeNode)._gw && isUsed((g as GatewayTreeNode)._gw!.id))
            }
            const n = item as GatewayTreeNode
            return !!n._gw && isUsed(n._gw.id)
        },
    }), [initialOrgGateways])

    const countryKpiPredicates = useMemo(() => ({
        // "Has regional" — country has at least one country-specific gateway listed
        regional: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            const n = item as GatewayTreeNode
            if (n._kind === 'region') {
                return all.some(x => (x as GatewayTreeNode).parent === n.id && ((x as GatewayTreeNode)._gateways?.length || 0) > 0)
            }
            return n._kind === 'country' && (n._gateways?.length || 0) > 0
        },
        // "Worldwide-only" — country has zero country-specific gateways (worldwide still apply via banner)
        worldwide: (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => {
            const n = item as GatewayTreeNode
            if (n._kind === 'region') {
                return all.some(x => (x as GatewayTreeNode).parent === n.id && ((x as GatewayTreeNode)._gateways?.length || 0) === 0)
            }
            return n._kind === 'country' && (n._gateways?.length || 0) === 0
        },
    }), [])

    /* ── Mode toggle (rendered as a secondary action button) ─── */
    const ModeToggle = () => (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <button
                onClick={() => setMode('gateway')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-tp-xs font-black rounded-lg transition-all"
                style={{
                    background: mode === 'gateway' ? 'var(--app-primary)' : 'transparent',
                    color: mode === 'gateway' ? '#fff' : 'var(--app-muted-foreground)',
                }}>
                <LayoutGrid size={11} /> By Gateway
            </button>
            <button
                onClick={() => setMode('country')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-tp-xs font-black rounded-lg transition-all"
                style={{
                    background: mode === 'country' ? 'var(--app-primary)' : 'transparent',
                    color: mode === 'country' ? '#fff' : 'var(--app-muted-foreground)',
                }}>
                <MapPinned size={11} /> By Country
            </button>
        </div>
    )

    return (
        <>
            <TreeMasterPage
                key={mode}
                config={{
                    title: 'Payment Gateways',
                    subtitle: (filtered: Array<Record<string, unknown>>, all: Array<Record<string, unknown>>) => {
                        if (mode === 'gateway') {
                            const gw = filtered.filter(n => (n as GatewayTreeNode)._kind === 'gateway').length
                            const totalGw = all.filter(n => (n as GatewayTreeNode)._kind === 'gateway').length
                            return `${gw === totalGw ? totalGw : `${gw}/${totalGw}`} Gateways · ${familiesCount} Families · SaaS Reference`
                        }
                        const c = filtered.filter(n => (n as GatewayTreeNode)._kind === 'country').length
                        const totalC = all.filter(n => (n as GatewayTreeNode)._kind === 'country').length
                        return `${c === totalC ? totalC : `${c}/${totalC}`} Countries · ${regionsCount} Regions · SaaS Coverage Map`
                    },
                    icon: <CreditCard size={20} />,
                    iconColor: 'var(--app-primary)',
                    searchPlaceholder: mode === 'gateway'
                        ? 'Search by gateway name, code, family, country... (Ctrl+K)'
                        : 'Search by country, ISO, region... (Ctrl+K)',
                    primaryAction: { label: 'New Gateway', icon: <Plus size={14} />, onClick: openCreate },
                    secondaryActions: [
                        { label: 'mode-toggle', icon: <Filter size={11} />, render: () => <ModeToggle /> },
                    ],
                    data: treeData as unknown as Array<Record<string, unknown>>,
                    searchFields: mode === 'gateway'
                        ? ['name', 'code', 'description']
                        : ['name', 'iso2', 'iso3', 'region', 'subregion'],
                    treeParentKey: 'parent',
                    kpiPredicates: (mode === 'gateway' ? gatewayKpiPredicates : countryKpiPredicates) as unknown as Record<string, (item: Record<string, unknown>, all: Array<Record<string, unknown>>) => boolean>,
                    kpis: mode === 'gateway' ? [
                        { label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)', filterKey: 'all', value: () => allGateways.length, hint: 'Show all gateways (clear filters)' },
                        { label: 'Active', icon: <Check size={11} />, color: 'var(--app-success, #22c55e)', filterKey: 'active', value: activeCount, hint: 'Show only live gateways' },
                        { label: 'Global', icon: <Globe size={11} />, color: 'var(--app-info, #3b82f6)', filterKey: 'global', value: globalCount, hint: 'Show worldwide gateways' },
                        { label: 'Regional', icon: <MapPin size={11} />, color: 'var(--app-accent)', filterKey: 'regional', value: allGateways.length - globalCount, hint: 'Show country-specific gateways' },
                        { label: 'Used', icon: <Building2 size={11} />, color: 'var(--app-success, #22c55e)', filterKey: 'used', value: usedCount, hint: 'Show gateways activated by at least one org' },
                        { label: 'Countries', icon: <Globe size={11} />, color: 'var(--app-info, #3b82f6)', value: countriesCovered, hint: 'Distinct ISO2 codes referenced across the catalog' },
                    ] : [
                        { label: 'Total', icon: <MapPinned size={11} />, color: 'var(--app-primary)', filterKey: 'all', value: () => countries.length, hint: 'Show all countries' },
                        { label: 'Has Regional', icon: <MapPin size={11} />, color: 'var(--app-accent)', filterKey: 'regional', value: countriesCovered, hint: 'Countries with at least one country-specific gateway' },
                        { label: 'Worldwide-Only', icon: <Globe size={11} />, color: 'var(--app-info, #3b82f6)', filterKey: 'worldwide', value: () => Math.max(0, countries.length - countriesCovered), hint: 'Countries with no country-specific gateway — only worldwide gateways apply' },
                        { label: 'Regions', icon: <Layers size={11} />, color: 'var(--app-warning)', value: regionsCount, hint: 'Number of geographic regions' },
                        { label: 'Worldwide GW', icon: <Globe size={11} />, color: 'var(--app-info, #3b82f6)', value: globalCount, hint: 'Number of is_global gateways (apply to every country)' },
                    ],
                    columnHeaders: mode === 'gateway' ? [
                        { label: 'Gateway', width: 'auto' },
                        { label: 'Code', width: '90px', hideOnMobile: true },
                        { label: 'Family', width: '120px', color: 'var(--app-warning)', hideOnMobile: true },
                        { label: 'Countries', width: '110px', color: 'var(--app-info, #3b82f6)', hideOnMobile: true },
                        { label: 'Fields', width: '70px', color: 'var(--app-accent)', hideOnMobile: true },
                        { label: 'Status', width: '80px', color: 'var(--app-success, #22c55e)', hideOnMobile: true },
                    ] : [
                        { label: 'Country', width: 'auto' },
                        { label: 'ISO', width: '90px', hideOnMobile: true },
                        { label: 'Region', width: '110px', color: 'var(--app-warning)', hideOnMobile: true },
                        { label: 'Gateways', width: '80px', color: 'var(--app-success, #22c55e)', hideOnMobile: true },
                    ],
                    emptyState: {
                        icon: <CreditCard size={36} />,
                        title: (hasSearch: boolean) => hasSearch
                            ? (mode === 'gateway' ? 'No matching gateways' : 'No matching countries')
                            : (mode === 'gateway' ? 'No payment gateways in the catalog' : 'No countries with gateway coverage'),
                        subtitle: (hasSearch: boolean) => hasSearch
                            ? 'Try a different search term or clear filters.'
                            : (mode === 'gateway' ? 'Click "New Gateway" or run seed_payment_gateways.' : 'Add gateways with country_codes, or mark some as global.'),
                        actionLabel: mode === 'gateway' ? 'Add First Gateway' : undefined,
                    },
                    footerLeft: () => (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span>{allGateways.length} gateways</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{countriesCovered} countries covered</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{initialOrgGateways.length} org activations</span>
                        </div>
                    ),
                }}
                aboveTree={mode === 'country' ? (
                    <WorldwideBanner
                        globalGateways={globalGateways}
                        onGotoGateway={gotoGateway}
                        hasRegionalCoverage={hasRegionalCoverage}
                    />
                ) : undefined}
                detailPanel={(node, { onClose, onPin }) => (
                    <DetailPanel
                        node={node as GatewayTreeNode}
                        countriesByIso2={countriesByIso2}
                        orgGateways={initialOrgGateways}
                        globalGateways={globalGateways}
                        onClose={onClose}
                        onPin={onPin ? (n) => onPin(n) : undefined}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                        onAskDelete={askDelete}
                        onGotoCountry={gotoCountry}
                        onGotoGateway={gotoGateway}
                    />
                )}
            >
                {(renderProps) => {
                    renderRef.current = {
                        setSidebarNode: renderProps.setSidebarNode,
                        setSidebarTab: renderProps.setSidebarTab,
                    }
                    const tree = renderProps.tree as GatewayTreeNode[]
                    const { searchQuery, expandAll, expandKey, isCompact, openNode, isSelected } = renderProps

                    return tree.map((node) => (
                        <div
                            key={`${node.id}-${expandKey}`}
                            data-row-id={node.id}
                            className={`rounded-xl transition-all duration-300 ${isSelected(node) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}
                        >
                            {mode === 'gateway' ? (
                                <GatewayTreeRow
                                    node={node}
                                    level={0}
                                    searchQuery={searchQuery}
                                    forceExpanded={expandAll}
                                    compact={isCompact}
                                    onSelect={(n) => openNode(n)}
                                    onEdit={openEdit}
                                    onToggle={handleToggle}
                                    onAskDelete={askDelete}
                                    onGotoCountry={gotoCountry}
                                />
                            ) : (
                                <CountryTreeRow
                                    node={node}
                                    level={0}
                                    searchQuery={searchQuery}
                                    forceExpanded={expandAll}
                                    compact={isCompact}
                                    onSelect={(n) => openNode(n)}
                                    onGotoGateway={gotoGateway}
                                />
                            )}
                        </div>
                    ))
                }}
            </TreeMasterPage>

            <GatewayEditorDialog
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                onSaved={() => startTransition(() => router.refresh())}
                initial={editorTarget}
            />

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(o) => { if (!o) setPendingDelete(null) }}
                title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete'}
                description="This removes the gateway from the global catalog. Tenants who haven't activated it won't be affected."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  WorldwideBanner — sits above the country tree.
 *
 *  Worldwide gateways apply to every country, so we surface them
 *  ONCE here instead of stamping them onto every country row.
 *  When no regional gateways exist anywhere, this also explains
 *  why the country list looks "empty" — there's nothing to
 *  differentiate countries by.
 * ═══════════════════════════════════════════════════════════ */
function WorldwideBanner({ globalGateways, hasRegionalCoverage, onGotoGateway }: {
    globalGateways: import('./components/types').RefGateway[]
    hasRegionalCoverage: boolean
    onGotoGateway: (id: number) => void
}) {
    if (globalGateways.length === 0 && hasRegionalCoverage) return null

    if (globalGateways.length === 0) {
        return (
            <div className="rounded-2xl p-3 mb-3 flex items-center gap-2"
                style={{
                    background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)',
                }}>
                <AlertTriangle size={14} style={{ color: 'var(--app-warning)' }} />
                <span className="text-tp-xs font-bold" style={{ color: 'var(--app-warning)' }}>
                    No worldwide gateways and no country coverage configured.
                </span>
                <span className="text-tp-xs text-app-muted-foreground">
                    Edit a gateway and set <span className="font-mono font-bold">is_global</span> or add ISO codes to <span className="font-mono font-bold">country_codes</span>.
                </span>
            </div>
        )
    }

    return (
        <div className="rounded-2xl p-3 mb-3 flex flex-col gap-2"
            style={{
                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
            }}>
            <div className="flex items-center gap-2 flex-wrap">
                <Globe size={14} style={{ color: 'var(--app-info, #3b82f6)' }} />
                <span className="text-tp-xs font-black uppercase tracking-widest" style={{ color: 'var(--app-info, #3b82f6)' }}>
                    Worldwide Gateways · apply to every country below
                </span>
                <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                    {globalGateways.length}
                </span>
                {!hasRegionalCoverage && (
                    <span className="text-tp-xxs font-medium text-app-muted-foreground italic ml-auto">
                        No country-specific gateways exist — every country shows only these.
                    </span>
                )}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {globalGateways.map(gw => (
                    <button
                        key={gw.id}
                        onClick={() => onGotoGateway(gw.id)}
                        title={gw.name}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-tp-xs font-bold transition-all hover:scale-[1.03]"
                        style={{
                            background: `color-mix(in srgb, ${gw.color || '#6366f1'} 10%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${gw.color || '#6366f1'} 30%, transparent)`,
                            color: gw.is_active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                            opacity: gw.is_active ? 1 : 0.55,
                        }}>
                        <span className="text-[14px] leading-none">{gw.logo_emoji || '💳'}</span>
                        <span>{gw.name}</span>
                        {!gw.is_active && (
                            <span className="text-[8px] font-black px-1 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 15%, transparent)' }}>DRAFT</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
