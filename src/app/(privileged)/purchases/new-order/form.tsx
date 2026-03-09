// @ts-nocheck
'use client';

import { useActionState, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createFormalPurchaseOrder } from "@/app/actions/commercial/purchases";
import { createProcurementRequest } from "@/app/actions/commercial/procurement-requests";
import { searchProductsSimple, getCatalogueProducts, getCatalogueFilters } from "@/app/actions/inventory/product-actions";
import { erpFetch } from "@/lib/erp-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Trash2, Search, AlertTriangle, CheckCircle2, X,
    ArrowRight, Package, Truck, Camera,
    FileText, Clock, Calculator, Loader2,
    ChevronDown, ChevronUp, BarChart3, ShieldCheck, TrendingUp, TrendingDown,
    AlertCircle, ArrowLeftRight, ScanBarcode, BookOpen,
    PackageCheck, PackageX, Timer, Info,
    Warehouse as WarehouseIcon, Store, RefreshCw
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// TYPES — matching the screenshot columns exactly
// ═══════════════════════════════════════════════════════════════════

interface OrderLine {
    id: string;
    productId: number;

    // Col 1 — Product Info
    productName: string;
    barcode: string;
    category: string;

    // Col 2 — QTY REQUIRED
    qtyRequired: number;       // Row 1: qty required
    qtyProposed: number;       // Row 2: qty proposed

    // Col 3 — TOTAL STOCK
    stockOnLocation: number;   // Row 1: stock on location
    stockTransfer: number;     // Row 2: transfer (in transit)
    stockAnnual: number;       // hidden/extra

    // Col 4 — Purchase Count
    purchaseCount: number;     // Row 1: purchase count
    productStatus: string;     // Row 2: Available / Unavailable / Discontinued

    // Col 5 — Daily Sales
    dailySales: number;        // Row 1: daily sales
    monthlyAverage: number;    // Row 2: monthly average

    // Col 6 — Financial Score
    financialScore: number;    // Row 1: financial score
    adjustmentScore: number;   // Row 2: adjustment score

    // Col 7 — Total Purchase
    totalPurchase: number;     // Row 1: total purchase amount
    totalSales: number;        // Row 2: total sales amount

    // Col 8 — Unit Cost
    unitCost: number;          // Row 1: unit cost (buying price)
    sellingPrice: number;      // Row 2: selling price

    // Col 9 — Best Supplier
    bestSupplier: string;      // Row 1: supplier name
    bestPrice: number;         // Row 2: best price from that supplier

    // Col 10 — Expiry / Safety
    isExpiryTracked: boolean;
    shelfLifeDays: number;     // manufacturer shelf life
    avgExpiryDays: number;     // typical remaining shelf life on arrival
    daysToSellAll: number;     // at current sell rate
    safetyTag: 'SAFE' | 'CAUTION' | 'RISKY';

    // Other warehouse stock (for transfer suggestions)
    otherWarehouseStock: { warehouse: string; warehouse_id: number; qty: number }[];

    // Action
    actionQty: number;         // the quantity to order
}

// ═══════════════════════════════════════════════════════════════════
// CREATE LINE FROM PRODUCT DATA
// ═══════════════════════════════════════════════════════════════════

