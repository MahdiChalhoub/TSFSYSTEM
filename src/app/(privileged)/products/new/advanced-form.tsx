'use client';

import { useActionState, useState, useEffect } from 'react';
import { createProduct } from '../actions';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getBrandsByCategory } from '@/app/actions/inventory/brands';
import { getAttributesByCategory } from '@/app/actions/attributes';

import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';
import { PackagePlus, Plus, Search, History, Percent, BarChart3, Package, Zap, Wand2, Trash2, ShoppingCart, Truck, DollarSign, Warehouse, Lock, ChevronDown } from 'lucide-react';

/* ─────────────────────────── Styles ─────────────────────────── */
const card = "bg-white rounded-xl border border-gray-200/80 overflow-hidden";
const cardHead = (accent: string) => `px-5 py-3.5 border-l-[3px] ${accent} flex items-center justify-between`;
const cardTitle = "text-[15px] font-semibold text-gray-900 tracking-[-0.01em]";
const fieldLabel = "block text-[12px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider";
const fieldInput = "w-full bg-white border border-gray-200 rounded-lg px-3 py-[9px] text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-gray-800 placeholder:text-gray-300";
const fieldSelect = "w-full bg-white border border-gray-200 rounded-lg px-3 py-[9px] text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-gray-700 appearance-none";

