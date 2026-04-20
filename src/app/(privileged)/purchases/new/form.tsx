'use client';

import { useActionState, useState, useEffect, useRef, forwardRef } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createPurchaseInvoice } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import {
    Search, ShoppingCart, SlidersHorizontal, BookOpen, Plus,
    Trash2, ArrowRight, Settings2, FileText, Package,
    LayoutGrid, Shield
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ═══════════════════════════════════════════════════════════════
 *  PRODUCT SEARCH — debounced typeahead
 * ═══════════════════════════════════════════════════════════════ */
const ProductSearch = forwardRef<HTMLInputElement, { callback: (p: Record<string, any>) => void; siteId: number }>(
    function ProductSearch({ callback, siteId }, ref) {
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
            <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent border-none outline-none transition-all"
                    style={{ color: 'var(--app-foreground)' }}
                    placeholder="Search product name, barcode, SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />
                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-64 mt-1 rounded-xl shadow-xl z-50 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}>
                        {results.map(r => (
                            <button
                                key={r.id as React.Key}
                                type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false); }}
                                className="w-full text-left p-3 border-b last:border-b-0 text-[12px] font-bold transition-all flex items-center gap-2"
                                style={{ color: 'var(--app-foreground)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 5%, transparent)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Package size={12} />
                                </div>
                                <span className="flex-1 truncate">{r.name as React.ReactNode}</span>
                                <span className="font-mono text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>{r.sku as React.ReactNode}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

/* ═══════════════════════════════════════════════════════════════
 *  MAIN FORM
 * ═══════════════════════════════════════════════════════════════ */
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
    const router = useRouter();
    const searchRef = useRef<HTMLInputElement>(null);

    // ── State ──
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [invoicePriceType] = useState<'HT' | 'TTC'>('HT');
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);
    const [lines, setLines] = useState<PurchaseLine[]>([]);

    useEffect(() => { setVatRecoverable(scope === 'OFFICIAL'); }, [scope]);

    // Keyboard shortcut: Ctrl+K → focus search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Line Management ──
    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        const taxRate = product.taxRate || 0.11;
        const unitCostHT = product.unitCostHT || product.costPriceHT || 0;
        const sellingPriceHT = product.sellingPriceHT || 0;

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
        }, ...prev]);
    };

    const updateLine = (idx: number, updates: Record<string, any>) => {
        const newLines = [...lines];
        Object.assign(newLines[idx], updates);
        setLines(newLines);
    };

    const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

    const statusColorMap: Record<string, { bg: string; text: string; border: string }> = {
        LOW: { bg: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', text: 'var(--app-warning)', border: 'color-mix(in srgb, var(--app-warning) 25%, transparent)' },
        URGENT: { bg: 'color-mix(in srgb, var(--app-error) 10%, transparent)', text: 'var(--app-error)', border: 'color-mix(in srgb, var(--app-error) 25%, transparent)' },
        OPTIONAL: { bg: 'color-mix(in srgb, var(--app-info) 10%, transparent)', text: 'var(--app-info)', border: 'color-mix(in srgb, var(--app-info) 25%, transparent)' },
    };

    return (
        <form action={formAction} className="flex-1 flex flex-col relative">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
            <input type="hidden" name="siteId" value={selectedSiteId} />

            {/* ═══ Floating Scope Toggle (top-right, inside header bar) ═══ */}
            <div className="absolute top-0 right-0 z-40 flex items-center gap-2 px-5 py-3"
                style={{ top: '-52px' }}>
                {/* Scope Pills */}
                <div className="flex rounded-full overflow-hidden h-[30px]"
                    style={{ border: '1px solid var(--app-border)' }}>
                    <button type="button" onClick={() => setScope('OFFICIAL')}
                        className="px-4 text-[10px] font-black uppercase tracking-wider transition-all"
                        style={scope === 'OFFICIAL' ? {
                            background: 'var(--app-primary)',
                            color: 'white',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        } : {
                            background: 'var(--app-surface)',
                            color: 'var(--app-muted-foreground)',
                        }}>
                        Official
                    </button>
                    <button type="button" onClick={() => setScope('INTERNAL')}
                        className="px-4 text-[10px] font-black uppercase tracking-wider transition-all"
                        style={scope === 'INTERNAL' ? {
                            background: 'var(--app-primary)',
                            color: 'white',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        } : {
                            background: 'var(--app-surface)',
                            color: 'var(--app-muted-foreground)',
                        }}>
                        Internal
                    </button>
                </div>
                {/* Settings gear */}
                <button type="button" className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                    <Settings2 size={15} />
                </button>
                {/* Document icon */}
                <button type="button" className="p-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--app-primary)', color: 'white' }}>
                    <FileText size={15} />
                </button>
            </div>

            {/* ═══ Toolbar: Product Lines + Search + Actions ═══ */}
            <div className="flex-shrink-0 flex items-center gap-0"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                {/* Product Lines label with left accent */}
                <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
                    style={{ borderLeft: '3px solid var(--app-primary)' }}>
                    <LayoutGrid size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                        Product Lines
                    </span>
                </div>

                {/* Search */}
                <div className="flex-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                </div>

                {/* Right buttons */}
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

            {/* ═══ Column Headers ═══ */}
            <div className="flex-shrink-0 hidden md:flex items-center gap-0 text-[10px] font-black uppercase tracking-wider"
                style={{
                    color: 'var(--app-muted-foreground)',
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="px-4 py-3 w-[200px] flex-shrink-0">Product</div>
                <div className="px-2 py-3 w-[60px] flex-shrink-0 text-center">Qty</div>
                <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">Requested</div>
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <div>Required</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">proposed</div>
                </div>
                <div className="px-2 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                    <div>Stock</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">transit · total</div>
                </div>
                <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden lg:block">
                    <div>PO</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">Count</div>
                </div>
                <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center">Status</div>
                <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center hidden xl:block">
                    <div>Sales</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">monthly</div>
                </div>
                <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden xl:block">
                    <div>Score</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">adjust</div>
                </div>
                <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                    <div>Purchased</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">sold</div>
                </div>
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <div>Cost</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">sell price</div>
                </div>
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <div>Supplier</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">price</div>
                </div>
                <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <div>Expiry</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">safety</div>
                </div>
                <div className="px-2 py-3 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid var(--app-border)' }}>SUP+</div>
            </div>

            {/* ═══ Scrollable Body ═══ */}
            <div className="flex-1 overflow-y-auto overflow-x-auto"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, var(--app-background))' }}>

                {/* Empty State */}
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                        <ShoppingCart size={40} className="mb-4 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>No products added yet</p>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            Search above or browse the catalogue to add product lines.
                        </p>
                    </div>
                )}

                {/* Desktop Rows */}
                {lines.length > 0 && (
                    <div className="hidden md:block">
                        {lines.map((line, idx) => {
                            const statusStyle = statusColorMap[(line.statusText as string) || 'OPTIONAL'] || statusColorMap['OPTIONAL'];
                            return (
                                <div key={line.productId} className="group flex items-center gap-0 transition-colors"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 3%, transparent)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                    {/* Product */}
                                    <div className="px-4 py-2.5 w-[200px] flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                <Package size={13} />
                                            </div>
                                            <span className="truncate text-[13px] font-bold" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                        <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    </div>
                                    {/* Qty */}
                                    <div className="px-2 py-2 w-[60px] flex-shrink-0 text-center">
                                        <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            value={line.quantity}
                                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                            name={`lines[${idx}][quantity]`} />
                                    </div>
                                    {/* Requested */}
                                    <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center font-semibold text-[12px] hidden xl:block" style={{ color: 'var(--app-muted-foreground)' }}>—</div>
                                    {/* Required */}
                                    <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.requiredProposed as number}</span>
                                    </div>
                                    {/* Stock */}
                                    <div className="px-2 py-2.5 w-[90px] flex-shrink-0 text-center hidden lg:block">
                                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{line.stockTransit as number}</span>
                                        <span className="text-[12px] mx-0.5" style={{ color: 'var(--app-border)' }}>·</span>
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</span>
                                    </div>
                                    {/* PO Count */}
                                    <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden lg:block">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold tabular-nums"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                            {line.poCount as number}
                                        </span>
                                    </div>
                                    {/* Status */}
                                    <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center">
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                                            style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                            {line.statusText as string}
                                        </span>
                                    </div>
                                    {/* Sales */}
                                    <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.salesMonthly as number}</span>
                                    </div>
                                    {/* Score */}
                                    <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{line.scoreAdjust as string}</span>
                                    </div>
                                    {/* Purchased */}
                                    <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.purchasedSold as number}</span>
                                    </div>
                                    {/* Cost */}
                                    <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                                        <div className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{Number(line.unitCostHT).toFixed(2)}</div>
                                        <div className="text-[10px] font-bold line-through tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{Number(line.sellingPriceHT).toFixed(2)}</div>
                                        <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                    </div>
                                    {/* Supplier Price */}
                                    <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block">
                                        <span className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{Number(line.supplierPrice).toFixed(2)}</span>
                                    </div>
                                    {/* Expiry */}
                                    <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block">
                                        <div className="flex items-center justify-center gap-1">
                                            <Shield size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                            <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{line.expirySafety as string}</span>
                                        </div>
                                    </div>
                                    {/* Delete */}
                                    <div className="px-2 py-2.5 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="opacity-20 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Mobile Cards */}
                {lines.length > 0 && (
                    <div className="block md:hidden p-3 space-y-3">
                        {lines.map((line, idx) => {
                            const statusStyle = statusColorMap[(line.statusText as string) || 'OPTIONAL'] || statusColorMap['OPTIONAL'];
                            return (
                                <div key={line.productId} className="p-3 rounded-xl shadow-sm relative"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                            <Package size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="truncate text-[13px] font-bold block" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                                            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider inline-block mt-0.5"
                                                style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                                {line.statusText as string}
                                            </span>
                                        </div>
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="p-2 rounded-lg transition-all flex-shrink-0"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                    <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Qty</label>
                                            <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                                name={`lines[${idx}][quantity]`} />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Cost</label>
                                            <div className="text-[12px] font-bold font-mono tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{Number(line.unitCostHT).toFixed(2)}</div>
                                            <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Stock</label>
                                            <div className="text-[12px] font-bold tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Sticky Footer with Gradient Line ═══ */}
            <div className="flex-shrink-0 relative">
                {/* Teal gradient line */}
                <div className="h-[3px] w-full"
                    style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--app-primary) 60%, transparent), color-mix(in srgb, var(--app-primary) 20%, transparent))` }} />

                <div className="flex justify-between items-center px-5 py-4"
                    style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
                    {/* Left: Messages */}
                    <div className="flex-1">
                        {state.message && (
                            <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-block ${state.errors && Object.keys(state.errors).length > 0 ? '' : ''}`}
                                style={{
                                    background: state.errors && Object.keys(state.errors).length > 0
                                        ? 'color-mix(in srgb, var(--app-error) 10%, transparent)'
                                        : 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                    color: state.errors && Object.keys(state.errors).length > 0
                                        ? 'var(--app-error)'
                                        : 'var(--app-success)',
                                }}>
                                {state.message}
                            </div>
                        )}
                    </div>

                    {/* Right: Create PO button */}
                    <button
                        type="submit"
                        disabled={isPending || lines.length === 0}
                        className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-full font-black uppercase tracking-widest text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{
                            background: 'var(--app-primary)',
                            color: 'white',
                            boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 40%, transparent)',
                        }}>
                        {isPending ? 'Processing...' : <><ArrowRight size={14} /> Create PO</>}
                    </button>
                </div>
            </div>
        </form>
    );
}