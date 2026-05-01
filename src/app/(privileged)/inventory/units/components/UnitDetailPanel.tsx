'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    ChevronRight, Plus, Pencil, X, Ruler, Trash2, Layers, Package, GitBranch,
    Bookmark, Scale, Loader2, ArrowRightLeft, ArrowUpDown, Box, Calculator,
} from 'lucide-react'
import { toast } from 'sonner'
import { getUnitPackaging, listUnitPackages, deleteUnitPackage } from '@/app/actions/inventory/units'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { EntityProductsTab } from '@/components/templates/EntityProductsTab'
import { erpFetch } from '@/lib/erp-api'
import { TemplateFormModal } from '@/app/(privileged)/inventory/packages/_shared/TemplateFormModal'
import type { UnitNode } from './UnitRow'

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL — 4 tabs: Overview, Products, Packages, Calculator
 * ═══════════════════════════════════════════════════════════ */
type PanelTab = 'overview' | 'products' | 'packages' | 'calculator'

type LinkedPackage = {
    id: number
    name?: string
    ratio?: number | string
    product_name?: string
    barcode?: string
    selling_price?: number | string
    is_default_sale?: boolean
    is_default_purchase?: boolean
}

type UnitPackageTemplate = {
    id: number
    name?: string
    code?: string
    ratio?: number | string
    is_default?: boolean
}

interface UnitDetailPanelProps {
    node: UnitNode
    onEdit: (n: UnitNode) => void
    onAdd: (parentId?: number) => void
    onDelete: (n: UnitNode) => void
    allUnits: UnitNode[]
    initialTab?: PanelTab | string
    onClose?: () => void
    onPin?: (n: UnitNode) => void
}

