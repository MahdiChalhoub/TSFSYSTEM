'use client';

import { useState, useEffect } from 'react';
import { createProductGroupWithVariants, updateProductGroup, VariantInput } from '@/app/actions/product-groups';
import { getBrandsByCategory } from '@/app/actions/brands';
import { Plus, Trash2, Save, Loader2, Globe, Box, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Props = {
    brands: any[];
    categories: any[];
    units: any[];
    countries: any[];
    initialGroup?: any; // For Edit Mode
};

type VariantRow = {
    id: number; // temp id or real id
    realId?: number; // DB ID if existing
    countryId: number | '';
    sku: string;
    barcode: string;
    size: number | '';
    sizeUnitId: number | '';
    costPrice: number | '';
    basePrice: number | '';
};

export function GroupedProductForm({ brands, categories, units, countries, initialGroup }: Props) {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    // Init Master State
    const [master, setMaster] = useState({
        name: initialGroup?.name || '',
        brandId: initialGroup?.brand || '',
        categoryId: initialGroup?.category || '',
        baseUnitId: initialGroup?.products?.[0]?.unit || '',
        description: initialGroup?.description || ''
    });

    // Filtered brands based on selected category
    const [filteredBrands, setFilteredBrands] = useState(brands);
    const [loadingBrands, setLoadingBrands] = useState(false);

    // Filter brands when category changes
    useEffect(() => {
        const filterBrands = async () => {
            if (!master.categoryId) {
                // No category selected - show all brands
                setFilteredBrands(brands);
                return;
            }

            setLoadingBrands(true);
            try {
                const filtered = await getBrandsByCategory(Number(master.categoryId));
                setFilteredBrands(filtered);

                // Reset brand selection if current brand is not in filtered list
                if (master.brandId && !filtered.find(b => b.id === Number(master.brandId))) {
                    setMaster(prev => ({ ...prev, brandId: '' }));
                }
            } catch (error) {
                console.error('Error filtering brands:', error);
                setFilteredBrands(brands); // Fallback to all brands
            } finally {
                setLoadingBrands(false);
            }
        };

        filterBrands();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [master.categoryId]); // Only track categoryId, not entire master or brands

    // Init Variants
    const [variants, setVariants] = useState<VariantRow[]>(
        initialGroup?.products?.map((p: any) => ({
            id: p.id,
            realId: p.id,
            countryId: p.country,
            sku: p.sku,
            barcode: p.barcode || '',
            size: Number(p.size) || '',
            sizeUnitId: p.size_unit || '',
            costPrice: Number(p.cost_price) || '',
            basePrice: Number(p.base_price) || ''
        })) || [
            { id: Date.now(), countryId: '', sku: '', barcode: '', size: '', sizeUnitId: '', costPrice: '', basePrice: '' }
        ]
    );

    const addVariant = () => {
        setVariants([...variants, {
            id: Date.now(), // temp
            countryId: '',
            sku: '',
            barcode: '',
            size: '',
            sizeUnitId: '',
            costPrice: '',
            basePrice: ''
        }]);
    };

    const removeVariant = (id: number) => {
        // If realId exists, we might need to track DELETIONS for backend?
        // For now, UI just removes from list. The update action currently doesn't delete missing ones.
        // We should just focus on Adding/Updating for now.
        setVariants(variants.filter(v => v.id !== id));
    };

    const updateVariant = (id: number, field: keyof VariantRow, value: any) => {
        setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const handleSubmit = async () => {
        setPending(true);
        if (!master.name || !master.brandId || !master.baseUnitId) {
            toast.error("Please fill master fields (Name, Brand, Unit)");
            setPending(false);
            return;
        }

        const validVariants = variants.map(v => ({
            id: v.realId, // Pass ID if exists
            countryId: Number(v.countryId),
            sku: v.sku,
            barcode: v.barcode,
            size: Number(v.size) || undefined,
            sizeUnitId: Number(v.sizeUnitId) || undefined,
            costPrice: Number(v.costPrice),
            basePrice: Number(v.basePrice)
        }));

        let result;
        if (initialGroup) {
            // Update
            result = await updateProductGroup({ message: '' }, {
                groupId: initialGroup.id,
                name: master.name,
                brandId: Number(master.brandId),
                categoryId: Number(master.categoryId) || undefined,
                description: master.description,
                baseUnitId: Number(master.baseUnitId),
                variants: validVariants
            });
        } else {
            // Create
            result = await createProductGroupWithVariants({ message: '' }, {
                name: master.name,
                brandId: Number(master.brandId),
                categoryId: Number(master.categoryId) || undefined,
                description: master.description,
                baseUnitId: Number(master.baseUnitId),
                variants: validVariants
            });
        }

        if (result.message === 'success') {
            router.push(initialGroup ? `/inventory/brands/${master.brandId}` : '/inventory');
        } else {
            toast.error(result.message);
        }
        setPending(false);
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            {/* Master Settings */}
            <div className="card-premium p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                    <Box className="text-emerald-600" /> Master Identity (Parfum / Family)
                </h3>
                <p className="text-sm text-gray-500 mb-4 px-2">Define the Category, Brand, and Product details here.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product Name - Full Width */}
                    <div className="col-span-2">
                        <label className="label">Product Family Name (e.g. Head & Shoulders Citron)</label>
                        <input
                            className="input-field"
                            placeholder="e.g. Head & Shoulders Citron"
                            value={master.name}
                            onChange={e => setMaster({ ...master, name: e.target.value })}
                        />
                    </div>

                    {/* Step 1: Category FIRST */}
                    <div className="col-span-2 md:col-span-1">
                        <label className="label">1∩╕ÅΓâú Category</label>
                        <select
                            className="input-field"
                            value={master.categoryId}
                            onChange={e => setMaster({ ...master, categoryId: e.target.value })}
                        >
                            <option value="">Select Category...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">≡ƒÆí This will filter available brands</p>
                    </div>

                    {/* Step 2: Brand SECOND (filtered by category) */}
                    <div className="col-span-2 md:col-span-1">
                        <label className="label">2∩╕ÅΓâú Brand</label>
                        <select
                            className="input-field"
                            value={master.brandId}
                            onChange={e => setMaster({ ...master, brandId: e.target.value })}
                            disabled={loadingBrands}
                        >
                            <option value="">Select Brand...</option>
                            {loadingBrands ? (
                                <option disabled>Loading brands...</option>
                            ) : filteredBrands.length === 0 ? (
                                <option disabled>No brands available for this category</option>
                            ) : (
                                filteredBrands.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} {b.short_name ? `(${b.short_name})` : ''}
                                    </option>
                                ))
                            )}
                        </select>
                        {master.categoryId && filteredBrands.length > 0 && (
                            <p className="text-xs text-emerald-600 mt-1">
                                Γ£ô Showing {filteredBrands.length} brand(s) for selected category
                            </p>
                        )}
                        {!master.categoryId && (
                            <p className="text-xs text-amber-600 mt-1">
                                ΓÜá Select a category first to filter brands
                            </p>
                        )}
                    </div>

                    {/* Step 3: Stock Unit */}
                    <div className="col-span-2 md:col-span-1">
                        <label className="label">3∩╕ÅΓâú Stock Unit (How we sell it)</label>
                        <select
                            className="input-field"
                            value={master.baseUnitId}
                            onChange={e => setMaster({ ...master, baseUnitId: e.target.value })}
                        >
                            <option value="">Select Unit...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Variants */}
            <div className="card-premium p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="text-blue-600" /> Country Variants
                    </h3>
                    <button onClick={addVariant} className="btn-secondary text-sm py-1.5">
                        <Plus size={16} /> Add Variant
                    </button>
                </div>

                <div className="space-y-4">
                    {variants.map((variant, index) => (
                        <div key={variant.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl relative group">
                            <button
                                onClick={() => removeVariant(variant.id)}
                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>

                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Origin Country</label>
                                    <select
                                        className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                        value={variant.countryId}
                                        onChange={e => updateVariant(variant.id, 'countryId', e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        {(() => {
                                            const selectedBrand = brands.find(b => String(b.id) === String(master.brandId));
                                            const filteredCountries = (selectedBrand?.countries?.length)
                                                ? countries.filter(c => selectedBrand.countries.some((bc: any) => bc.id === c.id))
                                                : countries;
                                            return filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>);
                                        })()}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">SKU</label>
                                    <input
                                        className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                        value={variant.sku}
                                        onChange={e => updateVariant(variant.id, 'sku', e.target.value)}
                                        placeholder="SKU-123"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Barcode</label>
                                    <input
                                        className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                        value={variant.barcode}
                                        onChange={e => updateVariant(variant.id, 'barcode', e.target.value)}
                                        placeholder="Scan..."
                                    />
                                </div>

                                <div className="flex gap-1">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-gray-500">Emballage / Size</label>
                                        <input
                                            type="number"
                                            className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                            value={variant.size}
                                            onChange={e => updateVariant(variant.id, 'size', e.target.value)}
                                            placeholder="300"
                                        />
                                    </div>
                                    <div className="w-16">
                                        <label className="text-[10px] uppercase font-bold text-gray-500">Unit</label>
                                        <select
                                            className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                            value={variant.sizeUnitId}
                                            onChange={e => updateVariant(variant.id, 'sizeUnitId', e.target.value)}
                                        >
                                            <option value=""></option>
                                            {units.filter(u => ['VOLUME', 'WEIGHT'].includes(u.type)).map(u =>
                                                <option key={u.id} value={u.id}>{u.short_name}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Cost $</label>
                                    <input
                                        type="number"
                                        className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                        value={variant.costPrice}
                                        onChange={e => updateVariant(variant.id, 'costPrice', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Price $</label>
                                    <input
                                        type="number"
                                        className="w-full text-sm p-2 rounded-lg border border-gray-200"
                                        value={variant.basePrice}
                                        onChange={e => updateVariant(variant.id, 'basePrice', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-200 flex justify-end gap-4 z-40 md:pl-72">
                <button
                    onClick={handleSubmit}
                    disabled={pending}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
                >
                    {pending ? <Loader2 className="animate-spin" /> : <Save />}
                    Save Product Group
                </button>
            </div>
        </div>
    );
}