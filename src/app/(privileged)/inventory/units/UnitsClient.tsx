// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    ChevronRight, Plus, Pencil, X, Search, Ruler, Trash2, Layers, Package, GitBranch,
    Bookmark, AlertCircle, Scale, Hash, Loader2, ExternalLink, Info, ArrowRightLeft,
    ArrowUpDown, ShoppingCart, Wrench, Box, Calculator, SlidersHorizontal, ArrowDownAZ,
    ArrowUpAZ, ChevronDown, Filter, Save
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteUnit, getUnitPackaging, listUnitPackages, createUnitPackage, updateUnitPackage, deleteUnitPackage } from '@/app/actions/inventory/units'
import { buildTree } from '@/lib/utils/tree'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { BalanceBarcodeConfigModal } from '@/components/admin/BalanceBarcodeConfigModal'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { EntityProductsTab } from '@/components/templates/EntityProductsTab'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/inventory-units'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  UNIT ROW — matches CategoryRow design exactly
 * ═══════════════════════════════════════════════════════════ */
const UnitRow = ({ node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded, onViewProducts, onSelect, allUnits }: any) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)
    const prevForceExpanded = useRef(forceExpanded)
    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => {
        if (forceExpanded !== undefined && forceExpanded !== prevForceExpanded.current) setIsOpen(forceExpanded)
        prevForceExpanded.current = forceExpanded
    }, [forceExpanded])

    const isBase = level === 0
    const productCount = node.product_count ?? 0
    const childCount = node.children?.length ?? 0
    const convFactor = node.conversion_factor ?? 1

    return (
        <div>
            <div className={`group flex items-center gap-2.5 transition-all duration-200 relative cursor-pointer
                ${level === 0 ? 'py-2.5 md:py-3 hover:brightness-105' : 'py-1.5 md:py-2 hover:brightness-105'}`}
                onClick={(e) => { e.stopPropagation(); if (isParent) setIsOpen(o => !o); else onSelect?.(node) }}
                onDoubleClick={(e) => { e.stopPropagation(); onSelect?.(node) }}
                style={{
                    paddingLeft: `${12 + (level > 0 ? level * 18 : 0)}px`, paddingRight: '12px',
                    background: isBase ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-info) 6%, var(--app-surface)) 0%, var(--app-surface) 100%)' : 'transparent',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                }}>
                {isBase && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, var(--app-info), color-mix(in srgb, var(--app-info) 40%, transparent))' }} />}
                {level > 0 && <div className="absolute top-0 bottom-0" style={{ left: `${8 + (level - 1) * 18}px`, width: '1px', background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }} />}

                <button onClick={(e) => { e.stopPropagation(); isParent && setIsOpen(!isOpen) }}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/40' : ''}`}>
                    {isParent ? (
                        <div className={`w-2 h-2 rounded-sm transition-all duration-200 ${isOpen ? 'rotate-45 scale-110' : ''}`}
                            style={{ background: isOpen ? 'var(--app-info)' : 'color-mix(in srgb, var(--app-muted-foreground) 60%, transparent)' }} />
                    ) : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-info) 35%, transparent)' }} />}
                </button>

                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                    style={{
                        background: isBase ? 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))' : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                        color: isBase ? '#fff' : 'var(--app-muted-foreground)',
                        boxShadow: isBase ? '0 2px 8px color-mix(in srgb, var(--app-info) 20%, transparent)' : 'none',
                    }}>
                    <Ruler size={isBase ? 13 : 12} />
                </div>

                <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onSelect?.(node) }}>
                    <div className="flex items-center gap-1.5">
                        <span className={`truncate text-[13px] ${isBase ? 'font-black text-app-foreground' : 'font-semibold text-app-foreground'}`}>{node.name}</span>
                        {isBase && <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))', color: '#fff' }}>BASE</span>}
                        {node.needs_balance && <Scale size={10} style={{ color: 'var(--app-warning)', flexShrink: 0 }} />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {node.code && <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{node.code}</span>}
                        {node.short_name && <span className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider opacity-60">{node.short_name}</span>}
                    </div>
                </div>

                <div className="hidden sm:flex w-12 flex-shrink-0 justify-center">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md tabular-nums"
                        style={{ background: isParent ? 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' : 'transparent', color: isParent ? 'var(--app-foreground)' : 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>
                        {isParent ? childCount : '–'}
                    </span>
                </div>

                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums"
                        style={!isBase ? { color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 8%, transparent)' } : { color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>
                        <ArrowRightLeft size={9} />{isBase ? '1:1' : `×${convFactor}`}
                    </span>
                </div>

                <div className="hidden sm:flex w-14 flex-shrink-0 justify-center">
                    <button onClick={(e) => { e.stopPropagation(); onViewProducts(node) }}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 tabular-nums transition-all hover:scale-105"
                        style={productCount > 0 ? { color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 8%, transparent)' } : { color: 'color-mix(in srgb, var(--app-muted-foreground) 40%, transparent)' }}>
                        <Package size={9} />{productCount}
                    </button>
                </div>

                <div className="w-[68px] flex items-center justify-end gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-all" title="Edit"><Pencil size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onAdd(node.id) }} className="p-1.5 hover:bg-app-border/40 rounded-lg text-app-muted-foreground hover:text-app-info transition-all" title="Add derived"><Plus size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); if (isParent) { toast.error('Delete derived units first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/40 rounded-lg transition-all"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}>
                        {isParent ? <AlertCircle size={11} /> : <Trash2 size={11} />}
                    </button>
                </div>
            </div>
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children.map((child: any) => (
                        <UnitRow key={child.id} node={child} level={level + 1} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete}
                            onViewProducts={onViewProducts} onSelect={onSelect} searchQuery={searchQuery} forceExpanded={forceExpanded} allUnits={allUnits} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  DETAIL PANEL — 4 tabs: Overview, Products, Packages, Calculator
 * ═══════════════════════════════════════════════════════════ */
type PanelTab = 'overview' | 'products' | 'packages' | 'calculator'

function UnitDetailPanel({ node, onEdit, onAdd, onDelete, allUnits, initialTab, onClose, onPin }: any) {
    const [activeTab, setActiveTab] = useState<PanelTab>((initialTab as PanelTab) ?? 'overview')
    // Packages state — product-level (read-only) AND unit-level (CRUD)
    const [packages, setPackages] = useState<any[]>([])
    const [pkgLoading, setPkgLoading] = useState(false)
    const [pkgLoaded, setPkgLoaded] = useState(false)
    // Unit-level packages
    const [unitPackages, setUnitPackages] = useState<any[]>([])
    const [unitPkgLoading, setUnitPkgLoading] = useState(false)
    const [showNewPkg, setShowNewPkg] = useState(false)
    const [newPkgName, setNewPkgName] = useState('')
    const [newPkgRatio, setNewPkgRatio] = useState<string>('')
    const [newPkgCode, setNewPkgCode] = useState('')
    const [savingPkg, setSavingPkg] = useState(false)

    const reloadUnitPackages = useCallback(async () => {
        setUnitPkgLoading(true)
        try {
            const data = await listUnitPackages(node.id)
            setUnitPackages(data)
        } catch { /* noop */ }
        setUnitPkgLoading(false)
    }, [node.id])

    const isBase = !node.base_unit
    const children = allUnits.filter((u: any) => u.base_unit === node.id)
    const parent = allUnits.find((u: any) => u.id === node.base_unit)
    const productCount = node.product_count ?? 0
    const childCount = children.length

    useEffect(() => { setActiveTab((initialTab as PanelTab) ?? 'overview') }, [node.id, initialTab])
    useEffect(() => { setPkgLoaded(false); setPackages([]); setUnitPackages([]); setShowNewPkg(false) }, [node.id])

    // Load packages
    useEffect(() => {
        if (activeTab === 'packages' && !pkgLoaded) {
            setPkgLoading(true)
            getUnitPackaging(node.id)
                .then((data: any) => { setPackages(data); setPkgLoaded(true); setPkgLoading(false) })
                .catch(() => setPkgLoading(false))
            // Load unit-level packages in parallel
            reloadUnitPackages()
        }
    }, [activeTab, node.id, pkgLoaded])

    const tabs = [
        { key: 'overview' as PanelTab, label: 'Overview', icon: <Layers size={12} />, color: 'var(--app-info)' },
        { key: 'products' as PanelTab, label: 'Products', icon: <Package size={12} />, count: productCount, color: 'var(--app-success)' },
        { key: 'packages' as PanelTab, label: 'Packages', icon: <Box size={12} />, count: packages.length || undefined, color: '#8b5cf6' },
        { key: 'calculator' as PanelTab, label: 'Calculator', icon: <Calculator size={12} />, color: 'var(--app-warning)' },
    ]

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--app-surface)' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--app-info) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--app-info)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                        <Ruler size={15} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-app-foreground tracking-tight truncate">{node.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {node.code && <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{node.code}</span>}
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                {isBase ? 'Base Unit' : 'Derived'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {onPin && <button onClick={() => onPin(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Pin"><Bookmark size={14} /></button>}
                    <button onClick={() => onEdit(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => onAdd(node.id)} className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-2 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}><Plus size={12} /></button>
                    {onClose && <button onClick={onClose} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors ml-1" title="Close"><X size={14} /></button>}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex-shrink-0 flex items-center px-3 overflow-x-auto"
                style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', scrollbarWidth: 'none' }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2.5 transition-all whitespace-nowrap"
                            style={{ color: isActive ? 'var(--app-foreground)' : 'var(--app-muted-foreground)', borderBottom: isActive ? '2px solid var(--app-info)' : '2px solid transparent', marginBottom: '-1px' }}>
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="text-[9px] font-black px-1 py-0.5 rounded min-w-[16px] text-center"
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
                        <div className="flex items-center gap-2 flex-wrap">
                            {node.code && <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{node.code}</span>}
                            {node.short_name && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>{node.short_name}</span>}
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ background: isBase ? 'linear-gradient(135deg, var(--app-info), color-mix(in srgb, var(--app-info) 70%, #6366f1))' : 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: isBase ? '#fff' : 'var(--app-muted-foreground)' }}>
                                {isBase ? 'Base Unit' : `×${node.conversion_factor || 1}`}
                            </span>
                            {node.needs_balance && <Scale size={12} style={{ color: 'var(--app-warning)' }} title="Requires weighing scale" />}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            {[
                                { label: 'Derived', value: childCount, icon: <GitBranch size={12} />, color: 'var(--app-info)', tab: null },
                                { label: 'Products', value: productCount, icon: <Package size={12} />, color: 'var(--app-success)', tab: 'products' as PanelTab },
                                { label: 'Factor', value: `×${node.conversion_factor || 1}`, icon: <ArrowRightLeft size={12} />, color: '#8b5cf6', tab: null },
                                { label: 'Type', value: node.type || 'Standard', icon: <Ruler size={12} />, color: 'var(--app-warning)', tab: null },
                            ].map(s => (
                                <button key={s.label} onClick={() => s.tab && setActiveTab(s.tab)}
                                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left ${s.tab ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
                                    style={{ background: `color-mix(in srgb, ${s.color} 5%, var(--app-surface))`, border: `1px solid color-mix(in srgb, ${s.color} 15%, transparent)` }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>{s.icon}</div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black tabular-nums leading-tight" style={{ color: 'var(--app-foreground)' }}>{s.value}</div>
                                        <div className="text-[8px] font-bold uppercase tracking-widest leading-none" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {parent && (
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'color-mix(in srgb, var(--app-info) 5%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                                    <ArrowUpDown size={12} style={{ color: 'var(--app-info)' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-info)' }}>Conversion</span>
                                </div>
                                <div className="px-4 py-3" style={{ background: 'var(--app-surface)' }}>
                                    <div className="flex items-center gap-2 text-[12px] font-bold text-app-foreground">
                                        <span className="font-black">1</span><span>{node.name}</span>
                                        <ChevronRight size={12} className="text-app-muted-foreground" />
                                        <span className="font-black">{node.conversion_factor || 1}</span><span>{parent.name}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {childCount > 0 && (
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, #8b5cf6 20%, transparent)' }}>
                                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'color-mix(in srgb, #8b5cf6 5%, transparent)', borderBottom: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
                                    <div className="flex items-center gap-2"><GitBranch size={12} style={{ color: '#8b5cf6' }} /><span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#8b5cf6' }}>Derived Units</span></div>
                                    <span className="text-[10px] font-bold" style={{ color: '#8b5cf6' }}>{childCount}</span>
                                </div>
                                <div className="divide-y divide-app-border/30" style={{ background: 'var(--app-surface)' }}>
                                    {children.map((child: any) => (
                                        <div key={child.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-app-background/50 transition-all">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6' }}>
                                                    {child.short_name?.substring(0, 2) || child.name?.substring(0, 2)}
                                                </div>
                                                <div><span className="text-[12px] font-bold text-app-foreground">{child.name}</span>{child.code && <span className="text-[9px] font-mono text-app-muted-foreground ml-1.5">{child.code}</span>}</div>
                                            </div>
                                            <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>×{child.conversion_factor || 1}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {childCount === 0 && (
                            <div className="rounded-xl py-3 px-3 text-center" style={{ background: 'color-mix(in srgb, var(--app-background) 40%, transparent)', border: '1px dashed color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                <p className="text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>No derived units</p>
                                <button onClick={() => onAdd(node.id)} className="mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg mx-auto flex items-center gap-1 transition-all" style={{ color: 'var(--app-info)', background: 'color-mix(in srgb, var(--app-info) 8%, transparent)' }}>
                                    <Plus size={9} /> Add Derived Unit
                                </button>
                            </div>
                        )}
                        {node.needs_balance && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-warning) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                                <Scale size={14} style={{ color: 'var(--app-warning)' }} />
                                <span className="text-[11px] font-bold" style={{ color: 'var(--app-warning)' }}>This unit requires a weighing scale at POS</span>
                            </div>
                        )}
                        {!isBase && childCount === 0 && (
                            <button onClick={() => onDelete(node)} className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-xl border transition-all hover:brightness-105"
                                style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <Trash2 size={11} /> Delete Unit
                            </button>
                        )}
                    </div>
                )}

                {/* ─── PRODUCTS TAB — EntityProductsTab template ─── */}
                {activeTab === 'products' && (
                    <EntityProductsTab config={{
                        entityType: 'unit',
                        entityId: node.id,
                        entityName: node.name,
                        exploreEndpoint: `units/${node.id}/explore/`,
                        moveEndpoint: 'units/move_products/',
                        moveTargetKey: 'target_unit_id',
                        moveTargets: allUnits.filter((u: any) => u.id !== node.id),
                        moveLabel: 'Move to Unit',
                        moveIcon: <Ruler size={12} />,
                    }} />
                )}

                {/* ─── PACKAGES TAB — Unit-level templates + product-level packaging ─── */}
                {activeTab === 'packages' && (
                    <div className="p-3 space-y-4 animate-in fade-in duration-150">

                        {/* SECTION 1 — UNIT PACKAGE TEMPLATES (CRUD) */}
                        <section className="rounded-2xl overflow-hidden"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            {/* V2 Header — icon-box + title + count pill + action */}
                            <div className="flex items-center justify-between px-4 py-2.5"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))',
                                    borderBottom: '1px solid var(--app-border)',
                                }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>
                                        <Box size={13} />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                                            Package Templates
                                        </div>
                                        <div className="text-[9px] font-black uppercase tracking-widest"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            {unitPackages.length} Template{unitPackages.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                {!showNewPkg && (
                                    <button type="button" onClick={() => { setShowNewPkg(true); setNewPkgName(''); setNewPkgRatio(''); setNewPkgCode(''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                        style={{
                                            background: 'var(--app-primary)',
                                            color: 'white',
                                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                        }}>
                                        <Plus size={11} /> New Template
                                    </button>
                                )}
                            </div>

                            <div className="p-4 space-y-3">

                            {/* New package inline form */}
                            {showNewPkg && (
                                <div className="rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    }}>
                                    <div className="px-4 py-3 space-y-3">
                                        {/* Row 1 — Name + Code */}
                                        <div className="grid grid-cols-[1fr_110px] gap-2">
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                                    Package Name
                                                </label>
                                                <input value={newPkgName} onChange={e => setNewPkgName(e.target.value)}
                                                    placeholder="e.g. Pack of 6"
                                                    className="w-full px-3 py-2 rounded-lg text-[13px] font-bold outline-none transition-all focus:ring-2"
                                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                                    Short Code
                                                </label>
                                                <input value={newPkgCode} onChange={e => setNewPkgCode(e.target.value.toUpperCase())}
                                                    placeholder="PK6"
                                                    className="w-full px-3 py-2 rounded-lg text-[12px] font-mono font-black text-center outline-none uppercase transition-all focus:ring-2"
                                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                            </div>
                                        </div>

                                        {/* Row 2 — Ratio with inline "1 pack = N Piece" pattern */}
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                                                style={{ color: 'var(--app-muted-foreground)' }}>
                                                Ratio — How many {node.name}{Number(newPkgRatio) !== 1 ? 's' : ''} in this package
                                            </label>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[12px] font-bold font-mono whitespace-nowrap"
                                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                                    1 {newPkgName || 'package'} =
                                                </span>
                                                <input type="number" step="0.001" min="0"
                                                    value={newPkgRatio}
                                                    onChange={e => setNewPkgRatio(e.target.value)}
                                                    placeholder="12"
                                                    className="w-24 px-3 py-2 rounded-lg text-[14px] font-mono font-black text-center outline-none transition-all focus:ring-2"
                                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                                <span className="text-[12px] font-bold font-mono whitespace-nowrap"
                                                    style={{ color: 'var(--app-foreground)' }}>
                                                    {node.name} <span style={{ color: 'var(--app-muted-foreground)' }}>({node.code})</span>
                                                </span>
                                            </div>
                                            {newPkgRatio && Number(newPkgRatio) > 0 && (
                                                <div className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                                                    style={{
                                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                        color: 'var(--app-primary)',
                                                    }}>
                                                    ✓ 1 <strong>{newPkgName || 'package'}</strong> contains {Number(newPkgRatio).toLocaleString()} {node.name}{Number(newPkgRatio) !== 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-4 py-2.5 flex items-center justify-end gap-2"
                                        style={{ borderTop: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
                                        <button type="button" onClick={() => setShowNewPkg(false)}
                                            disabled={savingPkg}
                                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            Cancel
                                        </button>
                                        <button type="button"
                                            disabled={savingPkg || !newPkgName.trim() || !newPkgRatio}
                                            onClick={async () => {
                                                setSavingPkg(true)
                                                try {
                                                    await createUnitPackage({
                                                        unit: node.id,
                                                        name: newPkgName.trim(),
                                                        ratio: Number(newPkgRatio),
                                                        code: newPkgCode || null,
                                                    })
                                                    toast.success(`Package "${newPkgName}" created`)
                                                    setShowNewPkg(false); setNewPkgName(''); setNewPkgRatio(''); setNewPkgCode('')
                                                    await reloadUnitPackages()
                                                } catch (e: any) {
                                                    toast.error(e?.message || 'Failed to create package')
                                                }
                                                setSavingPkg(false)
                                            }}
                                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{
                                                background: 'var(--app-primary)', color: 'white',
                                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                            }}>
                                            {savingPkg ? <Loader2 size={11} className="animate-spin" /> : <><Save size={11} /> Save Template</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Package list */}
                            {unitPkgLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                </div>
                            ) : unitPackages.length > 0 ? (
                                <div className="rounded-xl overflow-hidden"
                                    style={{ border: '1px solid var(--app-border)' }}>
                                    <div className="divide-y divide-app-border/30">
                                        {unitPackages.map((pkg: any) => (
                                            <div key={pkg.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-app-background/40 transition-all group">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{
                                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                                        color: 'var(--app-primary)',
                                                    }}>
                                                    <Box size={12} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[13px] font-bold truncate" style={{ color: 'var(--app-foreground)' }}>{pkg.name}</span>
                                                        {pkg.code && <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded"
                                                            style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>{pkg.code}</span>}
                                                        {pkg.is_default && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                                                            style={{
                                                                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                                                color: 'var(--app-primary)',
                                                            }}>DEFAULT</span>}
                                                    </div>
                                                    <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        1 {pkg.name} = <span className="font-black" style={{ color: 'var(--app-primary)' }}>
                                                            {Number(pkg.ratio).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                        </span> {node.name}{Number(pkg.ratio) !== 1 ? 's' : ''}
                                                        <span className="opacity-60"> ({node.code})</span>
                                                    </div>
                                                </div>
                                                <button type="button"
                                                    onClick={async () => {
                                                        if (!confirm(`Delete "${pkg.name}"?`)) return
                                                        try {
                                                            await deleteUnitPackage(pkg.id)
                                                            toast.success(`Package "${pkg.name}" removed`)
                                                            await reloadUnitPackages()
                                                        } catch (e: any) { toast.error(e?.message || 'Delete failed') }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                                                    style={{ color: 'var(--app-error, #ef4444)' }}
                                                    title="Delete">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : !showNewPkg && (
                                <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 3%, transparent)',
                                        border: '1px dashed color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    }}>
                                    <Box size={24} style={{ color: 'var(--app-primary)' }} className="mb-2 opacity-60" />
                                    <p className="text-[12px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                        No package templates yet
                                    </p>
                                    <p className="text-[10px] mt-1 max-w-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Define standard packagings like "Pack of 6", "Carton 24" — used as defaults when creating products.
                                    </p>
                                </div>
                            )}
                            </div>
                        </section>

                        {/* SECTION 2 — LINKED PRODUCT PACKAGING (read-only) */}
                        {(pkgLoading || packages.length > 0) && (
                            <section>
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <Package size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Linked Product Packaging
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                        {packages.length}
                                    </span>
                                </div>
                                {pkgLoading ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 size={14} className="animate-spin text-app-muted-foreground" /></div>
                                ) : (
                                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                                        <div className="divide-y divide-app-border/30">
                                            {packages.map((pkg: any) => (
                                                <div key={pkg.id} className="flex items-center gap-2 px-3 py-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[12px] font-bold text-app-foreground truncate">{pkg.name}</div>
                                                        <div className="flex items-center gap-2 text-[9px] text-app-muted-foreground">
                                                            <span className="font-mono">×{pkg.ratio}</span>
                                                            {pkg.product_name && <span>• {pkg.product_name}</span>}
                                                            {pkg.barcode && <span className="font-mono">• {pkg.barcode}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-[11px] font-black tabular-nums text-app-foreground">{Number(pkg.selling_price || 0).toLocaleString()}</div>
                                                        <div className="flex items-center gap-1 text-[8px] font-bold">
                                                            {pkg.is_default_sale && <span className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>SALE</span>}
                                                            {pkg.is_default_purchase && <span className="px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>BUY</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}

                {/* ─── CALCULATOR TAB ─── */}
                {activeTab === 'calculator' && (
                    <div className="p-3 animate-in fade-in duration-150">
                        {/* Embedded — no nested card. Just the equation row + hint. */}
                        <UnitCalculator units={allUnits} defaultUnit={node} variant="embedded" />
                    </div>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE — using TreeMasterPage template
 * ═══════════════════════════════════════════════════════════ */
export default function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const data = initialUnits
    const [showCalc, setShowCalc] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showBarcodeConfig, setShowBarcodeConfig] = useState(false)
    const [editingUnit, setEditingUnit] = useState<any>(null)
    const [formKey, setFormKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)

    const openForm = useCallback((parentId?: number) => { setEditingUnit(parentId ? { _parentId: parentId } : null); setFormKey(k => k + 1); setIsFormOpen(true) }, [])
    const openEditForm = useCallback((u: any) => { setEditingUnit(u); setFormKey(k => k + 1); setIsFormOpen(true) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const result = await deleteUnit(source.id)
            if (result?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if ((result as any)?.conflict) {
                setDeleteConflict({ conflict: (result as any).conflict, source })
                return
            }
            // Rich error toast with an action hint when available
            const msg = result?.message || 'Failed to delete'
            const hint = (result as any)?.actionHint
            if (hint) {
                toast.error(msg, { description: hint, duration: 8000 })
            } else {
                toast.error(msg, { duration: 6000 })
            }
        })
    }

    const handleMigrateAndDelete = async (targetId: number) => {
        const source = deleteConflict?.source
        if (!source) return
        try {
            const moveRes = await erpFetch('/units/move_products/', {
                method: 'POST',
                body: JSON.stringify({ source_unit_id: source.id, target_unit_id: targetId }),
            })
            if (moveRes && moveRes.success === false) {
                toast.error(moveRes.message || 'Migration failed — delete aborted'); return
            }
            const delRes = await deleteUnit(source.id, { force: true })
            if (delRes?.success) {
                toast.success(`Products migrated and "${source.name}" deleted`)
                setDeleteConflict(null); router.refresh()
            } else {
                toast.error(delRes?.message || 'Delete failed after migration')
            }
        } catch (e: any) {
            toast.error(e?.message || 'Migration failed')
        }
    }

    const handleForceDeleteUnit = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res = await deleteUnit(source.id, { force: true })
        if (res?.success) {
            toast.success(`"${source.name}" force-deleted`)
            setDeleteConflict(null); router.refresh()
        } else {
            toast.error(res?.message || 'Delete failed')
        }
    }

    const unitMigrationTargets = useMemo(() => {
        const sourceId = deleteConflict?.source?.id
        return data
            .filter((u: any) => u.id !== sourceId)
            .map((u: any) => ({ id: u.id, name: u.name, code: u.code }))
    }, [data, deleteConflict])

    // Track search query + active KPI filter from TreeMasterPage.
    const [filterQuery, setFilterQuery] = useState('')
    const [kpiFilter, setKpiFilter] = useState<string | null>(null)

    const matches = useCallback((u: any, q: string) => {
        const needle = q.trim().toLowerCase()
        if (!needle) return true
        return (u.name || '').toLowerCase().includes(needle)
            || (u.code || '').toLowerCase().includes(needle)
            || (u.short_name || '').toLowerCase().includes(needle)
            || (u.type || '').toLowerCase().includes(needle)
    }, [])

    // KPI filter predicates — click a KPI, this filter applies.
    const kpiPredicate = useCallback((u: any): boolean => {
        if (!kpiFilter) return true
        if (kpiFilter === 'base') return !u.base_unit
        if (kpiFilter === 'derived') return !!u.base_unit
        if (kpiFilter === 'products') return (u.product_count || 0) > 0
        if (kpiFilter === 'scale') return !!u.needs_balance
        return true
    }, [kpiFilter])

    const filteredData = useMemo(
        () => data.filter((u: any) => matches(u, filterQuery) && kpiPredicate(u)),
        [data, filterQuery, matches, kpiPredicate]
    )

    const stats = useMemo(() => {
        const source = filteredData
        const baseCount = source.filter((u: any) => !u.base_unit).length
        const derivedCount = source.filter((u: any) => u.base_unit).length
        const totalProducts = source.reduce((s: number, u: any) => s + (u.product_count || 0), 0)
        const scaleUnits = source.filter((u: any) => u.needs_balance).length
        return {
            total: data.length,
            showing: source.length,
            base: baseCount,
            derived: derivedCount,
            totalProducts,
            scaleUnits,
            isFiltered: filterQuery.trim().length > 0 || kpiFilter !== null,
        }
    }, [data, filteredData, filterQuery, kpiFilter])

    // Tour step actions — programmatic interactions wired to the tree state
    const renderPropsRef = useRef<any>(null)
    const tourStepActions = useMemo(() => ({
        5: () => { renderPropsRef.current?.setExpandAll(true); renderPropsRef.current?.setExpandKey((k: number) => k + 1) },
        6: () => {
            const firstBase = data.find((u: any) => !u.base_unit)
            if (firstBase) { renderPropsRef.current?.setSidebarNode(firstBase); renderPropsRef.current?.setSidebarTab('overview') }
        },
        8: () => { renderPropsRef.current?.setSidebarTab('products') },
        9: () => { renderPropsRef.current?.setSidebarTab('packages') },
        10: () => { renderPropsRef.current?.setSidebarTab('calculator') },
        11: () => { renderPropsRef.current?.setSidebarNode(null) },
    }), [data])

    return (
        <TreeMasterPage
            config={{
                title: 'Units & Packaging',
                subtitle: `${stats.total} Units · Hierarchical Conversions`,
                icon: <Ruler size={20} />,
                iconColor: 'var(--app-info)',
                tourId: 'inventory-units',
                onSearchChange: setFilterQuery,
                onKpiFilterChange: (key) => {
                    // Special 'all' key means "clear all filters"
                    if (key === 'all') { setKpiFilter(null); setFilterQuery(''); return }
                    setKpiFilter(key)
                },
                kpis: [
                    {
                        label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-primary)',
                        filterKey: 'all', active: kpiFilter === null && filterQuery.trim().length === 0,
                        hint: 'Show all units (clear filters)',
                    },
                    { label: 'Base', value: stats.base, icon: <Ruler size={11} />, color: 'var(--app-info)', filterKey: 'base', active: kpiFilter === 'base', hint: 'Show only base units' },
                    { label: 'Derived', value: stats.derived, icon: <GitBranch size={11} />, color: '#8b5cf6', filterKey: 'derived', active: kpiFilter === 'derived', hint: 'Show only derived units' },
                    { label: 'Products', value: stats.totalProducts, icon: <Package size={11} />, color: 'var(--app-success)', filterKey: 'products', active: kpiFilter === 'products', hint: 'Show only units with products' },
                    { label: 'Scale', value: stats.scaleUnits, icon: <Scale size={11} />, color: 'var(--app-warning)', filterKey: 'scale', active: kpiFilter === 'scale', hint: 'Show only balance-connected units' },
                    {
                        label: stats.isFiltered ? 'Showing' : 'All',
                        value: stats.isFiltered ? `${stats.showing}/${stats.total}` : stats.total,
                        icon: <Search size={11} />,
                        color: stats.isFiltered ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    },
                ],
                searchPlaceholder: 'Search by name, code, or type... (Ctrl+K)',
                primaryAction: { label: 'New Unit', icon: <Plus size={14} />, onClick: () => openForm() },
                secondaryActions: [
                    { label: 'Calculator', icon: <ArrowRightLeft size={13} />, onClick: () => setShowCalc(p => !p), active: showCalc, activeColor: 'var(--app-info)' },
                    { label: 'Barcode', icon: <Scale size={13} />, onClick: () => setShowBarcodeConfig(true) },
                    { label: 'Cleanup', icon: <Wrench size={13} />, href: '/inventory/maintenance?tab=unit' },
                ],
                columnHeaders: [
                    { label: 'Unit', width: 'auto' },
                    { label: 'Sub', width: '48px', hideOnMobile: true },
                    { label: 'Conv.', width: '56px', color: '#8b5cf6', hideOnMobile: true },
                    { label: 'Products', width: '56px', color: 'var(--app-success)', hideOnMobile: true },
                ],
                footerLeft: (<><span>{stats.total} defined units</span><span style={{ color: 'var(--app-border)' }}>·</span><span>{stats.base} base</span><span style={{ color: 'var(--app-border)' }}>·</span><span>{stats.derived} derived</span></>),
            }}
            modals={<>
                <UnitFormModal key={formKey} isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSuccess={() => { setIsFormOpen(false); router.refresh() }} potentialParents={data} />
                <BalanceBarcodeConfigModal isOpen={showBarcodeConfig} onClose={() => setShowBarcodeConfig(false)} />
                <PageTour tourId="inventory-units" stepActions={tourStepActions} renderButton={false} />
                <DeleteConflictDialog
                    conflict={deleteConflict?.conflict || null}
                    sourceName={deleteConflict?.source?.name || ''}
                    entityName="unit"
                    targets={unitMigrationTargets}
                    onMigrate={handleMigrateAndDelete}
                    onForceDelete={handleForceDeleteUnit}
                    onCancel={() => setDeleteConflict(null)}
                />
                <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} onConfirm={handleConfirmDelete}
                    title={`Delete "${deleteTarget?.name}"?`} description="This will permanently remove this unit. Make sure no products are using it." confirmText="Delete" variant="danger" />
            </>}
            aboveTree={showCalc ? (<div className="animate-in slide-in-from-top-2 duration-200 px-4 pt-3"><UnitCalculator units={data} /></div>) : undefined}
            detailPanel={(node, { tab, onClose, onPin }) => (
                <UnitDetailPanel node={node} onEdit={openEditForm} onAdd={openForm} onDelete={(n: any) => setDeleteTarget(n)} allUnits={data} initialTab={tab} onClose={onClose} onPin={onPin} />
            )}
        >
            {(renderProps) => {
                const { searchQuery, expandAll, expandKey, splitPanel, pinnedSidebar, selectedNode, setSelectedNode, sidebarNode, setSidebarNode, setSidebarTab, setPanelTab } = renderProps
                renderPropsRef.current = renderProps
                let filtered = data
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase()
                    filtered = filtered.filter((u: any) => u.name?.toLowerCase().includes(q) || u.code?.toLowerCase().includes(q) || u.short_name?.toLowerCase().includes(q) || u.type?.toLowerCase().includes(q))
                }
                // Apply KPI filter (click-to-filter from the KPI strip)
                filtered = filtered.filter(kpiPredicate)
                const tree = buildTree(filtered, 'base_unit')
                return tree.length > 0 ? (
                    tree.map((node: any) => (
                        <div key={`${node.id}-${expandKey}`} className={`rounded-xl transition-all duration-300 ${((splitPanel || pinnedSidebar) ? selectedNode?.id === node.id : sidebarNode?.id === node.id) ? 'ring-2 ring-app-primary/40 bg-app-primary/[0.03] shadow-sm' : ''}`}>
                            <UnitRow node={node} level={0} onEdit={openEditForm} onAdd={openForm} onDelete={(n: any) => setDeleteTarget(n)}
                                onViewProducts={(n: any) => { if (splitPanel || pinnedSidebar) { setSelectedNode(n); setPanelTab('products') } else { setSidebarNode(n); setSidebarTab('products') } }}
                                onSelect={(n: any) => { if (splitPanel || pinnedSidebar) { setSelectedNode(n) } else { setSidebarNode(n); setSidebarTab('overview') } }}
                                searchQuery={searchQuery} forceExpanded={expandAll} allUnits={data} />
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <Ruler size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground mb-1">{searchQuery ? 'No matching units' : 'No units defined yet'}</p>
                        <p className="text-[11px] text-app-muted-foreground mb-5 max-w-xs">{searchQuery ? 'Try a different search term.' : 'Create a base unit like "Piece" or "KG" to get started.'}</p>
                        {!searchQuery && <button onClick={() => openForm()} className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}><Plus size={16} className="inline mr-1.5" />Create First Unit</button>}
                    </div>
                )
            }}
        </TreeMasterPage>
    )
}
