// @ts-nocheck
'use client'

import { useState } from 'react'
import { X, Pencil, Pin, Bookmark, Package, Paintbrush, Tag } from 'lucide-react'
import type { CategoryNode, PanelTab } from './types'
import { OverviewTab } from './tabs/OverviewTab'
import { ProductsTab } from './tabs/ProductsTab'
import { BrandsTab } from './tabs/BrandsTab'
import { AttributesTab } from './tabs/AttributesTab'

/* ═══════════════════════════════════════════════════════════
 *  CategoryDetailPanel — tabbed detail view
 * ═══════════════════════════════════════════════════════════ */
export function CategoryDetailPanel({ node, onEdit, onAdd, onDelete, allCategories, initialTab, onClose, onPin }: {
    node: CategoryNode
    onEdit: (n: CategoryNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: CategoryNode) => void
    allCategories: any[]
    initialTab?: PanelTab
    onClose: () => void
    onPin?: (n: CategoryNode) => void
}) {
    const [tab, setTab] = useState<PanelTab>(initialTab || 'overview')
    const isParent = node.children && node.children.length > 0
    const childCount = node.children?.length ?? 0
    const productCount = node.product_count ?? 0
    const brandCount = node.brand_count ?? 0
    const attributeCount = node.attribute_count ?? 0

    const tabs: { key: PanelTab; label: string; icon: any; count?: number; color?: string }[] = [
        { key: 'overview', label: 'Overview', icon: <Bookmark size={13} /> },
        { key: 'products', label: 'Products', icon: <Package size={13} />, count: productCount, color: 'var(--app-success)' },
        { key: 'brands', label: 'Brands', icon: <Paintbrush size={13} />, count: brandCount, color: 'var(--app-info)' },
        { key: 'attributes', label: 'Attributes', icon: <Tag size={13} />, count: attributeCount, color: 'var(--app-warning)' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header — flat, no gradient */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        color: 'var(--app-primary)',
                    }}>
                    <Bookmark size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-tp-lg font-bold text-app-foreground truncate">{node.name}</h3>
                    <div className="flex items-center gap-1.5">
                        {node.code && <span className="text-tp-xs font-mono font-semibold text-app-primary">{node.code}</span>}
                        {node.short_name && <span className="text-tp-xs font-medium text-app-muted-foreground">{node.short_name}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEdit(node)}
                        className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/40 transition-colors" title="Edit">
                        <Pencil size={13} />
                    </button>
                    {onPin && (
                        <button onClick={() => onPin(node)}
                            className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/10 transition-colors" title="Pin sidebar">
                            <Pin size={13} />
                        </button>
                    )}
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/40 transition-colors" title="Close">
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
                            node={node}
                            onAdd={onAdd}
                            onDelete={onDelete}
                            isParent={!!isParent}
                            childCount={childCount}
                            productCount={productCount}
                            brandCount={brandCount}
                            attributeCount={attributeCount}
                            onTabChange={setTab}
                        />
                    </div>
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
