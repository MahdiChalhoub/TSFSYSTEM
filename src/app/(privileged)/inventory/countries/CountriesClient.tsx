'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import type { ReactNode } from 'react'
import {
    Globe, Plus, Trash2, X, MapPin, Bookmark, Check, Pencil,
    Coins, Layers, Power, Search, Tag, Package, Boxes, ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    disableSourcingCountry,
    bulkEnableSourcingCountries,
} from '@/app/actions/reference'
import { erpFetch } from '@/lib/erp-api'

/* ─── Region colour palette (from the original sourcing design) ─── */
const REGION_CSS_VAR: Record<string, string> = {
    Africa: '--app-warning',
    Americas: '--app-success',
    Asia: '--app-error',
    Europe: '--app-primary',
    Oceania: '--app-info',
}
const regionVar = (r?: string | null) => REGION_CSS_VAR[r || ''] || '--app-muted-foreground'
const regionColor = (r?: string | null) => `var(${regionVar(r)})`

/* ─── Parfum dot colours (from the original) ─── */
const PARFUM_COLORS: Record<string, string> = {
    Rose: '#ff6b9d', Citron: '#fbbf24', Menthe: 'var(--app-primary)',
    Lavande: '#a78bfa', Original: 'var(--app-info)', Jasmin: 'var(--app-warning)',
    Vanille: '#fde047', Ocean: 'var(--app-accent-cyan)',
}
const parfumColor = (name?: string) => (name && PARFUM_COLORS[name]) || '#6b7280'

type Product = {
    id: number; name: string; sku: string
    brand?: number | null; brand_name?: string
    parfum?: number | null; parfum_name?: string
    size?: number | null; size_unit?: string | null
}
type ProductVariant = {
    parfum_name: string; size_label: string
    size_value: number | null; count: number; products: Product[]
}
type BrandGroup = {
    brand_id: number | null; brand_name: string
    total_products: number; variants: ProductVariant[]
}

type RefCountry = {
    id: number; iso2: string; iso3?: string; name: string
    region?: string | null; subregion?: string | null
    default_currency?: number | null
    default_currency_code?: string | null
}
type SourcingCountry = {
    id: number
    country: number
    country_iso2: string; country_iso3?: string
    country_name: string
    country_region?: string | null
    default_currency_code?: string | null
    is_enabled: boolean
    notes?: string
    display_order?: number
}

type Props = {
    initialSourcing: SourcingCountry[]
    initialRefCountries: RefCountry[]
}

/** Tree node fed to TreeMasterPage — either a synthetic region group or a SourcingCountry leaf. */
type CountryTreeNode = SourcingCountry & {
    _type: 'country'
    _pk?: number
    parent: string | null
    name: string
    children?: TreeNode[]
}
type RegionTreeNode = {
    id: string
    parent: null
    _type: 'region'
    name: string
    country_region: string
    is_enabled?: boolean
    notes?: string
    children?: TreeNode[]
}
type TreeNode = CountryTreeNode | RegionTreeNode

/* ═══════════════════════════════════════════════════════════
 *  CountriesClient — tenant-curated sourcing countries.
 *  Tree: Region → Country. Adding pulls from the global
 *  reference list (RefCountry); removing only detaches from
 *  this tenant's sourcing list.
 * ═══════════════════════════════════════════════════════════ */
