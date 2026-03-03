// @ts-nocheck
'use client';

import { useActionState } from 'react';
import { createProduct } from '../actions';
import { useState, useEffect } from 'react';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getBrandsByCategory } from '@/app/actions/inventory/brands';
import { getAttributesByCategory } from '@/app/actions/attributes';

import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';

export default function AddProductForm({
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
 // useActionState returns [state, formAction, isPending]
 const [state, formAction, isPending] = useActionState(createProduct, initialState);
 const [autoSku, setAutoSku] = useState(true);

 const generateSku = () => {
 const timestamp = Date.now().toString().slice(-6);
 return `PRD-${timestamp}`;
 };

 const [selectedBrandId, setSelectedBrandId] = useState(initialData?.brandId ? String(initialData.brandId) : '');
 const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialData?.categoryId || null);

 // Initial effect to populate form if cloning
 useEffect(() => {
 if (initialData) {
 // We might need to manually trigger some DOM updates if components are uncontrolled
 }
 }, [initialData]);

 // Filtered brands based on selected category
 const [filteredBrands, setFilteredBrands] = useState(brands);
 const [loadingBrands, setLoadingBrands] = useState(false);

 const filteredCountries = (() => {
 const selectedBrand = brands.find(b => String(b.id) === String(selectedBrandId));
 return (selectedBrand?.countries?.length)
 ? countries.filter(c => selectedBrand.countries.some((bc: Record<string, any>) => bc.id === c.id))
 : countries;
 })();

 // Category & Parfum Logic
 const [filteredAttributes, setFilteredAttributes] = useState<ProductAttribute[]>([]);

 // Filter brands and attributes when category changes
 useEffect(() => {
 const filterData = async () => {
 if (!selectedCategoryId) {
 setFilteredAttributes([]); // Or fetch all if needed, but for attributes typically filtered is better
 // For brands, we reset to all (passed via props), handled below:
 setFilteredBrands(brands);
 return;
 }

 setLoadingBrands(true);
 try {
 // Fetch both Brands and Attributes in parallel
 const [filteredBrandList, filteredAttributeList] = await Promise.all([
 getBrandsByCategory(selectedCategoryId),
 getAttributesByCategory(selectedCategoryId)
 ]);

 setFilteredBrands(filteredBrandList);
 setFilteredAttributes(filteredAttributeList);

 // Reset brand if not in filtered list
 if (selectedBrandId && !filteredBrandList.find(b => String(b.id) === selectedBrandId)) {
 setSelectedBrandId('');
 const brandSelect = document.getElementById('brand-select') as HTMLSelectElement;
 if (brandSelect) brandSelect.value = '';
 }
 } catch (error) {
 console.error('Error filtering data:', error);
 setFilteredBrands(brands); // Fallback
 setFilteredAttributes([]);
 } finally {
 setLoadingBrands(false);
 }
 };

 filterData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedCategoryId]);



 return (
 <form action={formAction} className="max-w-4xl mx-auto space-y-6">

 {/* Error Message Global */}
 {state.message && (
 <div className={`p-4 rounded-lg border flex flex-col gap-2 ${state.errors ? 'bg-app-error-bg text-app-error border-app-error' : 'bg-app-success-bg text-app-success border-app-success'}`}>
 <p className="font-semibold">{state.message}</p>
 {state.errors && Object.keys(state.errors).length > 0 && (
 <ul className="list-disc pl-5 text-sm space-y-1">
 {Object.entries(state.errors).map(([field, messages]) => (
 <li key={field}>
 <span className="font-medium capitalize">{field}:</span> {(messages as string[]).join(', ')}
 </li>
 ))}
 </ul>
 )}
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

 {/* --- Card 1: Basic Info --- */}
 <div className="card p-6 bg-app-surface rounded-xl shadow-sm border border-app-border">
 <h3 className="text-lg font-semibold mb-4 text-app-foreground">Basic Information</h3>

 <div className="space-y-4">
 {/* Step 1: Category FIRST */}
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">1∩╕ÅΓâú Category</label>
 <CategorySelector categories={categories} onChange={(id) => setSelectedCategoryId(id)} />
 <input type="hidden" name="categoryId" value={selectedCategoryId || ''} />
 <p className="text-xs text-app-muted-foreground mt-1">≡ƒÆí This will filter available brands</p>
 </div>

 {/* Step 2: Brand SECOND (filtered by category) */}
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">2∩╕ÅΓâú Brand</label>
 <select
 name="brandId"
 id="brand-select"
 className="w-full input-field"
 onChange={(e) => setSelectedBrandId(e.target.value)}
 disabled={loadingBrands}
 >
 <option value="">Select Brand...</option>
 {loadingBrands ? (
 <option disabled>Loading brands...</option>
 ) : filteredBrands.length === 0 ? (
 <option disabled>No brands available for this category</option>
 ) : (
 filteredBrands.map(b => (
 <option key={b.id} value={b.id} data-short={b.name.substring(0, 3).toUpperCase()}>
 {b.name}
 </option>
 ))
 )}
 </select>
 {selectedCategoryId && filteredBrands.length > 0 && (
 <p className="text-xs text-app-primary mt-1">
 Γ£ô Showing {filteredBrands.length} brand(s) for selected category
 </p>
 )}
 {!selectedCategoryId && (
 <p className="text-xs text-app-warning mt-1">
 ΓÜá Select a category first to filter brands
 </p>
 )}
 </div>

 {/* Step 3: Country */}
 {/* Step 3: Country */}
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">3∩╕ÅΓâú Origin Country</label>
 <select name="countryId" id="country-select" className="w-full input-field">
 <option value="">Select Country...</option>
 {filteredCountries.map(c => (
 <option key={c.id} value={c.id} data-code={c.code}>
 {c.name} ({c.code})
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Product Family (Attribute)</label>
 <div className="flex gap-2">
 <input
 list="parfums-list"
 name="parfumName"
 className="w-full input-field"
 placeholder="e.g. Citron, Vanilla, Classic..."
 autoComplete="off"
 />
 <datalist id="parfums-list">
 {filteredAttributes.map((p: Record<string, any>) => (
 <option key={p.id} value={p.name} />
 ))}
 </datalist>
 </div>
 {selectedCategoryId && filteredAttributes.length > 0 && (
 <p className="text-xs text-app-primary mt-1">
 Γ£ô Showing {filteredAttributes.length} suggestion(s) for selected category
 </p>
 )}
 <p className="text-xs text-app-muted-foreground mt-1">Products with same Brand + Family will be auto-grouped.</p>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Emballage (Packaging)</label>
 <div className="flex gap-2">
 <input
 name="size"
 type="number"
 step="0.1"
 className="w-full input-field"
 placeholder="Value (e.g. 400)"
 />
 <select name="sizeUnitId" className="w-24 input-field bg-app-background text-sm">
 <option value="">Unit</option>
 {units.map(u => <option key={u.id} value={u.id}>{u.shortName || u.name}</option>)}
 </select>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Stock Unit (Accounting)</label>
 <select name="unitId" id="unit-select" className="w-full input-field" required>
 <option value="">Select Unit...</option>
 {units.map(u => (
 <option key={u.id} value={u.id} data-short={u.shortName || u.name}>
 {u.name} ({u.type})
 </option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <div className="flex justify-between">
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Product Name</label>
 <button type="button" onClick={() => {
 // Dynamic Smart Auto-Namer using configured naming rule
 const brandSelect = document.getElementById('brand-select') as HTMLSelectElement;
 const countrySelect = document.getElementById('country-select') as HTMLSelectElement;

 // Collect all possible component values
 const componentValues: Record<string, any> = {
 category: {
 short: categories.find(c => c.id === selectedCategoryId)?.shortName || '',
 full: categories.find(c => c.id === selectedCategoryId)?.name || ''
 },
 brand: {
 short: brandSelect.options[brandSelect.selectedIndex]?.getAttribute('data-short') || '',
 full: brandSelect.options[brandSelect.selectedIndex]?.text || ''
 },
 family: {
 short: (document.getElementsByName('parfumName')[0] as HTMLInputElement).value || '',
 full: (document.getElementsByName('parfumName')[0] as HTMLInputElement).value || ''
 },
 emballage: {
 short: (() => {
 const sizeInput = document.getElementsByName('size')[0] as HTMLInputElement;
 const sizeUnitSelect = document.getElementsByName('sizeUnitId')[0] as HTMLSelectElement;
 const sizeVal = sizeInput.value;
 const sizeUnitText = sizeUnitSelect.options[sizeUnitSelect.selectedIndex]?.text || '';
 return sizeVal && sizeUnitText !== 'Unit' ? `${sizeVal}${sizeUnitText}` : (sizeVal || '');
 })(),
 full: (() => {
 const sizeInput = document.getElementsByName('size')[0] as HTMLInputElement;
 const sizeUnitSelect = document.getElementsByName('sizeUnitId')[0] as HTMLSelectElement;
 const sizeVal = sizeInput.value;
 const sizeUnitText = sizeUnitSelect.options[sizeUnitSelect.selectedIndex]?.text || '';
 return sizeVal && sizeUnitText !== 'Unit' ? `${sizeVal}${sizeUnitText}` : (sizeVal || '');
 })()
 },
 country: {
 short: countrySelect.options[countrySelect.selectedIndex]?.getAttribute('data-code') || '',
 full: countrySelect.options[countrySelect.selectedIndex]?.text || ''
 }
 };

 // Build name based on naming rule
 const parts = namingRule.components
 .filter(c => c.enabled)
 .map(c => {
 const value = componentValues[c.id];
 return c.useShortName ? value?.short : value?.full;
 })
 .filter(Boolean);

 const finalName = parts.join(namingRule.separator);
 const nameInput = document.getElementsByName('name')[0] as HTMLInputElement;
 nameInput.value = finalName;
 }} className="text-xs text-app-info font-medium hover:underline">Auto-Format</button>
 </div>
 <input name="name" type="text" className="w-full input-field" placeholder="e.g. Organic Bananas" required defaultValue={initialData?.name} />
 {state.errors?.name && <p className="text-app-error text-xs mt-1">{state.errors.name}</p>}
 </div>
 </div>
 </div>

 {/* --- Card 2: Identification --- */}
 <div className="card p-6 bg-app-surface rounded-xl shadow-sm border border-app-border">
 <h3 className="text-lg font-semibold mb-4 text-app-foreground">Identification</h3>

 <div className="space-y-4">
 <div>
 <div className="flex justify-between">
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">SKU (Stock Keeping Unit)</label>
 <button type="button" onClick={() => {
 const input = document.getElementsByName('sku')[0] as HTMLInputElement;
 input.value = generateSku();
 }} className="text-xs text-app-info font-medium">Auto-Generate</button>
 </div>
 <input name="sku" type="text" className="w-full input-field font-mono" placeholder="PRD-000123" required defaultValue={initialData?.sku} />
 {state.errors?.sku && <p className="text-app-error text-xs mt-1">{state.errors.sku}</p>}
 </div>

 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Barcode</label>
 <div className="flex gap-2">
 <input name="barcode" type="text" className="w-full input-field font-mono" placeholder="Scan barcode..." defaultValue={initialData?.barcode} />
 <button
 type="button"
 onClick={async () => {
 const btn = document.getElementById('gen-btn');
 if (btn) btn.innerText = '...';

 // Dynamic import or call action
 const { generateNewBarcodeAction } = await import('@/app/actions/barcode-settings');
 const res = await generateNewBarcodeAction();

 if (res.success && res.code) {
 const input = document.getElementsByName('barcode')[0] as HTMLInputElement;
 input.value = res.code;
 } else {
 toast.error('Failed to generate: ' + res.error);
 }
 if (btn) btn.innerText = 'Generate';
 }}
 id="gen-btn"
 className="px-3 py-2 bg-app-primary-light text-app-success rounded-lg text-sm font-semibold hover:bg-app-success/10 transition-colors"
 >
 Generate
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* --- Card 3: Pricing --- */}
 <div className="card p-6 bg-app-surface rounded-xl shadow-sm border border-app-border">
 <h3 className="text-lg font-semibold mb-4 text-app-foreground">Pricing Strategy</h3>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Cost Price {worksInTTC ? '(TTC)' : '(HT)'}</label>
 <input name="costPrice" type="number" step="0.01" className="w-full input-field" defaultValue={initialData?.costPrice || "0.00"} />
 </div>
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Selling Price {worksInTTC ? '(TTC)' : '(HT)'}</label>
 <input name="basePrice" type="number" step="0.01" className="w-full input-field font-bold text-app-success" defaultValue={initialData?.basePrice || "0.00"} />
 </div>
 </div>

 <div className="mt-4 grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Tax Rate</label>
 <select name="taxRate" className="w-full input-field" defaultValue={initialData?.taxRate || "0"}>
 <option value="0">0% (Exempt)</option>
 <option value="0.11">11% (Standard)</option>
 <option value="0.18">18% (Luxury)</option>
 </select>
 </div>
 <div className="flex items-center mt-6">
 <input type="checkbox" name="isTaxIncluded" id="taxInc" className="w-4 h-4 text-app-success rounded" defaultChecked={initialData?.isTaxIncluded ?? true} />
 <label htmlFor="taxInc" className="ml-2 text-sm text-app-muted-foreground">Tax Included in Price?</label>
 </div>
 </div>
 </div>

 {/* --- Card 4: Inventory --- */}
 <div className="card p-6 bg-app-surface rounded-xl shadow-sm border border-app-border">
 <h3 className="text-lg font-semibold mb-4 text-app-foreground">Inventory Settings</h3>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-app-muted-foreground mb-1">Min Stock Level (Alert)</label>
 <input name="minStockLevel" type="number" className="w-full input-field" defaultValue={initialData?.minStockLevel || "10"} />
 </div>

 <div className="p-3 bg-app-warning-bg rounded-lg border border-app-warning/30">
 <div className="flex items-center">
 <input type="checkbox" name="isExpiryTracked" id="exp" className="w-4 h-4 text-app-warning rounded" defaultChecked={initialData?.isExpiryTracked} />
 <label htmlFor="exp" className="ml-2 text-sm font-medium text-app-foreground">Track Expiry Dates?</label>
 </div>
 <p className="text-xs text-app-muted-foreground mt-1 ml-6">Enabling this checks dates on every receipt/transfer.</p>
 </div>
 </div>
 </div>

 </div>

 <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
 <button type="button" className="px-6 py-2 bg-app-surface border border-app-border rounded-lg text-app-muted-foreground font-medium hover:bg-app-background">Cancel</button>
 <button
 type="submit"
 disabled={isPending}
 className="px-6 py-2 bg-app-success text-app-foreground rounded-lg font-medium hover:bg-app-success shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
 >
 {isPending && <span className="w-4 h-4 border-2 border-app-text/30 border-t-white rounded-full animate-spin"></span>}
 {isPending ? 'Creating...' : 'Create Product'}
 </button>
 </div>
 </form >
 );
}