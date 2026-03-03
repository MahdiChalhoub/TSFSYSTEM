// @ts-nocheck
'use client';

import { useActionState, useState, useEffect } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createFormalPurchaseOrder } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { erpFetch } from "@/lib/erp-api";
import { Plus, Trash2, Search, Info, AlertTriangle, CheckCircle2, ShoppingCart, ArrowRight } from "lucide-react";

export default function FormalOrderForm({
    suppliers,
    sites
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[]
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createFormalPurchaseOrder, initialState);

    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [supplierPriceHints, setSupplierPriceHints] = useState<Record<number, number>>({});
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, any>[]>([]);
    const [lines, setLines] = useState<PurchaseLine[]>([]);

    useEffect(() => {
        if (selectedSiteId) {
            const site = sites.find(s => s.id === Number(selectedSiteId));
            const warehouses = site?.warehouses || [];
            setAvailableWarehouses(warehouses);
            // Auto-select first warehouse if none selected or if switching sites
            if (warehouses.length > 0) {
                setSelectedWarehouseId(warehouses[0].id);
            } else {
                setSelectedWarehouseId('');
            }
        } else {
            setAvailableWarehouses([]);
            setSelectedWarehouseId('');
        }
    }, [selectedSiteId, sites]);

    // Fetch Supplier Price Hints
    useEffect(() => {
        if (selectedSupplierId) {
            erpFetch(`sourcing/?supplier=${selectedSupplierId}`).then(data => {
                const hints: Record<number, number> = {};
                data.forEach((item: Record<string, any>) => {
                    hints[item.product] = parseFloat(item.last_purchased_price);
                });
                setSupplierPriceHints(hints);
            }).catch(console.error);
        } else {
            setSupplierPriceHints({});
        }
    }, [selectedSupplierId]);

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;

        // Use supplier hint if available, otherwise fallback to product cost price
        const suggestedPrice = supplierPriceHints[product.id] || product.costPriceHT || 0;

        setLines([{
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: 1,
            unitPrice: suggestedPrice,
        }, ...lines]);
    };

    const updateLine = (idx: number, updates: Record<string, any>) => {
        const newLines = [...lines];
        newLines[idx] = { ...newLines[idx], ...updates };
        setLines(newLines);
    };

    const removeLine = (idx: number) => {
        setLines(lines.filter((_, i) => i !== idx));
    };

    const totalAmount = lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);

    return (
        <form action={formAction} className="space-y-6">
            <div className="grid lg:grid-cols-4 gap-4">
                {/* Scope */}
                <div className="bg-app-surface/60 backdrop-blur-md p-5 rounded-3xl border border-app-border/50 shadow-sm flex flex-col justify-center">
                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 text-center">Procurement Scope</label>
                    <div className="flex p-1 bg-app-background rounded-2xl h-11">
                        <button type="button" onClick={() => setScope('OFFICIAL')} className={`flex-1 rounded-xl text-[10px] font-bold transition-all ${scope === 'OFFICIAL' ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-muted-foreground'}`}>OFFICIAL</button>
                        <button type="button" onClick={() => setScope('INTERNAL')} className={`flex-1 rounded-xl text-[10px] font-bold transition-all ${scope === 'INTERNAL' ? 'bg-app-primary text-app-foreground shadow-sm' : 'text-app-muted-foreground'}`}>INTERNAL</button>
                    </div>
                    <input type="hidden" name="scope" value={scope} />
                </div>

                {/* Logistics */}
                <div className="bg-app-surface/60 backdrop-blur-md p-5 rounded-3xl border border-app-border/50 shadow-sm flex flex-col justify-center">
                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 text-center">Destination Site</label>
                    <select className="w-full text-xs font-bold bg-transparent border-none focus:ring-0 text-center" value={selectedSiteId} onChange={(e) => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                        <option value="">Select Destination...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className="bg-app-surface/60 backdrop-blur-md p-5 rounded-3xl border border-app-border/50 shadow-sm flex flex-col justify-center">
                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 text-center">Warehouse</label>
                    <select
                        className="w-full text-xs font-bold bg-transparent border-none focus:ring-0 text-center text-app-primary"
                        name="warehouseId"
                        required
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                    >
                        <option value="">Warehouse...</option>
                        {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                {/* Supplier */}
                <div className="bg-app-surface/60 backdrop-blur-md p-5 rounded-3xl border border-app-border/50 shadow-sm flex flex-col justify-center">
                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 text-center">Supplier</label>
                    <select
                        className="w-full text-xs font-bold bg-transparent border-none focus:ring-0 text-center"
                        name="supplierId"
                        required
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                    >
                        <option value="">Select Supplier...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-app-surface/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-app-border/40 overflow-hidden">
                <div className="p-4 bg-app-background border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                        <ProductSearch
                            callback={addProductToLines}
                            siteId={Number(selectedSiteId)}
                            supplierId={Number(selectedSupplierId)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#F8FAFC] text-[10px] font-black text-app-muted-foreground uppercase tracking-widest border-b border-app-border">
                            <tr>
                                <th className="p-6">Product</th>
                                <th className="p-6 w-32 text-center">Quantity</th>
                                <th className="p-6 w-48 text-center">Expected Price (HT)</th>
                                <th className="p-6 text-right">Subtotal</th>
                                <th className="p-6 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {lines.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-app-muted-foreground italic">
                                        No items added to the quotation yet.
                                    </td>
                                </tr>
                            ) : (
                                lines.map((line, idx) => (
                                    <tr key={line.productId} className="hover:bg-app-surface-2/50 transition-colors">
                                        <td className="p-6">
                                            <div className="font-bold text-app-foreground">{line.productName}</div>
                                            <div className="text-[10px] text-app-muted-foreground font-mono mt-1">{line.sku}</div>
                                            <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                                        </td>
                                        <td className="p-6">
                                            <input
                                                type="number"
                                                className="w-full bg-app-surface border border-app-border rounded-xl p-2.5 text-center font-bold focus:border-app-primary/30 focus:ring-2 focus:ring-app-primary outline-none transition-all"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                                name={`lines[${idx}][quantity]`}
                                            />
                                        </td>
                                        <td className="p-6">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full bg-app-surface border border-app-border rounded-xl p-2.5 pr-10 text-center font-bold focus:border-app-primary/30 focus:ring-2 focus:ring-app-primary outline-none transition-all"
                                                    value={line.unitPrice}
                                                    onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                                    name={`lines[${idx}][unitPrice]`}
                                                />
                                                <span className="absolute right-3 text-[10px] font-black text-app-muted-foreground">XOF</span>
                                                {supplierPriceHints[line.productId] && (
                                                    <div className="absolute -top-6 left-0 right-0 text-center">
                                                        <span className="bg-app-primary-light text-app-primary text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-app-success/30">
                                                            Vendor Hint: {supplierPriceHints[line.productId].toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right font-black text-app-foreground whitespace-nowrap">
                                            {(line.quantity * line.unitPrice).toLocaleString()} XOF
                                        </td>
                                        <td className="p-6 text-center">
                                            <button type="button" onClick={() => removeLine(idx)} className="p-2 text-app-muted-foreground hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="flex-1 w-full bg-app-surface/60 backdrop-blur-md p-6 rounded-3xl border border-app-border/50 shadow-sm">
                    <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-3 block">Conditions & Observations</label>
                    <textarea
                        name="notes"
                        rows={4}
                        className="w-full border border-app-border rounded-2xl p-4 text-sm focus:border-app-primary/30 focus:ring-2 focus:ring-app-primary outline-none transition-all resize-none"
                        placeholder="Specify delivery terms, payment conditions, or reference codes..."
                    />
                </div>

                <div className="w-full md:w-96 space-y-4">
                    <div className="bg-app-surface/80 backdrop-blur-xl text-app-foreground p-8 rounded-[2.5rem] shadow-2xl border border-app-border/40">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-6 border-b border-app-border pb-4">Quotation Summary</div>
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-app-muted-foreground">Items Count</span>
                                <span className="font-bold">{lines.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">Estimated Total</span>
                                <span className="text-3xl font-black text-app-primary">{totalAmount.toLocaleString()} XOF</span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isPending || lines.length === 0}
                            className="w-full bg-app-primary hover:bg-app-primary/10 text-app-foreground font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group"
                        >
                            {isPending ? 'CREATING RFQ...' : 'SEND RFQ TO SUPPLIER'}
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        {state.message && (
                            <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 text-xs font-bold ${state.errors ? 'bg-app-error/10 text-rose-400' : 'bg-app-primary/10 text-app-primary'}`}>
                                {state.errors ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                                {state.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}

function ProductSearch({ callback, siteId, supplierId }: { callback: (p: Record<string, any>) => void, siteId: number, supplierId: number }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Record<string, unknown>[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 1) {
                const res = await searchProductsSimple(query, siteId, supplierId);
                setResults(res);
                setOpen(true);
            } else {
                setResults([]);
                setOpen(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, siteId, supplierId]);

    return (
        <div className="relative">
            <input
                type="text"
                className="w-full bg-transparent p-2 pl-4 text-sm font-bold text-app-foreground placeholder:text-app-muted-foreground outline-none"
                placeholder="Search products to replenish..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)}
            />
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-app-surface/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-app-border/40 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    {results.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                                callback(r);
                                setQuery('');
                                setOpen(false);
                            }}
                            className="w-full p-4 text-left hover:bg-app-primary/5 flex items-center justify-between group transition-all"
                        >
                            <div>
                                <div className="font-bold text-sm text-app-foreground group-hover:text-app-primary">{r.name}</div>
                                <div className="text-[10px] text-app-muted-foreground">SKU: {r.sku} ΓÇó In Stock: {r.stockLevel}</div>
                            </div>
                            <div className="text-right whitespace-nowrap">
                                <div className="text-xs font-black text-app-primary">{r.costPriceHT?.toLocaleString()} XOF HT</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