export function CountriesClient({ initialSourcing, initialRefCountries }: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<SourcingCountry | null>(null)
    const [editingNotes, setEditingNotes] = useState<SourcingCountry | null>(null)

    const sourcing = initialSourcing
    const refCountries = initialRefCountries
    const enabledCountryIds = useMemo(
        () => new Set(sourcing.map(s => s.country)),
        [sourcing]
    )

    /* ── Build flat [regionRoot, ...countries] list so TreeMasterPage's
     * buildTree turns regions into collapsible parents. ── */
    const data = useMemo<TreeNode[]>(() => {
        const rows: TreeNode[] = []
        const seenRegions = new Set<string>()
        for (const sc of sourcing) {
            const region = sc.country_region || 'Unassigned'
            if (!seenRegions.has(region)) {
                seenRegions.add(region)
                rows.push({
                    id: `region:${region}`, parent: null, _type: 'region',
                    name: region, country_region: region,
                })
            }
        }
        for (const sc of sourcing) {
            rows.push({
                ...sc,
                id: `sc:${sc.id}` as unknown as number,
                _pk: sc.id,
                parent: `region:${sc.country_region || 'Unassigned'}`,
                _type: 'country',
                name: sc.country_name,
            })
        }
        return rows
    }, [sourcing])

    /* ── Handlers ─────────────────────────────────────────── */
    const handleAdd = async (countryIds: number[]) => {
        if (countryIds.length === 0) { setPickerOpen(false); return }
        const res = await bulkEnableSourcingCountries(countryIds)
        if (res?.success) {
            toast.success(`${countryIds.length} countr${countryIds.length === 1 ? 'y' : 'ies'} added`)
            setPickerOpen(false)
            router.refresh()
        } else {
            toast.error(res?.error || 'Failed to enable sourcing countries')
        }
    }

    const handleRemove = () => {
        const t = deleteTarget
        if (!t) return
        setDeleteTarget(null)
        startTransition(async () => {
            const res = await disableSourcingCountry(t.id)
            if (res?.success) { toast.success(`"${t.country_name}" removed from sourcing`); router.refresh() }
            else { toast.error(res?.error || 'Failed to remove') }
        })
    }

    const handleToggleEnabled = async (sc: SourcingCountry) => {
        try {
            await erpFetch(`reference/sourcing-countries/${sc.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_enabled: !sc.is_enabled }),
            })
            toast.success(!sc.is_enabled ? 'Enabled' : 'Paused')
            router.refresh()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to toggle')
        }
    }

    const handleSaveNotes = async (sc: SourcingCountry, notes: string) => {
        try {
            await erpFetch(`reference/sourcing-countries/${sc.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            })
            toast.success('Notes saved')
            setEditingNotes(null)
            router.refresh()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to save notes')
        }
    }

    // The TreeMasterPage data prop is typed as Record<string, unknown>[]; our `TreeNode`
    // shape carries the same `_type` discriminator the predicates use. The adapter casts
    // each row at the predicate boundary so we don't sprinkle ` as any` through the config.
    const dataAsRecords = data as unknown as Record<string, unknown>[]
    const asNode = (item: Record<string, unknown>): TreeNode => item as unknown as TreeNode

    return (
        <TreeMasterPage
            config={{
                title: 'Sourcing Countries',
                subtitle: (_, all) => {
                    const countries = all.filter((n) => asNode(n)._type === 'country').length
                    const regions = all.filter((n) => asNode(n)._type === 'region').length
                    return `${countries} active · ${regions} region${regions !== 1 ? 's' : ''}`
                },
                icon: <Globe size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search country or ISO code… (Ctrl+K)',
                primaryAction: { label: 'Add Sourcing', icon: <Plus size={14} />, onClick: () => setPickerOpen(true) },
                columnHeaders: [
                    { label: 'Country', width: 'auto', sortKey: 'name' },
                    { label: 'ISO', width: '56px', color: 'var(--app-info)', hideOnMobile: true, sortKey: 'code' },
                    { label: 'Currency', width: '72px', color: 'var(--app-warning)', hideOnMobile: true, sortKey: 'currency' },
                    { label: 'Status', width: '64px', color: 'var(--app-success)', hideOnMobile: true, sortKey: 'is_active' },
                ],

                // ── Template-owned filtering ──
                data: dataAsRecords,
                searchFields: ['name', 'country_name', 'country_iso2', 'country_iso3', 'country_region'],
                treeParentKey: 'parent',
                kpiPredicates: {
                    regions: (n) => asNode(n)._type === 'region',
                    countries: (n) => asNode(n)._type === 'country',
                    active: (n) => { const x = asNode(n); return x._type === 'country' && !!x.is_enabled },
                    paused: (n) => { const x = asNode(n); return x._type === 'country' && !x.is_enabled },
                    withNotes: (n) => { const x = asNode(n); return x._type === 'country' && !!x.notes },
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={11} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show everything (clear filters)',
                        value: (_, all) => all.filter((n) => asNode(n)._type === 'country').length,
                    },
                    {
                        label: 'Regions', icon: <MapPin size={11} />, color: 'var(--app-info)',
                        filterKey: 'regions', hint: 'Show only region groupings',
                        value: (_, all) => all.filter((n) => asNode(n)._type === 'region').length,
                    },
                    {
                        label: 'Active', icon: <Power size={11} />, color: 'var(--app-success)',
                        filterKey: 'active', hint: 'Currently enabled for sourcing',
                        value: (filtered) => filtered.filter((n) => { const x = asNode(n); return x._type === 'country' && !!x.is_enabled }).length,
                    },
                    {
                        label: 'Paused', icon: <X size={11} />, color: 'var(--app-warning)',
                        filterKey: 'paused', hint: 'Disabled without removing',
                        value: (filtered) => filtered.filter((n) => { const x = asNode(n); return x._type === 'country' && !x.is_enabled }).length,
                    },
                    {
                        label: 'With Notes', icon: <Pencil size={11} />, color: 'var(--app-muted-foreground)',
                        filterKey: 'withNotes', hint: 'Countries with sourcing notes',
                        value: (filtered) => filtered.filter((n) => { const x = asNode(n); return x._type === 'country' && !!x.notes }).length,
                    },
                ],

                emptyState: {
                    icon: <Globe size={36} />,
                    title: (hasSearch) => hasSearch ? 'No matching countries' : 'No sourcing countries yet',
                    subtitle: (hasSearch) => hasSearch
                        ? 'Try a different search or clear filters.'
                        : 'Pick the countries you source products from. You can enable any country from the global list.',
                    actionLabel: 'Add Sourcing Countries',
                },
                footerLeft: (filtered, all) => {
                    const countries = all.filter((n) => asNode(n)._type === 'country').length
                    const active = all.filter((n) => { const x = asNode(n); return x._type === 'country' && !!x.is_enabled }).length
                    return (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span>{countries} sourcing countries</span>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span>{active} active</span>
                            {filtered.length < all.length && (
                                <>
                                    <span style={{ color: 'var(--app-border)' }}>·</span>
                                    <span style={{ color: 'var(--app-info)' }}>{filtered.length} showing</span>
                                </>
                            )}
                        </div>
                    )
                },
            }}
            modals={
                <>
                    {pickerOpen && (
                        <SourcingPicker
                            allCountries={refCountries}
                            enabledIds={enabledCountryIds}
                            onClose={() => setPickerOpen(false)}
                            onSubmit={handleAdd}
                        />
                    )}
                    {editingNotes && (
                        <NotesModal
                            country={editingNotes}
                            onCancel={() => setEditingNotes(null)}
                            onSave={(n: string) => handleSaveNotes(editingNotes, n)}
                        />
                    )}
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleRemove}
                        title={`Remove "${deleteTarget?.country_name}"?`}
                        description="This country will no longer be available as a product-origin option. Existing products that already reference it are not affected."
                        confirmText="Remove"
                        variant="danger"
                    />
                </>
            }
            detailPanel={(node, { onClose, onPin }) => (
                <CountryDetailPanel
                    node={asNode(node as Record<string, unknown>)}
                    onToggleEnabled={handleToggleEnabled}
                    onEditNotes={(sc: SourcingCountry) => setEditingNotes(sc)}
                    onRemove={(sc: SourcingCountry) => setDeleteTarget(sc)}
                    onClose={onClose}
                    onPin={onPin ? () => onPin(node) : undefined}
                />
            )}
        >
            {({ tree, expandKey, expandAll, searchQuery, isSelected, openNode }) => (
                tree.map((rawNode) => {
                    const node = asNode(rawNode as Record<string, unknown>)
                    return (
                        <div key={`${node.id}-${expandKey}`}
                            className={`rounded-xl transition-all duration-300 ${isSelected(rawNode) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <CountryRow
                                node={node}
                                level={0}
                                forceExpanded={expandAll}
                                searchQuery={searchQuery}
                                onSelect={(n) => openNode(n as unknown as Record<string, unknown>, 'overview')}
                                onToggleEnabled={handleToggleEnabled}
                                onEditNotes={(sc: SourcingCountry) => setEditingNotes(sc)}
                                onRemove={(sc: SourcingCountry) => setDeleteTarget(sc)}
                            />
                        </div>
                    )
                })
            )}
        </TreeMasterPage>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  ROW — region group or country leaf
 * ═══════════════════════════════════════════════════════════ */
interface CountryRowProps {
    node: TreeNode
    level: number
    forceExpanded?: boolean
    searchQuery?: string
    onSelect: (n: TreeNode) => void
    onToggleEnabled: (sc: SourcingCountry) => void
    onEditNotes: (sc: SourcingCountry) => void
    onRemove: (sc: SourcingCountry) => void
}

function CountryRow({
    node, level, forceExpanded, searchQuery,
    onSelect, onToggleEnabled, onEditNotes, onRemove,
}: CountryRowProps) {
    const isRegion = node._type === 'region'
    const [isOpen, setIsOpen] = useState<boolean>(forceExpanded ?? true)

    if (isRegion) {
        const count = node.children?.length || 0
        return (
            <div>
                <div
                    className="group flex items-center gap-2 py-2 hover:bg-app-surface-hover cursor-pointer relative"
                    onClick={() => setIsOpen(o => !o)}
                    style={{
                        paddingLeft: 12, paddingRight: 12,
                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    }}>
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                        style={{ background: 'var(--app-primary)' }} />
                    <button className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{
                            transition: 'transform 200ms', transform: isOpen ? 'rotate(90deg)' : 'none',
                            color: isOpen ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                        }}>
                            <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </svg>
                    </button>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                        <MapPin size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-tp-lg font-bold text-app-foreground truncate">{node.name}</span>
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                Region
                            </span>
                        </div>
                    </div>
                    <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                        <span className="text-tp-xs font-semibold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                            {count}
                        </span>
                    </div>
                </div>
                {isOpen && node.children?.map((c) => (
                    <CountryRow
                        key={c.id} node={c} level={level + 1}
                        forceExpanded={forceExpanded} searchQuery={searchQuery}
                        onSelect={onSelect}
                        onToggleEnabled={onToggleEnabled}
                        onEditNotes={onEditNotes}
                        onRemove={onRemove}
                    />
                ))}
            </div>
        )
    }

    // Country leaf
    const sc: SourcingCountry = node
    const color = regionColor(sc.country_region)
    return (
        <div
            className="group flex items-center gap-2 py-2 hover:bg-app-surface-hover cursor-pointer relative"
            onClick={() => onSelect(node)}
            onDoubleClick={() => onSelect(node)}
            style={{
                paddingLeft: `${12 + level * 20}px`, paddingRight: 12,
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                opacity: sc.is_enabled ? 1 : 0.6,
            }}>
            <div className="w-5 flex-shrink-0" />

            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                style={{
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                }}
                title={`${sc.country_iso2} · ${sc.country_region || 'Unassigned'}`}>
                {flagEmoji(sc.country_iso2)}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-tp-lg font-medium text-app-foreground truncate">{sc.country_name}</span>
                    {!sc.is_enabled && (
                        <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                            Paused
                        </span>
                    )}
                </div>
                {sc.notes && (
                    <div className="text-tp-xxs text-app-muted-foreground truncate mt-0.5">{sc.notes}</div>
                )}
            </div>

            <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                <span className="font-mono text-tp-xs font-bold" style={{ color: 'var(--app-info)' }}>{sc.country_iso2}</span>
            </div>
            <div className="hidden sm:flex w-[72px] flex-shrink-0 justify-center">
                <span className="font-mono text-tp-xs font-semibold" style={{ color: sc.default_currency_code ? 'var(--app-warning)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                    {sc.default_currency_code || '—'}
                </span>
            </div>
            <div className="hidden sm:flex w-16 flex-shrink-0 justify-center">
                <span className="text-tp-xxs font-bold uppercase tracking-wide"
                    style={{ color: sc.is_enabled ? 'var(--app-success)' : 'var(--app-warning)' }}>
                    {sc.is_enabled ? 'Active' : 'Paused'}
                </span>
            </div>

            <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onToggleEnabled(sc) }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                    title={sc.is_enabled ? 'Pause sourcing' : 'Resume sourcing'}>
                    <Power size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onEditNotes(sc) }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit notes">
                    <Pencil size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onRemove(sc) }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors" title="Remove from sourcing">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PICKER MODAL — select from global RefCountries
 * ═══════════════════════════════════════════════════════════ */
function SourcingPicker({
    allCountries, enabledIds, onClose, onSubmit,
}: {
    allCountries: RefCountry[]
    enabledIds: Set<number>
    onClose: () => void
    onSubmit: (ids: number[]) => void
}) {
    const [q, setQ] = useState('')
    const [picked, setPicked] = useState<Set<number>>(new Set())

    const available = useMemo(
        () => allCountries.filter(c => !enabledIds.has(c.id)),
        [allCountries, enabledIds]
    )
    const byRegion = useMemo(() => {
        const needle = q.trim().toLowerCase()
        const filtered = needle
            ? available.filter(c =>
                c.name.toLowerCase().includes(needle)
                || c.iso2.toLowerCase().includes(needle)
                || (c.iso3 || '').toLowerCase().includes(needle)
                || (c.region || '').toLowerCase().includes(needle))
            : available
        const groups = new Map<string, RefCountry[]>()
        for (const c of filtered) {
            const r = c.region || 'Unassigned'
            if (!groups.has(r)) groups.set(r, [])
            groups.get(r)!.push(c)
        }
        return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
    }, [available, q])

    const toggle = (id: number) => {
        setPicked(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }
    const toggleRegion = (countries: RefCountry[]) => {
        const ids = countries.map(c => c.id)
        const allPicked = ids.every(id => picked.has(id))
        setPicked(prev => {
            const next = new Set(prev)
            if (allPicked) ids.forEach(id => next.delete(id))
            else ids.forEach(id => next.add(id))
            return next
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                            <Globe size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">Add Sourcing Countries</h3>
                            <p className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>
                                {available.length} available · {picked.size} selected
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30"><X size={16} /></button>
                </div>

                <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                            placeholder="Search country or region…"
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-tp-md bg-app-background border border-app-border outline-none" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-3">
                    {byRegion.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Globe size={28} className="text-app-muted-foreground mb-2 opacity-40" />
                            <p className="text-tp-md font-bold text-app-muted-foreground">No more countries available</p>
                            <p className="text-tp-sm text-app-muted-foreground mt-0.5">Every country is already in your sourcing list.</p>
                        </div>
                    )}
                    {byRegion.map(([region, countries]) => {
                        const ids = countries.map(c => c.id)
                        const allOn = ids.every(id => picked.has(id))
                        const someOn = ids.some(id => picked.has(id))
                        return (
                            <div key={region}>
                                <button onClick={() => toggleRegion(countries)}
                                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-app-surface transition-colors">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin size={12} style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-tp-xxs font-black uppercase tracking-wider"
                                            style={{ color: 'var(--app-muted-foreground)' }}>{region}</span>
                                        <span className="text-tp-xxs font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                            ({countries.length})
                                        </span>
                                    </div>
                                    <span className="text-tp-xxs font-bold uppercase tracking-wide"
                                        style={{ color: allOn ? 'var(--app-primary)' : someOn ? 'var(--app-info)' : 'var(--app-muted-foreground)' }}>
                                        {allOn ? 'All selected' : someOn ? 'Some' : 'Select all'}
                                    </span>
                                </button>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-1">
                                    {countries.map(c => {
                                        const on = picked.has(c.id)
                                        return (
                                            <button key={c.id} onClick={() => toggle(c.id)}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                                                style={on ? {
                                                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)',
                                                } : {
                                                    background: 'color-mix(in srgb, var(--app-border) 10%, transparent)',
                                                    border: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                }}>
                                                <span className="text-base leading-none">{flagEmoji(c.iso2)}</span>
                                                <span className="flex-1 min-w-0 text-tp-sm font-medium text-app-foreground truncate">{c.name}</span>
                                                <span className="font-mono text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{c.iso2}</span>
                                                {on && <Check size={12} style={{ color: 'var(--app-primary)' }} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} className="text-tp-sm font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={() => onSubmit(Array.from(picked))} disabled={picked.size === 0}
                        className="flex items-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider px-4 py-2 rounded-xl disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Check size={12} /> Add {picked.size > 0 ? `(${picked.size})` : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  NOTES MODAL — edit sourcing notes
 * ═══════════════════════════════════════════════════════════ */
interface NotesModalProps {
    country: SourcingCountry
    onCancel: () => void
    onSave: (text: string) => void
}
function NotesModal({ country, onCancel, onSave }: NotesModalProps) {
    const [text, setText] = useState(country.notes || '')
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="px-5 py-3 flex items-center justify-between"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-base">{flagEmoji(country.country_iso2)}</span>
                        <h3 className="text-sm font-bold">Notes · {country.country_name}</h3>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30"><X size={16} /></button>
                </div>
                <div className="p-4">
                    <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={4}
                        placeholder="e.g. Preferred supplier, lead time, notes…"
                        className="w-full px-3 py-2 rounded-xl text-tp-md bg-app-background border border-app-border outline-none resize-none" />
                </div>
                <div className="px-5 py-3 flex items-center justify-end gap-2"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onCancel} className="text-tp-sm font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={() => onSave(text)}
                        className="flex items-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider px-4 py-2 rounded-xl"
                        style={{ background: 'var(--app-primary)', color: '#fff' }}>
                        <Check size={12} /> Save
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL
 * ═══════════════════════════════════════════════════════════ */
interface CountryDetailPanelProps {
    node: TreeNode
    onToggleEnabled: (sc: SourcingCountry) => void
    onEditNotes: (sc: SourcingCountry) => void
    onRemove: (sc: SourcingCountry) => void
    onClose?: () => void
    onPin?: () => void
}
function CountryDetailPanel({ node, onToggleEnabled, onEditNotes, onRemove, onClose, onPin }: CountryDetailPanelProps) {
    if (node._type === 'region') {
        return (
            <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
                <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)', color: 'var(--app-primary)' }}>
                            <MapPin size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold truncate">{node.name}</h2>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-primary)' }}>
                                {node.children?.length || 0} countr{node.children?.length === 1 ? 'y' : 'ies'}
                            </p>
                        </div>
                    </div>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg"><X size={14} /></button>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                    {node.children?.filter((c): c is Extract<TreeNode, { _type: 'country' }> => c._type === 'country').map((c) => (
                        <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 12%, transparent)' }}>
                            <span className="text-base">{flagEmoji(c.country_iso2)}</span>
                            <span className="flex-1 text-tp-sm font-bold truncate">{c.country_name}</span>
                            <span className="font-mono text-tp-xxs font-bold" style={{ color: 'var(--app-info)' }}>{c.country_iso2}</span>
                            <span className="text-tp-xxs font-bold uppercase" style={{ color: c.is_enabled ? 'var(--app-success)' : 'var(--app-warning)' }}>
                                {c.is_enabled ? 'ON' : 'OFF'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const sc: SourcingCountry = node as SourcingCountry
    const color = regionColor(sc.country_region)
    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{
                    background: `color-mix(in srgb, ${color} 6%, var(--app-surface))`,
                    borderBottom: `1px solid color-mix(in srgb, ${color} 30%, var(--app-border))`,
                }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                        style={{
                            background: `color-mix(in srgb, ${color} 15%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                        }}>
                        {flagEmoji(sc.country_iso2)}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold tracking-tight truncate" style={{ color }}>{sc.country_name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-tp-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                                {sc.country_iso2}
                            </span>
                            {sc.country_region && (
                                <span className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color }}>
                                    {sc.country_region}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && <button onClick={onPin} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Pin"><Bookmark size={13} /></button>}
                    <button onClick={() => onEditNotes(sc)} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Edit notes"><Pencil size={13} /></button>
                    <button onClick={() => onRemove(sc)} className="p-1.5 hover:bg-app-border/50 rounded-lg" title="Remove"><Trash2 size={13} style={{ color: 'var(--app-error)' }} /></button>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg ml-1"><X size={14} /></button>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Status" value={sc.is_enabled ? 'Active' : 'Paused'}
                        color={sc.is_enabled ? 'var(--app-success)' : 'var(--app-warning)'}
                        icon={<Power size={12} />} />
                    <StatTile label="Currency" value={sc.default_currency_code || '—'}
                        color="var(--app-warning)" icon={<Coins size={12} />} />
                    <StatTile label="ISO-2" value={sc.country_iso2} color="var(--app-info)"
                        icon={<Globe size={12} />} mono />
                    <StatTile label="ISO-3" value={sc.country_iso3 || '—'} color="var(--app-info)"
                        icon={<Globe size={12} />} mono />
                </div>

                <button onClick={() => onToggleEnabled(sc)}
                    className="w-full flex items-center justify-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all"
                    style={{
                        background: sc.is_enabled
                            ? 'color-mix(in srgb, var(--app-warning) 10%, transparent)'
                            : 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                        border: `1px solid color-mix(in srgb, ${sc.is_enabled ? 'var(--app-warning)' : 'var(--app-success)'} 30%, transparent)`,
                        color: sc.is_enabled ? 'var(--app-warning)' : 'var(--app-success)',
                    }}>
                    <Power size={12} /> {sc.is_enabled ? 'Pause Sourcing' : 'Resume Sourcing'}
                </button>

                {/* ── Products sourced from this country, grouped by Brand → Parfum/Size ── */}
                <CountryProductDrilldown country={sc} />

                <div className="rounded-xl p-3"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-tp-xxs font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                            <Pencil size={12} /> Notes
                        </div>
                        <button onClick={() => onEditNotes(sc)}
                            className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-primary)' }}>
                            Edit
                        </button>
                    </div>
                    <p className="text-tp-sm text-app-foreground whitespace-pre-wrap">
                        {sc.notes || <span className="text-app-muted-foreground italic">No notes yet.</span>}
                    </p>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  COUNTRY PRODUCT DRILLDOWN
 *  Ported from the original SourcingCountriesClient: load products
 *  for this country, group by Brand → Parfum + Size.
 * ═══════════════════════════════════════════════════════════ */
function CountryProductDrilldown({ country }: { country: SourcingCountry }) {
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [groups, setGroups] = useState<BrandGroup[]>([])
    const [expanded, setExpanded] = useState<Set<number | null>>(new Set())

    useEffect(() => {
        let alive = true
        setLoading(true)
        erpFetch(`inventory/products/?country_of_origin=${country.country}&page_size=1000`)
            .then(res => {
                if (!alive) return
                const list: Product[] = Array.isArray(res) ? res : (res?.results ?? [])
                setProducts(list)
                setGroups(groupByBrandAndVariant(list))
            })
            .catch(() => { if (alive) { setProducts([]); setGroups([]) } })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [country.country])

    const toggle = (bid: number | null) => setExpanded(p => {
        const n = new Set(p); n.has(bid) ? n.delete(bid) : n.add(bid); return n
    })

    return (
        <div className="rounded-xl p-3"
            style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
            <div className="flex items-center gap-4 mb-2 text-tp-xxs">
                <div className="flex items-center gap-1.5">
                    <Tag size={11} style={{ color: 'var(--app-info)' }} />
                    <span className="font-bold text-app-muted-foreground">Brands:</span>
                    <span className="font-black text-app-foreground tabular-nums">{groups.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Package size={11} style={{ color: 'var(--app-success)' }} />
                    <span className="font-bold text-app-muted-foreground">SKUs:</span>
                    <span className="font-black text-app-foreground tabular-nums">{products.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Boxes size={11} style={{ color: 'var(--app-warning)' }} />
                    <span className="font-bold text-app-muted-foreground">Variants:</span>
                    <span className="font-black text-app-foreground tabular-nums">
                        {groups.reduce((s, g) => s + g.variants.length, 0)}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="py-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-app-info/30 border-t-app-info" />
                </div>
            ) : groups.length === 0 ? (
                <div className="py-5 text-center">
                    <Package size={20} className="mx-auto mb-1.5 text-app-muted-foreground opacity-40" />
                    <p className="text-tp-sm font-bold text-app-muted-foreground">No products sourced from here yet</p>
                    <p className="text-tp-xxs text-app-muted-foreground mt-0.5">Set a product's "Country of Origin" to link it here.</p>
                </div>
            ) : (
                <div className="space-y-1.5 mt-1">
                    {groups.map(g => (
                        <BrandGroupCard
                            key={g.brand_id ?? 'none'}
                            group={g}
                            open={expanded.has(g.brand_id)}
                            onToggle={() => toggle(g.brand_id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function BrandGroupCard({ group, open, onToggle }: { group: BrandGroup; open: boolean; onToggle: () => void }) {
    return (
        <div className="rounded-lg overflow-hidden transition-all"
            style={{ background: 'var(--app-surface)', border: `1px solid ${open ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}` }}>
            <div className="px-2.5 py-2 flex items-center justify-between cursor-pointer hover:bg-app-surface-hover transition-colors"
                onClick={onToggle}
                style={{ borderBottom: open ? '1px solid var(--app-border)' : 'none' }}>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <ChevronRight size={12} className="text-app-muted-foreground transition-transform flex-shrink-0"
                        style={{ transform: open ? 'rotate(90deg)' : '' }} />
                    <Tag size={11} style={{ color: 'var(--app-primary)' }} />
                    <span className="text-tp-sm font-bold text-app-foreground truncate">{group.brand_name}</span>
                    <span className="px-1.5 py-0.5 rounded text-tp-xxs font-black tabular-nums"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {group.total_products}
                    </span>
                </div>
                <span className="text-tp-xxs font-bold text-app-muted-foreground flex-shrink-0">
                    {group.variants.length} variant{group.variants.length !== 1 ? 's' : ''}
                </span>
            </div>
            {open && (
                <div className="px-2.5 py-2 space-y-0.5">
                    <div className="grid grid-cols-12 gap-2 px-1.5 py-1 text-tp-xxs font-black uppercase tracking-wider text-app-muted-foreground"
                        style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="col-span-5">Parfum</div>
                        <div className="col-span-3">Size</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-right">Sample</div>
                    </div>
                    {group.variants.map((v, i) => (
                        <div key={i}
                            className="grid grid-cols-12 gap-2 px-1.5 py-1.5 rounded hover:bg-app-surface-hover transition-colors"
                            style={{ borderLeft: `3px solid ${parfumColor(v.parfum_name)}` }}>
                            <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: parfumColor(v.parfum_name) }} />
                                <span className="text-tp-sm font-bold text-app-foreground truncate">{v.parfum_name}</span>
                            </div>
                            <div className="col-span-3 flex items-center">
                                <span className="text-tp-xxs font-mono text-app-muted-foreground truncate">{v.size_label}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-center">
                                <span className="px-2 py-0.5 rounded-full text-tp-xxs font-black tabular-nums"
                                    style={{ background: `color-mix(in srgb, ${parfumColor(v.parfum_name)} 15%, transparent)`, color: parfumColor(v.parfum_name) }}>
                                    {v.count}
                                </span>
                            </div>
                            <div className="col-span-2 flex items-center justify-end">
                                <span className="text-tp-xxs font-mono text-app-muted-foreground truncate" title={v.products.map(p => p.sku).join(', ')}>
                                    {v.products[0]?.sku || '—'}
                                    {v.count > 1 && <span className="ml-1 opacity-60">+{v.count - 1}</span>}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/* ─── Brand→Parfum/Size grouping (ported from SourcingCountriesClient) ─── */
function groupByBrandAndVariant(products: Product[]): BrandGroup[] {
    const byBrand = new Map<number | null, Product[]>()
    for (const p of products) {
        const k = p.brand ?? null
        if (!byBrand.has(k)) byBrand.set(k, [])
        byBrand.get(k)!.push(p)
    }
    const variantKey = (p: Product) => {
        const pk = p.parfum ?? 'none'
        const sk = p.size != null ? `${p.size}-${p.size_unit || 'u'}` : 'none'
        return `${pk}:${sk}`
    }
    const sizeLabel = (p: Product) => {
        if (p.size == null) return 'Standard'
        const val = Number(p.size)
        const unit = p.size_unit || 'unit'
        if (unit === 'ml' || unit === 'g') {
            if (val < 300) return `Small (${val}${unit})`
            if (val < 600) return `Medium (${val}${unit})`
            return `Large (${val}${unit})`
        }
        return `${val}${unit}`
    }
    const groups: BrandGroup[] = []
    for (const [brandId, list] of byBrand) {
        const brandName = list[0]?.brand_name || (brandId ? `Brand #${brandId}` : 'No Brand')
        const byVariant = new Map<string, Product[]>()
        for (const p of list) {
            const k = variantKey(p)
            if (!byVariant.has(k)) byVariant.set(k, [])
            byVariant.get(k)!.push(p)
        }
        const variants: ProductVariant[] = []
        for (const [, vlist] of byVariant) {
            const first = vlist[0]
            variants.push({
                parfum_name: first.parfum_name || 'Original',
                size_label: sizeLabel(first),
                size_value: first.size != null ? Number(first.size) : null,
                count: vlist.length,
                products: vlist.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
            })
        }
        variants.sort((a, b) => {
            const p = a.parfum_name.localeCompare(b.parfum_name)
            if (p !== 0) return p
            if (a.size_value == null) return 1
            if (b.size_value == null) return -1
            return a.size_value - b.size_value
        })
        groups.push({ brand_id: brandId, brand_name: brandName, total_products: list.length, variants })
    }
    return groups.sort((a, b) => b.total_products - a.total_products)
}

function StatTile({ label, value, color, icon, mono }: { label: string; value: string; color: string; icon: ReactNode; mono?: boolean }) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
            style={{ background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{icon}</div>
            <div className="min-w-0">
                <div className={`text-sm font-bold ${mono ? 'font-mono' : ''} tabular-nums truncate`} style={{ color: 'var(--app-foreground)' }}>{value}</div>
                <div className="text-tp-xxs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>{label}</div>
            </div>
        </div>
    )
}

/* Utility: ISO-2 → emoji flag. Invalid / missing codes fall back to globe. */
function flagEmoji(iso2?: string | null): string {
    if (!iso2 || iso2.length !== 2) return '🌐'
    const A = 0x1f1e6
    const a = 'A'.charCodeAt(0)
    const chars = iso2.toUpperCase().split('').map(c => String.fromCodePoint(A + (c.charCodeAt(0) - a)))
    return chars.join('')
}
