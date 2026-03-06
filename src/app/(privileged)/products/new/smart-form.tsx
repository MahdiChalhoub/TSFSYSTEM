// @ts-nocheck
'use client';

import { useActionState, useState, useEffect, useCallback } from 'react';
import { createProduct } from '../actions';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getAttributesByCategory } from '@/app/actions/attributes';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';
import {
    Package, Truck, DollarSign, Warehouse, Layers, Tags,
    Wand2, ArrowLeft, Zap, ScanBarcode, Settings2
} from 'lucide-react';
import type { ProductTypeChoice } from './wizard-step-type';
import AISuggestionsPanel, { type AISuggestions } from './ai-suggestions';
import PricingEngine from './pricing-engine';
import PackagingTree from './packaging-tree';

/* ─────────────────────────── Styles ─────────────────────────── */
const card = "bg-app-surface rounded-2xl border border-app-border/70 overflow-hidden shadow-sm";
const cardHead = (accent: string) => `px-5 py-3.5 border-l-[3px] ${accent} flex items-center justify-between bg-gradient-to-r from-app-surface to-app-background/30`;
const cardTitle = "text-[14px] font-bold text-app-foreground tracking-[-0.01em]";
const fieldLabel = "block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest";
const fieldInput = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground placeholder:text-app-muted-foreground";
const fieldSelect = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground appearance-none";

interface SmartProductFormProps {
    productType: ProductTypeChoice;
    categories: Record<string, any>[];
    units: Record<string, any>[];
    brands: Record<string, any>[];
    countries: Record<string, any>[];
    namingRule: ProductNamingRule;
    initialData?: Record<string, any>;
    worksInTTC?: boolean;
    onBack: () => void;
}

