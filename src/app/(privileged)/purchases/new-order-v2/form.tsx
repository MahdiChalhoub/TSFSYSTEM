// @ts-nocheck
'use client';

import { useActionState, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createFormalPurchaseOrderV2 } from "@/app/actions/commercial/purchases-v2";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { erpFetch } from "@/lib/erp-api";
import {
    Trash2, Search, AlertTriangle, CheckCircle2,
    Package, Building2, Truck, Calendar, CreditCard,
    User, Star, Hash, Layers, Send, ChevronDown, ChevronRight,
    FileText, Shield, Zap, ShoppingCart, Percent, Receipt,
    ArrowLeft, Plus, DollarSign, ClipboardList, Settings2,
    BarChart3, Warehouse, ScanBarcode, Eye, EyeOff
} from "lucide-react";
import Link from 'next/link';

/* ═══════════════════════════════════════════════════════════
 *  INTELLIGENCE LINE TYPE
 * ═══════════════════════════════════════════════════════════ */
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

/* ─────────────────────────── Styles (same as Product smart-form) ─────────────────────────── */
const card = "bg-app-surface rounded-2xl border border-app-border/70 overflow-hidden shadow-sm";
const cardHead = (accent: string) => `px-5 py-3.5 border-l-[3px] ${accent} flex items-center justify-between bg-gradient-to-r from-app-surface to-app-background/30`;
const cardTitle = "text-[14px] font-bold text-app-foreground tracking-[-0.01em]";
const fieldLabel = "block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest";
const fieldInput = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground placeholder:text-app-muted-foreground";
const fieldSelect = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground appearance-none";

/* ═══════════════════════════════════════════════════════════
 *  SAFETY BADGE
 * ═══════════════════════════════════════════════════════════ */
