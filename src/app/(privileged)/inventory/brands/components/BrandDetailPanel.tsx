'use client'

import { useState, type ReactNode } from 'react'
import { X, Pencil, Pin, Bookmark, Package, Globe, FolderTree, Clock } from 'lucide-react'
import type { Brand, BrandPanelTab } from './types'
import { OverviewTab } from './tabs/OverviewTab'
import { ProductsTab } from './tabs/ProductsTab'
import { CategoriesTab } from './tabs/CategoriesTab'
import { AuditTab } from './tabs/AuditTab'

/* ═══════════════════════════════════════════════════════════
 *  BrandDetailPanel — tabbed detail view matching
 *  CategoryDetailPanel's premium 4-zone header design.
 * ═══════════════════════════════════════════════════════════ */
export function BrandDetailPanel({ brand, onEdit, onDelete, initialTab, onClose, onPin }: {
    brand: Brand
    onEdit: (b: Brand) => void
    onDelete: (b: Brand) => void
    initialTab?: BrandPanelTab
    onClose: () => void
    onPin?: (b: Brand) => void
}) {
    const [tab, setTab] = useState<BrandPanelTab>(initialTab || 'overview')
    const catCount = brand.categories?.length ?? 0
    const countryCount = brand.countries?.length ?? 0
    const productCount = brand.product_count ?? 0

    const tabs: { key: BrandPanelTab; label: string; icon: ReactNode; count?: number; color?: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Bookmark size={13} /> },
        { key: 'products', label: 'Products', icon: <Package size={13} />, count: productCount, color: 'var(--app-success)' },
        { key: 'categories', label: 'Categories', icon: <FolderTree size={13} />, count: catCount, color: 'var(--app-info)' },
        { key: 'audit', label: 'Audit', icon: <Clock size={13} />, color: 'var(--app-muted-foreground)' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header — icon · identity · product count card · actions */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
                style={{
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 5%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                {/* Icon tile */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 75%, var(--app-accent)))',
                        color: 'white',
                        boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    {brand.logo
                        ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" />
                        : <Bookmark size={15} />}
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-tp-lg font-bold tracking-tight truncate leading-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        {brand.name}
                    </h3>
                    {(brand.short_name || brand.reference_code) && (
                        <div className="flex items-center gap-2 mt-1">
                            {brand.reference_code && (
                                <span className="inline-flex items-center gap-1 text-tp-xxs font-bold">
                                    <span className="uppercase tracking-widest opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>Code</span>
                                    <span className="font-mono px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        {brand.reference_code}
                                    </span>
                                </span>
                            )}
                            {brand.short_name && (
                                <span className="inline-flex items-center text-tp-xxs font-medium italic truncate"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                    title={brand.short_name}>
                                    {brand.short_name}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Product count field-card */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 px-3 py-1.5 rounded-xl transition-all"
                    style={{
                        background: productCount > 0
                            ? 'linear-gradient(135deg, color-mix(in srgb, var(--app-success, #22c55e) 10%, var(--app-surface)), var(--app-surface))'
                            : 'var(--app-background)',
                        border: `1px solid ${productCount > 0
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)'
                            : 'var(--app-border)'}`,
                        boxShadow: productCount > 0
                            ? '0 1px 4px color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                            : 'none',
                        minWidth: '82px',
                    }}>
                    <span className="text-tp-xxs font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--app-muted-foreground)' }}>
                        Products
                    </span>
                    <span className="font-mono text-tp-sm font-bold tabular-nums mt-0.5"
                        style={{ color: productCount > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)', opacity: productCount > 0 ? 1 : 0.45 }}>
                        {productCount > 0 ? productCount : '— —'}
                    </span>
                </div>

                {/* Actions pill bar */}
                <div className="flex items-center gap-0.5 flex-shrink-0 px-1 py-1 rounded-xl"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid var(--app-border)' }}>
                    <button onClick={() => onEdit(brand)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Edit">
                        <Pencil size={13} />
                    </button>
                    {onPin && (
                        <button onClick={() => onPin(brand)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Pin sidebar">
                            <Pin size={13} />
                        </button>
                    )}
                    <button onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tab Strip */}
            <div data-tour="detail-tabs" className="flex-shrink-0 flex items-center px-1 py-1"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-tp-sm font-semibold transition-colors relative"
                        style={tab === t.key ? {
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                        } : {
                            color: 'var(--app-muted-foreground)',
                        }}>
                        {t.icon} {t.label}
                        {t.count != null && t.count > 0 && (
                            <span className="ml-0.5 text-tp-xxs font-bold px-1 py-[1px] rounded-full min-w-[16px] text-center"
                                style={{
                                    background: tab === t.key
                                        ? `color-mix(in srgb, ${t.color || 'var(--app-primary)'} 15%, transparent)`
                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    color: tab === t.key ? (t.color || 'var(--app-primary)') : 'var(--app-muted-foreground)',
                                }}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {tab === 'overview' && (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <OverviewTab
                            brand={brand}
                            onDelete={onDelete}
                            onTabChange={setTab}
                        />
                    </div>
                )}
                {tab === 'products' && (
                    <ProductsTab brandId={brand.id} brandName={brand.name} />
                )}
                {tab === 'categories' && (
                    <CategoriesTab brandId={brand.id} brandName={brand.name} />
                )}
                {tab === 'audit' && (
                    <AuditTab brand={brand} />
                )}
            </div>
        </div>
    )
}
