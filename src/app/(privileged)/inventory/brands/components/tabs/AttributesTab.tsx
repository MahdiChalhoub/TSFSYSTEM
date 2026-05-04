'use client'

/**
 * Attributes Tab — root attribute groups linked to a brand, with
 * Link / Unlink. Mirrors CategoriesTab / CountriesTab in structure
 * and uses the BrandViewSet.link_attribute / unlink_attribute
 * actions on the backend (those filter to parent__isnull=True so
 * leaf values get rejected — only root groups link).
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Tag, Loader2, Unlink, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

interface AttrGroup { id: number; name: string; code?: string }

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
                        {linked.map(g => (
                            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                        color: 'var(--app-success)'
                                    }}>
                                    <Tag size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-md font-semibold text-app-foreground truncate">{g.name}</p>
                                    {g.code && (
                                        <p className="text-tp-xxs font-mono text-app-muted-foreground mt-0.5">{g.code}</p>
                                    )}
                                </div>
                                <button onClick={() => unlinkAttr(g.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-50 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                    style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', minHeight: 32 }}>
                                    <Unlink size={11} />Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
