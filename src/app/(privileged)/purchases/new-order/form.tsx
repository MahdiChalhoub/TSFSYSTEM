// @ts-nocheck
'use client';

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { createFormalPurchaseOrder } from "@/app/actions/commercial/purchases";
import { createProcurementRequest } from "@/app/actions/commercial/procurement-requests";
import { searchProductsSimple, getCatalogueProducts, getCatalogueFilters } from "@/app/actions/inventory/product-actions";
import { Button } from "@/components/ui/button";
import {
    Plus, Trash2, Search, AlertTriangle, CheckCircle2,
    ArrowRight, Package, Truck, Loader2,
    ChevronDown, ChevronUp, BookOpen,
    ArrowLeftRight, Settings2, ShoppingCart,
    AlertCircle, ExternalLink
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface OrderLine {
    id: string;
    productId: number;
    productName: string;
    barcode: string;
    category: string;
    qtyRequired: number;
    qtyProposed: number;
    stockOnLocation: number;
    stockTransfer: number;
    stockAnnual: number;
    purchaseCount: number;
    productStatus: string;
    dailySales: number;
    monthlyAverage: number;
    financialScore: number;
    adjustmentScore: number;
    totalPurchase: number;
    totalSales: number;
    unitCost: number;
    sellingPrice: number;
    bestSupplier: string;
    bestPrice: number;
    isExpiryTracked: boolean;
    shelfLifeDays: number;
    avgExpiryDays: number;
    daysToSellAll: number;
    safetyTag: 'SAFE' | 'CAUTION' | 'RISKY';
    otherWarehouseStock: { warehouse: string; warehouse_id: number; qty: number }[];
    actionQty: number;
}

// ═══════════════════════════════════════════════════════════════════
// CREATE LINE FROM PRODUCT DATA
// ═══════════════════════════════════════════════════════════════════

function createLine(product: Record<string, any>): OrderLine {
    const dailySales = product.avg_daily_sales ?? product.daily_sales ?? 0;
    const monthlyAvg = product.monthly_average ?? (dailySales * 30);
    const stockHere = product.stock_on_location ?? product.stockLevel ?? product.stock ?? 0;
    const totalStock = product.total_stock ?? stockHere;
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
// SHARED STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const selectClass = "w-full text-xs font-semibold bg-app-background/60 backdrop-blur-sm rounded-lg px-3 py-2.5 text-app-foreground border border-app-border/60 outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/40 transition-all";
const labelClass = "text-[9px] font-black uppercase tracking-wider text-app-muted-foreground/80 block mb-1.5";
const cardClass = "bg-app-surface/80 backdrop-blur-sm border border-app-border/60 rounded-2xl shadow-sm";

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
    const [configOpen, setConfigOpen] = useState(true);

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

    const addProduct = useCallback((product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        setLines(prev => [createLine(product), ...prev]);
    }, [lines]);

    const updateLine = useCallback((id: string, updates: Partial<OrderLine>) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);

    const removeLine = useCallback((id: string) => {
        setLines(prev => prev.filter(l => l.id !== id));
    }, []);

    // ── Procurement Requests ──
    const handleTransferRequest = async () => {
        if (!transferDialogLine || !transferFromWh || !transferQty) return;
        try {
            await createProcurementRequest({
                requestType: 'TRANSFER',
                productId: transferDialogLine.productId,
                quantity: Number(transferQty),
                fromWarehouseId: Number(transferFromWh),
                toWarehouseId: Number(selectedWarehouseId),
                reason: `Transfer request from PO — ${transferDialogLine.productName}`,
            });
            alert('✅ Transfer request sent!');
        } catch { alert('❌ Failed to send transfer request'); }
        setTransferDialogLine(null);
    };

    const handlePurchaseRequest = async () => {
        if (!purchaseDialogLine || !purchaseSupplier || !purchaseQty) return;
        try {
            await createProcurementRequest({
                requestType: 'PURCHASE',
                productId: purchaseDialogLine.productId,
                quantity: Number(purchaseQty),
                supplierId: Number(purchaseSupplier),
                suggestedUnitPrice: purchaseDialogLine.bestPrice || purchaseDialogLine.unitCost,
                reason: `Purchase request from PO — ${purchaseDialogLine.productName}`,
            });
            alert('✅ Purchase request sent!');
        } catch { alert('❌ Failed to send purchase request'); }
        setPurchaseDialogLine(null);
    };

    // ── Computed ──
    const totalCost = lines.reduce((a, l) => a + (l.actionQty * l.unitCost), 0);
    const totalQty = lines.reduce((a, l) => a + l.actionQty, 0);
    const riskyCount = lines.filter(l => l.safetyTag === 'RISKY').length;
    const supplierName = safeSuppliers.find(s => s.id === Number(selectedSupplierId))?.name || '';

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <>
            <form action={formAction} className="space-y-4">
                {/* ═══ CONFIGURATION PANEL ═══ */}
                <div className={cardClass}>
                    <button type="button" onClick={() => setConfigOpen(!configOpen)}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-app-background/30 transition-colors rounded-t-2xl">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-app-primary/20 to-app-primary/5 flex items-center justify-center">
                                <Settings2 size={14} className="text-app-primary" />
                            </div>
                            <div className="text-left">
                                <div className="text-xs font-black text-app-foreground">Order Configuration</div>
                                <div className="text-[9px] text-app-muted-foreground mt-0.5">
                                    {supplierName ? `${supplierName} • ${scope}` : 'Select site, warehouse & supplier'}
                                </div>
                            </div>
                        </div>
                        {configOpen ? <ChevronUp size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} />}
                    </button>

                    {configOpen && (
                        <div className="px-5 pb-5 space-y-4 border-t border-app-border/40 pt-4">
                            {/* Row 1: Site + Warehouse + Supplier */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className={labelClass}>Site</label>
                                    <select className={selectClass} value={selectedSiteId}
                                        onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                                        <option value="">Select site...</option>
                                        {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Warehouse</label>
                                    <select className={selectClass} name="warehouseId" required
                                        value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                                        <option value="">Select warehouse...</option>
                                        {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Supplier</label>
                                    <select className={selectClass} name="supplierId" required
                                        value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                                        <option value="">Select supplier...</option>
                                        {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Scope + Stock Scope + Payment + Driver */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelClass}>Scope</label>
                                    <div className="flex p-0.5 rounded-lg bg-app-background/60 border border-app-border/60 h-[38px]">
                                        <button type="button" onClick={() => setScope('OFFICIAL')}
                                            className={`flex-1 rounded-md text-[10px] font-bold transition-all ${scope === 'OFFICIAL' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                                            Official
                                        </button>
                                        <button type="button" onClick={() => setScope('INTERNAL')}
                                            className={`flex-1 rounded-md text-[10px] font-bold transition-all ${scope === 'INTERNAL' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                                            Internal
                                        </button>
                                    </div>
                                    <input type="hidden" name="scope" value={scope} />
                                </div>
                                <div>
                                    <label className={labelClass}>Stock View</label>
                                    <div className="flex p-0.5 rounded-lg bg-app-background/60 border border-app-border/60 h-[38px]">
                                        <button type="button" onClick={() => setStockScope('branch')}
                                            className={`flex-1 rounded-md text-[10px] font-bold transition-all ${stockScope === 'branch' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                                            🏪 Branch
                                        </button>
                                        <button type="button" onClick={() => setStockScope('all')}
                                            className={`flex-1 rounded-md text-[10px] font-bold transition-all ${stockScope === 'all' ? 'bg-app-primary text-white shadow-sm' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                                            🌐 All
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Payment Terms</label>
                                    <select className={selectClass} name="paymentTermId"
                                        value={selectedPaymentTermId} onChange={e => setSelectedPaymentTermId(Number(e.target.value))}>
                                        <option value="">Default</option>
                                        {safePaymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name || pt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Driver</label>
                                    <select className={selectClass} name="driverId"
                                        value={selectedDriverId} onChange={e => setSelectedDriverId(Number(e.target.value))}>
                                        <option value="">None</option>
                                        {safeDrivers.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Row 3: Notes */}
                            <div>
                                <label className={labelClass}>Notes</label>
                                <input type="text" name="notes" value={notes} onChange={e => setNotes(e.target.value)}
                                    className={selectClass} placeholder="Internal notes for this order..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ SEARCH + ACTIONS BAR ═══ */}
                <div className={`${cardClass} flex items-center overflow-hidden`}>
                    <div className="flex-1 relative">
                        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground/60" />
                        <ProductSearchInput onSelect={addProduct} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)}
                            warehouseId={Number(selectedWarehouseId)} stockScope={stockScope} />
                    </div>
                    <div className="flex border-l border-app-border/50">
                        <button type="button" onClick={() => setCatalogueOpen(true)}
                            className="h-11 px-4 text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5 transition-all flex items-center gap-1.5 border-r border-app-border/30">
                            <BookOpen size={13} /> Catalogue
                        </button>
                        <a href="https://saas.tsf.ci/products/new" target="_blank" rel="noopener noreferrer"
                            className="h-11 px-4 text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5 transition-all flex items-center gap-1.5">
                            <ExternalLink size={12} /> New Product
                        </a>
                    </div>
                </div>

                {/* ═══ LIVE SUMMARY BAR ═══ */}
                {lines.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <KpiChip icon="📦" label="Lines" value={lines.length} />
                        <KpiChip icon="🔢" label="Total Qty" value={totalQty} />
                        <KpiChip icon="💰" label="Est. Cost" value={totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} primary />
                        {riskyCount > 0 && <KpiChip icon="🔴" label="Risky Items" value={riskyCount} danger />}
                    </div>
                )}

                {/* ═══ INTELLIGENCE GRID ═══ */}
                <div className={`${cardClass} overflow-hidden`}>
                    {lines.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-app-background/60 flex items-center justify-center">
                                <ShoppingCart size={28} className="text-app-muted-foreground/30" />
                            </div>
                            <p className="font-bold text-sm text-app-foreground/60">No products added yet</p>
                            <p className="text-xs text-app-muted-foreground mt-1">Search above or browse the catalogue</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-app-background/80 to-app-background/40 border-b-2 border-app-border/60">
                                            <Th left>Product</Th>
                                            <Th w={85}>Qty Required<Sub>proposed</Sub></Th>
                                            <Th w={85}>Stock<Sub>on location · transit</Sub></Th>
                                            <Th w={80}>Purchases<Sub>status</Sub></Th>
                                            <Th w={80}>Sales/Day<Sub>monthly avg</Sub></Th>
                                            <Th w={90}>Score<Sub>financial · adj</Sub></Th>
                                            <Th w={85}>Purchase $<Sub>sales $</Sub></Th>
                                            <Th w={80}>Cost<Sub>selling</Sub></Th>
                                            <Th w={110}>Best Supplier<Sub>best price</Sub></Th>
                                            <Th w={90}>Expiry<Sub>safety</Sub></Th>
                                            <Th w={55}>Qty</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-app-border/30">
                                        {lines.map(line => (
                                            <ProductRow key={line.id} line={line} updateLine={updateLine} removeLine={removeLine}
                                                onTransfer={setTransferDialogLine} onPurchaseRequest={setPurchaseDialogLine} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="lg:hidden p-3 space-y-3">
                                {lines.map(line => (
                                    <MobileCard key={line.id} line={line} updateLine={updateLine} removeLine={removeLine}
                                        onTransfer={setTransferDialogLine} onPurchaseRequest={setPurchaseDialogLine} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ═══ SUBMIT FOOTER ═══ */}
                <div className={`${cardClass} p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4`}>
                    <div className="flex-1 flex items-center gap-6 text-xs text-app-muted-foreground">
                        <span><b className="text-app-foreground">{lines.length}</b> products</span>
                        <span><b className="text-app-foreground">{totalQty}</b> units</span>
                        <span className="text-app-primary font-black text-sm">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 0 })} CFA</span>
                    </div>
                    <Button type="submit" disabled={isPending || lines.length === 0}
                        className="h-11 bg-gradient-to-r from-app-primary to-app-primary/90 hover:from-app-primary/90 hover:to-app-primary text-white font-bold text-xs shadow-lg shadow-app-primary/20 px-8 rounded-xl transition-all">
                        {isPending
                            ? <><Loader2 size={14} className="mr-2 animate-spin" /> Creating PO...</>
                            : <><ArrowRight size={14} className="mr-2" /> Create Purchase Order</>}
                    </Button>
                </div>

                {state.message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border ${state.errors ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'}`}>
                        {state.errors ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                        {state.message}
                    </div>
                )}

                {/* Hidden form fields */}
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

            {/* ═══ TRANSFER DIALOG ═══ */}
            {transferDialogLine && (
                <DialogModal title="Transfer Request" icon={<ArrowLeftRight size={16} className="text-app-primary" />}
                    onClose={() => setTransferDialogLine(null)}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Request <b className="text-app-foreground">{transferDialogLine.productName}</b> from another warehouse
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelClass}>From Warehouse</label>
                            <select className={selectClass} value={transferFromWh} onChange={e => setTransferFromWh(Number(e.target.value))}>
                                <option value="">Select source...</option>
                                {transferDialogLine.otherWarehouseStock.map(w => (
                                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse} ({w.qty} in stock)</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Quantity</label>
                            <input type="number" min={1} className={selectClass} value={transferQty} onChange={e => setTransferQty(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                        <Button type="button" variant="outline" onClick={() => setTransferDialogLine(null)} className="flex-1 text-xs h-10 rounded-xl">Cancel</Button>
                        <Button type="button" onClick={handleTransferRequest} className="flex-1 text-xs h-10 rounded-xl bg-app-primary text-white">Send Request</Button>
                    </div>
                </DialogModal>
            )}

            {/* ═══ PURCHASE REQUEST DIALOG ═══ */}
            {purchaseDialogLine && (
                <DialogModal title="Purchase Request" icon={<Truck size={16} className="text-app-primary" />}
                    onClose={() => setPurchaseDialogLine(null)}>
                    <p className="text-xs text-app-muted-foreground mb-4">
                        Request <b className="text-app-foreground">{purchaseDialogLine.productName}</b> from another supplier
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className={labelClass}>Supplier</label>
                            <select className={selectClass} value={purchaseSupplier} onChange={e => setPurchaseSupplier(Number(e.target.value))}>
                                <option value="">Select supplier...</option>
                                {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Quantity</label>
                            <input type="number" min={1} className={selectClass} value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5">
                        <Button type="button" variant="outline" onClick={() => setPurchaseDialogLine(null)} className="flex-1 text-xs h-10 rounded-xl">Cancel</Button>
                        <Button type="button" onClick={handlePurchaseRequest} className="flex-1 text-xs h-10 rounded-xl bg-app-primary text-white">Send Request</Button>
                    </div>
                </DialogModal>
            )}

            {/* ═══ CATALOGUE MODAL ═══ */}
            {catalogueOpen && (
                <CatalogueModal onSelect={addProduct} onClose={() => setCatalogueOpen(false)} siteId={Number(selectedSiteId)} />
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// TABLE HEADER HELPER
// ═══════════════════════════════════════════════════════════════════

function Th({ children, w, left }: { children: React.ReactNode, w?: number, left?: boolean }) {
    return (
        <th className={`py-2.5 px-2 ${left ? 'text-left pl-4 min-w-[180px]' : 'text-center'} border-l border-app-border/30 first:border-l-0`}
            style={w ? { width: w } : undefined}>
            <div className="text-[9px] font-black uppercase tracking-wider text-app-foreground/80">{children}</div>
        </th>
    );
}
function Sub({ children }: { children: React.ReactNode }) {
    return <div className="text-[7px] font-semibold text-app-muted-foreground/60 mt-0.5 normal-case">{children}</div>;
}

// ═══════════════════════════════════════════════════════════════════
// KPI CHIP
// ═══════════════════════════════════════════════════════════════════

function KpiChip({ icon, label, value, primary, danger }: { icon: string, label: string, value: any, primary?: boolean, danger?: boolean }) {
    const color = danger ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20' :
        primary ? 'border-app-primary/20 bg-app-primary/5' : 'border-app-border/60 bg-app-surface/80';
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color} backdrop-blur-sm`}>
            <span className="text-sm">{icon}</span>
            <div>
                <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider">{label}</div>
                <div className={`text-xs font-black ${danger ? 'text-rose-500' : primary ? 'text-app-primary' : 'text-app-foreground'}`}>{value}</div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// DIALOG MODAL
// ═══════════════════════════════════════════════════════════════════

function DialogModal({ title, icon, onClose, children }: { title: string, icon: React.ReactNode, onClose: () => void, children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-md p-6">
                <h3 className="font-black text-sm text-app-foreground flex items-center gap-2 mb-4">{icon} {title}</h3>
                {children}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT ROW (Desktop)
// ═══════════════════════════════════════════════════════════════════

function ProductRow({ line, updateLine, removeLine, onTransfer, onPurchaseRequest }: {
    line: OrderLine, updateLine: (id: string, u: Partial<OrderLine>) => void, removeLine: (id: string) => void,
    onTransfer: (l: OrderLine) => void, onPurchaseRequest: (l: OrderLine) => void,
}) {
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500' : line.stockOnLocation < line.monthlyAverage ? 'text-amber-500' : 'text-emerald-600';
    const fsColor = line.financialScore >= 100 ? 'text-emerald-600' : line.financialScore >= 50 ? 'text-amber-500' : 'text-app-foreground';

    return (
        <tr className="hover:bg-app-background/30 transition-colors group">
            {/* Product */}
            <td className="py-2.5 px-4">
                <div className="font-bold text-[11px] text-app-foreground truncate max-w-[200px]">{line.productName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-app-muted-foreground font-mono">{line.barcode}</span>
                    {line.category && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md bg-app-primary/10 text-app-primary">{line.category}</span>}
                </div>
            </td>
            {/* Qty Required / Proposed */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-black text-xs text-app-foreground">{line.qtyRequired}</div>
                <input type="number" min={0} className="w-14 mx-auto block text-center text-[10px] font-bold h-5 mt-0.5 bg-app-background/50 border border-app-border/40 rounded outline-none focus:ring-1 focus:ring-app-primary/30 text-app-muted-foreground"
                    value={line.qtyProposed || ''} onChange={e => updateLine(line.id, { qtyProposed: Number(e.target.value), actionQty: Number(e.target.value) })} />
            </td>
            {/* Stock */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`text-xs font-black ${stockColor}`}>{line.stockOnLocation}</div>
                {line.stockTransfer > 0 && <div className="text-[8px] text-app-muted-foreground">{line.stockTransfer} transit</div>}
                {line.otherWarehouseStock?.length > 0 && (
                    <button type="button" onClick={() => onTransfer(line)}
                        className="text-[7px] font-bold text-app-primary hover:underline mt-0.5 block mx-auto">
                        ⇄ {line.otherWarehouseStock.reduce((a, w) => a + w.qty, 0)} elsewhere
                    </button>
                )}
            </td>
            {/* Purchase Count */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-xs text-app-foreground">{line.purchaseCount}</div>
                <div className={`text-[8px] font-bold ${line.productStatus === 'Available' ? 'text-emerald-500' : 'text-rose-500'}`}>{line.productStatus}</div>
            </td>
            {/* Daily Sales */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-xs text-app-foreground">{line.dailySales.toFixed(1)}</div>
                <div className="text-[8px] text-app-muted-foreground">{line.monthlyAverage.toFixed(0)}/mo</div>
            </td>
            {/* Financial Score */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className={`font-black text-xs ${fsColor}`}>{line.financialScore}</div>
                <div className={`text-[8px] font-bold ${line.adjustmentScore >= 500 ? 'text-rose-500' : 'text-app-muted-foreground'}`}>{line.adjustmentScore}</div>
            </td>
            {/* Total Purchase / Sales */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-[10px] text-app-foreground">{Number(line.totalPurchase).toLocaleString()}</div>
                <div className="text-[8px] text-app-muted-foreground">{Number(line.totalSales).toLocaleString()}</div>
            </td>
            {/* Cost / Selling */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="font-bold text-[10px] text-app-foreground">{Number(line.unitCost).toLocaleString()}</div>
                <div className="text-[8px] text-app-muted-foreground">{Number(line.sellingPrice).toLocaleString()}</div>
            </td>
            {/* Best Supplier */}
            <td className="py-2 px-2 border-l border-app-border/20">
                <div className="font-bold text-[10px] text-app-foreground truncate max-w-[100px]">{line.bestSupplier || '—'}</div>
                <div className="text-[9px] text-app-muted-foreground">{line.bestPrice ? line.bestPrice.toLocaleString() : '—'}</div>
            </td>
            {/* Expiry / Safety */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                {line.isExpiryTracked ? (
                    <>
                        <SafetyBadge tag={line.safetyTag} />
                        {line.avgExpiryDays > 0 && <div className="text-[7px] text-app-muted-foreground mt-0.5">{line.avgExpiryDays}d shelf</div>}
                        {line.daysToSellAll > 0 && <div className="text-[7px] text-app-muted-foreground">{line.daysToSellAll}d to sell</div>}
                    </>
                ) : <span className="text-[8px] text-app-muted-foreground/50">N/A</span>}
            </td>
            {/* Action Qty */}
            <td className="py-2 px-2 text-center border-l border-app-border/20">
                <div className="flex items-center gap-1 justify-center">
                    <input type="number" min={0}
                        className="w-12 text-center text-[10px] font-black h-7 bg-app-background/60 border border-app-border/40 rounded-md outline-none focus:ring-2 focus:ring-app-primary/30"
                        value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(line.id)}
                        className="p-1 text-app-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={11} />
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
    line: OrderLine, updateLine: (id: string, u: Partial<OrderLine>) => void, removeLine: (id: string) => void,
    onTransfer: (l: OrderLine) => void, onPurchaseRequest: (l: OrderLine) => void,
}) {
    const [expanded, setExpanded] = useState(false);
    const stockColor = line.stockOnLocation <= 0 ? 'text-rose-500' : line.stockOnLocation < line.monthlyAverage ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="bg-app-background/40 rounded-xl border border-app-border/40 overflow-hidden">
            <div className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 p-1 text-app-muted-foreground">
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-app-foreground truncate">{line.productName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-app-muted-foreground font-mono">{line.barcode}</span>
                        {line.isExpiryTracked && <SafetyBadge tag={line.safetyTag} />}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <input type="number" min={0}
                        className="w-14 text-center text-xs font-black h-8 bg-app-surface border border-app-border rounded-lg outline-none"
                        value={line.actionQty || ''} onChange={e => updateLine(line.id, { actionQty: Number(e.target.value) })} />
                    <button type="button" onClick={() => removeLine(line.id)} className="p-1.5 text-app-muted-foreground hover:text-rose-500">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Stats Strip */}
            <div className="px-3 pb-2 grid grid-cols-4 gap-1.5 text-[8px]">
                <Stat label="Stock" value={line.stockOnLocation} className={stockColor} />
                <Stat label="Sales/d" value={line.dailySales.toFixed(1)} />
                <Stat label="Score" value={line.financialScore} className={line.financialScore >= 100 ? 'text-emerald-500' : 'text-amber-500'} />
                <Stat label="Cost" value={line.unitCost.toFixed(0)} />
            </div>

            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-app-border/30 grid grid-cols-3 gap-1.5 text-[8px]">
                    <Stat label="Transfer" value={line.stockTransfer} />
                    <Stat label="Purchases" value={line.purchaseCount} />
                    <Stat label="Monthly" value={line.monthlyAverage.toFixed(0)} />
                    <Stat label="Adj Score" value={line.adjustmentScore} />
                    <Stat label="Total Buy" value={line.totalPurchase} />
                    <Stat label="Total Sell" value={line.totalSales} />
                    <Stat label="Sell Price" value={line.sellingPrice.toFixed(0)} />
                    <Stat label="Supplier" value={line.bestSupplier || '—'} />
                    <Stat label="Best $" value={line.bestPrice.toFixed(0)} />
                    {line.isExpiryTracked && line.avgExpiryDays > 0 && <Stat label="Shelf" value={`${line.avgExpiryDays}d`} />}
                    {line.daysToSellAll > 0 && (
                        <Stat label="Sell Days" value={line.daysToSellAll} className={line.safetyTag === 'RISKY' ? 'text-rose-500' : 'text-emerald-500'} />
                    )}
                    {line.otherWarehouseStock?.length > 0 && (
                        <button type="button" onClick={() => onTransfer(line)} className="col-span-3 text-[8px] font-bold text-app-primary text-center py-1 rounded bg-app-primary/5">
                            ⇄ Transfer from other warehouse ({line.otherWarehouseStock.reduce((a, w) => a + w.qty, 0)} avail)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT SEARCH INPUT
// ═══════════════════════════════════════════════════════════════════

function ProductSearchInput({ onSelect, siteId, supplierId, warehouseId, stockScope }: {
    onSelect: (p: any) => void, siteId: number, supplierId: number, warehouseId?: number, stockScope?: string
}) {
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
                className="w-full pl-11 pr-3 py-3 bg-transparent text-sm font-semibold text-app-foreground placeholder:text-app-muted-foreground/50 outline-none"
                placeholder="Search product name, barcode, SKU..."
                value={query} onChange={e => setQuery(e.target.value)} onFocus={() => query.length > 1 && setOpen(true)} />
            {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-app-muted-foreground" />}
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto border border-app-border animate-in slide-in-from-top-2 duration-200">
                    {results.map((r: any) => (
                        <button key={r.id} type="button"
                            onClick={() => { onSelect(r); setQuery(''); setOpen(false); }}
                            className="w-full p-3 text-left hover:bg-app-background/60 flex items-center justify-between transition-all border-b border-app-border/30 last:border-0">
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-app-foreground truncate">{r.name}</div>
                                <div className="text-[9px] text-app-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>{r.barcode || r.sku || ''}</span>
                                    <span>Stock: {r.stockLevel ?? r.stock ?? r.stock_on_location ?? '—'}</span>
                                    {r.safety_tag && r.is_expiry_tracked && <SafetyBadge tag={r.safety_tag} />}
                                </div>
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
// SAFETY BADGE
// ═══════════════════════════════════════════════════════════════════

function SafetyBadge({ tag }: { tag: string }) {
    const c: Record<string, { bg: string; text: string; label: string }> = {
        SAFE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600', label: '✓ SAFE' },
        CAUTION: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', label: '⚠ CAUTION' },
        RISKY: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600', label: '✕ RISKY' },
    };
    const cfg = c[tag] || c.SAFE;
    return <span className={`${cfg.bg} ${cfg.text} text-[7px] font-black px-1.5 py-0.5 rounded-full`}>{cfg.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════
// STAT (mobile)
// ═══════════════════════════════════════════════════════════════════

function Stat({ label, value, className = 'text-app-foreground' }: { label: string, value: any, className?: string }) {
    return (
        <div className="text-center p-1.5 rounded-lg bg-app-surface/50">
            <div className="text-app-muted-foreground/60 text-[6px] font-bold uppercase tracking-wider">{label}</div>
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

    useEffect(() => {
        (async () => {
            try {
                const data = await getCatalogueFilters();
                setCategories(data?.categories || []);
            } catch { /* ignore */ }
        })();
    }, []);

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

    useEffect(() => {
        const t = setTimeout(() => loadProducts(1), 300);
        return () => clearTimeout(t);
    }, [query, category, loadProducts]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || loading) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100 && products.length < totalCount) {
            loadProducts(page + 1, true);
        }
    }, [loading, products.length, totalCount, page, loadProducts]);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-8 animate-in fade-in duration-200">
            <div className="bg-app-surface rounded-2xl border border-app-border shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-app-border">
                    <h3 className="font-black text-sm text-app-foreground flex items-center gap-2">
                        <BookOpen size={16} className="text-app-primary" /> Product Catalogue
                    </h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-app-background flex items-center justify-center text-app-muted-foreground hover:text-app-foreground transition-colors">×</button>
                </div>

                <div className="flex items-center gap-2 p-3 border-b border-app-border bg-app-background/30">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground/50" />
                        <input type="text" className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold bg-app-surface rounded-lg border border-app-border/60 outline-none text-app-foreground focus:ring-2 focus:ring-app-primary/20"
                            placeholder="Search products..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
                    </div>
                    <select className="text-xs font-semibold bg-app-surface rounded-lg px-3 py-2.5 border border-app-border/60 text-app-foreground"
                        value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3">
                    {products.length === 0 && !loading ? (
                        <div className="py-16 text-center">
                            <Package size={32} className="mx-auto mb-2 text-app-muted-foreground/20" />
                            <p className="text-xs font-bold text-app-muted-foreground">No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {products.map((p: any) => (
                                <button key={p.id} type="button" onClick={() => onSelect(p)}
                                    className="p-3 bg-app-background/40 rounded-xl border border-app-border/40 hover:border-app-primary/40 hover:bg-app-primary/5 transition-all text-left group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-app-foreground truncate">{p.name}</div>
                                            <div className="text-[8px] text-app-muted-foreground mt-0.5">{p.barcode || p.sku || '—'}{p.category_name ? ` • ${p.category_name}` : ''}</div>
                                        </div>
                                        <Plus size={14} className="text-app-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 text-[8px]">
                                        <span className={`font-black ${p.stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>Stock: {p.stock}</span>
                                        <span className="text-app-muted-foreground">Sales/d: {p.daily_sales}</span>
                                        <span className="text-app-muted-foreground">Cost: {p.cost_price}</span>
                                        {p.margin_pct > 0 && <span className="text-emerald-500">+{p.margin_pct}%</span>}
                                        {p.is_expiry_tracked && <SafetyBadge tag={p.safety_tag} />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {loading && <div className="py-4 text-center"><Loader2 size={16} className="mx-auto animate-spin text-app-muted-foreground" /></div>}
                </div>

                <div className="p-3 border-t border-app-border text-center text-[9px] text-app-muted-foreground font-bold">
                    {products.length} of {totalCount} products
                </div>
            </div>
        </div>
    );
}
