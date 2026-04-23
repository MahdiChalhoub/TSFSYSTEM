'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import {
    Search, ArrowRightLeft, CheckSquare, Square, X,
    AlertCircle, Layers, Package, Loader2, FolderOpen
} from 'lucide-react';
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
    const searchRef = useRef<HTMLInputElement>(null);

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
                toast.success(result.message);
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
            return (
                <div
                    className="h-64 rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--app-border)' }}
                >
                    <CategoryTreeSelector
                        categories={targetEntities as any}
                        selectedIds={targetId ? [targetId] : []}
                        onChange={(ids) => setTargetId(ids[0] || null)}
                        maxHeight="h-full"
                    />
                </div>
            );
        }

        // Generic List Selector for Brand/Unit/etc
        return (
            <div
                className="h-64 rounded-xl overflow-y-auto custom-scrollbar p-2 space-y-1"
                style={{ border: '1px solid var(--app-border)', background: 'var(--app-background)' }}
            >
                {targetEntities
                    .filter(e => e.id !== currentEntityId)
                    .map(e => (
                        <div
                            key={e.id}
                            onClick={() => setTargetId(e.id)}
                            className="p-2.5 rounded-xl cursor-pointer flex justify-between items-center transition-all"
                            style={{
                                background: targetId === e.id
                                    ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-surface))'
                                    : 'transparent',
                                border: targetId === e.id
                                    ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                    : '1px solid transparent',
                            }}
                        >
                            <span className="text-[12px] font-bold text-app-foreground">{e.name}</span>
                            {e.code && (
                                <span
                                    className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                        color: 'var(--app-muted-foreground)',
                                    }}
                                >
                                    {e.code}
                                </span>
                            )}
                        </div>
                    ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* ═══════════ Toolbar ═══════════ */}
            <div
                className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                }}
            >
                <div className="flex items-center gap-2.5 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-[11px] font-bold bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-1 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>

                    {/* Selection pill */}
                    {selectedProductIds.length > 0 && (
                        <span
                            className="text-[10px] font-black tabular-nums px-2.5 py-1 rounded-full animate-in fade-in"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                color: 'var(--app-primary)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            }}
                        >
                            {selectedProductIds.length} selected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Group Button */}
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-muted-foreground)',
                            background: 'transparent',
                        }}
                    >
                        <Layers size={13} />
                        <span className="hidden sm:inline">Group</span>
                    </button>

                    {/* Move Button */}
                    <button
                        onClick={() => setIsMoveModalOpen(true)}
                        disabled={selectedProductIds.length === 0}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--app-primary)',
                            boxShadow: selectedProductIds.length > 0
                                ? '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)'
                                : 'none',
                        }}
                    >
                        <ArrowRightLeft size={13} />
                        <span className="hidden sm:inline">Move</span>
                    </button>

                    {/* Select All */}
                    <button
                        onClick={toggleSelectAll}
                        className="p-1.5 rounded-xl transition-all"
                        style={{
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            color: selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length
                                ? 'var(--app-primary)'
                                : 'var(--app-muted-foreground)',
                        }}
                        title="Select All"
                    >
                        {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length
                            ? <CheckSquare size={15} />
                            : <Square size={15} />}
                    </button>
                </div>
            </div>

            {/* ═══════════ Product List ═══════════ */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar p-3">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <Package size={32} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No products found</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">
                            {searchTerm
                                ? 'Try a different search term.'
                                : `No products are assigned to this ${type}.`}
                        </p>
                    </div>
                ) : (
                    <ProductList
                        products={filteredProducts}
                        selectedProductIds={selectedProductIds}
                        toggleProduct={toggleProduct}
                    />
                )}
            </div>

            {/* ═══════════ Move Modal ═══════════ */}
            {isMoveModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setIsMoveModalOpen(false) }}
                >
                    <div
                        className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                                borderBottom: '1px solid var(--app-border)',
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'var(--app-primary)',
                                        boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    }}
                                >
                                    <ArrowRightLeft size={15} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-app-foreground">Move Products</h3>
                                    <p className="text-[10px] font-bold text-app-muted-foreground">
                                        {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''} selected
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMoveModalOpen(false)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 block">
                                Destination {type === 'category' ? 'Category' : type.replace(/^./, c => c.toUpperCase())}
                            </label>
                            {renderTargetSelector()}

                            {!targetId && (
                                <p className="text-[10px] font-bold mt-2 flex items-center gap-1"
                                    style={{ color: 'var(--app-warning)' }}>
                                    <AlertCircle size={11} /> Please select a destination.
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div
                            className="px-5 py-3 flex gap-2.5 flex-shrink-0"
                            style={{ borderTop: '1px solid var(--app-border)' }}
                        >
                            <button
                                onClick={() => setIsMoveModalOpen(false)}
                                className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                                style={{
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-muted-foreground)',
                                    background: 'transparent',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMove}
                                disabled={!targetId || isPending}
                                className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                style={{
                                    background: 'var(--app-primary)',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                }}
                            >
                                {isPending ? (
                                    <><Loader2 size={14} className="animate-spin" /> Moving...</>
                                ) : (
                                    'Confirm Move'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════ Group Modal ═══════════ */}
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

/* ═══════════ Group Modal ═══════════ */
function GroupModal({ isOpen, onClose, productIds, onSuccess }: Record<string, any>) {
    const [groupName, setGroupName] = useState('');
    const [isPending, startTransition] = useTransition();

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!groupName) return;
        startTransition(async () => {
            const result = await createGroupFromProducts(productIds, { name: groupName });
            if (result.success) {
                toast.success('Group created successfully');
                onSuccess();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}
            >
                {/* Header */}
                <div
                    className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info) 6%, var(--app-surface))',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'var(--app-info)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)',
                            }}
                        >
                            <Layers size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">Create Group</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {productIds.length} product{productIds.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <p className="text-[11px] font-bold text-app-muted-foreground">
                        Create a new Master Product (Group) for the selected items.
                        All items will inherit the Brand and Category of the first item.
                    </p>

                    <div>
                        <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1.5 block">
                            Group Name
                        </label>
                        <input
                            className="w-full text-[12px] font-bold px-3 py-2 rounded-xl outline-none transition-all"
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }}
                            placeholder="e.g. Persil Power Gel"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="px-5 py-3 flex gap-2.5 flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)' }}
                >
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                        style={{
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-muted-foreground)',
                            background: 'transparent',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!groupName || isPending}
                        className="flex-1 py-2 rounded-xl text-[12px] font-bold text-white flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{
                            background: 'var(--app-info)',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info) 25%, transparent)',
                        }}
                    >
                        {isPending ? (
                            <><Loader2 size={14} className="animate-spin" /> Creating...</>
                        ) : (
                            'Create Group'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════ Product List ═══════════ */
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

    return (
        <div className="space-y-3">
            {/* Render Groups */}
            {Object.values(grouped.groups).map((group: Record<string, any>) => (
                <div
                    key={group.name}
                    className="rounded-xl overflow-hidden"
                    style={{
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        background: 'var(--app-surface)',
                    }}
                >
                    {/* Group Header */}
                    <div
                        className="px-4 py-2.5 flex justify-between items-center"
                        style={{
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            background: 'color-mix(in srgb, var(--app-info) 5%, var(--app-surface))',
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                    color: 'var(--app-info)',
                                }}
                            >
                                <Layers size={12} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground">{group.name}</span>
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                {group.items.length} variants
                            </span>
                        </div>
                    </div>
                    <div>
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
                        <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <Package size={10} className="text-app-muted-foreground" />
                            <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">
                                Ungrouped Products
                            </span>
                        </div>
                    )}
                    <div
                        className="rounded-xl overflow-hidden"
                        style={{
                            border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            background: 'var(--app-surface)',
                        }}
                    >
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

/* ═══════════ Product Row ═══════════ */
function ProductRow({ product, isSelected, toggle }: Record<string, any>) {
    const stock = product.inventory?.reduce((acc: number, item: Record<string, any>) => acc + Number(item.quantity), 0) || 0;

    return (
        <div
            onClick={toggle}
            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 group"
            style={{
                background: isSelected
                    ? 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))'
                    : 'transparent',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
            }}
        >
            {/* Checkbox */}
            <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                    background: isSelected ? 'var(--app-primary)' : 'transparent',
                    border: isSelected
                        ? '1.5px solid var(--app-primary)'
                        : '1.5px solid color-mix(in srgb, var(--app-border) 70%, transparent)',
                    color: isSelected ? '#fff' : 'transparent',
                }}
            >
                {isSelected && <CheckSquare size={12} />}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0 flex justify-between items-center gap-3">
                <div className="min-w-0">
                    <h4 className="text-[12px] font-bold text-app-foreground truncate">
                        {product.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span
                            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                            style={{
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                color: 'var(--app-muted-foreground)',
                            }}
                        >
                            {product.sku}
                        </span>
                        {product.country && (
                            <span className="text-[10px] font-bold text-app-muted-foreground">
                                · {product.country.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* Stock */}
                <div className="flex-shrink-0 text-right">
                    <span
                        className="text-[12px] font-black tabular-nums"
                        style={{
                            color: stock > 0 ? 'var(--app-success)' : 'var(--app-error)',
                        }}
                    >
                        {stock}
                    </span>
                    <span className="text-[9px] font-bold text-app-muted-foreground ml-1">qty</span>
                </div>
            </div>
        </div>
    );
}