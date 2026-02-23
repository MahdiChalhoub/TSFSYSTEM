'use client';

import { Trash2, Plus, Minus, CreditCard, ShoppingCart, Loader2, CheckCircle, Wallet, Landmark, Banknote, History, Gift, Truck, Smartphone, Save, MapPin } from 'lucide-react';
import { CartItem } from '@/types/pos';
import { useTransition, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { processSale } from '@/app/(privileged)/sales/actions';
import { ReceiptModal } from './ReceiptModal';
import { ManagerOverride } from './ManagerOverride';
import clsx from 'clsx';

export function TicketSidebar({ cart, onUpdateQuantity, onClear, currency = '$', client }: {
    cart: CartItem[],
    onUpdateQuantity: (id: number, delta: number) => void,
    onClear: () => void,
    currency?: string,
    client: any
}) {
    const [isPending, startTransition] = useTransition();
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
    const [cashReceived, setCashReceived] = useState<string>('');

    // Security States
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'clear' | 'discount', data?: any } | null>(null);

    // Receipt Modal State
    const [lastOrder, setLastOrder] = useState<{ id: number; ref: string } | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    const total = cart.reduce((acc, item) => {
        const itemPrice = Number(item.price) || 0;
        return acc + (itemPrice * item.quantity);
    }, 0);

    const uniqueItems = cart.length;
    const totalPieces = cart.reduce((acc, item) => acc + item.quantity, 0);
    const discount = 0; // Mocked for UI
    const totalAmount = Math.max(0, total - discount);
    const receivedAmount = Number(cashReceived) || totalAmount;
    const changeDue = Math.max(0, receivedAmount - totalAmount);

    const handleCharge = useCallback(() => {
        if (cart.length === 0 || isPending) return;
        startTransition(async () => {
            try {
                const result = await processSale({
                    cart,
                    paymentMethod,
                    totalAmount: totalAmount,
                    // scope is now handled on the server by the Integrity Guard
                });

                if (result.success) {
                    if (result.protectionWarning) {
                        toast(result.protectionWarning, {
                            icon: '🛡️',
                            className: 'bg-amber-50 border-amber-200 text-amber-800 font-bold',
                            duration: 5000
                        });
                    }
                    toast.success(`Sale Processed: ${result.ref} [${result.scope}]`);
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
        <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-in slide-in-from-right-4 duration-500">
            {/* Header / Client Info - Compact Single Line */}
            <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-6 divide-x divide-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Client</span>
                            <span className="font-black text-gray-900 text-sm uppercase tracking-tight truncate max-w-[140px]">{client.name}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Phone</span>
                            <span className="font-bold text-gray-500 text-[10px] tabular-nums whitespace-nowrap">{client.phone}</span>
                        </div>
                    </div>

                    <div className="pl-6 flex flex-col">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Delivery Address</span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                            <MapPin size={10} className="text-gray-300 shrink-0" />
                            <span className="truncate max-w-[180px]">{client.address}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 ml-auto">
                    <div className="flex gap-1.5 ">
                        <div className="flex flex-col items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Lines</span>
                            <span className="text-[11px] font-black tabular-nums text-indigo-600 leading-tight">{uniqueItems}</span>
                        </div>
                        <div className="flex flex-col items-center px-2 py-0.5 bg-gray-100/50 border border-gray-200 rounded-lg">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Units</span>
                            <span className="text-[11px] font-black tabular-nums text-gray-700 leading-tight">{totalPieces}</span>
                        </div>
                    </div>

                    <div className="flex gap-6 divide-x divide-gray-200">
                        <div className="flex flex-col text-right">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Balance</span>
                            <span className={clsx("font-black text-lg tracking-tighter tabular-nums leading-tight", client.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                                {currency}{client.balance.toLocaleString()}
                            </span>
                        </div>
                        <div className="pl-6 flex flex-col text-right">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Loyalty</span>
                            <span className="font-black text-amber-500 text-lg tracking-tighter tabular-nums leading-tight">{client.loyalty}<span className="text-[10px] ml-0.5">pts</span></span>
                        </div>
                    </div>
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
                                        <button
                                            onClick={() => {
                                                setPendingAction({ type: 'delete', data: item.productId });
                                                setIsOverrideOpen(true);
                                            }}
                                            className="p-1.5 text-gray-300 hover:text-rose-500 transition-all"
                                        >
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
                <div className="w-72 space-y-4 font-bold text-xs uppercase tracking-tight text-gray-500">
                    <div className="flex justify-between items-center text-gray-400">
                        <span>Items Subtotal</span>
                        <span className="font-mono">{currency}{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Discount %</span>
                        <button
                            onClick={() => {
                                setPendingAction({ type: 'discount' });
                                setIsOverrideOpen(true);
                            }}
                            className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] hover:border-indigo-500 transition-all"
                        >
                            {currency}{discount.toFixed(2)}
                        </button>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        <span className="text-gray-900 font-black">Total to pay</span>
                        <span className="text-gray-900 font-black text-lg tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="relative pt-2">
                        <Banknote className="absolute left-4 top-[2.2rem] text-indigo-400" size={16} />
                        <label className="text-[8px] font-black text-gray-400 block mb-1">Cash Received</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-black text-gray-900 outline-none focus:bg-white focus:border-indigo-500 transition-all tabular-nums"
                        />
                    </div>

                    <div className="">
                        <div className={clsx(
                            "rounded-2xl p-4 flex justify-between items-center shadow-lg transition-all",
                            changeDue > 0 ? "bg-emerald-500 shadow-emerald-100" : "bg-indigo-500 shadow-indigo-100"
                        )}>
                            <span className="text-white font-black">Change Due</span>
                            <span className="text-white font-black text-xl tabular-nums">{currency}{changeDue.toFixed(2)}</span>
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
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${paymentMethod === m.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100 hover:bg-gray-50'}`}
                            >
                                <m.icon size={20} className={paymentMethod === m.id ? 'text-white' : 'text-gray-300'} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${paymentMethod === m.id ? 'text-white' : 'text-gray-500'}`}>{m.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <button className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[9px] uppercase tracking-widest">
                            <History size={16} />
                            Multi Payment
                        </button>
                        <button className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[9px] uppercase tracking-widest">
                            <Truck size={16} />
                            Delivery
                        </button>
                        <button
                            onClick={handleCharge}
                            disabled={isPending || cart.length === 0}
                            className="bg-indigo-600 text-white rounded-2xl h-14 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 border-0"
                        >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save & Close
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

            <ManagerOverride
                isOpen={isOverrideOpen}
                actionLabel={pendingAction?.type === 'delete' ? 'Delete Item' : (pendingAction?.type === 'discount' ? 'Apply Discount' : 'Clear Ticket')}
                onClose={() => setIsOverrideOpen(false)}
                onSuccess={() => {
                    if (pendingAction?.type === 'delete') {
                        const item = cart.find(i => i.productId === pendingAction.data);
                        if (item) onUpdateQuantity(item.productId, -item.quantity);
                        toast.success("Item removed with authorization");
                    } else if (pendingAction?.type === 'discount') {
                        toast.info("Discount unlocked (Interface to follow)");
                    }
                }}
            />
        </div>
    );
}