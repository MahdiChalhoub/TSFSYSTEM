'use client'

/**
 * Attributes Tab — root attribute groups linked to a brand, with
 * Link / Unlink. Mirrors CategoriesTab / CountriesTab in structure
 * and uses the BrandViewSet.link_attribute / unlink_attribute
 * actions on the backend (those filter to parent__isnull=True so
 * leaf values get rejected — only root groups link).
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Tag, Loader2, Unlink, Sparkles, ChevronRight, ChevronDown, AlertTriangle, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

interface AttrGroup { id: number; name: string; code?: string }

interface ScopeValue {
    id: number
    name: string
    code?: string
    in_scope: boolean
    /** How many brands are currently scoped to this leaf. > 0 means
     *  the value is no longer universal — picking it for this brand
     *  doesn't change anything, but un-picking would not auto-restore
     *  universal access if other brands are still scoped to it. */
    scoped_to_count: number
}

export function AttributesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [linked, setLinked] = useState<AttrGroup[]>([])
    const [allAttrs, setAllAttrs] = useState<AttrGroup[]>([])
    // Root groups the brand's products actually use (via the
    // Product.attribute_values M2M reach-through). Populated by a
    // separate fast query so the user can see "Volume / Color are
    // used by your products but not yet linked at the brand" and
    // link them in one click.
    const [suggested, setSuggested] = useState<AttrGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    /** Expanded linked-root ids — only these have their children fetched + shown. */
    const [expanded, setExpanded] = useState<Set<number>>(new Set())
    /** Per-root cache: rootId → list of children with in_scope flags. Loaded on
     *  first expand so closed groups don't pay the round-trip. */
    const [valueScopes, setValueScopes] = useState<Map<number, ScopeValue[]>>(new Map())
    /** Per-root in-flight set so we show a small spinner while fetching. */
    const [scopeLoading, setScopeLoading] = useState<Set<number>>(new Set())
    /** Per-root saving flag so toggles can't race the POST. */
    const [scopeSaving, setScopeSaving] = useState<Set<number>>(new Set())
    /** Per-root: whether to also show the not-selected children + a checkbox
     *  to add them. Default off so the expanded view is a quick read of the
     *  current scope; users opt into the picker when they want to extend it. */
    const [showAvailable, setShowAvailable] = useState<Set<number>>(new Set())
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        // Two parallel calls:
        //   1. Brand record — gives the M2M-linked attribute groups.
        //   2. /inventory/product-attributes/?used_by_brand=<id> — root
        //      groups whose leaves the brand's products carry. The
        //      backend may or may not implement the filter; if not, we
        //      fall back to walking the products' attribute_value_names.
        //      For now we read the brand counts: any group in the
        //      product-derived set that's NOT already in M2M is shown
        //      as a "Suggested" pill with one-click link.
        Promise.all([
            erpFetch(`inventory/brands/${brandId}/`),
            // Backend computes the diff: root groups whose leaves are
            // used by this brand's products but are NOT in the brand's
            // M2M yet. Empty list = no suggestions.
            erpFetch(`inventory/brands/${brandId}/suggested_attribute_groups/`).catch(() => ({ results: [] })),
        ]).then(([brandData, suggestedRes]: any[]) => {
            const attrs = Array.isArray(brandData?.attributes) ? brandData.attributes : []
            const m2mLinked: AttrGroup[] = attrs
                .map((a: any) => ({
                    id: typeof a === 'number' ? a : a?.id,
                    name: typeof a === 'number' ? `Attribute #${a}` : (a?.name || `Attribute #${a?.id}`),
                    code: typeof a === 'number' ? undefined : a?.code,
                }))
                .filter((a: any) => Number.isFinite(a.id))
                .sort((a: any, b: any) => a.name.localeCompare(b.name))
            setLinked(m2mLinked)

            const sugRows: any[] = Array.isArray(suggestedRes?.results) ? suggestedRes.results : []
            setSuggested(
                sugRows.map((r: any) => ({ id: r.id, name: r.name, code: r.code }))
            )
        }).catch(() => {}).finally(() => setLoading(false))
    }, [brandId])

    useEffect(() => { loadData() }, [loadData])

    // Lazy-fetch the master attribute-group list only when the user
    // opens the Link picker. Filtered to roots (parent IS NULL) since
    // the link_attribute backend action only accepts roots.
    const ensureAllAttrs = useCallback(() => {
        if (allAttrs.length > 0) return
        erpFetch('inventory/product-attributes/')
            .then((res: any) => {
                const rows: any[] = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : [])
                setAllAttrs(
                    rows
                        .filter(r => r?.parent == null)
                        .map((r: any) => ({ id: r.id, name: r.name, code: r.code }))
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                )
            })
            .catch(() => {})
    }, [allAttrs.length])

    useEffect(() => { if (showLink) ensureAllAttrs() }, [showLink, ensureAllAttrs])

    const linkedIds = useMemo(() => new Set(linked.map(a => a.id)), [linked])
    const unlinked = useMemo(
        () => allAttrs.filter(a => !linkedIds.has(a.id)),
        [allAttrs, linkedIds]
    )

    const linkAttr = async (attrId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/link_attribute/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attribute_id: attrId }),
            })
            toast.success('Attribute group linked')
            loadData(); router.refresh()
            setShowLink(false)
        } catch { toast.error('Failed to link') }
        finally { setLinking(false) }
    }

    /* ── Per-child value scoping ──────────────────────────────────────
     *
     *  When a linked root is expanded for the first time, fetch its
     *  children + which ones currently have THIS brand in their
     *  scope_brands M2M. The toggle wires up to a bulk POST that
     *  re-syncs the brand's membership across all children of the root
     *  (idempotent — backend diffs current vs requested).
     */
    const fetchChildren = useCallback(async (rootId: number) => {
        setScopeLoading(prev => new Set(prev).add(rootId))
        try {
            const res: any = await erpFetch(
                `inventory/brands/${brandId}/attribute_value_scope/?parent_id=${rootId}`
            )
            const values: ScopeValue[] = Array.isArray(res?.values) ? res.values : []
            setValueScopes(prev => {
                const next = new Map(prev)
                next.set(rootId, values)
                return next
            })
        } catch {
            toast.error('Failed to load attribute values')
        } finally {
            setScopeLoading(prev => {
                const next = new Set(prev)
                next.delete(rootId)
                return next
            })
        }
    }, [brandId])

    const toggleExpand = useCallback((rootId: number) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(rootId)) {
                next.delete(rootId)
            } else {
                next.add(rootId)
                // Fetch on first expand only; cache hit = instant re-open.
                if (!valueScopes.has(rootId)) fetchChildren(rootId)
            }
            return next
        })
    }, [valueScopes, fetchChildren])

    const toggleShowAvailable = useCallback((rootId: number) => {
        setShowAvailable(prev => {
            const next = new Set(prev)
            if (next.has(rootId)) next.delete(rootId)
            else next.add(rootId)
            return next
        })
    }, [])

    const toggleChildScope = useCallback(async (rootId: number, childId: number) => {
        const current = valueScopes.get(rootId) || []
        const next = current.map(v => v.id === childId ? { ...v, in_scope: !v.in_scope } : v)
        // Optimistic update; revert on failure.
        setValueScopes(prev => {
            const m = new Map(prev)
            m.set(rootId, next)
            return m
        })
        setScopeSaving(prev => new Set(prev).add(rootId))
        try {
            const value_ids = next.filter(v => v.in_scope).map(v => v.id)
            await erpFetch(`inventory/brands/${brandId}/attribute_value_scope/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parent_id: rootId, value_ids }),
            })
            // Re-fetch to pick up updated scoped_to_count from the server
            // (since other rows may have changed if multiple users are editing).
            fetchChildren(rootId)
        } catch {
            toast.error('Failed to save scope')
            // Revert optimistic update
            setValueScopes(prev => {
                const m = new Map(prev)
                m.set(rootId, current)
                return m
            })
        } finally {
            setScopeSaving(prev => {
                const s = new Set(prev)
                s.delete(rootId)
                return s
            })
        }
    }, [valueScopes, brandId, fetchChildren])

    const unlinkAttr = async (attrId: number) => {
        // Lightweight confirm — Brand.attributes is a metadata link,
        // products keep their attribute_values M2M either way. Surface
        // that explicitly so the click feels reversible.
        const a = linked.find(x => x.id === attrId)
        const ok = window.confirm(
            `Unlink "${a?.name || 'this attribute group'}" from this brand?\n\n` +
            `Products keep their attribute values — only the explicit brand-attribute registration is removed.`
        )
        if (!ok) return

        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/unlink_attribute/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attribute_id: attrId }),
            })
            toast.success('Attribute group unlinked')
            loadData(); router.refresh()
        } catch { toast.error('Failed to unlink') }
        finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {loading ? 'Loading…' : `${linked.length} attribute group${linked.length === 1 ? '' : 's'} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors"
                    style={showLink
                        ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }
                        : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Link
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-success) 3%, var(--app-surface))' }}>
                    <p className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground mb-1.5">
                        Available ({unlinked.length})
                    </p>
                    {allAttrs.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground italic">Loading…</p>
                    ) : unlinked.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground">All attribute groups already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {unlinked.map(a => (
                                <button key={a.id} onClick={() => linkAttr(a.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-sm font-semibold px-2 py-1 rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-success) 8%, transparent)', color: 'var(--app-success)', border: '1px solid color-mix(in srgb, var(--app-success) 15%, transparent)' }}>
                                    <Plus size={10} />{a.name}
                                    {a.code && <span className="opacity-60 font-mono text-tp-xxs">{a.code}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Suggested — root groups the brand's products carry but
                aren't yet M2M-linked to the brand. One-click to link.
                Solves the case the user hit on Dolce Gabbana: products
                use Volume + Color leaves, but the brand had 0 M2M
                attributes, so the tab looked empty. Now those groups
                get a "+ Link" pill at the top. */}
            {suggested.length > 0 && (
                <div className="flex-shrink-0 mx-4 mt-2 mb-1 px-3 py-2 rounded-xl text-tp-xs"
                    style={{
                        background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)',
                    }}>
                    <p className="flex items-center gap-1.5 font-bold mb-1.5" style={{ color: 'var(--app-warning)' }}>
                        <Sparkles size={11} />
                        Suggested ({suggested.length})
                        <span className="font-medium opacity-70">— used by products, not yet linked</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {suggested.map(g => (
                            <button key={g.id} onClick={() => linkAttr(g.id)} disabled={linking}
                                className="flex items-center gap-1 text-tp-sm font-semibold px-2 py-1 rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                                <Plus size={10} />{g.name}
                                {g.code && <span className="opacity-60 font-mono text-tp-xxs">{g.code}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Why no leaf-value list — those live on Product.attribute_values
                and adding/removing them at the brand level doesn't make
                sense. The brand declares which DIMENSIONS apply (Volume,
                Parfum). Products carry the actual VALUES. */}
            <div className="flex-shrink-0 mx-4 mt-2 mb-1 px-3 py-2 rounded-xl text-tp-xs leading-snug flex items-start gap-2"
                style={{
                    background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)',
                    color: 'var(--app-info)',
                }}>
                <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                <span>
                    Linking attribute groups (Volume, Parfum, Concentration) declares which dimensions
                    apply to <strong>{brandName}</strong>&apos;s products. Leaf values (100ml, Floral, etc.)
                    are set on each product individually.
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-success)' }} />
                    </div>
                ) : linked.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">No attribute groups linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">
                            {brandName} hasn&apos;t been linked to any attribute group yet. Use <strong>Link</strong> above to add one.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linked.map(g => {
                            const isOpen = expanded.has(g.id)
                            const children = valueScopes.get(g.id)
                            const childLoading = scopeLoading.has(g.id)
                            const saving = scopeSaving.has(g.id)
                            const inScopeCount = (children || []).filter(c => c.in_scope).length
                            return (
                                <div key={g.id} className="group">
                                    {/* Root row — clickable chevron + tag + label + Unlink */}
                                    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-app-surface-hover">
                                        <button onClick={() => toggleExpand(g.id)} aria-label={isOpen ? 'Collapse' : 'Expand'}
                                            className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-app-surface"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                                color: 'var(--app-success)'
                                            }}>
                                            <Tag size={13} />
                                        </div>
                                        <button onClick={() => toggleExpand(g.id)} className="flex-1 min-w-0 text-left">
                                            <p className="text-tp-md font-semibold text-app-foreground truncate">{g.name}</p>
                                            {g.code && (
                                                <p className="text-tp-xxs font-mono text-app-muted-foreground mt-0.5">{g.code}</p>
                                            )}
                                        </button>
                                        {isOpen && children && (
                                            <span className="text-tp-xxs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                                                style={{
                                                    color: 'var(--app-success)',
                                                    background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                                                }}>
                                                {inScopeCount} / {children.length}
                                            </span>
                                        )}
                                        <button onClick={() => unlinkAttr(g.id)} disabled={linking}
                                            className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-50 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                            style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', minHeight: 32 }}>
                                            <Unlink size={11} />Unlink
                                        </button>
                                    </div>

                                    {/* Expanded children — selected-only by default; "Add value"
                                        toggle reveals unselected values with an inline picker. */}
                                    {isOpen && (
                                        <div className="pl-12 pr-4 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-150"
                                            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
                                            {childLoading && !children ? (
                                                <div className="flex items-center gap-2 py-2 text-tp-xs text-app-muted-foreground">
                                                    <Loader2 size={11} className="animate-spin" /> Loading values…
                                                </div>
                                            ) : children && children.length === 0 ? (
                                                <p className="text-tp-xs text-app-muted-foreground italic py-2">
                                                    No leaf values defined under this attribute group yet.
                                                </p>
                                            ) : children ? (() => {
                                                const selected = children.filter(c => c.in_scope)
                                                const available = children.filter(c => !c.in_scope)
                                                const showingAvail = showAvailable.has(g.id)
                                                return (
                                                    <>
                                                        {/* Selected — primary view, just shows what's scoped today */}
                                                        {selected.length === 0 ? (
                                                            <p className="text-tp-xs text-app-muted-foreground italic py-1">
                                                                No values scoped to <strong>{brandName}</strong> yet — every {g.name.toLowerCase()} value is universal.
                                                            </p>
                                                        ) : (
                                                            <div className="space-y-0.5">
                                                                {selected.map(v => (
                                                                    <div key={v.id}
                                                                        className="flex items-center gap-2 px-2 py-1 rounded-md group/v hover:bg-app-surface transition-colors">
                                                                        <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                                                                            style={{ background: 'var(--app-success)', color: 'white' }}>
                                                                            <Check size={9} strokeWidth={3} />
                                                                        </span>
                                                                        <span className="text-tp-sm font-medium text-app-foreground flex-1 truncate">{v.name}</span>
                                                                        {v.code && (
                                                                            <span className="text-tp-xxs font-mono text-app-muted-foreground">{v.code}</span>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleChildScope(g.id, v.id)}
                                                                            disabled={saving}
                                                                            title={`Remove ${v.name} from ${brandName}'s scope`}
                                                                            className="opacity-0 group-hover/v:opacity-100 transition-opacity p-0.5 rounded hover:bg-app-error/10 disabled:opacity-30"
                                                                            style={{ color: 'var(--app-error)' }}>
                                                                            <X size={11} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Available — opt-in picker */}
                                                        {available.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-app-border/40">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleShowAvailable(g.id)}
                                                                    className="flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-md transition-colors hover:bg-app-surface"
                                                                    style={{ color: 'var(--app-success)' }}>
                                                                    {showingAvail ? <ChevronDown size={11} /> : <Plus size={11} />}
                                                                    {showingAvail ? 'Hide available' : `Add value (${available.length} available)`}
                                                                </button>

                                                                {showingAvail && (
                                                                    <div className="mt-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                                                        <p className="text-tp-xxs text-app-muted-foreground px-2 mb-1 leading-snug">
                                                                            Pick a value to scope it to <strong>{brandName}</strong>.
                                                                            ⚠ icon = value is already scoped to other brands; adding here doesn&apos;t change that for them.
                                                                        </p>
                                                                        {available.map(v => {
                                                                            const exclusive = v.scoped_to_count > 0
                                                                            return (
                                                                                <label key={v.id}
                                                                                    className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-app-surface transition-colors">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={false}
                                                                                        disabled={saving}
                                                                                        onChange={() => toggleChildScope(g.id, v.id)}
                                                                                        className="w-3.5 h-3.5 cursor-pointer accent-app-success"
                                                                                    />
                                                                                    <span className="text-tp-sm font-medium text-app-muted-foreground flex-1 truncate">{v.name}</span>
                                                                                    {v.code && (
                                                                                        <span className="text-tp-xxs font-mono text-app-muted-foreground">{v.code}</span>
                                                                                    )}
                                                                                    {exclusive && (
                                                                                        <span title={`Currently scoped to ${v.scoped_to_count} other brand${v.scoped_to_count === 1 ? '' : 's'}`}
                                                                                            style={{ color: 'var(--app-warning)' }}>
                                                                                            <AlertTriangle size={11} />
                                                                                        </span>
                                                                                    )}
                                                                                </label>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )
                                            })() : null}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
