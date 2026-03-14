import sys

content = """'use client';

import { useActionState, useState, useEffect } from 'react';
import { createProduct } from '../actions';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getBrandsByCategory } from '@/app/actions/inventory/brands';
import { getAttributesByCategory } from '@/app/actions/attributes';

import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';
import { PackagePlus, UploadCloud, Plus, Search, Layers, History, Percent, BarChart3, Package, AlertTriangle, Zap, Wand2, Trash2 } from 'lucide-react';

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
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createProduct, initialState);

    // Form Layout State
    const [activeTab, setActiveTab] = useState('Suppliers');
    const [productType, setProductType] = useState(initialData?.productType || 'SINGLE');
    const isCombo = productType === 'COMBO';

    // Cascading Filter States
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

    // Name Auto-rendering State
    const [emballageVal, setEmballageVal] = useState('');
    const [emballageUnitId, setEmballageUnitId] = useState('');

    // Mass Variation State
    const [variationsText, setVariationsText] = useState(initialData?.parfumName || '');
    const [variations, setVariations] = useState<{id: string, name: string, barcode: string, sku: string}[]>([]);

    // Parse variations text into actual array
    useEffect(() => {
        if (!variationsText.trim()) {
            setVariations([]);
            return;
        }
        const names = variationsText.split(',').map(n => n.trim()).filter(n => n);
        setVariations(prev => {
            return names.map(name => {
                const existing = prev.find(p => p.name.toLowerCase() === name.toLowerCase());
                return existing ? existing : { id: crypto.randomUUID(), name, barcode: '', sku: '' };
            });
        });
    }, [variationsText]);


    // Dynamic Pricing Engine
    const [pricing, setPricing] = useState({
        cost: parseFloat(initialData?.costPrice || '0') || 0,
        sell: parseFloat(initialData?.basePrice || '0') || 0,
        taxPercent: parseFloat(initialData?.taxRate || '0.11') || 0.11, // Default 11%
        included: initialData?.isTaxIncluded ?? true
    });

    const getCalculatedPrices = () => {
        const taxMultiplier = 1 + pricing.taxPercent;
        let costHT = pricing.cost;
        let costTTC = pricing.cost;
        let sellHT = pricing.sell;
        let sellTTC = pricing.sell;

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


    // Filtering logic
    useEffect(() => {
        const filterData = async () => {
            if (!selectedCategoryId) {
                setFilteredAttributes([]);
                setFilteredBrands(brands);
                return;
            }
            setLoadingBrands(true);
            try {
                const [filteredBrandList, filteredAttributeList] = await Promise.all([
                    getBrandsByCategory(selectedCategoryId),
                    getAttributesByCategory(selectedCategoryId)
                ]);
                setFilteredBrands(filteredBrandList);
                setFilteredAttributes(filteredAttributeList);
                if (selectedBrandId && !filteredBrandList.find(b => String(b.id) === selectedBrandId)) {
                    setSelectedBrandId('');
                }
            } catch (error) {
                setFilteredBrands(brands);
                setFilteredAttributes([]);
            } finally {
                setLoadingBrands(false);
            }
        };
        filterData();
    }, [selectedCategoryId]);

    // Name Auto-rendering logic
    const [autoName, setAutoName] = useState('');
    useEffect(() => {
        const categoryMatch = categories.find(c => c.id === selectedCategoryId);
        const brandMatch = brands.find(b => String(b.id) === selectedBrandId);
        const emballageUnitUrlMatch = units.find(u => String(u.id) === emballageUnitId);
        
        const componentValues: Record<string, any> = {
            category: {
                short: categoryMatch?.shortName || '',
                full: categoryMatch?.name || ''
            },
            brand: {
                short: brandMatch?.name?.substring(0,3).toUpperCase() || '',
                full: brandMatch?.name || ''
            },
            family: {
                short: variationsText.split(',')[0]?.trim() || '', // Use first variation for base name
                full: variationsText.split(',')[0]?.trim() || ''
            },
            emballage: {
                short: emballageVal && emballageUnitUrlMatch ? `${emballageVal}${emballageUnitUrlMatch.shortName || emballageUnitUrlMatch.name}` : (emballageVal || ''),
                full: emballageVal && emballageUnitUrlMatch ? `${emballageVal} ${emballageUnitUrlMatch.name}` : (emballageVal || '')
            }
        };

        const parts = namingRule.components
            .filter(c => c.enabled)
            .map(c => {
                const value = componentValues[c.id];
                return c.useShortName ? value?.short : value?.full;
            })
            .filter(Boolean);

        setAutoName(parts.join(namingRule.separator));
    }, [selectedCategoryId, selectedBrandId, variationsText, emballageVal, emballageUnitId, categories, brands, namingRule, units]);


    return (
        <form action={formAction} className="max-w-[1600px] mx-auto pb-24">
            {/* Global Errors */}
            {state.message && (
                <div className={`mb-6 p-4 rounded-xl border flex flex-col gap-2 ${state.errors ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                    <p className="font-bold text-[15px]">{state.message}</p>
                    {state.errors && Object.keys(state.errors).length > 0 && (
                        <ul className="list-disc pl-5 text-[13px] font-medium space-y-1">
                            {Object.entries(state.errors).map(([field, messages]) => (
                                <li key={field}>
                                    <span className="capitalize text-red-800">{field}:</span> {(messages as string[]).join(', ')}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* --- LEFT COLUMN: CORE DEFINITIONS --- */}
                <div className="w-full lg:w-2/3 space-y-6">
                    
                    {/* 1. Identity & Classification */}
                    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-[17px] font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Identity & Classification
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">1∩╕ÅΓâú Category <span className="text-red-500">*</span></label>
                                    <CategorySelector categories={categories} onChange={(id) => setSelectedCategoryId(id)} />
                                    <input type="hidden" name="categoryId" value={selectedCategoryId || ''} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">2∩╕ÅΓâú Brand</label>
                                    <select
                                        name="brandId"
                                        id="brand-select"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium"
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                        disabled={loadingBrands || !selectedCategoryId}
                                    >
                                        <option value="">Select Brand...</option>
                                        {filteredBrands.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">3∩╕ÅΓâú Origin Country</label>
                                    <select name="countryId" id="country-select" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium" disabled={!selectedBrandId}>
                                        <option value="">Select Country...</option>
                                        {filteredCountries.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Type <span className="text-red-500">*</span></label>
                                    <select 
                                        name="productType"
                                        value={productType}
                                        onChange={(e) => setProductType(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-bold"
                                    >
                                        <option value="SINGLE">Single (Standard Product)</option>
                                        <option value="COMBO">Combo / Bundle</option>
                                        <option value="SERVICE">Service</option>
                                        <option value="CONSUMABLE">Consumable</option>
                                        <option value="FINAL_PRODUCT">Final Product (Manufactured)</option>
                                        <option value="RAW_MATERIAL">Raw Material</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Emballage (Packaging)</label>
                                    <div className="flex gap-2">
                                        <input
                                            name="size"
                                            type="number"
                                            step="0.01"
                                            value={emballageVal}
                                            onChange={(e) => setEmballageVal(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700"
                                            placeholder="Value (e.g. 400)"
                                        />
                                        <select 
                                            name="sizeUnitId" 
                                            value={emballageUnitId}
                                            onChange={(e) => setEmballageUnitId(e.target.value)}
                                            className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none text-gray-700 font-medium shrink-0"
                                        >
                                            <option value="">Unit</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.shortName || u.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stock Unit (Accounting) <span className="text-red-500">*</span></label>
                                    <select name="unitId" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium" required>
                                        <option value="">Select Unit...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Name Generator Box */}
                            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl shadow-inner">
                                <label className="block text-[11px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Official Auto-Generated Name</label>
                                <div className="flex gap-3">
                                    <input 
                                        name="name" 
                                        type="text" 
                                        value={autoName}
                                        readOnly
                                        className="w-full bg-white border border-blue-200 rounded-lg px-4 py-2.5 text-sm outline-none text-gray-800 font-black shadow-sm" 
                                        placeholder="Name will generate here..." 
                                        required 
                                    />
                                    <input type="text" name="shortName" className="w-1/3 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-gray-400 font-medium" placeholder="Internal Short Name" />
                                </div>
                                <p className="text-[11px] text-blue-500/70 mt-1.5 font-medium flex items-center gap-1">
                                    <Wand2 className="w-3 h-3" /> Name is ruled by: {namingRule.components.filter(c => c.enabled).map(c => c.name).join(' + ')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description & Notes</label>
                                <textarea name="description" className="w-full border border-gray-200 rounded-lg p-3 min-h-[80px] text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-400 text-gray-700" placeholder="Optional details..."></textarea>
                            </div>

                        </div>
                    </div>

                    {/* 2. Mass Variations & Barcodes */}
                    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-[17px] font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Variations & Barcoding
                            </h3>
                        </div>
                        <div className="p-6">
                            
                            <div className="mb-5 relative group">
                                <label className="block text-[14px] font-bold text-gray-800 mb-1">Product Family / Variations <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md ml-2 uppercase tracking-wide">Mass Generate</span></label>
                                <p className="text-[12px] text-gray-500 font-medium mb-3">
                                    Type comma-separated names (e.g., Vanilla, Mint, Classic). This will automatically create <b>separate, fully tracked products</b> sharing all other properties!
                                </p>
                                <input 
                                    name="parfumName" 
                                    list="attributes-list" 
                                    value={variationsText}
                                    onChange={(e) => setVariationsText(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 text-gray-800 font-bold shadow-sm" 
                                    placeholder="Type variations here, separated by commas..." 
                                />
                                <datalist id="attributes-list">
                                    {filteredAttributes.map(a => <option key={a.id} value={a.name} />)}
                                </datalist>
                            </div>

                            {/* Variation Grid */}
                            {variations.length > 0 && (
                                <div className="border border-purple-100 rounded-xl overflow-hidden bg-purple-50/20 shadow-inner animate-in fade-in slide-in-from-top-2">
                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-100/50 border-b border-purple-100 text-purple-900 font-bold text-left text-[12px] uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Flavor / Variant</th>
                                                <th className="px-4 py-3 text-center">Manufacturer Barcode</th>
                                                <th className="px-4 py-3 text-center">Manufacturer SKU</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-50/50">
                                            {variations.map((v, idx) => (
                                                <tr key={v.id} className="bg-white hover:bg-purple-50/30 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-gray-800 flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px]">{idx + 1}</span>
                                                        {v.name}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white text-center font-mono placeholder:text-gray-300" 
                                                            placeholder="Scan / Type..."
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
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white text-center font-mono placeholder:text-gray-300" 
                                                            placeholder="Optional SKU"
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
                                            <tr className="bg-purple-50/50">
                                                <td colSpan={3} className="px-4 py-3 text-[11px] text-purple-600/80 font-medium text-center">
                                                    <Zap className="inline w-3 h-3 mr-1" /> Leave barcode/SKU blank to auto-generate a smart internal code. An automatic print job will be tracked for new labels!
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <input type="hidden" name="variationsData" value={JSON.stringify(variations)} />

                        </div>
                    </div>

                    {/* 3. Pricing Configuration */}
                    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-[17px] font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Pricing Structure
                            </h3>
                            <div className="flex gap-2 items-center bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                <label className="text-[11px] font-bold text-gray-600 cursor-pointer flex items-center gap-2">
                                    Prices Include Tax (TTC)
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                        checked={pricing.included}
                                        onChange={(e) => setPricing({...pricing, included: e.target.checked})} 
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                            <div className="lg:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        Base Cost {pricing.included ? '(TTC Input)' : '(HT Input)'}
                                    </span>
                                    <span className="text-[11px] font-bold text-gray-400">
                                        Effect: {pricing.included ? `${calc.costHT.toFixed(2)}$ HT` : `${calc.costTTC.toFixed(2)}$ TTC`}
                                    </span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-500 font-bold">$</span>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={pricing.cost || ''}
                                        onChange={(e) => setPricing({...pricing, cost: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-gray-800 font-bold transition-all" 
                                        placeholder="0.00" 
                                    />
                                    <input type="hidden" name="costPrice" value={pricing.cost} />
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        Selling Price <span className="text-red-500">*</span> {pricing.included ? '(TTC Input)' : '(HT Input)'}
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-600">
                                        Effect: {pricing.included ? `${calc.sellHT.toFixed(2)}$ HT` : `${calc.sellTTC.toFixed(2)}$ TTC`}
                                    </span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-2.5 text-emerald-600 font-black">$</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={pricing.sell || ''}
                                            onChange={(e) => setPricing({...pricing, sell: parseFloat(e.target.value) || 0})}
                                            className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-emerald-900 font-black h-[42px] transition-all" 
                                            placeholder="0.00" 
                                            required 
                                        />
                                        <input type="hidden" name="basePrice" value={pricing.sell} />
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg border flex flex-col justify-center items-center min-w-[80px] ${calc.marginPercent > 30 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : calc.marginPercent > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Margin</span>
                                        <span className="text-sm font-black leading-none">{calc.marginPercent.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="lg:col-span-4 rounded-xl">
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Applied Tax Rate (VAT)</label>
                                <select 
                                    name="taxRate" 
                                    value={pricing.taxPercent}
                                    onChange={(e) => setPricing({...pricing, taxPercent: parseFloat(e.target.value) || 0})}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none text-gray-700 font-medium" 
                                >
                                    <option value="0">0% (Tax Exempt)</option>
                                    <option value="0.11">11% (Standard VAT)</option>
                                    <option value="0.18">18% (Luxury Tax)</option>
                                </select>
                            </div>

                        </div>
                    </div>

                    {/* 4. Tracking & Rules */}
                    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 bg-gray-50/50">
                            <h3 className="text-[17px] font-bold text-gray-800 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Traceability & Rules
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-wrap gap-x-12 gap-y-6 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                                {[
                                    { label: 'Track Expiry/Batches', name: 'isExpiryTracked', default: initialData?.isExpiryTracked ?? false, color: 'bg-amber-500', visible: true, desc: 'Enforce expiration date entry on receipts.' },
                                    { label: 'Is For Sale (POS)', name: 'isForSale', default: true, color: 'bg-blue-500', visible: true, desc: 'Product can be sold in point of sale.' },
                                    { label: 'Is For Purchasing', name: 'isForPurchasing', default: true, color: 'bg-blue-500', visible: !isCombo, desc: 'Product can be bought via Purchase Orders.' },
                                    { label: 'Serialize Items (IMEI)', name: 'isSerialized', default: false, color: 'bg-purple-500', visible: true, desc: 'Track individual unique item IDs.' },
                                ].map((toggle, i) => toggle.visible && (
                                    <div key={i} className="flex flex-col gap-1 w-[240px]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] font-bold text-gray-800">{toggle.label}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" name={toggle.name} className="sr-only peer" defaultChecked={toggle.default} />
                                                <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:${toggle.color}`}></div>
                                            </label>
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{toggle.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- RIGHT COLUMN: SYSTEM INFORMATION (STICKY) --- */}
                <div className="w-full lg:w-1/3">
                    <div className="bg-white rounded-xl shadow-[0_2px_20px_-3px_rgba(6,81,237,0.06)] border border-gray-100 sticky top-6 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 bg-[#f8fafc]">
                            <h3 className="text-[17px] font-bold text-gray-800 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-500" />
                                System Info & Routing
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">Configure advanced flows</p>
                        </div>

                        <div className="flex border-b border-gray-100 text-[13px] font-bold text-gray-400 px-3 overflow-x-auto hide-scrollbar pt-2 gap-1 bg-white">
                            {['Packaging', 'Suppliers', 'Bundles', 'Prices', 'Stock View'].map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 py-3 whitespace-nowrap border-b-[3px] transition-colors rounded-t-lg flex-1 text-center ${activeTab === tab ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent hover:text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 h-[550px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                            
                            {activeTab === 'Packaging' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-white p-4 border border-indigo-100 rounded-xl shadow-sm text-center flex flex-col items-center">
                                        <Package className="w-8 h-8 text-indigo-200 mb-2" />
                                        <h4 className="text-[13px] font-bold text-gray-800">Unit Map & Multi-Barcodes</h4>
                                        <p className="text-[11px] text-gray-500 mt-1 max-w-[200px]">Link pieces to boxes, cartons, and pallets with unique barcodes & prices.</p>
                                    </div>

                                    <div className="space-y-3 relative before:absolute before:left-5 before:top-2 before:bottom-6 before:w-[2px] before:bg-indigo-100">
                                        {/* Base Unit Lock */}
                                        <div className="relative pl-12">
                                            <div className="absolute left-[17px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
                                                <div>
                                                    <div className="text-[12px] font-bold text-gray-800">Base Level (1x)</div>
                                                    <div className="text-[10px] text-gray-500">Core Barcode</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Add Level Button */}
                                        <div className="relative pl-12 pt-2">
                                            <div className="absolute left-[13px] top-4 w-4 h-4 rounded-full bg-white border-2 border-dashed border-indigo-300"></div>
                                            <button type="button" className="w-full text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 border border-dashed border-indigo-200 rounded-lg text-[12px] font-bold py-2 transition-all flex justify-center items-center gap-1.5 shadow-sm">
                                                <Plus className="w-3.5 h-3.5" /> Add Package Level
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Suppliers' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-white p-4 border border-gray-100 rounded-xl shadow-sm flex flex-col gap-2">
                                        <h4 className="text-[13px] font-bold text-gray-800">Primary Source</h4>
                                        <p className="text-[11px] text-gray-500">Map internal SKU to Supplier's catalog SKU.</p>
                                        <button type="button" className="text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-100 rounded-lg text-[12px] font-bold py-2 mt-2 transition-all flex justify-center items-center gap-1.5 shadow-sm">
                                            <Search className="w-3.5 h-3.5" /> Find Supplier
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Bundles' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {!isCombo ? (
                                        <div className="bg-white border border-gray-100 p-8 rounded-xl shadow-sm text-center flex flex-col items-center justify-center">
                                            <PackagePlus className="w-10 h-10 text-gray-200 mb-3" />
                                            <p className="text-[14px] text-gray-700 font-bold mb-1">Not a Combo</p>
                                            <p className="text-[11px] text-gray-400 max-w-[200px]">Set Product Type to "Combo / Bundle" on the left to start assembling.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm">
                                            <h4 className="text-[13px] font-bold text-gray-800 mb-3">Combo Blueprint</h4>
                                            <div className="relative mb-4">
                                                <input type="text" className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50" placeholder="Search product to append..." />
                                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                            </div>
                                            <div className="border border-gray-100 rounded-lg p-6 text-center text-[11px] text-gray-400 font-medium bg-gray-50/50">
                                                Empty Blueprint
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Prices' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-white p-4 border border-purple-100 rounded-xl shadow-sm flex flex-col gap-2">
                                        <h4 className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-purple-500"/> Price Groups</h4>
                                        <p className="text-[11px] text-gray-500 leading-relaxed text-justify">Assign to VIP, Wholesale, etc. You can manage this product's groups directly here.</p>
                                        <div className="h-20 flex items-center justify-center bg-gray-50 mt-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400 font-medium">Save product first</div>
                                    </div>
                                    <div className="bg-white p-4 border border-pink-100 rounded-xl shadow-sm flex flex-col gap-2">
                                        <h4 className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5"><Percent className="w-4 h-4 text-pink-500"/> Active Promos</h4>
                                        <div className="h-16 flex items-center justify-center bg-gray-50 mt-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400 font-medium">No live promos</div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Stock View' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-white p-6 border border-gray-100 rounded-xl shadow-sm text-center flex flex-col items-center">
                                        <History className="w-8 h-8 text-gray-300 mb-2" />
                                        <p className="text-[13px] text-gray-800 font-bold mb-1">No Traceability Data</p>
                                        <p className="text-[11px] text-gray-500 line-clamp-2">Save product first. Merging & Splitting batches can be done here.</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Actions Fixed Footer */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 px-8 flex justify-end gap-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                <button type="button" className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all focus:ring-4 focus:ring-gray-100 outline-none">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-[14px] font-bold hover:bg-indigo-700 shadow-[0_2px_10px_-3px_rgba(79,70,229,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 outline-none focus:ring-4 focus:ring-indigo-500/20"
                >
                    {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                    {isPending ? 'Processing...' : 'Save Product Data'}
                </button>
            </div>
        </form>
    );
}
"""

with open('/root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/products/new/advanced-form.tsx', 'w') as f:
    f.write(content)

