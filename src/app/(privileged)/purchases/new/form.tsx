'use client';

import { createPurchaseInvoice, getOpenPurchaseOrders, getPurchaseOrder } from "@/app/actions/commercial/purchases";
import { searchProductsSimple, getProducts, getCategories, getBrands } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import { useState, useEffect, useActionState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Info, AlertTriangle, CheckCircle2, FileText, LayoutGrid, FileSearch, Filter, X } from "lucide-react";

type PurchaseLine = {
 productId: number;
 productName: string;
 barcode: string;
 stockLevel: number;
 proposedQty: number;
 quantity: number;
 unitCostHT: number;
 unitCostTTC: number;
 taxRate: number;
 sellingPriceHT: number;
 sellingPriceTTC: number;
 expiryDate: string;
};

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
 const [profitMode, setProfitMode] = useState<'MARGIN' | 'MARKUP'>('MARGIN');
 const [invoicePriceType, setInvoicePriceType] = useState<'HT' | 'TTC'>('HT');
 const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);
 const [refCode, setRefCode] = useState('');
 const [supplierRef, setSupplierRef] = useState('');
 const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
 const [declaredRef, setDeclaredRef] = useState('');
 const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
 const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
 const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, unknown>[]>([]);
 const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);

 // --- Source Document Logic ---
 const [openPOs, setOpenPOs] = useState<any[]>([]);
 const [selectedPOId, setSelectedPOId] = useState<number | ''>('');

 // --- Line Items State ---
 const [lines, setLines] = useState<PurchaseLine[]>([]);
 const [focusedProductId, setFocusedProductId] = useState<number | null>(null);
 const [intelligence, setIntelligence] = useState<Record<string, any> | null>(null);
 const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false);

 // --- Global Footers ---
 const [discountAmount, setDiscountAmount] = useState(0);
 const [extraFees, setExtraFees] = useState<{ name: string, amount: number, accountId?: number }[]>([]);
 const [paidAmount, setPaidAmount] = useState(0);
 const [paymentAccountId, setPaymentAccountId] = useState<number | ''>('');

 // --- Financial Rules ---
 const worksInTTC = financialSettings.worksInTTC; // Global policy
 const declareTVA = financialSettings.declareTVA; // Tax recovery policy
 const pricingCostBasis = financialSettings.pricingCostBasis || 'AUTO';
 // SaaS Switch: [ to hide internal and show just official ] 
 // If ACTIVE (true) -> Hide Internal. If INACTIVE (false) -> Show Both.
 const discretionMode = financialSettings.dualViewEnabled || false;
 const showInternalSwitcher = !discretionMode;

 // --- Effects ---

 // Fetch Open POs for Supplier
 useEffect(() => {
 if (selectedSupplierId) {
 getOpenPurchaseOrders(Number(selectedSupplierId)).then(setOpenPOs);
 } else {
 setOpenPOs([]);
 }
 }, [selectedSupplierId]);

 // Populate from PO
 const handlePOLoad = async (id: number) => {
 if (!id) return;
 const po = await getPurchaseOrder(id);
 if (po) {
 // Auto-align site
 if (po.site_id) setSelectedSiteId(po.site_id);

 // Map PO lines to form lines
 const mappedLines: PurchaseLine[] = po.lines.map((l: any) => ({
 productId: l.product,
 productName: l.product_name,
 barcode: l.product_sku,
 stockLevel: 0, // Placeholder
 proposedQty: l.quantity,
 quantity: l.quantity,
 unitCostHT: l.unit_price,
 unitCostTTC: l.unit_price * (1 + l.tax_rate / 100),
 taxRate: l.tax_rate / 100,
 sellingPriceHT: 0,
 sellingPriceTTC: 0,
 }));
 setLines(mappedLines);
 setDiscountAmount(Number(po.discount_amount || 0));
 setSelectedPOId(id);
 }
 };

 // Fetch intelligence when product focused
 useEffect(() => {
 if (!focusedProductId) {
 setIntelligence(null);
 return;
 }

 const fetchIntelligence = async () => {
 setIsIntelligenceLoading(true);
 try {
 // We use standard fetch here as it's a client-side interaction with a specific detail endpoint
 const res = await fetch(`/api/proxy/inventory/product/${focusedProductId}/intelligence`);
 if (res.ok) {
 const data = await res.json();
 setIntelligence(data);
 }
 } catch (e) {
 console.error("Intelligence Fetch Error:", e);
 } finally {
 setIsIntelligenceLoading(false);
 }
 };

 fetchIntelligence();
 }, [focusedProductId]);

 // Log initial READ
 useEffect(() => {
 logOperation({
 type: 'READ',
 module: 'PURCHASE_ENTRANCE',
 timestamp: new Date(),
 details: 'Fetched 3 entities: Suppliers, sites/warehouses, and global financial settings.',
 status: 'SUCCESS'
 });
 }, [logOperation]);

 // Update warehouses when site changes
 useEffect(() => {
 if (selectedSiteId) {
 const site = sites.find(s => (s.id === Number(selectedSiteId)));
 if (site) setAvailableWarehouses(site.warehouses || []);
 } else {
 setAvailableWarehouses([]);
 }
 }, [selectedSiteId, sites]);

 // Auto-set VAT recoverable and Ref Code based on scope change
 useEffect(() => {
 const isOfficial = scope === 'OFFICIAL';
 setVatRecoverable(isOfficial);

 // Generate auto reference using a count hint if available, else standard padding
 const nextNum = (financialSettings.purchaseCount || 0) + 1;
 const paddedNum = nextNum.toString().padStart(4, '0');

 // "All official will be just with their name" (INV-COUNT)
 // "Just all internal... will add internal to them" (INV-INTERNAL-COUNT)
 const ref = isOfficial ? `INV-${paddedNum}` : `INV-INTERNAL-${paddedNum}`;
 setRefCode(ref);
 }, [scope, financialSettings.purchaseCount]);

 const addProductToLines = (product: Record<string, any>) => {
 // Prevent duplicate products in same invoice? (Option-dependent, usually yes for simplicity)
 if (lines.find(l => l.productId === product.id)) return;

 const taxRate = product.taxRate || 0.11;

 // Auto-calculate missing components for the initial row state
 let unitCostHT = product.unitCostHT || product.costPriceHT || 0;
 let unitCostTTC = product.unitCostTTC || product.costPriceTTC || 0;
 let sellingPriceHT = product.sellingPriceHT || 0;
 let sellingPriceTTC = product.sellingPriceTTC || 0;

 if (unitCostHT > 0 && unitCostTTC === 0) {
 unitCostTTC = Number((unitCostHT * (1 + taxRate)).toFixed(2));
 } else if (unitCostTTC > 0 && unitCostHT === 0) {
 unitCostHT = Number((unitCostTTC / (1 + taxRate)).toFixed(2));
 }

 if (sellingPriceHT > 0 && sellingPriceTTC === 0) {
 sellingPriceTTC = Number((sellingPriceHT * (1 + taxRate)).toFixed(2));
 } else if (sellingPriceTTC > 0 && sellingPriceHT === 0) {
 sellingPriceHT = Number((sellingPriceTTC / (1 + taxRate)).toFixed(2));
 }

 setLines([{
 ...product,
 productId: product.id,
 productName: product.name,
 barcode: product.barcode || product.sku || 'NO_SKU',
 stockLevel: product.stockLevel || 0,
 proposedQty: product.proposedQty || 0,
 quantity: product.proposedQty || 1,
 unitCostHT,
 unitCostTTC,
 sellingPriceHT,
 sellingPriceTTC,
 expiryDate: '',
 taxRate,
 } as PurchaseLine, ...lines]);
 };

 const updateLine = (idx: number, updates: Record<string, any>) => {
 const newLines = [...lines];
 newLines[idx] = { ...newLines[idx], ...updates };

 // Handle HT/TTC Recalculations
 if (updates.unitCostHT !== undefined) {
 newLines[idx].unitCostTTC = Number((updates.unitCostHT * (1 + newLines[idx].taxRate)).toFixed(2));
 } else if (updates.unitCostTTC !== undefined) {
 newLines[idx].unitCostHT = Number((updates.unitCostTTC / (1 + newLines[idx].taxRate)).toFixed(2));
 }

 if (updates.sellingPriceHT !== undefined) {
 newLines[idx].sellingPriceTTC = Number((updates.sellingPriceHT * (1 + newLines[idx].taxRate)).toFixed(2));
 } else if (updates.sellingPriceTTC !== undefined) {
 newLines[idx].sellingPriceHT = Number((updates.sellingPriceTTC / (1 + newLines[idx].taxRate)).toFixed(2));
 }

 setLines(newLines);
 };

 const removeLine = (idx: number) => {
 setLines(lines.filter((_, i) => i !== idx));
 };

 // --- Calculations ---
 const getEffectiveCost = (line: Record<string, any>) => {
 if (pricingCostBasis === 'FORCE_HT') return line.unitCostHT;
 if (pricingCostBasis === 'FORCE_TTC') return line.unitCostTTC;

 // AUTO Mode
 return vatRecoverable ? line.unitCostHT : line.unitCostTTC;
 };

 const getProfitAnalysis = (line: Record<string, any>) => {
 const cost = getEffectiveCost(line);
 // Selling price basis: determined by the company's financial model (worksInTTC setting)
 const price = worksInTTC ? line.sellingPriceTTC : line.sellingPriceHT;

 if (!price || price === 0 || !cost || cost === 0) return { margin: 0, markup: 0 };

 // 1. Margin (Markup on Cost) - Formula provided by user
 const margin = ((price - cost) / cost) * 100;

 // 2. Markup (Margin on Sales/Price) - The alternative
 const markup = ((price - cost) / price) * 100;

 return { margin, markup };
 };

 const getInvoiceTotals = () => {
 let totalHT = 0;
 let totalTTC = 0;

 lines.forEach(l => {
 totalHT += l.quantity * (l.unitCostHT || 0);
 totalTTC += l.quantity * (l.unitCostTTC || 0);
 });

 const feesTotal = extraFees.reduce((acc, f) => acc + (f.amount || 0), 0);
 const tax = totalTTC - totalHT;
 const finalTotal = totalTTC + feesTotal - discountAmount;

 return {
 subtotal: totalHT,
 tax,
 fees: feesTotal,
 total: finalTotal,
 balance: finalTotal - paidAmount
 };
 };

 const totals = getInvoiceTotals();

 return (
 <form action={formAction} className="relative flex flex-col lg:flex-row gap-6">

 {/* A. Main Transaction Area */}
 <div className="flex-1 space-y-6 min-w-0">

 {/* 1. Transactional Configuration Hub */}
 <div className="grid lg:grid-cols-12 gap-5">
 {/* 1.1 Commercial Scope Card - SHOWN IF DISCRETION MODE IS INACTIVE */}
 {showInternalSwitcher && (
 <div className="lg:col-span-4 card p-6 bg-app-foreground/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-app-border/20 border border-app-text/50 flex flex-col justify-between">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.15em]">Transaction Scope</h4>
 <p className="text-xs text-app-muted-foreground font-medium">Select reporting standard</p>
 </div>
 <div className={`px-2 py-1 rounded-full text-[8px] font-black tracking-widest ${scope === 'OFFICIAL' ? 'bg-app-primary-light text-app-success' : 'bg-app-warning-bg text-app-warning'}`}>
 {scope === 'OFFICIAL' ? 'PURCHASE INVOICE' : 'INTERNAL RECORD'}
 </div>
 </div>
 <div className="flex p-1.5 bg-app-surface-2/80 rounded-2xl h-11">
 <button type="button" onClick={() => setScope('OFFICIAL')} className={`flex-1 rounded-xl text-[10px] font-extrabold transition-all duration-300 ${scope === 'OFFICIAL' ? 'bg-app-surface text-app-primary shadow-md ring-1 ring-emerald-50' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>PURCHASE INVOICE</button>
 <button type="button" onClick={() => setScope('INTERNAL')} className={`flex-1 rounded-xl text-[10px] font-extrabold transition-all duration-300 ${scope === 'INTERNAL' ? 'bg-app-surface text-app-foreground shadow-lg' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>INTERNAL PURCHASE</button>
 </div>
 <input type="hidden" name="scope" value={scope} />
 </div>
 )}

 {/* 1.2 Fulfillment & Supplier Context Card */}
 <div className={`${showInternalSwitcher ? 'lg:col-span-8' : 'lg:col-span-12'} card p-6 bg-app-foreground/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-app-border/20 border border-app-text/50 space-y-4`}>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <FileText size={10} className="text-app-info" /> {showInternalSwitcher ? 'System Sequence' : 'Document ID'}
 </label>
 <input
 name="refCode"
 value={refCode}
 onChange={(e) => setRefCode(e.target.value)}
 placeholder="INV-XXXX"
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-black text-app-info focus:bg-app-surface focus:ring-4 focus:ring-blue-50 focus:border-app-info transition-all outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <FileSearch size={10} className="text-rose-500" /> Tax / Declared Ref
 </label>
 <input
 name="declaredRef"
 placeholder="TAX-XXXXX"
 value={declaredRef}
 onChange={(e) => setDeclaredRef(e.target.value)}
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-rose-50 focus:border-rose-200 transition-all outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <Search size={10} className="text-app-primary" /> Supplier Ref
 </label>
 <input
 name="supplierRef"
 placeholder="FR-XXXXX"
 value={supplierRef}
 onChange={(e) => setSupplierRef(e.target.value)}
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-blue-50 focus:border-app-info transition-all outline-none"
 />
 </div>
 <div className="space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <LayoutGrid size={10} className="text-app-primary" /> Site
 </label>
 <select
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-emerald-50 focus:border-app-success transition-all outline-none appearance-none cursor-pointer"
 value={selectedSiteId}
 onChange={(e) => setSelectedSiteId(Number(e.target.value))}
 name="siteId"
 required
 >
 <option value="">Site...</option>
 {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <Trash2 size={10} className="text-app-warning" /> Partner
 </label>
 <select
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-amber-50 focus:border-app-warning transition-all outline-none appearance-none cursor-pointer"
 name="supplierId"
 required
 value={selectedSupplierId}
 onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
 >
 <option value="">Partner...</option>
 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 </div>

 {/* Additional Reference Row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t border-app-border">
 <div className="col-span-2 space-y-1.5">
 <label className="flex items-center gap-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-widest leading-none">
 <CheckCircle2 size={10} className="text-teal-500" /> Delivery Receipt (BL)
 </label>
 <input
 name="deliveryNoteRef"
 placeholder="BL-XXXXX (Optional)"
 value={deliveryNoteRef}
 onChange={(e) => setDeliveryNoteRef(e.target.value)}
 className="w-full bg-app-background border border-app-border rounded-xl px-3 py-2 text-[11px] font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-teal-50 focus:border-teal-200 transition-all outline-none"
 />
 </div>
 </div>
 </div>
 </div>

 {/* 1.B High-Speed Source Selection */}
 <div className="grid lg:grid-cols-4 gap-5">
 <div className="lg:col-span-2 card p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] shadow-lg shadow-blue-200/40 flex items-center gap-5 text-app-foreground group cursor-pointer hover:scale-[1.02] transition-all duration-500">
 <div className="w-12 h-12 bg-app-foreground/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-app-text/30 group-hover:rotate-12 transition-transform">
 <FileSearch size={24} />
 </div>
 <div className="flex-1">
 <label className="block text-[10px] font-black text-app-info uppercase tracking-widest mb-1">Fulfill Pending Order</label>
 <select
 className="w-full bg-transparent text-sm font-black text-app-foreground border-none p-0 focus:ring-0 cursor-pointer"
 value={selectedPOId}
 onChange={(e) => handlePOLoad(Number(e.target.value))}
 >
 <option value="" className="text-app-foreground font-bold">New Direct Operation</option>
 {openPOs.map(po => (
 <option key={po.id} value={po.id} className="text-app-foreground font-bold">
 {po.po_number || `PO-${po.id}`} — Total: ${po.total_amount}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div className="card p-5 bg-app-surface border border-app-border rounded-[1.5rem] shadow-sm flex items-center gap-4">
 <div className="w-10 h-10 bg-app-primary-light rounded-2xl flex items-center justify-center text-app-primary border border-app-success/30">
 <LayoutGrid size={18} />
 </div>
 <div>
 <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-wider mb-0.5">Inventory Logic</label>
 <div className="text-xs font-black text-app-foreground">INSTANT STOCK-IN</div>
 </div>
 </div>

 <div className="card p-5 bg-app-surface border border-app-border rounded-[1.5rem] shadow-sm flex items-center gap-4">
 <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-100">
 <FileText size={18} />
 </div>
 <div>
 <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-wider mb-0.5">Ledger Impact</label>
 <div className="text-xs font-black text-app-foreground">AUTOMATIC POSTING</div>
 </div>
 </div>
 </div>

 {/* 1.C Commercial Parameters */}
 <div className="flex flex-wrap gap-4 items-center">
 <div className="flex bg-app-surface-2/50 p-1 rounded-2xl border border-app-border/50">
 <button type="button" onClick={() => setInvoicePriceType('HT')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${invoicePriceType === 'HT' ? 'bg-app-surface text-app-info shadow-md ring-1 ring-blue-50' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>HT PRICING</button>
 <button type="button" onClick={() => setInvoicePriceType('TTC')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${invoicePriceType === 'TTC' ? 'bg-app-surface text-app-primary shadow-md ring-1 ring-indigo-50' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>TTC PRICING</button>
 <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
 </div>

 <div className="flex bg-app-surface-2/50 p-1 rounded-2xl border border-app-border/50 transition-all">
 <button
 type="button"
 disabled={scope === 'INTERNAL'}
 onClick={() => setVatRecoverable(true)}
 className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${vatRecoverable ? 'bg-app-primary text-app-foreground shadow-lg' : 'text-app-muted-foreground hover:text-app-muted-foreground'} ${scope === 'INTERNAL' ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
 >
 TVA RECOVERABLE
 </button>
 <button
 type="button"
 disabled={scope === 'INTERNAL'}
 onClick={() => setVatRecoverable(false)}
 className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${!vatRecoverable ? 'bg-rose-600 text-app-foreground shadow-lg' : 'text-app-muted-foreground hover:text-app-muted-foreground'} ${scope === 'INTERNAL' ? 'opacity-100 ring-2 ring-rose-300 ring-offset-2' : ''}`}
 >
 NON-RECOVERABLE
 </button>
 <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
 </div>

 <div className="flex bg-app-surface-2/50 p-1 rounded-2xl border border-app-border/50">
 <button type="button" onClick={() => setProfitMode('MARGIN')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profitMode === 'MARGIN' ? 'bg-app-surface text-app-primary shadow-md ring-1 ring-emerald-50' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>MARGIN ANALYSIS</button>
 <button type="button" onClick={() => setProfitMode('MARKUP')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profitMode === 'MARKUP' ? 'bg-app-surface text-app-primary shadow-md ring-1 ring-emerald-50' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}>MARKUP ANALYSIS</button>
 </div>

 <div className="ml-auto flex items-center gap-2 text-[10px] font-black text-app-muted-foreground bg-app-background px-4 py-2.5 rounded-2xl border border-dashed border-app-border">
 <CheckCircle2 size={14} className="text-app-primary" />
 <span className="uppercase tracking-[0.05em]">Commercial Integrity Active</span>
 </div>
 </div>

 {/* 2. Product Search */}
 <div className="bg-app-surface rounded-[2.5rem] shadow-2xl shadow-app-border/20 border border-app-border overflow-hidden">
 <div className="p-8 bg-gradient-to-r from-slate-50 to-white border-b border-app-border flex items-center gap-6">
 <div className="relative flex-1 group flex items-center gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground group-focus-within:text-app-info transition-colors" size={20} />
 <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId)} />
 </div>
 <button
 type="button"
 className="h-11 px-5 bg-app-surface text-app-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-app-surface-2 transition-all shadow-lg shadow-app-border/20"
 onClick={() => setIsDiscoveryOpen(true)}
 >
 <LayoutGrid size={16} />
 Search Products
 </button>
 </div>
 <div className="hidden md:flex flex-col items-end">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Selected Items</span>
 <span className="text-xl font-black text-app-foreground leading-none">{lines.length}</span>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-xs text-left border-collapse">
 <thead className="bg-[#FBFCFE] text-app-muted-foreground font-black uppercase tracking-[0.2em] text-[9px] border-b border-app-border">
 <tr>
 <th className="p-6 min-w-[240px]">Operation Item</th>
 <th className="p-3 text-center">Current</th>
 <th className="p-3 text-center bg-app-info-bg/20">Target HT</th>
 <th className="p-3 w-48 text-center bg-app-surface-2/50">Unit Cost (Base / Taxed)</th>
 <th className="p-3 w-48 text-center bg-purple-50/20">Market Price</th>
 <th className="p-3 text-center">Profitability</th>
 <th className="p-3 w-32">Expiry</th>
 <th className="p-3 text-right pr-6">Line Total</th>
 <th className="p-3 w-12 pr-6"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {lines.length === 0 && (
 <tr>
 <td colSpan={12} className="p-12 text-center">
 <div className="flex flex-col items-center gap-3 text-app-muted-foreground">
 <ShoppingCartSkeleton />
 <p className="font-medium">No products selected. Search above to begin.</p>
 </div>
 </td>
 </tr>
 )}
 {lines.map((line, idx) => (
 <tr
 key={line.productId}
 className={`group transition-all duration-300 ${focusedProductId === line.productId ? 'bg-app-info-bg/30' : 'hover:bg-app-surface-2/50'}`}
 onMouseEnter={() => setFocusedProductId(line.productId)}
 >
 <td className="p-6">
 <div className="flex gap-4 items-center">
 <div className="w-10 h-10 rounded-xl bg-app-surface-2 flex items-center justify-center text-app-muted-foreground group-hover:bg-app-surface group-hover:shadow-md transition-all">
 <Plus size={18} />
 </div>
 <div>
 <div className="font-black text-app-foreground text-sm mb-0.5">{line.productName}</div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] font-mono text-app-muted-foreground">SKU: {line.barcode || 'NO_SKU'}</span>
 {line.stockLevel < 10 && <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Low Stock</span>}
 </div>
 </div>
 </div>
 <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
 <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
 </td>

 <td className="p-3 text-center">
 <div className="text-[10px] font-black text-app-muted-foreground uppercase mb-1 tracking-tighter">Stock</div>
 <div className="font-mono font-black text-app-muted-foreground">{line.stockLevel}</div>
 </td>

 <td className="p-3 text-center bg-app-info-bg/10">
 <div className="text-[10px] font-black text-app-info uppercase mb-1 tracking-tighter italic">Proposed</div>
 <input
 type="number"
 className="w-20 bg-app-surface border border-app-info/30 rounded-xl p-2 text-center font-black text-app-info focus:ring-4 focus:ring-blue-100 focus:border-app-info/30 outline-none shadow-sm transition-all"
 value={line.quantity}
 onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
 name={`lines[${idx}][quantity]`}
 />
 </td>

 <td className="p-3 bg-app-surface-2/30">
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <span className="text-[8px] font-black text-app-muted-foreground w-4 tracking-tighter">HT</span>
 <input
 type="number" step="0.01"
 className={`flex-1 bg-app-surface p-2 text-[11px] font-mono font-black border rounded-xl shadow-sm transition-all ${invoicePriceType === 'HT' ? 'border-app-info/30 ring-2 ring-blue-50 text-app-info' : 'border-app-border text-app-muted-foreground'}`}
 value={line.unitCostHT}
 onChange={(e) => updateLine(idx, { unitCostHT: Number(e.target.value) })}
 name={`lines[${idx}][unitCostHT]`}
 />
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[8px] font-black text-app-muted-foreground w-4 tracking-tighter">TTC</span>
 <input
 type="number" step="0.01"
 className={`flex-1 bg-app-surface p-2 text-[11px] font-mono font-black border rounded-xl shadow-sm transition-all ${invoicePriceType === 'TTC' ? 'border-app-primary/30 ring-2 ring-indigo-50 text-app-primary' : 'border-app-border text-app-muted-foreground'}`}
 value={line.unitCostTTC}
 onChange={(e) => updateLine(idx, { unitCostTTC: Number(e.target.value) })}
 name={`lines[${idx}][unitCostTTC]`}
 />
 </div>
 </div>
 </td>

 <td className="p-3 bg-purple-50/10">
 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <span className="text-[8px] font-black text-app-muted-foreground w-4 tracking-tighter">HT</span>
 <input
 type="number" step="0.01"
 className={`flex-1 bg-app-surface p-2 text-[11px] font-mono font-black border rounded-xl shadow-sm transition-all ${!worksInTTC ? 'border-purple-300 ring-2 ring-purple-50 text-purple-700' : 'border-app-border text-app-muted-foreground'}`}
 value={line.sellingPriceHT}
 onChange={(e) => updateLine(idx, { sellingPriceHT: Number(e.target.value) })}
 name={`lines[${idx}][sellingPriceHT]`}
 />
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[8px] font-black text-app-muted-foreground w-4 tracking-tighter">TTC</span>
 <input
 type="number" step="0.01"
 className={`flex-1 bg-app-surface p-2 text-[11px] font-mono font-black border rounded-xl shadow-sm transition-all ${worksInTTC ? 'border-fuchsia-300 ring-2 ring-fuchsia-50 text-fuchsia-700' : 'border-app-border text-app-muted-foreground'}`}
 value={line.sellingPriceTTC}
 onChange={(e) => updateLine(idx, { sellingPriceTTC: Number(e.target.value) })}
 name={`lines[${idx}][sellingPriceTTC]`}
 />
 </div>
 </div>
 </td>

 <td className="p-3 text-center">
 {(() => {
 const { margin } = getProfitAnalysis(line);
 return (
 <div className="flex flex-col items-center">
 <div className={`w-14 h-14 rounded-full border-4 flex flex-col items-center justify-center transition-all ${margin < 15 ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-app-success/30 bg-app-primary-light text-app-primary'}`}>
 <span className="text-xs font-black leading-none">{margin.toFixed(0)}%</span>
 <span className="text-[7px] font-black uppercase opacity-60">PROFIT</span>
 </div>
 </div>
 );
 })()}
 </td>

 <td className="p-3">
 <div className="relative group/exp">
 <input
 type="date"
 className="w-full text-[10px] font-black bg-app-background border border-app-border p-2.5 rounded-xl focus:bg-app-surface focus:ring-4 focus:ring-slate-100 transition-all outline-none cursor-pointer"
 value={line.expiryDate}
 onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
 name={`lines[${idx}][expiryDate]`}
 />
 </div>
 </td>

 <td className="p-3 text-right pr-6">
 <div className="text-[10px] text-app-muted-foreground font-bold mb-1 uppercase tracking-widest">Total</div>
 <div className="text-sm font-mono font-black text-app-foreground bg-app-surface-2/50 px-3 py-1 rounded-lg inline-block border border-app-border/50">
 ${(line.quantity * (invoicePriceType === 'TTC' ? (line.unitCostTTC || 0) : (line.unitCostHT || 0))).toFixed(2)}
 </div>
 </td>

 <td className="p-3 text-center pr-6">
 <button
 type="button"
 onClick={() => removeLine(idx)}
 className="w-8 h-8 flex items-center justify-center text-app-muted-foreground hover:text-rose-600 hover:bg-rose-50 hover:shadow-inner rounded-xl transition-all"
 >
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* 3. Financial Details */}
 <div className="grid lg:grid-cols-2 gap-8 pt-6">
 {/* 3.1 Context & Audit Trail */}
 <div className="space-y-6">
 <div className="card p-8 bg-app-foreground/80 backdrop-blur-xl rounded-[2.5rem] border border-app-border shadow-xl shadow-app-border/20 space-y-4">
 <label className="flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">
 <FileText size={16} className="text-app-info" /> Executive Observations
 </label>
 <textarea
 name="notes"
 rows={4}
 className="w-full border-2 border-app-border bg-app-surface-2/50 rounded-[1.5rem] p-5 text-sm font-medium focus:bg-app-surface focus:border-app-info focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none shadow-inner"
 placeholder="Enter specific operation directives or audit notes..."
 />
 </div>

 {/* 3.2 Dynamic Friction Costs (Fees) */}
 <div className="card p-8 bg-app-foreground/80 backdrop-blur-xl rounded-[2.5rem] border border-app-border shadow-xl shadow-app-border/20">
 <div className="flex justify-between items-center mb-6">
 <label className="flex items-center gap-3 text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em]">
 <Plus size={16} className="text-app-primary" /> Incidental Fees
 </label>
 <button type="button" onClick={() => setExtraFees([...extraFees, { name: '', amount: 0 }])} className="text-[10px] font-black text-app-primary bg-app-primary-light hover:bg-app-primary-light px-4 py-2 rounded-xl transition-colors shadow-sm ring-1 ring-emerald-100">ADD SURCHARGE</button>
 </div>
 <div className="space-y-3">
 {extraFees.map((fee, idx) => (
 <div key={idx} className="flex gap-4 items-center bg-app-surface-2/80 p-3 rounded-2xl border border-app-border group">
 <div className="flex-1">
 <input
 placeholder="Surcharge Name"
 className="w-full bg-transparent border-none text-xs font-black text-app-foreground focus:ring-0"
 value={fee.name}
 name={`extraFees[${idx}][name]`}
 onChange={(e) => {
 const f = [...extraFees];
 f[idx].name = e.target.value;
 setExtraFees(f);
 }}
 />
 </div>
 <div className="w-32 relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-app-muted-foreground">$</span>
 <input
 type="number"
 placeholder="0.00"
 className="w-full bg-app-surface border border-app-border rounded-xl pl-6 pr-3 py-2 text-xs font-black text-right text-app-foreground focus:ring-4 focus:ring-emerald-50 focus:border-app-success transition-all shadow-sm"
 value={fee.amount}
 name={`extraFees[${idx}][amount]`}
 onChange={(e) => {
 const f = [...extraFees];
 f[idx].amount = Number(e.target.value);
 setExtraFees(f);
 }}
 />
 </div>
 <button type="button" onClick={() => setExtraFees(extraFees.filter((_, i) => i !== idx))} className="text-app-muted-foreground hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
 </div>
 ))}
 {extraFees.length === 0 && <div className="text-[11px] text-app-muted-foreground font-medium text-center py-6 border-2 border-dashed border-app-border rounded-2xl italic">No incidental fees recorded for this operation.</div>}
 </div>
 </div>
 </div>

 {/* 3.3 Settlement Hub (Totals & Payment) */}
 <div className="card p-10 bg-app-surface rounded-[3rem] shadow-2xl shadow-app-border/20 text-app-foreground space-y-8 relative overflow-hidden">
 {/* Decorative Background Element */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-app-info-bg rounded-full blur-3xl -mr-32 -mt-32"></div>

 <div className="relative space-y-6">
 <h3 className="text-[10px] font-black text-app-info uppercase tracking-[0.3em]">Financial Settlement</h3>

 <div className="space-y-4">
 <div className="flex justify-between items-end border-b border-app-text/10 pb-4">
 <span className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">Subtotal (Net)</span>
 <span className="text-xl font-mono font-black">${getInvoiceTotals().subtotal.toFixed(2)}</span>
 </div>
 <div className="flex justify-between items-end border-b border-app-text/10 pb-4">
 <span className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">Aggregate Tax (VAT)</span>
 <span className="text-xl font-mono font-black text-app-primary">${getInvoiceTotals().tax.toFixed(2)}</span>
 </div>
 <div className="flex justify-between items-end">
 <div className="flex flex-col gap-2">
 <span className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">Adjustments (Fees/Disc)</span>
 <input
 type="number"
 placeholder="Global Discount"
 className="bg-app-foreground/5 border border-app-text/10 rounded-xl px-3 py-1.5 text-[11px] font-black text-rose-400 focus:bg-app-foreground/10 transition-all outline-none"
 value={discountAmount}
 onChange={(e) => setDiscountAmount(Number(e.target.value))}
 name="discountAmount"
 />
 </div>
 <span className="text-xl font-mono font-black text-app-primary">+{(getInvoiceTotals().fees - discountAmount).toFixed(2)}</span>
 </div>
 </div>

 <div className="pt-6 border-t border-app-text/20 flex justify-between items-center">
 <span className="text-app-info text-sm font-black uppercase tracking-[0.2em]">Grand Total</span>
 <span className="text-5xl font-mono font-black tracking-tighter text-app-foreground drop-shadow-lg">${getInvoiceTotals().total.toFixed(2)}</span>
 </div>

 {/* Immediate Settlement */}
 <div className="bg-app-foreground/5 backdrop-blur-md p-6 rounded-[2rem] border border-app-text/10 space-y-4 shadow-inner">
 <div className="flex items-center justify-between">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Immediate Payment</label>
 <div className="flex items-center gap-2">
 <div className={`w-2 h-2 rounded-full ${paidAmount >= getInvoiceTotals().total ? 'bg-app-primary shadow-[0_0_10px_var(--app-success)]' : 'bg-app-warning shadow-[0_0_10px_var(--app-warning)]'}`}></div>
 <span className="text-[10px] font-black text-app-foreground uppercase">{paidAmount >= getInvoiceTotals().total ? 'FULLY PAID' : 'PARTIAL/CREDIT'}</span>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase">Amount Paid</span>
 <input
 type="number"
 className="w-full bg-app-foreground/10 border border-app-text/20 rounded-xl px-4 py-3 text-sm font-black text-app-foreground focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
 value={paidAmount}
 onChange={(e) => setPaidAmount(Number(e.target.value))}
 name="paidAmount"
 />
 </div>
 <div className="space-y-2">
 <span className="text-[9px] font-black text-app-muted-foreground uppercase">Funding Account</span>
 <select
 className="w-full bg-app-foreground/10 border border-app-text/20 rounded-xl px-4 py-3 text-xs font-black text-app-foreground focus:ring-4 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
 value={paymentAccountId}
 onChange={(e) => setPaymentAccountId(Number(e.target.value))}
 name="paymentAccountId"
 >
 <option value="" className="text-app-foreground">Choose...</option>
 {(financialSettings?.paymentAccounts || []).map((acc: any) => (
 <option key={acc.id} value={acc.id} className="text-app-foreground">{acc.name} ({acc.currency})</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 <button
 type="submit"
 disabled={isPending || lines.length === 0}
 className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl ${isPending || lines.length === 0 ? 'bg-app-surface-2 text-app-muted-foreground cursor-not-allowed' : 'bg-app-info hover:bg-app-info text-app-foreground shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'}`}
 >
 {isPending ? (
 <>
 <div className="w-5 h-5 border-4 border-app-info border-t-white rounded-full animate-spin"></div>
 Processing...
 </>
 ) : (
 <>
 <CheckCircle2 size={20} />
 {scope === 'OFFICIAL' ? 'Commit Purchase Invoice' : 'Commit Internal Entry'}
 </>
 )}
 </button>

 {state.message && (
 <div className={`mt-4 p-4 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider relative z-10 ${state.errors ? 'bg-app-error/20 text-rose-300' : 'bg-app-primary/20 text-app-success'}`}>
 {state.errors ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
 {state.message}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* B. Product Intelligence Sidebar (The "Genome" Panel) */}
 <aside className="w-full lg:w-[420px] shrink-0 space-y-6">
 <div className="sticky top-6">
 <div className="card bg-app-surface rounded-[3rem] shadow-2xl shadow-app-border/20 border border-app-border overflow-hidden min-h-[720px] flex flex-col">
 <div className="p-8 bg-gradient-to-b from-slate-800 to-slate-900 border-b border-app-border/50">
 <div className="flex items-center gap-4 mb-4">
 <div className="w-12 h-12 bg-app-info/20 rounded-2xl flex items-center justify-center text-app-info border border-app-info/30">
 <Info size={24} />
 </div>
 <div>
 <h3 className="text-lg font-black text-app-foreground leading-tight underline decoration-blue-500 decoration-4 underline-offset-4">Product Details</h3>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mt-1">Supplier Pricing</p>
 </div>
 </div>
 </div>

 <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
 {!focusedProductId ? (
 <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4">
 <div className="w-20 h-20 bg-app-surface-2/50 rounded-full flex items-center justify-center text-app-muted-foreground">
 <Search size={32} />
 </div>
 <div className="space-y-1">
 <p className="text-app-muted-foreground font-black text-xs uppercase tracking-widest">Waiting for Focus</p>
 <p className="text-app-muted-foreground text-[10px] font-medium leading-relaxed">Hover over a product in the table to generate real-time commercial intelligence.</p>
 </div>
 </div>
 ) : isIntelligenceLoading ? (
 <div className="space-y-8 animate-pulse">
 <div className="h-32 bg-app-surface-2/50 rounded-[2rem]"></div>
 <div className="h-48 bg-app-surface-2/30 rounded-[2rem]"></div>
 <div className="h-24 bg-app-surface-2/50 rounded-[2rem]"></div>
 </div>
 ) : intelligence ? (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
 {/* Score Card */}
 <div className="bg-gradient-to-br from-slate-800 to-blue-900/40 p-6 rounded-[2rem] border border-app-info/20">
 <div className="flex justify-between items-start mb-4">
 <span className="text-[10px] font-black text-app-info uppercase tracking-widest">Commercial Health</span>
 <div className="text-3xl font-mono font-black text-app-foreground leading-none">88<span className="text-sm text-app-info">/100</span></div>
 </div>
 <div className="h-1.5 bg-app-surface rounded-full overflow-hidden flex gap-0.5">
 <div className="h-full bg-app-info/10 w-[60%] shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
 <div className="h-full bg-app-primary/10 w-[28%]"></div>
 <div className="h-full bg-app-surface flex-1"></div>
 </div>
 <p className="text-[9px] text-app-muted-foreground mt-2 font-medium">Aggregated score based on margins, sales velocity, and sourcing efficiency.</p>
 </div>

 {/* Velocity Widget */}
 <div className="space-y-4">
 <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <LayoutGrid size={12} className="text-app-primary" /> Market Momentum
 </h4>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-app-surface-2/30 p-4 rounded-2xl border border-app-border">
 <div className="text-[9px] text-app-muted-foreground font-black uppercase mb-1">Sales Velocity</div>
 <div className="text-xl font-mono font-black text-app-foreground">{intelligence.stats?.sales_velocity?.toFixed(1) || '0.0'} <span className="text-[10px] text-app-primary uppercase font-bold">U/Day</span></div>
 </div>
 <div className="bg-app-surface-2/30 p-4 rounded-2xl border border-app-border">
 <div className="text-[9px] text-app-muted-foreground font-black uppercase mb-1">Forecast Demand</div>
 <div className="text-xl font-mono font-black text-app-foreground">+{intelligence.stats?.units_sold_30d || '0'} <span className="text-[10px] text-app-primary uppercase font-bold">U/30d</span></div>
 </div>
 </div>
 </div>

 {/* Pricing Benchmarks */}
 <div className="space-y-4">
 <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
 <Plus size={12} className="text-app-primary" /> Sourcing Benchmarks
 </h4>
 <div className="space-y-3">
 <div className="flex justify-between items-center p-3 bg-app-surface-2/20 rounded-xl border border-app-border/50 group/row hover:bg-app-surface-2/40 transition-colors">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase">Avg. Sourcing Price</span>
 <span className="text-sm font-mono font-black text-app-foreground">${intelligence.stats?.avg_purchase_price?.toFixed(2) || '---'}</span>
 </div>
 <div className="flex justify-between items-center p-3 bg-app-surface-2/20 rounded-xl border border-app-border/50 group/row hover:bg-app-surface-2/40 transition-colors">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase">Lowest Recorded</span>
 <span className="text-sm font-mono font-black text-app-primary">${intelligence.stats?.min_purchase_price?.toFixed(2) || '---'}</span>
 </div>
 <div className="flex justify-between items-center p-3 bg-app-surface-2/20 rounded-xl border border-app-border/50 group/row hover:bg-app-surface-2/40 transition-colors">
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase">Last Price Applied</span>
 <span className="text-sm font-mono font-black text-app-warning">${intelligence.stats?.last_purchase_price?.toFixed(2) || '---'}</span>
 </div>
 </div>
 </div>

 {/* Waste Risk Gauge */}
 {intelligence.waste_risk && (
 <div className="card p-6 bg-rose-950/20 rounded-[2rem] border border-rose-500/20 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-4 opacity-10">
 <AlertTriangle size={64} className="text-rose-500" />
 </div>
 <div className="relative">
 <div className="flex items-center gap-2 text-rose-400 mb-2">
 <AlertTriangle size={14} />
 <span className="text-[10px] font-black uppercase tracking-[0.1em]">Expiry Risk Alert</span>
 </div>
 <p className="text-[11px] font-medium text-rose-200/80 leading-relaxed">
 Current stock levels indicate a <span className="text-rose-400 font-black">HIGH RISK</span> of waste before expiration. Recommend reducing order volume.
 </p>
 </div>
 </div>
 )}
 </div>
 ) : null}
 </div>

 <div className="p-8 bg-app-background border-t border-app-border/50">
 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-4">
 <span>Global Inventory Index</span>
 <span className="text-app-info">Live Sync</span>
 </div>
 <div className="flex gap-1.5 h-1">
 <div className="flex-1 bg-app-info rounded-full"></div>
 <div className="flex-1 bg-app-info rounded-full opacity-60"></div>
 <div className="flex-1 bg-app-surface-2 rounded-full"></div>
 <div className="flex-1 bg-app-surface-2 rounded-full"></div>
 <div className="flex-1 bg-app-surface-2 rounded-full"></div>
 </div>
 </div>
 </div>
 </div>
 </aside>

 {/* C. Global Modals */}
 <DiscoveryHubModal
 isOpen={isDiscoveryOpen}
 onClose={() => setIsDiscoveryOpen(false)}
 onSelect={addProductToLines}
 siteId={Number(selectedSiteId)}
 suppliers={suppliers}
 />
 </form>
 );
}

// --- Specialized UI Components ---

function ShoppingCartSkeleton() {
 return (
 <div className="relative w-24 h-24 text-app-foreground flex items-center justify-center">
 <LayoutGrid size={48} className="animate-pulse" />
 <div className="absolute top-0 right-0 w-6 h-6 bg-app-info rounded-full border-4 border-white animate-bounce"></div>
 </div>
 );
}

function ProductSearch({ callback, siteId }: { callback: (p: Record<string, any>) => void, siteId: number }) {
 const [query, setQuery] = useState('');
 const [results, setResults] = useState<any[]>([]);
 const [open, setOpen] = useState(false);

 useEffect(() => {
 const timer = setTimeout(async () => {
 if (query.length > 1) {
 const res = await searchProductsSimple(query, siteId);

 // Auto-add if it's a single exact match (e.g. barcode scan)
 if (res.length === 1) {
 callback(res[0]);
 setQuery('');
 setResults([]);
 setOpen(false);
 return;
 }

 setResults(res);
 setOpen(true);
 } else {
 setResults([]);
 setOpen(false);
 }
 }, 300);
 return () => clearTimeout(timer);
 }, [query, siteId, callback]);

 return (
 <div className="relative">
 <input
 type="text"
 className="w-full bg-transparent p-2 text-sm font-black text-app-foreground placeholder:text-app-muted-foreground outline-none"
 placeholder="Search Item, Barcode or SKU..."
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onFocus={() => query.length > 1 && setOpen(true)}
 />
 {open && results.length > 0 && (
 <div className="absolute top-full left-[-32px] right-[-32px] mt-4 bg-app-surface rounded-[2rem] shadow-[0_32px_64px_-16px_var(--app-border)] border border-app-border z-50 overflow-hidden ring-1 ring-slate-200">
 {results.map(r => (
 <button
 key={r.id}
 type="button"
 onClick={() => {
 callback(r);
 setQuery('');
 setOpen(false);
 }}
 className="w-full p-6 text-left hover:bg-app-info-bg flex items-center justify-between group transition-all border-b border-app-border last:border-none"
 >
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-app-background rounded-xl flex items-center justify-center text-app-muted-foreground group-hover:bg-app-surface group-hover:text-app-info transition-all font-black text-xs">
 SKU
 </div>
 <div>
 <div className="font-black text-sm text-app-foreground group-hover:text-app-info transition-colors">{r.name}</div>
 <div className="text-[10px] text-app-muted-foreground font-mono tracking-tighter">REF: {r.sku} • IN STOCK: {r.stockLevel}</div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-xs font-black text-app-foreground">${r.costPriceHT} <span className="text-[8px] font-bold text-app-muted-foreground uppercase">HT</span></div>
 <div className="text-[10px] text-app-primary font-black uppercase tracking-widest mt-0.5">Recommended: +{r.proposedQty}</div>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 );
}

function DiscoveryHubModal({
 isOpen,
 onClose,
 onSelect,
 siteId,
 suppliers
}: {
 isOpen: boolean,
 onClose: () => void,
 onSelect: (p: any) => void,
 siteId: number,
 suppliers: any[]
}) {
 const [query, setQuery] = useState('');
 const [categoryId, setCategoryId] = useState<string>('');
 const [brandId, setBrandId] = useState<string>('');
 const [supplierId, setSupplierId] = useState<string>('');
 const [products, setProducts] = useState<any[]>([]);
 const [categories, setCategories] = useState<any[]>([]);
 const [brands, setBrands] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 getCategories().then(setCategories);
 getBrands().then(setBrands);
 }, []);

 useEffect(() => {
 if (!isOpen) return;
 const fetchItems = async () => {
 setLoading(true);
 try {
 let res = [];
 if (query && query.length > 1) {
 // Use enhanced search if query exists
 res = await searchProductsSimple(query);
 } else {
 // Otherwise use standard listing with filters
 const params: any = {};
 if (categoryId) params.category = categoryId;
 if (brandId) params.brand = brandId;
 if (supplierId) params.supplier = supplierId;
 // Note: siteId filtering removed by default to prevent "Failed for Official" results if stock mapping is missing
 res = await getProducts(params);
 }
 setProducts(res);
 } catch (e) {
 console.error("Discovery Hub Error:", e);
 setProducts([]);
 } finally {
 setLoading(false);
 }
 };
 const timer = setTimeout(fetchItems, 300);
 return () => clearTimeout(timer);
 }, [query, categoryId, brandId, supplierId, isOpen]);

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col bg-[#F8FAFC] overflow-hidden border-none shadow-3xl rounded-[2.5rem]">
 <DialogHeader className="p-8 bg-app-surface border-b border-app-border shrink-0">
 <div className="flex justify-between items-center">
 <div>
 <DialogTitle className="text-2xl font-black text-app-foreground leading-tight">Product Search</DialogTitle>
 <p className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mt-1 italic">Browse product catalog</p>
 </div>
 <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-app-background text-app-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20} /></button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
 <div className="relative group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground group-focus-within:text-app-info transition-colors" size={16} />
 <input
 className="w-full bg-app-background border border-app-border rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-app-foreground focus:bg-app-surface focus:ring-4 focus:ring-blue-50 focus:border-app-info transition-all outline-none"
 placeholder="Universal Search..."
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 />
 </div>
 <select
 className="bg-app-background border border-app-border rounded-2xl px-4 text-xs font-bold text-app-foreground outline-none focus:ring-4 focus:ring-slate-100 h-12 appearance-none cursor-pointer"
 value={categoryId}
 onChange={(e) => setCategoryId(e.target.value)}
 >
 <option value="">All Categories</option>
 {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 <select
 className="bg-app-background border border-app-border rounded-2xl px-4 text-xs font-bold text-app-foreground outline-none focus:ring-4 focus:ring-slate-100 h-12 appearance-none cursor-pointer"
 value={brandId}
 onChange={(e) => setBrandId(e.target.value)}
 >
 <option value="">All Brands</option>
 {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
 </select>
 <select
 className="bg-app-background border border-app-border rounded-2xl px-4 text-xs font-bold text-app-foreground outline-none focus:ring-4 focus:ring-slate-100 h-12 appearance-none cursor-pointer"
 value={supplierId}
 onChange={(e) => setSupplierId(e.target.value)}
 >
 <option value="">Any Supplier</option>
 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 </DialogHeader>

 <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
 {loading ? (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
 {[...Array(10)].map((_, i) => (
 <div key={i} className="h-64 bg-app-surface-2 animate-pulse rounded-[2rem]"></div>
 ))}
 </div>
 ) : products.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center text-app-muted-foreground gap-4 opacity-50">
 <LayoutGrid size={64} />
 <p className="font-black text-xs uppercase tracking-widest">No matching assets identified</p>
 </div>
 ) : (
 <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
 {products.map(p => (
 <button
 key={p.id}
 onClick={() => {
 onSelect(p);
 // onClose(); // Might want to keep it open for multiple adds
 }}
 className="group relative bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm hover:shadow-xl hover:shadow-app-border/20 hover:-translate-y-1 transition-all text-left overflow-hidden ring-1 ring-slate-100"
 >
 <div className="absolute top-0 left-0 w-1 h-full bg-app-info opacity-0 group-hover:opacity-100 transition-all"></div>
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex justify-between">
 <span>SKU: {p.sku || 'N/A'}</span>
 <span className="text-app-info">{p.brand_name}</span>
 </div>
 <div className="font-black text-app-foreground text-sm line-clamp-2 min-h-[40px] mb-4 group-hover:text-app-info transition-colors">
 {p.name}
 </div>
 <div className="space-y-3">
 <div className="flex justify-between items-end border-b border-app-border pb-2">
 <span className="text-[10px] font-bold text-app-muted-foreground">STOCK</span>
 <span className="text-xs font-mono font-black text-app-muted-foreground">{p.stockLevel || 0}</span>
 </div>
 <div className="flex justify-between items-end">
 <span className="text-[10px] font-bold text-app-muted-foreground">COST HT</span>
 <span className="text-sm font-mono font-black text-app-foreground">${p.costPriceHT || '0.00'}</span>
 </div>
 </div>
 <div className="mt-4 w-full py-2 bg-app-background text-[9px] font-black uppercase text-center rounded-xl text-app-muted-foreground group-hover:bg-app-info group-hover:text-app-foreground transition-all">
 Add to Hub
 </div>
 </button>
 ))}
 </div>
 )}
 </div>

 <div className="p-4 bg-app-surface border-t border-app-border shrink-0 text-center">
 <button onClick={onClose} className="px-8 py-3 bg-app-surface text-app-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-app-border/20 hover:scale-105 active:scale-95 transition-all">Close Pipeline</button>
 </div>
 </DialogContent>
 </Dialog>
 );
}