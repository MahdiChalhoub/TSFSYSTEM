'use client';

import { Trash2, Plus, Minus, CreditCard, ShoppingCart, Loader2, CheckCircle, Wallet, Landmark, Banknote, History, Gift, Truck, Smartphone, Save } from 'lucide-react';
import { CartItem } from '@/types/pos';
import { useTransition, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { processSale } from '@/app/(privileged)/sales/actions';
import { ReceiptModal } from './ReceiptModal';

export function TicketSidebar({ cart, onUpdateQuantity, onClear, currency = '$' }: {
    cart: CartItem[],
    onUpdateQuantity: (id: number, delta: number) => void,
    onClear: () => void,
    currency?: string
}) {
    const [isPending, startTransition] = useTransition();
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

    // Receipt Modal State
    const [lastOrder, setLastOrder] = useState<{ id: number; ref: string } | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    const total = cart.reduce((acc, item) => {
        const itemPrice = Number(item.price) || 0;
        return acc + (itemPrice * item.quantity);
    }, 0);
    const discount = 0; // Mocked for UI
    const totalAmount = Math.max(0, total - discount);
    const receivedAmount = totalAmount; // Mocked

    const handleCharge = useCallback(() => {
        if (cart.length === 0 || isPending) return;
        startTransition(async () => {
            try {
                const result = await processSale({
                    cart,
                    paymentMethod,
                    totalAmount: totalAmount,
                    scope: 'OFFICIAL'
                });

                if (result.success) {
                    toast.success(`Sale Processed: ${result.ref}`);
                    setLastOrder({ id: result.orderId, ref: result.ref });
                    setIsReceiptOpen(true);
                    onClear();
                }
            } catch (error) {
                toast.error("Process Logic Failure.");
            }
        });
    }, [cart, isPending, paymentMethod, totalAmount, onClear]);

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
            {/* Header / Client Info Placeholder */}
            <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Name</span>
                            <span className="font-bold text-gray-900 text-xs">John Doe</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</span>
                            <span className="font-bold text-gray-900 text-xs">+91 54321 098765</span>
                        </div>
                    </div>
                    <div className="flex gap-4 text-right">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</span>
                            <span className="font-black text-indigo-600 text-xl tracking-tighter">{currency}120</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loyalty Points</span>
                            <span className="font-black text-indigo-400 text-xl tracking-tighter">50</span>
                        </div>
                    </div>
                </div>
                <div className="text-[10px] font-bold text-gray-400">
                    <span className="uppercase tracking-widest">Address:</span> 1st Block 1st Cross, Rammurthy Nagar, Bangalore.
                </div>
            </div>

            {/* Main Tabular View */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                                    Awaiting selection...
                                </td>
                            </tr>
                        ) : (
                            cart.map((item) => (
                                <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 pl-6">
                                        <div className="font-bold text-gray-900">{item.name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">1234567890123 ΓÇó Stock: 50</div>
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
                                        <button onClick={() => onUpdateQuantity(item.productId, -item.quantity)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {cart.length > 0 && (
                        <tfoot>
                            <tr className="bg-[#F8FAFC]">
                                <td colSpan={5} className="p-4 pl-6 font-black text-gray-400 uppercase tracking-widest text-right">Total</td>
                                <td className="p-4 text-right font-black text-xl text-gray-900 tabular-nums">{currency}{totalAmount.toFixed(2)}</td>
                                <td className="p-4"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Bottom Section: Summary & Payments */}
            <div className="bg-white border-t border-gray-100 p-6 flex gap-8 shrink-0">
                {/* Summary Box */}
                <div className="w-72 space-y-3 font-bold text-xs uppercase tracking-tight text-gray-500">
                    <div className="flex justify-between items-center">
                        <span>Amount Before Discount</span>
                        <span className="text-gray-900">{currency}{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Discount</span>
                        <span className="text-gray-900">{currency}{discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Total Amount</span>
                        <span className="text-gray-900">{currency}{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Received Amount</span>
                        <span className="text-gray-900">{currency}{receivedAmount.toFixed(2)}</span>
                    </div>
                    <div className="pt-2">
                        <div className="bg-indigo-500 rounded-xl p-4 flex justify-between items-center shadow-lg shadow-indigo-100">
                            <span className="text-white font-black">Change Due</span>
                            <span className="text-white font-black text-xl">{currency}0.00</span>
                        </div>
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Payment Method</h4>
                        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
                            <Gift size={12} />
                            Use Reward Point (50 Available)
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { id: 'CASH', label: 'Cash', icon: Banknote },
                            { id: 'WAVE', label: 'Wave', icon: Smartphone },
                            { id: 'OM', label: 'Orange Money', icon: Landmark },
                            { id: 'CARD', label: 'Card', icon: CreditCard }
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setPaymentMethod(m.id)}
                                className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${paymentMethod === m.id ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500 ring-offset-0' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100 hover:bg-gray-50'}`}
                            >
                                <m.icon size={18} className={paymentMethod === m.id ? 'text-indigo-600' : ''} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${paymentMethod === m.id ? 'text-gray-900' : ''}`}>{m.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <button className="flex items-center justify-center gap-3 p-3.5 rounded-2xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all">
                            <History size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Multi Payment</span>
                        </button>
                        <button className="flex items-center justify-center gap-3 p-3.5 rounded-2xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all">
                            <Truck size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Delivery</span>
                        </button>
                        <button
                            onClick={handleCharge}
                            disabled={isPending || cart.length === 0}
                            className="bg-indigo-500 text-white rounded-2xl p-3.5 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save as Draft
                        </button>
                    </div>
                </div>
            </div>

            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                orderId={lastOrder?.id || null}
                refCode={lastOrder?.ref || null}
            />
        </div>
    );
}