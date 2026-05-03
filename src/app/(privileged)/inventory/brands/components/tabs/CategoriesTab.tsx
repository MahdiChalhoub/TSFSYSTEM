'use client'

/**
 * Categories Tab — linked categories with link/unlink.
 * Shows which categories this brand is linked to and
 * allows pre-registration to additional categories.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, FolderTree, Loader2, Unlink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

interface CategoryRow { id: number; name: string }

export function CategoriesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [linkedCats, setLinkedCats] = useState<CategoryRow[]>([])
    const [allCats, setAllCats] = useState<CategoryRow[]>([])
    // M2M-linked ids tracked separately so rows derived purely from
    // products can hide their Unlink button (clicking Unlink would
    // PATCH a no-op against the M2M and the row would stay because
    // the product still has the category FK).
    const [m2mIds, setM2mIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        // Pull the M2M-linked categories AND every category that the
        // brand's products actually use. The user wants to see the
        // *real* categories the brand operates in — the M2M field is
        // rarely populated in this tenant; it's the products that carry
        // the category FK. Merge both into one display list, deduped.
        Promise.all([
            erpFetch(`inventory/brands/${brandId}/`),
            erpFetch('inventory/categories/'),
            erpFetch(`inventory/products/?brand=${brandId}&page_size=200`),
        ]).then(([brandData, catData, prodData]: any[]) => {
            // BrandSerializer returns `categories` as raw FK ids (numbers)
            // and parallel `category_names` strings. Build an id→name
            // lookup from the master list first so we can resolve either.
            const all = Array.isArray(catData?.results) ? catData.results : (Array.isArray(catData) ? catData : [])
            const masterCats: CategoryRow[] = all.map((c: any) => ({ id: c.id, name: c.name }))
            const idToName = new Map<number, string>(masterCats.map(c => [c.id, c.name]))
            setAllCats(masterCats)

            const m2mRaw = brandData?.categories
            const m2mIdsLocal: number[] = Array.isArray(m2mRaw)
                ? m2mRaw.map((c: any) => typeof c === 'number' ? c : c?.id).filter((n): n is number => typeof n === 'number')
                : []
            setM2mIds(new Set(m2mIdsLocal))

            const products = Array.isArray(prodData) ? prodData : (prodData?.results ?? [])
            const fromProducts = new Map<number, string>()
            products.forEach((p: any) => {
                if (p.category) fromProducts.set(p.category, p.category_name || idToName.get(p.category) || `Category #${p.category}`)
            })

            const merged = new Map<number, string>()
            m2mIdsLocal.forEach(id => {
                const name = idToName.get(id) || `Category #${id}`
                merged.set(id, name)
            })
            fromProducts.forEach((name, id) => { if (!merged.has(id)) merged.set(id, name) })

            setLinkedCats([...merged.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
        }).catch(() => {}).finally(() => setLoading(false))
    }, [brandId])

    useEffect(() => { loadData() }, [loadData])

    // The picker should offer every category not currently in the M2M
    // (even ones already inferred from products — re-adding via M2M is
    // a meaningful action that locks the link in place independent of
    // any specific product). Using m2mIds (not the merged linkedIds)
    // is the correct source of truth for "what's linked at the brand".
    const unlinkedCats = useMemo(
        () => allCats.filter(c => !m2mIds.has(c.id)),
        [allCats, m2mIds]
    )

    const linkCategory = async (catId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ category_ids: [...Array.from(m2mIds), catId] }),
            })
            toast.success('Category linked')
            loadData(); router.refresh()
            // Close the picker so the user immediately sees the result in
            // the linked list below — no second click needed.
            setShowLink(false)
        } catch { toast.error('Failed to link') }
        finally { setLinking(false) }
    }

    const unlinkCategory = async (catId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/brands/${brandId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ category_ids: Array.from(m2mIds).filter(id => id !== catId) }),
            })
            toast.success('Category unlinked')
            loadData(); router.refresh()
        } catch { toast.error('Failed to unlink') }
        finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedCats.length} categor${linkedCats.length !== 1 ? 'ies' : 'y'} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors"
                    style={showLink
                        ? { background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }
                        : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Link
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-info) 3%, var(--app-surface))' }}>
                    <p className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground mb-1.5">Available ({unlinkedCats.length})</p>
                    {unlinkedCats.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground">All categories linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedCats.map(c => (
                                <button key={c.id} onClick={() => linkCategory(c.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-sm font-semibold px-2 py-1 rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                                    <Plus size={10} />{c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-info)' }} /></div>
                ) : linkedCats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <FolderTree size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">No categories linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">
                            {brandName} has no products tied to a category yet. Use Link above to add one.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedCats.map(c => {
                            const isFromM2M = m2mIds.has(c.id)
                            return (
                                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                        <FolderTree size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-tp-md font-semibold text-app-foreground truncate">{c.name}</p>
                                        <p className="text-tp-xxs font-medium text-app-muted-foreground">
                                            {isFromM2M ? 'Linked via brand' : 'Inferred from product category'}
                                        </p>
                                    </div>
                                    {/* Unlink only renders for M2M-linked rows. Rows
                                        that are only here because a product carries
                                        the FK can't be removed via this PATCH — the
                                        product would need its category cleared. */}
                                    {isFromM2M && (
                                        <button onClick={() => unlinkCategory(c.id)} disabled={linking}
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
