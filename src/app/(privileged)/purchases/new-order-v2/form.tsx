// @ts-nocheck
'use client';

import { useActionState, useState, useEffect } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createFormalPurchaseOrderV2 } from "@/app/actions/commercial/purchases-v2";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { erpFetch } from "@/lib/erp-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Trash2, Search, AlertTriangle, CheckCircle2,
    Package, Building2, Truck, Calendar, CreditCard,
    User, Star, Hash, Layers, Send
} from "lucide-react";

type IntelLine = PurchaseLine & {
    stockLevel?: number;
    totalStock?: number;
    stockInLocation?: number;
    dailySales?: number;
    monthlyAverage?: number;
    purchaseCount?: number;
    totalPurchase?: number;
    totalSales?: number;
    financialScore?: number;
    adjustmentScore?: number;
    bestSupplier?: string;
    bestPrice?: number;
    proposedQty?: number;
    shelfLifeDays?: number;
    avgExpiryDays?: number;
    safetyTag?: string;
    daysToSellAll?: number;
    costPriceHT?: number;
    sellingPriceTTC?: number;
    otherWarehouseStock?: { warehouse: string; qty: number }[];
};

export default function FormalOrderFormV2({
    suppliers,
    sites,
    paymentTerms,
    drivers
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    paymentTerms: Record<string, any>[],
    drivers: Record<string, any>[]
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createFormalPurchaseOrderV2, initialState);

    // ── Core Fields ──
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [priority, setPriority] = useState('NORMAL');
    const [purchaseSubType, setPurchaseSubType] = useState('STANDARD');
    const [expectedDate, setExpectedDate] = useState('');
    const [supplierRef, setSupplierRef] = useState('');
    const [paymentTermId, setPaymentTermId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [currency, setCurrency] = useState('XOF');
    const [shippingCost, setShippingCost] = useState(0);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [internalNotes, setInternalNotes] = useState('');

    // ── Intelligence ──
    const [stockScope, setStockScope] = useState<'branch' | 'all'>('branch');
    const [supplierPriceHints, setSupplierPriceHints] = useState<Record<number, number>>({});
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, any>[]>([]);
    const [lines, setLines] = useState<IntelLine[]>([]);

    const safeSites = Array.isArray(sites) ? sites : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const safePaymentTerms = Array.isArray(paymentTerms) ? paymentTerms : [];
    const safeDrivers = Array.isArray(drivers) ? drivers : [];

    // ── Warehouse cascading ──
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

    // ── Supplier price hints ──
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

    // ── Intelligence Data Fetch ──
    const fetchIntelligence = async (productId: number, qty: number) => {
        try {
            const params = new URLSearchParams({
                query: '',
                warehouse_id: String(selectedWarehouseId || ''),
                stock_scope: stockScope,
                order_qty: String(qty),
            });
            const data = await erpFetch(`catalogue/search-enhanced/?product_id=${productId}&${params}`);
            const items = Array.isArray(data) ? data : (data?.results ?? []);
            return items.find((p: any) => p.id === productId) || {};
        } catch {
            return {};
        }
    };

    const addProductToLines = async (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        const suggestedPrice = supplierPriceHints[product.id] || product.costPriceHT || 0;
        const proposedQty = product.proposedQty || 1;

        const intel = await fetchIntelligence(product.id, proposedQty).catch(() => ({}));

        setLines(prev => [{
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: proposedQty,
            unitPrice: suggestedPrice,
            stockLevel: intel.stockLevel ?? product.stockLevel ?? 0,
            totalStock: intel.totalStock ?? 0,
            stockInLocation: intel.stockInLocation ?? 0,
            dailySales: intel.dailySales ?? 0,
            monthlyAverage: intel.monthlyAverage ?? 0,
            purchaseCount: intel.purchaseCount ?? 0,
            totalPurchase: intel.totalPurchase ?? 0,
            totalSales: intel.totalSales ?? 0,
            financialScore: intel.financialScore ?? 0,
            adjustmentScore: intel.adjustmentScore ?? 0,
            bestSupplier: intel.bestSupplier ?? '—',
            bestPrice: intel.bestPrice ?? 0,
            proposedQty: intel.proposedQty ?? proposedQty,
            shelfLifeDays: intel.shelfLifeDays ?? 0,
            avgExpiryDays: intel.avgExpiryDays ?? 0,
            safetyTag: intel.safetyTag ?? 'SAFE',
            daysToSellAll: intel.daysToSellAll ?? 0,
            costPriceHT: product.costPriceHT ?? 0,
            sellingPriceTTC: product.sellingPriceTTC ?? 0,
            otherWarehouseStock: intel.otherWarehouseStock ?? [],
        }, ...prev]);
    };

    const updateLine = (idx: number, updates: Record<string, any>) => {
        const newLines = [...lines];
        newLines[idx] = { ...newLines[idx], ...updates };
        setLines(newLines);
    };

    const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
    const totalAmount = lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);
    const grandTotal = totalAmount + shippingCost - discountAmount;

    const SafetyBadge = ({ tag }: { tag: string }) => {
        const config: Record<string, { bg: string, text: string, label: string }> = {
            SAFE: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600', label: '🟢 Safe' },
            CAUTION: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600', label: '🟡 Caution' },
            RISKY: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600', label: '🔴 Risky' },
        };
        const c = config[tag] || config.SAFE;
        return <span className={`${c.bg} ${c.text} text-[9px] font-black px-2 py-0.5 rounded-full`}>{c.label}</span>;
    };

    return (
        <form action={formAction} className="space-y-4 md:space-y-[var(--layout-element-gap)]">
            {/* ═══ Row 1: Core Config (6 cols) ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Scope */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block text-center">Scope</Label>
                        <div className="flex p-0.5 rounded-lg bg-app-muted/30" style={{ border: '1px solid var(--app-border)' }}>
                            <button type="button" onClick={() => setScope('OFFICIAL')}
                                className={`flex-1 rounded-md py-1.5 text-[9px] font-bold transition-all min-h-[32px] ${scope === 'OFFICIAL' ? 'bg-white dark:bg-gray-800 shadow-sm text-app-foreground' : 'text-app-muted-foreground'}`}>
                                OFFICIAL
                            </button>
                            <button type="button" onClick={() => setScope('INTERNAL')}
                                className={`flex-1 rounded-md py-1.5 text-[9px] font-bold transition-all min-h-[32px] ${scope === 'INTERNAL' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground'}`}>
                                INTERNAL
                            </button>
                        </div>
                        <input type="hidden" name="scope" value={scope} />
                    </CardContent>
                </Card>

                {/* Site */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Building2 size={10} className="inline mr-1" />Site</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            value={selectedSiteId} onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                            <option value="">Select...</option>
                            {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Warehouse */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Package size={10} className="inline mr-1" />Warehouse</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-primary"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="warehouseId" required value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                            <option value="">Warehouse...</option>
                            {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Supplier */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Truck size={10} className="inline mr-1" />Supplier</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="supplierId" required value={selectedSupplierId}
                            onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                            <option value="">Select...</option>
                            {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Priority */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Star size={10} className="inline mr-1" />Priority</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="priority" value={priority} onChange={e => setPriority(e.target.value)}>
                            <option value="LOW">Low</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                        </select>
                    </CardContent>
                </Card>

                {/* Purchase Type */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Layers size={10} className="inline mr-1" />Type</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="purchaseSubType" value={purchaseSubType} onChange={e => setPurchaseSubType(e.target.value)}>
                            <option value="STANDARD">Standard</option>
                            <option value="WHOLESALE">Wholesale</option>
                            <option value="CONSIGNEE">Consignee</option>
                        </select>
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Row 2: Extended Config (6 cols) ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Expected Delivery */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Calendar size={10} className="inline mr-1" />Expected Delivery</Label>
                        <Input type="date" className="text-xs font-bold min-h-[32px]" name="expectedDate"
                            value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                    </CardContent>
                </Card>

                {/* Supplier Ref */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Hash size={10} className="inline mr-1" />Supplier Ref</Label>
                        <Input type="text" className="text-xs font-bold min-h-[32px]" name="supplierRef" placeholder="Quote #..."
                            value={supplierRef} onChange={e => setSupplierRef(e.target.value)} />
                    </CardContent>
                </Card>

                {/* Payment Terms */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><CreditCard size={10} className="inline mr-1" />Payment Terms</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="paymentTermId" value={paymentTermId} onChange={e => setPaymentTermId(e.target.value)}>
                            <option value="">None</option>
                            {safePaymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Assigned Driver */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><User size={10} className="inline mr-1" />Driver</Label>
                        <select className="w-full text-xs font-bold bg-transparent rounded-lg p-1.5 min-h-[32px] text-app-foreground"
                            style={{ border: '1px solid var(--app-border)' }}
                            name="driverId" value={driverId} onChange={e => setDriverId(e.target.value)}>
                            <option value="">None</option>
                            {safeDrivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {/* Shipping Cost */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><Truck size={10} className="inline mr-1" />Shipping</Label>
                        <Input type="number" step="0.01" className="text-xs font-bold min-h-[32px] text-center" name="shippingCost"
                            value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} />
                    </CardContent>
                </Card>

                {/* Discount */}
                <Card className="border shadow-sm">
                    <CardContent className="p-3">
                        <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block"><CreditCard size={10} className="inline mr-1" />Discount</Label>
                        <Input type="number" step="0.01" className="text-xs font-bold min-h-[32px] text-center" name="discountAmount"
                            value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                    </CardContent>
                </Card>
            </div>

            {/* ═══ Row 3: Stock Scope + Product Search ═══ */}
            <Card className="border shadow-sm overflow-hidden">
                <div className="p-3 md:p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <Search size={16} className="text-app-muted-foreground shrink-0" />
                    <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)} />
                    <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[9px] font-black uppercase text-app-muted-foreground">Stock:</span>
                        <button type="button" onClick={() => setStockScope('branch')}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${stockScope === 'branch' ? 'bg-app-primary text-white' : 'text-app-muted-foreground bg-app-muted/30'}`}>
                            Branch
                        </button>
                        <button type="button" onClick={() => setStockScope('all')}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${stockScope === 'all' ? 'bg-app-primary text-white' : 'text-app-muted-foreground bg-app-muted/30'}`}>
                            All
                        </button>
                    </div>
                </div>

                {/* ═══ Intelligence Table (Desktop) ═══ */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                <th className="text-left py-2 px-3 sticky left-0 bg-app-background z-10 min-w-[160px]">Product</th>
                                <th className="text-center py-2 px-2 w-20">Qty</th>
                                <th className="text-center py-2 px-2 w-24">Price HT</th>
                                <th className="text-right py-2 px-2 w-20">Subtotal</th>
                                <th className="text-center py-2 px-2 w-16">Stock</th>
                                <th className="text-center py-2 px-2 w-20">Daily Sales</th>
                                <th className="text-center py-2 px-2 w-20">Monthly</th>
                                <th className="text-center py-2 px-2 w-20">Fin. Score</th>
                                <th className="text-center py-2 px-2 w-24">Best Supplier</th>
                                <th className="text-center py-2 px-2 w-16">Expiry</th>
                                <th className="py-2 px-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 ? (
                                <tr><td colSpan={11} className="py-16 text-center text-app-muted-foreground text-sm">
                                    <Package size={32} className="mx-auto mb-2 opacity-30" />No items added yet — search above to add products
                                </td></tr>
                            ) : lines.map((line, idx) => (
                                <tr key={line.productId} className="hover:bg-app-muted/20 transition-colors" style={{ borderBottom: '1px solid var(--app-border)' }}>
                                    <td className="py-2 px-3 sticky left-0 bg-app-background z-10">
                                        <div className="font-bold text-app-foreground text-xs">{line.productName}</div>
                                        <div className="text-[9px] text-app-muted-foreground font-mono">{line.sku}</div>
                                        {line.proposedQty > 0 && line.proposedQty !== line.quantity && (
                                            <div className="text-[8px] text-app-primary font-bold mt-0.5">Proposed: {line.proposedQty}</div>
                                        )}
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                                    </td>
                                    <td className="py-2 px-2">
                                        <Input type="number" className="text-center font-black min-h-[28px] text-xs w-full"
                                            value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                            name={`lines[${idx}][quantity]`} />
                                    </td>
                                    <td className="py-2 px-2">
                                        <div>
                                            <Input type="number" step="0.01" className="text-center font-black min-h-[28px] text-xs w-full"
                                                value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                                name={`lines[${idx}][unitPrice]`} />
                                            {supplierPriceHints[line.productId] && (
                                                <div className="text-[8px] font-bold text-emerald-500 text-center mt-0.5">
                                                    Hint: {supplierPriceHints[line.productId].toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-black text-app-foreground">{(line.quantity * line.unitPrice).toLocaleString()}</td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="font-bold text-app-foreground">{line.stockInLocation ?? line.stockLevel ?? 0}</div>
                                        <div className="text-[8px] text-app-muted-foreground">Total: {line.totalStock ?? 0}</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="font-bold">{(line.dailySales || 0).toFixed(1)}</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="font-bold">{(line.monthlyAverage || 0).toFixed(0)}</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className={`font-black ${(line.adjustmentScore || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {(line.financialScore || 0).toFixed(0)}%
                                        </div>
                                        <div className="text-[8px] text-app-muted-foreground">{(line.adjustmentScore || 0) >= 0 ? '+' : ''}{(line.adjustmentScore || 0).toFixed(0)}%</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="text-[9px] font-bold text-app-foreground truncate max-w-[80px]">{line.bestSupplier || '—'}</div>
                                        {line.bestPrice > 0 && <div className="text-[8px] text-emerald-500 font-bold">{line.bestPrice?.toLocaleString()}</div>}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <SafetyBadge tag={line.safetyTag || 'SAFE'} />
                                    </td>
                                    <td className="py-2 px-2">
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="p-1.5 text-app-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ═══ Mobile Cards ═══ */}
                <div className="lg:hidden p-3 space-y-2">
                    {lines.length === 0 ? (
                        <div className="py-12 text-center text-app-muted-foreground text-sm">
                            <Package size={32} className="mx-auto mb-2 opacity-30" />No items added yet
                        </div>
                    ) : lines.map((line, idx) => (
                        <div key={line.productId} className="p-3 rounded-xl bg-app-card" style={{ border: '1px solid var(--app-border)' }}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-app-foreground text-sm">{line.productName}</div>
                                    <div className="text-[10px] text-app-muted-foreground font-mono">{line.sku}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <SafetyBadge tag={line.safetyTag || 'SAFE'} />
                                    <button type="button" onClick={() => removeLine(idx)}
                                        className="p-2 text-app-muted-foreground hover:text-rose-500 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <Label className="text-[9px] font-bold">Qty {line.proposedQty > 0 ? `(Proposed: ${line.proposedQty})` : ''}</Label>
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
                            <div className="grid grid-cols-4 gap-2 text-[9px]">
                                <div className="text-center"><span className="text-app-muted-foreground block">Stock</span><span className="font-black">{line.stockLevel ?? 0}</span></div>
                                <div className="text-center"><span className="text-app-muted-foreground block">Daily</span><span className="font-black">{(line.dailySales || 0).toFixed(1)}</span></div>
                                <div className="text-center"><span className="text-app-muted-foreground block">Monthly</span><span className="font-black">{(line.monthlyAverage || 0).toFixed(0)}</span></div>
                                <div className="text-center"><span className="text-app-muted-foreground block">Score</span><span className={`font-black ${(line.adjustmentScore || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(line.financialScore || 0).toFixed(0)}%</span></div>
                            </div>
                            <div className="text-right font-black text-app-foreground mt-2 text-sm">{(line.quantity * line.unitPrice).toLocaleString()}</div>
                            <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                        </div>
                    ))}
                </div>
            </Card>

            {/* ═══ Bottom: Notes + Summary ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                    <Card className="border shadow-sm">
                        <CardContent className="p-4">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block">Notes & Conditions (Shared with Supplier)</Label>
                            <textarea name="notes" rows={3}
                                className="w-full rounded-xl p-3 text-sm text-app-foreground bg-app-card resize-none min-h-[72px]"
                                style={{ border: '1px solid var(--app-border)' }}
                                placeholder="Delivery terms, payment conditions..."
                                value={notes} onChange={e => setNotes(e.target.value)} />
                        </CardContent>
                    </Card>
                    <Card className="border shadow-sm">
                        <CardContent className="p-4">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-1.5 block">Internal Notes (Not shared)</Label>
                            <textarea name="internalNotes" rows={2}
                                className="w-full rounded-xl p-3 text-sm text-app-foreground bg-app-card resize-none min-h-[48px]"
                                style={{ border: '1px solid var(--app-border)' }}
                                placeholder="Internal procurement remarks..."
                                value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
                        </CardContent>
                    </Card>
                </div>

                <Card className="border shadow-sm">
                    <CardContent className="p-5 space-y-3">
                        <h3 className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">Order Summary</h3>
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-app-muted-foreground">Items</span><span className="font-bold text-app-foreground">{lines.length}</span></div>
                            <div className="flex justify-between"><span className="text-app-muted-foreground">Subtotal</span><span className="font-bold text-app-foreground">{totalAmount.toLocaleString()}</span></div>
                            {shippingCost > 0 && <div className="flex justify-between"><span className="text-app-muted-foreground">Shipping</span><span className="font-bold text-app-foreground">+{shippingCost.toLocaleString()}</span></div>}
                            {discountAmount > 0 && <div className="flex justify-between"><span className="text-app-muted-foreground">Discount</span><span className="font-bold text-emerald-500">-{discountAmount.toLocaleString()}</span></div>}
                        </div>
                        <div className="pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
                            <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-wider mb-1">Estimated Total</p>
                            <p className="text-2xl md:text-3xl font-black text-app-primary tracking-tight">{grandTotal.toLocaleString()}</p>
                        </div>

                        <Button type="submit" disabled={isPending || lines.length === 0}
                            className="w-full min-h-[52px] bg-app-primary hover:bg-app-primary/90 text-white font-bold text-sm">
                            {isPending ? 'Creating...' : (
                                <><Send size={16} className="mr-2" /> Create Purchase Order</>
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
                className="w-full bg-transparent p-2 text-sm font-bold text-app-foreground placeholder:text-app-muted-foreground outline-none min-h-[40px]"
                placeholder="Search products to add..."
                value={query} onChange={e => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)} />
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
                    style={{ border: '1px solid var(--app-border)' }}>
                    {results.map((r: any) => (
                        <button key={r.id} type="button"
                            onClick={() => { callback(r); setQuery(''); setOpen(false); }}
                            className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between transition-all min-h-[52px]"
                            style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div>
                                <div className="font-bold text-sm text-app-foreground">{r.name}</div>
                                <div className="text-[10px] text-app-muted-foreground">SKU: {r.sku} • Stock: {r.stockLevel}</div>
                            </div>
                            <div className="text-xs font-black text-app-primary shrink-0 ml-2">{r.costPriceHT?.toLocaleString()} HT</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
