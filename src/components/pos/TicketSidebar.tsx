'use client';

import { Trash2, Plus, Minus, CreditCard } from 'lucide-react';
import { CartItem } from '@/types/pos';

export function TicketSidebar({ cart, onUpdateQuantity, onClear }: {
    cart: CartItem[],
    onUpdateQuantity: (id: number, delta: number) => void,
    onClear: () => void
}) {

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

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="font-bold text-gray-800">Current Order</h2>
                <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                    <Trash2 size={12} /> Clear
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <CreditCard size={48} className="mb-2" />
                        <p>Start scanning items...</p>
                    </div>
                )}

                {cart.map((item) => (
                    <div key={item.productId} className="flex justify-between items-start group">
                        <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">
                                ${item.price.toFixed(2)} {item.isTaxIncluded && '(Inc)'} x {item.quantity}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="font-bold text-gray-800">${(item.price * item.quantity).toFixed(2)}</div>
                            <div className="flex items-center gap-1 ml-2 bg-gray-100 rounded-lg p-0.5">
                                <button onClick={() => onUpdateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-600"><Minus size={12} /></button>
                                <button onClick={() => onUpdateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-600"><Plus size={12} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer (Totals) */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax</span>
                    <span>${taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200 mt-2">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                </div>

                <button className="w-full mt-4 py-4 bg-green-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                    Charge ${total.toFixed(2)}
                </button>
            </div>
        </div>
    );
}
