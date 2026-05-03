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

export function ProductsTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Product[]>([])
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortBy, setSortBy] = useState<SortBy>('name')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [moveOpen, setMoveOpen] = useState(false)
    const [allBrands, setAllBrands] = useState<Array<{ id: number; name: string }>>([])
    const [moveTarget, setMoveTarget] = useState<number | 'unbranded' | null>(null)
    const [moveTargetSearch, setMoveTargetSearch] = useState('')
    const [moving, setMoving] = useState(false)

    // Debounce search 250ms — keeps the input snappy without re-filtering on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 250)
        return () => clearTimeout(t)
    }, [search])

    const loadProducts = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/products/?brand=${brandId}&page_size=200`)
            .then((res: any) => {
                const items = Array.isArray(res) ? res : (res?.results ?? [])
                setProducts(items)
            })
            .catch(() => setProducts([]))
            .finally(() => setLoading(false))
    }, [brandId])

    useEffect(() => { loadProducts() }, [loadProducts])

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

    const filteredSorted = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase()
        let list = products
        if (q) {
            list = list.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q) ||
                (p.barcode || '').toLowerCase().includes(q)
            )
        }
        const dir = sortDir === 'asc' ? 1 : -1
        const numericKey = sortBy === 'price' ? 'selling_price_ttc' : null
        const stringKey = sortBy === 'name' ? 'name' : sortBy === 'sku' ? 'sku' : null
        return [...list].sort((a, b) => {
            if (numericKey) {
                const av = Number(a[numericKey] ?? 0)
                const bv = Number(b[numericKey] ?? 0)
                return (av - bv) * dir
            }
            if (stringKey) {
                const av = String(a[stringKey] ?? '')
                const bv = String(b[stringKey] ?? '')
                return av.localeCompare(bv) * dir
            }
            return 0
        })
    }, [products, debouncedSearch, sortBy, sortDir])

    const toggle = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
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
            await erpFetch('inventory/brands/move_products/', {
                method: 'POST',
                body: JSON.stringify({
                    source_brand_id: brandId,
                    target_brand_id: moveTarget === 'unbranded' ? null : moveTarget,
                    product_ids: Array.from(selected),
                }),
            })
            toast.success(`${selected.size} product${selected.size === 1 ? '' : 's'} moved`)
            setSelected(new Set())
            setMoveOpen(false)
            setMoveTarget(null)
            setMoveTargetSearch('')
            loadProducts()
            router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to move products')
        } finally {
            setMoving(false)
        }
    }

    if (loading) {
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
                    {filteredSorted.length} of {products.length} product{products.length !== 1 ? 's' : ''}
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
                                    <div key={p.id}
                                        className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
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
                                Move {selected.size} product{selected.size === 1 ? '' : 's'}
                            </h3>
                            <button onClick={() => setMoveOpen(false)}
                                className="p-1 rounded hover:bg-app-border/40 text-app-muted-foreground">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="px-4 py-3 flex-1 overflow-y-auto custom-scrollbar">
                            <p className="text-tp-xs font-medium text-app-muted-foreground mb-2">
                                Pick the brand to move them to. Existing brand: <strong>{brandName}</strong>.
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
                            <button onClick={performMove} disabled={moveTarget == null || moving}
                                className="flex-1 px-4 py-2 rounded-xl text-tp-xs font-bold text-white transition-all disabled:opacity-50 hover:brightness-110 flex items-center justify-center gap-2"
                                style={{ background: 'var(--app-primary)' }}>
                                {moving ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                                Move {selected.size} product{selected.size === 1 ? '' : 's'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
