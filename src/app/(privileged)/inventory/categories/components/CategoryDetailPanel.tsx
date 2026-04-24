// @ts-nocheck
'use client'

import { useState } from 'react'
import { X, Pencil, Pin, Bookmark, Package, Paintbrush, Tag, Clock } from 'lucide-react'
import type { CategoryNode, PanelTab } from './types'
import { OverviewTab } from './tabs/OverviewTab'
import { ProductsTab } from './tabs/ProductsTab'
import { BrandsTab } from './tabs/BrandsTab'
import { AttributesTab } from './tabs/AttributesTab'
import { AuditTab } from './tabs/AuditTab'

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
        { key: 'audit', label: 'Audit', icon: <Clock size={13} />, color: 'var(--app-muted-foreground)' },
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Header — four zones: icon · identity · barcode field · actions.
             *  Designed to read like a record header in any premium admin UI:
             *  defined regions, field-style labels, no dots-as-separators. */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
                style={{
                    background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 5%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                {/* Icon — soft tile, gradient tint, subtle shadow */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 75%, #8b5cf6))',
                        color: 'white',
                        boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <Bookmark size={15} />
                </div>

                {/* Identity — name headline, thin meta row with boxed field labels */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-tp-lg font-bold tracking-tight truncate leading-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        {node.name}
                    </h3>
                    {(node.code || node.short_name) && (
                        <div className="flex items-center gap-2 mt-1">
                            {node.code && (
                                <span className="inline-flex items-center gap-1 text-tp-xxs font-bold">
                                    <span className="uppercase tracking-widest opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>Code</span>
                                    <span className="font-mono px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        {node.code}
                                    </span>
                                </span>
                            )}
                            {node.short_name && (
                                <span className="inline-flex items-center text-tp-xxs font-medium italic truncate"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                    title={node.short_name}>
                                    {node.short_name}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Barcode field-card — right-aligned value, refined shadow */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 px-3 py-1.5 rounded-xl transition-all"
                    style={{
                        background: node.barcode_prefix
                            ? 'linear-gradient(135deg, color-mix(in srgb, var(--app-success, #22c55e) 10%, var(--app-surface)), var(--app-surface))'
                            : 'var(--app-background)',
                        border: `1px solid ${node.barcode_prefix
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)'
                            : 'var(--app-border)'}`,
                        boxShadow: node.barcode_prefix
                            ? '0 1px 4px color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)'
                            : 'none',
                        minWidth: '92px',
                    }}
                    title={node.barcode_prefix
                        ? `Barcode prefix — products get ${node.barcode_prefix}NNN`
                        : 'No barcode prefix set'}>
                    <span className="text-tp-xxs font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--app-muted-foreground)' }}>
                        Barcode
                    </span>
                    <span className="font-mono text-tp-sm font-bold tabular-nums mt-0.5"
                        style={{ color: node.barcode_prefix ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)', opacity: node.barcode_prefix ? 1 : 0.45 }}>
                        {node.barcode_prefix || '— —'}
                    </span>
                </div>

                {/* Actions — pill bar, one source of hover styling */}
                <div className="flex items-center gap-0.5 flex-shrink-0 px-1 py-1 rounded-xl"
                     style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid var(--app-border)' }}>
                    <button onClick={() => onEdit(node)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Edit">
                        <Pencil size={13} />
                    </button>
                    {onPin && (
                        <button onClick={() => onPin(node)}
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
                {tab === 'audit' && (
                    <AuditTab node={node} />
                )}
            </div>
        </div>
    )
}
