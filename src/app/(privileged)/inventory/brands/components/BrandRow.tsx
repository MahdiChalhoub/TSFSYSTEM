'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
    Award, Pencil, Trash2, ExternalLink, Globe, ChevronRight, Loader2, Package, Flag,
    FolderTree, Tag
} from 'lucide-react'
import Link from 'next/link'
import { erpFetch } from '@/lib/erp-api'
import type { Brand, BrandPanelTab, ProductRow } from './types'

/* ═══════════════════════════════════════════════════════════
 *  BRAND TREE NODE — 3-level tree: Brand → Country → Products
 *  Lazy-loads products on first expand, groups by country,
 *  renders inline sub-rows. Replaces flat BrandRow.
 * ═══════════════════════════════════════════════════════════ */
export function BrandRow({
    brand, onEdit, onDelete, onSelect, compact, selectable, isChecked, onToggleCheck,
    searchQuery, forceExpanded
}: {
    brand: Brand
    onEdit: (b: Brand) => void
    onDelete: (b: Brand) => void
    onSelect: (b: Brand, tab?: BrandPanelTab) => void
    compact?: boolean
    selectable?: boolean
    isChecked?: boolean
    onToggleCheck?: () => void
    searchQuery?: string
    forceExpanded?: boolean
}) {
    const [isOpen, setIsOpen] = useState(forceExpanded || false)
    const [products, setProducts] = useState<ProductRow[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [openCountries, setOpenCountries] = useState<Set<string>>(new Set())
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
    const [openAttrs, setOpenAttrs] = useState<Set<string>>(new Set())
    const [openFacets, setOpenFacets] = useState<Set<string>>(new Set(['country']))

    const cats = brand.categories?.length || 0
    const countries = brand.countries?.length || 0
    const totalProducts = brand.product_count || 0

    // Refs mirror state so fetchProducts can stay a stable identity and
    // the useEffects below don't re-fire on every products/loading change
    // (which used to cascade re-renders across every brand row).
    const productsRef = useRef(products)
    const loadingRef = useRef(loading)
    productsRef.current = products
    loadingRef.current = loading

    const fetchProducts = useCallback(async () => {
        if (productsRef.current !== null || loadingRef.current) return
        setLoading(true)
        try {
            const res = await erpFetch(`inventory/products/?brand=${brand.id}&page_size=200`)
            const items = Array.isArray(res) ? res : (res?.results ?? [])
            setProducts(items)
        } catch {
            setProducts([])
        } finally {
            setLoading(false)
        }
    }, [brand.id])

    const handleToggleOpen = useCallback(() => {
        if (productsRef.current === null) fetchProducts()
        setIsOpen(v => !v)
    }, [fetchProducts])

    // Auto-expand on search query
    useEffect(() => {
        if (searchQuery && searchQuery.trim().length > 0) {
            setIsOpen(true)
            fetchProducts()
        }
    }, [searchQuery, fetchProducts])

    // Honor Expand-All toggle from TreeMasterPage
    useEffect(() => {
        if (forceExpanded === true) {
            setIsOpen(true)
            fetchProducts()
        } else if (forceExpanded === false) {
            setIsOpen(false)
        }
    }, [forceExpanded, fetchProducts])

    // Group products by country. Products with no country FK are
    // bucketed under "Universal" — meaning the product is sold across
    // all countries, not tied to a specific market.
    const byCountry = useMemo(() => {
        if (!products) return []
        const map = new Map<string, { id: number | null, name: string, code: string, items: ProductRow[] }>()
        products.forEach(p => {
            const key = String(p.country ?? 'universal')
            if (!map.has(key)) {
                map.set(key, {
                    id: p.country ?? null,
                    name: p.country_name || (p.country ? '—' : 'Universal'),
                    code: p.country_code || '',
                    items: []
                })
            }
            map.get(key)!.items.push(p)
        })
        return [...map.values()].sort((a, b) => {
            if (a.id === null) return -1  // Universal first
            if (b.id === null) return 1
            return a.name.localeCompare(b.name)
        })
    }, [products])

    // Group products by category. Products with no category FK fall
    // under "Uncategorized". Mirrors byCountry's Universal pattern.
    const byCategory = useMemo(() => {
        if (!products) return []
        const map = new Map<string, { id: number | null, name: string, items: ProductRow[] }>()
        products.forEach(p => {
            const key = String(p.category ?? 'none')
            if (!map.has(key)) {
                map.set(key, {
                    id: p.category ?? null,
                    name: p.category_name || (p.category ? '—' : 'Uncategorized'),
                    items: []
                })
            }
            map.get(key)!.items.push(p)
        })
        return [...map.values()].sort((a, b) => {
            if (a.id === null) return 1  // Uncategorized last
            if (b.id === null) return -1
            return a.name.localeCompare(b.name)
        })
    }, [products])

    // Group products by attribute value. One product can carry multiple
    // attribute values, so it appears under each — that's intentional
    // (browsing by attribute is the point).
    const byAttribute = useMemo(() => {
        if (!products) return []
        const map = new Map<string, { name: string, items: ProductRow[] }>()
        products.forEach(p => {
            const attrs = p.attribute_value_names || []
            if (attrs.length === 0) {
                if (!map.has('__none__')) {
                    map.set('__none__', { name: 'No attributes', items: [] })
                }
                map.get('__none__')!.items.push(p)
                return
            }
            attrs.forEach(attr => {
                if (!map.has(attr)) map.set(attr, { name: attr, items: [] })
                map.get(attr)!.items.push(p)
            })
        })
        return [...map.entries()]
            .map(([key, v]) => ({ key, ...v }))
            .sort((a, b) => {
                if (a.key === '__none__') return 1
                if (b.key === '__none__') return -1
                return a.name.localeCompare(b.name)
            })
    }, [products])

    const toggleCountry = useCallback((countryId: number | null) => {
        const key = String(countryId)
        setOpenCountries(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const toggleCategory = useCallback((categoryId: number | null) => {
        const key = String(categoryId)
        setOpenCategories(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const toggleAttr = useCallback((attrKey: string) => {
        setOpenAttrs(prev => {
            const next = new Set(prev)
            if (next.has(attrKey)) next.delete(attrKey)
            else next.add(attrKey)
            return next
        })
    }, [])

    const toggleFacet = useCallback((facetKey: string) => {
        setOpenFacets(prev => {
            const next = new Set(prev)
            if (next.has(facetKey)) next.delete(facetKey)
            else next.add(facetKey)
            return next
        })
    }, [])

    return (
        <div>
            {/* ═══════════════════════════════════════════════════════════
                LEVEL 0 — BRAND ROW (root, expandable)
                ═══════════════════════════════════════════════════════════ */}
            <div
                className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
                onClick={() => { handleToggleOpen(); onSelect(brand) }}
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}>

                <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                    style={{ background: 'var(--app-primary)' }} />

                {/* Checkbox gutter */}
                {selectable && (
                    <div className="w-9 flex-shrink-0 flex items-center justify-center">
                        <button type="button"
                            onClick={(e) => { e.stopPropagation(); onToggleCheck?.() }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            style={{
                                borderColor: isChecked ? 'var(--app-primary)' : 'var(--app-border)',
                                background: isChecked ? 'var(--app-primary)' : 'transparent',
                            }}
                            aria-checked={isChecked}
                            role="checkbox">
                            {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                        </button>
                    </div>
                )}

                {/* Row body */}
                <div className="relative flex items-center gap-2 flex-1 min-w-0 py-2.5 pl-3 pr-3">

                    {/* Expand chevron — clickable on its own (stops bubbling
                        so the row click still opens the side panel). Click
                        the row body → open panel; click the chevron → expand
                        the inline tree. Standard tree pattern. */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleOpen() }}
                        className="flex-shrink-0 p-1 -m-1 rounded hover:bg-app-border/40 transition-colors"
                        title={isOpen ? 'Collapse' : 'Expand to see categories, countries, attributes'}
                        aria-expanded={isOpen}>
                        {loading ? (
                            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                        ) : (
                            <ChevronRight
                                size={14}
                                className="transition-transform duration-200"
                                style={{
                                    color: 'var(--app-text-faint)',
                                    transform: isOpen ? 'rotate(90deg)' : 'none'
                                }} />
                        )}
                    </button>

                    {/* Logo or icon */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        {brand.logo
                            ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                            : <Award size={13} strokeWidth={2} />}
                    </div>

                    {/* Name + short + countries */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate text-tp-lg font-bold text-app-foreground">{brand.name}</span>
                            {brand.short_name && (
                                <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    {brand.short_name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {(() => {
                                // Prefer the count derived from products once
                                // they're loaded — that reflects where the brand
                                // is *actually* sold. Fall back to the M2M
                                // brand.countries field only when products
                                // haven't been fetched yet.
                                const productCountries = byCountry.filter(c => c.id !== null).length
                                const hasUniversal = byCountry.some(c => c.id === null)
                                const linkedCount = products !== null ? productCountries : countries

                                if (linkedCount > 0 && hasUniversal) {
                                    return (
                                        <span className="text-tp-xxs font-medium text-app-muted-foreground flex items-center gap-0.5">
                                            <Globe size={9} /> {linkedCount} countr{linkedCount === 1 ? 'y' : 'ies'} + Universal
                                        </span>
                                    )
                                }
                                if (linkedCount > 0) {
                                    return (
                                        <span className="text-tp-xxs font-medium text-app-muted-foreground flex items-center gap-0.5">
                                            <Globe size={9} /> {linkedCount} linked countr{linkedCount === 1 ? 'y' : 'ies'}
                                        </span>
                                    )
                                }
                                if (hasUniversal) {
                                    return (
                                        <span className="text-tp-xxs font-bold flex items-center gap-0.5 px-1.5 py-[1px] rounded-full"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                                color: 'var(--app-info)'
                                            }}>
                                            <Globe size={9} /> Universal
                                        </span>
                                    )
                                }
                                // Products not loaded yet AND no M2M countries
                                return (
                                    <span className="text-tp-xxs font-medium text-app-muted-foreground italic">
                                        Click to load
                                    </span>
                                )
                            })()}
                            {cats > 0 && (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground">
                                    · {cats} categor{cats === 1 ? 'y' : 'ies'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stat columns */}
                    {!compact && (
                        <>
                            <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{ color: cats > 0 ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    {cats || '–'}
                                </span>
                            </div>
                            <div className="hidden sm:flex w-[72px] flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{ color: countries > 0 ? 'var(--app-warning)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    {countries || '–'}
                                </span>
                            </div>
                            <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                                <span className="text-tp-xs font-semibold tabular-nums"
                                    style={{ color: totalProducts > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                    {totalProducts || '–'}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Link href={`/inventory/brands/${brand.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Open brand page">
                            <ExternalLink size={12} />
                        </Link>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(brand) }}
                            className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                            <Pencil size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(brand) }}
                            className="p-1.5 hover:bg-app-border/40 rounded-lg transition-colors"
                            style={{ color: 'var(--app-muted-foreground)' }} title="Delete">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                LEVEL 1 & 2 — COUNTRIES + PRODUCTS (rendered when expanded)
                ═══════════════════════════════════════════════════════════ */}

            {/* Loading state */}
            {isOpen && loading && (
                <div className="flex items-center gap-2 py-3 pl-12 text-tp-sm text-app-muted-foreground"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Loading products…</span>
                </div>
            )}

            {/* Empty state — fetched but no products for this brand */}
            {isOpen && !loading && products !== null && products.length === 0 && (
                <div className="flex items-center gap-2 py-3 pl-12 text-tp-sm text-app-muted-foreground italic"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <Package size={13} className="opacity-50" />
                    <span>No products under {brand.name} yet.</span>
                </div>
            )}

            {/* ── FACET 1: BY CATEGORY ── */}
            {isOpen && products && products.length > 0 && (
                <FacetSection
                    label="By Category"
                    icon={<FolderTree size={13} style={{ color: 'var(--app-info)' }} />}
                    color="var(--app-info)"
                    isOpen={openFacets.has('category')}
                    onToggle={() => toggleFacet('category')}
                    count={byCategory.length}
                    selectable={selectable}>
                    {byCategory.map(cat => {
                        const catKey = String(cat.id)
                        const catOpen = openCategories.has(catKey)
                        return (
                            <div key={`cat-${catKey}`}>
                                <FacetValueRow
                                    label={cat.name}
                                    isOpen={catOpen}
                                    onToggle={() => toggleCategory(cat.id)}
                                    count={cat.items.length}
                                    indent={28}
                                    selectable={selectable}
                                    iconColor="var(--app-info)"
                                    icon={<FolderTree size={12} />}
                                    isMuted={cat.id === null}
                                />
                                {catOpen && cat.items.map(p => (
                                    <ProductLeaf key={`cat-${cat.id}-p-${p.id}`} product={p} compact={compact} selectable={selectable} indent={48} />
                                ))}
                            </div>
                        )
                    })}
                </FacetSection>
            )}

            {/* ── FACET 2: BY COUNTRY ── */}
            {isOpen && products && products.length > 0 && (
                <FacetSection
                    label="By Country"
                    icon={<Globe size={13} style={{ color: 'var(--app-warning)' }} />}
                    color="var(--app-warning)"
                    isOpen={openFacets.has('country')}
                    onToggle={() => toggleFacet('country')}
                    count={byCountry.length}
                    selectable={selectable}>
                    {byCountry.map(country => {
                        const countryKey = String(country.id)
                        const isCountryOpen = openCountries.has(countryKey)
                        const countryProducts = country.items
                        return (
                            <div key={`country-${countryKey}`}>
                        {/* Level 1 — Country row */}
                        <div
                            className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
                            onClick={() => toggleCountry(country.id)}
                            style={{
                                paddingLeft: '12px',
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                            }}>

                            {/* Indent/connector */}
                            <div className="absolute left-[10px] top-0 bottom-0 w-[1px]"
                                style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }} />

                            {/* Checkbox gutter */}
                            {selectable && <div className="w-9 flex-shrink-0" />}

                            {/* Row body */}
                            <div className="relative flex items-center gap-2 flex-1 min-w-0 py-2 pl-3 pr-3">

                                {/* Expand chevron */}
                                <ChevronRight
                                    size={14}
                                    className="flex-shrink-0 transition-transform duration-200"
                                    style={{
                                        color: 'var(--app-text-faint)',
                                        transform: isCountryOpen ? 'rotate(90deg)' : 'none'
                                    }} />

                                {/* Country flag emoji + name. Products with no
                                    country FK fall under "Universal" — sold
                                    across all countries, not market-specific. */}
                                <div className="flex items-center gap-1.5">
                                    {country.id === null ? (
                                        <Globe size={14} style={{ color: 'var(--app-info)' }} />
                                    ) : country.code ? (
                                        <span className="text-sm">
                                            {country.code.toUpperCase().split('').map((char) =>
                                                String.fromCodePoint(0x1F1E6 + (char.charCodeAt(0) - 65))
                                            ).join('')}
                                        </span>
                                    ) : (
                                        <Flag size={14} style={{ color: 'var(--app-text-faint)' }} />
                                    )}
                                    <span className="text-tp-sm font-semibold"
                                        style={{ color: country.id === null ? 'var(--app-info)' : 'var(--app-foreground)' }}>
                                        {country.name}
                                    </span>
                                    {country.id === null && (
                                        <span className="text-tp-xxs font-medium text-app-muted-foreground">
                                            (sold across all countries)
                                        </span>
                                    )}
                                </div>

                                {/* Product count badge */}
                                <div className="ml-auto flex-shrink-0">
                                    <span className="text-tp-xs font-semibold px-2 py-1 rounded-full"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success) 12%, transparent)',
                                            color: 'var(--app-success)'
                                        }}>
                                        {countryProducts.length} product{countryProducts.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Level 2 — Product rows */}
                        {isCountryOpen && countryProducts.map(product => (
                            <div
                                key={product.id}
                                className="group flex items-stretch relative transition-colors duration-150 hover:bg-app-surface-hover"
                                style={{
                                    paddingLeft: '12px',
                                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                }}>

                                {/* Indent/connector */}
                                <div className="absolute left-[10px] top-0 bottom-0 w-[1px]"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }} />

                                {/* Checkbox gutter */}
                                {selectable && <div className="w-9 flex-shrink-0" />}

                                {/* Row body */}
                                <div className="relative flex items-center gap-2 flex-1 min-w-0 py-2 pl-12 pr-3">

                                    {/* Package icon */}
                                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success) 12%, transparent)',
                                            color: 'var(--app-success)',
                                        }}>
                                        <Package size={12} />
                                    </div>

                                    {/* Name + SKU */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-tp-sm font-semibold text-app-foreground truncate">
                                            {product.name}
                                        </p>
                                        {product.sku && (
                                            <p className="text-tp-xxs font-mono text-app-muted-foreground mt-0.5">
                                                {product.sku}
                                            </p>
                                        )}
                                    </div>

                                    {/* Attribute value chips */}
                                    {product.attribute_value_names && product.attribute_value_names.length > 0 && (
                                        <div className="hidden sm:flex gap-1 flex-wrap flex-shrink-0">
                                            {product.attribute_value_names.slice(0, 2).map((attr, idx) => (
                                                <span key={idx} className="text-tp-xxs px-2 py-1 rounded-full flex-shrink-0"
                                                    style={{
                                                        background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                                        color: 'var(--app-info)'
                                                    }}>
                                                    {attr}
                                                </span>
                                            ))}
                                            {product.attribute_value_names.length > 2 && (
                                                <span className="text-tp-xxs px-2 py-1 rounded-full flex-shrink-0"
                                                    style={{
                                                        background: 'color-mix(in srgb, var(--app-text-faint) 15%, transparent)',
                                                        color: 'var(--app-text-faint)'
                                                    }}>
                                                    +{product.attribute_value_names.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Price */}
                                    {!compact && product.selling_price_ttc != null && (
                                        <span className="hidden sm:block text-tp-xs font-semibold tabular-nums flex-shrink-0"
                                            style={{ color: 'var(--app-foreground)' }}>
                                            {Number(product.selling_price_ttc).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </span>
                                    )}

                                    {/* Product link */}
                                    <Link href={`/inventory/products/${product.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-app-muted-foreground hover:text-app-foreground" title="Open product">
                                        <ExternalLink size={12} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            })}
                </FacetSection>
            )}

            {/* ── FACET 3: BY ATTRIBUTE ── */}
            {isOpen && products && products.length > 0 && (
                <FacetSection
                    label="By Attribute"
                    icon={<Tag size={13} style={{ color: 'var(--app-success)' }} />}
                    color="var(--app-success)"
                    isOpen={openFacets.has('attribute')}
                    onToggle={() => toggleFacet('attribute')}
                    count={byAttribute.length}
                    selectable={selectable}>
                    {byAttribute.map(attr => {
                        const attrOpen = openAttrs.has(attr.key)
                        return (
                            <div key={`attr-${attr.key}`}>
                                <FacetValueRow
                                    label={attr.name}
                                    isOpen={attrOpen}
                                    onToggle={() => toggleAttr(attr.key)}
                                    count={attr.items.length}
                                    indent={28}
                                    selectable={selectable}
                                    iconColor="var(--app-success)"
                                    icon={<Tag size={12} />}
                                    isMuted={attr.key === '__none__'}
                                />
                                {attrOpen && attr.items.map(p => (
                                    <ProductLeaf key={`attr-${attr.key}-p-${p.id}`} product={p} compact={compact} selectable={selectable} indent={48} />
                                ))}
                            </div>
                        )
                    })}
                </FacetSection>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  Helper rows — one place for visual structure of the tree
 *  so the three facets stay consistent.
 * ═══════════════════════════════════════════════════════════ */

/**
 * Facet group header — visual match for the LinkedTree group headers on
 * the /countries page: 4% color tint background, 12% colored border, 3px
 * left accent stripe in kind color, 32×32 icon tile, chevron + colored
 * label + count badge. Indented + branched off a trunk line so it reads
 * as a section divider inside the parent brand row.
 */
function FacetSection({
    label, icon, color, isOpen, onToggle, count, children
}: {
    label: string
    icon: React.ReactNode
    color: string
    isOpen: boolean
    onToggle: () => void
    count: number
    selectable?: boolean
    children: React.ReactNode
}) {
    return (
        <div className="relative mx-3 my-2" style={{ paddingLeft: '24px' }}>
            {/* Branch from trunk (vertical bar drawn by parent layout)
                into this group's row — same connector treatment as
                /countries page LinkedTree. */}
            <div className="absolute pointer-events-none"
                style={{ left: '11px', top: 0, bottom: isOpen ? 0 : '50%', width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            <div className="absolute pointer-events-none"
                style={{ left: '11px', top: '50%', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

            <button
                type="button"
                onClick={onToggle}
                className="w-full group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer rounded-lg text-left relative overflow-hidden"
                style={{
                    padding: '8px 10px',
                    background: `color-mix(in srgb, ${color} 4%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${color} 12%, transparent)`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 8%, transparent)` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${color} 4%, transparent)` }}>
                {/* Left accent stripe in the kind's color — depth marker */}
                <span className="absolute left-0 top-0 bottom-0 w-[3px] pointer-events-none"
                    style={{ background: color, opacity: 0.7 }} />
                <span className="w-4 h-4 flex items-center justify-center text-app-muted-foreground flex-shrink-0 ml-1"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
                    <ChevronRight size={11} />
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-tp-md font-bold truncate" style={{ color }}>{label}</span>
                    <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded tabular-nums"
                        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                        {count}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="relative mt-1" style={{ paddingLeft: '12px' }}>
                    {children}
                </div>
            )}
        </div>
    )
}

/**
 * Level-3 value row — same row template as the /countries LinkedLeaf:
 * 28×28 icon at 7% color tint, muted-foreground name, lighter weight,
 * branch connector lines on the left so the eye reads it as the
 * deepest level. Clickable to expand into product list.
 */
function FacetValueRow({
    label, isOpen, onToggle, count, iconColor, icon, isMuted, isLast
}: {
    label: string
    isOpen: boolean
    onToggle: () => void
    count: number
    indent?: number
    selectable?: boolean
    iconColor: string
    icon: React.ReactNode
    isMuted?: boolean
    isLast?: boolean
}) {
    return (
        <div className="relative" style={{ paddingLeft: '24px' }}>
            {/* Branch connectors */}
            <div className="absolute pointer-events-none"
                style={{ left: '4px', top: 0, bottom: isLast && !isOpen ? '50%' : 0, width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            <div className="absolute pointer-events-none"
                style={{ left: '4px', top: '50%', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

            <button
                type="button"
                onClick={onToggle}
                className="group w-full text-left flex items-center gap-2 md:gap-3 transition-all duration-150 rounded-lg cursor-pointer"
                style={{ padding: '6px 10px', color: 'inherit', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 40%, transparent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <span className="w-4 h-4 flex items-center justify-center text-app-muted-foreground flex-shrink-0"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
                    <ChevronRight size={10} />
                </span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${iconColor} 7%, transparent)`, color: iconColor, opacity: 0.85 }}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <span className={`text-tp-sm font-semibold truncate ${isMuted ? 'italic' : ''}`}
                        style={{ color: isMuted ? 'var(--app-text-faint)' : 'var(--app-muted-foreground)' }}>
                        {label}
                    </span>
                </div>
                <span className="text-tp-xxs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                        background: `color-mix(in srgb, ${iconColor} 8%, transparent)`,
                        color: iconColor
                    }}>
                    {count}
                </span>
            </button>
        </div>
    )
}

function ProductLeaf({
    product, compact, selectable, indent
}: {
    product: ProductRow
    compact?: boolean
    selectable?: boolean
    indent: number
}) {
    return (
        <div
            className="group flex items-stretch relative transition-colors duration-150 hover:bg-app-surface-hover"
            style={{
                paddingLeft: '12px',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
            }}>
            {selectable && <div className="w-9 flex-shrink-0" />}
            <div className="relative flex items-center gap-2 flex-1 min-w-0 py-2 pr-3"
                style={{ paddingLeft: `${indent}px` }}>
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-success) 12%, transparent)',
                        color: 'var(--app-success)',
                    }}>
                    <Package size={12} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-tp-sm font-semibold text-app-foreground truncate">
                        {product.name}
                    </p>
                    {product.sku && (
                        <p className="text-tp-xxs font-mono text-app-muted-foreground mt-0.5">
                            {product.sku}
                        </p>
                    )}
                </div>
                {product.attribute_value_names && product.attribute_value_names.length > 0 && (
                    <div className="hidden sm:flex gap-1 flex-wrap flex-shrink-0">
                        {product.attribute_value_names.slice(0, 2).map((attr, idx) => (
                            <span key={idx} className="text-tp-xxs px-2 py-1 rounded-full flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                    color: 'var(--app-info)'
                                }}>
                                {attr}
                            </span>
                        ))}
                        {product.attribute_value_names.length > 2 && (
                            <span className="text-tp-xxs px-2 py-1 rounded-full flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-text-faint) 15%, transparent)',
                                    color: 'var(--app-text-faint)'
                                }}>
                                +{product.attribute_value_names.length - 2}
                            </span>
                        )}
                    </div>
                )}
                {!compact && product.selling_price_ttc != null && (
                    <span className="hidden sm:block text-tp-xs font-semibold tabular-nums flex-shrink-0"
                        style={{ color: 'var(--app-foreground)' }}>
                        {Number(product.selling_price_ttc).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                )}
                <Link href={`/inventory/products/${product.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-app-muted-foreground hover:text-app-foreground" title="Open product">
                    <ExternalLink size={12} />
                </Link>
            </div>
        </div>
    )
}
