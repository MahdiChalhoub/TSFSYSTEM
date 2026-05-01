'use client'

import { useActionState, useState, useEffect, useRef, useMemo } from 'react'
import type { PurchaseLine } from '@/types/erp'
import { createPurchaseInvoice } from '@/app/actions/commercial/purchases'
import {
    ShoppingCart, ArrowLeft, Settings2, FileText,
    ListFilter, BookOpen, Plus, ArrowRight,
    DollarSign, Hash, Layers, TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { ProductSearch } from './_components/ProductSearch'
import { LineColumnHeaders } from './_components/LineColumnHeaders'
import { LineRowDesktop } from './_components/LineRowDesktop'
import { AdminSidebar } from './_components/AdminSidebar'
import type { AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'

export default function PurchaseForm({
    suppliers, sites, financialSettings, users, profilesData
}: {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    financialSettings: Record<string, any>
    users: Record<string, any>[]
    profilesData: AnalyticsProfilesData
}) {
    const initialState = { message: '', errors: {} }
    const [state, formAction, isPending] = useActionState(createPurchaseInvoice, initialState)
    const searchRef = useRef<HTMLInputElement>(null)

    const [reference, setReference] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [deliveryDate, setDeliveryDate] = useState('')
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL')
    const [supplierId, setSupplierId] = useState<number | ''>('')
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('')
    const [warehouseId, setWarehouseId] = useState<number | ''>('')
    const [assigneeId, setAssigneeId] = useState<number | ''>('')
    const [driverId, setDriverId] = useState<number | ''>('')
    const [lines, setLines] = useState<PurchaseLine[]>([])
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const selectedSupplier = useMemo(() => suppliers.find(s => Number(s.id) === Number(supplierId)), [suppliers, supplierId])
    const selectedSite = useMemo(() => sites.find(s => Number(s.id) === Number(selectedSiteId)), [sites, selectedSiteId])
    const selectedWarehouse = useMemo(() => {
        if (!selectedSite) return null
        return selectedSite.warehouses?.find((w: any) => Number(w.id) === Number(warehouseId))
    }, [selectedSite, warehouseId])

    const totals = useMemo(() => lines.reduce((acc, line) => {
        const qty = Number(line.quantity) || 0
        const ht = Number(line.unitCostHT) || 0
        const tax = Number(line.taxRate) || 0
        const lineHT = qty * ht
        const lineVAT = lineHT * tax
        return { ht: acc.ht + lineHT, vat: acc.vat + lineVAT, ttc: acc.ttc + lineHT + lineVAT }
    }, { ht: 0, vat: 0, ttc: 0 }), [lines])

    const canSubmit = !isPending && lines.length > 0 && supplierId !== '' && selectedSiteId !== '' && warehouseId !== ''

    useEffect(() => {
        if (state.message && state.errors && Object.keys(state.errors).length === 0) toast.success(state.message)
        else if (state.message) toast.error(state.message)
    }, [state])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) { toast.info('Already in list'); return }
        const taxRate = product.taxRate || 0.18
        const unitCostHT = product.unitCostHT || product.costPriceHT || 0
        const sellingPriceHT = product.sellingPriceHT || 0
        setLines(prev => [{
            ...product, productId: product.id, productName: product.name, quantity: 1,
            unitCostHT, unitCostTTC: unitCostHT * (1 + taxRate),
            sellingPriceHT, sellingPriceTTC: sellingPriceHT * (1 + taxRate),
            expiryDate: '', taxRate, statusText: 'OPTIONAL', poCount: 0,
            stockTotal: product.stockTotal || 0, stockTransit: 0, requiredProposed: 0,
        }, ...prev])
    }

    const updateLine = (idx: number, updates: Record<string, any>) => {
        setLines(prev => { const next = [...prev]; Object.assign(next[idx], updates); return next })
    }
    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

    const kpis = [
        { label: 'Lines', value: lines.length.toString(), color: 'var(--app-primary)', icon: <Hash size={14} /> },
        { label: 'Total HT', value: totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: 'var(--app-info)', icon: <DollarSign size={14} /> },
        { label: 'VAT', value: totals.vat.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: '#8b5cf6', icon: <Layers size={14} /> },
        { label: 'Total TTC', value: totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: 'var(--app-success)', icon: <TrendingUp size={14} /> },
    ]

    return (
        <>
            <input type="hidden" name="scope" value={scope} form="po-form" />

            {/* ── Page Header ── */}
            <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/purchases"
                            className="flex items-center justify-center w-8 h-8 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <ArrowLeft size={15} />
                        </Link>
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <ShoppingCart size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight leading-none">
                                New Purchase Order
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest mt-0.5">
                                {selectedSupplier
                                    ? `${selectedSupplier.name}${selectedSite ? ` · ${selectedSite.name}` : ''} · ${scope}`
                                    : `Draft · ${scope} · Click Configure to set up`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center p-0.5 rounded-xl bg-app-surface border border-app-border">
                            {(['OFFICIAL', 'INTERNAL'] as const).map(s => (
                                <button key={s} type="button" onClick={() => setScope(s)}
                                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${scope === s ? 'bg-app-primary text-white' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                                    style={scope === s ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' } : {}}>
                                    {s}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => setSidebarOpen(true)}
                            className="flex items-center gap-1.5 text-tp-xs font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl transition-all border group"
                            style={sidebarOpen ? {
                                background: 'var(--app-primary)',
                                color: 'white',
                                borderColor: 'var(--app-primary)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)'
                            } : {
                                background: 'var(--app-surface)',
                                color: 'var(--app-foreground)',
                                borderColor: 'var(--app-border)',
                            }}>
                            <Settings2 size={14} className={sidebarOpen ? 'text-white' : 'text-app-primary'} />
                            <span className="hidden md:inline">Configure Setup</span>
                        </button>
                        <form id="po-form" action={formAction}>
                            <input type="hidden" name="scope" value={scope} />
                            <input type="hidden" name="supplierId" value={supplierId} />
                            <input type="hidden" name="siteId" value={selectedSiteId} />
                            <input type="hidden" name="warehouseId" value={warehouseId} />
                            <input type="hidden" name="assigneeId" value={assigneeId} />
                            <input type="hidden" name="driverId" value={driverId} />
                            <input type="hidden" name="lines" value={JSON.stringify(lines)} />
                            <button type="submit" disabled={!canSubmit}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <ArrowRight size={14} />
                                <span className="hidden sm:inline">{isPending ? 'Processing…' : 'Create PO'}</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="mt-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(k => (
                        <div key={k.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                                {k.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Content Row: Grid + Sidebar side-by-side ── */}
            <div className="flex gap-0 px-4 md:px-6 pb-4" style={{ minHeight: '500px' }}>

                {/* Intelligence Grid */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                        <div className="flex-1">
                            <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                        </div>
                        <button type="button"
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all flex-shrink-0">
                            <ListFilter size={13} />
                            <span className="hidden md:inline">Cols</span>
                        </button>
                        <button type="button"
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all flex-shrink-0">
                            <BookOpen size={13} />
                            <span className="hidden md:inline">Catalogue</span>
                        </button>
                        <button type="button"
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Plus size={14} />
                            <span className="hidden sm:inline">New</span>
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
                        <LineColumnHeaders />
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                            {lines.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                    <ShoppingCart size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                    <p className="text-sm font-bold text-app-muted-foreground">No products added yet</p>
                                    <p className="text-[11px] text-app-muted-foreground mt-1">Search above or browse the catalogue to add products.</p>
                                </div>
                            ) : (
                                lines.map((line, idx) => (
                                    <LineRowDesktop key={line.productId as React.Key} line={line} idx={idx} onUpdate={updateLine} onRemove={removeLine} />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Configuration Drawer (same pattern as categories detail panel) ── */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
                        style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setSidebarOpen(false) }}
                    >
                        <div
                            className="w-[260px] h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                            style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}
                        >
                             <AdminSidebar
                                suppliers={suppliers} sites={sites} users={users}
                                supplierId={supplierId} onSupplierChange={setSupplierId}
                                siteId={selectedSiteId} onSiteChange={setSelectedSiteId}
                                warehouseId={warehouseId} onWarehouseChange={setWarehouseId}
                                scope={scope} onScopeChange={setScope}
                                assigneeId={assigneeId} onAssigneeChange={setAssigneeId}
                                driverId={driverId} onDriverChange={setDriverId}
                                reference={reference} onReferenceChange={setReference}
                                date={date} onDateChange={setDate}
                                expectedDelivery={deliveryDate} onExpectedDeliveryChange={setDeliveryDate}
                                onClose={() => setSidebarOpen(false)}
                            />
                        </div>
                    </div>
                )}

            </div>
        </>
    )
}
