// @ts-nocheck
'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { buildTree } from '@/lib/utils/tree'
import { UnitTree } from '@/components/admin/UnitTree'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { BalanceBarcodeConfigModal } from '@/components/admin/BalanceBarcodeConfigModal'
import {
    Search, Plus, Layers, Package, Ruler, ArrowRightLeft,
    Wrench, Scale, Hash, X, Pencil, Trash2, ChevronRight,
    Bookmark, Info, ArrowUpDown
} from 'lucide-react'
import { MasterDataPage } from '@/components/templates/MasterDataPage'

/* ═══════════════════════════════════════════════════════════
 *  UNIT DETAIL PANEL — shown in drawer / split / pinned
 * ═══════════════════════════════════════════════════════════ */
function UnitDetailPanel({
    unit,
    allUnits,
    tab,
    onClose,
    onPin,
    onEdit,
}: {
    unit: any
    allUnits: any[]
    tab: string
    onClose: () => void
    onPin: () => void
    onEdit: (u: any) => void
}) {
    const isBase = !unit.base_unit
    const children = allUnits.filter(u => u.base_unit === unit.id)
    const parent = allUnits.find(u => u.id === unit.base_unit)

    return (
        <div className="flex flex-col h-full" data-tour="detail-drawer">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))' }}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: `linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))`,
                            color: '#fff',
                            boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 25%, transparent)',
                        }}>
                        <Ruler size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-app-foreground truncate">{unit.name}</h3>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {isBase ? 'Base Unit' : `Derived · ×${unit.conversion_factor || 1}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={onPin} title="Pin sidebar"
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-primary hover:bg-app-surface transition-all">
                        <Bookmark size={13} />
                    </button>
                    <button onClick={() => onEdit(unit)} title="Edit"
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                        <Pencil size={13} />
                    </button>
                    <button onClick={onClose} title="Close"
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                        <X size={13} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Code', value: unit.code || '—', icon: <Hash size={11} />, color: 'var(--app-primary)' },
                        { label: 'Short Name', value: unit.short_name || '—', icon: <Info size={11} />, color: 'var(--app-info)' },
                        { label: 'Products', value: unit.product_count || 0, icon: <Package size={11} />, color: 'var(--app-success)' },
                        { label: 'Type', value: unit.type || 'Standard', icon: <Ruler size={11} />, color: '#8b5cf6' },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-[12px] font-black text-app-foreground truncate">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Conversion Info */}
                {parent && (
                    <div className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                            <ArrowUpDown size={12} style={{ color: 'var(--app-info)' }} />
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Conversion</span>
                        </div>
                        <div className="px-4 py-3" style={{ background: 'var(--app-surface)' }}>
                            <div className="flex items-center gap-2 text-[12px] font-bold text-app-foreground">
                                <span className="font-black">1</span>
                                <span>{unit.name}</span>
                                <ChevronRight size={12} className="text-app-muted-foreground" />
                                <span className="font-black">{unit.conversion_factor || 1}</span>
                                <span>{parent.name}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Derived Units */}
                {children.length > 0 && (
                    <div className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid color-mix(in srgb, #8b5cf6 20%, transparent)' }}>
                        <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ background: 'color-mix(in srgb, #8b5cf6 5%, transparent)', borderBottom: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
                            <div className="flex items-center gap-2">
                                <Package size={12} style={{ color: '#8b5cf6' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#8b5cf6' }}>
                                    Derived Units
                                </span>
                            </div>
                            <span className="text-[10px] font-bold" style={{ color: '#8b5cf6' }}>{children.length}</span>
                        </div>
                        <div className="divide-y divide-app-border/30" style={{ background: 'var(--app-surface)' }}>
                            {children.map(child => (
                                <div key={child.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-app-background/50 transition-all">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black"
                                            style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6' }}>
                                            {child.short_name?.substring(0, 2) || child.name?.substring(0, 2)}
                                        </div>
                                        <div>
                                            <span className="text-[12px] font-bold text-app-foreground">{child.name}</span>
                                            {child.code && <span className="text-[9px] font-mono text-app-muted-foreground ml-1.5">{child.code}</span>}
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>
                                        ×{child.conversion_factor || 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Scale / Balance */}
                {unit.needs_balance && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                        <Scale size={14} style={{ color: 'var(--app-warning)' }} />
                        <span className="text-[11px] font-bold" style={{ color: 'var(--app-warning)' }}>
                            This unit requires a weighing scale at POS
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const router = useRouter()
    const data = initialUnits
    const [showCalc, setShowCalc] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showBarcodeConfig, setShowBarcodeConfig] = useState(false)
    const [editingUnit, setEditingUnit] = useState<any>(null)
    const [formKey, setFormKey] = useState(0)

    const openForm = useCallback(() => { setEditingUnit(null); setFormKey(k => k + 1); setIsFormOpen(true) }, [])
    const openEditForm = useCallback((u: any) => { setEditingUnit(u); setFormKey(k => k + 1); setIsFormOpen(true) }, [])
    const handleFormClose = useCallback(() => { setIsFormOpen(false) }, [])
    const handleFormSuccess = useCallback(() => { setIsFormOpen(false); router.refresh() }, [router])

    const stats = useMemo(() => {
        const baseCount = data.filter(u => !u.base_unit).length
        const derivedCount = data.filter(u => u.base_unit).length
        const totalProducts = data.reduce((s: number, u: any) => s + (u.product_count || 0), 0)
        const scaleUnits = data.filter(u => u.needs_balance).length
        return { total: data.length, base: baseCount, derived: derivedCount, totalProducts, scaleUnits }
    }, [data])

    return (
        <MasterDataPage
            config={{
                title: 'Units & Packaging',
                subtitle: `${stats.total} Units · Hierarchical Conversions`,
                icon: <Ruler size={20} />,
                iconColor: 'var(--app-info)',

                kpis: [
                    { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-primary)' },
                    { label: 'Base', value: stats.base, icon: <Ruler size={11} />, color: 'var(--app-info)' },
                    { label: 'Derived', value: stats.derived, icon: <Package size={11} />, color: '#8b5cf6' },
                    { label: 'Products', value: stats.totalProducts, icon: <Hash size={11} />, color: 'var(--app-success)' },
                    { label: 'Scale', value: stats.scaleUnits, icon: <Scale size={11} />, color: 'var(--app-warning)' },
                    { label: 'Showing', value: stats.total, icon: <Search size={11} />, color: 'var(--app-muted-foreground)' },
                ],

                searchPlaceholder: 'Search by name, code, or type... (Ctrl+K)',
                enableDetailPanel: true,

                primaryAction: { label: 'New Unit', icon: <Plus size={14} />, onClick: openForm },
                secondaryActions: [
                    {
                        label: 'Calculator', icon: <ArrowRightLeft size={13} />,
                        onClick: () => setShowCalc(p => !p),
                        active: showCalc, activeColor: 'var(--app-info)',
                    },
                    { label: 'Barcode', icon: <Scale size={13} />, onClick: () => setShowBarcodeConfig(true) },
                    { label: 'Cleanup', icon: <Wrench size={13} />, href: '/inventory/maintenance?tab=unit' },
                ],

                contentHeader: 'Unit Hierarchies',

                footerLeft: (
                    <>
                        <span>{stats.total} defined units</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.base} base</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.derived} derived</span>
                    </>
                ),
            }}
            modals={
                <>
                    <UnitFormModal
                        key={formKey}
                        isOpen={isFormOpen}
                        onClose={handleFormClose}
                        onSuccess={handleFormSuccess}
                        potentialParents={data}
                    />
                    <BalanceBarcodeConfigModal isOpen={showBarcodeConfig} onClose={() => setShowBarcodeConfig(false)} />
                </>
            }
            detailPanel={(unit, { tab, onClose, onPin }) => (
                <UnitDetailPanel
                    unit={unit}
                    allUnits={data}
                    tab={tab}
                    onClose={onClose}
                    onPin={onPin}
                    onEdit={openEditForm}
                />
            )}
        >
            {({ searchQuery, expandAll, expandKey, splitPanel, selectedNode, setSelectedNode, setDrawerNode }) => {
                let filtered = data
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase()
                    filtered = filtered.filter(u =>
                        u.name?.toLowerCase().includes(q) ||
                        u.code?.toLowerCase().includes(q) ||
                        u.short_name?.toLowerCase().includes(q) ||
                        u.type?.toLowerCase().includes(q)
                    )
                }
                const tree = buildTree(filtered, 'base_unit')

                // Row click handler: split = select in-panel, else = open drawer
                const handleRowSelect = (node: any) => {
                    if (splitPanel) { setSelectedNode(node) } else { setDrawerNode(node) }
                }

                return (
                    <>
                        {showCalc && (
                            <div className="animate-in slide-in-from-top-2 duration-200 px-4 pt-3">
                                <UnitCalculator units={data} />
                            </div>
                        )}

                        {tree.length > 0 ? (
                            <UnitTree
                                units={tree}
                                potentialParents={data}
                                forceExpanded={expandAll}
                                expandKey={expandKey}
                                onSelect={handleRowSelect}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                    style={{
                                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-info) 15%, transparent), color-mix(in srgb, var(--app-info) 5%, transparent))',
                                        border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)',
                                    }}>
                                    <Ruler size={28} style={{ color: 'var(--app-info)', opacity: 0.7 }} />
                                </div>
                                <p className="text-base font-bold text-app-muted-foreground mb-1">
                                    {searchQuery ? 'No matching units' : 'No units defined yet'}
                                </p>
                                <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                                    {searchQuery
                                        ? 'Try a different search term or clear filters.'
                                        : 'Create a base unit like "Piece" or "KG" to get started.'}
                                </p>
                                {!searchQuery && (
                                    <button onClick={openForm}
                                        className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                        <Plus size={16} className="inline mr-1.5" />Create First Unit
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )
            }}
        </MasterDataPage>
    )
}
