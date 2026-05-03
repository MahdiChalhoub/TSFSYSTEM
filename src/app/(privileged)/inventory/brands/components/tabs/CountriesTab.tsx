'use client'

/**
 * Countries Tab — countries linked to a brand. Source is the union of:
 *   • brand.countries M2M (explicit "this brand operates in X" links)
 *   • product.country FK (countries the brand's products carry)
 * The tree on /inventory/brands counts both sources too, so this tab
 * mirrors that.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Globe, Loader2, Unlink, Flag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'

interface CountryRow { id: number; name: string; code?: string }

export function CountriesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [linked, setLinked] = useState<CountryRow[]>([])
    const [hasUniversal, setHasUniversal] = useState(false)
    const [allCountries, setAllCountries] = useState<CountryRow[]>([])
    const [m2mIds, setM2mIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        Promise.all([
            erpFetch(`inventory/brands/${brandId}/`),
            erpFetch('countries/'),
            erpFetch(`inventory/products/?brand=${brandId}&page_size=200`),
        ]).then(([brandData, countryData, prodData]: any[]) => {
            const all = Array.isArray(countryData?.results) ? countryData.results : (Array.isArray(countryData) ? countryData : [])
            const masterCountries: CountryRow[] = all.map((c: any) => ({ id: c.id, name: c.name, code: c.code }))
            const idToName = new Map<number, CountryRow>(masterCountries.map(c => [c.id, c]))
            setAllCountries(masterCountries)

            const m2mRaw = brandData?.countries
            const m2mIdsLocal: number[] = Array.isArray(m2mRaw)
                ? m2mRaw.map((c: any) => typeof c === 'number' ? c : c?.id).filter((n): n is number => typeof n === 'number')
                : []
            setM2mIds(new Set(m2mIdsLocal))

            const products = Array.isArray(prodData) ? prodData : (prodData?.results ?? [])
            const fromProducts = new Map<number, CountryRow>()
            products.forEach((p: any) => {
                if (p.country) {
                    const found = idToName.get(p.country)
                    fromProducts.set(p.country, {
                        id: p.country,
                        name: p.country_name || found?.name || `Country #${p.country}`,
                        code: p.country_code || found?.code,
                    })
                }
            })
            const universal = products.some((p: any) => !p.country)
            setHasUniversal(universal)

            const merged = new Map<number, CountryRow>()
            m2mIdsLocal.forEach(id => {
                const c = idToName.get(id)
                if (c) merged.set(id, c)
                else merged.set(id, { id, name: `Country #${id}` })
            })
            fromProducts.forEach((row, id) => { if (!merged.has(id)) merged.set(id, row) })

            setLinked([...merged.values()].sort((a, b) => a.name.localeCompare(b.name)))
        }).catch(() => {}).finally(() => setLoading(false))
    }, [brandId])

    useEffect(() => { loadData() }, [loadData])

    const unlinkedCountries = useMemo(
        () => allCountries.filter(c => !m2mIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
        [allCountries, m2mIds]
    )

    const linkCountry = async (countryId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ country_ids: [...Array.from(m2mIds), countryId] }),
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
            await erpFetch(`inventory/brands/${brandId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ country_ids: Array.from(m2mIds).filter(id => id !== countryId) }),
            })
            toast.success('Country unlinked')
            loadData(); router.refresh()
        } catch { toast.error('Failed to unlink') }
        finally { setLinking(false) }
    }

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
                            <div className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                    <Globe size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-md font-semibold truncate" style={{ color: 'var(--app-info)' }}>Universal</p>
                                    {/* Universal isn't a real M2M link — it's
                                        derived from products whose country FK
                                        is NULL. To remove it, those products
                                        need a country FK assigned (open the
                                        product, set Country, save). The chip
                                        will disappear automatically once no
                                        product is country-less. */}
                                    <p className="text-tp-xxs font-medium text-app-muted-foreground">
                                        Derived from products with no country FK. To remove this row,
                                        open each product and set its Country.
                                    </p>
                                </div>
                                <Link href={`/inventory/products/?brand=${brandId}&country=`}
                                    className="text-tp-xxs font-bold px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                                    style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                    Find products
                                </Link>
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
        </div>
    )
}
