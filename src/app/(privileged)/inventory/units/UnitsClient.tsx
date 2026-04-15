// @ts-nocheck
'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { buildTree } from '@/lib/utils/tree'
import { UnitTree } from '@/components/admin/UnitTree'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { UnitFormModal } from '@/components/admin/UnitFormModal'
import { BalanceBarcodeConfigModal } from '@/components/admin/BalanceBarcodeConfigModal'
import {
    Search, Plus, Layers, Package, Ruler, ArrowRightLeft,
    Wrench, X, ChevronsUpDown, ChevronsDownUp, Scale, Hash,
    Maximize2, Minimize2
} from 'lucide-react'
import Link from 'next/link'

export default function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const router = useRouter()
    const data = initialUnits
    const [searchQuery, setSearchQuery] = useState('')
    const [showCalc, setShowCalc] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [showBarcodeConfig, setShowBarcodeConfig] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    const openForm = useCallback(() => { setFormKey(k => k + 1); setIsFormOpen(true) }, [])
    const handleFormClose = useCallback(() => { setIsFormOpen(false) }, [])
    const handleFormSuccess = useCallback(() => { setIsFormOpen(false); router.refresh() }, [router])

    // Keyboard shortcut: Ctrl+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Filter + build tree
    const { tree, stats } = useMemo(() => {
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
        const builtTree = buildTree(filtered, 'base_unit')
        const baseCount = data.filter(u => !u.base_unit).length
        const derivedCount = data.filter(u => u.base_unit).length
        const totalProducts = data.reduce((s: number, u: any) => s + (u.product_count || 0), 0)
        const scaleUnits = data.filter(u => u.needs_balance).length

        return {
            tree: builtTree,
            stats: { total: data.length, filtered: filtered.length, base: baseCount, derived: derivedCount, totalProducts, scaleUnits }
        }
    }, [data, searchQuery])

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 transition-all overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-info)' }}>
                                <Ruler size={14} style={{ color: '#fff' }} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Units</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={openForm}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon" style={{ background: 'var(--app-info)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                                    <Ruler size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Units & Packaging</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Units · Hierarchical Conversions
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <button
                                    onClick={() => setShowCalc(!showCalc)}
                                    className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                                    style={{
                                        background: showCalc ? 'color-mix(in srgb, var(--app-info) 8%, transparent)' : 'transparent',
                                        color: showCalc ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                                        borderColor: showCalc ? 'color-mix(in srgb, var(--app-info) 25%, transparent)' : 'var(--app-border)',
                                    }}
                                >
                                    <ArrowRightLeft size={13} />
                                    <span className="hidden md:inline">Calculator</span>
                                </button>
                                <button
                                    onClick={() => setShowBarcodeConfig(true)}
                                    className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                                    style={{
                                        background: 'transparent',
                                        color: 'var(--app-muted-foreground)',
                                        borderColor: 'var(--app-border)',
                                    }}
                                    title="Balance Barcode Configuration"
                                >
                                    <Scale size={13} />
                                    <span className="hidden md:inline">Barcode</span>
                                </button>
                                <Link
                                    href="/inventory/maintenance?tab=unit"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                <button
                                    onClick={openForm}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Unit</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode — maximize tree"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-primary)' },
                                { label: 'Base', value: stats.base, icon: <Ruler size={11} />, color: 'var(--app-info)' },
                                { label: 'Derived', value: stats.derived, icon: <Package size={11} />, color: '#8b5cf6' },
                                { label: 'Products', value: stats.totalProducts, icon: <Hash size={11} />, color: 'var(--app-success)' },
                                { label: 'Scale', value: stats.scaleUnits, icon: <Scale size={11} />, color: 'var(--app-warning)' },
                                { label: 'Showing', value: stats.filtered, icon: <Search size={11} />, color: 'var(--app-muted-foreground)' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, code, or type... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Calculator Panel (collapsible) */}
                        {showCalc && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                                <UnitCalculator units={data} />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ═══════════════ FORM MODAL ═══════════════ */}
            <UnitFormModal
                key={formKey}
                isOpen={isFormOpen}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
                potentialParents={data}
            />

            {/* ═══════════════ BALANCE BARCODE CONFIG MODAL ═══════════════ */}
            <BalanceBarcodeConfigModal isOpen={showBarcodeConfig} onClose={() => setShowBarcodeConfig(false)} />

            {/* ═══════════════ TREE TABLE ═══════════════ */}
            <div className="flex-1 min-h-0 rounded-t-2xl overflow-hidden flex flex-col"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

                {/* Section Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <span>Unit Hierarchies</span>
                    <span className="tabular-nums normal-case font-bold">{stats.filtered} of {stats.total} units</span>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {tree.length > 0 ? (
                        <UnitTree units={tree} potentialParents={data} forceExpanded={expandAll} expandKey={expandKey} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                style={{
                                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-info) 15%, transparent), color-mix(in srgb, var(--app-info) 5%, transparent))',
                                    border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)',
                                }}
                            >
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
                                <button
                                    onClick={openForm}
                                    className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={16} className="inline mr-1.5" />Create First Unit
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold rounded-b-2xl animate-in slide-in-from-bottom-2 duration-300"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none',
                    marginTop: '-1px',
                    color: 'var(--app-muted-foreground)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <span>{stats.total} defined units</span>
                    <span style={{ color: 'var(--app-border)' }}>·</span>
                    <span>{stats.base} base</span>
                    <span style={{ color: 'var(--app-border)' }}>·</span>
                    <span>{stats.derived} derived packaging levels</span>
                    {searchQuery && (
                        <>
                            <span style={{ color: 'var(--app-border)' }}>·</span>
                            <span style={{ color: 'var(--app-info)' }}>Filter active</span>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="underline hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--app-info)' }}
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>
                <div className="tabular-nums font-black" style={{ color: 'var(--app-foreground)' }}>
                    System Status: <span style={{ color: 'var(--app-success)' }}>Operational</span>
                </div>
            </div>
        </div>
    )
}
