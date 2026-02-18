'use client';

import { useActionState, useState, useEffect, useCallback } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createPurchaseInvoice } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import { Plus, Trash2, Search, Info, AlertTriangle, CheckCircle2, FileText, LayoutGrid } from "lucide-react";

export default function PurchaseForm({
    suppliers,
    sites,
    financialSettings
}: {
    suppliers: any[],
    sites: any[],
    financialSettings: any
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createPurchaseInvoice, initialState);
    const { logOperation } = useDev();

    // --- Core Header State ---
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');

    // ... (rest of states)

    // --- Effects ---

    // Log initial READ
    useEffect(() => {
        logOperation({
            type: 'READ',
            module: 'PURCHASE_ENTRANCE',
            timestamp: new Date(),
            details: 'Fetched 3 entities: Suppliers, sites/warehouses, and global financial settings.',
            status: 'SUCCESS'
        });
    }, []);

    // Log WRITE result
    useEffect(() => {
        if (state.message) {
            logOperation({
                type: 'WRITE',
                module: 'PURCHASE_ENTRANCE',
                timestamp: new Date(),
                details: state.message,
                status: state.errors ? 'FAILURE' : 'SUCCESS'
            });
        }
    }, [state]);
    const [profitMode, setProfitMode] = useState<'MARGIN' | 'MARKUP'>('MARGIN');
    const [invoicePriceType, setInvoicePriceType] = useState<'HT' | 'TTC'>('HT');
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [availableWarehouses, setAvailableWarehouses] = useState<Record<string, unknown>[]>([]);

    // --- Line Items State ---
    const [lines, setLines] = useState<PurchaseLine[]>([]);

    // --- Financial Rules ---
    const worksInTTC = financialSettings.worksInTTC; // Global policy
    const declareTVA = financialSettings.declareTVA; // Tax recovery policy
    const pricingCostBasis = financialSettings.pricingCostBasis || 'AUTO';

    // --- Effects ---

    // Update warehouses when site changes
    useEffect(() => {
        if (selectedSiteId) {
            const site = sites.find(s => s.id === Number(selectedSiteId));
            setAvailableWarehouses(site?.warehouses || []);
        } else {
            setAvailableWarehouses([]);
        }
    }, [selectedSiteId, sites]);

    // Auto-set VAT recoverable based on scope change (Internal = Not Recoverable)
    useEffect(() => {
        setVatRecoverable(scope === 'OFFICIAL');
    }, [scope]);

    // --- Handlers ---

    const addProductToLines = (product: any) => {
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
            quantity: product.proposedQty || 1,
            unitCostHT,
            unitCostTTC,
            sellingPriceHT,
            sellingPriceTTC,
            expiryDate: '',
            taxRate,
        }, ...lines]);
    };

    const updateLine = (idx: number, updates: any) => {
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
    const getEffectiveCost = (line: any) => {
        if (pricingCostBasis === 'FORCE_HT') return line.unitCostHT;
        if (pricingCostBasis === 'FORCE_TTC') return line.unitCostTTC;

        // AUTO Mode
        return vatRecoverable ? line.unitCostHT : line.unitCostTTC;
    };

    const getProfitAnalysis = (line: any) => {
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

        const tax = totalTTC - totalHT;

        return {
            subtotal: totalHT, // Always show Net for clarity
            tax,
            total: totalTTC // Always show Gross correctly
        };
    };

    const totals = getInvoiceTotals();

    return (
        <form action={formAction} className="space-y-6">

            {/* 1. Header Configuration */}
            <div className="grid lg:grid-cols-5 gap-4">
                {/* 1.1 Mode Settings */}
                <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Invoice Mode</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg h-9">
                        <button type="button" onClick={() => setScope('OFFICIAL')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${scope === 'OFFICIAL' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>OFFICIAL</button>
                        <button type="button" onClick={() => setScope('INTERNAL')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${scope === 'INTERNAL' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500'}`}>INTERNAL</button>
                    </div>
                    <input type="hidden" name="scope" value={scope} />
                </div>

                {/* 1.2 Cost Engine Settings */}
                <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Price Type</label>
                            <div className="flex p-1 bg-gray-100 rounded-lg h-9">
                                <button type="button" onClick={() => setInvoicePriceType('HT')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${invoicePriceType === 'HT' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>HT</button>
                                <button type="button" onClick={() => setInvoicePriceType('TTC')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${invoicePriceType === 'TTC' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>TTC</button>
                            </div>
                            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recoverable?</label>
                            <div className="flex p-1 bg-gray-100 rounded-lg h-9">
                                <button type="button" onClick={() => setVatRecoverable(true)} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${vatRecoverable ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>YES</button>
                                <button type="button" onClick={() => setVatRecoverable(false)} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${!vatRecoverable ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'}`}>NO</button>
                            </div>
                            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
                        </div>
                    </div>
                </div>

                {/* 1.3 Profit Metric */}
                <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Profit Metric</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg h-9">
                        <button type="button" onClick={() => setProfitMode('MARGIN')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${profitMode === 'MARGIN' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Margin %</button>
                        <button type="button" onClick={() => setProfitMode('MARKUP')} className={`flex-1 rounded-md text-[10px] font-bold transition-all ${profitMode === 'MARKUP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500'}`}>Markup %</button>
                    </div>
                </div>

                {/* 1.4 Site & Warehouse */}
                <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 text-center">Site & Warehouse</label>
                    <div className="flex gap-2">
                        <select className="flex-1 bg-transparent text-[10px] font-bold text-gray-900 border-none p-0 focus:ring-0" value={selectedSiteId} onChange={(e) => setSelectedSiteId(Number(e.target.value))} name="siteId" required>
                            <option value="">Site...</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select className="flex-1 bg-transparent text-[10px] font-bold text-emerald-600 border-none p-0 focus:ring-0" name="warehouseId" required>
                            <option value="">WH...</option>
                            {availableWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* 1.5 Supplier Selection */}
                <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Supplier</label>
                    <select className="w-full bg-transparent text-[10px] font-bold text-gray-900 border-none p-0 focus:ring-0" name="supplierId" required>
                        <option value="">Choose Supplier...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {/* 2. Product Search & Intelligent Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <ProductSearch callback={addProductToLines} siteId={Number(selectedSiteId)} />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                        <CheckCircle2 size={14} /> Smart Replenishment Active
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-[#F8FAFC] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100">
                            <tr>
                                <th className="p-4 min-w-[200px]">Product / Barcode</th>
                                <th className="p-2 text-center">Stock</th>
                                <th className="p-2 text-center text-emerald-600 bg-emerald-50/50">Proposed</th>
                                <th className="p-2 w-20 text-center">Qty</th>
                                <th className="p-2 w-44 text-center bg-blue-50/30">Cost (HT / TTC)</th>
                                <th className="p-2 text-center bg-emerald-50/30">Effective Cost</th>
                                <th className="p-2 w-44 text-center bg-purple-50/30">Selling (HT / TTC)</th>
                                <th className="p-2 text-center">Analysis</th>
                                <th className="p-2 w-32">Expiry</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {lines.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <ShoppingCartSkeleton />
                                            <p className="font-medium">No products selected. Search above to begin.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {lines.map((line, idx) => (
                                <tr key={line.productId} className="group hover:bg-gray-50/80 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 mb-1">{line.productName}</div>
                                        <div className="text-[10px] text-gray-400 font-mono tracking-tighter">{line.barcode || 'NO_BARCODE'}</div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={line.productId} />
                                        <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    </td>
                                    <td className="p-2 text-center font-bold text-gray-600">
                                        {line.stockLevel}
                                    </td>
                                    <td className="p-2 text-center font-black text-emerald-600 bg-emerald-50/20">
                                        {line.proposedQty}
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-center font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                                            value={line.quantity}
                                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                            name={`lines[${idx}][quantity]`}
                                        />
                                    </td>
                                    <td className="p-2 bg-blue-50/10">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 font-bold w-6">HT</span>
                                                <input
                                                    type="number" step="0.01"
                                                    className={`flex-1 bg-transparent p-1 text-[10px] border rounded ${invoicePriceType === 'HT' ? 'border-blue-200 bg-blue-50 font-bold' : 'border-gray-100'}`}
                                                    value={line.unitCostHT}
                                                    onChange={(e) => updateLine(idx, { unitCostHT: Number(e.target.value) })}
                                                    name={`lines[${idx}][unitCostHT]`}
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 font-bold w-6">TTC</span>
                                                <input
                                                    type="number" step="0.01"
                                                    className={`flex-1 bg-transparent p-1 text-[10px] border rounded ${invoicePriceType === 'TTC' ? 'border-blue-200 bg-blue-50 font-bold' : 'border-gray-100'}`}
                                                    value={line.unitCostTTC}
                                                    onChange={(e) => updateLine(idx, { unitCostTTC: Number(e.target.value) })}
                                                    name={`lines[${idx}][unitCostTTC]`}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-2 text-center bg-emerald-50/10">
                                        <div className="text-sm font-black text-emerald-700">${getEffectiveCost(line).toFixed(2)}</div>
                                        <div className="text-[8px] text-emerald-500 uppercase font-bold tracking-tighter">Basis: {pricingCostBasis === 'AUTO' ? (vatRecoverable ? 'HT' : 'TTC') : pricingCostBasis}</div>
                                    </td>
                                    <td className="p-2 bg-purple-50/10">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 font-bold w-6">HT</span>
                                                <input
                                                    type="number" step="0.01"
                                                    className={`flex-1 bg-transparent p-1 text-[10px] border rounded ${!worksInTTC ? 'border-purple-200 bg-purple-50 font-bold' : 'border-gray-100'}`}
                                                    value={line.sellingPriceHT}
                                                    onChange={(e) => updateLine(idx, { sellingPriceHT: Number(e.target.value) })}
                                                    name={`lines[${idx}][sellingPriceHT]`}
                                                />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 font-bold w-6">TTC</span>
                                                <input
                                                    type="number" step="0.01"
                                                    className={`flex-1 bg-transparent p-1 text-[10px] border rounded ${worksInTTC ? 'border-purple-200 bg-purple-50 font-bold' : 'border-gray-100'}`}
                                                    value={line.sellingPriceTTC}
                                                    onChange={(e) => updateLine(idx, { sellingPriceTTC: Number(e.target.value) })}
                                                    name={`lines[${idx}][sellingPriceTTC]`}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-2 text-center">
                                        {(() => {
                                            const { margin, markup } = getProfitAnalysis(line);
                                            return (
                                                <div className="space-y-1">
                                                    <div className={`text-[11px] font-black ${margin < 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {margin.toFixed(1)}% <span className="text-[8px] opacity-60 font-bold ml-0.5">MARG</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-gray-400">
                                                        {markup.toFixed(1)}% <span className="text-[8px] opacity-50 font-normal ml-0.5">MARK</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-2 text-center text-[10px] space-y-1">
                                        <div className="text-gray-400">Target: <span className="text-gray-900 font-bold">$0.00</span></div>
                                        <div className="text-gray-400">Last: <span className="text-gray-900 font-bold">${line.lastPrice || 'N/A'}</span></div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="date"
                                            className="w-full text-[10px] bg-transparent border border-gray-100 p-1.5 rounded focus:border-rose-300 outline-none"
                                            value={line.expiryDate}
                                            onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                                            name={`lines[${idx}][expiryDate]`}
                                        />
                                    </td>
                                    <td className="p-2 text-right font-black text-gray-900">
                                        ${(line.quantity * (invoicePriceType === 'TTC' ? line.unitCostTTC : line.unitCostHT)).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. Totals & Submission */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="flex-1 space-y-2 max-w-md">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Internal Notes / Observations</label>
                    <textarea
                        name="notes"
                        rows={3}
                        className="w-full border border-gray-100 rounded-xl p-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none"
                        placeholder="Add specific instructions for this replenishment..."
                    />
                </div>

                <div className="w-full md:w-96 bg-gray-900 text-white rounded-3xl p-6 shadow-2xl shadow-gray-200">
                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center text-gray-400 text-sm">
                            <span>Total Items</span>
                            <span className="font-bold text-white">{lines.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400 text-sm">
                            <span>Subtotal (Net)</span>
                            <span className="font-bold text-white">${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-400 text-sm">
                            <span>Tax Breakdown</span>
                            <span className="font-bold text-white">${totals.tax.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-gray-800 my-2" />
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold">Total Amount</span>
                            <span className="text-3xl font-black text-emerald-400">${totals.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isPending || lines.length === 0}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-900 font-extrabold py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group"
                    >
                        <div className="flex items-center justify-center gap-3">
                            {isPending ? 'VALIDATING ACCOUNTING...' : 'CONFIRM & POST REPLENISHMENT'}
                            <div className="p-1 bg-white/20 rounded group-hover:bg-white/40 transition-colors">
                                <Plus size={16} />
                            </div>
                        </div>
                    </button>

                    {state.message && (
                        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-xs font-bold ${state.errors ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {state.errors ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                            {state.message}
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
}

// --- Sub-Components ---

function ProductSearch({ callback, siteId }: { callback: (p: any) => void, siteId: number }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Record<string, unknown>[]>([]);
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
                className="w-full bg-transparent p-1 pl-1 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none"
                placeholder="Type name, SKU or scan barcode..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length > 1 && setOpen(true)}
            />
            {open && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {results.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                                callback(r);
                                setQuery('');
                                setOpen(false);
                            }}
                            className="w-full p-3 text-left hover:bg-emerald-50 flex items-center justify-between group transition-all"
                        >
                            <div>
                                <div className="font-bold text-sm text-gray-900 group-hover:text-emerald-700">{r.name}</div>
                                <div className="text-[10px] text-gray-400">{r.sku} ΓÇó Stock: {r.stockLevel}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-gray-700">${r.costPriceHT} HT</div>
                                <div className="text-[10px] text-emerald-500 font-bold">Suggested: +{r.proposedQty}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ShoppingCartSkeleton() {
    return (
        <div className="relative w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
            <LayoutGrid className="text-gray-200" size={32} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-100 rounded-full animate-pulse" />
        </div>
    );
}