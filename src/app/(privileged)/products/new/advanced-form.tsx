'use client';

import { useActionState, useState, useEffect } from 'react';
import { createProduct } from '../actions';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getAttributesByCategory } from '@/app/actions/attributes';
// Phase 2: scoped picker — used to filter the variation datalist by
// the same (category × country × brand) scope the smart-form picker uses.
import { getScopedValuesForGroup } from '@/app/actions/inventory/attribute-scope';

import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';
import { PackagePlus, Plus, Search, History, Percent, BarChart3, Package, Zap, Wand2, Trash2, Truck, DollarSign, Warehouse, Lock } from 'lucide-react';
import { PackagingSuggestions } from '@/components/inventory/PackagingSuggestions';
import type { PackagingSuggestionRule } from '@/app/actions/inventory/packaging-suggestions';

interface CategoryOption {
    id: number | string;
    name?: string;
    shortName?: string;
    [key: string]: unknown;
}

interface BrandOption {
    id: number | string;
    name?: string;
    countries?: { id: number | string; [key: string]: unknown }[];
    [key: string]: unknown;
}

interface UnitOption {
    id: number | string;
    name?: string;
    shortName?: string;
    type?: string;
    code?: string;
    [key: string]: unknown;
}

interface CountryOption {
    id: number | string;
    name?: string;
    code?: string;
    [key: string]: unknown;
}

interface ProductInitialData {
    productType?: string;
    categoryId?: number;
    brandId?: number | string;
    parfumName?: string;
    costPrice?: number | string;
    basePrice?: number | string;
    taxRate?: number | string;
    isTaxIncluded?: boolean;
    isExpiryTracked?: boolean;
    minStockLevel?: number | string;
    [key: string]: unknown;
}

interface NamingComponentEntry {
    id: string;
    name?: string;
    enabled?: boolean;
    useShortName?: boolean;
    [key: string]: unknown;
}

interface PackagingLevelLite {
    id: string;
    unitId: string;
    ratio: number;
    barcode: string;
    price: number;
}

/* ─────────────────────────── Styles ─────────────────────────── */
const card = "bg-app-surface rounded-xl border border-app-border/80 overflow-hidden";
const cardHead = (accent: string) => `px-5 py-3.5 border-l-[3px] ${accent} flex items-center justify-between`;
const cardTitle = "text-[15px] font-semibold text-app-foreground tracking-[-0.01em]";
const fieldLabel = "block text-[12px] font-medium text-app-muted-foreground mb-1.5 uppercase tracking-wider";
const fieldInput = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[9px] text-[13px] focus:ring-2 focus:ring-app-info/20 focus:border-app-info/30 outline-none transition-all text-app-foreground placeholder:text-app-muted-foreground";
const fieldSelect = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[9px] text-[13px] focus:ring-2 focus:ring-app-info/20 focus:border-app-info/30 outline-none transition-all text-app-muted-foreground appearance-none";

