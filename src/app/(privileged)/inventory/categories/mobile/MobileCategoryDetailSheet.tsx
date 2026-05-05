'use client'

/* ═══════════════════════════════════════════════════════════
 *  MobileCategoryDetailSheet — mobile-native wrapper rendered
 *  inside the bottom sheet. Provides its own header + tab bar
 *  with bigger tap targets and uses MobileOverviewTab for overview.
 *  Non-overview tabs still use the desktop components (they're
 *  already vertical lists that translate OK to narrow viewports).
 * ═══════════════════════════════════════════════════════════ */

import { useState, type ReactNode } from 'react'
import { X, Bookmark, Pencil, Package, Paintbrush, Tag, Eye } from 'lucide-react'
import type { CategoryNode, PanelTab } from '../components/types'
import { MobileOverviewTab } from './tabs/MobileOverviewTab'
import { ProductsTab } from '../components/tabs/ProductsTab'
import { BrandsTab } from '../components/tabs/BrandsTab'
import { AttributesTab } from '../components/tabs/AttributesTab'

interface Props {
    node: CategoryNode
    allCategories: CategoryNode[]
    initialTab?: PanelTab
    onEdit: (n: CategoryNode) => void
    onAdd: (pid?: number) => void
    onDelete: (n: CategoryNode) => void
    onOpenChild?: (child: CategoryNode) => void
    onClose: () => void
}

export function MobileCategoryDetailSheet({
    node, allCategories, initialTab, onEdit, onAdd, onDelete, onOpenChild, onClose,
}: Props) {
    const [tab, setTab] = useState<PanelTab>(initialTab || 'overview')
    const isParent = !!(node.children && node.children.length > 0)
    const childCount = node.children?.length ?? 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0

    const tabs: { key: PanelTab; label: string; icon: ReactNode; count?: number; color?: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Eye size={14} /> },
        { key: 'products', label: 'Products', icon: <Package size={14} />, count: productCount, color: 'var(--app-success, #10b981)' },
        { key: 'brands', label: 'Brands', icon: <Paintbrush size={14} />, count: brandCount, color: 'var(--app-info)' },
        { key: 'attributes', label: 'Attrs', icon: <Tag size={14} />, count: attributeCount, color: 'var(--app-warning, #f59e0b)' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0 rounded-xl"
                    style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-accent)))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                    }}>
                    <Bookmark size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="truncate" style={{ fontSize: 'var(--tp-2xl)' }}>
                        {node.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {node.code && (
                            <span className="font-mono font-bold" style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-primary)' }}>
                                {node.code}
                            </span>
                        )}
                        {node.barcode_prefix && (
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                style={{
                                    fontSize: 'var(--tp-xxs)',
                                    background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                    color: 'var(--app-success, #22c55e)',
                                }}>
                                🏷 {node.barcode_prefix}
                            </span>
                        )}
                        {node.short_name && (
                            <span className="font-bold uppercase tracking-wider text-app-muted-foreground" style={{ fontSize: 'var(--tp-xs)' }}>
                                · {node.short_name}
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={() => onEdit(node)}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Edit">
                    <Pencil size={15} />
                </button>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{
                        width: 36, height: 36,
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                    }}
                    aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {/* Tab bar — horizontally scrollable pills with big tap targets */}
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2 overflow-x-auto"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 45%, transparent)',
                    scrollbarWidth: 'none',
                }}>
                {tabs.map(t => {
                    const active = tab === t.key
                    return (
                        <button key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all active:scale-95"
                            style={{
                                minHeight: 38, fontSize: 'var(--tp-md)',
                                background: active
                                    ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                    : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                border: active
                                    ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                    : '1px solid transparent',
                            }}>
                            {t.icon}
                            <span>{t.label}</span>
                            {t.count != null && t.count > 0 && (
                                <span className="font-bold tabular-nums rounded-full px-1.5 py-0.5"
                                    style={{
                                        fontSize: 'var(--tp-xs)', minWidth: 18, textAlign: 'center',
                                        background: active
                                            ? `color-mix(in srgb, ${t.color || 'var(--app-primary)'} 18%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                        color: active ? (t.color || 'var(--app-primary)') : 'var(--app-muted-foreground)',
                                    }}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
                {tab === 'overview' && (
                    <MobileOverviewTab
                        node={node}
                        isParent={isParent}
                        childCount={childCount}
                        productCount={productCount}
                        brandCount={brandCount}
                        attributeCount={attributeCount}
                        onAdd={onAdd}
                        onDelete={onDelete}
                        onTabChange={setTab}
                        onOpenChild={onOpenChild}
                    />
                )}
                {tab === 'products' && (
                    <ProductsTab categoryId={node.id} categoryName={node.name} allCategories={allCategories} />
                )}
                {tab === 'brands' && (
                    <BrandsTab categoryId={node.id} categoryName={node.name} />
                )}
                {tab === 'attributes' && (
                    <AttributesTab categoryId={node.id} categoryName={node.name} />
                )}
            </div>
        </div>
    )
}
