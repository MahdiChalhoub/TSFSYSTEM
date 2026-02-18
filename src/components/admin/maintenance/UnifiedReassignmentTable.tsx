'use client';

import { useState, useTransition, useMemo } from 'react';
import { Search, ArrowRightLeft, CheckSquare, Square, X, AlertCircle, Layers, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { moveProductsGeneric } from '@/app/actions/maintenance';
import { createGroupFromProducts } from '@/app/actions/product-groups';
import { CategoryTreeSelector } from '../CategoryTreeSelector';
import { toast } from 'sonner';

type Props = {
    products: Record<string, any>[];
    targetEntities: Record<string, any>[];
    type: 'category' | 'brand' | 'unit' | 'country' | 'attribute';
    currentEntityId: number;
};

export function UnifiedReassignmentTable({ products, targetEntities, type, currentEntityId }: Props) {
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [targetId, setTargetId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    // Convert flat entities to tree for category selector
    // NOTE: For non-category, we use flat list directly
    // Ideally we should reuse the buildTree Helper or receive tree from server if possible, 
    // but here we receive what getMaintenanceEntities returns. 
    // getMaintenanceEntities returns TREE for category, flat for others.

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSelectAll = () => {
        if (selectedProductIds.length === filteredProducts.length) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(filteredProducts.map(p => p.id));
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
        if (!targetId) return;
        startTransition(async () => {
            const result = await moveProductsGeneric(selectedProductIds, targetId, type);
            if (result.success) {
                setIsMoveModalOpen(false);
                setSelectedProductIds([]);
                setTargetId(null);
            } else {
                toast.error(result.message);
            }
        });
    };

    // Render Target Selector
    const renderTargetSelector = () => {
        if (type === 'category') {
            // targetEntities is already tree
            return (
                <div className="h-64 border rounded-xl overflow-hidden">
                    {/* Reuse existing component, ensuring types match */}
                    <CategoryTreeSelector
                        categories={targetEntities}
                        selectedIds={targetId ? [targetId] : []}
                        onChange={(ids) => setTargetId(ids[0] || null)} // Single select
                        maxHeight="h-full"
                    />
                </div>
            );
        }

        // Generic List Selector for Brand/Unit/etc
        return (
            <div className="h-64 border rounded-xl overflow-y-auto p-2">
                {targetEntities
                    .filter(e => e.id !== currentEntityId) // Don't show current bucket
                    .map(e => (
                        <div
                            key={e.id}
                            onClick={() => setTargetId(e.id)}
                            className={`p-2 rounded-lg cursor-pointer flex justify-between items-center ${targetId === e.id ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'hover:bg-gray-50'}`}
                        >
                            <span>{e.name}</span>
                            {e.code && <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">{e.code}</span>}
                        </div>
                    ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white transition-all outline-none focus:border-emerald-500"
                        />
                    </div>
                    {selectedProductIds.length > 0 && (
                        <div className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full animate-in fade-in">
                            {selectedProductIds.length} selected
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 px-4 py-2 rounded-xl font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Layers size={16} />
                        Group
                    </button>
                    <button
                        onClick={() => setIsMoveModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ArrowRightLeft size={16} />
                        Move Selected
                    </button>
                    <button onClick={toggleSelectAll} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Select All">
                        {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <p>No products found in this {type}.</p>
                    </div>
                ) : (
                    <ProductList
                        products={filteredProducts}
                        selectedProductIds={selectedProductIds}
                        toggleProduct={toggleProduct}
                    />
                )}
            </div>

            {/* Move Modal */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-lg">Move {selectedProductIds.length} Products</h3>
                            <button onClick={() => setIsMoveModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Destination {type === 'category' ? 'Category' : type.replace(/^./, c => c.toUpperCase())}</label>

                            {renderTargetSelector()}

                            {!targetId && <p className="text-xs text-amber-500 mt-2 flex items-center gap-1"><AlertCircle size={12} /> Please select a destination.</p>}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
                            <button onClick={() => setIsMoveModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium hover:bg-white">Cancel</button>
                            <button
                                onClick={handleMove}
                                disabled={!targetId || isPending}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? 'Moving...' : 'Confirm Move'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Modal */}
            <GroupModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                productIds={selectedProductIds}
                onSuccess={() => {
                    setIsGroupModalOpen(false);
                    setSelectedProductIds([]);
                }}
            />
        </div>
    );
}

function GroupModal({ isOpen, onClose, productIds, onSuccess }: Record<string, any>) {
    const [groupName, setGroupName] = useState('');
    const [isPending, startTransition] = useTransition();

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!groupName) return;
        startTransition(async () => {
            const result = await createGroupFromProducts(productIds, { name: groupName });
            if (result.success) {
                onSuccess();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">Create Group</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
                </div>

                <p className="text-sm text-gray-500">
                    Create a new Master Product (Group) for the {productIds.length} selected items.
                    All items will inherit the Brand and Category of the first item.
                </p>

                <div>
                    <label className="label">Group Name</label>
                    <input
                        className="input-field w-full"
                        placeholder="e.g. Persil Power Gel"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
                    <button
                        onClick={handleCreate}
                        disabled={!groupName || isPending}
                        className="flex-1 btn-primary justify-center"
                    >
                        {isPending ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Sub-component for Grouped List
function ProductList({ products, selectedProductIds, toggleProduct }: Record<string, any>) {
    const grouped = useMemo(() => {
        const groups: Record<string, any> = {};
        const loose: Record<string, any>[] = [];

        products.forEach((p: Record<string, any>) => {
            if (p.productGroup) {
                const gName = p.productGroup.name;
                if (!groups[gName]) groups[gName] = { id: p.productGroup.id, name: gName, items: [] };
                groups[gName].items.push(p);
            } else {
                loose.push(p);
            }
        });

        return { groups, loose };
    }, [products]);

    // Calculate totals helper
    const getStock = (p: Record<string, any>) => p.inventory?.reduce((sum: number, i: Record<string, any>) => sum + Number(i.quantity), 0) || 0;

    return (
        <div className="space-y-4">
            {/* Render Groups */}
            {Object.values(grouped.groups).map((group: Record<string, any>) => (
                <div key={group.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center group-header">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-emerald-600" />
                            <span className="font-bold text-gray-800 text-sm">{group.name}</span>
                            <span className="text-xs text-gray-400 bg-white border px-1.5 rounded-full">{group.items.length} variants</span>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {group.items.map((product: Record<string, any>) => (
                            <ProductRow
                                key={product.id}
                                product={product}
                                isSelected={selectedProductIds.includes(product.id)}
                                toggle={() => toggleProduct(product.id)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/* Render Loose Items */}
            {grouped.loose.length > 0 && (
                <div className="space-y-1">
                    {Object.keys(grouped.groups).length > 0 && (
                        <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Ungrouped Products</div>
                    )}
                    {grouped.loose.map((product: Record<string, any>) => (
                        <div key={product.id} className="bg-white border border-gray-100 rounded-xl shadow-sm">
                            <ProductRow
                                product={product}
                                isSelected={selectedProductIds.includes(product.id)}
                                toggle={() => toggleProduct(product.id)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProductRow({ product, isSelected, toggle }: Record<string, any>) {
    const stock = product.inventory?.reduce((acc: number, item: Record<string, any>) => acc + Number(item.quantity), 0) || 0;

    return (
        <div
            onClick={toggle}
            className={`
                flex items-center gap-4 p-3 cursor-pointer transition-all hover:bg-gray-50
                ${isSelected ? 'bg-emerald-50/80' : ''}
            `}
        >
            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-gray-300 bg-white'}`}>
                {isSelected && <CheckSquare size={14} />}
            </div>

            <div className="flex-1 min-w-0 flex justify-between items-center gap-4">
                <div className="min-w-0">
                    <h4 className={`font-semibold text-sm truncate ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>{product.name}</h4>
                    <div className="flex gap-2 text-xs text-gray-500 mt-0.5 items-center">
                        <span className="font-mono bg-gray-100 px-1.5 rounded text-[10px]">{product.sku}</span>
                        {product.country && (
                            <span className="flex items-center gap-1 text-gray-600">
                                ΓÇó {product.country.name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-bold ${stock > 0 ? 'text-emerald-700' : 'text-red-400'}`}>
                        {stock} <span className="text-[10px] font-normal text-gray-500">qty</span>
                    </span>
                </div>
            </div>
        </div>
    );
}