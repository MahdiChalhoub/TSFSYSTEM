'use client';

import { useState } from 'react';
import { ArrowRightLeft, CheckSquare, Square, Save, Loader2 } from 'lucide-react';
import { CategoryTreeSelector } from './CategoryTreeSelector';
import { moveProducts } from '@/app/actions/categories';

type Props = {
    products: any[];
    categories: any[]; // For the target selector
    currentCategoryId: number; // To disable current category in target selector (optional)
};

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    code?: string;
};

// Helper (duplicated for client simplicity, could export shared)
function buildCategoryTree(flatCategories: any[]): CategoryNode[] {
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
    });

    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parent && categoryMap.has(cat.parent)) {
            categoryMap.get(cat.parent)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

export function ProductReassignmentTable({ products, categories, currentCategoryId }: Props) {
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [targetCategoryId, setTargetCategoryId] = useState<number[]>([]); // Array because selector returns array
    const [pending, setPending] = useState(false);

    const allSelected = products.length > 0 && selectedProductIds.length === products.length;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(products.map(p => p.id));
        }
    };

    const toggleProduct = (id: number) => {
        if (selectedProductIds.includes(id)) {
            setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
        } else {
            setSelectedProductIds([...selectedProductIds, id]);
        }
    };

    const handleMove = async () => {
        if (targetCategoryId.length === 0) return;
        // Take the last selected category as the target (single-select enforced in onChange)
        const effectiveTargetId = targetCategoryId[targetCategoryId.length - 1];

        setPending(true);
        const res = await moveProducts(selectedProductIds, effectiveTargetId);
        setPending(false);

        if (res.success) {
            setSelectedProductIds([]);
            setIsMoveModalOpen(false);
            setTargetCategoryId([]);
        } else {
            alert('Failed to move products');
        }
    };

    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-12">
                <p>No products in this category.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                    >
                        {allSelected ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
                        Select All
                    </button>
                    <span className="text-xs text-gray-400 border-l pl-4 border-gray-200">
                        {selectedProductIds.length} selected
                    </span>
                </div>

                <button
                    disabled={selectedProductIds.length === 0}
                    onClick={() => setIsMoveModalOpen(true)}
                    className="bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                    <ArrowRightLeft size={16} />
                    Move Selected
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                    {products.map(product => (
                        <div
                            key={product.id}
                            onClick={() => toggleProduct(product.id)}
                            className={`
                                cursor-pointer border rounded-xl p-3 flex items-center gap-4 transition-all
                                ${selectedProductIds.includes(product.id)
                                    ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/20'
                                    : 'bg-white border-gray-100 hover:border-emerald-200 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className="text-gray-400">
                                {selectedProductIds.includes(product.id)
                                    ? <CheckSquare size={20} className="text-emerald-500" />
                                    : <Square size={20} />
                                }
                            </div>

                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">
                                IMG
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                                <div className="text-xs text-gray-500 flex gap-2">
                                    {product.brand_name && <span className="bg-gray-100 px-1.5 rounded">{product.brand_name}</span>}
                                    {product.unit_name && <span className="text-gray-400">{product.unit_name}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Move Modal */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-lg text-gray-900">Move {selectedProductIds.length} Products</h3>
                            <p className="text-xs text-gray-500">Select the destination category.</p>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <CategoryTreeSelector
                                categories={buildCategoryTree(categories)}
                                selectedIds={targetCategoryId}
                                onChange={(ids) => {
                                    // Enforce single-select: keep only the latest selected
                                    if (ids.length > 0) {
                                        setTargetCategoryId([ids[ids.length - 1]]);
                                    } else {
                                        setTargetCategoryId([]);
                                    }
                                }}
                            />
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsMoveModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMove}
                                disabled={pending || targetCategoryId.length === 0}
                                className="bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
                            >
                                {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Confirm Move
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
