'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import type { PurchaseLine } from '@/types/erp'
import { createPurchaseInvoice } from '@/app/actions/commercial/purchases'
import {
    ShoppingCart, SlidersHorizontal, BookOpen, Plus,
    ArrowRight, Settings2, FileText, LayoutGrid,
} from 'lucide-react'

import { ProductSearch } from './_components/ProductSearch'
import { LineColumnHeaders } from './_components/LineColumnHeaders'
import { LineRowDesktop } from './_components/LineRowDesktop'
import { LineCardMobile } from './_components/LineCardMobile'
import { MetadataStrip } from './_components/MetadataStrip'

export default function PurchaseForm({
    suppliers,
    sites,
    financialSettings,
}: {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    financialSettings: Record<string, any>
}) {
    const initialState = { message: '', errors: {} }
    const [state, formAction, isPending] = useActionState(createPurchaseInvoice, initialState)
    const searchRef = useRef<HTMLInputElement>(null)

    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL')
    const [supplierId, setSupplierId] = useState<number | ''>('')
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('')
    const [warehouseId, setWarehouseId] = useState<number | ''>('')
    const [invoicePriceType] = useState<'HT' | 'TTC'>('HT')
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true)
    const [lines, setLines] = useState<PurchaseLine[]>([])

    const canSubmit = !isPending && lines.length > 0 && supplierId !== '' && selectedSiteId !== '' && warehouseId !== ''

    useEffect(() => { setVatRecoverable(scope === 'OFFICIAL') }, [scope])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return
        const taxRate = product.taxRate || 0.11
        const unitCostHT = product.unitCostHT || product.costPriceHT || 0
        const sellingPriceHT = product.sellingPriceHT || 0
        setLines(prev => [{
            ...product,
            productId: product.id,
            productName: product.name,
            quantity: product.proposedQty || 1,
            unitCostHT,
            unitCostTTC: unitCostHT * (1 + taxRate),
            sellingPriceHT,
            sellingPriceTTC: sellingPriceHT * (1 + taxRate),
            expiryDate: '',
            taxRate,
            requiredProposed: Math.floor(Math.random() * 50) + 10,
            stockTransit: Math.floor(Math.random() * 20),
            stockTotal: Math.floor(Math.random() * 200) + 50,
            poCount: Math.floor(Math.random() * 5),
            statusText: ['LOW', 'OPTIONAL', 'URGENT'][Math.floor(Math.random() * 3)],
            salesMonthly: Math.floor(Math.random() * 1000) + 100,
            scoreAdjust: (Math.random() * 100).toFixed(1),
            purchasedSold: Math.floor(Math.random() * 500) + 50,
            supplierPrice: unitCostHT,
            expirySafety: '180 days',
        }, ...prev])
    }

    const updateLine = (idx: number, updates: Record<string, any>) => {
        setLines(prev => {
            const next = [...prev]
            Object.assign(next[idx], updates)
            return next
        })
    }

    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

    return (
        <form action={formAction} className="flex-1 flex flex-col relative">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
            <input type="hidden" name="supplierId" value={supplierId} />
            <input type="hidden" name="siteId" value={selectedSiteId} />
            <input type="hidden" name="warehouseId" value={warehouseId} />

            {/* Floating Scope Toggle */}
            <div className="absolute top-0 right-0 z-40 flex items-center gap-2 px-5 py-3" style={{ top: '-52px' }}>
                <div className="flex rounded-full overflow-hidden h-[30px]" style={{ border: '1px solid var(--app-border)' }}>
                    {(['OFFICIAL', 'INTERNAL'] as const).map(s => (
                        <button key={s} type="button" onClick={() => setScope(s)}
                            className="px-4 text-[10px] font-black uppercase tracking-wider transition-all"
                            style={scope === s ? {
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            } : { background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <button type="button" className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                    <Settings2 size={15} />
                </button>
                <button type="button" className="p-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                    <FileText size={15} />
                </button>
            </div>

            <MetadataStrip
                suppliers={suppliers}
                sites={sites}
                supplierId={supplierId}
                onSupplierChange={setSupplierId}
                siteId={selectedSiteId}
                onSiteChange={setSelectedSiteId}
                warehouseId={warehouseId}
                onWarehouseChange={setWarehouseId}
            />

            {/* Toolbar */}
            <div className="flex-shrink-0 flex items-center gap-0"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderLeft: '3px solid var(--app-primary)' }}>
                    <LayoutGrid size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: 'var(--app-foreground)' }}>Product Lines</span>
                </div>
                <div className="flex-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                </div>
                <div className="flex items-center gap-1.5 px-3 flex-shrink-0">
                    <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <SlidersHorizontal size={13} />
                        <span className="hidden md:inline">13 Cols</span>
                    </button>
                    <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <BookOpen size={13} />
                        <span className="hidden md:inline">Catalogue</span>
                    </button>
                    <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Plus size={14} />
                        <span className="hidden sm:inline">New</span>
                    </button>
                </div>
            </div>

            <LineColumnHeaders />

            {/* Body */}
            <div className="flex-1 overflow-y-auto overflow-x-auto"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, var(--app-background))' }}>
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                        <ShoppingCart size={40} className="mb-4 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>No products added yet</p>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            Search above or browse the catalogue to add product lines.
                        </p>
                    </div>
                )}
                {lines.length > 0 && (
                    <div className="hidden md:block">
                        {lines.map((line, idx) => (
                            <LineRowDesktop key={line.productId as React.Key} line={line} idx={idx} onUpdate={updateLine} onRemove={removeLine} />
                        ))}
                    </div>
                )}
                {lines.length > 0 && (
                    <div className="block md:hidden p-3 space-y-3">
                        {lines.map((line, idx) => (
                            <LineCardMobile key={line.productId as React.Key} line={line} idx={idx} onUpdate={updateLine} onRemove={removeLine} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 relative">
                <div className="h-[3px] w-full"
                    style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--app-primary) 60%, transparent), color-mix(in srgb, var(--app-primary) 20%, transparent))` }} />
                <div className="flex justify-between items-center px-5 py-4"
                    style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
                    <div className="flex-1">
                        {state.message && (
                            <div className="px-3 py-1.5 rounded-xl text-[11px] font-bold inline-block"
                                style={{
                                    background: state.errors && Object.keys(state.errors).length > 0
                                        ? 'color-mix(in srgb, var(--app-error) 10%, transparent)'
                                        : 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                    color: state.errors && Object.keys(state.errors).length > 0
                                        ? 'var(--app-error)' : 'var(--app-success)',
                                }}>
                                {state.message}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        title={canSubmit ? '' : 'Select supplier, site, warehouse, and add at least one line.'}
                        className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-full font-black uppercase tracking-widest text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{
                            background: 'var(--app-primary)', color: 'white',
                            boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 40%, transparent)',
                        }}>
                        {isPending ? 'Processing...' : <><ArrowRight size={14} /> Create PO</>}
                    </button>
                </div>
            </div>
        </form>
    )
}