export default function SmartProductForm({
    productType,
    categories, units, brands, countries, namingRule,
    initialData, worksInTTC = true, onBack
}: SmartProductFormProps) {
    const initialState = { message: '', errors: {} as Record<string, string[]> };
    const [state, formAction, isPending] = useActionState(createProduct, initialState);

    /* ── Form State ── */
    const [productName, setProductName] = useState(initialData?.name || '');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialData?.categoryId || null);
    const [selectedBrandId, setSelectedBrandId] = useState(initialData?.brandId ? String(initialData.brandId) : '');
    const [filteredAttributes, setFilteredAttributes] = useState<ProductAttribute[]>([]);
    const [activeTab, setActiveTab] = useState('pricing');

    /* ── Pricing State ── */
    const [costPrice, setCostPrice] = useState(parseFloat(initialData?.costPrice || '0') || 0);
    const [sellPrice, setSellPrice] = useState(parseFloat(initialData?.basePrice || '0') || 0);
    const [taxPercent, setTaxPercent] = useState(parseFloat(initialData?.taxRate || '0.11') || 0.11);
    const [isTaxIncluded, setIsTaxIncluded] = useState(initialData?.isTaxIncluded ?? true);

    /* ── Packaging State ── */
    const [packagingLevels, setPackagingLevels] = useState<any[]>([]);

    /* ── Inventory State ── */
    const [stockStrategy, setStockStrategy] = useState('make_to_stock');
    const [minStock, setMinStock] = useState(initialData?.minStockLevel || 10);
    const [maxStock, setMaxStock] = useState(300);
    const [reorderPoint, setReorderPoint] = useState(80);

    /* ── Type-based visibility ── */
    const isService = productType === 'SERVICE';
    const isBundle = productType === 'COMBO';
    const isDigital = productType === 'DIGITAL';
    const showInventory = !isService && !isDigital;
    const showPackaging = !isService && !isDigital;
    const showSupplier = !isBundle && !isDigital;

    /* ── Category filtering ── */
    useEffect(() => {
        if (!selectedCategoryId) { setFilteredAttributes([]); return; }
        getAttributesByCategory(selectedCategoryId)
            .then(setFilteredAttributes)
            .catch(() => setFilteredAttributes([]));
    }, [selectedCategoryId]);

    /* ── AI Suggestion handler ── */
    const handleAISuggestions = useCallback((suggestions: AISuggestions) => {
        if (suggestions.brand) {
            const match = brands.find(b => b.name.toLowerCase().includes(suggestions.brand!.toLowerCase()));
            if (match) setSelectedBrandId(String(match.id));
        }
        if (suggestions.category) {
            const match = categories.find(c => c.name.toLowerCase().includes(suggestions.category!.toLowerCase()));
            if (match) setSelectedCategoryId(match.id);
        }
    }, [brands, categories]);

    /* ── Sidebar tabs ── */
    const sidebarTabs = [
        { id: 'pricing', label: 'Pricing', icon: DollarSign, visible: true },
        { id: 'inventory', label: 'Inventory', icon: Warehouse, visible: showInventory },
        { id: 'packaging', label: 'Packaging', icon: Package, visible: showPackaging },
        { id: 'supplier', label: 'Supplier', icon: Truck, visible: showSupplier },
    ].filter(t => t.visible);

    const typeLabels: Record<ProductTypeChoice, { label: string; accent: string }> = {
        SINGLE: { label: 'Physical Product', accent: 'from-emerald-500 to-teal-600' },
        SERVICE: { label: 'Service', accent: 'from-blue-500 to-indigo-600' },
        COMBO: { label: 'Bundle / Combo', accent: 'from-purple-500 to-fuchsia-600' },
        DIGITAL: { label: 'Digital Product', accent: 'from-amber-500 to-orange-600' },
    };

    return (
        <form action={formAction} className="max-w-[1440px] mx-auto pb-28 fade-in-up">
            {/* Hidden fields */}
            <input type="hidden" name="productType" value={productType} />
            <input type="hidden" name="categoryId" value={selectedCategoryId || ''} />
            <input type="hidden" name="brandId" value={selectedBrandId} />
            <input type="hidden" name="minStockLevel" value={minStock} />

            {/* Global Errors */}
            {state.message && (
                <div className={`mb-5 px-4 py-3 rounded-xl border text-[13px] font-medium ${state.errors && Object.keys(state.errors).length > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    <p className="font-bold">{state.message}</p>
                    {state.errors && Object.keys(state.errors).length > 0 && (
                        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[12px]">
                            {Object.entries(state.errors).map(([field, messages]) => (
                                <li key={field}><span className="font-bold capitalize">{field}:</span> {(messages as string[]).join(', ')}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Header with back button + product type badge */}
            <div className="flex items-center gap-4 mb-6">
                <button type="button" onClick={onBack} className="w-10 h-10 rounded-xl bg-app-surface border border-app-border flex items-center justify-center hover:bg-app-background transition-all group">
                    <ArrowLeft className="w-4 h-4 text-app-muted-foreground group-hover:text-app-foreground transition-colors" />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r ${typeLabels[productType].accent}`}>
                            {typeLabels[productType].label}
                        </span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-app-foreground">
                        Create <span className="text-app-primary">Product</span>
                    </h2>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-start">

                {/* ═══════ ZONE A — Product Core (Left) ═══════ */}
                <div className="w-full lg:w-[60%] space-y-5">

                    {/* Card: Identity */}
                    <div className={card}>
                        <div className={cardHead('border-l-blue-500')}>
                            <h3 className={cardTitle}>Product Identity</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Product Name with AI */}
                            <div>
                                <label className={fieldLabel}>Product Name <span className="text-app-error">*</span></label>
                                <div className="relative">
                                    <input
                                        name="name"
                                        type="text"
                                        value={productName}
                                        onChange={e => setProductName(e.target.value)}
                                        className={fieldInput + ' pr-10 font-semibold text-[15px]'}
                                        placeholder="Start typing... (e.g. Coca Cola 33cl)"
                                        required
                                    />
                                    <Wand2 className="absolute right-3 top-3 w-4 h-4 text-app-primary/40" />
                                </div>
                                {state.errors?.name && <p className="text-red-500 text-[10px] mt-1 font-medium">{state.errors.name}</p>}
                            </div>

                            {/* AI Suggestions */}
                            <AISuggestionsPanel productName={productName} onAccept={handleAISuggestions} />

                            {/* Category + Brand Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <label className={fieldLabel}>Category</label>
                                    <CategorySelector categories={categories} onChange={setSelectedCategoryId} compact />
                                </div>
                                <div>
                                    <label className={fieldLabel}>Brand</label>
                                    <select
                                        className={fieldSelect}
                                        value={selectedBrandId}
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                    >
                                        <option value="">Select brand...</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* SKU + Barcode Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className={fieldLabel}>SKU</label>
                                        <button type="button" onClick={() => {
                                            const el = document.getElementsByName('sku')[0] as HTMLInputElement;
                                            if (el) el.value = `PRD-${Date.now().toString().slice(-6)}`;
                                        }} className="text-[9px] text-app-info font-bold hover:underline">Auto-Generate</button>
                                    </div>
                                    <input name="sku" type="text" className={fieldInput + ' font-mono'} placeholder="PRD-000123" defaultValue={initialData?.sku} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className={fieldLabel}>Barcode</label>
                                        <button type="button" onClick={async () => {
                                            try {
                                                const { generateNewBarcodeAction } = await import('@/app/actions/barcode-settings');
                                                const res = await generateNewBarcodeAction();
                                                if (res.success && res.code) {
                                                    const el = document.getElementsByName('barcode')[0] as HTMLInputElement;
                                                    if (el) el.value = res.code;
                                                } else toast.error('Failed: ' + res.error);
                                            } catch { toast.error('Barcode generation failed'); }
                                        }} className="text-[9px] text-app-info font-bold hover:underline flex items-center gap-1">
                                            <ScanBarcode className="w-3 h-3" /> Generate
                                        </button>
                                    </div>
                                    <input name="barcode" type="text" className={fieldInput + ' font-mono'} placeholder="Scan barcode..." defaultValue={initialData?.barcode} />
                                </div>
                            </div>

                            {/* Unit + Emballage Row (hidden for services) */}
                            {!isService && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={fieldLabel}>Stock Unit <span className="text-app-error">*</span></label>
                                        <select name="unitId" className={fieldSelect} required>
                                            <option value="">Select unit...</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={fieldLabel}>Origin Country</label>
                                        <select name="countryId" className={fieldSelect}>
                                            <option value="">Select...</option>
                                            {countries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className={fieldLabel}>Description</label>
                                <textarea name="description" className={fieldInput + ' min-h-[60px] resize-none'} placeholder="Optional product notes..." />
                            </div>
                        </div>
                    </div>

                    {/* Card: Traceability (toggles) */}
                    <div className={card}>
                        <div className={cardHead('border-l-amber-400')}>
                            <h3 className={cardTitle}>Traceability & Rules</h3>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    { label: 'Track Expiry', name: 'isExpiryTracked', default: initialData?.isExpiryTracked ?? false, desc: 'Enforce dates', visible: showInventory },
                                    { label: 'Available in POS', name: 'isForSale', default: true, desc: 'Sell via terminal', visible: true },
                                    { label: 'For Purchasing', name: 'isForPurchasing', default: true, desc: 'Buy via PO', visible: showSupplier },
                                    { label: 'Serialize (IMEI)', name: 'isSerialized', default: false, desc: 'Track serials', visible: showInventory },
                                ].filter(t => t.visible).map((toggle, i) => (
                                    <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-app-border hover:bg-app-primary/5 transition-all cursor-pointer group">
                                        <input type="checkbox" name={toggle.name} className="w-4 h-4 mt-0.5 rounded border-app-border text-app-primary focus:ring-app-primary shrink-0" defaultChecked={toggle.default} />
                                        <div>
                                            <div className="text-[11px] font-bold text-app-foreground group-hover:text-app-primary transition-colors">{toggle.label}</div>
                                            <div className="text-[9px] text-app-muted-foreground font-medium">{toggle.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════ ZONE B — Business Config (Right) ═══════ */}
                <div className="w-full lg:w-[40%]">
                    <div className={card + ' sticky top-4'}>
                        <div className="px-5 py-3.5 border-b border-app-border bg-gradient-to-r from-app-surface to-app-background/30">
                            <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-app-muted-foreground" />
                                <h3 className={cardTitle}>Business Configuration</h3>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div className="flex border-b border-app-border bg-app-surface">
                            {sidebarTabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                      flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-all border-b-2
                      ${activeTab === tab.id
                                                ? 'border-app-primary text-app-primary bg-app-primary/5'
                                                : 'border-transparent text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'
                                            }
                    `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-5 min-h-[450px] max-h-[600px] overflow-y-auto">

                            {/* ── Pricing Tab ── */}
                            {activeTab === 'pricing' && (
                                <PricingEngine
                                    costPrice={costPrice}
                                    sellPrice={sellPrice}
                                    taxPercent={taxPercent}
                                    isTaxIncluded={isTaxIncluded}
                                    onCostChange={setCostPrice}
                                    onSellChange={setSellPrice}
                                    onTaxChange={setTaxPercent}
                                    onTaxIncludedChange={setIsTaxIncluded}
                                />
                            )}

                            {/* ── Inventory Tab ── */}
                            {activeTab === 'inventory' && (
                                <div className="space-y-5">
                                    {/* Stock Strategy */}
                                    <div>
                                        <label className={fieldLabel}>Stock Strategy</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'make_to_stock', label: 'Make to Stock', desc: 'Keep inventory on hand' },
                                                { id: 'make_to_order', label: 'Make to Order', desc: 'Produce when ordered' },
                                                { id: 'dropship', label: 'Dropship', desc: 'Ship directly from supplier' },
                                            ].map(s => (
                                                <label key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${stockStrategy === s.id ? 'border-app-primary bg-app-primary/5' : 'border-app-border hover:border-app-primary/30'}`}>
                                                    <input
                                                        type="radio"
                                                        name="stockStrategy"
                                                        value={s.id}
                                                        checked={stockStrategy === s.id}
                                                        onChange={() => setStockStrategy(s.id)}
                                                        className="mt-0.5 w-4 h-4 text-app-primary focus:ring-app-primary"
                                                    />
                                                    <div>
                                                        <span className="text-[12px] font-bold text-app-foreground">{s.label}</span>
                                                        <p className="text-[10px] text-app-muted-foreground">{s.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Replenishment Rules */}
                                    <div className="p-4 bg-app-background rounded-xl border border-app-border space-y-3">
                                        <h4 className="text-[12px] font-bold text-app-foreground flex items-center gap-1.5">
                                            <Warehouse className="w-3.5 h-3.5 text-app-warning" />
                                            Replenishment Rules
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Minimum</label>
                                                <input type="number" value={minStock} onChange={e => setMinStock(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Maximum</label>
                                                <input type="number" value={maxStock} onChange={e => setMaxStock(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Reorder Point</label>
                                                <input type="number" value={reorderPoint} onChange={e => setReorderPoint(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Lead Time (days)</label>
                                                <input type="number" name="supplierLeadTime" className={fieldInput + ' text-[12px]'} placeholder="5" />
                                            </div>
                                        </div>

                                        {/* AI Reorder Suggestion */}
                                        <div className="mt-2 p-3 rounded-lg bg-gradient-to-r from-app-primary/5 to-app-info/5 border border-app-primary/20">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Zap className="w-3 h-3 text-app-primary" />
                                                <span className="text-[10px] font-bold text-app-primary">AI Suggestion</span>
                                            </div>
                                            <p className="text-[11px] text-app-foreground font-medium">
                                                Suggested reorder: <span className="font-bold text-app-primary">{Math.round((minStock + maxStock) / 2.5)} units</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Packaging Tab ── */}
                            {activeTab === 'packaging' && (
                                <PackagingTree
                                    levels={packagingLevels}
                                    onChange={setPackagingLevels}
                                    units={units}
                                />
                            )}

                            {/* ── Supplier Tab ── */}
                            {activeTab === 'supplier' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-app-surface rounded-xl border border-app-border space-y-3">
                                        <h4 className="text-[12px] font-bold text-app-foreground flex items-center gap-1.5">
                                            <Truck className="w-3.5 h-3.5 text-blue-500" />
                                            Primary Supplier
                                        </h4>
                                        <div>
                                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Vendor</label>
                                            <select name="supplierId" className={fieldSelect}>
                                                <option value="">No supplier attached</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Supplier SKU</label>
                                            <input name="supplierSku" type="text" className={fieldInput + ' font-mono text-[12px]'} placeholder="e.g. LOR-SHAMP-001" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Buy Price</label>
                                                <input type="number" name="supplierPrice" step="0.01" className={fieldInput + ' text-[12px]'} placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-info mb-1 uppercase tracking-wider">Lead Time</label>
                                                <input type="number" name="supplierLeadTimeDays" className="w-full bg-blue-50 border border-blue-200 rounded-lg px-3 py-[10px] text-[12px] outline-none font-bold text-blue-600 placeholder:text-blue-400" placeholder="Days" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ Fixed Footer ═══════ */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-app-surface/95 backdrop-blur-sm border-t border-app-border px-6 py-3.5 flex items-center justify-between">
                <button type="button" onClick={onBack} className="px-5 py-2.5 bg-app-background border border-app-border rounded-xl text-[12px] font-bold text-app-muted-foreground hover:bg-app-surface-hover transition-all">
                    ← Back to Type
                </button>
                <div className="flex items-center gap-3">
                    <button type="button" className="px-5 py-2.5 bg-app-surface border border-app-border rounded-xl text-[12px] font-bold text-app-muted-foreground hover:bg-app-background transition-all">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-7 py-2.5 bg-gradient-to-r from-app-primary to-app-info text-white rounded-xl text-[13px] font-bold shadow-lg shadow-app-primary/20 hover:shadow-xl hover:shadow-app-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isPending ? 'Creating...' : 'Create Product'}
                    </button>
                </div>
            </div>
        </form>
    );
}