export default function AdvancedProductForm({
 categories,
 units,
 brands,
 countries,
 namingRule,
 initialData,
}: {
 categories: CategoryOption[],
 units: UnitOption[],
 brands: BrandOption[],
 countries: CountryOption[],
 namingRule: ProductNamingRule,
 initialData?: ProductInitialData,
 worksInTTC?: boolean
}) {
 const initialState: { message: string; errors: Record<string, string[]> } = { message: '', errors: {} };
 const [state, formAction, isPending] = useActionState(createProduct, initialState);



 /* ── Layout State ── */
 const [activeTab, setActiveTab] = useState('packaging');
 const [productType, setProductType] = useState<string>(initialData?.productType || 'SINGLE');
 const isCombo = productType === 'COMBO';

 /* ── Cascading Filters ── */
 const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialData?.categoryId ?? null);
 const [selectedBrandId, setSelectedBrandId] = useState<string>(initialData?.brandId ? String(initialData.brandId) : '');
 // Phase 2: track country so the scoped picker can filter the
 // variation datalist by all three axes (category × country × brand).
 const [selectedCountryId, setSelectedCountryId] = useState<number | null>(
     (initialData as { countryId?: number })?.countryId ?? null,
 );
 const [filteredBrands, setFilteredBrands] = useState<BrandOption[]>(brands);
 const [filteredAttributes, setFilteredAttributes] = useState<ProductAttribute[]>([]);

 const filteredCountries = (() => {
 const selectedBrand = brands.find(b => String(b.id) === String(selectedBrandId));
 return (selectedBrand?.countries?.length)
 ? countries.filter(c => selectedBrand.countries!.some((bc) => bc.id === c.id))
 : countries;
 })();

 /* ── Name Auto-rendering ── */
 const [emballageVal, setEmballageVal] = useState('');
 const [emballageUnitId, setEmballageUnitId] = useState('');

 /* ── Mass Variation ── */
 const [packagingLevels, setPackagingLevels] = useState<PackagingLevelLite[]>([]);
 const [variationsText, setVariationsText] = useState(initialData?.parfumName || '');
 const [variations, setVariations] = useState<{ id: string, name: string, barcode: string, sku: string }[]>([]);

 useEffect(() => {
 if (!variationsText.trim()) { setVariations([]); return; }
 const names = variationsText.split(',').map((n: string) => n.trim()).filter((n: string) => n);
 setVariations(prev => names.map((name: string) => {
 const existing = prev.find(p => p.name.toLowerCase() === name.toLowerCase());
 return existing ? existing : { id: crypto.randomUUID(), name, barcode: '', sku: '' };
 }));
 }, [variationsText]);

 const numOrZero = (v: unknown, fallback = 0): number => {
 if (typeof v === 'number') return v;
 const n = parseFloat(String(v ?? ''));
 return isNaN(n) ? fallback : n;
 };

 /* ── Dynamic Pricing ── */
 const [pricing, setPricing] = useState({
 cost: numOrZero(initialData?.costPrice),
 sell: numOrZero(initialData?.basePrice),
 taxPercent: numOrZero(initialData?.taxRate, 0.11) || 0.11,
 included: initialData?.isTaxIncluded ?? true
 });

 const getCalculatedPrices = () => {
 const taxMultiplier = 1 + pricing.taxPercent;
 let costHT = pricing.cost, costTTC = pricing.cost, sellHT = pricing.sell, sellTTC = pricing.sell;
 if (pricing.included) {
 costHT = pricing.cost / taxMultiplier;
 sellHT = pricing.sell / taxMultiplier;
 } else {
 costTTC = pricing.cost * taxMultiplier;
 sellTTC = pricing.sell * taxMultiplier;
 }
 const marginValue = sellHT - costHT;
 const marginPercent = costHT > 0 ? (marginValue / costHT) * 100 : 0;
 return { costHT, costTTC, sellHT, sellTTC, marginValue, marginPercent };
 };
 const calc = getCalculatedPrices();

 /* ── Filtering Logic ── */
 useEffect(() => {
 const filterData = async () => {
 // Always allow selection of ALL brands so users can create the first product in a category
 setFilteredBrands(brands);

 if (!selectedCategoryId) { setFilteredAttributes([]); return; }
 try {
 const filteredAttributeList = await getAttributesByCategory(selectedCategoryId);
 setFilteredAttributes(filteredAttributeList);
 } catch { setFilteredAttributes([]); }
 };
 filterData();
 }, [selectedCategoryId, brands]);

 // Phase 2: scope-narrow the variation datalist by (category × country × brand).
 // For each attribute group offered for the category, fetch the
 // values_for_product result and union the in-scope value names. The
 // datalist below renders the intersection of category-relevant
 // attributes AND scope-allowed values, so the typeahead never
 // suggests an out-of-scope value name.
 const [scopeAllowedNames, setScopeAllowedNames] = useState<Set<string> | null>(null);
 useEffect(() => {
     // Skip when we have no scope context — datalist falls back to the
     // category-filtered attribute list (legacy behaviour).
     if (!selectedCategoryId && !selectedCountryId && !selectedBrandId) {
         setScopeAllowedNames(null);
         return;
     }
     if (filteredAttributes.length === 0) {
         setScopeAllowedNames(null);
         return;
     }
     let cancelled = false;
     const ctx = {
         categoryId: selectedCategoryId,
         countryId: selectedCountryId,
         brandId: selectedBrandId ? Number(selectedBrandId) : null,
     };
     Promise.all(
         filteredAttributes.map(a => getScopedValuesForGroup(a.id, ctx).catch(() => null))
     ).then(results => {
         if (cancelled) return;
         const names = new Set<string>();
         for (const r of results) {
             if (!r) continue;
             for (const bucket of r.buckets) for (const v of bucket.values) names.add(v.name);
         }
         setScopeAllowedNames(names.size > 0 ? names : null);
     });
     return () => { cancelled = true; };
 }, [selectedCategoryId, selectedCountryId, selectedBrandId, filteredAttributes]);

 /* ── Name Auto-rendering ── */
 const [autoName, setAutoName] = useState('');
 useEffect(() => {
 const categoryMatch = categories.find(c => c.id === selectedCategoryId);
 const brandMatch = brands.find(b => String(b.id) === selectedBrandId);
 const emballageUnitMatch = units.find(u => String(u.id) === emballageUnitId);

 const componentValues: Record<string, { short: string; full: string }> = {
 category: { short: categoryMatch?.shortName || '', full: categoryMatch?.name || '' },
 brand: { short: brandMatch?.name?.substring(0, 3).toUpperCase() || '', full: brandMatch?.name || '' },
 family: { short: variationsText.split(',')[0]?.trim() || '', full: variationsText.split(',')[0]?.trim() || '' },
 emballage: {
 short: emballageVal && emballageUnitMatch ? `${emballageVal}${emballageUnitMatch.shortName || emballageUnitMatch.name || ''}` : (emballageVal || ''),
 full: emballageVal && emballageUnitMatch ? `${emballageVal} ${emballageUnitMatch.name ?? ''}` : (emballageVal || '')
 }
 };
 const parts = (namingRule.components as NamingComponentEntry[]).filter(c => c.enabled).map(c => {
 const value = componentValues[c.id];
 return c.useShortName ? value?.short : value?.full;
 }).filter(Boolean);
 setAutoName(parts.join(namingRule.separator));
 }, [selectedCategoryId, selectedBrandId, variationsText, emballageVal, emballageUnitId, categories, brands, namingRule, units]);

 /* ── Sidebar tab config ── */
 const sidebarTabs = [
 { id: 'packaging', label: 'Packaging', icon: Package },
 { id: 'suppliers', label: 'Suppliers', icon: Truck },
 { id: 'bundles', label: 'Bundles', icon: PackagePlus },
 { id: 'prices', label: 'Prices', icon: DollarSign },
 { id: 'stock', label: 'Stock', icon: Warehouse },
 ];

 return (
 <form action={formAction} className="max-w-[1440px] mx-auto pb-24">
 {/* Global Errors */}
 {state.message && (
 <div className={`mb-5 px-4 py-3 rounded-lg border text-[13px] font-medium ${state.errors ? 'bg-app-error-bg text-app-error border-app-error' : 'bg-app-primary-light text-app-success border-app-success'}`}>
 <p className="font-semibold">{state.message}</p>
 {state.errors && Object.keys(state.errors).length > 0 && (
 <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[12px]">
 {Object.entries(state.errors).map(([field, messages]) => (
 <li key={field}><span className="font-semibold capitalize">{field}:</span> {messages.join(', ')}</li>
 ))}
 </ul>
 )}
 </div>
 )}

 <div className="flex flex-col lg:flex-row gap-5 items-start">

 {/* ═══════ LEFT COLUMN ═══════ */}
 <div className="w-full lg:w-[64%] space-y-5">

 {/* ── Card 1: Identity & Classification ── */}
 <div className={card}>
 <div className={cardHead('border-l-blue-500')}>
 <h3 className={cardTitle}>Identity & Classification</h3>
 </div>
 <div className="p-5">
 {/* Grid container for dynamic field pushing */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-5">
 {/* Category Selector inserts 1 to 3 dynamic grid cells here */}
 <CategorySelector categories={categories as unknown as Parameters<typeof CategorySelector>[0]['categories']} onChange={(id) => setSelectedCategoryId(id)} />
 <input type="hidden" name="categoryId" value={selectedCategoryId || ''} />

 <div>
 <label className={fieldLabel}>Brand</label>
 <select
 name="brandId"
 className={fieldSelect}
 value={selectedBrandId}
 onChange={(e) => setSelectedBrandId(e.target.value)}
 >
 <option value="">Select brand...</option>
 {filteredBrands.map(b => <option key={String(b.id)} value={b.id}>{b.name}</option>)}
 </select>
 </div>

 <div>
 <label className={fieldLabel}>Product Type <span className="text-app-error">*</span></label>
 <select
 name="productType"
 value={productType}
 onChange={(e) => setProductType(e.target.value)}
 className={fieldSelect + ' font-semibold'}
 >
 <option value="SINGLE">Single (Standard)</option>
 <option value="COMBO">Combo / Bundle</option>
 <option value="SERVICE">Service</option>
 <option value="CONSUMABLE">Consumable</option>
 <option value="FINAL_PRODUCT">Final Product</option>
 <option value="RAW_MATERIAL">Raw Material</option>
 </select>
 </div>

 <div>
 <label className={fieldLabel}>Origin Country</label>
 <select name="countryId" className={fieldSelect}
     value={selectedCountryId ?? ''}
     onChange={(e) => setSelectedCountryId(e.target.value ? Number(e.target.value) : null)}>
 <option value="">Select country...</option>
 {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
 </select>
 </div>

 <div>
 <label className={fieldLabel}>Stock Unit <span className="text-app-error">*</span></label>
 <select name="unitId" className={fieldSelect} required>
 <option value="">Select unit...</option>
 {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
 </select>
 </div>

 <div>
 <label className={fieldLabel}>Emballage (Packaging)</label>
 <div className="flex gap-2">
 <input
 name="size"
 type="number"
 step="0.01"
 value={emballageVal}
 onChange={(e) => setEmballageVal(e.target.value)}
 className={fieldInput}
 placeholder="Value (e.g. 400)"
 />
 <select
 name="sizeUnitId"
 value={emballageUnitId}
 onChange={(e) => setEmballageUnitId(e.target.value)}
 className="w-20 bg-app-background border border-app-border rounded-lg px-2 py-[9px] text-[12px] outline-none text-app-muted-foreground font-medium shrink-0"
 >
 <option value="">Unit</option>
 {units.map(u => <option key={u.id} value={u.id}>{u.shortName || u.name}</option>)}
 </select>
 </div>
 </div>
 </div>

 {/* Auto-Generated Name */}
 <div className="bg-app-info-soft/50 border border-app-info/60 p-4 rounded-lg">
 <div className="flex items-center gap-1.5 mb-2">
 <Wand2 className="w-3.5 h-3.5 text-app-info" />
 <span className="text-[11px] font-semibold text-app-info uppercase tracking-wider">Auto-Generated Name</span>
 </div>
 <div className="flex gap-3">
 <input
 name="name"
 type="text"
 value={autoName}
 readOnly
 className="flex-1 bg-app-surface border border-app-info rounded-lg px-3 py-2 text-[13px] outline-none text-app-foreground font-semibold shadow-sm cursor-default"
 placeholder="Name will generate as you fill fields..."
 required
 />
 <input type="text" name="shortName" className="w-[140px] bg-app-surface border border-app-border rounded-lg px-3 py-2 text-[12px] outline-none placeholder:text-app-muted-foreground font-medium" placeholder="Short name" />
 </div>
 <p className="text-[10px] text-app-info/70 mt-1.5 font-medium">
 Rule: {(namingRule.components as NamingComponentEntry[]).filter(c => c.enabled).map(c => c.name ?? '').join(` ${namingRule.separator} `)}
 </p>
 </div>

 <div>
 <label className={fieldLabel}>Description</label>
 <textarea name="description" className={fieldInput + ' min-h-[60px] resize-none'} placeholder="Optional notes about this product..." />
 </div>
 </div>
 </div>

 {/* ── Card 2: Variations & Barcoding ── */}
 <div className={card}>
 <div className={cardHead('border-l-purple-500')}>
 <h3 className={cardTitle}>Variations & Barcoding</h3>
 <span className="text-[10px] font-semibold text-app-accent bg-app-accent-bg px-2 py-1 rounded-md uppercase tracking-wide">Mass Generate</span>
 </div>
 <div className="p-5">
 <p className="text-[12px] text-app-muted-foreground mb-3 leading-relaxed">
 Type comma-separated names (e.g., Vanilla, Mint, Classic). Each creates a <span className="font-semibold text-app-muted-foreground">separate tracked product</span> sharing all other properties.
 </p>
 <input
 name="parfumName"
 list="attributes-list"
 value={variationsText}
 onChange={(e) => setVariationsText(e.target.value)}
 className={fieldInput + ' font-semibold'}
 placeholder="Type variations here, separated by commas..."
 />
 <datalist id="attributes-list">
 {filteredAttributes
     .filter(a => !scopeAllowedNames || scopeAllowedNames.has(a.name))
     .map(a => <option key={a.id} value={a.name} />)}
 </datalist>

 {/* Variation Grid */}
 {variations.length > 0 && (
 <div className="mt-4 border border-app-border rounded-lg overflow-hidden">
 <table className="w-full text-[12px]">
 <thead>
 <tr className="bg-app-background text-app-muted-foreground font-semibold uppercase tracking-wider text-left text-[10px]">
 <th className="px-4 py-2.5 w-[30%]">Variant</th>
 <th className="px-4 py-2.5">Manufacturer Barcode</th>
 <th className="px-4 py-2.5">Manufacturer SKU</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {variations.map((v, idx) => (
 <tr key={v.id} className="hover:bg-app-surface-2/50 transition-colors">
 <td className="px-4 py-2.5 font-semibold text-app-foreground flex items-center gap-2">
 <span className="w-5 h-5 rounded-full bg-app-accent-bg text-app-accent flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
 {v.name}
 </td>
 <td className="px-4 py-2">
 <input
 type="text"
 className="w-full bg-app-background border border-app-border rounded-md px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-app-accent focus:bg-app-surface font-mono placeholder:text-app-muted-foreground"
 placeholder="Scan / type..."
 value={v.barcode}
 onChange={(e) => {
 const newArr = [...variations];
 newArr[idx].barcode = e.target.value;
 setVariations(newArr);
 }}
 />
 </td>
 <td className="px-4 py-2">
 <input
 type="text"
 className="w-full bg-app-background border border-app-border rounded-md px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-app-accent focus:bg-app-surface font-mono placeholder:text-app-muted-foreground"
 placeholder="Optional"
 value={v.sku}
 onChange={(e) => {
 const newArr = [...variations];
 newArr[idx].sku = e.target.value;
 setVariations(newArr);
 }}
 />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <div className="bg-app-background px-4 py-2 text-[10px] text-app-muted-foreground font-medium flex items-center gap-1.5 border-t border-app-border">
 <Zap className="w-3 h-3 text-app-warning" /> Leave blank to auto-generate internal codes. Print tasks will be queued automatically.
 </div>
 </div>
 )}
 <input type="hidden" name="variationsData" value={JSON.stringify(variations)} />
 </div>
 </div>

 {/* ── Card 3: Pricing ── */}
 <div className={card}>
 <div className={cardHead('border-l-emerald-500')}>
 <h3 className={cardTitle}>Pricing Structure</h3>
 <label className="text-[11px] font-medium text-app-muted-foreground cursor-pointer flex items-center gap-2 bg-app-background border border-app-border px-2.5 py-1.5 rounded-lg select-none">
 <input
 type="checkbox"
 className="w-3.5 h-3.5 text-app-primary rounded border-app-border focus:ring-app-primary"
 checked={pricing.included}
 onChange={(e) => setPricing({ ...pricing, included: e.target.checked })}
 />
 Prices include tax
 </label>
 </div>
 <div className="p-5">
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className={fieldLabel}>
 Cost Price {pricing.included ? '(TTC)' : '(HT)'}
 </label>
 <div className="relative">
 <span className="absolute left-3 top-[10px] text-app-muted-foreground text-[12px] font-semibold">$</span>
 <input
 type="number" step="0.01"
 value={pricing.cost || ''}
 onChange={(e) => setPricing({ ...pricing, cost: parseFloat(e.target.value) || 0 })}
 className={fieldInput + ' pl-7 font-semibold'}
 placeholder="0.00"
 />
 <input type="hidden" name="costPrice" value={pricing.cost} />
 </div>
 <p className="text-[10px] text-app-muted-foreground mt-1 font-medium">
 {pricing.included ? `= ${calc.costHT.toFixed(2)} HT` : `= ${calc.costTTC.toFixed(2)} TTC`}
 </p>
 </div>

 <div>
 <label className={fieldLabel}>
 Selling Price <span className="text-app-error">*</span> {pricing.included ? '(TTC)' : '(HT)'}
 </label>
 <div className="relative">
 <span className="absolute left-3 top-[10px] text-app-primary text-[12px] font-bold">$</span>
 <input
 type="number" step="0.01"
 value={pricing.sell || ''}
 onChange={(e) => setPricing({ ...pricing, sell: parseFloat(e.target.value) || 0 })}
 className={fieldInput + ' pl-7 font-semibold border-app-success bg-app-primary-light/30'}
 placeholder="0.00"
 required
 />
 <input type="hidden" name="basePrice" value={pricing.sell} />
 </div>
 <p className="text-[10px] text-app-primary mt-1 font-medium">
 {pricing.included ? `= ${calc.sellHT.toFixed(2)} HT` : `= ${calc.sellTTC.toFixed(2)} TTC`}
 </p>
 </div>

 <div className="flex flex-col">
 <label className={fieldLabel}>Margin</label>
 <div className={`flex-1 rounded-lg border flex flex-col justify-center items-center ${calc.marginPercent > 30 ? 'bg-app-primary-light border-app-success text-app-success' : calc.marginPercent > 0 ? 'bg-app-info-bg border-app-info text-app-info' : 'bg-app-error-bg border-app-error text-app-error'}`}>
 <span className="text-[22px] font-bold leading-none">{calc.marginPercent.toFixed(1)}%</span>
 <span className="text-[10px] font-medium mt-0.5 opacity-70">{calc.marginValue.toFixed(2)}$ profit</span>
 </div>
 </div>
 </div>

 <div className="mt-4">
 <label className={fieldLabel}>Tax Rate (VAT)</label>
 <select
 name="taxRate"
 value={pricing.taxPercent}
 onChange={(e) => setPricing({ ...pricing, taxPercent: parseFloat(e.target.value) || 0 })}
 className={fieldSelect + ' max-w-[280px]'}
 >
 <option value="0">0% — Tax Exempt</option>
 <option value="0.11">11% — Standard VAT</option>
 <option value="0.18">18% — Luxury Tax</option>
 </select>
 </div>
 </div>
 </div>

 {/* ── Card 4: Traceability ── */}
 <div className={card}>
 <div className={cardHead('border-l-amber-400')}>
 <h3 className={cardTitle}>Traceability & Rules</h3>
 </div>
 <div className="p-5">
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { label: 'Track Expiry', name: 'isExpiryTracked', default: initialData?.isExpiryTracked ?? false, desc: 'Enforce expiration dates', visible: true },
 { label: 'Available in POS', name: 'isForSale', default: true, desc: 'Sell via point of sale', visible: true },
 { label: 'For Purchasing', name: 'isForPurchasing', default: true, desc: 'Buy via Purchase Orders', visible: !isCombo },
 { label: 'Serialize (IMEI)', name: 'isSerialized', default: false, desc: 'Track unique serial IDs', visible: true },
 ].map((toggle, i) => toggle.visible && (
 <label key={i} className="flex items-start gap-3 p-3 rounded-lg border border-app-border hover:bg-app-surface-2/50 transition-colors cursor-pointer group">
 <input type="checkbox" name={toggle.name} className="w-4 h-4 mt-0.5 text-app-info rounded border-app-border focus:ring-app-info shrink-0" defaultChecked={toggle.default} />
 <div>
 <div className="text-[12px] font-semibold text-app-foreground group-hover:text-app-info transition-colors">{toggle.label}</div>
 <div className="text-[10px] text-app-muted-foreground font-medium leading-relaxed">{toggle.desc}</div>
 </div>
 </label>
 ))}
 </div>
 </div>
 </div>

 </div>
 <div className="w-full lg:w-[36%]">
 <div className={card + ' sticky top-4'}>
 <div className="px-5 py-3.5 border-b border-app-border bg-app-surface-2/50">
 <h3 className={cardTitle}>System Configuration</h3>
 <p className="text-[11px] text-app-muted-foreground font-medium mt-0.5">Advanced routing & mappings</p>
 </div>

 {/* Icon Tabs */}
 <div className="flex border-b border-app-border bg-app-surface">
 {sidebarTabs.map(tab => (
 <button
 key={tab.id}
 type="button"
 onClick={() => setActiveTab(tab.id)}
 className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-all border-b-2 ${activeTab === tab.id ? 'border-app-info text-app-info bg-app-info-bg/30' : 'border-transparent text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-background'}`}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>

 <div className="p-4 min-h-[420px] max-h-[520px] overflow-y-auto">

 {/* ── Packaging Tab ── */}
 {activeTab === 'packaging' && (
 <div className="space-y-3">
 {/* Smart Suggestions — driven by category / brand / attributes the user has picked */}
 <PackagingSuggestions
     categoryId={selectedCategoryId}
     brandId={selectedBrandId || undefined}
     attributeId={filteredAttributes?.[0]?.id}
     onAccept={(rule: PackagingSuggestionRule) => {
         if (!rule.packaging || !rule.packaging_ratio) return;
         const pkgUnitCode = rule.packaging_unit_code;
         const matchedUnit = units.find((u) => u.code === pkgUnitCode) || units[0];
         setPackagingLevels((prev) => {
             if (prev.some((p) => Number(p.ratio) === Number(rule.packaging_ratio) && p.unitId === String(matchedUnit?.id))) {
                 return prev;
             }
             return [...prev, {
                 id: crypto.randomUUID(),
                 unitId: matchedUnit?.id ? String(matchedUnit.id) : '',
                 ratio: Number(rule.packaging_ratio),
                 barcode: '',
                 price: 0,
             }];
         });
         toast.success(`Added "${rule.packaging_name}" from smart suggestion`);
     }}
 />

 {/* Base Level */}
 <div className="flex items-center gap-3 p-3 bg-app-background rounded-lg border border-app-border">
 <div className="w-7 h-7 rounded-full bg-app-info text-app-foreground flex items-center justify-center shrink-0">
 <Lock className="w-3.5 h-3.5" />
 </div>
 <div className="flex-1">
 <div className="text-[12px] font-semibold text-app-foreground">Base Level (1x)</div>
 <div className="text-[10px] text-app-muted-foreground">Core barcode & base price</div>
 </div>
 <span className="text-[10px] font-semibold text-app-info bg-app-info-bg px-2 py-0.5 rounded">Locked</span>
 </div>

 {/* Dynamic Levels */}
 {packagingLevels.map((lvl, idx) => (
 <div key={lvl.id} className="p-3 bg-app-surface rounded-lg border border-app-border space-y-3 group relative">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-5 h-5 rounded-full bg-app-primary/10 text-app-primary flex items-center justify-center text-[10px] font-bold">{idx + 2}</div>
 <span className="text-[12px] font-semibold text-app-muted-foreground">Level {idx + 2}</span>
 </div>
 <button type="button" onClick={() => setPackagingLevels(packagingLevels.filter(x => x.id !== lvl.id))} className="text-app-muted-foreground hover:text-app-error transition-colors">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>

 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Unit</label>
 <select
 className="w-full bg-app-background border border-app-border rounded-md px-2 py-1.5 text-[11px] outline-none text-app-muted-foreground font-medium"
 value={lvl.unitId}
 onChange={(e) => { const arr = [...packagingLevels]; arr[idx].unitId = e.target.value; setPackagingLevels(arr); }}
 >
 <option value="">Select...</option>
 {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Contains (ratio)</label>
 <input type="number" className="w-full bg-app-background border border-app-border rounded-md px-2 py-1.5 text-[11px] outline-none font-semibold text-app-foreground" placeholder="e.g. 12"
 value={lvl.ratio || ''} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].ratio = parseFloat(e.target.value) || 0; setPackagingLevels(arr); }}
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Barcode</label>
 <input type="text" className="w-full bg-app-background border border-app-border rounded-md px-2 py-1.5 text-[11px] outline-none font-mono placeholder:text-app-muted-foreground" placeholder="Scan..."
 value={lvl.barcode} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].barcode = e.target.value; setPackagingLevels(arr); }}
 />
 </div>
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Sell Price</label>
 <input type="number" className="w-full bg-app-primary-light/50 border border-app-success rounded-md px-2 py-1.5 text-[11px] outline-none text-app-success font-semibold placeholder:text-app-success" placeholder="Override"
 value={lvl.price || ''} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].price = parseFloat(e.target.value) || 0; setPackagingLevels(arr); }}
 />
 </div>
 </div>
 </div>
 ))}

 <button type="button" onClick={() => setPackagingLevels([...packagingLevels, { id: crypto.randomUUID(), unitId: '', ratio: 0, barcode: '', price: 0 }])}
 className="w-full text-app-info bg-app-info-bg/50 hover:bg-app-info-bg border border-dashed border-app-info rounded-lg text-[11px] font-semibold py-2.5 transition-all flex justify-center items-center gap-1.5"
 >
 <Plus className="w-3.5 h-3.5" /> Add Package Level
 </button>
 <input type="hidden" name="packagingLevels" value={JSON.stringify(packagingLevels)} />
 </div>
 )}

 {/* ── Suppliers Tab ── */}
 {activeTab === 'suppliers' && (
 <div className="space-y-3">
 <div className="p-3 bg-app-surface rounded-lg border border-app-border space-y-3">
 <h4 className="font-semibold text-app-foreground">Primary Supplier</h4>
 <p className="text-[10px] text-app-muted-foreground leading-relaxed">Map to the supplier&apos;s catalog for perfect Purchase Orders.</p>

 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Vendor</label>
 <select name="supplierId" className="w-full bg-app-background border border-app-border rounded-md px-2.5 py-2 text-[11px] outline-none text-app-muted-foreground font-medium">
 <option value="">No supplier attached</option>
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Supplier SKU</label>
 <input name="supplierSku" type="text" className="w-full bg-app-background border border-app-border rounded-md px-2.5 py-2 text-[11px] outline-none font-mono placeholder:text-app-muted-foreground" placeholder="e.g. LOR-SHAMP-001" />
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1">Buy Price</label>
 <input type="number" name="supplierPrice" className="w-full bg-app-background border border-app-border rounded-md px-2.5 py-2 text-[11px] outline-none text-app-muted-foreground font-semibold" placeholder="0.00" />
 </div>
 <div>
 <label className="block text-[10px] font-medium text-app-info mb-1">Lead Time</label>
 <input type="number" name="supplierLeadTime" className="w-full bg-app-info-bg/50 border border-app-info rounded-md px-2.5 py-2 text-[11px] outline-none text-app-info font-semibold" placeholder="Days" />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ── Bundles Tab ── */}
 {activeTab === 'bundles' && (
 <div>
 {!isCombo ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <PackagePlus className="w-10 h-10 text-app-foreground mb-3" />
 <p className="text-[13px] text-app-muted-foreground font-semibold">Not a Combo</p>
 <p className="text-[11px] text-app-muted-foreground mt-1 max-w-[200px]">Set Product Type to &quot;Combo / Bundle&quot; to start assembling.</p>
 </div>
 ) : (
 <div className="space-y-3">
 <h4 className="font-semibold text-app-foreground">Combo Blueprint</h4>
 <div className="relative">
 <input type="text" className="w-full pl-8 pr-3 py-2 border border-app-border rounded-lg text-[11px] bg-app-background outline-none" placeholder="Search product to add..." />
 <Search className="w-3.5 h-3.5 text-app-muted-foreground absolute left-2.5 top-2.5" />
 </div>
 <div className="border border-dashed border-app-border rounded-lg py-8 text-center text-[11px] text-app-muted-foreground font-medium">Empty blueprint</div>
 </div>
 )}
 </div>
 )}

 {/* ── Prices Tab ── */}
 {activeTab === 'prices' && (
 <div className="space-y-3">
 <div className="p-3 bg-app-surface rounded-lg border border-app-border">
 <h4 className="font-semibold text-app-foreground flex items-center gap-1.5 mb-2"><BarChart3 className="w-3.5 h-3.5 text-app-accent" /> Price Groups</h4>
 <p className="text-[10px] text-app-muted-foreground mb-2">Assign to VIP, Wholesale, etc.</p>
 <div className="h-16 flex items-center justify-center bg-app-background rounded-lg border border-dashed border-app-border text-[11px] text-app-muted-foreground">Save product first</div>
 </div>
 <div className="p-3 bg-app-surface rounded-lg border border-app-border">
 <h4 className="font-semibold text-app-foreground flex items-center gap-1.5 mb-2"><Percent className="w-3.5 h-3.5 text-app-accent" /> Active Promos</h4>
 <div className="h-16 flex items-center justify-center bg-app-background rounded-lg border border-dashed border-app-border text-[11px] text-app-muted-foreground">No live promos</div>
 </div>
 </div>
 )}

 {/* ── Stock Tab ── */}
 {activeTab === 'stock' && (
 <div className="space-y-4">
 <div className="p-4 bg-app-surface rounded-lg border border-app-border">
 <h4 className="font-semibold text-app-foreground flex items-center gap-1.5 mb-3">
 <Warehouse className="w-3.5 h-3.5 text-app-warning" />
 Reorder Settings
 </h4>
 <div>
 <label className="block text-[10px] font-medium text-app-muted-foreground mb-1.5 uppercase tracking-wider">
 Minimum Stock Level (Alert)
 </label>
 <div className="relative">
 <input
 type="number"
 name="minStockLevel"
 className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[13px] outline-none font-semibold text-app-foreground"
 placeholder="e.g. 10"
 defaultValue={initialData?.minStockLevel || "10"}
 />
 </div>
 <p className="text-[10px] text-app-muted-foreground mt-2 leading-relaxed">
 The system will trigger an alert when stock drops below this value.
 </p>
 </div>
 </div>

 <div className="flex flex-col items-center justify-center py-8 text-center bg-app-surface-2/50 rounded-lg border border-dashed border-app-border">
 <History className="w-8 h-8 text-app-foreground mb-2" />
 <p className="text-[12px] text-app-muted-foreground font-semibold">No Live Stock Data</p>
 <p className="text-[10px] text-app-muted-foreground mt-1 max-w-[180px]">Batch merging & splitting available after first stock-in.</p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* ── Fixed Footer ── */}
 <div className="fixed bottom-0 left-0 right-0 z-50 bg-app-foreground/95 backdrop-blur-sm border-t border-app-border px-6 py-3 flex justify-end gap-3">
 <button type="button" className="px-5 py-2 bg-app-surface border border-app-border rounded-lg text-[13px] font-semibold text-app-muted-foreground hover:bg-app-background transition-all outline-none">
 Cancel
 </button>
 <button
 type="submit"
 disabled={isPending}
 className="px-6 py-2 bg-app-info text-app-foreground rounded-lg text-[13px] font-semibold hover:bg-app-info shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 outline-none"
 >
 {isPending && <span className="w-3.5 h-3.5 border-2 border-app-foreground/30 border-t-white rounded-full animate-spin" />}
 {isPending ? 'Saving...' : 'Save Product'}
 </button>
 </div>
 </form>
 );
}
