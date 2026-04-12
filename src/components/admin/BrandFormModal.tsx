'use client';

import { useActionState } from 'react';
import { createBrand, updateBrand, BrandState } from '@/app/actions/brands';
import { X, Save, Loader2, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryTreeSelector } from './CategoryTreeSelector';

type BrandFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    brand?: Record<string, any>; // If provided, edit mode
    countries: Record<string, any>[];
    categories: Record<string, any>[]; // NEW: Categories for linking
};

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    children?: CategoryNode[];
    code?: string;
};

// Helper to build tree from flat list
function buildCategoryTree(flatCategories: Record<string, any>[]): CategoryNode[] {
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: Create all nodes
    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parentId: cat.parent,
            code: cat.code,
            children: []
        });
    });

    // Second pass: Build tree structure
    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parent === null || cat.parent === undefined) {
            roots.push(node);
        } else {
            const parent = categoryMap.get(cat.parent);
            if (parent) {
                parent.children!.push(node);
            }
        }
    });

    return roots;
}

const initialState: BrandState = { message: '', errors: {} };

export function BrandFormModal({ isOpen, onClose, brand, countries, categories }: BrandFormModalProps) {
    const [state, formAction] = useActionState(brand ? updateBrand.bind(null, brand.id) : createBrand, initialState);
    const [pending, setPending] = useState(false);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
        brand?.categories?.map((c: Record<string, any>) => c.id) || []
    );

    // Reset selected categories when brand changes (for edit mode)
    useEffect(() => {
        if (isOpen) {
            setSelectedCategoryIds(brand?.categories?.map((c: Record<string, any>) => c.id) || []);
            setPending(false); // Reset pending state when opening
        }
    }, [isOpen, brand]);

    // Close modal on successful save
    useEffect(() => {
        if (state.message === 'success') {
            onClose();
            setPending(false); // Reset pending state after success
        }
    }, [state.message, onClose]); // Only track state.message, not entire state

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900">
                        {brand ? 'Edit Brand' : 'Add New Brand'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form
                    action={formAction}
                    className="p-6 space-y-4"
                    onSubmit={() => setPending(true)}
                >

                    {state.message && state.message !== 'success' && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {state.message}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Brand Name</label>
                            <input
                                name="name"
                                defaultValue={brand?.name || ''}
                                placeholder="e.g. Nestle"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Short Name</label>
                            <input
                                name="shortName"
                                defaultValue={brand?.short_name || ''}
                                placeholder="e.g. NES"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <Globe size={12} /> Operating Countries
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
                            {countries.map(c => {
                                const isChecked = brand?.countries?.some((bc: Record<string, any>) => bc.id === c.id);
                                return (
                                    <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            name="countryIds"
                                            value={c.id}
                                            defaultChecked={isChecked}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-700">{c.name} ({c.code})</span>
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-400">Select all countries where this brand is available.</p>
                    </div>

                    {/* NEW: Category Selection Tree */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Linked Categories
                        </label>

                        <CategoryTreeSelector
                            categories={buildCategoryTree(categories) as any}
                            selectedIds={selectedCategoryIds}
                            onChange={setSelectedCategoryIds}
                            maxHeight="max-h-56"
                        />

                        {/* Hidden inputs for form submission */}
                        {selectedCategoryIds.map(id => (
                            <input key={id} type="hidden" name="categoryIds" value={id} />
                        ))}

                        <p className="text-[10px] text-gray-400">
                            ≡ƒÆí Leave empty to make this brand <strong>universal</strong> (available for ALL categories).
                            <br />
                            Select parent category to include all sub-categories automatically.
                        </p>
                    </div>

                    {/* Logo URL (Optional) - Could be file upload later */}

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2">
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>Save Brand</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}