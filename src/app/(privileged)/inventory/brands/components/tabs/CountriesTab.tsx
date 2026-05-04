'use client'

/**
 * Countries Tab — countries linked to a brand. Source is the union of:
 *   • brand.countries M2M (explicit "this brand operates in X" links)
 *   • product.country FK (countries the brand's products carry)
 * The tree on /inventory/brands counts both sources too, so this tab
 * mirrors that.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Globe, Loader2, Unlink, Flag, ArrowRightLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'

interface CountryRow { id: number; name: string; code?: string }
interface UniversalProduct { id: number; name: string }

export function CountriesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [linked, setLinked] = useState<CountryRow[]>([])
    const [hasUniversal, setHasUniversal] = useState(false)
    const [universalProducts, setUniversalProducts] = useState<UniversalProduct[]>([])
    const [allCountries, setAllCountries] = useState<CountryRow[]>([])
    const [m2mIds, setM2mIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [removeUniversalOpen, setRemoveUniversalOpen] = useState(false)
    const [universalTarget, setUniversalTarget] = useState<number | null>(null)
    const [universalSearch, setUniversalSearch] = useState('')
    const [removingUniversal, setRemovingUniversal] = useState(false)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        // Fast path: read M2M-linked countries straight from the brand
        // record (the detail serializer ships them as nested objects).
        // The previous implementation was 3 calls including a 200-row
        // products scan to derive "Inferred from product country" rows
        // and the Universal bucket — that scan was the slow part the
        // user kept hitting on big-catalogue brands.
        erpFetch(`inventory/brands/${brandId}/`)
            .then((brandData: any) => {
                const cs = Array.isArray(brandData?.countries) ? brandData.countries : []
                const m2mIdsLocal: number[] = cs
                    .map((c: any) => typeof c === 'number' ? c : c?.id)
                    .filter((n: any): n is number => typeof n === 'number')
                setM2mIds(new Set(m2mIdsLocal))
                setLinked(
                    cs
                        .map((c: any) => ({
                            id: typeof c === 'number' ? c : c?.id,
                            name: typeof c === 'number' ? `Country #${c}` : (c?.name || `Country #${c?.id}`),
                            code: typeof c === 'number' ? undefined : c?.code,
                        }))
                        .filter((c: any) => Number.isFinite(c.id))
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                )
            })
            .catch(() => {})
            .finally(() => setLoading(false))

        // Universal bucket detection — page_size=1 just to read the
        // `count` from the paginated response. We avoid pulling the
        // actual rows; the Remove-Universal modal does its own fetch
        // when opened (it needs the ids to PATCH). The "N products"
        // hint on the Universal row uses the count value.
        erpFetch(`inventory/products/?brand=${brandId}&country__isnull=true&page_size=1`)
            .then((res: any) => {
                const total = typeof res?.count === 'number' ? res.count : (Array.isArray(res) ? res.length : (res?.results?.length || 0))
                setHasUniversal(total > 0)
                setUniversalProducts(
                    total > 0
                        ? Array.from({ length: total }, (_, i) => ({ id: i, name: '' }))
                        : []
                )
            })
            .catch(() => {
                setHasUniversal(false)
                setUniversalProducts([])
            })
    }, [brandId])

    useEffect(() => { loadData() }, [loadData])

    // Lazy-fetch the master countries list — only when the user is
    // about to need it (Link picker or Remove-Universal modal). Saves
    // a 250-row fetch on every tab open.
    const ensureAllCountries = useCallback(() => {
        if (allCountries.length > 0) return
        erpFetch('countries/')
            .then((countryData: any) => {
                const all = Array.isArray(countryData?.results) ? countryData.results : (Array.isArray(countryData) ? countryData : [])
                setAllCountries(all.map((c: any) => ({ id: c.id, name: c.name, code: c.code })))
            })
            .catch(() => {})
    }, [allCountries.length])

    useEffect(() => {
        if (showLink || removeUniversalOpen) ensureAllCountries()
    }, [showLink, removeUniversalOpen, ensureAllCountries])

    const unlinkedCountries = useMemo(
        () => allCountries.filter(c => !m2mIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
        [allCountries, m2mIds]
    )

    // Same dedicated-endpoint pattern as CategoriesTab — PATCH on
    // country_ids was silently dropped (read_only `countries` shadowing
    // the write_only `country_ids` source alias). link_country /
    // unlink_country actions on BrandViewSet call
    // brand.countries.add() / .remove() directly.
    const linkCountry = async (countryId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/link_country/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country_id: countryId }),
            })
            toast.success('Country linked')
            loadData(); router.refresh()
            setShowLink(false)
        } catch { toast.error('Failed to link') }
        finally { setLinking(false) }
    }

    const unlinkCountry = async (countryId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/unlink_country/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country_id: countryId }),
            })
            toast.success('Country unlinked')
            loadData(); router.refresh()
        } catch { toast.error('Failed to unlink') }
        finally { setLinking(false) }
    }

    /** Remove the Universal status: assign every country-less product
     *  of this brand to the picked country, in parallel PATCHes. The
     *  Universal row vanishes once no product has country=null. */
    const removeUniversal = async () => {
        if (universalTarget == null || universalProducts.length === 0) return
        setRemovingUniversal(true)
        try {
            // The fast initial load only knows the COUNT of universal
            // products (via page_size=1). Now that the user has
            // committed to a country, fetch the real ids before
            // PATCHing. We page through all universal products with a
            // higher page_size to keep the round-trip count down.
            const ids: number[] = []
            let page = 1
            const pageSize = 200
            // Bound the loop — should never exceed 100k/200 = 500 pages
            // even for absurd catalogues, but we cap at 1k iterations
            // as a safety belt against an infinite next-link loop.
            for (let i = 0; i < 1000; i++) {
                const res: any = await erpFetch(
                    `inventory/products/?brand=${brandId}&country__isnull=true&page=${page}&page_size=${pageSize}&fields=id`
                )
                const items = Array.isArray(res) ? res : (res?.results ?? [])
                items.forEach((p: any) => { if (Number.isFinite(p?.id)) ids.push(p.id) })
                if (!res?.next) break
                page += 1
            }

            // Run all PATCHes in parallel — settles even if some fail
            // so the user gets partial-success feedback.
            const results = await Promise.allSettled(
                ids.map(id =>
                    erpFetch(`inventory/products/${id}/`, {
                        method: 'PATCH',
                        body: JSON.stringify({ country: universalTarget }),
                    })
                )
            )
            const ok = results.filter(r => r.status === 'fulfilled').length
            const failed = results.length - ok
            if (failed > 0) {
                toast.warning(`${ok} updated, ${failed} failed`)
            } else {
                toast.success(`${ok} product${ok === 1 ? '' : 's'} assigned to country`)
            }
            setRemoveUniversalOpen(false)
            setUniversalTarget(null)
            setUniversalSearch('')
            loadData()
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update products')
        } finally {
            setRemovingUniversal(false)
        }
    }

    const universalTargetCountries = useMemo(() => {
        const q = universalSearch.trim().toLowerCase()
        return q ? allCountries.filter(c => c.name.toLowerCase().includes(q)) : allCountries
    }, [allCountries, universalSearch])

    const flagFor = (code?: string) => {
        if (!code) return null
        return code.toUpperCase().split('').map((c) =>
            String.fromCodePoint(0x1F1E6 + (c.charCodeAt(0) - 65))
        ).join('')
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linked.length} countr${linked.length === 1 ? 'y' : 'ies'} linked${hasUniversal ? ' + Universal' : ''}`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors"
                    style={showLink
                        ? { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }
                        : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Link
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning) 3%, var(--app-surface))' }}>
                    <p className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground mb-1.5">Available ({unlinkedCountries.length})</p>
                    {unlinkedCountries.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground">All countries linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {unlinkedCountries.map(c => (
                                <button key={c.id} onClick={() => linkCountry(c.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-sm font-semibold px-2 py-1 rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                                    <Plus size={10} />
                                    {c.code && <span className="text-sm">{flagFor(c.code)}</span>}
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-warning)' }} /></div>
                ) : linked.length === 0 && !hasUniversal ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Globe size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">No countries linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">{brandName} has no products tied to a country yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {hasUniversal && (
                            <div className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                    <Globe size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-md font-semibold truncate" style={{ color: 'var(--app-info)' }}>Universal</p>
                                    <p className="text-tp-xxs font-medium text-app-muted-foreground">
                                        {universalProducts.length} product{universalProducts.length === 1 ? '' : 's'} with no country —
                                        click <strong>Assign to country</strong> to put them all under one.
                                    </p>
                                </div>
                                <button onClick={() => setRemoveUniversalOpen(true)} disabled={removingUniversal}
                                    className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)', minHeight: 32 }}
                                    title="Bulk-assign all country-less products to a country, removing the Universal row">
                                    <ArrowRightLeft size={11} />Assign to country
                                </button>
                            </div>
                        )}
                        {linked.map(c => {
                            const isFromM2M = m2mIds.has(c.id)
                            return (
                                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                        {c.code ? <span className="text-sm">{flagFor(c.code)}</span> : <Flag size={13} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-tp-md font-semibold text-app-foreground truncate">{c.name}</p>
                                        <p className="text-tp-xxs font-medium text-app-muted-foreground">
                                            {isFromM2M ? 'Linked via brand' : 'Inferred from product country'}
                                        </p>
                                    </div>
                                    {isFromM2M && (
                                        <button onClick={() => unlinkCountry(c.id)} disabled={linking}
                                            className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-50 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                            style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', minHeight: 32 }}>
                                            <Unlink size={11} />Unlink
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Remove-Universal modal — picks a country and bulk-PATCHes
                every country-less product of this brand to it. */}
            {removeUniversalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
                    onClick={() => setRemoveUniversalOpen(false)}>
                    <div onClick={e => e.stopPropagation()}
                        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', maxHeight: '80vh' }}>
                        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <Globe size={14} style={{ color: 'var(--app-info)' }} />
                            <h3 className="flex-1 text-tp-md font-bold text-app-foreground">Remove Universal</h3>
                            <button onClick={() => setRemoveUniversalOpen(false)}
                                className="p-1 rounded hover:bg-app-border/40 text-app-muted-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="px-4 py-3 flex-1 overflow-y-auto custom-scrollbar">
                            <p className="text-tp-xs font-medium text-app-muted-foreground mb-3">
                                Pick a country. {universalProducts.length} product{universalProducts.length === 1 ? '' : 's'} of <strong>{brandName}</strong> currently
                                have no country and will be assigned to it.
                            </p>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <Globe size={11} className="text-app-muted-foreground" />
                                <input
                                    value={universalSearch}
                                    onChange={e => setUniversalSearch(e.target.value)}
                                    placeholder="Search countries…"
                                    className="text-tp-sm bg-transparent outline-none flex-1 text-app-foreground"
                                />
                            </div>
                            <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                                {universalTargetCountries.map(c => {
                                    const active = universalTarget === c.id
                                    return (
                                        <button key={c.id} type="button" onClick={() => setUniversalTarget(c.id)}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                                            style={{
                                                background: active ? 'color-mix(in srgb, var(--app-info) 10%, transparent)' : 'transparent',
                                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-info) 35%, transparent)' : 'transparent'}`,
                                            }}>
                                            <span className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                                                style={{
                                                    borderColor: active ? 'var(--app-info)' : 'var(--app-border)',
                                                    background: active ? 'var(--app-info)' : 'transparent',
                                                }} />
                                            {c.code && <span className="text-sm">{flagFor(c.code)}</span>}
                                            <span className="text-tp-sm font-bold text-app-foreground">{c.name}</span>
                                        </button>
                                    )
                                })}
                                {universalTargetCountries.length === 0 && (
                                    <p className="text-tp-xs text-app-muted-foreground italic px-2 py-2">
                                        No country matches “{universalSearch}”.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 flex items-center gap-2"
                            style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                            <button onClick={() => setRemoveUniversalOpen(false)} disabled={removingUniversal}
                                className="flex-1 px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                                style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                Cancel
                            </button>
                            <button onClick={removeUniversal} disabled={universalTarget == null || removingUniversal}
                                className="flex-1 px-4 py-2 rounded-xl text-tp-xs font-bold text-white transition-all disabled:opacity-50 hover:brightness-110 flex items-center justify-center gap-2"
                                style={{ background: 'var(--app-info)' }}>
                                {removingUniversal ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                                Assign {universalProducts.length} product{universalProducts.length === 1 ? '' : 's'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
