'use client';

import { useActionState, useState, useEffect } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createPurchaseInvoice } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import { 
    Search, ShoppingCart, SlidersHorizontal, BookOpen, Plus, 
    Trash2, ArrowRight, Settings2, FileText 
} from "lucide-react";

export default function PurchaseForm({
    suppliers,
    sites,
    financialSettings
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    financialSettings: Record<string, any>
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createPurchaseInvoice, initialState);
    const { logOperation } = useDev();

    // --- Core Header State ---
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [invoicePriceType] = useState<'HT' | 'TTC'>('HT');
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);

    const [lines, setLines] = useState<PurchaseLine[]>([]);

    useEffect(() => {
        setVatRecoverable(scope === 'OFFICIAL');
    }, [scope]);

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        const taxRate = product.taxRate || 0.11;
        const unitCostHT = product.unitCostHT || product.costPriceHT || 0;
        const unitCostTTC = unitCostHT * (1 + taxRate);
        const sellingPriceHT = product.sellingPriceHT || 0;
        const sellingPriceTTC = sellingPriceHT * (1 + taxRate);

        setLines([{
            ...product,
            productId: product.id,
            productName: product.name,
            quantity: product.proposedQty || 1,
            unitCostHT,
            unitCostTTC,
            sellingPriceHT,
            sellingPriceTTC,
            expiryDate: '',
            taxRate,
            
            // Mock intel data for the grid
            requiredProposed: Math.floor(Math.random() * 50) + 10,
            stockTransit: Math.floor(Math.random() * 20),
            stockTotal: Math.floor(Math.random() * 200) + 50,
            poCount: Math.floor(Math.random() * 5),
            statusText: ['LOW', 'OPTIONAL', 'URGENT'][Math.floor(Math.random() * 3)],
            salesMonthly: Math.floor(Math.random() * 1000) + 100,
            scoreAdjust: (Math.random() * 100).toFixed(1),
            purchasedSold: Math.floor(Math.random() * 500) + 50,
            supplierPrice: unitCostHT,
            expirySafety: '180 days'
        }, ...lines]);
    };

    const updateLine = (idx: number, updates: Record<string, any>) => {
        const newLines = [...lines];
        Object.assign(newLines[idx], updates);
        setLines(newLines);
    };

    const removeLine = (idx: number) => {
        setLines(lines.filter((_, i) => i !== idx));
    };

    return (
        <form action={formAction} className="h-full flex flex-col relative pb-32">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
            <input type="hidden" name="siteId" value={selectedSiteId} />

            {/* ═══ Float Absolute Header Controls ═══ */}
            <div className="absolute -top-[70px] right-2 md:right-8 flex items-center justify-end gap-3 z-50">
                {/* Scope Toggle */}
                <div className="flex rounded-full p-1"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                    }}>
                    <button 
                        type="button" 
                        onClick={() => setScope('OFFICIAL')} 
                        className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${scope === 'OFFICIAL' ? 'text-white' : ''}`}
                        style={scope === 'OFFICIAL' ? { background: 'var(--app-primary)' } : { color: 'var(--app-muted-foreground)' }}
                    >
                        OFFICIAL
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setScope('INTERNAL')} 
                        className={`px-4 py-1.5 rounded-full text-xs font-black transition-all`}
                        style={scope === 'INTERNAL' 
                            ? { background: 'var(--app-surface)', color: 'var(--app-primary)', boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 10%, transparent)' } 
                            : { color: 'var(--app-muted-foreground)' }}
                    >
                        INTERNAL
                    </button>
                </div>
                {/* Settings Icon */}
                <button type="button" className="p-2 rounded-full transition-colors"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        color: 'var(--app-muted-foreground)',
                        boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                    }}>
                    <Settings2 size={18} />
                </button>
                {/* Document Icon */}
                <button type="button" className="p-2 rounded-full text-white transition-colors"
                    style={{
                        background: 'var(--app-primary)',
                        border: '1px solid var(--app-primary)',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <FileText size={18} />
                </button>
            </div>

            {/* ═══ Smart Table Container ═══ */}
            <div className="rounded flex-1 min-h-[500px]"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                }}>
                
                {/* ── Search & Actions Toolbar ── */}
                <div className="flex flex-col md:flex-row"
                    style={{ borderBottom: '1px solid var(--app-border)' }}>
                    
                    {/* Tab Indicator */}
                    <div className="flex items-center relative pl-4 pr-6 py-4">
                        <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md"
                            style={{ background: 'var(--app-primary)' }} />
                        <span className="font-extrabold text-sm ml-2"
                            style={{ color: 'var(--app-foreground)' }}>
                            Product Lines
                        </span>
                    </div>

                    {/* Search Input */}
                    <div className="flex-1 flex items-center relative"
                        style={{ borderLeft: '1px solid var(--app-border)', borderRight: '1px solid var(--app-border)' }}>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18}
                            style={{ color: 'var(--app-muted-foreground)' }} />
                        <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)' }}>
                        <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                            style={{
                                border: '1px solid var(--app-border)',
                                background: 'var(--app-surface)',
                                color: 'var(--app-muted-foreground)',
                            }}>
                            <SlidersHorizontal size={14} />
                            13 COLS
                        </button>
                        <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                            style={{
                                border: '1px solid var(--app-border)',
                                background: 'var(--app-surface)',
                                color: 'var(--app-muted-foreground)',
                            }}>
                            <BookOpen size={14} />
                            CATALOGUE
                        </button>
                        <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                            style={{
                                border: '1px solid var(--app-border)',
                                background: 'var(--app-surface)',
                                color: 'var(--app-muted-foreground)',
                            }}>
                            <Plus size={14} />
                            NEW
                        </button>
                    </div>
                </div>

                {/* ═══ 13-Column Intelligence Data Grid ═══ */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                            <tr className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                <th className="px-4 py-3 font-black tracking-wider w-[240px]">PRODUCT</th>
                                <th className="px-3 py-3 font-black tracking-wider text-center">QTY</th>
                                <th className="px-3 py-3 font-black tracking-wider text-center">REQUESTED</th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>REQUIRED</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>proposed</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>STOCK</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>transit - total</div>
                                </th>
                                <th className="px-3 py-3 font-black tracking-wider text-center">PO COUNT</th>
                                <th className="px-3 py-3 font-black tracking-wider text-center">STATUS</th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>SALES</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>monthly</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>SCORE</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>adjust</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>PURCHASED</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>sold</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>COST</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>sell price</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>SUPPLIER</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>price</div>
                                </th>
                                <th className="px-3 py-3 text-center">
                                    <div className="font-black tracking-wider" style={{ color: 'var(--app-foreground)' }}>EXPIRY</div>
                                    <div className="font-semibold normal-case" style={{ color: 'var(--app-muted-foreground)' }}>safety</div>
                                </th>
                                <th className="px-3 py-3 font-black tracking-wider text-center"
                                    style={{ borderLeft: '1px solid var(--app-border)' }}>SUP+</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="h-64 align-middle">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <ShoppingCart className="mb-4" size={32}
                                                style={{ color: 'var(--app-muted-foreground)' }} />
                                            <h3 className="font-bold text-sm mb-1"
                                                style={{ color: 'var(--app-foreground)' }}>
                                                No products added yet
                                            </h3>
                                            <p className="text-xs"
                                                style={{ color: 'var(--app-muted-foreground)' }}>
                                                Search above or browse the catalogue
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            
                            {lines.map((line, idx) => (
                                <tr key={line.productId} 
                                    className="text-xs font-medium transition-colors"
                                    style={{ 
                                        color: 'var(--app-foreground)',
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    }}>
                                    <td className="px-4 py-3 max-w-[240px] truncate">
                                        <div className="font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                            {line.productName as string}
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                        <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    </td>
                                    
                                    <td className="px-3 py-2 text-center">
                                        <input
                                            type="number"
                                            className="w-16 rounded p-1.5 text-center font-bold outline-none transition-all"
                                            style={{
                                                background: 'var(--app-surface)',
                                                border: '1px solid var(--app-border)',
                                                color: 'var(--app-foreground)',
                                            }}
                                            value={line.quantity}
                                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                            name={`lines[${idx}][quantity]`}
                                        />
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center font-semibold"
                                        style={{ color: 'var(--app-muted-foreground)' }}>-</td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <span className="font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            {line.requiredProposed as number}
                                        </span>
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <span style={{ color: 'var(--app-muted-foreground)' }}>{line.stockTransit as number} - </span>
                                        <span className="font-bold">{line.stockTotal as number}</span>
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px]"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                color: 'var(--app-muted-foreground)',
                                            }}>
                                            {line.poCount as number}
                                        </div>
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                                color: 'var(--app-muted-foreground)',
                                            }}>
                                            {line.statusText as string}
                                        </span>
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center font-bold">
                                        {line.salesMonthly as number}
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center font-bold"
                                        style={{ color: 'var(--app-info, #3b82f6)' }}>
                                        {line.scoreAdjust as string}
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        {line.purchasedSold as number}
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <div className="font-bold">${Number(line.unitCostHT).toFixed(2)}</div>
                                        <div className="text-[10px] font-normal line-through"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            ${Number(line.sellingPriceHT).toFixed(2)}
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center">
                                        <div className="font-bold"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            ${Number(line.supplierPrice).toFixed(2)}
                                        </div>
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        {line.expirySafety as string}
                                    </td>
                                    
                                    <td className="px-3 py-3 text-center"
                                        style={{ borderLeft: '1px solid var(--app-border)' }}>
                                        <button type="button" onClick={() => removeLine(idx)} 
                                            className="transition-colors"
                                            style={{ color: 'var(--app-muted-foreground)' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ Sticky Action Footer ═══ */}
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50"
                style={{
                    background: 'var(--app-surface)',
                    borderTop: '2px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                    boxShadow: '0 -4px 6px -1px color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                }}>
                <div className="max-w-7xl mx-auto flex items-center justify-between px-2">
                    <div className="flex-1">
                        {state.message && (
                            <div className={`p-2 rounded inline-block text-xs font-bold`}
                                style={state.errors 
                                    ? { background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }
                                    : { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }
                                }>
                                {state.message}
                            </div>
                        )}
                    </div>
                    <div>
                        <button 
                            type="submit" 
                            disabled={isPending || lines.length === 0}
                            className="font-extrabold flex items-center gap-2 px-6 py-2.5 rounded-full transition-all disabled:opacity-50 text-white"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 85%, transparent)',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            {isPending ? 'Processing...' : 'Create PO'}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}

/* ═══ Product Search Component ═══ */
function ProductSearch({ callback, siteId }: { callback: (p: Record<string, any>) => void, siteId: number }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Record<string, any>[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 1) {
                const res = await searchProductsSimple(query, siteId);
                setResults(res);
                setOpen(true);
            } else {
                setResults([]);
                setOpen(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, siteId]);

    return (
        <div className="w-full relative py-3 px-10 border-none outline-none focus-within:ring-0">
            <input
                type="text"
                className="w-full h-full bg-transparent border-none outline-none text-sm font-medium"
                style={{ 
                    color: 'var(--app-foreground)',
                }}
                placeholder="Search product name, barcode, SKU..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)}
            />
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 max-h-64 mt-1 rounded z-50 overflow-y-auto"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 10px 40px color-mix(in srgb, var(--app-foreground) 15%, transparent)',
                    }}>
                    {results.map(r => (
                        <button
                            key={r.id as React.Key}
                            type="button"
                            onClick={() => {
                                callback(r);
                                setQuery('');
                                setOpen(false);
                            }}
                            className="w-full text-left p-3 text-xs font-semibold transition-colors"
                            style={{
                                color: 'var(--app-foreground)',
                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}
                        >
                            {r.name as React.ReactNode} <span className="font-normal ml-2" style={{ color: 'var(--app-muted-foreground)' }}>({r.sku as React.ReactNode})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}