function SafetyBadge({ tag }: { tag: string }) {
    const config: Record<string, { color: string; label: string }> = {
        SAFE: { color: 'var(--app-success, #22c55e)', label: '● Safe' },
        CAUTION: { color: 'var(--app-warning, #f59e0b)', label: '● Caution' },
        RISKY: { color: 'var(--app-error, #ef4444)', label: '● Risky' },
    };
    const c = config[tag] || config.SAFE;
    return (
        <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{
                color: c.color,
                background: `color-mix(in srgb, ${c.color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${c.color} 20%, transparent)`,
            }}
        >
            {c.label}
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN FORM — mirrors Product smart-form layout
 * ═══════════════════════════════════════════════════════════ */
export type FormalOrderFormV2Handle = {
    addProduct: (product: Record<string, any>) => Promise<void> | void;
    getSelectedSiteId: () => number | '';
    getSelectedSupplierId: () => number | '';
};

const FormalOrderFormV2 = forwardRef<FormalOrderFormV2Handle, {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    paymentTerms: Record<string, any>[],
    drivers: Record<string, any>[]
}>(function FormalOrderFormV2({
    suppliers,
    sites,
    paymentTerms,
    drivers
}, ref) {
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

    // ── Right-pane tab ──
    const [activeTab, setActiveTab] = useState('summary');

    // ── Intelligence ──
    const [stockScope, setStockScope] = useState<'branch' | 'all'>('branch');
    const [supplierPriceHints, setSupplierPriceHints] = useState<Record<number, number>>({});
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, any>[]>([]);
    const [lines, setLines] = useState<IntelLine[]>([]);
    const [expandedLine, setExpandedLine] = useState<number | null>(null);

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

    useImperativeHandle(ref, () => ({
        addProduct: (product: Record<string, any>) => addProductToLines(product),
        getSelectedSiteId: () => selectedSiteId,
        getSelectedSupplierId: () => selectedSupplierId,
    }), [selectedSiteId, selectedSupplierId, lines, supplierPriceHints]);

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

    const selectedSupplier = safeSuppliers.find(s => s.id === Number(selectedSupplierId));

    // Right sidebar tabs (same pattern as Product)
    const sidebarTabs = [
        { id: 'summary', label: 'Summary', icon: Receipt },
        { id: 'logistics', label: 'Logistics', icon: Truck },
        { id: 'notes', label: 'Notes', icon: FileText },
    ];

    return (
        <form action={formAction} className="max-w-[1440px] mx-auto pb-28 fade-in-up">
            {/* Hidden fields */}
            <input type="hidden" name="scope" value={scope} />

            {/* Errors */}
            {state.message && (
                <div className={`mb-5 px-4 py-3 rounded-xl border text-[13px] font-medium ${state.errors && Object.keys(state.errors).length > 0 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}>
                    <p className="font-bold flex items-center gap-2">
                        {state.errors ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {state.message}
                    </p>
                </div>
            )}

            {/* Header — same as Product smart-form */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/purchases/purchase-orders"
                    className="w-10 h-10 rounded-xl bg-app-surface border border-app-border flex items-center justify-center hover:bg-app-background transition-all group">
                    <ArrowLeft className="w-4 h-4 text-app-muted-foreground group-hover:text-app-foreground transition-colors" />
                </Link>
                <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 mb-0.5">
                        {scope === 'OFFICIAL' ? 'Official Scope' : 'Internal Scope'}
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-app-foreground">
                        New <span className="text-app-primary">Purchase Order</span>
                    </h2>
                </div>
                {/* Scope Toggle (top-right) */}
                <div className="ml-auto flex items-center gap-1.5">
                    <div className="flex p-0.5 rounded-xl border border-app-border bg-app-surface">
                        {(['OFFICIAL', 'INTERNAL'] as const).map(s => (
                            <button key={s} type="button" onClick={() => setScope(s)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${scope === s
                                    ? 'bg-app-primary text-white shadow-sm'
                                    : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══════ MAIN 60/40 LAYOUT (same as Product smart-form) ═══════ */}
            <div className="flex flex-col lg:flex-row gap-5 items-start">

                {/* ═══════ ZONE A — Order Core (Left 60%) ═══════ */}
                <div className="w-full lg:w-[60%] space-y-5">

                    {/* ────── CARD: Order Configuration ────── */}
                    <div className={card}>
                        <div className={cardHead('border-l-blue-500')}>
                            <h3 className={cardTitle}>Order Configuration</h3>
                        </div>
                        <div className="p-5">
                            {/* All fields in ONE auto-fit grid — same as Product Master */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                <div>
                                    <label className={fieldLabel}><Building2 size={10} className="inline mr-1" />Site <span className="text-app-error">*</span></label>
                                    <select className={fieldSelect} value={selectedSiteId}
                                        onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                                        <option value="">Select site...</option>
                                        {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={fieldLabel}><Warehouse size={10} className="inline mr-1" />Warehouse <span className="text-app-error">*</span></label>
                                    <select className={fieldSelect} name="warehouseId" required
                                        value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                                        <option value="">Warehouse...</option>
                                        {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={fieldLabel}><Truck size={10} className="inline mr-1" />Supplier <span className="text-app-error">*</span></label>
                                    <select className={fieldSelect} name="supplierId" required
                                        value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                                        <option value="">Select supplier...</option>
                                        {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={fieldLabel}><Star size={10} className="inline mr-1" />Priority</label>
                                    <select className={fieldSelect} name="priority"
                                        value={priority} onChange={e => setPriority(e.target.value)}>
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={fieldLabel}><Layers size={10} className="inline mr-1" />Purchase Type</label>
                                    <select className={fieldSelect} name="purchaseSubType"
                                        value={purchaseSubType} onChange={e => setPurchaseSubType(e.target.value)}>
                                        <option value="STANDARD">Standard</option>
                                        <option value="WHOLESALE">Wholesale</option>
                                        <option value="CONSIGNEE">Consignee</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={fieldLabel}><Calendar size={10} className="inline mr-1" />Expected Delivery</label>
                                    <input type="date" className={fieldInput} name="expectedDate"
                                        value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className={fieldLabel}><Hash size={10} className="inline mr-1" />Supplier Ref</label>
                                    <input type="text" className={fieldInput + ' font-mono'} name="supplierRef"
                                        placeholder="Quote #..." value={supplierRef} onChange={e => setSupplierRef(e.target.value)} />
                                </div>
                                <div>
                                    <label className={fieldLabel}><CreditCard size={10} className="inline mr-1" />Payment Terms</label>
                                    <select className={fieldSelect} name="paymentTermId"
                                        value={paymentTermId} onChange={e => setPaymentTermId(e.target.value)}>
                                        <option value="">None</option>
                                        {safePaymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ────── CARD: Product Lines (Intelligence Grid) ────── */}
                    <div className={card}>
                        <div className={cardHead('border-l-emerald-500')}>
                            <h3 className={cardTitle}>Product Lines</h3>
                            {lines.length > 0 && (
                                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                                    {lines.length} item{lines.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="p-5 space-y-4">

                            {/* Search + Stock scope */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex-1 relative min-w-[200px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                    <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold uppercase text-app-muted-foreground tracking-wider">Stock:</span>
                                    {(['branch', 'all'] as const).map(s => (
                                        <button key={s} type="button" onClick={() => setStockScope(s)}
                                            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all border ${stockScope === s
                                                ? 'bg-app-primary text-white border-app-primary shadow-sm'
                                                : 'text-app-muted-foreground border-app-border hover:border-app-primary/30'}`}>
                                            {s === 'branch' ? 'Branch' : 'All'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Intelligence Table */}
                            <div className="border border-app-border rounded-xl overflow-hidden">
                                {/* Header (desktop) */}
                                <div className="hidden lg:flex items-center gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground bg-app-surface-hover/40 border-b border-app-border">
                                    <div className="w-5 flex-shrink-0" />
                                    <div className="flex-1 min-w-[160px]">Product</div>
                                    <div className="w-20 text-center">Qty</div>
                                    <div className="w-24 text-center">Price HT</div>
                                    <div className="w-20 text-right">Subtotal</div>
                                    <div className="w-16 text-center">Stock</div>
                                    <div className="w-16 text-center">Daily</div>
                                    <div className="w-16 text-center">Score</div>
                                    <div className="w-16 text-center">Expiry</div>
                                    <div className="w-8" />
                                </div>

                                {/* Rows */}
                                {lines.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <Package size={36} className="text-app-muted-foreground mb-3 opacity-30" />
                                        <p className="text-sm font-bold text-app-muted-foreground">No items yet</p>
                                        <p className="text-[11px] text-app-muted-foreground mt-1">Search above to add products to this order</p>
                                    </div>
                                ) : lines.map((line, idx) => {
                                    const isExpanded = expandedLine === idx;
                                    return (
                                        <div key={line.productId}>
                                            {/* Row */}
                                            <div
                                                className="group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all hover:bg-app-primary/5"
                                                style={{ borderBottom: '1px solid var(--app-border, #e5e7eb)', opacity: 0.01 }}
                                                ref={el => { if (el) el.style.opacity = '1'; }}
                                                onClick={() => setExpandedLine(isExpanded ? null : idx)}
                                            >
                                                {/* Expand Toggle */}
                                                <div className="w-5 flex-shrink-0 flex items-center justify-center text-app-muted-foreground">
                                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </div>

                                                {/* Product Info */}
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-app-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <ShoppingCart size={12} className="text-app-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[12px] font-bold text-app-foreground truncate">{line.productName}</div>
                                                        <div className="text-[9px] font-mono text-app-muted-foreground">{line.sku}</div>
                                                    </div>
                                                </div>

                                                {/* Desktop columns */}
                                                <div className="hidden lg:flex items-center gap-2">
                                                    <div className="w-20" onClick={e => e.stopPropagation()}>
                                                        <input type="number"
                                                            className="w-full text-center text-[12px] font-black bg-app-surface border border-app-border rounded-lg px-1 py-1.5 outline-none focus:ring-2 focus:ring-app-primary/20"
                                                            value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                                            name={`lines[${idx}][quantity]`} />
                                                    </div>
                                                    <div className="w-24" onClick={e => e.stopPropagation()}>
                                                        <input type="number" step="0.01"
                                                            className="w-full text-center text-[12px] font-black bg-app-surface border border-app-border rounded-lg px-1 py-1.5 outline-none focus:ring-2 focus:ring-app-primary/20"
                                                            value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                                            name={`lines[${idx}][unitPrice]`} />
                                                    </div>
                                                    <div className="w-20 text-right text-[12px] font-black text-app-foreground tabular-nums font-mono">
                                                        {(line.quantity * line.unitPrice).toLocaleString()}
                                                    </div>
                                                    <div className="w-16 text-center text-[11px] font-bold text-app-foreground tabular-nums">
                                                        {line.stockInLocation ?? line.stockLevel ?? 0}
                                                    </div>
                                                    <div className="w-16 text-center text-[11px] font-bold text-app-muted-foreground tabular-nums">
                                                        {(line.dailySales || 0).toFixed(1)}
                                                    </div>
                                                    <div className="w-16 text-center">
                                                        <span className="text-[11px] font-black tabular-nums"
                                                            style={{ color: (line.adjustmentScore || 0) >= 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>
                                                            {(line.financialScore || 0).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="w-16 text-center">
                                                        <SafetyBadge tag={line.safetyTag || 'SAFE'} />
                                                    </div>
                                                </div>

                                                {/* Mobile summary */}
                                                <div className="lg:hidden flex items-center gap-2">
                                                    <SafetyBadge tag={line.safetyTag || 'SAFE'} />
                                                    <span className="text-[11px] font-black text-app-foreground tabular-nums font-mono">
                                                        {(line.quantity * line.unitPrice).toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* Delete */}
                                                <button type="button" onClick={e => { e.stopPropagation(); removeLine(idx); }}
                                                    className="p-1.5 text-app-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                                <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                                            </div>

                                            {/* Expanded Intelligence Detail (COA expand pattern) */}
                                            {isExpanded && (
                                                <div className="animate-in fade-in slide-in-from-top-1 duration-200 px-5 py-3 bg-app-primary/5 border-b border-app-border"
                                                    style={{ paddingLeft: 'calc(20px + 1.25rem)' }}>
                                                    {/* Mobile: Editable fields */}
                                                    <div className="lg:hidden grid grid-cols-2 gap-3 mb-3">
                                                        <div>
                                                            <label className={fieldLabel}>Qty</label>
                                                            <input type="number" className={fieldInput + ' text-center font-black'}
                                                                value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                                                name={`lines[${idx}][quantity]`} />
                                                        </div>
                                                        <div>
                                                            <label className={fieldLabel}>Price HT</label>
                                                            <input type="number" step="0.01" className={fieldInput + ' text-center font-black'}
                                                                value={line.unitPrice} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                                                                name={`lines[${idx}][unitPrice]`} />
                                                        </div>
                                                    </div>

                                                    {/* Intel stats — auto-fit grid same as Product Master */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                                        {[
                                                            { label: 'Local Stock', value: line.stockInLocation ?? 0 },
                                                            { label: 'Total Stock', value: line.totalStock ?? 0 },
                                                            { label: 'Daily Sales', value: (line.dailySales || 0).toFixed(1) },
                                                            { label: 'Monthly Avg', value: (line.monthlyAverage || 0).toFixed(0) },
                                                            { label: 'Financial Score', value: `${(line.financialScore || 0).toFixed(0)}%` },
                                                            { label: 'Adjustment', value: `${(line.adjustmentScore || 0) >= 0 ? '+' : ''}${(line.adjustmentScore || 0).toFixed(0)}%` },
                                                            { label: 'Best Price', value: line.bestPrice?.toLocaleString() || '—' },
                                                            { label: 'Shelf Life', value: `${line.shelfLifeDays || 0} days` },
                                                        ].map(stat => (
                                                            <div key={stat.label} className="flex items-start gap-3 p-3 rounded-xl border border-app-border bg-app-surface">
                                                                <div>
                                                                    <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{stat.label}</div>
                                                                    <div className="text-[13px] font-black text-app-foreground tabular-nums">{stat.value}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Hints row */}
                                                    <div className="flex items-center gap-3 mt-3 text-[10px] flex-wrap">
                                                        {line.bestSupplier && line.bestSupplier !== '—' && (
                                                            <span className="text-app-muted-foreground">Best Supplier: <span className="font-bold text-app-foreground">{line.bestSupplier}</span></span>
                                                        )}
                                                        {line.proposedQty > 0 && line.proposedQty !== line.quantity && (
                                                            <span className="font-bold text-app-primary">Proposed Qty: {line.proposedQty}</span>
                                                        )}
                                                        {supplierPriceHints[line.productId] && (
                                                            <span className="font-bold text-emerald-500">Price Hint: {supplierPriceHints[line.productId].toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════ ZONE B — Business Config (Right 40%) — sticky ═══════ */}
                <div className="w-full lg:w-[40%]">
                    <div className={card + ' sticky top-4'}>
                        <div className="px-5 py-3.5 border-b border-app-border bg-gradient-to-r from-app-surface to-app-background/30">
                            <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-app-muted-foreground" />
                                <h3 className={cardTitle}>Business Configuration</h3>
                            </div>
                        </div>

                        {/* Tab bar — same as Product smart-form */}
                        <div className="flex border-b border-app-border bg-app-surface">
                            {sidebarTabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-app-primary text-app-primary bg-app-primary/5' : 'border-transparent text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-5">

                            {/* ── Summary Tab ── */}
                            {activeTab === 'summary' && (
                                <div className="space-y-5">
                                    {/* Order Summary */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-app-border/40">
                                            <span className="text-[11px] text-app-muted-foreground font-medium">Items</span>
                                            <span className="text-[13px] font-bold text-app-foreground tabular-nums">{lines.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-app-border/40">
                                            <span className="text-[11px] text-app-muted-foreground font-medium">Subtotal</span>
                                            <span className="text-[13px] font-bold text-app-foreground tabular-nums font-mono">{totalAmount.toLocaleString()}</span>
                                        </div>

                                        {/* Shipping + Discount inline edits */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                                            <div>
                                                <label className={fieldLabel}><Truck size={10} className="inline mr-1" />Shipping</label>
                                                <input type="number" step="0.01" className={fieldInput + ' text-center font-mono font-bold'}
                                                    name="shippingCost" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className={fieldLabel}><Percent size={10} className="inline mr-1" />Discount</label>
                                                <input type="number" step="0.01" className={fieldInput + ' text-center font-mono font-bold'}
                                                    name="discountAmount" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-app-border">
                                            <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-wider mb-1">Estimated Total</p>
                                            <p className="text-2xl md:text-3xl font-black text-app-primary tracking-tight tabular-nums font-mono">{grandTotal.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <button type="submit" disabled={isPending || lines.length === 0}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-app-primary hover:brightness-110 text-white transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                        {isPending ? (
                                            <span className="animate-pulse">Creating...</span>
                                        ) : (
                                            <><Send size={16} /> Create Purchase Order</>
                                        )}
                                    </button>

                                    {/* Safety counts */}
                                    {lines.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                                            {[
                                                { label: 'Safe', count: lines.filter(l => l.safetyTag === 'SAFE').length, color: 'var(--app-success, #22c55e)' },
                                                { label: 'Caution', count: lines.filter(l => l.safetyTag === 'CAUTION').length, color: 'var(--app-warning, #f59e0b)' },
                                                { label: 'Risky', count: lines.filter(l => l.safetyTag === 'RISKY').length, color: 'var(--app-error, #ef4444)' },
                                            ].map(s => (
                                                <div key={s.label} className="text-center p-2 rounded-lg border border-app-border">
                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground">{s.label}</div>
                                                    <div className="text-[14px] font-black tabular-nums" style={{ color: s.color }}>{s.count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Logistics Tab ── */}
                            {activeTab === 'logistics' && (
                                <div className="space-y-5">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                        <div>
                                            <label className={fieldLabel}><User size={10} className="inline mr-1" />Assigned Driver</label>
                                            <select className={fieldSelect} name="driverId"
                                                value={driverId} onChange={e => setDriverId(e.target.value)}>
                                                <option value="">None</option>
                                                {safeDrivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name || d.username}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={fieldLabel}><DollarSign size={10} className="inline mr-1" />Currency</label>
                                            <select className={fieldSelect} name="currency"
                                                value={currency} onChange={e => setCurrency(e.target.value)}>
                                                <option value="XOF">XOF</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="LBP">LBP</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Supplier info */}
                                    {selectedSupplier && (
                                        <div className="p-4 rounded-xl bg-gradient-to-b from-app-surface to-app-background border border-app-border">
                                            <h4 className="text-[10px] font-bold text-app-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <Truck className="w-3.5 h-3.5 text-app-primary" />
                                                Supplier Details
                                            </h4>
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div><span className="text-app-muted-foreground">Name:</span> <span className="font-bold text-app-foreground">{selectedSupplier.name}</span></div>
                                                {selectedSupplier.phone && <div><span className="text-app-muted-foreground">Phone:</span> <span className="font-bold text-app-foreground">{selectedSupplier.phone}</span></div>}
                                                {selectedSupplier.email && <div><span className="text-app-muted-foreground">Email:</span> <span className="font-bold text-app-foreground">{selectedSupplier.email}</span></div>}
                                                {selectedSupplier.tin && <div><span className="text-app-muted-foreground">TIN:</span> <span className="font-bold text-app-foreground">{selectedSupplier.tin}</span></div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Notes Tab ── */}
                            {activeTab === 'notes' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className={fieldLabel}>Notes & Conditions (Shared with Supplier)</label>
                                        <textarea name="notes" rows={4}
                                            className={fieldInput + ' resize-none min-h-[100px]'}
                                            placeholder="Delivery terms, payment conditions..."
                                            value={notes} onChange={e => setNotes(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={fieldLabel}>Internal Notes (Not shared)</label>
                                        <textarea name="internalNotes" rows={3}
                                            className={fieldInput + ' resize-none min-h-[72px]'}
                                            placeholder="Internal procurement remarks..."
                                            value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
});

export default FormalOrderFormV2;

/* ═══════════════════════════════════════════════════════════
 *  PRODUCT SEARCH — V2 styled dropdown
 * ═══════════════════════════════════════════════════════════ */
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
                className="w-full pl-9 pr-4 py-[10px] text-[13px] font-bold bg-app-surface border border-app-border rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all"
                placeholder="Search products to add..."
                value={query} onChange={e => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)} />
            {open && results.length > 0 && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-app-surface rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto animate-in slide-in-from-top-2 duration-200 border border-app-border">
                        {results.map((r: any) => (
                            <button key={r.id} type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false); }}
                                className="w-full p-3 text-left flex items-center justify-between transition-all hover:bg-app-primary/5 border-b border-app-border/40 min-h-[52px]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-app-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Package size={13} className="text-app-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-[12px] text-app-foreground truncate">{r.name}</div>
                                        <div className="text-[10px] text-app-muted-foreground">SKU: {r.sku} · Stock: {r.stockLevel}</div>
                                    </div>
                                </div>
                                <div className="text-[11px] font-black text-app-primary shrink-0 ml-2 tabular-nums font-mono">
                                    {r.costPriceHT?.toLocaleString()} HT
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
