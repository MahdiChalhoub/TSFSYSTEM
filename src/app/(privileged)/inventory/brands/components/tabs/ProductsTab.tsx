'use client'

/**
 * Products Tab — products of a brand, with search, sort, multi-select
 * and bulk Move-to-Brand. Mirrors the feature set of the equivalent
 * tab on /inventory/categories so the brand side-panel feels just as
 * powerful.
 *
 * Move action posts to inventory/brands/move_products/ — the same
 * endpoint the row-level delete-conflict flow uses.
 */

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Loader2, Package, ExternalLink, Search, Check, ArrowUpDown, ArrowRightLeft, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

interface Product {
    id: number
    name: string
    sku?: string
    barcode?: string
    category_name?: string
    selling_price_ttc?: number | null
    on_hand_qty?: number | null
    [key: string]: unknown
}

type SortBy = 'name' | 'sku' | 'price'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

const ORDERING: Record<SortBy, string> = {
    name: 'name',
    sku: 'sku',
    price: 'selling_price_ttc',
}

export function ProductsTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [products, setProducts] = useState<Product[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [nextPage, setNextPage] = useState<number | null>(2)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortBy, setSortBy] = useState<SortBy>('name')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [moveOpen, setMoveOpen] = useState(false)
    const [allBrands, setAllBrands] = useState<Array<{ id: number; name: string }>>([])
    const [moveTarget, setMoveTarget] = useState<number | 'unbranded' | null>(null)
    const [moveTargetSearch, setMoveTargetSearch] = useState('')
    const [moveScope, setMoveScope] = useState<'selected' | 'all'>('selected')
    const [moving, setMoving] = useState(false)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    // Debounce search 250ms — keeps the input snappy without firing a
    // network call on every keystroke. The debounce target drives the
    // server filter, so changing it resets pagination via the effect
    // below.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 250)
        return () => clearTimeout(t)
    }, [search])

    /** Fetch one page from the products endpoint with server-side
     *  filter + sort. The previous implementation pulled page_size=200
     *  in one shot and stopped — silently truncating any brand with
     *  more products than that. With server-side pagination we walk
     *  through all pages on demand, kicked off by the IntersectionObserver
     *  below.
     */
    const loadPage = useCallback(async (page: number, append: boolean) => {
        if (append) setLoadingMore(true)
        else setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('brand', String(brandId))
            params.set('page', String(page))
            params.set('page_size', String(PAGE_SIZE))
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
            const ordering = `${sortDir === 'desc' ? '-' : ''}${ORDERING[sortBy]}`
            params.set('ordering', ordering)
            const res: any = await erpFetch(`inventory/products/?${params}`)
            const items: Product[] = Array.isArray(res) ? res : (res?.results ?? [])
            // DRF PageNumberPagination wraps the page in
            // { count, next, previous, results }. `next` is a URL when
            // there's a further page, null otherwise. Translate to a
            // page number so we don't have to thread an absolute URL.
            const hasMore = !!res?.next
            setProducts(prev => append ? [...prev, ...items] : items)
            setTotalCount(typeof res?.count === 'number' ? res.count : items.length)
            setNextPage(hasMore ? page + 1 : null)
        } catch {
            if (!append) {
                setProducts([])
                setTotalCount(0)
            }
            setNextPage(null)
        } finally {
            if (append) setLoadingMore(false)
            else setLoading(false)
        }
    }, [brandId, debouncedSearch, sortBy, sortDir])

    // Reset to page 1 on filter / sort / brand change. Selected state
    // stays — the user might want to keep their cherry-picks across
    // a search refinement.
    useEffect(() => { loadPage(1, false) }, [loadPage])

    // IntersectionObserver — fetches the next page when the sentinel
    // enters the viewport. rootMargin of 200px primes the next batch
    // before the user actually hits the bottom.
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel || nextPage === null || loading || loadingMore) return
        const obs = new IntersectionObserver(entries => {
            const [entry] = entries
            if (entry.isIntersecting && nextPage !== null && !loadingMore) {
                loadPage(nextPage, true)
            }
        }, { rootMargin: '200px', threshold: 0 })
        obs.observe(sentinel)
        return () => obs.disconnect()
    }, [nextPage, loading, loadingMore, loadPage])

    // Lazy fetch the brand list when the move modal opens.
    useEffect(() => {
        if (!moveOpen || allBrands.length > 0) return
        erpFetch('inventory/brands/?page_size=300')
            .then((res: any) => {
                const items = Array.isArray(res) ? res : (res?.results ?? [])
                setAllBrands(items.map((b: any) => ({ id: b.id, name: b.name })))
            })
            .catch(() => setAllBrands([]))
    }, [moveOpen, allBrands.length])

    // Filter + sort happen server-side now, so the visible list is
    // just `products`. Keeping the variable name for a small diff
    // against the existing render.
    const filteredSorted = products

    const toggle = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        // "Select all" only ever covers the currently-loaded rows
        // because that's what the user can see. If they want to act
        // on the whole brand they should pick "Move ALL N" in the
        // bulk modal — that omits product_ids and lets the backend
        // resolve everything in one transaction.
        if (selected.size === filteredSorted.length) setSelected(new Set())
        else setSelected(new Set(filteredSorted.map(p => p.id)))
    }

    const cycleSort = (col: SortBy) => {
        if (sortBy !== col) { setSortBy(col); setSortDir('asc'); return }
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    }

    const moveTargets = useMemo(() => {
        const q = moveTargetSearch.trim().toLowerCase()
        const list = allBrands.filter(b => b.id !== brandId)
        if (!q) return list
        return list.filter(b => b.name.toLowerCase().includes(q))
    }, [allBrands, brandId, moveTargetSearch])

    const performMove = async () => {
        if (moveTarget == null) return
        setMoving(true)
        try {
            // Two scopes:
            //   selected → only the cherry-picked product_ids
            //   all      → omit product_ids; backend moves every
            //              product currently linked to the source brand
            const body: Record<string, unknown> = {
                source_brand_id: brandId,
                target_brand_id: moveTarget === 'unbranded' ? null : moveTarget,
            }
            if (moveScope === 'selected') {
                body.product_ids = Array.from(selected)
            }
            await erpFetch('inventory/brands/move_products/', {
                method: 'POST',
                body: JSON.stringify(body),
            })
            const movedCount = moveScope === 'all' ? totalCount : selected.size
            toast.success(`${movedCount} product${movedCount === 1 ? '' : 's'} moved`)
            setSelected(new Set())
            setMoveOpen(false)
            setMoveTarget(null)
            setMoveTargetSearch('')
            setMoveScope('selected')
            loadPage(1, false)
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to move products')
        } finally {
            setMoving(false)
        }
    }

    if (loading && products.length === 0) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-success)' }} />
            </div>
        )
    }

    const allChecked = filteredSorted.length > 0 && selected.size === filteredSorted.length

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Header — count + search */}
            <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground flex-shrink-0">
                    {filteredSorted.length === totalCount
                        ? `${totalCount} product${totalCount === 1 ? '' : 's'}`
                        : `${filteredSorted.length} of ${totalCount} product${totalCount === 1 ? '' : 's'} loaded`}
                </p>
                <div className="flex-1" />
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                    <Search size={11} className="text-app-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="text-tp-xs bg-transparent outline-none w-32 text-app-foreground placeholder:text-app-muted-foreground/50"
                    />
                </div>
            </div>

            {/* Sort row */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-1.5"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, transparent)' }}>
                {(['name', 'sku', 'price'] as SortBy[]).map(col => {
                    const active = sortBy === col
                    return (
                        <button key={col} type="button" onClick={() => cycleSort(col)}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-2 py-1 rounded transition-colors"
                            style={{
                                color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                background: active ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'transparent',
                            }}>
                            {col}
                            {active && <ArrowUpDown size={9} style={{ transform: sortDir === 'desc' ? 'scaleY(-1)' : undefined }} />}
                        </button>
                    )
                })}
            </div>

            {/* Bulk action bar — visible when at least one is selected */}
            {selected.size > 0 && (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 animate-in slide-in-from-top-1 duration-150"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                    <span className="text-tp-sm font-bold" style={{ color: 'var(--app-primary)' }}>
                        {selected.size} selected
                    </span>
                    <div className="flex-1" />
                    <button onClick={() => setMoveOpen(true)}
                        className="flex items-center gap-1 text-tp-xs font-bold px-2.5 py-1 rounded-lg transition-all hover:brightness-110"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        <ArrowRightLeft size={11} /> Move to brand
                    </button>
                    <button onClick={() => setSelected(new Set())}
                        className="text-tp-xs font-bold px-2 py-1 rounded-lg text-app-muted-foreground hover:bg-app-surface transition-colors">
                        Clear
                    </button>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredSorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">
                            {search ? 'No matching products' : `No products under "${brandName}"`}
                        </p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">
                            {search ? 'Try a different filter' : 'Products will appear when assigned to this brand.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Select-all header */}
                        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-1.5"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)', borderBottom: '1px solid var(--app-border)', backdropFilter: 'blur(4px)' }}>
                            <button type="button" onClick={toggleAll}
                                className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                                style={{
                                    borderColor: allChecked ? 'var(--app-primary)' : 'var(--app-border)',
                                    background: allChecked ? 'var(--app-primary)' : 'transparent',
                                }}
                                aria-checked={allChecked}
                                role="checkbox">
                                {allChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                            </button>
                            <span className="text-tp-xxs font-black uppercase tracking-widest text-app-muted-foreground">
                                Select all
                            </span>
                        </div>

                        <div className="divide-y divide-app-border/30">
                            {filteredSorted.map(p => {
                                const isChecked = selected.has(p.id)
                                return (
                                    /* Browser-native virtualization:
                                       content-visibility:auto skips
                                       layout/paint of off-screen rows,
                                       contain-intrinsic-size reserves
                                       the right height (52px ≈ row
                                       padding + content) so the
                                       scrollbar stays accurate. Zero
                                       deps; handles a few thousand
                                       rows comfortably. For 10k+ a
                                       react-window pass would still
                                       be needed. */
                                    <div key={p.id}
                                        className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover"
                                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); toggle(p.id) }}
                                            className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                                            style={{
                                                borderColor: isChecked ? 'var(--app-primary)' : 'var(--app-border)',
                                                background: isChecked ? 'var(--app-primary)' : 'transparent',
                                            }}
                                            aria-checked={isChecked}
                                            role="checkbox">
                                            {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                        </button>

                                        <Link href={`/inventory/products/${p.id}`}
                                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                                <Package size={13} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-tp-md font-semibold text-app-foreground truncate">{p.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {p.sku && (
                                                        <span className="font-mono text-tp-xxs font-bold text-app-muted-foreground">{p.sku}</span>
                                                    )}
                                                    {p.category_name && (
                                                        <span className="text-tp-xxs text-app-muted-foreground">· {p.category_name}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {p.selling_price_ttc != null && (
                                                <span className="text-tp-xs font-bold tabular-nums flex-shrink-0"
                                                    style={{ color: 'var(--app-foreground)' }}>
                                                    {Number(p.selling_price_ttc).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </span>
                                            )}
                                            <ExternalLink size={11} className="text-app-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                        </Link>
                                    </div>
                                )
                            })}
                        </div>

                        {/* IntersectionObserver sentinel — when this slides
                            into the viewport (with a 200px head start),
                            the next page loads automatically. The status
                            row below it tells the user what's happening
                            so an infinite list with a long-running fetch
                            doesn't feel broken. */}
                        {nextPage !== null && (
                            <div ref={sentinelRef} className="px-4 py-4 flex items-center justify-center text-tp-xs text-app-muted-foreground">
                                {loadingMore ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 size={12} className="animate-spin" />
                                        Loading more…
                                    </span>
                                ) : (
                                    <span>Scroll for more · {filteredSorted.length} of {totalCount}</span>
                                )}
                            </div>
                        )}
                        {nextPage === null && filteredSorted.length > 0 && filteredSorted.length === totalCount && totalCount > PAGE_SIZE && (
                            <p className="px-4 py-3 text-tp-xxs text-center italic text-app-muted-foreground">
                                End of list — all {totalCount} products shown.
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Move-to-Brand modal */}
            {moveOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
                    onClick={() => setMoveOpen(false)}>
                    <div onClick={e => e.stopPropagation()}
                        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', maxHeight: '80vh' }}>
                        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <ArrowRightLeft size={14} style={{ color: 'var(--app-primary)' }} />
                            <h3 className="flex-1 text-tp-md font-bold text-app-foreground">
                                Move products
                            </h3>
                            <button onClick={() => setMoveOpen(false)}
                                className="p-1 rounded hover:bg-app-border/40 text-app-muted-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="px-4 py-3 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Scope picker — guards against the "I selected
                                visible rows but the brand actually has way
                                more" footgun. ALL talks to the backend
                                without product_ids so the move covers
                                every row regardless of what's loaded. */}
                            <div className="mb-3 p-1 rounded-xl flex"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <button type="button" onClick={() => setMoveScope('selected')}
                                    disabled={selected.size === 0}
                                    className="flex-1 px-2.5 py-1.5 rounded-lg text-tp-xs font-bold transition-all disabled:opacity-40"
                                    style={{
                                        background: moveScope === 'selected' ? 'var(--app-surface)' : 'transparent',
                                        color: moveScope === 'selected' ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        boxShadow: moveScope === 'selected' ? '0 1px 2px color-mix(in srgb, var(--app-foreground) 10%, transparent)' : 'none',
                                    }}>
                                    {selected.size} selected
                                </button>
                                <button type="button" onClick={() => setMoveScope('all')}
                                    className="flex-1 px-2.5 py-1.5 rounded-lg text-tp-xs font-bold transition-all"
                                    style={{
                                        background: moveScope === 'all' ? 'var(--app-surface)' : 'transparent',
                                        color: moveScope === 'all' ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        boxShadow: moveScope === 'all' ? '0 1px 2px color-mix(in srgb, var(--app-foreground) 10%, transparent)' : 'none',
                                    }}>
                                    All {totalCount} in brand
                                </button>
                            </div>
                            <p className="text-tp-xs font-medium text-app-muted-foreground mb-2">
                                {moveScope === 'all'
                                    ? <>Move <strong>every</strong> product currently in <strong>{brandName}</strong> to:</>
                                    : <>Move the <strong>{selected.size}</strong> selected product{selected.size === 1 ? '' : 's'} from <strong>{brandName}</strong> to:</>}
                            </p>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <Search size={11} className="text-app-muted-foreground" />
                                <input
                                    value={moveTargetSearch}
                                    onChange={e => setMoveTargetSearch(e.target.value)}
                                    placeholder="Search brands…"
                                    className="text-tp-sm bg-transparent outline-none flex-1 text-app-foreground"
                                />
                            </div>
                            <div className="space-y-1">
                                <button type="button" onClick={() => setMoveTarget('unbranded')}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                                    style={{
                                        background: moveTarget === 'unbranded' ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                        border: `1px solid ${moveTarget === 'unbranded' ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'transparent'}`,
                                    }}>
                                    <span className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                                        style={{
                                            borderColor: moveTarget === 'unbranded' ? 'var(--app-primary)' : 'var(--app-border)',
                                            background: moveTarget === 'unbranded' ? 'var(--app-primary)' : 'transparent',
                                        }} />
                                    <span className="text-tp-sm font-bold italic text-app-muted-foreground">Unbranded (no brand)</span>
                                </button>
                                {moveTargets.map(b => {
                                    const active = moveTarget === b.id
                                    return (
                                        <button key={b.id} type="button" onClick={() => setMoveTarget(b.id)}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                                            style={{
                                                background: active ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'transparent'}`,
                                            }}>
                                            <span className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                                                style={{
                                                    borderColor: active ? 'var(--app-primary)' : 'var(--app-border)',
                                                    background: active ? 'var(--app-primary)' : 'transparent',
                                                }} />
                                            <span className="text-tp-sm font-bold text-app-foreground">{b.name}</span>
                                        </button>
                                    )
                                })}
                                {moveTargets.length === 0 && allBrands.length > 0 && (
                                    <p className="text-tp-xs text-app-muted-foreground italic px-2 py-2">
                                        No brand matches “{moveTargetSearch}”.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 flex items-center gap-2"
                            style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                            <button onClick={() => setMoveOpen(false)} disabled={moving}
                                className="flex-1 px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                                style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                Cancel
                            </button>
                            <button onClick={performMove}
                                disabled={moveTarget == null || moving || (moveScope === 'selected' && selected.size === 0)}
                                className="flex-1 px-4 py-2 rounded-xl text-tp-xs font-bold text-white transition-all disabled:opacity-50 hover:brightness-110 flex items-center justify-center gap-2"
                                style={{ background: 'var(--app-primary)' }}>
                                {moving ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                                Move {moveScope === 'all' ? totalCount : selected.size} product{(moveScope === 'all' ? totalCount : selected.size) === 1 ? '' : 's'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
