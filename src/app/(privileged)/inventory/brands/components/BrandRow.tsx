'use client'

import {
    Award, Pencil, Trash2, ExternalLink, Globe,
} from 'lucide-react'
import Link from 'next/link'
import type { Brand, BrandPanelTab } from './types'

/* ═══════════════════════════════════════════════════════════
 *  BRAND ROW — flat list item for TreeMasterPage
 *  Matches CategoryRow pattern: fixed checkbox gutter,
 *  stat columns, hover actions, compact mode support.
 * ═══════════════════════════════════════════════════════════ */
export function BrandRow({ brand, onEdit, onDelete, onSelect, compact, selectable, isChecked, onToggleCheck }: {
    brand: Brand
    onEdit: (b: Brand) => void
    onDelete: (b: Brand) => void
    onSelect: (b: Brand, tab?: BrandPanelTab) => void
    compact?: boolean
    selectable?: boolean
    isChecked?: boolean
    onToggleCheck?: () => void
}) {
    const cats = brand.categories?.length || 0
    const countries = brand.countries?.length || 0
    const products = brand.product_count || 0
    const firstCountry = brand.countries?.[0]

    return (
        <div
            className="group flex items-stretch relative transition-colors duration-150 cursor-pointer hover:bg-app-surface-hover"
            onClick={() => onSelect(brand)}
            onDoubleClick={() => onSelect(brand)}
            style={{
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
            }}>

            {/* Left accent bar */}
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
                style={{ background: 'var(--app-primary)' }} />

            {/* Fixed checkbox gutter */}
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
                        role="checkbox"
                        aria-label={`Select ${brand.name}`}>
                        {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                    </button>
                </div>
            )}

            {/* Row body */}
            <div className="relative flex items-center gap-2 flex-1 min-w-0 py-2.5"
                style={{ paddingLeft: '12px', paddingRight: '12px' }}>

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
                    {(countries > 0 || cats > 0) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {firstCountry && (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground flex items-center gap-0.5">
                                    <Globe size={9} /> {firstCountry.name}{countries > 1 ? ` +${countries - 1}` : ''}
                                </span>
                            )}
                            {cats > 0 && (
                                <span className="text-tp-xxs font-medium text-app-muted-foreground">
                                    · {cats} categor{cats === 1 ? 'y' : 'ies'}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Stat columns — hidden when compact */}
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
                                style={{ color: products > 0 ? 'var(--app-success)' : 'color-mix(in srgb, var(--app-muted-foreground) 35%, transparent)' }}>
                                {products || '–'}
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
    )
}