function createLine(product: Record<string, any>): OrderLine {
    const dailySales = product.avg_daily_sales ?? product.daily_sales ?? 0;
    const monthlyAvg = product.monthly_average ?? (dailySales * 30);
    const stockHere = product.stock_on_location ?? product.stockLevel ?? product.stock ?? 0;
    const totalStock = product.total_stock ?? stockHere;

    // Qty Required = max(0, (monthly demand * 1.5 safety) - current stock)
    const targetStock = Math.ceil(monthlyAvg * 1.5);
    const qtyRequired = Math.max(0, targetStock - totalStock);

    return {
        id: `line-${product.id}-${Date.now()}`,
        productId: product.id,

        productName: product.name || '',
        barcode: product.barcode || '',
        category: product.category_name || product.category || '',

        qtyRequired,
        qtyProposed: qtyRequired,

        stockOnLocation: stockHere,
        stockTransfer: product.stock_in_transit ?? 0,
        stockAnnual: product.stock_annual ?? 0,

        purchaseCount: product.purchase_count ?? 0,
        productStatus: product.is_active !== false ? 'Available' : 'Unavailable',

        dailySales: Number(dailySales) || 0,
        monthlyAverage: Number(monthlyAvg) || 0,

        financialScore: product.financial_score ?? product.sales_performance_score ?? 0,
        adjustmentScore: product.adjustment_score ?? product.adjustment_risk_score ?? 0,

        totalPurchase: product.total_purchased ?? 0,
        totalSales: product.total_sold ?? 0,

        unitCost: product.cost_price ?? product.costPriceHT ?? 0,
        sellingPrice: product.selling_price_ht ?? product.selling_price ?? 0,

        bestSupplier: product.best_supplier_name ?? '',
        bestPrice: product.best_supplier_price ?? product.cost_price ?? 0,

        isExpiryTracked: product.is_expiry_tracked ?? false,
        shelfLifeDays: product.manufacturer_shelf_life_days ?? 0,
        avgExpiryDays: product.avg_available_expiry_days ?? 0,
        daysToSellAll: product.days_to_sell_all ?? 0,
        safetyTag: product.safety_tag ?? 'SAFE',

        otherWarehouseStock: product.other_warehouse_stock ?? [],

        actionQty: qtyRequired > 0 ? qtyRequired : 1,
    };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function FormalOrderForm({
    suppliers,
    sites,
    paymentTerms = [],
    drivers = [],
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    paymentTerms?: Record<string, any>[],
    drivers?: Record<string, any>[],
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createFormalPurchaseOrder, initialState);

    // ── Core State ──
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, any>[]>([]);
    const [lines, setLines] = useState<OrderLine[]>([]);
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [stockScope, setStockScope] = useState<'branch' | 'all'>('branch');
    const [notes, setNotes] = useState('');
    const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<number | ''>('');
    const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
    const [catalogueOpen, setCatalogueOpen] = useState(false);

    // ── Dialog State ──
    const [transferDialogLine, setTransferDialogLine] = useState<OrderLine | null>(null);
    const [transferQty, setTransferQty] = useState('');
    const [transferFromWh, setTransferFromWh] = useState<number | ''>('');
    const [purchaseDialogLine, setPurchaseDialogLine] = useState<OrderLine | null>(null);
    const [purchaseQty, setPurchaseQty] = useState('');
    const [purchaseSupplier, setPurchaseSupplier] = useState<number | ''>('');

    const safeSites = Array.isArray(sites) ? sites : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const safePaymentTerms = Array.isArray(paymentTerms) ? paymentTerms : [];
    const safeDrivers = Array.isArray(drivers) ? drivers : [];

    // ── Site → Warehouse cascade ──
    useEffect(() => {
        if (selectedSiteId) {
            const site = safeSites.find(s => s.id === Number(selectedSiteId));
            const whs = Array.isArray(site?.warehouses) ? site.warehouses : [];
            setAvailableWarehouses(whs);
            if (whs.length > 0) setSelectedWarehouseId(whs[0].id);
            else setSelectedWarehouseId('');
        } else {
            setAvailableWarehouses([]);
            setSelectedWarehouseId('');
        }
    }, [selectedSiteId]);

    // ── Add product ──
    const addProduct = useCallback((product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        setLines(prev => [createLine(product), ...prev]);
    }, [lines]);

    // ── Update line ──
    const updateLine = useCallback((id: string, updates: Partial<OrderLine>) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);

    const removeLine = useCallback((id: string) => {
        setLines(prev => prev.filter(l => l.id !== id));
    }, []);

    // ── Transfer Request ──
    const handleTransferRequest = async () => {
        if (!transferDialogLine || !transferFromWh || !transferQty) return;
        try {
            await createProcurementRequest({
                requestType: 'TRANSFER',
                productId: transferDialogLine.productId,
                quantity: Number(transferQty),
                fromWarehouseId: Number(transferFromWh),
                toWarehouseId: Number(selectedWarehouseId),
                reason: `Transfer request from PO form — ${transferDialogLine.productName}`,
            });
            alert('✅ Transfer request sent!');
        } catch { alert('❌ Failed to send transfer request'); }
        setTransferDialogLine(null);
    };

    // ── Purchase Request ──
    const handlePurchaseRequest = async () => {
        if (!purchaseDialogLine || !purchaseSupplier || !purchaseQty) return;
        try {
            await createProcurementRequest({
                requestType: 'PURCHASE',
                productId: purchaseDialogLine.productId,
                quantity: Number(purchaseQty),
                supplierId: Number(purchaseSupplier),
                suggestedUnitPrice: purchaseDialogLine.bestPrice || purchaseDialogLine.unitCost,
                reason: `Purchase request from PO form — ${purchaseDialogLine.productName}`,
            });
            alert('✅ Purchase request sent!');
        } catch { alert('❌ Failed to send purchase request'); }
        setPurchaseDialogLine(null);
    };

    // ── Totals ──
    const totalCost = lines.reduce((a, l) => a + (l.actionQty * l.unitCost), 0);

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <>
            <form action={formAction} className="space-y-3">

                {/* ── HEADER BAR: Site + Warehouse + Supplier + Scope ── */}
                <div className="flex flex-wrap items-end gap-2 bg-app-surface border border-app-border rounded-xl p-3 shadow-sm">
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Site</label>
                        <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 text-app-foreground border border-app-border outline-none focus:ring-1 focus:ring-app-primary/30"
                            value={selectedSiteId} onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                            <option value="">Select...</option>
                            {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Warehouse</label>
                        <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 text-app-foreground border border-app-border outline-none focus:ring-1 focus:ring-app-primary/30"
                            name="warehouseId" required value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                            <option value="">Select...</option>
                            {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Supplier</label>
                        <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 text-app-foreground border border-app-border outline-none focus:ring-1 focus:ring-app-primary/30"
                            name="supplierId" required value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                            <option value="">Select...</option>
                            {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[100px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Scope</label>
                        <div className="flex p-0.5 rounded-lg bg-app-background border border-app-border h-[34px]">
                            <button type="button" onClick={() => setScope('OFFICIAL')}
                                className={`flex-1 rounded-md text-[9px] font-bold transition-all ${scope === 'OFFICIAL' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground'}`}>
                                Official
                            </button>
                            <button type="button" onClick={() => setScope('INTERNAL')}
                                className={`flex-1 rounded-md text-[9px] font-bold transition-all ${scope === 'INTERNAL' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground'}`}>
                                Internal
                            </button>
                        </div>
                        <input type="hidden" name="scope" value={scope} />
                    </div>
                    <div className="min-w-[120px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Stock Scope</label>
                        <div className="flex p-0.5 rounded-lg bg-app-background border border-app-border h-[34px]">
                            <button type="button" onClick={() => setStockScope('branch')}
                                className={`flex-1 rounded-md text-[9px] font-bold transition-all ${stockScope === 'branch' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground'}`}>
                                🏪 Branch
                            </button>
                            <button type="button" onClick={() => setStockScope('all')}
                                className={`flex-1 rounded-md text-[9px] font-bold transition-all ${stockScope === 'all' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground'}`}>
                                🌐 All
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── ROW 2: Payment Terms + Driver + Notes ── */}
                <div className="flex flex-wrap items-end gap-2 bg-app-surface border border-app-border rounded-xl p-3 shadow-sm">
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Payment Terms</label>
                        <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 text-app-foreground border border-app-border outline-none focus:ring-1 focus:ring-app-primary/30"
                            name="paymentTermId" value={selectedPaymentTermId} onChange={e => setSelectedPaymentTermId(Number(e.target.value))}>
                            <option value="">Default</option>
                            {safePaymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name || pt.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Assigned Driver</label>
                        <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 text-app-foreground border border-app-border outline-none focus:ring-1 focus:ring-app-primary/30"
                            name="driverId" value={selectedDriverId} onChange={e => setSelectedDriverId(Number(e.target.value))}>
                            <option value="">None</option>
                            {safeDrivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                        </select>
                    </div>
                    <div className="flex-[2] min-w-[200px]">
                        <label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground block mb-1">Notes</label>
                        <input type="text" name="notes" value={notes} onChange={e => setNotes(e.target.value)}
                            className="w-full text-xs bg-app-background rounded-lg p-2 border border-app-border outline-none text-app-foreground"
                            placeholder="Order notes..." />
                    </div>
                </div>

                {/* ── SEARCH BAR ── */}
                <div className="flex items-center gap-2 bg-app-surface border border-app-border rounded-xl shadow-sm">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <ProductSearchInput onSelect={addProduct} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)}
                            warehouseId={Number(selectedWarehouseId)} stockScope={stockScope} />
                    </div>
                    <Button type="button" variant="outline" onClick={() => setCatalogueOpen(true)}
                        className="shrink-0 text-[9px] font-black uppercase tracking-wider h-9 px-3 border-l border-app-border rounded-none hover:bg-app-primary/10 hover:text-app-primary">
                        <BookOpen size={13} className="mr-1" /> Catalogue
                    </Button>
                    <a href="https://saas.tsf.ci/products/new" target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[9px] font-black uppercase tracking-wider h-9 px-3 flex items-center border-l border-app-border rounded-none rounded-r-xl hover:bg-emerald-500/10 hover:text-emerald-500 text-app-muted-foreground transition-colors">
                        <Plus size={13} className="mr-1" /> New Product
                    </a>
                </div>

                {/* ══════════════════════════════════════════════════════
                MAIN TABLE — matching the screenshot layout exactly
            ══════════════════════════════════════════════════════ */}
                <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
                    {lines.length === 0 ? (
                        <div className="py-20 text-center text-app-muted-foreground">
                            <Package size={36} className="mx-auto mb-3 opacity-15" />
                            <p className="font-bold text-sm">No products added</p>
                            <p className="text-xs mt-1 opacity-60">Search or open catalogue to add products</p>
                        </div>
                    ) : (
                        <>
                            {/* ── DESKTOP TABLE ── */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-[10px] border-collapse">
                                    {/* Header */}
                                    <thead>
                                        <tr className="bg-app-background/60 border-b-2 border-app-border">
                                            <th className="text-left py-2 px-3 min-w-[200px]">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Product Info</span>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">QTY REQUIRED</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">qty proposed</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">TOTAL STOCK</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">stock on location<br />transfer</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Purchase Count</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">product status</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Daily Sales</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">monthly average</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[100px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Financial Score</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">adjustment score</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Total Purchase</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">total sales</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[90px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Unit Cost</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">selling price</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[120px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Best Supplier</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">best price</div>
                                            </th>
                                            <th className="text-center py-2 px-2 w-[100px] border-l border-app-border/50">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground">Expiry</div>
                                                <div className="text-[7px] font-bold text-app-muted-foreground italic">safety tag</div>
                                            </th>
                                            <th className="w-[50px] border-l border-app-border/50"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map((line) => (
                                            <ProductRow key={line.id} line={line} updateLine={updateLine} removeLine={removeLine}
                                                onTransfer={setTransferDialogLine} onPurchaseRequest={setPurchaseDialogLine} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── MOBILE CARDS ── */}
                            <div className="lg:hidden p-2 space-y-2">
                                {lines.map((line) => (
                                    <MobileCard key={line.id} line={line} updateLine={updateLine} removeLine={removeLine}
                                        onTransfer={setTransferDialogLine} onPurchaseRequest={setPurchaseDialogLine} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── FOOTER: Summary + Submit ── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-app-surface border border-app-border rounded-xl p-3 shadow-sm">
                    <div className="flex-1 flex items-center gap-6 text-xs">
                        <div>
                            <span className="text-app-muted-foreground">Lines: </span>
                            <span className="font-black text-app-foreground">{lines.length}</span>
                        </div>
                        <div>
                            <span className="text-app-muted-foreground">Total Qty: </span>
                            <span className="font-black text-app-foreground">{lines.reduce((a, l) => a + l.actionQty, 0)}</span>
                        </div>
                        <div>
                            <span className="text-app-muted-foreground">Total Cost: </span>
                            <span className="font-black text-app-primary text-sm">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <Button type="submit" disabled={isPending || lines.length === 0}
                        className="min-h-[40px] bg-app-primary hover:bg-app-primary/90 text-app-primary-foreground font-bold text-xs shadow-lg shadow-app-primary/20 px-8">
                        {isPending ? <><Loader2 size={14} className="mr-2 animate-spin" /> Processing...</> : <><ArrowRight size={14} className="mr-2" /> Confirm Order</>}
                    </Button>
                </div>

                {state.message && (
                    <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${state.errors ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 border border-rose-200' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20 border border-emerald-200'}`}>
                        {state.errors ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {state.message}
                    </div>
                )}

                {/* Hidden fields */}
                {lines.map((line, idx) => (
                    <div key={`h-${line.id}`}>
                        <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                        <input type="hidden" name={`lines[${idx}][quantity]`} value={line.actionQty} />
                        <input type="hidden" name={`lines[${idx}][unitPrice]`} value={line.unitCost} />
                        <input type="hidden" name={`lines[${idx}][tax_rate]`} value={18} />
                        <input type="hidden" name={`lines[${idx}][discount_percent]`} value={0} />
                    </div>
                ))}
            </form>

            {/* ═══ TRANSFER REQUEST DIALOG ═══ */}
            {
                transferDialogLine && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-md p-6 space-y-4">
                            <h3 className="font-black text-sm text-app-foreground flex items-center gap-2">
                                <ArrowLeftRight size={16} className="text-app-primary" /> Transfer Request
                            </h3>
                            <p className="text-xs text-app-muted-foreground">
                                Request <b>{transferDialogLine.productName}</b> from another warehouse
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-bold text-app-muted-foreground">From Warehouse</label>
                                    <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 border border-app-border"
                                        value={transferFromWh} onChange={e => setTransferFromWh(Number(e.target.value))}>
                                        <option value="">Select source...</option>
                                        {transferDialogLine.otherWarehouseStock.map(w => (
                                            <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse} ({w.qty} in stock)</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-app-muted-foreground">Quantity</label>
                                    <input type="number" min={1} className="w-full text-xs font-bold bg-app-background rounded-lg p-2 border border-app-border"
                                        value={transferQty} onChange={e => setTransferQty(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setTransferDialogLine(null)} className="flex-1 text-xs">Cancel</Button>
                                <Button type="button" onClick={handleTransferRequest} className="flex-1 text-xs bg-app-primary text-white">Send Request</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ═══ PURCHASE REQUEST DIALOG ═══ */}
            {
                purchaseDialogLine && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-md p-6 space-y-4">
                            <h3 className="font-black text-sm text-app-foreground flex items-center gap-2">
                                <Truck size={16} className="text-app-primary" /> Purchase Request
                            </h3>
                            <p className="text-xs text-app-muted-foreground">
                                Request <b>{purchaseDialogLine.productName}</b> from a different supplier
                            </p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-bold text-app-muted-foreground">Supplier</label>
                                    <select className="w-full text-xs font-bold bg-app-background rounded-lg p-2 border border-app-border"
                                        value={purchaseSupplier} onChange={e => setPurchaseSupplier(Number(e.target.value))}>
                                        <option value="">Select supplier...</option>
                                        {safeSuppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-app-muted-foreground">Quantity</label>
                                    <input type="number" min={1} className="w-full text-xs font-bold bg-app-background rounded-lg p-2 border border-app-border"
                                        value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setPurchaseDialogLine(null)} className="flex-1 text-xs">Cancel</Button>
                                <Button type="button" onClick={handlePurchaseRequest} className="flex-1 text-xs bg-app-primary text-white">Send Request</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ═══ CATALOGUE MODAL ═══ */}
            {catalogueOpen && (
                <CatalogueModal
                    onSelect={(p: any) => { addProduct(p); }}
                    onClose={() => setCatalogueOpen(false)}
                    siteId={Number(selectedSiteId)}
                />
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT ROW — dual-row per the screenshot
// ═══════════════════════════════════════════════════════════════════

function ProductRow({ line, updateLine, removeLine, onTransfer, onPurchaseRequest }: {
    line: OrderLine,
    updateLine: (id: string, u: Partial<OrderLine>) => void,
    removeLine: (id: string) => void,
    onTransfer: (line: OrderLine) => void,
    onPurchaseRequest: (line: OrderLine) => void,
}) {
    // Color logic for financial score
    const fsColor = line.financialScore >= 100 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
        line.financialScore >= 50 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
            'text-app-foreground';
    const asColor = line.adjustmentScore >= 500 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' :
        line.adjustmentScore >= 100 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
            'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';

    // Stock color: red if 0, amber if low
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500 font-black' :
        line.stockOnLocation < line.monthlyAverage ? 'text-amber-500 font-black' :
            'text-app-foreground font-bold';

    return (
        <tr className="border-b border-app-border/40 hover:bg-app-background/40 transition-colors group">
            {/* Col 1: Product Info */}
            <td className="py-2 px-3">
                <div className="font-bold text-[11px] text-app-foreground leading-tight truncate max-w-[220px]">
                    {line.productName}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-app-muted-foreground font-mono">{line.barcode}</span>
                    {line.category && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary uppercase tracking-wider">
                            {line.category}
                        </span>
                    )}
                </div>
            </td>

            {/* Col 2: QTY REQUIRED / qty proposed */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="font-black text-[12px] text-app-foreground">{line.qtyRequired}</div>
                <input type="number" min={0}
                    className="w-14 mx-auto block text-center text-[10px] font-bold h-5 mt-0.5 bg-app-background border border-app-border rounded outline-none focus:ring-1 focus:ring-app-primary/30 text-app-muted-foreground"
                    value={line.qtyProposed || ''} onChange={e => updateLine(line.id, { qtyProposed: Number(e.target.value), actionQty: Number(e.target.value) })} />
            </td>

            {/* Col 3: TOTAL STOCK / stock on location / transfer */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className={`text-[12px] ${stockColor}`}>{line.stockOnLocation}</div>
                <div className="text-[9px] text-app-muted-foreground font-bold mt-0.5">
                    {line.stockTransfer > 0 ? `${line.stockTransfer} in transit` : ''}
                </div>
                {line.otherWarehouseStock?.length > 0 && (
                    <button type="button" onClick={() => onTransfer(line)}
                        className="text-[7px] font-bold text-app-primary hover:underline mt-0.5">
                        ⇄ Transfer ({line.otherWarehouseStock.reduce((a, w) => a + w.qty, 0)} avail)
                    </button>
                )}
            </td>

            {/* Col 4: Purchase Count / product status */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="font-bold text-[12px] text-app-foreground">{line.purchaseCount}</div>
                <div className={`text-[8px] font-bold mt-0.5 ${line.productStatus === 'Available' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {line.productStatus}
                </div>
            </td>

            {/* Col 5: Daily Sales / monthly average */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="font-bold text-[12px] text-app-foreground">{line.dailySales.toFixed(1)}</div>
                <div className="text-[9px] text-app-muted-foreground font-bold mt-0.5">{line.monthlyAverage.toFixed(1)}</div>
            </td>

            {/* Col 6: Financial Score / adjustment score */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className={`rounded px-1.5 py-0.5 text-[12px] font-black inline-block ${fsColor}`}>
                    {line.financialScore}
                </div>
                <div className={`rounded px-1.5 py-0.5 text-[10px] font-black inline-block mt-0.5 ${asColor}`}>
                    {line.adjustmentScore}
                </div>
            </td>

            {/* Col 7: Total Purchase / total sales */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="font-bold text-[11px] text-app-foreground">{line.totalPurchase.toLocaleString()}</div>
                <div className="text-[9px] text-app-muted-foreground font-bold mt-0.5">{line.totalSales.toLocaleString()}</div>
            </td>

            {/* Col 8: Unit Cost / selling price */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="font-bold text-[11px] text-app-foreground">{line.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-[9px] text-app-muted-foreground font-bold mt-0.5">{line.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </td>

            {/* Col 9: Best Supplier / best price */}
            <td className="py-2 px-2 border-l border-app-border/30">
                <div className="font-bold text-[10px] text-app-foreground truncate max-w-[110px]">{line.bestSupplier || '—'}</div>
                <div className="text-[9px] text-app-muted-foreground font-bold mt-0.5">
                    {line.bestPrice ? line.bestPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                </div>
            </td>

            {/* Col 10: Expiry / Safety Tag */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                {line.isExpiryTracked ? (
                    <>
                        <SafetyTagBadge tag={line.safetyTag} />
                        <div className="text-[8px] text-app-muted-foreground font-bold mt-1">
                            {line.avgExpiryDays > 0 ? `${line.avgExpiryDays}d shelf` : ''}
                        </div>
                        {line.daysToSellAll > 0 && (
                            <div className="text-[8px] text-app-muted-foreground">
                                {line.daysToSellAll}d to sell
                            </div>
                        )}
                    </>
                ) : (
                    <span className="text-[8px] text-app-muted-foreground">N/A</span>
                )}
            </td>

            {/* Action: qty → order */}
            <td className="py-2 px-2 text-center border-l border-app-border/30">
                <div className="flex items-center gap-1">
                    <input type="number" min={0}
                        className="w-10 text-center text-[10px] font-black h-6 bg-app-background border border-app-border rounded outline-none focus:ring-1 focus:ring-app-primary/30"
                        value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(line.id)}
                        className="p-1 text-app-muted-foreground hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={10} />
                    </button>
                </div>
            </td>
        </tr>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE CARD
// ═══════════════════════════════════════════════════════════════════

function MobileCard({ line, updateLine, removeLine, onTransfer, onPurchaseRequest }: {
    line: OrderLine,
    updateLine: (id: string, u: Partial<OrderLine>) => void,
    removeLine: (id: string) => void,
    onTransfer: (line: OrderLine) => void,
    onPurchaseRequest: (line: OrderLine) => void,
}) {
    const [expanded, setExpanded] = useState(false);
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500' : line.stockOnLocation < line.monthlyAverage ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="rounded-xl bg-app-background border border-app-border overflow-hidden">
            {/* Primary Row */}
            <div className="p-3 flex items-center gap-3">
                <button type="button" onClick={() => setExpanded(!expanded)} className="text-app-muted-foreground shrink-0">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-app-foreground truncate">{line.productName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-app-muted-foreground font-mono">{line.barcode}</span>
                        {line.category && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-app-primary/10 text-app-primary">{line.category}</span>}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                        <input type="number" min={0}
                            className="w-12 text-center text-xs font-black h-7 bg-app-surface border border-app-border rounded outline-none"
                            value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                        <button type="button" onClick={() => removeLine(line.id)} className="p-1 text-app-muted-foreground hover:text-rose-500">
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div className="text-[8px] text-app-muted-foreground mt-0.5">
                        Req: <b className="text-app-foreground">{line.qtyRequired}</b>
                    </div>
                </div>
            </div>

            {/* Stats Strip */}
            <div className="px-3 pb-2 grid grid-cols-5 gap-1.5 text-[8px]">
                <MiniStat label="Stock" value={line.stockOnLocation} className={stockColor} />
                <MiniStat label="Sales/d" value={line.dailySales.toFixed(1)} />
                <MiniStat label="Fin Score" value={line.financialScore} className={line.financialScore >= 100 ? 'text-emerald-500' : 'text-amber-500'} />
                <MiniStat label="Cost" value={line.unitCost.toFixed(0)} />
                {line.isExpiryTracked ? (
                    <div className="text-center p-1 rounded-md bg-app-surface">
                        <SafetyTagBadge tag={line.safetyTag} />
                    </div>
                ) : (
                    <MiniStat label="Expiry" value="N/A" />
                )}
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-app-border/50 grid grid-cols-3 gap-1.5 text-[8px]">
                    <MiniStat label="Transfer" value={line.stockTransfer} />
                    <MiniStat label="Purchase#" value={line.purchaseCount} />
                    <MiniStat label="Monthly" value={line.monthlyAverage.toFixed(1)} />
                    <MiniStat label="Adj Score" value={line.adjustmentScore} className={line.adjustmentScore >= 500 ? 'text-rose-500' : 'text-emerald-500'} />
                    <MiniStat label="Ttl Purchase" value={line.totalPurchase} />
                    <MiniStat label="Ttl Sales" value={line.totalSales} />
                    <MiniStat label="Sell Price" value={line.sellingPrice.toFixed(0)} />
                    <MiniStat label="Best Supplier" value={line.bestSupplier || '—'} />
                    <MiniStat label="Best Price" value={line.bestPrice.toFixed(0)} />
                    {line.isExpiryTracked && line.avgExpiryDays > 0 && (
                        <MiniStat label="Shelf Life" value={`${line.avgExpiryDays}d`} />
                    )}
                    {line.daysToSellAll > 0 && (
                        <MiniStat label="Days to Sell" value={line.daysToSellAll} className={line.safetyTag === 'RISKY' ? 'text-rose-500' : line.safetyTag === 'CAUTION' ? 'text-amber-500' : 'text-emerald-500'} />
                    )}
                    {line.otherWarehouseStock?.length > 0 && (
                        <MiniStat label="Other WH" value={line.otherWarehouseStock.map(w => `${w.warehouse}: ${w.qty}`).join(', ')} />
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT SEARCH INPUT
// ═══════════════════════════════════════════════════════════════════

function ProductSearchInput({ onSelect, siteId, supplierId, warehouseId, stockScope }: { onSelect: (p: any) => void, siteId: number, supplierId: number, warehouseId?: number, stockScope?: string }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (query.length > 1) {
                setLoading(true);
                const res = await searchProductsSimple(query, siteId, supplierId, warehouseId, stockScope);
                setResults(Array.isArray(res) ? res : (res?.results ?? []));
                setOpen(true);
                setLoading(false);
            } else { setResults([]); setOpen(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [query, siteId, supplierId, warehouseId, stockScope]);

    return (
        <div className="relative flex-1">
            <input type="text"
                className="w-full pl-10 pr-3 py-2 bg-transparent text-sm font-bold text-app-foreground placeholder:text-app-muted-foreground outline-none min-h-[36px]"
                placeholder="Search product name, barcode, SKU..."
                value={query} onChange={e => setQuery(e.target.value)} onFocus={() => query.length > 1 && setOpen(true)} />
            {loading && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-app-muted-foreground" />}
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto border border-app-border animate-in slide-in-from-top-2 duration-200">
                    {results.map((r: any) => (
                        <button key={r.id} type="button"
                            onClick={() => { onSelect(r); setQuery(''); setOpen(false); }}
                            className="w-full p-2.5 text-left hover:bg-app-background flex items-center justify-between transition-all min-h-[40px] border-b border-app-border/50 last:border-0">
                            <div className="min-w-0">
                                <div className="font-bold text-xs text-app-foreground truncate">{r.name}</div>
                                <div className="text-[9px] text-app-muted-foreground">{r.barcode || r.sku || ''} • Stock: {r.stockLevel ?? r.stock ?? '—'}</div>
                            </div>
                            <Plus size={14} className="text-app-primary shrink-0 ml-2" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SAFETY TAG BADGE
// ═══════════════════════════════════════════════════════════════════

function SafetyTagBadge({ tag }: { tag: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        SAFE: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600', label: '🟢 SAFE' },
        CAUTION: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600', label: '🟡 CAUTION' },
        RISKY: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600', label: '🔴 RISKY' },
    };
    const c = config[tag] || config.SAFE;
    return <span className={`${c.bg} ${c.text} text-[8px] font-black px-1.5 py-0.5 rounded-full inline-block`}>{c.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════
// MINI STAT (mobile)
// ═══════════════════════════════════════════════════════════════════

function MiniStat({ label, value, className = 'text-app-foreground' }: { label: string, value: any, className?: string }) {
    return (
        <div className="text-center p-1 rounded-md bg-app-surface">
            <div className="text-app-muted-foreground text-[6px] font-bold uppercase tracking-wider">{label}</div>
            <div className={`font-black text-[10px] ${className} truncate`}>{value}</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// CATALOGUE MODAL
// ═══════════════════════════════════════════════════════════════════

function CatalogueModal({ onSelect, onClose, siteId }: { onSelect: (p: any) => void, onClose: () => void, siteId: number }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load filters on mount
    useEffect(() => {
        (async () => {
            try {
                const data = await getCatalogueFilters();
                setCategories(data?.categories || []);
            } catch { /* ignore */ }
        })();
    }, []);

    // Load products
    const loadProducts = useCallback(async (pageNum: number, append = false) => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(pageNum), page_size: '30' };
            if (query) params.query = query;
            if (category) params.category = category;
            if (siteId) params.site_id = siteId.toString();
            const data = await getCatalogueProducts(params);
            const results = data?.results || [];
            setProducts(prev => append ? [...prev, ...results] : results);
            setTotalCount(data?.count || 0);
            setPage(pageNum);
        } catch { /* ignore */ }
        setLoading(false);
    }, [query, category, siteId]);

    // Reload on filter change
    useEffect(() => {
        const t = setTimeout(() => loadProducts(1), 300);
        return () => clearTimeout(t);
    }, [query, category, loadProducts]);

    // Infinite scroll
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || loading) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
            if (products.length < totalCount) {
                loadProducts(page + 1, true);
            }
        }
    }, [loading, products.length, totalCount, page, loadProducts]);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 pt-8">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-app-border">
                    <h3 className="font-black text-sm text-app-foreground flex items-center gap-2">
                        <BookOpen size={16} className="text-app-primary" /> Product Catalogue
                    </h3>
                    <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground text-xl font-bold">×</button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 p-3 border-b border-app-border bg-app-background/50">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-app-surface rounded-lg border border-app-border outline-none text-app-foreground"
                            placeholder="Search products..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
                    </div>
                    <select className="text-xs font-bold bg-app-surface rounded-lg p-2 border border-app-border text-app-foreground"
                        value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Product Grid */}
                <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2">
                    {products.length === 0 && !loading ? (
                        <div className="py-16 text-center text-app-muted-foreground">
                            <Package size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-xs font-bold">No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {products.map((p: any) => (
                                <button key={p.id} type="button"
                                    onClick={() => { onSelect(p); }}
                                    className="p-3 bg-app-background rounded-xl border border-app-border hover:border-app-primary/50 hover:bg-app-primary/5 transition-all text-left group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-app-foreground truncate">{p.name}</div>
                                            <div className="text-[9px] text-app-muted-foreground mt-0.5">
                                                {p.barcode || p.sku || '—'}{p.category_name ? ` • ${p.category_name}` : ''}
                                            </div>
                                        </div>
                                        <Plus size={14} className="text-app-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 text-[8px]">
                                        <span className={`font-black ${p.stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            Stock: {p.stock}
                                        </span>
                                        <span className="text-app-muted-foreground">Sales/d: {p.daily_sales}</span>
                                        <span className="text-app-muted-foreground">Cost: {p.cost_price}</span>
                                        {p.margin_pct > 0 && <span className="text-emerald-500">+{p.margin_pct}%</span>}
                                        {p.is_expiry_tracked && <SafetyTagBadge tag={p.safety_tag} />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {loading && (
                        <div className="py-4 text-center">
                            <Loader2 size={16} className="mx-auto animate-spin text-app-muted-foreground" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-app-border text-center text-[9px] text-app-muted-foreground font-bold">
                    {products.length} of {totalCount} products
                </div>
            </div>
        </div>
    );
}
