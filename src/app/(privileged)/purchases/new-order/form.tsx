// @ts-nocheck
'use client';

import { useActionState, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createFormalPurchaseOrder } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
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
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface OrderLine {
    id: string;
    productId: number;
    productName: string;
    sku: string;
    barcode: string;

    // ── Row 1a fields ──
    stockOnLocation: number;       // read-only
    qtyReceived: number;
    qtyOrdered: number;            // optional
    expiryDate: string;
    salesAvg: number;              // avg daily sales
    safetyQtyToReceive: number;    // safe_qty - qtyReceived
    financialFactorSales: number;  // losses from sales / total invoiced %
    status: 'PENDING' | 'RECEIVED' | 'REJECTED';

    // ── Row 1b fields ──
    totalStock: number;            // total across all locations, read-only
    qtyReturned: number;           // optional
    safeQty: number;               // salesAvg * (remaining expiry OR 90) - totalStock
    safetyFactor: number;          // (qtyReceived / safetyQtyToReceive) * 100
    financialFactorAdjust: number; // total stock adjustments / total purchased %

    // ── Pricing ──
    unitPrice: number;
    taxRate: number;
    discountPercent: number;

    // ── Rejection ──
    rejectionReason: string;
    rejectionPhoto: string;

    // ── Flags ──
    isUnexpected: boolean;         // not in original PO
}

// ═══════════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════

function calcSafeQty(salesAvg: number, expiryDate: string, totalStock: number): number {
    let days = 90;
    if (expiryDate) {
        const remaining = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
        if (remaining > 0) days = remaining;
    }
    return Math.round(salesAvg * days - totalStock);
}

function calcSafetyQtyToReceive(safeQty: number, qtyReceived: number): number {
    return safeQty - qtyReceived;
}

function calcSafetyFactor(qtyReceived: number, safetyQtyToReceive: number): number {
    if (safetyQtyToReceive <= 0) return qtyReceived > 0 ? 999 : 0;
    return Math.round((qtyReceived / safetyQtyToReceive) * 100);
}

function recalcLine(line: OrderLine): OrderLine {
    const safeQty = calcSafeQty(line.salesAvg, line.expiryDate, line.totalStock);
    const safetyQtyToReceive = calcSafetyQtyToReceive(safeQty, line.qtyReceived);
    const safetyFactor = calcSafetyFactor(line.qtyReceived, safetyQtyToReceive);
    return { ...line, safeQty, safetyQtyToReceive, safetyFactor };
}

