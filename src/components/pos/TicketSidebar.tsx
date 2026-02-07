'use client';

import { Trash2, Plus, Minus, CreditCard, ShoppingCart, Loader2, CheckCircle } from 'lucide-react';
import { CartItem } from '@/types/pos';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { processSale } from '@/app/(privileged)/sales/actions';

export function TicketSidebar({ cart, onUpdateQuantity, onClear }: {
    cart: CartItem[],
    onUpdateQuantity: (id: number, delta: number) => void,
    onClear: () => void
}) {
    const [isPending, startTransition] = useTransition();
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');

    // Calculations
    const subtotal = cart.reduce((acc, item) => {
        // If tax is included, we need to extract base price. 
        // Formula: Price / (1 + Rate)
        // If tax excluded, Price is Base.
        const unitBase = item.isTaxIncluded
            ? item.price / (1 + item.taxRate)
            : item.price;
        return acc + (unitBase * item.quantity);
    }, 0);

    const taxTotal = cart.reduce((acc, item) => {
        const unitBase = item.isTaxIncluded
            ? item.price / (1 + item.taxRate)
            : item.price;
        return acc + (unitBase * item.taxRate * item.quantity);
    }, 0);

    const total = subtotal + taxTotal;

    const handleCharge = () => {
        if (cart.length === 0) return;

        startTransition(async () => {
            try {
                const result = await processSale({
                    cart,
                    paymentMethod: 'CASH', // Hardcoded for now, ideal to have selector
                    totalAmount: total,
                    scope: scope
                });

                if (result.success) {
                    toast.success(`Order Processed! Ref: ${result.ref}`);
                    onClear();
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to process order. Check Ledger Settings.");
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100 shadow-2xl relative z-30">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Current Order</h2>
                    <div className="flex gap-1.5 mt-1">
                        <button
                            onClick={() => setScope('OFFICIAL')}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${scope === 'OFFICIAL' ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                        >
                            Declared
                        </button>
                        <button
                            onClick={() => setScope('INTERNAL')}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${scope === 'INTERNAL' ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                        >
                            Internal
                        </button>
                    </div>
                </div>
                <button onClick={onClear} disabled={isPending} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors flex items-center gap-1.5 disabled:opacity-50">
                    <Trash2 size={14} /> Clear
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <ShoppingCart size={40} className="opacity-20 translate-x-1" />
                        </div>
                        <p className="font-medium text-lg">Cart is empty</p>
                        <p className="text-sm opacity-75">Scan products to start...</p>
                    </div>
                )}

                {cart.map((item) => (
                    <div key={item.productId} className="flex justify-between items-start group p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex-1">
                            <div className="font-bold text-gray-900 text-base mb-1">{item.name}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-500">${item.price.toFixed(2)}</span>
                                {item.isTaxIncluded && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded font-bold">TAX INC</span>}
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="font-bold text-gray-900 text-lg">${(item.price * item.quantity).toFixed(2)}</div>
                            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                                <button onClick={() => onUpdateQuantity(item.productId, -1)} disabled={isPending} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600 transition-colors disabled:opacity-50"><Minus size={14} strokeWidth={3} /></button>
                                <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                <button onClick={() => onUpdateQuantity(item.productId, 1)} disabled={isPending} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600 transition-colors disabled:opacity-50"><Plus size={14} strokeWidth={3} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer (Totals) */}
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 space-y-3 backdrop-blur-lg">
                <div className="space-y-2 pb-4 border-b border-gray-200/50 border-dashed">
                    <div className="flex justify-between text-sm text-gray-600 font-medium">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 font-medium">
                        <span>Tax</span>
                        <span>${taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                        <span>Discount</span>
                        <span>$0.00</span>
                    </div>
                </div>

                <div className="flex justify-between items-end pt-2 mb-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500">Total Amount</span>
                        <span className="text-3xl font-extrabold text-gray-900 tracking-tight">${total.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">USD</span>
                    </div>
                </div>

                <button
                    onClick={handleCharge}
                    disabled={isPending || cart.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xl rounded-2xl shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:grayscale"
                >
                    {isPending ? (
                        <>
                            <Loader2 size={24} className="animate-spin" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <CreditCard size={24} />
                            <span>Charge Order</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}