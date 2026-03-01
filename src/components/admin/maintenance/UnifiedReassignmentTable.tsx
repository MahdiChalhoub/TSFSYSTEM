'use client';

import { useState, useTransition, useMemo } from 'react';
import { Search, ArrowRightLeft, CheckSquare, Square, X, AlertCircle, Layers, ChevronRight, ChevronDown, Package, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
        <div className="flex flex-col h-full bg-slate-50/30">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-6 bg-white/70 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-lg group">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Identify products for re-mapping..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                        />
                    </div>
                    {selectedProductIds.length > 0 && (
                        <div className="h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm shadow-emerald-200/20 animate-in zoom-in duration-300">
                            <CheckSquare size={14} />
                            {selectedProductIds.length} Nodes Selected
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="h-12 px-6 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 font-black text-[10px] uppercase tracking-widest shadow-sm flex items-center gap-2 disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95"
                    >
                        <Layers size={16} />
                        Register Group
                    </button>
                    <button
                        onClick={() => setIsMoveModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-700/20 flex items-center gap-2 disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 border-b-4 border-b-emerald-800"
                    >
                        <ArrowRightLeft size={16} />
                        Execute Re-Map
                    </button>
                    <button
                        onClick={toggleSelectAll}
                        className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                        title="Select All"
                    >
                        {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length ? <CheckSquare size={22} className="text-emerald-500" /> : <Square size={22} />}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-premium">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-20">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-6">
                            <Search size={32} />
                        </div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching infrastructure detected</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Adjust your search parameters for this {type}.</p>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4 animate-in fade-in duration-500">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.4)] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 transition-all scale-in duration-500">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex flex-col">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <ArrowRightLeft size={20} className="text-emerald-500" />
                                    Re-map {selectedProductIds.length} Operations
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cross-Bucket Migration Engine</p>
                            </div>
                            <button onClick={() => setIsMoveModalOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><X size={24} /></button>
                        </div>

                        <div className="p-8 overflow-y-auto">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Destination Node ({type})</label>

                            <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-inner bg-slate-50/50">
                                {renderTargetSelector()}
                            </div>

                            {!targetId && <p className="text-[10px] font-black text-amber-600 mt-4 uppercase tracking-widest flex items-center gap-2 animate-pulse"><AlertCircle size={14} /> Critical: Select target destination</p>}
                        </div>

                        <div className="px-8 py-6 border-t border-gray-100 flex gap-4 bg-white/70 backdrop-blur-md">
                            <button onClick={() => setIsMoveModalOpen(false)} className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">Discard Operation</button>
                            <button
                                onClick={handleMove}
                                disabled={!targetId || isPending}
                                className="flex-[1.5] h-14 rounded-2xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-700/20 flex justify-center items-center gap-3 disabled:opacity-30 transition-all hover:scale-105 active:scale-95 border-b-4 border-b-emerald-800"
                            >
                                {isPending ? <RefreshCw size={18} className="animate-spin" /> : <CheckSquare size={18} />}
                                {isPending ? 'Processing...' : 'Authorize Re-map'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-4 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-[0_32px_128px_-12px_rgba(0,0,0,0.4)] w-full max-w-md p-8 border border-slate-200 transition-all scale-in duration-500">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <Layers size={20} className="text-blue-500" />
                            Register Master Group
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Intelligence Clustering Engine</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><X size={24} /></button>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 mb-8">
                    <p className="text-[11px] text-blue-700 font-bold leading-relaxed uppercase tracking-tight">
                        Orchestrating <span className="text-blue-900 font-black">{productIds.length} Variant Nodes</span> into a unified abstraction.
                        Inheritance logic will be derived from the progenitor (first item).
                    </p>
                </div>

                <div className="space-y-2 mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group Label</label>
                    <input
                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-black text-[13px] tracking-tight"
                        placeholder="e.g. PERSIL POWER GEL COLLECTION"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">Abort Task</button>
                    <button
                        onClick={handleCreate}
                        disabled={!groupName || isPending}
                        className="flex-[1.5] h-14 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-900/20 flex justify-center items-center gap-3 disabled:opacity-30 transition-all hover:scale-105 active:scale-95 border-b-4 border-b-slate-950"
                    >
                        {isPending ? <RefreshCw size={18} className="animate-spin" /> : <CheckSquare size={18} />}
                        {isPending ? 'Registering...' : 'Provision Group'}
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
        <div className="space-y-6">
            {/* Render Groups */}
            {Object.values(grouped.groups).map((group: Record<string, any>) => (
                <div key={group.name} className="card-premium overflow-hidden bg-white/50 backdrop-blur-md border border-slate-100 shadow-sm transition-all group/container">
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200 ring-4 ring-white">
                                <Layers size={14} className="text-white fill-white/20" />
                            </div>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{group.name}</span>
                            <Badge variant="outline" className="bg-white text-[9px] font-black py-0 px-2 rounded-lg border-slate-200 text-slate-400">
                                {group.items.length} VARIANT NODES
                            </Badge>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50">
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
                <div className="space-y-2">
                    {Object.keys(grouped.groups).length > 0 && (
                        <div className="px-4 py-2 flex items-center gap-4">
                            <div className="flex-1 h-[1px] bg-slate-100" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] whitespace-nowrap">Unclustered Primary Nodes</span>
                            <div className="flex-1 h-[1px] bg-slate-100" />
                        </div>
                    )}
                    <div className="bg-white/30 backdrop-blur-sm rounded-3xl border border-slate-100/50 p-2 divide-y divide-slate-50">
                        {grouped.loose.map((product: Record<string, any>) => (
                            <ProductRow
                                key={product.id}
                                product={product}
                                isSelected={selectedProductIds.includes(product.id)}
                                toggle={() => toggleProduct(product.id)}
                            />
                        ))}
                    </div>
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
                flex items-center gap-5 px-5 py-4 cursor-pointer transition-all duration-300 relative overflow-hidden group/row
                ${isSelected
                    ? 'bg-emerald-50/50'
                    : 'hover:bg-slate-50/80'}
            `}
        >
            {isSelected && (
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            )}

            <div className={`
                w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300
                ${isSelected
                    ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-200/50 rotate-0'
                    : 'border-slate-200 bg-white group-hover/row:border-emerald-300 group-hover/row:scale-110'}
            `}>
                {isSelected ? (
                    <CheckSquare size={14} className="text-white" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-[2px] bg-slate-100 group-hover/row:bg-emerald-200 transition-colors" />
                )}
            </div>

            <div className="flex-1 min-w-0 flex justify-between items-center gap-6">
                <div className="min-w-0">
                    <h4 className={`text-xs font-black tracking-tight transition-colors truncate uppercase ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                        {product.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/50 group-hover/row:bg-white group-hover/row:text-slate-600 transition-all">
                            {product.sku}
                        </span>
                        {product.country && (
                            <Badge variant="outline" className="text-[8px] font-black py-0 px-1 border-slate-200 text-slate-400 bg-white/50 group-hover/row:bg-white flex items-center gap-1">
                                <Package size={8} /> {product.country.name}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0">
                    <div className={`flex items-center gap-2 ${stock > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span className="text-sm font-black tracking-tighter">{stock.toLocaleString()}</span>
                        <span className="text-[9px] font-black uppercase text-slate-300">UT</span>
                    </div>
                    <div className={`w-12 h-1 rounded-full overflow-hidden bg-slate-100 mt-1`}>
                        <div
                            className={`h-full transition-all duration-1000 ${stock > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            style={{ width: `${Math.min(100, (stock / 100) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}