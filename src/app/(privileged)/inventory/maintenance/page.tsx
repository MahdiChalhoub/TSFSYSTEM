// @ts-nocheck
import { erpFetch } from '@/lib/erp-api'
import { getMaintenanceEntities } from '@/app/actions/maintenance'
import { MaintenanceSidebar } from '@/components/admin/maintenance/MaintenanceSidebar'
import { UnifiedReassignmentTable } from '@/components/admin/maintenance/UnifiedReassignmentTable'
import {
    Wrench, Layers, Tag, Ruler, Globe, Package,
    ArrowLeft, ArrowRightLeft, Gauge,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/* ═══════════════════════════════════════════════════════════
 *  INVENTORY MAINTENANCE — Reorganize tool
 *  Picks an entity (category / brand / attribute / unit / country)
 *  from the sidebar, shows its products, lets the user reassign
 *  them to a different target of the same type.
 *  Uses the app's V2 design tokens so it switches with the theme.
 * ═══════════════════════════════════════════════════════════ */

const TAB_CONFIG = [
    { key: 'category', icon: Layers, label: 'Categories', color: 'var(--app-primary)' },
    { key: 'brand', icon: Tag, label: 'Brands', color: 'var(--app-info)' },
    { key: 'attribute', icon: Package, label: 'Attributes', color: 'var(--app-warning)' },
    { key: 'unit', icon: Ruler, label: 'Units', color: 'var(--app-success)' },
    { key: 'country', icon: Globe, label: 'Countries', color: '#8b5cf6' },
] as const

function countAll(list: any[]): number {
    let c = 0
    for (const item of list) {
        c++
        if (item.children) c += countAll(item.children)
    }
    return c
}

function findEntityRecursive(list: any[], id: number): any {
    for (const item of list) {
        if (item.id === id) return item
        if (item.children) {
            const found = findEntityRecursive(item.children, id)
            if (found) return found
        }
    }
    return null
}

export default async function MaintenancePage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams
    const tab = (searchParams.tab as string) || 'category'
    const activeId = searchParams.id ? Number(searchParams.id) : null

    const validTabs = TAB_CONFIG.map(t => t.key) as string[]
    if (!validTabs.includes(tab)) redirect('/inventory/maintenance?tab=category')

    // 1. Entities for the sidebar
    const entities = await getMaintenanceEntities(tab as any)

    // 2. Products when an entity is selected
    let products: any[] = []
    let currentEntityName = `Select a ${tab}`
    if (activeId) {
        const filterKey = tab === 'attribute' ? 'parfum' : tab
        try {
            const res = await erpFetch(`products/?${filterKey}=${activeId}`, { cache: 'no-store' } as any)
            products = Array.isArray(res) ? res : (res?.results ?? [])
        } catch (e) {
            console.error('Maintenance: product fetch failed', e)
        }
        const active = findEntityRecursive(entities, activeId)
        if (active) currentEntityName = active.name
    }

    const entityCount = countAll(entities)
    const safeEntities = JSON.parse(JSON.stringify(entities))
    const safeProducts = JSON.parse(JSON.stringify(products))
    const activeTab = TAB_CONFIG.find(t => t.key === tab)!
    const ActiveIcon = activeTab.icon

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 transition-all overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className="flex-shrink-0 space-y-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/inventory/categories"
                            className="p-2 rounded-xl transition-all"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}
                            aria-label="Back to Categories">
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="page-header-icon"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}>
                            <Wrench size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black tracking-tight"
                                style={{ color: 'var(--app-foreground)' }}>
                                Inventory Maintenance
                            </h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                Reorganize · {entityCount} {activeTab.label.toLowerCase()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <Link href="/inventory/maintenance/data-quality"
                            className="flex items-center gap-1.5 text-tp-sm font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                            style={{
                                color: 'var(--app-warning)',
                                borderColor: 'color-mix(in srgb, var(--app-warning) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)',
                            }}>
                            <Gauge size={13} />
                            <span className="hidden md:inline">Data Quality</span>
                        </Link>
                    </div>
                </div>

                {/* ── Entity-type pills — behave as tabs ── */}
                <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {TAB_CONFIG.map(t => {
                        const isActive = tab === t.key
                        const Icon = t.icon
                        return (
                            <Link key={t.key} href={`/inventory/maintenance?tab=${t.key}`}
                                className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl transition-all text-tp-sm font-bold"
                                style={isActive ? {
                                    background: `color-mix(in srgb, ${t.color} 14%, transparent)`,
                                    border: `1.5px solid ${t.color}`,
                                    color: t.color,
                                    boxShadow: `0 2px 10px color-mix(in srgb, ${t.color} 22%, transparent)`,
                                } : {
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                }}>
                                <Icon size={13} />
                                <span>{t.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* ═══════════════ SPLIT PANEL ═══════════════ */}
            <div className="flex-1 min-h-0 flex gap-3">
                {/* Left: entity picker */}
                <div className="w-[280px] md:w-[320px] flex-shrink-0 bg-app-surface/30 border rounded-2xl overflow-hidden flex flex-col"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <MaintenanceSidebar
                        entities={safeEntities}
                        type={tab}
                        activeId={activeId}
                    />
                </div>

                {/* Right: reassignment workspace */}
                <div className="flex-1 min-w-0 bg-app-surface/30 border rounded-2xl overflow-hidden flex flex-col"
                    style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    {activeId ? (
                        <>
                            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                                style={{
                                    background: `color-mix(in srgb, ${activeTab.color} 5%, var(--app-surface))`,
                                    borderBottom: `1px solid color-mix(in srgb, ${activeTab.color} 25%, var(--app-border))`,
                                }}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: `color-mix(in srgb, ${activeTab.color} 15%, transparent)`,
                                            color: activeTab.color,
                                        }}>
                                        <ActiveIcon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-bold tracking-tight truncate"
                                            style={{ color: 'var(--app-foreground)' }}>
                                            {currentEntityName}
                                        </h2>
                                        <p className="text-tp-xxs font-bold uppercase tracking-widest"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            {products.length} product{products.length !== 1 ? 's' : ''} linked
                                        </p>
                                    </div>
                                </div>
                                <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1"
                                    style={{
                                        background: `color-mix(in srgb, ${activeTab.color} 10%, transparent)`,
                                        color: activeTab.color,
                                        border: `1px solid color-mix(in srgb, ${activeTab.color} 22%, transparent)`,
                                    }}>
                                    <ArrowRightLeft size={10} /> Reassign
                                </span>
                            </div>
                            <div className="flex-1 min-h-0">
                                <UnifiedReassignmentTable
                                    products={safeProducts}
                                    targetEntities={safeEntities}
                                    type={tab as any}
                                    currentEntityId={activeId}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center px-4 text-center">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                style={{
                                    background: `color-mix(in srgb, ${activeTab.color} 10%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${activeTab.color} 20%, transparent)`,
                                }}>
                                <ActiveIcon size={28} style={{ color: activeTab.color, opacity: 0.7 }} />
                            </div>
                            <p className="text-sm font-bold mb-1" style={{ color: 'var(--app-foreground)' }}>
                                Select a {tab} from the sidebar
                            </p>
                            <p className="text-tp-sm max-w-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                Choose an item to view its linked products. You can reassign them to a different {tab === 'category' ? 'category' : tab} without deleting any data.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