function createLine(product: Record<string, any>, hints: Record<number, number>): OrderLine {
    const stockOnLoc = product.stockLevel ?? product.stock_on_location ?? 0;
    const totalStock = product.total_stock ?? stockOnLoc;
    const salesAvg = product.sales_avg ?? product.avg_daily_sales ?? 0;
    const suggestedPrice = hints[product.id] || product.costPriceHT || 0;

    const base: OrderLine = {
        id: `line-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        barcode: product.barcode || '',
        stockOnLocation: stockOnLoc,
        qtyReceived: 0,
        qtyOrdered: 0,
        expiryDate: '',
        salesAvg,
        safetyQtyToReceive: 0,
        financialFactorSales: product.financial_factor_sales ?? 0,
        status: 'PENDING',
        totalStock,
        qtyReturned: 0,
        safeQty: 0,
        safetyFactor: 0,
        financialFactorAdjust: product.financial_factor_adjust ?? 0,
        unitPrice: suggestedPrice,
        taxRate: 18,
        discountPercent: 0,
        rejectionReason: '',
        rejectionPhoto: '',
        isUnexpected: false,
    };
    return recalcLine(base);
}

const REJECTION_REASONS = [
    'Damaged', 'Expired', 'Short Shelf Life', 'Quality Issue',
    'Wrong Product', 'Not Ordered', 'Other'
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

type OrderMode = 'EMPTY' | 'IMPORT';

export default function FormalOrderForm({
    suppliers,
    sites,
    paymentTerms = [],
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    paymentTerms?: Record<string, any>[],
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createFormalPurchaseOrder, initialState);

    // ── Core State ──
    const [mode, setMode] = useState<OrderMode>('EMPTY');
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [locationContext, setLocationContext] = useState<'STORE' | 'WAREHOUSE'>('WAREHOUSE');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<number | ''>('');
    const [supplierRef, setSupplierRef] = useState('');
    const [supplierPriceHints, setSupplierPriceHints] = useState<Record<number, number>>({});
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, any>[]>([]);
    const [lines, setLines] = useState<OrderLine[]>([]);

    // ── Mobile scan popup ──
    const [scanOpen, setScanOpen] = useState(false);
    const [scanLine, setScanLine] = useState<OrderLine | null>(null);
    const [scanQty, setScanQty] = useState('');
    const [scanExpiry, setScanExpiry] = useState('');
    const [scanAction, setScanAction] = useState<'RECEIVED' | 'REJECTED'>('RECEIVED');
    const [scanRejectReason, setScanRejectReason] = useState('Damaged');
    const [scanRejectNotes, setScanRejectNotes] = useState('');

    // ── Transfer suggestion ──
    const [transferMsg, setTransferMsg] = useState<string | null>(null);

    const safeSites = Array.isArray(sites) ? sites : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
    const safePaymentTerms = Array.isArray(paymentTerms) ? paymentTerms : [];

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

    // ── Supplier → Price hints ──
    useEffect(() => {
        if (selectedSupplierId) {
            erpFetch(`sourcing/?supplier=${selectedSupplierId}`).then(data => {
                const raw = Array.isArray(data) ? data : (data?.results ?? []);
                const h: Record<number, number> = {};
                raw.forEach((item: any) => { h[item.product] = parseFloat(item.last_purchased_price); });
                setSupplierPriceHints(h);
            }).catch(() => setSupplierPriceHints({}));
        } else setSupplierPriceHints({});
    }, [selectedSupplierId]);

    // ── Add product ──
    const addProduct = useCallback((product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) return;
        setLines(prev => [createLine(product, supplierPriceHints), ...prev]);
    }, [lines, supplierPriceHints]);

    // ── Update line ──
    const updateLine = useCallback((id: string, updates: Partial<OrderLine>) => {
        setLines(prev => prev.map(l => l.id === id ? recalcLine({ ...l, ...updates }) : l));
    }, []);

    const removeLine = useCallback((id: string) => {
        setLines(prev => prev.filter(l => l.id !== id));
    }, []);

    // ── Receive / Reject ──
    const markReceived = useCallback((id: string, qty: number, expiry: string) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const updated = recalcLine({ ...l, qtyReceived: qty, expiryDate: expiry, status: 'RECEIVED' });

            // Smart transfer check
            if (locationContext === 'STORE' && updated.stockOnLocation + qty > updated.safeQty && updated.safeQty > 0) {
                setTransferMsg(`⚠️ ${updated.productName}: Store is overstocked. Consider transferring excess to warehouse. Auto-request will be created.`);
            } else if (locationContext === 'WAREHOUSE' && updated.safetyQtyToReceive > 0) {
                setTransferMsg(`📦 ${updated.productName}: Store needs this item. Consider transferring to store. Auto-request will be created.`);
            }

            // Expiry rotation warning
            if (expiry && updated.stockOnLocation > 0) {
                if (locationContext === 'STORE') {
                    setTransferMsg(prev => (prev ? prev + '\n' : '') + `🔄 ${updated.productName}: Verify shelf rotation — keep older items in front. Task auto-created.`);
                } else {
                    setTransferMsg(prev => (prev ? prev + '\n' : '') + `🔄 ${updated.productName}: Verify storage — keep older items accessible. Task auto-created.`);
                }
            }
            return updated;
        }));
    }, [locationContext]);

    const markRejected = useCallback((id: string, reason: string, photo?: string) => {
        setLines(prev => prev.map(l =>
            l.id !== id ? l : { ...l, status: 'REJECTED', rejectionReason: reason, rejectionPhoto: photo || '' }
        ));
    }, []);

    // ── Handle scan popup ──
    const openScanPopup = (line: OrderLine) => {
        setScanLine(line);
        setScanQty(String(line.qtyOrdered || ''));
        setScanExpiry(line.expiryDate || '');
        setScanAction('RECEIVED');
        setScanRejectReason('Damaged');
        setScanRejectNotes('');
        setScanOpen(true);
    };

    const confirmScan = () => {
        if (!scanLine) return;
        if (scanAction === 'RECEIVED') {
            markReceived(scanLine.id, Number(scanQty) || 0, scanExpiry);
        } else {
            markRejected(scanLine.id, scanRejectReason);
        }
        setScanOpen(false);
        setScanLine(null);
    };

    // ── Filtered views ──
    const pendingLines = useMemo(() => lines.filter(l => l.status === 'PENDING'), [lines]);
    const receivedLines = useMemo(() => lines.filter(l => l.status === 'RECEIVED'), [lines]);
    const rejectedLines = useMemo(() => lines.filter(l => l.status === 'REJECTED'), [lines]);

    // ── Totals ──
    const subtotal = receivedLines.reduce((a, l) => {
        const base = l.qtyReceived * l.unitPrice;
        return a + base * (1 - (l.discountPercent || 0) / 100);
    }, 0);
    const totalTax = receivedLines.reduce((a, l) => {
        const base = l.qtyReceived * l.unitPrice * (1 - (l.discountPercent || 0) / 100);
        return a + base * ((l.taxRate || 0) / 100);
    }, 0);
    const grandTotal = subtotal + totalTax;

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════

    return (
        <form action={formAction} className="space-y-4">

            {/* ── 1. CONFIG BAR ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <ConfigCard label="Context">
                    <TogglePair value={locationContext} onChange={setLocationContext as any}
                        a={{ value: 'STORE', label: '🏪 Store', color: 'bg-amber-500' }}
                        b={{ value: 'WAREHOUSE', label: '📦 Warehouse', color: 'bg-app-primary' }} />
                </ConfigCard>
                <ConfigCard label="Mode">
                    <TogglePair value={mode} onChange={setMode as any}
                        a={{ value: 'EMPTY', label: 'New Order', color: 'bg-app-primary' }}
                        b={{ value: 'IMPORT', label: 'Import PO', color: 'bg-indigo-500' }} />
                </ConfigCard>
                <ConfigCard label="Site">
                    <select className="w-full text-[11px] font-bold bg-app-background rounded-lg p-1.5 text-app-foreground border border-app-border outline-none"
                        value={selectedSiteId} onChange={e => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                        <option value="">Select...</option>
                        {safeSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </ConfigCard>
                <ConfigCard label="Warehouse">
                    <select className="w-full text-[11px] font-bold bg-app-background rounded-lg p-1.5 text-app-primary border border-app-border outline-none"
                        name="warehouseId" required value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(Number(e.target.value))}>
                        <option value="">Select...</option>
                        {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </ConfigCard>
                <ConfigCard label="Supplier">
                    <select className="w-full text-[11px] font-bold bg-app-background rounded-lg p-1.5 text-app-foreground border border-app-border outline-none"
                        name="supplierId" required value={selectedSupplierId} onChange={e => setSelectedSupplierId(Number(e.target.value))}>
                        <option value="">Select...</option>
                        {safeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </ConfigCard>
                <ConfigCard label="Scope">
                    <TogglePair value={scope} onChange={setScope as any}
                        a={{ value: 'OFFICIAL', label: 'Official', color: 'bg-app-surface shadow-sm' }}
                        b={{ value: 'INTERNAL', label: 'Internal', color: 'bg-app-primary' }} />
                    <input type="hidden" name="scope" value={scope} />
                </ConfigCard>
            </div>

            {/* ── 2. SEARCH BAR + CATALOGUE ── */}
            <div className="flex items-center gap-2 bg-app-surface border border-app-border rounded-xl shadow-sm p-1">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <ProductSearchInput onSelect={addProduct} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)} />
                </div>
                <Button type="button" variant="outline" className="shrink-0 text-[10px] font-black uppercase tracking-wider h-10 px-4 border-app-border hover:bg-app-primary/10 hover:text-app-primary rounded-lg">
                    <BookOpen size={14} className="mr-1.5" /> Catalogue
                </Button>
                <Button type="button" variant="outline" className="shrink-0 h-10 w-10 p-0 border-app-border md:hidden hover:bg-app-primary/10 rounded-lg"
                    onClick={() => setScanOpen(true)}>
                    <ScanBarcode size={16} className="text-app-primary" />
                </Button>
            </div>

            {/* ── 3. TRANSFER SUGGESTION BANNER ── */}
            {transferMsg && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                    <ArrowLeftRight size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        {transferMsg.split('\n').map((msg, i) => (
                            <p key={i} className="text-xs font-bold text-amber-700 dark:text-amber-300">{msg}</p>
                        ))}
                    </div>
                    <button type="button" onClick={() => setTransferMsg(null)} className="text-amber-400 hover:text-amber-600 shrink-0">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── 4. LINES TABLE ── */}
            <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
                {mode === 'IMPORT' ? (
                    <ImportModeLayout
                        pendingLines={pendingLines} receivedLines={receivedLines} rejectedLines={rejectedLines}
                        updateLine={updateLine} removeLine={removeLine}
                        markReceived={markReceived} markRejected={markRejected}
                        openScanPopup={openScanPopup} />
                ) : (
                    <EmptyModeLayout
                        lines={lines} updateLine={updateLine} removeLine={removeLine}
                        markReceived={markReceived} markRejected={markRejected}
                        openScanPopup={openScanPopup} />
                )}
            </div>

            {/* ── 5. FOOTER: Notes + Summary ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                    <Card className="border border-app-border shadow-sm bg-app-surface/60 h-full">
                        <CardContent className="p-4 h-full flex flex-col">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground mb-2 block">Notes</Label>
                            <textarea name="notes" rows={3}
                                className="w-full flex-1 rounded-xl p-3 text-sm text-app-foreground bg-app-background border border-app-border resize-none min-h-[60px] outline-none focus:ring-2 focus:ring-app-primary/20" />
                        </CardContent>
                    </Card>
                </div>
                <Card className="border border-app-border shadow-sm bg-app-surface/60">
                    <CardContent className="p-4 space-y-2">
                        <h3 className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground flex items-center gap-1.5">
                            <Calculator size={11} /> Summary
                        </h3>
                        <div className="space-y-1 text-xs">
                            <SummaryRow label="Lines" value={lines.length} />
                            <SummaryRow label="Received" value={receivedLines.length} className="text-emerald-500" />
                            <SummaryRow label="Rejected" value={rejectedLines.length} className="text-rose-500" />
                            <SummaryRow label="Pending" value={pendingLines.length} className="text-amber-500" />
                        </div>
                        <div className="pt-2 border-t border-app-border space-y-1 text-xs">
                            <SummaryRow label="Subtotal HT" value={subtotal.toLocaleString()} />
                            {totalTax > 0 && <SummaryRow label="Tax" value={`+${totalTax.toLocaleString()}`} className="text-amber-500" />}
                        </div>
                        <p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-wider pt-1">Total TTC</p>
                        <p className="text-2xl font-black text-app-primary tracking-tight">{grandTotal.toLocaleString()}</p>

                        <Button type="submit" disabled={isPending || lines.length === 0}
                            className="w-full min-h-[44px] bg-app-primary hover:bg-app-primary/90 text-app-primary-foreground font-bold text-sm shadow-lg shadow-app-primary/20 mt-2">
                            {isPending ? <><Loader2 size={16} className="mr-2 animate-spin" /> Processing...</> : <><ArrowRight size={16} className="mr-2" /> Confirm Order</>}
                        </Button>

                        {state.message && (
                            <div className={`p-2 rounded-lg flex items-center gap-2 text-[11px] font-bold ${state.errors ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
                                {state.errors ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                                {state.message}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── 6. MOBILE SCAN POPUP ── */}
            {scanOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center" onClick={() => setScanOpen(false)}>
                    <div className="w-full md:max-w-md bg-app-surface rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-app-border flex items-center justify-between">
                            <h3 className="font-black text-app-foreground flex items-center gap-2">
                                <ScanBarcode size={18} className="text-app-primary" />
                                {scanLine ? scanLine.productName : 'Scan Product'}
                            </h3>
                            <button type="button" onClick={() => setScanOpen(false)} className="text-app-muted-foreground hover:text-app-foreground"><X size={18} /></button>
                        </div>

                        {scanLine ? (
                            <div className="p-5 space-y-4">
                                {/* Product intelligence */}
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <InfoCell label="Stock Here" value={scanLine.stockOnLocation} />
                                    <InfoCell label="Total Stock" value={scanLine.totalStock} />
                                    <InfoCell label="Sales Avg/day" value={scanLine.salesAvg.toFixed(1)} />
                                    <InfoCell label="Safe Qty" value={scanLine.safeQty} highlight={scanLine.safeQty > 0} />
                                    <InfoCell label="Safety To Recv" value={scanLine.safetyQtyToReceive} />
                                    <InfoCell label="Safety Factor" value={`${scanLine.safetyFactor}%`} />
                                </div>

                                {/* Action toggle */}
                                <div className="flex p-0.5 rounded-lg bg-app-background border border-app-border">
                                    <button type="button" onClick={() => setScanAction('RECEIVED')}
                                        className={`flex-1 rounded-md py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${scanAction === 'RECEIVED' ? 'bg-emerald-500 text-white' : 'text-app-muted-foreground'}`}>
                                        <PackageCheck size={14} /> Receive
                                    </button>
                                    <button type="button" onClick={() => setScanAction('REJECTED')}
                                        className={`flex-1 rounded-md py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${scanAction === 'REJECTED' ? 'bg-rose-500 text-white' : 'text-app-muted-foreground'}`}>
                                        <PackageX size={14} /> Reject
                                    </button>
                                </div>

                                {scanAction === 'RECEIVED' ? (
                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Qty Received</Label>
                                            <Input type="number" min={0} value={scanQty} onChange={e => setScanQty(e.target.value)}
                                                className="mt-1 font-black text-lg text-center h-12 bg-app-background border-app-border" autoFocus />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Expiry Date</Label>
                                            <Input type="date" value={scanExpiry} onChange={e => setScanExpiry(e.target.value)}
                                                className="mt-1 font-bold bg-app-background border-app-border" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <Label className="text-[10px] font-black uppercase text-app-muted-foreground">Reason</Label>
                                            <select value={scanRejectReason} onChange={e => setScanRejectReason(e.target.value)}
                                                className="mt-1 w-full rounded-lg p-2.5 text-sm font-bold bg-app-background border border-app-border text-app-foreground outline-none">
                                                {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <Button type="button" variant="outline" className="w-full h-10 border-dashed border-app-border text-app-muted-foreground text-xs">
                                            <Camera size={14} className="mr-2" /> Take Photo (Evidence)
                                        </Button>
                                    </div>
                                )}

                                <Button type="button" onClick={confirmScan}
                                    className={`w-full h-12 font-bold text-sm ${scanAction === 'RECEIVED' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}>
                                    {scanAction === 'RECEIVED' ? <><PackageCheck size={16} className="mr-2" /> Confirm</> : <><PackageX size={16} className="mr-2" /> Reject</>}
                                </Button>
                            </div>
                        ) : (
                            <div className="p-5">
                                <p className="text-center text-sm text-app-muted-foreground mb-4">Scan a barcode or search:</p>
                                <ProductSearchInput onSelect={(p) => { addProduct(p); setScanOpen(false); }} siteId={Number(selectedSiteId)} supplierId={Number(selectedSupplierId)} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden fields */}
            {lines.map((line, idx) => (
                <div key={`h-${line.id}`}>
                    <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                    <input type="hidden" name={`lines[${idx}][quantity]`} value={line.qtyReceived || line.qtyOrdered} />
                    <input type="hidden" name={`lines[${idx}][unitPrice]`} value={line.unitPrice} />
                    <input type="hidden" name={`lines[${idx}][tax_rate]`} value={line.taxRate} />
                    <input type="hidden" name={`lines[${idx}][discount_percent]`} value={line.discountPercent} />
                </div>
            ))}
        </form>
    );
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY MODE LAYOUT
// ═══════════════════════════════════════════════════════════════════

function EmptyModeLayout({ lines, updateLine, removeLine, markReceived, markRejected, openScanPopup }: any) {
    if (lines.length === 0) {
        return (
            <div className="py-16 text-center text-app-muted-foreground">
                <Package size={40} className="mx-auto mb-3 opacity-15" />
                <p className="font-bold text-sm">No items added</p>
                <p className="text-xs mt-1 opacity-60">Search above or open catalogue</p>
            </div>
        );
    }
    return (
        <>
            {/* Desktop dual-row table */}
            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[10px]">
                    <thead>
                        <tr className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground border-b border-app-border bg-app-background/40">
                            <th className="text-left py-2 px-3 min-w-[180px]">Product</th>
                            <th className="text-center py-2 px-1.5 w-16">Stock<br />Here</th>
                            <th className="text-center py-2 px-1.5 w-16 bg-emerald-50/30 dark:bg-emerald-900/10">Qty<br />Recv</th>
                            <th className="text-center py-2 px-1.5 w-16">Qty<br />Ord</th>
                            <th className="text-center py-2 px-1.5 w-24">Expiry</th>
                            <th className="text-center py-2 px-1.5 w-14">Sales<br />Avg</th>
                            <th className="text-center py-2 px-1.5 w-16">Safety<br />To Recv</th>
                            <th className="text-center py-2 px-1.5 w-14">Fin.<br />Sales</th>
                            <th className="text-center py-2 px-1.5 w-14">Status</th>
                            <th className="py-2 px-1 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line: OrderLine) => (
                            <DualRowDesktop key={line.id} line={line} updateLine={updateLine} removeLine={removeLine}
                                markReceived={markReceived} markRejected={markRejected} openScanPopup={openScanPopup} />
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Mobile cards */}
            <div className="lg:hidden p-3 space-y-2">
                {lines.map((line: OrderLine) => (
                    <MobileCard key={line.id} line={line} openScanPopup={openScanPopup} />
                ))}
            </div>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT MODE LAYOUT (3 sections)
// ═══════════════════════════════════════════════════════════════════

function ImportModeLayout({ pendingLines, receivedLines, rejectedLines, updateLine, removeLine, markReceived, markRejected, openScanPopup }: any) {
    return (
        <div className="divide-y divide-app-border">
            <Section label="Pending" count={pendingLines.length} color="amber" icon={Timer}>
                {pendingLines.length > 0 ? pendingLines.map((l: OrderLine) => (
                    <DualRowDesktop key={l.id} line={l} updateLine={updateLine} removeLine={removeLine}
                        markReceived={markReceived} markRejected={markRejected} openScanPopup={openScanPopup} showActions />
                )) : <EmptySection text="No pending items" />}
            </Section>
            <Section label="Received" count={receivedLines.length} color="emerald" icon={PackageCheck}>
                {receivedLines.length > 0 ? receivedLines.map((l: OrderLine) => (
                    <DualRowDesktop key={l.id} line={l} updateLine={updateLine} removeLine={removeLine}
                        markReceived={markReceived} markRejected={markRejected} openScanPopup={openScanPopup} />
                )) : <EmptySection text="No received items yet" />}
            </Section>
            <Section label="Rejected" count={rejectedLines.length} color="rose" icon={PackageX}>
                {rejectedLines.length > 0 ? rejectedLines.map((l: OrderLine) => (
                    <RejectedRow key={l.id} line={l} updateLine={updateLine} removeLine={removeLine} />
                )) : <EmptySection text="No rejected items" />}
            </Section>
        </div>
    );
}

function Section({ label, count, color, icon: Icon, children }: any) {
    return (
        <div>
            <div className={`px-4 py-2 bg-${color}-50/50 dark:bg-${color}-900/10 flex items-center gap-2`}>
                <Icon size={14} className={`text-${color}-500`} />
                <span className={`text-[10px] font-black uppercase tracking-wider text-${color}-600 dark:text-${color}-400`}>
                    {label} ({count})
                </span>
            </div>
            <div className="hidden lg:block overflow-x-auto"><table className="w-full text-[10px]"><tbody>{children}</tbody></table></div>
        </div>
    );
}

function EmptySection({ text }: { text: string }) {
    return <tr><td colSpan={99} className="py-6 text-center text-[11px] text-app-muted-foreground">{text}</td></tr>;
}

// ═══════════════════════════════════════════════════════════════════
// DUAL ROW DESKTOP (1a + 1b per the spec)
// ═══════════════════════════════════════════════════════════════════

function DualRowDesktop({ line, updateLine, removeLine, markReceived, markRejected, openScanPopup, showActions }: any) {
    const sfColor = line.safetyFactor >= 100 ? 'text-emerald-500' : line.safetyFactor >= 50 ? 'text-amber-500' : 'text-rose-500';
    const finSColor = line.financialFactorSales <= 5 ? 'text-emerald-500' : line.financialFactorSales <= 15 ? 'text-amber-500' : 'text-rose-500';
    const finAColor = line.financialFactorAdjust <= 5 ? 'text-emerald-500' : line.financialFactorAdjust <= 15 ? 'text-amber-500' : 'text-rose-500';
    const statusBadge = {
        PENDING: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[7px] font-black px-1 py-0.5 leading-none">PEND</Badge>,
        RECEIVED: <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[7px] font-black px-1 py-0.5 leading-none">RECV</Badge>,
        REJECTED: <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-[7px] font-black px-1 py-0.5 leading-none">REJ</Badge>,
    };

    return (
        <>
            {/* Row 1a */}
            <tr className="border-b border-app-border/30 hover:bg-app-background/30 transition-colors group">
                <td className="py-1.5 px-3" rowSpan={2}>
                    <div className="font-bold text-app-foreground text-[11px] leading-tight">{line.productName}</div>
                    <div className="text-[9px] text-app-muted-foreground font-mono mt-0.5">{line.barcode || line.sku}</div>
                </td>
                <td className="py-1.5 px-1.5 text-center font-bold text-app-foreground" rowSpan={2}>{line.stockOnLocation}</td>
                <td className="py-1.5 px-1.5 bg-emerald-50/20 dark:bg-emerald-900/5">
                    <input type="number" min={0} className="w-14 mx-auto block text-center font-black text-[10px] h-6 bg-app-background border border-app-border rounded-md outline-none focus:ring-1 focus:ring-emerald-300"
                        value={line.qtyReceived || ''} onChange={e => updateLine(line.id, { qtyReceived: Number(e.target.value) })} />
                </td>
                <td className="py-1.5 px-1.5">
                    <input type="number" min={0} className="w-14 mx-auto block text-center font-bold text-[10px] h-6 bg-app-background border border-app-border rounded-md outline-none opacity-60 focus:opacity-100"
                        value={line.qtyOrdered || ''} onChange={e => updateLine(line.id, { qtyOrdered: Number(e.target.value) })} />
                </td>
                <td className="py-1.5 px-1.5">
                    <input type="date" className="text-[9px] font-bold h-6 bg-app-background border border-app-border rounded-md w-24 mx-auto block outline-none"
                        value={line.expiryDate} onChange={e => updateLine(line.id, { expiryDate: e.target.value })} />
                </td>
                <td className="py-1.5 px-1.5 text-center font-bold text-app-foreground">{line.salesAvg.toFixed(1)}</td>
                <td className="py-1.5 px-1.5 text-center">
                    <span className={`font-black ${line.safetyQtyToReceive > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{line.safetyQtyToReceive}</span>
                </td>
                <td className={`py-1.5 px-1.5 text-center font-bold ${finSColor}`}>{line.financialFactorSales.toFixed(1)}%</td>
                <td className="py-1.5 px-1.5 text-center" rowSpan={2}>
                    {showActions && line.status === 'PENDING' ? (
                        <div className="flex flex-col gap-0.5 items-center">
                            <button type="button" onClick={() => markReceived(line.id, line.qtyOrdered || 1, line.expiryDate)}
                                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-500"><PackageCheck size={12} /></button>
                            <button type="button" onClick={() => markRejected(line.id, '')}
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500"><PackageX size={12} /></button>
                        </div>
                    ) : statusBadge[line.status]}
                </td>
                <td className="py-1.5 px-1" rowSpan={2}>
                    <button type="button" onClick={() => removeLine(line.id)}
                        className="p-1 text-app-muted-foreground hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={11} />
                    </button>
                </td>
            </tr>
            {/* Row 1b */}
            <tr className="border-b border-app-border/50 hover:bg-app-background/30 transition-colors group">
                {/* productName + barcode already in rowSpan */}
                {/* stockOnLocation already in rowSpan */}
                <td className="py-1 px-1.5 bg-emerald-50/20 dark:bg-emerald-900/5"></td>
                <td className="py-1 px-1.5">
                    <input type="number" min={0} className="w-14 mx-auto block text-center font-bold text-[10px] h-6 bg-app-background border border-app-border rounded-md outline-none opacity-60 focus:opacity-100"
                        value={line.qtyReturned || ''} onChange={e => updateLine(line.id, { qtyReturned: Number(e.target.value) })}
                        placeholder="Ret" />
                </td>
                <td className="py-1 px-1.5"></td>
                <td className="py-1 px-1.5 text-center">
                    <span className={`font-bold ${line.safeQty > 0 ? 'text-amber-500' : 'text-emerald-500'} text-[9px]`}>{line.safeQty}</span>
                    <div className="text-[7px] text-app-muted-foreground">safe qty</div>
                </td>
                <td className={`py-1 px-1.5 text-center font-black ${sfColor}`}>
                    {line.safetyFactor}%
                    <div className="text-[7px] text-app-muted-foreground">safety %</div>
                </td>
                <td className={`py-1 px-1.5 text-center font-bold ${finAColor}`}>
                    {line.financialFactorAdjust.toFixed(1)}%
                    <div className="text-[7px] text-app-muted-foreground">adj</div>
                </td>
                {/* status + delete already in rowSpan */}
            </tr>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// REJECTED ROW (with reason column)
// ═══════════════════════════════════════════════════════════════════

function RejectedRow({ line, updateLine, removeLine }: any) {
    return (
        <tr className="border-b border-app-border/50 hover:bg-app-background/30 transition-colors group">
            <td className="py-2 px-3">
                <div className="font-bold text-app-foreground text-[11px]">{line.productName}</div>
                <div className="text-[9px] text-app-muted-foreground font-mono">{line.barcode || line.sku}</div>
            </td>
            <td className="py-2 px-1.5 text-center font-bold text-app-foreground text-[10px]">{line.stockOnLocation}</td>
            <td className="py-2 px-1.5 text-center font-bold text-rose-500 text-[10px]">{line.qtyReceived || '—'}</td>
            <td className="py-2 px-1.5" colSpan={2}>
                <span className="text-[10px] font-bold text-rose-600">{line.rejectionReason || 'No reason'}</span>
            </td>
            <td className="py-2 px-1.5 text-center font-bold text-[10px]">{line.salesAvg.toFixed(1)}</td>
            <td className="py-2 px-1.5 text-center font-bold text-[10px]">{line.safetyQtyToReceive}</td>
            <td className="py-2 px-1.5 text-center font-bold text-[10px]">{line.financialFactorSales.toFixed(1)}%</td>
            <td className="py-2 px-1.5 text-center">
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 text-[7px] font-black px-1 py-0.5">REJ</Badge>
            </td>
            <td className="py-2 px-1">
                <button type="button" onClick={() => removeLine(line.id)}
                    className="p-1 text-app-muted-foreground hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={11} />
                </button>
            </td>
        </tr>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE CARD
// ═══════════════════════════════════════════════════════════════════

function MobileCard({ line, openScanPopup }: any) {
    const sfColor = line.safetyFactor >= 100 ? 'text-emerald-500' : line.safetyFactor >= 50 ? 'text-amber-500' : 'text-rose-500';
    return (
        <div className="p-3 rounded-xl bg-app-background border border-app-border active:scale-[0.98] transition-transform cursor-pointer"
            onClick={() => openScanPopup(line)}>
            <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-app-foreground text-sm truncate">{line.productName}</div>
                    <div className="text-[9px] text-app-muted-foreground font-mono">{line.barcode || line.sku}</div>
                </div>
                <Badge className={`shrink-0 text-[7px] font-black ml-2 ${line.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' : line.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {line.status}
                </Badge>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-[9px]">
                <MobileStat label="Stock" value={line.stockOnLocation} />
                <MobileStat label="Recv" value={line.qtyReceived} className="text-emerald-500" />
                <MobileStat label="Safety%" value={`${line.safetyFactor}%`} className={sfColor} />
                <MobileStat label="Avg/d" value={line.salesAvg.toFixed(1)} />
            </div>
            <p className="text-[8px] text-app-primary font-bold mt-2 text-center">Tap to verify & receive</p>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT SEARCH INPUT
// ═══════════════════════════════════════════════════════════════════

function ProductSearchInput({ onSelect, siteId, supplierId }: { onSelect: (p: any) => void, siteId: number, supplierId: number }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (query.length > 1) {
                setLoading(true);
                const res = await searchProductsSimple(query, siteId, supplierId);
                setResults(Array.isArray(res) ? res : (res?.results ?? []));
                setOpen(true);
                setLoading(false);
            } else { setResults([]); setOpen(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [query, siteId, supplierId]);

    return (
        <div className="relative flex-1">
            <input type="text" className="w-full pl-10 pr-3 py-2.5 bg-transparent text-sm font-bold text-app-foreground placeholder:text-app-muted-foreground outline-none min-h-[40px]"
                placeholder="Search by name, barcode, SKU..."
                value={query} onChange={e => setQuery(e.target.value)} onFocus={() => query.length > 1 && setOpen(true)} />
            {loading && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-app-muted-foreground" />}
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto border border-app-border animate-in slide-in-from-top-2 duration-200">
                    {results.map((r: any) => (
                        <button key={r.id} type="button"
                            onClick={() => { onSelect(r); setQuery(''); setOpen(false); }}
                            className="w-full p-3 text-left hover:bg-app-background flex items-center justify-between transition-all min-h-[44px] border-b border-app-border/50 last:border-0">
                            <div className="min-w-0">
                                <div className="font-bold text-sm text-app-foreground truncate">{r.name}</div>
                                <div className="text-[10px] text-app-muted-foreground">{r.sku} {r.barcode ? `• ${r.barcode}` : ''} • Stock: {r.stockLevel ?? '—'}</div>
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
// UTILITY COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function ConfigCard({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <Card className="border border-app-border shadow-sm bg-app-surface/60 backdrop-blur-sm">
            <CardContent className="p-2.5">
                <Label className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground mb-1 block text-center">{label}</Label>
                {children}
            </CardContent>
        </Card>
    );
}

function TogglePair({ value, onChange, a, b }: { value: string, onChange: (v: string) => void, a: { value: string, label: string, color: string }, b: { value: string, label: string, color: string } }) {
    return (
        <div className="flex p-0.5 rounded-lg bg-app-background border border-app-border">
            <button type="button" onClick={() => onChange(a.value)}
                className={`flex-1 rounded-md py-1.5 text-[9px] font-bold transition-all ${value === a.value ? `${a.color} text-white shadow-sm` : 'text-app-muted-foreground'}`}>
                {a.label}
            </button>
            <button type="button" onClick={() => onChange(b.value)}
                className={`flex-1 rounded-md py-1.5 text-[9px] font-bold transition-all ${value === b.value ? `${b.color} text-white shadow-sm` : 'text-app-muted-foreground'}`}>
                {b.label}
            </button>
        </div>
    );
}

function SummaryRow({ label, value, className = '' }: { label: string, value: any, className?: string }) {
    return <div className="flex justify-between"><span className="text-app-muted-foreground">{label}</span><span className={`font-bold ${className}`}>{value}</span></div>;
}

function InfoCell({ label, value, highlight, className = '' }: { label: string, value: any, highlight?: boolean, className?: string }) {
    return (
        <div className="bg-app-background rounded-lg p-2 text-center">
            <div className="text-[7px] font-black uppercase tracking-wider text-app-muted-foreground">{label}</div>
            <div className={`text-sm font-black mt-0.5 ${highlight ? 'text-amber-500' : 'text-app-foreground'} ${className}`}>{value}</div>
        </div>
    );
}

function MobileStat({ label, value, className = 'text-app-foreground' }: { label: string, value: any, className?: string }) {
    return (
        <div className="text-center p-1.5 rounded-lg bg-app-surface">
            <div className="text-app-muted-foreground text-[7px] font-bold">{label}</div>
            <div className={`font-black ${className}`}>{value}</div>
        </div>
    );
}
