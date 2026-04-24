'use client'

import Link from 'next/link'
import {
    ArrowLeft, Plus, Folder, FolderOpen, Layers, ShoppingCart, Tag,
    Star, Flame, Package,
} from 'lucide-react'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { MasterListCard } from '@/components/templates/MasterListCard'

/* ═══════════════════════════════════════════════════════════
 *  Demo dataset — fake "Widget catalog" tree:
 *    Electronics → Phones → Flagship → …
 *                           Budget
 *                → Laptops  → Gaming
 *                           Office
 *    Home Goods → Furniture
 *               → Kitchen
 *    Stationery
 * ═══════════════════════════════════════════════════════════ */
const DEMO_DATA = [
    { id: 1,  parent: null, name: 'Electronics', code: 'ELEC',  featured: true,  items: 124 },
    { id: 2,  parent: 1,    name: 'Phones',      code: 'PHN',   featured: true,  items: 48 },
    { id: 3,  parent: 2,    name: 'Flagship',    code: 'FLG',   featured: true,  items: 12 },
    { id: 4,  parent: 2,    name: 'Budget',      code: 'BDG',   featured: false, items: 36 },
    { id: 5,  parent: 1,    name: 'Laptops',     code: 'LPT',   featured: false, items: 42 },
    { id: 6,  parent: 5,    name: 'Gaming',      code: 'GAM',   featured: true,  items: 14 },
    { id: 7,  parent: 5,    name: 'Office',      code: 'OFC',   featured: false, items: 28 },
    { id: 8,  parent: null, name: 'Home Goods',  code: 'HOME',  featured: false, items: 76 },
    { id: 9,  parent: 8,    name: 'Furniture',   code: 'FURN',  featured: false, items: 22 },
    { id: 10, parent: 8,    name: 'Kitchen',     code: 'KIT',   featured: true,  items: 54 },
    { id: 11, parent: null, name: 'Stationery',  code: 'STAT',  featured: false, items: 17 },
]

export default function TreeMasterDemo() {
    return (
        <div style={{ position: 'relative' }}>
            {/* Floating breadcrumb so the template header still fills the viewport */}
            <Link href="/dev/templates"
                className="fixed left-4 top-4 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-all"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    backdropFilter: 'blur(8px)',
                }}>
                <ArrowLeft size={12} />Back to showcase
            </Link>

            <TreeMasterPage
                config={{
                    title: 'Widget Catalog',
                    subtitle: (filtered, all) => `${all.length} nodes · ${filtered.length} shown · synthetic demo data`,
                    icon: <ShoppingCart size={20} />,
                    iconColor: 'var(--app-primary)',
                    searchPlaceholder: 'Search widgets...',
                    primaryAction: {
                        label: 'New Widget',
                        icon: <Plus size={14} />,
                        onClick: () => alert('Demo: this would open a form modal.'),
                    },

                    // Template owns filtering + tree build.
                    data: DEMO_DATA,
                    searchFields: ['name', 'code'],
                    treeParentKey: 'parent',
                    kpiPredicates: {
                        roots:    (w) => w.parent == null,
                        leaves:   (w, all) => !all.some(x => x.parent === w.id),
                        featured: (w) => !!w.featured,
                        large:    (w) => (w.items || 0) >= 40,
                    },

                    kpis: [
                        {
                            label: 'Total', icon: <Layers size={12} />, color: 'var(--app-primary)',
                            filterKey: 'all', hint: 'Clear every filter',
                            value: (_, all) => all.length,
                        },
                        {
                            label: 'Roots', icon: <Tag size={12} />, color: 'var(--app-info)',
                            filterKey: 'roots', hint: 'Top-level nodes',
                            value: (f) => f.filter((w: any) => w.parent == null).length,
                        },
                        {
                            label: 'Leaves', icon: <Folder size={12} />, color: 'var(--app-success)',
                            filterKey: 'leaves', hint: 'Nodes without children',
                            value: (f, all) => f.filter((w: any) => !all.some((x: any) => x.parent === w.id)).length,
                        },
                        {
                            label: 'Featured', icon: <Star size={12} />, color: 'var(--app-warning)',
                            filterKey: 'featured', hint: 'Marked as featured',
                            value: (f) => f.filter((w: any) => w.featured).length,
                        },
                        {
                            label: 'Large', icon: <Flame size={12} />, color: 'var(--app-error)',
                            filterKey: 'large', hint: '≥ 40 items',
                            value: (f) => f.filter((w: any) => (w.items || 0) >= 40).length,
                        },
                    ],
                    columnHeaders: [
                        { label: 'Widget', width: 'auto' },
                        { label: 'Code',   width: '80px',  hideOnMobile: true },
                        { label: 'Items',  width: '64px',  color: 'var(--app-primary)' },
                    ],
                    emptyState: {
                        icon: <ShoppingCart size={36} />,
                        title: (has) => has ? 'No matches' : 'No widgets',
                        subtitle: (has) => has ? 'Try a different search term.' : 'Create the first widget to begin.',
                        actionLabel: 'Create First Widget',
                    },
                    footerLeft: (_, all) => (
                        <span>{all.length} demo widgets · search, KPI filter, split panel all owned by the template</span>
                    ),
                }}
                detailPanel={(node, { onClose }) => (
                    <div className="h-full flex flex-col" style={{ background: 'var(--app-surface)' }}>
                        <div className="flex items-center justify-between gap-2 px-4 py-3"
                            style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'var(--app-primary)' }}>
                                    <Package size={13} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-tp-md font-bold text-app-foreground truncate">{node.name}</h3>
                                    <p className="text-tp-xxs font-mono text-app-muted-foreground">{node.code}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground px-2 py-1 rounded-lg text-tp-xs">Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {[
                                ['Code', node.code],
                                ['Items', String(node.items)],
                                ['Featured', node.featured ? 'Yes' : 'No'],
                                ['Parent ID', node.parent ?? 'root'],
                            ].map(([k, v]) => (
                                <div key={k as string} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                                    <span className="text-tp-xxs font-bold uppercase tracking-wide w-20"
                                        style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                                    <span className="text-tp-sm font-bold text-app-foreground">{v as any}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            >
                {({ tree, expandKey, expandAll, isSelected, openNode }) => {
                    const renderNode = (node: any, level: number): any => (
                        <div key={`${node.id}-${expandKey}`}>
                            <div style={{ paddingLeft: level * 20 }}>
                                <MasterListCard
                                    icon={node.children?.length ? <FolderOpen size={13} /> : <Folder size={13} />}
                                    accentColor={node.featured ? 'var(--app-warning)' : 'var(--app-primary)'}
                                    title={node.name}
                                    subtitle={
                                        <span className="flex items-center gap-1 font-mono">{node.code}</span>
                                    }
                                    badges={node.featured ? [{ label: 'Featured', color: 'var(--app-warning)', icon: <Star size={9} /> }] : []}
                                    rightSlot={
                                        <>
                                            <div className="hidden sm:flex w-20 justify-center text-tp-xs font-mono text-app-muted-foreground">
                                                {node.code}
                                            </div>
                                            <div className="w-16 text-right font-bold tabular-nums text-app-foreground">
                                                {node.items}
                                            </div>
                                        </>
                                    }
                                    isSelected={isSelected(node)}
                                    onClick={() => openNode(node)}
                                />
                            </div>
                            {node.children?.length > 0 && (expandAll ?? level < 1) && node.children.map((c: any) => renderNode(c, level + 1))}
                        </div>
                    )
                    return tree.map((n: any) => renderNode(n, 0))
                }}
            </TreeMasterPage>
        </div>
    )
}
