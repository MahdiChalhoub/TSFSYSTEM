// @ts-nocheck
'use client';

import { useActionState, useState, useEffect } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createFormalPurchaseOrder } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { erpFetch } from "@/lib/erp-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Plus, Trash2, Search, AlertTriangle, CheckCircle2,
    ShoppingCart, ArrowRight, Package, Building2, Truck
} from "lucide-react";

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

    const safeSites = Array.isArray(sites) ? sites : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

    useEffect(() => {
        if (selectedSiteId) {
            const site = safeSites.find(s => s.id === Number(selectedSiteId));
            const warehouses = Array.isArray(site?.warehouses) ? site.warehouses : [];
            setAvailableWarehouses(warehouses);
            if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0].id);
            else setSelectedWarehouseId('');
        } else {
            setAvailableWarehouses([]);
            setSelectedWarehouseId('');
        }
    }, [selectedSiteId, safeSites]);

    useEffect(() => {
        if (selectedSupplierId) {
            erpFetch(`sourcing/?supplier=${selectedSupplierId}`).then(data => {
                const raw = Array.isArray(data) ? data : (data?.results ?? []);
                const hints: Record<number, number> = {};
                raw.forEach((item: Record<string, any>) => {
                    hints[item.product] = parseFloat(item.last_purchased_price);
                });
                setSupplierPriceHints(hints);
            }).catch(() => setSupplierPriceHints({}));
        } else {
            setSupplierPriceHints({});
        }
    }, [selectedSupplierId]);

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
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

    const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
    const totalAmount = lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);

    return (
        <form action={formAction} className="space-y-4 md:space-y-[var(--layout-element-gap)]">
            {/* Configuration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Scope */}
                <Card className="border shadow-sm">
                    <CardContent className="p-4">
                        <Label className="text-[10px] font-black uppercase tracking-wider theme-text-muted mb-2 block text-center">Scope</Label>
                        <div className="flex p-1 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                            <button type="button" onClick={() => setScope('OFFICIAL')}
                                className={`flex-1 rounded-lg py-2 text-[10px] font-bold transition-all min-h-[36px] ${scope === 'OFFICIAL' ? 'bg-white bg-app-surface shadow-sm theme-text' : 'theme-text-muted'}`}>
                                OFFICIAL
                            </button>
                            <button type="button" onClick={() => setScope('INTERNAL')}
                                className={`flex-1 rounded-lg py-2 text-[10px] font-bold transition-all min-h-[36px] ${scope === 'INTERNAL' ? 'bg-indigo-500 text-white shadow-sm' : 'theme-text-muted'}`}>
                                INTERNAL
                            </button>
                        </div>
                        <input type="hidden" name="scope" value={scope} />
                    </CardContent>
                </Card>

                {/* Site */}
                <Card className="border shadow-sm">
                    <CardContent className="p-4">
                        <Label className="text-[10px] font-black uppercase tracking-wider theme-text-muted mb-2 block text-center">Destination Site</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-2 min-h-[36px] theme-text"
                            style={{ border: '1px solid var(--theme-border)' }}
                            value={selectedSiteId} onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                            <option value="">Select Site...</option>
                            {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Warehouse */}
                <Card className="border shadow-sm">
                    <CardContent className="p-4">
                        <Label className="text-[10px] font-black uppercase tracking-wider theme-text-muted mb-2 block text-center">Warehouse</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-2 min-h-[36px] text-indigo-500"
                            style={{ border: '1px solid var(--theme-border)' }}
                            name="warehouseId" required value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                            <option value="">Warehouse...</option>
                            {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Supplier */}
                <Card className="border shadow-sm">
                    <CardContent className="p-4">
                        <Label className="text-[10px] font-black uppercase tracking-wider theme-text-muted mb-2 block text-center">Supplier</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-2 min-h-[36px] theme-text"
                            style={{ border: '1px solid var(--theme-border)' }}
                            name="supplierId" required value={selectedSupplierId}
                            onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                            <option value="">Select Supplier...</option>
                            {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </CardContent>
                </Card>
            </div>

            {/* Items */}
            <Card className="border shadow-sm overflow-hidden">
                <div className="p-3 md:p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <Search size={16} className="theme-text-muted shrink-0" />
                    <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)} />
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-wider theme-text-muted" style={{ borderBottom: '1px solid var(--theme-border)' }}>
                                <th className="text-left py-3 px-4">Product</th>
                                <th className="text-center py-3 px-4 w-28">Qty</th>
                                <th className="text-center py-3 px-4 w-40">Price (HT)</th>
                                <th className="text-right py-3 px-4">Subtotal</th>
                                <th className="py-3 px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center theme-text-muted text-sm">
                                    <Package size={32} className="mx-auto mb-2 opacity-30" />No items added yet — search above to add products
                                </td></tr>
                            ) : lines.map((line, idx) => (
                                <tr key={line.productId} className="hover:bg-app-surface-hover dark:hover:bg-gray-900/20" style={{ borderBottom: '1px solid var(--theme-border)' }}>
                                    <td className="py-3 px-4">
                                        <div className="font-bold theme-text">{line.productName}</div>
                                        <div className="text-[10px] theme-text-muted font-mono mt-0.5">{line.sku}</div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                                    </td>
                                    <td className="py-3 px-4">
                                        <Input type="number" className="text-center font-black min-h-[36px]"
                                            value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                            name={`lines[${idx}][quantity]`} />
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="relative">
                                            <Input type="number" step="0.01" className="text-center font-black min-h-[36px]"
                                                value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                                name={`lines[${idx}][unitPrice]`} />
                                            {supplierPriceHints[line.productId] && (
                                                <div className="text-[9px] font-bold text-emerald-500 text-center mt-0.5">
                                                    Hint: {supplierPriceHints[line.productId].toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-black theme-text">{(line.quantity * line.unitPrice).toLocaleString()}</td>
                                    <td className="py-3 px-4">
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="p-2 theme-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-3 space-y-2">
                    {lines.length === 0 ? (
                        <div className="py-12 text-center theme-text-muted text-sm">
                            <Package size={32} className="mx-auto mb-2 opacity-30" />No items added yet
                        </div>
                    ) : lines.map((line, idx) => (
                        <div key={line.productId} className="p-3 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold theme-text text-sm">{line.productName}</div>
                                    <div className="text-[10px] theme-text-muted font-mono">{line.sku}</div>
                                </div>
                                <button type="button" onClick={() => removeLine(idx)}
                                    className="p-2 theme-text-muted hover:text-rose-500 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-[9px] font-bold">Qty</Label>
                                    <Input type="number" className="text-center font-black min-h-[44px]"
                                        value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                        name={`lines[${idx}][quantity]`} />
                                </div>
                                <div>
                                    <Label className="text-[9px] font-bold">Price HT</Label>
                                    <Input type="number" step="0.01" className="text-center font-black min-h-[44px]"
                                        value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                        name={`lines[${idx}][unitPrice]`} />
                                </div>
                            </div>
                            <div className="text-right font-black theme-text mt-2">{(line.quantity * line.unitPrice).toLocaleString()}</div>
                            <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                        </div>
                    ))}
                </div>
            </Card>

            {/* Bottom: Notes + Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <Card className="border shadow-sm">
                        <CardContent className="p-4 md:p-5">
                            <Label className="text-[10px] font-black uppercase tracking-wider theme-text-muted mb-2 block">Notes & Conditions</Label>
                            <textarea name="notes" rows={4}
                                className="w-full rounded-xl p-3 text-sm theme-text theme-surface resize-none min-h-[96px]"
                                style={{ border: '1px solid var(--theme-border)' }}
                                placeholder="Delivery terms, payment conditions, or reference codes..." />
                        </CardContent>
                    </Card>
                </div>

                <Card className="border shadow-sm">
                    <CardContent className="p-5 space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-wider theme-text-muted">Order Summary</h3>
                        <div className="flex justify-between text-sm">
                            <span className="theme-text-muted">Items</span>
                            <span className="font-bold theme-text">{lines.length}</span>
                        </div>
                        <div className="pt-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
                            <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mb-1">Estimated Total</p>
                            <p className="text-2xl md:text-3xl font-black text-indigo-500 tracking-tight">{totalAmount.toLocaleString()}</p>
                        </div>

                        <Button type="submit" disabled={isPending || lines.length === 0}
                            className="w-full min-h-[52px] bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm">
                            {isPending ? 'Creating...' : (
                                <><ArrowRight size={16} className="mr-2" /> Send PO to Supplier</>
                            )}
                        </Button>

                        {state.message && (
                            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${state.errors ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
                                {state.errors ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                                {state.message}
                            </div>
                        )}
                    </CardContent>
                </Card>
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
                const raw = Array.isArray(res) ? res : (res?.results ?? []);
                setResults(raw);
                setOpen(true);
            } else {
                setResults([]);
                setOpen(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, siteId, supplierId]);

    return (
        <div className="relative flex-1">
            <input type="text"
                className="w-full bg-transparent p-2 text-sm font-bold theme-text placeholder:theme-text-muted outline-none min-h-[40px]"
                placeholder="Search products to add..."
                value={query} onChange={e => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)} />
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
                    style={{ border: '1px solid var(--theme-border)' }}>
                    {results.map((r: any) => (
                        <button key={r.id} type="button"
                            onClick={() => { callback(r); setQuery(''); setOpen(false); }}
                            className="w-full p-3 text-left hover:bg-app-surface-hover dark:hover:bg-gray-800 flex items-center justify-between transition-all min-h-[52px]"
                            style={{ borderBottom: '1px solid var(--theme-border)' }}>
                            <div>
                                <div className="font-bold text-sm theme-text">{r.name}</div>
                                <div className="text-[10px] theme-text-muted">SKU: {r.sku} • Stock: {r.stockLevel}</div>
                            </div>
                            <div className="text-xs font-black text-indigo-500 shrink-0 ml-2">{r.costPriceHT?.toLocaleString()} HT</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
