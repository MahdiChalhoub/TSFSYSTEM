'use client';

import { useState, useTransition, useEffect } from 'react';
import type { Product } from '@/types/erp';
import { Search, Package, Save, AlertTriangle, CheckCircle, ArrowRightLeft, Info } from 'lucide-react';
import { getGlobalInventory } from '@/app/actions/inventory/viewer';
import { adjustStock } from '@/app/actions/inventory/movements';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

type Warehouse = {
    id: number;
    name: string;
    type: string;
    siteId: number | null;
    site?: { name: string };
};

export default function StockAdjustmentManager({
    warehouses
}: {
    warehouses: Warehouse[]
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form State
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(warehouses[0]?.id || 0);
    const [quantity, setQuantity] = useState<number>(0);
    const [reason, setReason] = useState('Stock Count Correction');
    const [notes, setNotes] = useState('');

    // Product Search State
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Feedback
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (search.length > 1) {
                setLoadingProducts(true);
                const result = await getGlobalInventory({ search, limit: 10 });
                setProducts(result.products);
                setLoadingProducts(false);
            } else if (search === '') {
                setProducts([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleAdjust = () => {
        if (!selectedProduct || !selectedWarehouseId || quantity === 0) return;

        startTransition(async () => {
            const res = await adjustStock(
                selectedProduct.id,
                selectedWarehouseId,
                quantity,
                reason,
                notes
            );

            if (res.success) {
                setMessage({ type: 'success', text: res.message || 'Adjustment successful' });
                // Reset form slightly but keep warehouse
                setQuantity(0);
                setSelectedProduct(null);
                setSearch('');
                setNotes('');
                // Refresh data if needed or rely on action revalidate
                router.refresh();
            } else {
                setMessage({ type: 'error', text: res.message || 'Adjustment failed' });
            }
        });
    };

    const currentWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Panel: Selection & Input */}
            <div className="space-y-6">

                {/* 1. Warehouse Selection */}
                <div className="bg-app-surface p-6 rounded-[32px] shadow-lg shadow-indigo-900/5 border border-app-border">
                    <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BuildingIcon className="w-4 h-4" />
                        Target Warehouse
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {warehouses.map(w => (
                            <button
                                key={w.id}
                                onClick={() => setSelectedWarehouseId(w.id)}
                                className={clsx(
                                    "px-4 py-3 rounded-xl border flex-shrink-0 transition-all",
                                    selectedWarehouseId === w.id
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200"
                                        : "bg-app-surface border-app-border text-app-muted-foreground hover:bg-app-surface-2"
                                )}
                            >
                                <div className="text-sm font-bold">{w.name}</div>
                                {w.site && <div className="text-[10px] opacity-80">{w.site.name}</div>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Product Search */}
                <div className="bg-app-surface p-6 rounded-[32px] shadow-lg shadow-indigo-900/5 border border-app-border min-h-[300px]">
                    <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Select Product
                    </h3>

                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Type to search product..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full px-5 py-4 bg-app-surface rounded-2xl border-none focus:ring-4 focus:ring-indigo-50 font-medium text-app-foreground outline-none transition-all"
                        />
                        {loadingProducts && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-app-info text-xs font-bold animate-pulse">
                                Searching...
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {products.length > 0 ? (
                            products.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => { setSelectedProduct(product); setSearch(''); setProducts([]); }}
                                    className={clsx(
                                        "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                                        selectedProduct?.id === product.id
                                            ? "bg-app-info-bg border-app-info ring-2 ring-indigo-100"
                                            : "bg-app-surface border-gray-50 hover:border-app-border hover:bg-app-surface/50"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-app-surface-2 flex items-center justify-center text-app-muted-foreground group-hover:text-app-info transition-colors">
                                            <Package size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-app-foreground">{product.name}</div>
                                            <div className="text-[10px] text-app-muted-foreground font-mono">
                                                {product.sku} {product.barcode ? `ΓÇó ${product.barcode}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-bold text-app-muted-foreground">Curr. Stock</div>
                                        <div className="text-xs font-black text-app-foreground">
                                            {product.siteStock?.[currentWarehouse?.siteId ?? 0] || '0'}
                                        </div>
                                    </div>
                                </button>
                            ))
                        ) : search.length > 1 && !loadingProducts ? (
                            <div className="text-center py-8 text-app-muted-foreground text-sm">No products found</div>
                        ) : selectedProduct ? (
                            <div className="p-4 bg-app-info-bg border border-indigo-100 rounded-2xl flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-app-surface text-app-info flex items-center justify-center shadow-sm">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-app-foreground">{selectedProduct.name}</div>
                                    <div className="text-[10px] text-app-info font-bold uppercase tracking-wide">Selected Product</div>
                                </div>
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="ml-auto text-xs text-indigo-400 hover:text-app-info underline"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-app-faint text-sm italic">
                                Start typing to search...
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Right Panel: Adjustment Details */}
            <div className="space-y-6">
                <div className="bg-app-surface p-8 rounded-[40px] shadow-xl shadow-indigo-900/10 border border-app-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                        <ArrowRightLeft size={120} />
                    </div>

                    <h2 className="text-2xl font-black text-app-foreground mb-8">Adjustment Details</h2>

                    <div className="space-y-6">
                        {/* Type & Quantity */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-widest mb-2">Adjustment Type</label>
                                <div className="flex gap-2 p-1.5 bg-app-surface rounded-2xl">
                                    {['Addition (+)', 'Deduction (-)'].map((mode, idx) => {
                                        const isAddition = idx === 0;
                                        const isSelected = (quantity > 0 && isAddition) || (quantity < 0 && !isAddition) || (quantity === 0 && isAddition);

                                        return (
                                            <button
                                                key={mode}
                                                onClick={() => setQuantity(isAddition ? Math.abs(quantity) : -Math.abs(quantity))}
                                                className={clsx(
                                                    "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                                                    isSelected
                                                        ? (isAddition ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-rose-500 text-white shadow-lg shadow-rose-200")
                                                        : "text-app-muted-foreground hover:text-app-muted-foreground hover:bg-app-surface"
                                                )}
                                            >
                                                {mode}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-widest mb-2">Quantity ({selectedProduct?.unit || 'Units'})</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={Math.abs(quantity)}
                                        onChange={e => {
                                            const val = Math.abs(parseFloat(e.target.value) || 0);
                                            setQuantity(quantity < 0 ? -val : val);
                                        }}
                                        min="0"
                                        className="w-full px-6 py-5 bg-app-surface rounded-2xl text-3xl font-black text-app-foreground focus:ring-4 outline-none transition-all focus:ring-indigo-100 border-none"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-app-muted-foreground font-bold text-sm">
                                        {selectedProduct?.unit || 'PCS'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-widest mb-2">Reason Code</label>
                            <select
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full px-5 py-4 bg-app-surface rounded-2xl font-bold text-app-foreground border-none outline-none focus:ring-4 focus:ring-indigo-100 appearance-none"
                            >
                                <option>Stock Count Correction</option>
                                <option>Damaged Goods</option>
                                <option>Expired Stock</option>
                                <option>Theft / Loss</option>
                                <option>Found Item</option>
                                <option>Internal Use / Consumption</option>
                                <option>Other Adjustment</option>
                            </select>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-app-muted-foreground uppercase tracking-widest mb-2">Internal Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full px-5 py-4 bg-app-surface rounded-2xl font-medium text-app-foreground border-none outline-none focus:ring-4 focus:ring-indigo-100 h-24 resize-none"
                                placeholder="Optional details..."
                            />
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleAdjust}
                            disabled={!selectedProduct || quantity === 0 || isPending}
                            className={clsx(
                                "w-full py-5 rounded-2xl font-black text-white uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3",
                                !selectedProduct || quantity === 0
                                    ? "bg-app-surface-2 text-app-muted-foreground cursor-not-allowed"
                                    : isPending
                                        ? "bg-indigo-400 cursor-wait"
                                        : quantity > 0
                                            ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                                            : "bg-rose-500 hover:bg-rose-600 shadow-rose-200"
                            )}
                        >
                            {isPending ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    <Save size={20} />
                                    Confirm Adjustment
                                </>
                            )}
                        </button>

                        {/* Message Feedback */}
                        {message && (
                            <div className={clsx(
                                "p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-bottom duration-500",
                                message.type === 'success' ? "bg-app-success-bg text-app-success" : "bg-app-error-bg text-app-error"
                            )}>
                                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                {message.text}
                            </div>
                        )}

                    </div>
                </div>

                {/* Product Snapshot Info */}
                {selectedProduct && (
                    <div className="bg-indigo-900 text-white p-6 rounded-3xl relative overflow-hidden">
                        <div className="absolute -bottom-8 -right-8 opacity-10">
                            <Package size={150} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">Product Snapshot</h4>
                            <div className="text-xl font-bold mb-1">{selectedProduct.name}</div>
                            <div className="flex gap-4 mt-4">
                                <div>
                                    <div className="text-[10px] uppercase text-indigo-400">Buying Cost</div>
                                    <div className="font-mono font-bold">${selectedProduct.costPrice?.toFixed(2)}</div>
                                </div>
                                <div className="w-px bg-indigo-800" />
                                <div>
                                    <div className="text-[10px] uppercase text-indigo-400">Total Valuation</div>
                                    <div className="font-mono font-bold">
                                        ${(Math.abs(quantity) * (selectedProduct.costPrice || 0)).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function BuildingIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
        </svg>
    )
}