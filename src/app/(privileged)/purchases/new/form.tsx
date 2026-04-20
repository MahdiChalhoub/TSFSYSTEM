'use client';

import { useActionState, useState, useEffect, useRef, useMemo } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createPurchaseInvoice } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import { 
    Search, ShoppingCart, SlidersHorizontal, BookOpen, Plus, 
    Trash2, ArrowRight, Settings2, FileText, Package, TrendingUp,
    BarChart3, DollarSign, AlertTriangle, Maximize2, Minimize2,
    LayoutGrid, Shield
} from "lucide-react";
import { useRouter } from "next/navigation";

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

    // --- Core Header State ---
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [invoicePriceType] = useState<'HT' | 'TTC'>('HT');
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);
    const [isFocusMode, setIsFocusMode] = useState(false);

    const [lines, setLines] = useState<PurchaseLine[]>([]);

    useEffect(() => {
        setVatRecoverable(scope === 'OFFICIAL');
    }, [scope]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setIsFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, []);

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

    // KPI calculations
    const totalQty = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const totalCost = lines.reduce((sum, l) => sum + ((Number(l.unitCostHT) || 0) * (Number(l.quantity) || 0)), 0);
    const avgMargin = lines.length > 0 
        ? lines.reduce((sum, l) => {
            const cost = Number(l.unitCostHT) || 0;
            const sell = Number(l.sellingPriceHT) || 0;
            return sum + (sell > 0 ? ((sell - cost) / sell) * 100 : 0);
        }, 0) / lines.length 
        : 0;

    const kpis = [
        { label: 'Products', value: lines.length.toString(), color: 'var(--app-primary)', icon: <Package size={14} /> },
        { label: 'Total Qty', value: totalQty.toLocaleString(), color: 'var(--app-info, #3b82f6)', icon: <BarChart3 size={14} /> },
        { label: 'Total Cost', value: totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: 'var(--app-success, #22c55e)', icon: <DollarSign size={14} /> },
        { label: 'Avg Margin', value: `${avgMargin.toFixed(1)}%`, color: '#8b5cf6', icon: <TrendingUp size={14} /> },
    ];

    const statusColorMap: Record<string, { bg: string; text: string; border: string }> = {
        'LOW': { bg: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', text: 'var(--app-warning)', border: 'color-mix(in srgb, var(--app-warning) 25%, transparent)' },
        'URGENT': { bg: 'color-mix(in srgb, var(--app-error) 10%, transparent)', text: 'var(--app-error)', border: 'color-mix(in srgb, var(--app-error) 25%, transparent)' },
        'OPTIONAL': { bg: 'color-mix(in srgb, var(--app-info) 10%, transparent)', text: 'var(--app-info)', border: 'color-mix(in srgb, var(--app-info) 25%, transparent)' },
    };

    return (
        <form action={formAction} className="flex-1 min-h-0 flex flex-col gap-4">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
            <input type="hidden" name="siteId" value={selectedSiteId} />

            {/* ── Top Control Panel ── */}
            {!isFocusMode && (
                <div className="bg-app-surface/60 backdrop-blur-md rounded-2xl border border-app-border/40 p-4 shadow-sm shrink-0 animate-in fade-in duration-200">
                    <div className="flex flex-col xl:flex-row gap-4 justify-between xl:items-end">
                        {/* Scope + Config */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }} className="flex-1">
                            {/* Scope Toggle */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 ml-1">Tax Scope</label>
                                <div className="flex rounded-xl overflow-hidden border border-app-border/50 h-[36px]">
                                    <button 
                                        type="button" 
                                        onClick={() => setScope('OFFICIAL')} 
                                        className={`flex-1 text-[11px] font-black uppercase tracking-widest transition-all ${
                                            scope === 'OFFICIAL' 
                                            ? 'bg-app-primary text-white' 
                                            : 'bg-app-surface text-app-muted-foreground hover:text-app-foreground'
                                        }`}
                                        style={scope === 'OFFICIAL' ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' } : {}}
                                    >
                                        Official
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setScope('INTERNAL')} 
                                        className={`flex-1 text-[11px] font-black uppercase tracking-widest transition-all ${
                                            scope === 'INTERNAL' 
                                            ? 'bg-app-primary text-white' 
                                            : 'bg-app-surface text-app-muted-foreground hover:text-app-foreground'
                                        }`}
                                        style={scope === 'INTERNAL' ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' } : {}}
                                    >
                                        Internal
                                    </button>
                                </div>
                            </div>
                            
                            {/* Site Selector */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 ml-1">Site / Branch</label>
                                <select
                                    value={selectedSiteId}
                                    onChange={e => setSelectedSiteId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full text-[12px] font-bold bg-app-surface border border-app-border/50 rounded-xl px-3 py-2 shadow-sm focus:border-app-primary outline-none transition-all text-app-foreground appearance-none h-[36px]"
                                >
                                    <option value="">All Sites</option>
                                    {sites.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Supplier (placeholder for context) */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 ml-1">Supplier</label>
                                <select
                                    className="w-full text-[12px] font-bold bg-app-surface border border-app-border/50 rounded-xl px-3 py-2 shadow-sm focus:border-app-primary outline-none transition-all text-app-foreground appearance-none h-[36px]"
                                >
                                    <option value="">Select Supplier...</option>
                                    {suppliers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-start xl:self-auto">
                            <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <Settings2 size={13} />
                                <span className="hidden md:inline">Config</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsFocusMode(true)} 
                                className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Focus Mode Compact Header ── */}
            {isFocusMode && (
                <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <ShoppingCart size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Purchase Order</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{lines.length} items</span>
                    </div>
                    <div className="flex-1">
                        <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                    </div>
                    <button onClick={() => setIsFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            <div className="shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                {kpis.map(s => (
                    <div key={s.label}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                        style={{
                            background: `color-mix(in srgb, ${s.color} 8%, var(--app-surface))`,
                            border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`,
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Intelligence Grid ── */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/40 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                {/* Search + Actions Toolbar */}
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 bg-app-surface/60 border-b border-app-border/40 backdrop-blur-md">
                    <div className="w-6 h-6 rounded-lg bg-app-primary/10 flex items-center justify-center text-app-primary flex-shrink-0">
                        <LayoutGrid size={13} />
                    </div>
                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider flex-shrink-0 hidden sm:inline">Product Lines</span>
                    
                    {!isFocusMode && (
                        <div className="flex-1">
                            <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                        </div>
                    )}
                    {isFocusMode && <div className="flex-1" />}

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <SlidersHorizontal size={13} />
                            <span className="hidden md:inline">13 Cols</span>
                        </button>
                        <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <BookOpen size={13} />
                            <span className="hidden md:inline">Catalogue</span>
                        </button>
                        <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Plus size={14} />
                            <span className="hidden sm:inline">New</span>
                        </button>
                    </div>
                </div>

                {/* Column Headers */}
                <div className="flex-shrink-0 hidden md:flex items-center gap-0 bg-app-surface border-b border-app-border/40 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="px-4 py-3 w-[220px] flex-shrink-0">Product</div>
                    <div className="px-3 py-3 w-[70px] flex-shrink-0 text-center">Qty</div>
                    <div className="px-3 py-3 w-[80px] flex-shrink-0 text-center hidden xl:block">Requested</div>
                    <div className="px-3 py-3 w-[85px] flex-shrink-0 text-center">
                        <div>Required</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">proposed</div>
                    </div>
                    <div className="px-3 py-3 w-[100px] flex-shrink-0 text-center hidden lg:block">
                        <div>Stock</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">transit · total</div>
                    </div>
                    <div className="px-3 py-3 w-[70px] flex-shrink-0 text-center hidden lg:block">PO Count</div>
                    <div className="px-3 py-3 w-[80px] flex-shrink-0 text-center">Status</div>
                    <div className="px-3 py-3 w-[80px] flex-shrink-0 text-center hidden xl:block">
                        <div>Sales</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">monthly</div>
                    </div>
                    <div className="px-3 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                        <div>Score</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">adjust</div>
                    </div>
                    <div className="px-3 py-3 w-[80px] flex-shrink-0 text-center hidden xl:block">
                        <div>Purchased</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">sold</div>
                    </div>
                    <div className="px-3 py-3 w-[90px] flex-shrink-0 text-center">
                        <div>Cost</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">sell price</div>
                    </div>
                    <div className="px-3 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                        <div>Supplier</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">price</div>
                    </div>
                    <div className="px-3 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block">
                        <div>Expiry</div>
                        <div className="font-semibold normal-case text-[9px] opacity-60">safety</div>
                    </div>
                    <div className="px-3 py-3 w-[50px] flex-shrink-0 text-center border-l border-app-border/40"></div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                    {lines.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <ShoppingCart size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No products added yet</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
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
                                    <div key={line.productId} className="group flex items-center gap-0 border-b border-app-border/20 hover:bg-app-surface/40 transition-colors">
                                        {/* Product */}
                                        <div className="px-4 py-2.5 w-[220px] flex-shrink-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                    <Package size={13} />
                                                </div>
                                                <span className="truncate text-[13px] font-bold text-app-foreground">{line.productName as string}</span>
                                            </div>
                                            <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                            <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                        </div>

                                        {/* Qty */}
                                        <div className="px-3 py-2 w-[70px] flex-shrink-0 text-center">
                                            <input
                                                type="number"
                                                className="w-full bg-app-surface border border-app-border/50 rounded-lg p-1.5 text-center font-bold text-[12px] focus:border-app-primary focus:ring-1 focus:ring-app-primary/10 outline-none transition-all text-app-foreground"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                                name={`lines[${idx}][quantity]`}
                                            />
                                        </div>

                                        {/* Requested */}
                                        <div className="px-3 py-2.5 w-[80px] flex-shrink-0 text-center font-semibold text-[12px] hidden xl:block" style={{ color: 'var(--app-muted-foreground)' }}>—</div>

                                        {/* Required */}
                                        <div className="px-3 py-2.5 w-[85px] flex-shrink-0 text-center">
                                            <span className="font-bold text-[12px] text-app-foreground tabular-nums">{line.requiredProposed as number}</span>
                                        </div>

                                        {/* Stock */}
                                        <div className="px-3 py-2.5 w-[100px] flex-shrink-0 text-center hidden lg:block">
                                            <span className="text-[12px] tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{line.stockTransit as number}</span>
                                            <span className="text-[12px] mx-1" style={{ color: 'var(--app-border)' }}>·</span>
                                            <span className="font-bold text-[12px] text-app-foreground tabular-nums">{line.stockTotal as number}</span>
                                        </div>

                                        {/* PO Count */}
                                        <div className="px-3 py-2.5 w-[70px] flex-shrink-0 text-center hidden lg:block">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold tabular-nums"
                                                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                {line.poCount as number}
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div className="px-3 py-2.5 w-[80px] flex-shrink-0 text-center">
                                            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                                                style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                                {line.statusText as string}
                                            </span>
                                        </div>

                                        {/* Sales */}
                                        <div className="px-3 py-2.5 w-[80px] flex-shrink-0 text-center hidden xl:block">
                                            <span className="font-bold text-[12px] text-app-foreground tabular-nums">{line.salesMonthly as number}</span>
                                        </div>

                                        {/* Score */}
                                        <div className="px-3 py-2.5 w-[75px] flex-shrink-0 text-center hidden xl:block">
                                            <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{line.scoreAdjust as string}</span>
                                        </div>

                                        {/* Purchased */}
                                        <div className="px-3 py-2.5 w-[80px] flex-shrink-0 text-center hidden xl:block">
                                            <span className="font-bold text-[12px] text-app-foreground tabular-nums">{line.purchasedSold as number}</span>
                                        </div>

                                        {/* Cost */}
                                        <div className="px-3 py-2.5 w-[90px] flex-shrink-0 text-center">
                                            <div className="font-bold font-mono text-[11px] text-app-foreground tabular-nums">{Number(line.unitCostHT).toFixed(2)}</div>
                                            <div className="text-[10px] font-bold line-through tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{Number(line.sellingPriceHT).toFixed(2)}</div>
                                            <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                        </div>

                                        {/* Supplier Price */}
                                        <div className="px-3 py-2.5 w-[90px] flex-shrink-0 text-center hidden lg:block">
                                            <span className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{Number(line.supplierPrice).toFixed(2)}</span>
                                        </div>

                                        {/* Expiry */}
                                        <div className="px-3 py-2.5 w-[90px] flex-shrink-0 text-center hidden lg:block">
                                            <div className="flex items-center justify-center gap-1">
                                                <Shield size={10} style={{ color: 'var(--app-success, #22c55e)' }} />
                                                <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{line.expirySafety as string}</span>
                                            </div>
                                        </div>

                                        {/* Delete */}
                                        <div className="px-3 py-2.5 w-[50px] flex-shrink-0 text-center border-l border-app-border/30">
                                            <button type="button" onClick={() => removeLine(idx)} 
                                                className="opacity-20 group-hover:opacity-100 p-1.5 hover:bg-app-border/30 rounded-lg transition-all"
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
                                    <div key={line.productId} className="bg-app-surface p-3 rounded-xl border border-app-border/50 shadow-sm relative">
                                        {/* Product Header */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                <Package size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="truncate text-[13px] font-bold text-app-foreground block">{line.productName as string}</span>
                                                <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider inline-block mt-0.5"
                                                    style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                                    {line.statusText as string}
                                                </span>
                                            </div>
                                            <button type="button" onClick={() => removeLine(idx)} 
                                                className="p-2 rounded-lg transition-all flex-shrink-0 border border-transparent hover:border-app-border/50"
                                                style={{ color: 'var(--app-error, #ef4444)' }}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                        <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                        
                                        {/* Data Grid */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-app-bg border border-app-border/50 rounded-lg p-1.5 text-center font-bold text-[12px] focus:border-app-primary outline-none transition-all text-app-foreground"
                                                    value={line.quantity}
                                                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                                    name={`lines[${idx}][quantity]`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Cost</label>
                                                <div className="text-[12px] font-bold font-mono text-app-foreground tabular-nums text-center py-1.5">{Number(line.unitCostHT).toFixed(2)}</div>
                                                <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">Stock</label>
                                                <div className="text-[12px] font-bold text-app-foreground tabular-nums text-center py-1.5">{line.stockTotal as number}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Action Footer ── */}
            <div className="shrink-0 flex justify-between items-center bg-app-surface/60 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-app-border/40">
                <div className="flex-1 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2.5 text-app-muted-foreground font-black uppercase tracking-widest text-[11px] hover:bg-app-surface rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    {state.message && (
                        <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${state.errors && Object.keys(state.errors).length > 0 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                            {state.message}
                        </div>
                    )}
                </div>
                <button 
                    type="submit" 
                    disabled={isPending || lines.length === 0}
                    className="flex items-center justify-center gap-2 bg-app-primary text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[160px]"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 40%, transparent)' }}
                >
                    {isPending ? 'Processing...' : <><ArrowRight size={14} /> Create PO</>}
                </button>
            </div>
        </form>
    );
}

/* ── Product Search Component ── */
import { forwardRef } from 'react';

const ProductSearch = forwardRef<HTMLInputElement, { callback: (p: Record<string, any>) => void, siteId: number }>(
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
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                    placeholder="Search by name, barcode, SKU... (Ctrl+K)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />
                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-64 mt-1 rounded-xl shadow-xl z-50 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{ 
                            background: 'var(--app-surface)', 
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)' 
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
                                className="w-full text-left p-3 border-b last:border-b-0 text-[12px] font-bold text-app-foreground transition-all flex items-center gap-2"
                                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 5%, transparent)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Package size={12} />
                                </div>
                                <span className="flex-1 truncate">{r.name as React.ReactNode}</span>
                                <span className="font-mono text-[11px] text-app-muted-foreground">{r.sku as React.ReactNode}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);