'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
    Award, Pencil, Trash2, ExternalLink, Globe, ChevronRight, Loader2, Package, Flag
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

    const cats = brand.categories?.length || 0
    const countries = brand.countries?.length || 0
    const totalProducts = brand.product_count || 0

    // Lazy fetch products
    const fetchProducts = useCallback(async () => {
        if (products !== null || loading) return
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
    }, [brand.id, products, loading])

    const handleToggleOpen = useCallback(() => {
        if (!isOpen && products === null) fetchProducts()
        setIsOpen(v => !v)
    }, [isOpen, products, fetchProducts])

    // Auto-expand on search query
    useEffect(() => {
        if (searchQuery && searchQuery.trim().length > 0) {
            setIsOpen(true)
            if (products === null && !loading) fetchProducts()
        }
    }, [searchQuery, products, loading, fetchProducts])

    // Honor Expand-All toggle from TreeMasterPage
    useEffect(() => {
        if (forceExpanded === true) {
            setIsOpen(true)
            if (products === null && !loading) fetchProducts()
        } else if (forceExpanded === false) {
            setIsOpen(false)
        }
    }, [forceExpanded, products, loading, fetchProducts])

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

    const toggleCountry = useCallback((countryId: number | null) => {
        const key = String(countryId)
        setOpenCountries(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
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
                onClick={() => handleToggleOpen()}
                onDoubleClick={() => onSelect(brand)}
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

                    {/* Expand chevron — always visible. Even when the brand
                        has no M2M countries, products may carry country FKs
                        that produce sub-groups on expand. */}
                    <div className="flex-shrink-0">
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
                    </div>

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
                            {countries > 0 ? (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground flex items-center gap-0.5">
                                    <Globe size={9} /> {countries} linked countr{countries === 1 ? 'y' : 'ies'}
                                </span>
                            ) : (
                                <span className="text-tp-xxs font-bold flex items-center gap-0.5 px-1.5 py-[1px] rounded-full"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                        color: 'var(--app-info)'
                                    }}>
                                    <Globe size={9} /> Universal
                                </span>
                            )}
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

            {/* Country + product tree */}
            {isOpen && products && byCountry.map(country => {
                const countryKey = String(country.id)
                const isCountryOpen = openCountries.has(countryKey)
                const countryProducts = country.items

                return (
                    <div key={countryKey}>
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
        </div>
    )
}
