'use client';

import { useActionState } from 'react';
import { createCategory, updateCategory, CategoryState } from '@/app/actions/categories';
import { X, Save, Loader2, FolderTree, AlertCircle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { CategoryCascader } from './CategoryCascader';

type CategoryFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    category?: Record<string, any>; // If provided, it's edit mode
    parentId?: number | null; // For adding children directly
    potentialParents?: Record<string, any>[]; // For generic creation
};

const initialState: CategoryState = { message: '', errors: {} };

export function CategoryFormModal({ isOpen, onClose, category, parentId, potentialParents = [] }: CategoryFormModalProps) {
    const [state, formAction] = useActionState(category ? updateCategory.bind(null, category.id) : createCategory, initialState);
    const [pending, setPending] = useState(false);

    // Filter available parents to avoid loops
    // 1. Cannot be itself
    // 2. Cannot be one of its own descendants
    const getDescendants = (id: number, allCats: Record<string, any>[]) => {
        const descendants = new Set<number>();
        const stack = [id];
        while (stack.length > 0) {
            const current = stack.pop()!;
            const children = allCats.filter(c => c.parent === current);
            children.forEach(c => {
                descendants.add(c.id);
                stack.push(c.id);
            });
        }
        return descendants;
    };

    // Memos
    const descendants = useMemo(() => {
        if (!category) return new Set();
        return getDescendants(category.id, potentialParents);
    }, [category, potentialParents]);

    const availableParents = useMemo(() => {
        return potentialParents.filter(p =>
            (!category || p.id !== category.id) &&
            !descendants.has(p.id)
        );
    }, [potentialParents, category, descendants]);

    const [isSubCategory, setIsSubCategory] = useState(!!parentId || (category && !!category.parent));
    const [selectedParent, setSelectedParent] = useState<number | string>(parentId || category?.parent || '');

    useEffect(() => {
        if (state.message === 'success') {
            onClose();
        }
    }, [state, onClose]);

    useEffect(() => {
        if (isOpen) {
            setIsSubCategory(!!parentId || (category && !!category.parent));
            setSelectedParent(parentId || category?.parent || '');
        }
    }, [isOpen, parentId, category]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <FolderTree size={20} className="text-emerald-500" />
                        {category ? 'Edit Category' : 'Create Category'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }} className="p-6 space-y-4">

                    {/* General Error Message */}
                    {state.message && state.message !== 'success' && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-in slide-in-from-top-1">
                            <AlertCircle size={16} />
                            {state.message}
                        </div>
                    )}

                    {/* Category Type Toggle */}
                    {!parentId && (
                        <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => setIsSubCategory(false)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isSubCategory ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Main Category
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSubCategory(true)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isSubCategory ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Sub-Category
                            </button>
                        </div>
                    )}

                    {/* Parent Selector (Cascading) */}
                    {isSubCategory && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <CategoryCascader
                                allCategories={availableParents as any}
                                selectedId={typeof selectedParent === 'number' ? selectedParent : parseInt(selectedParent as string) || null}
                                onSelect={(id) => setSelectedParent(id || '')}
                                excludeId={category?.id}
                            />
                            {/* Hidden input to submit the value in the form data */}
                            <input type="hidden" name="parentId" value={selectedParent} />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category Name</label>
                            <input
                                name="name"
                                defaultValue={category?.name || ''}
                                placeholder="e.g. Beverages"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                required
                            />
                            {state.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Short Name</label>
                            <input
                                name="shortName"
                                defaultValue={category?.short_name || ''}
                                placeholder="e.g. BEV"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Code (Unique)</label>
                        <input
                            name="code"
                            defaultValue={category?.code || ''}
                            placeholder="e.g. 1001 or CAT-BEV"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-mono"
                        />
                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                            <span>Used for barcode generation.</span>
                            {selectedParent && potentialParents.find(p => p.id == selectedParent)?.code && (
                                <span className="text-emerald-600 font-medium">
                                    Parent Code: {potentialParents.find(p => p.id == selectedParent)?.code}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2">
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>Save Category</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}