export function UnitDetailPanel({ node, onEdit, onAdd, onDelete, allUnits, initialTab, onClose, onPin }: UnitDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<PanelTab>((initialTab as PanelTab) ?? 'overview')
    const [packages, setPackages] = useState<LinkedPackage[]>([])
    const [pkgLoading, setPkgLoading] = useState(false)
    const [pkgLoaded, setPkgLoaded] = useState(false)
    const [unitPackages, setUnitPackages] = useState<UnitPackageTemplate[]>([])
    const [unitPkgLoading, setUnitPkgLoading] = useState(false)
    const [showNewPkg, setShowNewPkg] = useState(false)

    const reloadUnitPackages = useCallback(async () => {
        setUnitPkgLoading(true)
        try {
            const list = (await listUnitPackages(node.id)) as UnitPackageTemplate[]
            setUnitPackages(list)
        } catch { /* noop */ }
        setUnitPkgLoading(false)
    }, [node.id])

    const isBase = !node.base_unit
    const children = allUnits.filter((u) => u.base_unit === node.id)
    const parent = allUnits.find((u) => u.id === node.base_unit)
    const productCount = node.product_count ?? 0
    const childCount = children.length

    useEffect(() => { setActiveTab((initialTab as PanelTab) ?? 'overview') }, [node.id, initialTab])
    useEffect(() => { setPkgLoaded(false); setPackages([]); setUnitPackages([]); setShowNewPkg(false) }, [node.id])

    useEffect(() => {
        if (activeTab === 'packages' && !pkgLoaded) {
            setPkgLoading(true)
            getUnitPackaging(node.id)
                .then((data) => { setPackages((data ?? []) as LinkedPackage[]); setPkgLoaded(true); setPkgLoading(false) })
                .catch(() => setPkgLoading(false))
            reloadUnitPackages()
        }
    }, [activeTab, node.id, pkgLoaded, reloadUnitPackages])

    const tabs = [
        { key: 'overview' as PanelTab, label: 'Overview', icon: <Layers size={13} />, color: 'var(--app-info)' },
        { key: 'products' as PanelTab, label: 'Products', icon: <Package size={13} />, count: productCount, color: 'var(--app-success)' },
        { key: 'packages' as PanelTab, label: 'Packages', icon: <Box size={13} />, count: packages.length || undefined, color: 'var(--app-info)' },
        { key: 'calculator' as PanelTab, label: 'Calculator', icon: <Calculator size={13} />, color: 'var(--app-warning)' },
    ]

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-info) 4%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>
                        <Ruler size={15} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-tp-lg font-bold text-app-foreground tracking-tight truncate">{node.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && <span className="font-mono text-tp-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{node.code}</span>}
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                {isBase ? 'Base Unit' : 'Derived'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && <button onClick={() => onPin(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Pin"><Bookmark size={14} /></button>}
                    <button onClick={() => onEdit(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => onAdd(node.id)} className="flex items-center gap-1 text-tp-xs font-semibold bg-app-primary hover:brightness-110 text-white px-2 py-1.5 rounded-lg transition-all"><Plus size={12} /></button>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors ml-1" title="Close"><X size={14} /></button>}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', scrollbarWidth: 'none' }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-1.5 text-tp-sm font-semibold px-3 py-2.5 transition-colors whitespace-nowrap"
                            style={{ color: isActive ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', borderBottom: isActive ? '2px solid var(--app-info)' : '2px solid transparent', marginBottom: '-1px' }}>
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="text-tp-xxs font-bold px-1 py-0.5 rounded min-w-[16px] text-center"
                                    style={{ background: `color-mix(in srgb, ${tab.color} 10%, transparent)`, color: tab.color }}>{tab.count}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ─── OVERVIEW TAB ─── */}
                {activeTab === 'overview' && (
                    <div className="p-3 space-y-3 animate-in fade-in duration-150">
                        {/* Info strip */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {node.code && <span className="font-mono text-tp-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{node.code}</span>}
                            {node.short_name && <span className="text-tp-xs font-medium px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>{node.short_name}</span>}
                            <span className="text-tp-xxs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ background: isBase ? 'color-mix(in srgb, var(--app-info) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: isBase ? 'var(--app-info)' : 'var(--app-muted-foreground)' }}>
                                {isBase ? 'Base Unit' : `×${node.conversion_factor || 1}`}
                            </span>
                            {node.needs_balance && <Scale size={13} style={{ color: 'var(--app-warning)' }} title="Requires weighing scale" />}
                        </div>

                        {/* Stat Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            {[
                                { label: 'Derived', value: childCount, icon: <GitBranch size={13} />, color: 'var(--app-info)', tab: null },
                                { label: 'Products', value: productCount, icon: <Package size={13} />, color: 'var(--app-success)', tab: 'products' as PanelTab },
                                { label: 'Factor', value: `×${node.conversion_factor || 1}`, icon: <ArrowRightLeft size={13} />, color: 'var(--app-info)', tab: null },
                                { label: 'Type', value: node.type || 'Standard', icon: <Ruler size={13} />, color: 'var(--app-warning)', tab: null },
                            ].map(s => (
                                <button key={s.label} onClick={() => s.tab && setActiveTab(s.tab)}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-default'}`}
                                    style={{ background: `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${s.color} 15%, transparent)` }}>
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>{s.icon}</div>
                                    <div className="min-w-0">
                                        <div className="text-tp-lg font-bold tabular-nums leading-tight" style={{ color: 'var(--app-foreground)' }}>{s.value}</div>
                                        <div className="text-tp-xs font-medium leading-none" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Conversion info */}
                        {parent && (
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                                    <ArrowUpDown size={12} style={{ color: 'var(--app-info)' }} />
                                    <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-info)' }}>Conversion</span>
                                </div>
                                <div className="px-4 py-3">
                                    <div className="flex items-center gap-2 text-tp-md font-semibold text-app-foreground">
                                        <span className="font-bold">1</span><span>{node.name}</span>
                                        <ChevronRight size={12} className="text-app-muted-foreground" />
                                        <span className="font-bold">{node.conversion_factor || 1}</span><span>{parent.name}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Derived units */}
                        {childCount > 0 && (
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                <div className="flex items-center justify-between px-4 py-2" style={{ background: 'color-mix(in srgb, var(--app-info) 4%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                                    <div className="flex items-center gap-2"><GitBranch size={12} style={{ color: 'var(--app-info)' }} /><span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-info)' }}>Derived Units</span></div>
                                    <span className="text-tp-xs font-semibold" style={{ color: 'var(--app-info)' }}>{childCount}</span>
                                </div>
                                <div className="divide-y divide-app-border/30">
                                    {children.map((child) => (
                                        <div key={child.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-app-surface-hover transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-tp-xxs font-bold" style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)' }}>
                                                    {child.short_name?.substring(0, 2) || child.name?.substring(0, 2)}
                                                </div>
                                                <div><span className="text-tp-md font-semibold text-app-foreground">{child.name}</span>{child.code && <span className="text-tp-xxs font-mono text-app-muted-foreground ml-1.5">{child.code}</span>}</div>
                                            </div>
                                            <span className="text-tp-sm font-semibold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>×{child.conversion_factor || 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {childCount === 0 && (
                            <div className="rounded-xl py-3 px-3 text-center" style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                <p className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>No derived units</p>
                                <button onClick={() => onAdd(node.id)} className="mt-1.5 text-tp-sm font-semibold px-2.5 py-1 rounded-lg mx-auto flex items-center gap-1 transition-colors" style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                                    <Plus size={10} /> Add Derived Unit
                                </button>
                            </div>
                        )}

                        {node.needs_balance && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                                <Scale size={14} style={{ color: 'var(--app-warning)' }} />
                                <span className="text-tp-sm font-semibold" style={{ color: 'var(--app-warning)' }}>This unit requires a weighing scale at POS</span>
                            </div>
                        )}

                        {!isBase && childCount === 0 && (
                            <button onClick={() => onDelete(node)} className="w-full flex items-center justify-center gap-1.5 text-tp-sm font-semibold px-3 py-2 rounded-xl border transition-colors hover:brightness-105"
                                style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <Trash2 size={12} /> Delete Unit
                            </button>
                        )}
                    </div>
                )}

                {/* ─── PRODUCTS TAB ─── */}
                {activeTab === 'products' && (
                    <EntityProductsTab config={{
                        entityType: 'unit',
                        entityId: node.id,
                        entityName: node.name,
                        exploreEndpoint: `units/${node.id}/explore/`,
                        moveEndpoint: 'units/move_products/',
                        moveTargetKey: 'target_unit_id',
                        moveTargets: allUnits.filter((u) => u.id !== node.id),
                        moveLabel: 'Move to Unit',
                        moveIcon: <Ruler size={12} />,
                    }} />
                )}

                {/* ─── PACKAGES TAB — simplified ─── */}
                {activeTab === 'packages' && (
                    <div className="p-3 space-y-4 animate-in fade-in duration-150">

                        {/* Unit Package Templates (CRUD) */}
                        <section className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center justify-between px-4 py-2.5"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}><Box size={13} /></div>
                                    <div>
                                        <div className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>Package Templates</div>
                                        <div className="text-tp-xxs font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>{unitPackages.length} template{unitPackages.length !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowNewPkg(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-tp-xs font-semibold transition-colors"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Plus size={11} /> New Template
                                </button>
                            </div>

                            <div className="p-3 space-y-2">
                                {/* Package list */}
                                {unitPkgLoading ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} /></div>
                                ) : unitPackages.length > 0 ? (
                                    <div className="divide-y divide-app-border/30 rounded-lg overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                        {unitPackages.map((pkg) => (
                                            <div key={pkg.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-app-surface-hover transition-colors group">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}><Box size={12} /></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-tp-md font-semibold truncate" style={{ color: 'var(--app-foreground)' }}>{pkg.name}</span>
                                                        {pkg.code && <span className="text-tp-xxs font-mono font-semibold px-1 py-0.5 rounded" style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>{pkg.code}</span>}
                                                        {pkg.is_default && <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>DEFAULT</span>}
                                                    </div>
                                                    <div className="text-tp-xs font-mono mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        1 {pkg.name} = <span className="font-bold" style={{ color: 'var(--app-primary)' }}>{Number(pkg.ratio).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span> {node.name}{Number(pkg.ratio) !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                                <button type="button" onClick={async () => {
                                                    if (!confirm(`Delete "${pkg.name}"?`)) return
                                                    try { await deleteUnitPackage(pkg.id); toast.success(`Package "${pkg.name}" removed`); await reloadUnitPackages() } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
                                                }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity" style={{ color: 'var(--app-error, #ef4444)' }} title="Delete">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : !showNewPkg && (
                                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-lg"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                        <Box size={24} style={{ color: 'var(--app-primary)' }} className="mb-2 opacity-60" />
                                        <p className="text-tp-md font-semibold" style={{ color: 'var(--app-foreground)' }}>No package templates yet</p>
                                        <p className="text-tp-sm mt-1 max-w-sm" style={{ color: 'var(--app-muted-foreground)' }}>Define standard packagings like "Pack of 6" or "Carton 24".</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Linked Product Packaging (read-only) */}
                        {(pkgLoading || packages.length > 0) && (
                            <section>
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <Package size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                                    <span className="text-tp-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted-foreground)' }}>Linked Product Packaging</span>
                                    <span className="text-tp-xxs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>{packages.length}</span>
                                </div>
                                {pkgLoading ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 size={14} className="animate-spin text-app-muted-foreground" /></div>
                                ) : (
                                    <div className="rounded-lg overflow-hidden divide-y divide-app-border/30" style={{ border: '1px solid var(--app-border)' }}>
                                        {packages.map((pkg) => (
                                            <div key={pkg.id} className="flex items-center gap-2 px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-tp-md font-semibold text-app-foreground truncate">{pkg.name}</div>
                                                    <div className="flex items-center gap-2 text-tp-xxs text-app-muted-foreground">
                                                        <span className="font-mono">×{pkg.ratio}</span>
                                                        {pkg.product_name && <span>• {pkg.product_name}</span>}
                                                        {pkg.barcode && <span className="font-mono">• {pkg.barcode}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-tp-sm font-bold tabular-nums text-app-foreground">{Number(pkg.selling_price || 0).toLocaleString()}</div>
                                                    <div className="flex items-center gap-1 text-tp-xxs font-semibold">
                                                        {pkg.is_default_sale && <span className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>SALE</span>}
                                                        {pkg.is_default_purchase && <span className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>BUY</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}

                {/* ─── CALCULATOR TAB ─── */}
                {activeTab === 'calculator' && (
                    <div className="p-3 animate-in fade-in duration-150">
                        {/* UnitCalculator requires `code: string`; UnitNode types it optional. Coerce per row at the boundary. */}
                        <UnitCalculator
                            units={allUnits.map((u) => ({ ...u, code: u.code ?? '' }))}
                            defaultUnit={{ ...node, code: node.code ?? '' }}
                            variant="embedded"
                        />
                    </div>
                )}
            </div>

            {/* Shared "New Template" modal — same backend as /inventory/packages.
             * Unit is locked to the one this panel was opened for. */}
            {showNewPkg && (
                <TemplateFormModal
                    units={allUnits.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
                    allTemplates={unitPackages.map((p) => ({
                        id: p.id,
                        name: p.name,
                        code: p.code,
                        ratio: typeof p.ratio === 'number' ? p.ratio : Number(p.ratio ?? 0),
                        is_default: p.is_default,
                    }))}
                    lockedUnitId={node.id}
                    onClose={() => setShowNewPkg(false)}
                    onSave={async (data) => {
                        try {
                            await erpFetch('unit-packages/', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...data, unit: node.id }),
                            })
                            toast.success(`Template "${data.name}" created`)
                            setShowNewPkg(false)
                            await reloadUnitPackages()
                        } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : 'Failed to create template')
                            throw e
                        }
                    }}
                />
            )}
        </div>
    )
}
