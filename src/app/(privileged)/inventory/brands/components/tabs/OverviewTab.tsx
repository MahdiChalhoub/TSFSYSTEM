'use client'

import {
    Trash2, Package, Globe, FolderTree, Award
} from 'lucide-react'
import type { Brand, BrandPanelTab } from '../types'

/* ═══════════════════════════════════════════════════════════
 *  Overview Tab — Stat grid + linked categories + countries
 * ═══════════════════════════════════════════════════════════ */
export function OverviewTab({ brand, onDelete, onTabChange }: {
    brand: Brand
    onDelete: (b: Brand) => void
    onTabChange: (tab: BrandPanelTab) => void
}) {
    const catCount = brand.categories?.length ?? 0
    const countryCount = brand.countries?.length ?? 0
    const productCount = brand.product_count ?? 0

    return (
        <div className="p-3 space-y-3 animate-in fade-in duration-150">

            {/* Quick Info Strip */}
            <div className="flex items-center gap-2 flex-wrap">
                {brand.reference_code && (
                    <span className="font-mono text-tp-xs font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                        {brand.reference_code}
                    </span>
                )}
                {brand.short_name && (
                    <span className="text-tp-xs font-medium px-2 py-0.5 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                        {brand.short_name}
                    </span>
                )}
                {brand.created_at && (
                    <span className="text-tp-xxs font-medium text-app-muted-foreground ml-auto">
                        Created {new Date(brand.created_at).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Stat Grid 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                {[
                    { label: 'Categories', value: catCount, icon: <FolderTree size={13} />, color: 'var(--app-info)', tab: 'categories' as BrandPanelTab },
                    { label: 'Products', value: productCount, icon: <Package size={13} />, color: 'var(--app-success, #22c55e)', tab: 'products' as BrandPanelTab },
                    { label: 'Countries', value: countryCount, icon: <Globe size={13} />, color: 'var(--app-warning, #f59e0b)', tab: null as BrandPanelTab | null },
                    { label: 'Brand Identity', value: brand.logo ? 1 : 0, icon: <Award size={13} />, color: 'var(--app-primary)', tab: null as BrandPanelTab | null },
                ].map(s => (
                    <button key={s.label}
                        onClick={() => s.tab && onTabChange(s.tab)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : 'cursor-default'}`}
                        style={{
                            background: s.value > 0
                                ? `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`
                                : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: `1px solid ${s.value > 0 ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${s.color} ${s.value > 0 ? '12' : '6'}%, transparent)`,
                                color: s.value > 0 ? s.color : 'var(--app-muted-foreground)',
                            }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-tp-lg font-bold tabular-nums leading-tight"
                                style={{ color: s.value > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {s.label === 'Brand Identity' ? (s.value > 0 ? 'Has Logo' : 'No Logo') : s.value}
                            </div>
                            <div className="text-tp-xs font-medium leading-none"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {s.label}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Linked Categories (compact chips) */}
            {catCount > 0 && (
                <div>
                    <p className="text-tp-xs font-bold uppercase tracking-wide mb-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>Linked Categories</p>
                    <div className="flex flex-wrap gap-1">
                        {brand.categories!.map(c => (
                            <span key={c.id}
                                className="text-tp-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info) 8%, transparent)',
                                    color: 'var(--app-info)',
                                    border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)',
                                }}>
                                <FolderTree size={10} /> {c.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Linked Countries (compact chips) */}
            {countryCount > 0 && (
                <div>
                    <p className="text-tp-xs font-bold uppercase tracking-wide mb-1.5"
                        style={{ color: 'var(--app-muted-foreground)' }}>Origin Countries</p>
                    <div className="flex flex-wrap gap-1">
                        {brand.countries!.map(c => (
                            <span key={c.id}
                                className="text-tp-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                                    color: 'var(--app-warning, #f59e0b)',
                                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)',
                                }}>
                                <Globe size={10} /> {c.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Delete button */}
            <button onClick={() => onDelete(brand)}
                className="w-full flex items-center justify-center gap-1.5 text-tp-sm font-semibold px-3 py-2 rounded-xl border transition-colors hover:brightness-105"
                style={{
                    color: 'var(--app-error, #ef4444)',
                    borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)',
                    background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)',
                }}>
                <Trash2 size={12} /> Delete Brand
            </button>
        </div>
    )
}