export default function AdvancedProductForm({
    categories,
    units,
    brands,
    countries,
    namingRule,
    initialData,
    worksInTTC = true
}: {
    categories: Record<string, any>[],
    units: Record<string, any>[],
    brands: Record<string, any>[],
    countries: Record<string, any>[],
    namingRule: ProductNamingRule,
    initialData?: Record<string, any>,
    worksInTTC?: boolean
}) {
    const initialState = { message: '', errors: {} as Record<string, string[]> };
    const [state, formAction, isPending] = useActionState(createProduct, initialState);

    /* ── Debug Logs ── */
    useEffect(() => {
        console.log("Categories Data:", categories);
        console.log("Brands Data:", brands);
        console.log("Countries Data:", countries);
    }, [categories, brands, countries]);

    /* ── Layout State ── */
    const [activeTab, setActiveTab] = useState('packaging');
    const [productType, setProductType] = useState(initialData?.productType || 'SINGLE');
    const isCombo = productType === 'COMBO';

    /* ── Cascading Filters ── */
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialData?.categoryId || null);
    const [selectedBrandId, setSelectedBrandId] = useState(initialData?.brandId ? String(initialData.brandId) : '');
    const [filteredBrands, setFilteredBrands] = useState(brands);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [filteredAttributes, setFilteredAttributes] = useState<ProductAttribute[]>([]);

    const filteredCountries = (() => {
        const selectedBrand = brands.find(b => String(b.id) === String(selectedBrandId));
        return (selectedBrand?.countries?.length)
            ? countries.filter(c => selectedBrand.countries.some((bc: Record<string, any>) => bc.id === c.id))
            : countries;
    })();

    /* ── Name Auto-rendering ── */
    const [emballageVal, setEmballageVal] = useState('');
    const [emballageUnitId, setEmballageUnitId] = useState('');

    /* ── Mass Variation ── */
    const [packagingLevels, setPackagingLevels] = useState<{ id: string, unitId: string, ratio: number, barcode: string, price: number }[]>([]);
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

    /* ── Dynamic Pricing ── */
    const [pricing, setPricing] = useState({
        cost: parseFloat(initialData?.costPrice || '0') || 0,
        sell: parseFloat(initialData?.basePrice || '0') || 0,
        taxPercent: parseFloat(initialData?.taxRate || '0.11') || 0.11,
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

    /* ── Name Auto-rendering ── */
    const [autoName, setAutoName] = useState('');
    useEffect(() => {
        const categoryMatch = categories.find(c => c.id === selectedCategoryId);
        const brandMatch = brands.find(b => String(b.id) === selectedBrandId);
        const emballageUnitMatch = units.find(u => String(u.id) === emballageUnitId);

        const componentValues: Record<string, any> = {
            category: { short: categoryMatch?.shortName || '', full: categoryMatch?.name || '' },
            brand: { short: brandMatch?.name?.substring(0, 3).toUpperCase() || '', full: brandMatch?.name || '' },
            family: { short: variationsText.split(',')[0]?.trim() || '', full: variationsText.split(',')[0]?.trim() || '' },
            emballage: {
                short: emballageVal && emballageUnitMatch ? `${emballageVal}${emballageUnitMatch.shortName || emballageUnitMatch.name}` : (emballageVal || ''),
                full: emballageVal && emballageUnitMatch ? `${emballageVal} ${emballageUnitMatch.name}` : (emballageVal || '')
            }
        };
        const parts = namingRule.components.filter(c => c.enabled).map(c => {
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
                <div className={`mb-5 px-4 py-3 rounded-lg border text-[13px] font-medium ${(state as any).errors ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    <p className="font-semibold">{state.message}</p>
                    {(state as any).errors && Object.keys((state as any).errors).length > 0 && (
                        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[12px]">
                            {Object.entries((state as any).errors).map(([field, messages]) => (
                                <li key={field}><span className="font-semibold capitalize">{field}:</span> {(messages as string[]).join(', ')}</li>
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
                                <CategorySelector categories={categories as any[]} onChange={(id) => setSelectedCategoryId(id)} compact />
                                <input type="hidden" name="categoryId" value={selectedCategoryId || ''} />

                                <div>
                                    <label className={fieldLabel}>Brand</label>
                                    <select
                                        name="brandId"
                                        className={fieldSelect}
                                        value={selectedBrandId}
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                    >
                                        <option value="">Select brand...{loadingBrands ? ' (loading...)' : ''}</option>
                                        {filteredBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className={fieldLabel}>Product Type <span className="text-red-400">*</span></label>
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
                                    <select name="countryId" className={fieldSelect}>
                                        <option value="">Select country...</option>
                                        {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className={fieldLabel}>Stock Unit <span className="text-red-400">*</span></label>
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
                                            className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-[9px] text-[12px] outline-none text-gray-600 font-medium shrink-0"
                                        >
                                            <option value="">Unit</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.shortName || u.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Auto-Generated Name */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/60 p-4 rounded-lg">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Wand2 className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Auto-Generated Name</span>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        name="name"
                                        type="text"
                                        value={autoName}
                                        readOnly
                                        className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-[13px] outline-none text-gray-900 font-semibold shadow-sm cursor-default"
                                        placeholder="Name will generate as you fill fields..."
                                        required
                                    />
                                    <input type="text" name="shortName" className="w-[140px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-[12px] outline-none placeholder:text-gray-300 font-medium" placeholder="Short name" />
                                </div>
                                <p className="text-[10px] text-blue-500/70 mt-1.5 font-medium">
                                    Rule: {namingRule.components.filter(c => c.enabled).map(c => (c as any).name).join(` ${namingRule.separator} `)}
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
                            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-md uppercase tracking-wide">Mass Generate</span>
                        </div>
                        <div className="p-5">
                            <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
                                Type comma-separated names (e.g., Vanilla, Mint, Classic). Each creates a <span className="font-semibold text-gray-700">separate tracked product</span> sharing all other properties.
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
                                {filteredAttributes.map(a => <option key={a.id} value={a.name} />)}
                            </datalist>

                            {/* Variation Grid */}
                            {variations.length > 0 && (
                                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-[12px]">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-left text-[10px]">
                                                <th className="px-4 py-2.5 w-[30%]">Variant</th>
                                                <th className="px-4 py-2.5">Manufacturer Barcode</th>
                                                <th className="px-4 py-2.5">Manufacturer SKU</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {variations.map((v, idx) => (
                                                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-2.5 font-semibold text-gray-800 flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                                        {v.name}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white font-mono placeholder:text-gray-300"
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
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white font-mono placeholder:text-gray-300"
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
                                    <div className="bg-gray-50 px-4 py-2 text-[10px] text-gray-500 font-medium flex items-center gap-1.5 border-t border-gray-100">
                                        <Zap className="w-3 h-3 text-amber-500" /> Leave blank to auto-generate internal codes. Print tasks will be queued automatically.
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
                            <label className="text-[11px] font-medium text-gray-500 cursor-pointer flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg select-none">
                                <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
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
                                        <span className="absolute left-3 top-[10px] text-gray-400 text-[12px] font-semibold">$</span>
                                        <input
                                            type="number" step="0.01"
                                            value={pricing.cost || ''}
                                            onChange={(e) => setPricing({ ...pricing, cost: parseFloat(e.target.value) || 0 })}
                                            className={fieldInput + ' pl-7 font-semibold'}
                                            placeholder="0.00"
                                        />
                                        <input type="hidden" name="costPrice" value={pricing.cost} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 font-medium">
                                        {pricing.included ? `= ${calc.costHT.toFixed(2)} HT` : `= ${calc.costTTC.toFixed(2)} TTC`}
                                    </p>
                                </div>

                                <div>
                                    <label className={fieldLabel}>
                                        Selling Price <span className="text-red-400">*</span> {pricing.included ? '(TTC)' : '(HT)'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-[10px] text-emerald-600 text-[12px] font-bold">$</span>
                                        <input
                                            type="number" step="0.01"
                                            value={pricing.sell || ''}
                                            onChange={(e) => setPricing({ ...pricing, sell: parseFloat(e.target.value) || 0 })}
                                            className={fieldInput + ' pl-7 font-semibold border-emerald-200 bg-emerald-50/30'}
                                            placeholder="0.00"
                                            required
                                        />
                                        <input type="hidden" name="basePrice" value={pricing.sell} />
                                    </div>
                                    <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                                        {pricing.included ? `= ${calc.sellHT.toFixed(2)} HT` : `= ${calc.sellTTC.toFixed(2)} TTC`}
                                    </p>
                                </div>

                                <div className="flex flex-col">
                                    <label className={fieldLabel}>Margin</label>
                                    <div className={`flex-1 rounded-lg border flex flex-col justify-center items-center ${calc.marginPercent > 30 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : calc.marginPercent > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
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
                                    <label key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer group">
                                        <input type="checkbox" name={toggle.name} className="w-4 h-4 mt-0.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0" defaultChecked={toggle.default} />
                                        <div>
                                            <div className="text-[12px] font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">{toggle.label}</div>
                                            <div className="text-[10px] text-gray-400 font-medium leading-relaxed">{toggle.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
                <div className="w-full lg:w-[36%]">
                    <div className={card + ' sticky top-4'}>
                        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
                            <h3 className={cardTitle}>System Configuration</h3>
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Advanced routing & mappings</p>
                        </div>

                        {/* Icon Tabs */}
                        <div className="flex border-b border-gray-100 bg-white">
                            {sidebarTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-all border-b-2 ${activeTab === tab.id ? 'border-blue-500 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
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
                                    {/* Base Level */}
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                                            <Lock className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[12px] font-semibold text-gray-800">Base Level (1x)</div>
                                            <div className="text-[10px] text-gray-400">Core barcode & base price</div>
                                        </div>
                                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Locked</span>
                                    </div>

                                    {/* Dynamic Levels */}
                                    {packagingLevels.map((lvl, idx) => (
                                        <div key={lvl.id} className="p-3 bg-white rounded-lg border border-gray-200 space-y-3 group relative">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{idx + 2}</div>
                                                    <span className="text-[12px] font-semibold text-gray-700">Level {idx + 2}</span>
                                                </div>
                                                <button type="button" onClick={() => setPackagingLevels(packagingLevels.filter(x => x.id !== lvl.id))} className="text-gray-300 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Unit</label>
                                                    <select
                                                        className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none text-gray-700 font-medium"
                                                        value={lvl.unitId}
                                                        onChange={(e) => { const arr = [...packagingLevels]; arr[idx].unitId = e.target.value; setPackagingLevels(arr); }}
                                                    >
                                                        <option value="">Select...</option>
                                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Contains (ratio)</label>
                                                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none font-semibold text-gray-800" placeholder="e.g. 12"
                                                        value={lvl.ratio || ''} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].ratio = parseFloat(e.target.value) || 0; setPackagingLevels(arr); }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Barcode</label>
                                                    <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none font-mono placeholder:text-gray-300" placeholder="Scan..."
                                                        value={lvl.barcode} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].barcode = e.target.value; setPackagingLevels(arr); }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Sell Price</label>
                                                    <input type="number" className="w-full bg-emerald-50/50 border border-emerald-200 rounded-md px-2 py-1.5 text-[11px] outline-none text-emerald-700 font-semibold placeholder:text-emerald-300" placeholder="Override"
                                                        value={lvl.price || ''} onChange={(e) => { const arr = [...packagingLevels]; arr[idx].price = parseFloat(e.target.value) || 0; setPackagingLevels(arr); }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" onClick={() => setPackagingLevels([...packagingLevels, { id: crypto.randomUUID(), unitId: '', ratio: 0, barcode: '', price: 0 }])}
                                        className="w-full text-blue-600 bg-blue-50/50 hover:bg-blue-100 border border-dashed border-blue-200 rounded-lg text-[11px] font-semibold py-2.5 transition-all flex justify-center items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Package Level
                                    </button>
                                    <input type="hidden" name="packagingLevels" value={JSON.stringify(packagingLevels)} />
                                </div>
                            )}

                            {/* ── Suppliers Tab ── */}
                            {activeTab === 'suppliers' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-3">
                                        <h4 className="text-[12px] font-semibold text-gray-800">Primary Supplier</h4>
                                        <p className="text-[10px] text-gray-400 leading-relaxed">Map to the supplier&apos;s catalog for perfect Purchase Orders.</p>

                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-400 mb-1">Vendor</label>
                                            <select name="supplierId" className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 text-[11px] outline-none text-gray-700 font-medium">
                                                <option value="">No supplier attached</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-400 mb-1">Supplier SKU</label>
                                            <input name="supplierSku" type="text" className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 text-[11px] outline-none font-mono placeholder:text-gray-300" placeholder="e.g. LOR-SHAMP-001" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-medium text-gray-400 mb-1">Buy Price</label>
                                                <input type="number" name="supplierPrice" className="w-full bg-gray-50 border border-gray-200 rounded-md px-2.5 py-2 text-[11px] outline-none text-gray-700 font-semibold" placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-medium text-blue-400 mb-1">Lead Time</label>
                                                <input type="number" name="supplierLeadTime" className="w-full bg-blue-50/50 border border-blue-200 rounded-md px-2.5 py-2 text-[11px] outline-none text-blue-700 font-semibold" placeholder="Days" />
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
                                            <PackagePlus className="w-10 h-10 text-gray-200 mb-3" />
                                            <p className="text-[13px] text-gray-600 font-semibold">Not a Combo</p>
                                            <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">Set Product Type to &quot;Combo / Bundle&quot; to start assembling.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <h4 className="text-[12px] font-semibold text-gray-800">Combo Blueprint</h4>
                                            <div className="relative">
                                                <input type="text" className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 outline-none" placeholder="Search product to add..." />
                                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                            </div>
                                            <div className="border border-dashed border-gray-200 rounded-lg py-8 text-center text-[11px] text-gray-400 font-medium">Empty blueprint</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Prices Tab ── */}
                            {activeTab === 'prices' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                                        <h4 className="text-[12px] font-semibold text-gray-800 flex items-center gap-1.5 mb-2"><BarChart3 className="w-3.5 h-3.5 text-purple-500" /> Price Groups</h4>
                                        <p className="text-[10px] text-gray-400 mb-2">Assign to VIP, Wholesale, etc.</p>
                                        <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400">Save product first</div>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                                        <h4 className="text-[12px] font-semibold text-gray-800 flex items-center gap-1.5 mb-2"><Percent className="w-3.5 h-3.5 text-pink-500" /> Active Promos</h4>
                                        <div className="h-16 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400">No live promos</div>
                                    </div>
                                </div>
                            )}

                            {/* ── Stock Tab ── */}
                            {activeTab === 'stock' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                                        <h4 className="text-[12px] font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                                            <Warehouse className="w-3.5 h-3.5 text-amber-500" />
                                            Reorder Settings
                                        </h4>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                                                Minimum Stock Level (Alert)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    name="minStockLevel"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none font-semibold text-gray-800"
                                                    placeholder="e.g. 10"
                                                    defaultValue={initialData?.minStockLevel || "10"}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                                                The system will trigger an alert when stock drops below this value.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                        <History className="w-8 h-8 text-gray-200 mb-2" />
                                        <p className="text-[12px] text-gray-600 font-semibold">No Live Stock Data</p>
                                        <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Batch merging & splitting available after first stock-in.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Fixed Footer ── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-3 flex justify-end gap-3">
                <button type="button" className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-all outline-none">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 outline-none"
                >
                    {isPending && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {isPending ? 'Saving...' : 'Save Product'}
                </button>
            </div>
        </form>
    );
}
