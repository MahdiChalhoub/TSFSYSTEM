'use client';

import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/types/pos';

export function CartTable({
    cart,
    onUpdateQuantity,
    onRemoveItem,
    currency = '$'
}: {
    cart: CartItem[],
    onUpdateQuantity: (id: number, delta: number) => void,
    onRemoveItem: (id: number) => void,
    currency?: string
}) {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-[#F8FAFC] text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sticky top-0 border-b border-gray-100 z-10">
                    <tr>
                        <th className="p-4 pl-6">Product</th>
                        <th className="p-4 text-center">Qty</th>
                        <th className="p-4 text-right">Price</th>
                        <th className="p-4 text-center">Discount</th>
                        <th className="p-4 text-right">N Price</th>
                        <th className="p-4 text-right">Total</th>
                        <th className="p-4 pr-6 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-700">
                    {cart.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-20 text-center text-gray-300 italic">
                                Awaiting selection...
                            </td>
                        </tr>
                    ) : (
                        cart.map((item) => (
                            <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-gray-900">{item.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">Stock check active...</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => onUpdateQuantity(item.productId, -1)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-100"><Minus size={12} /></button>
                                        <span className="w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.productId, 1)} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-100"><Plus size={12} /></button>
                                    </div>
                                </td>
                                <td className="p-4 text-right tabular-nums">{currency}{(Number(item.price) || 0).toFixed(2)}</td>
                                <td className="p-4 text-center text-gray-400">0%</td>
                                <td className="p-4 text-right tabular-nums">{currency}{(Number(item.price) || 0).toFixed(2)}</td>
                                <td className="p-4 text-right tabular-nums font-black text-gray-900">{currency}{((Number(item.price) || 0) * item.quantity).toFixed(2)}</td>
                                <td className="p-4 pr-6 text-center">
                                    <button
                                        onClick={() => onRemoveItem(item.productId)}
                                        className="p-1.5 text-gray-300 hover:text-rose-500 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
