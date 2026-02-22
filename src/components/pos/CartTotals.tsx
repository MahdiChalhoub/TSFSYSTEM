'use client';

import { Banknote, CreditCard, Landmark, Smartphone, Save, History, Truck, Gift, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import clsx from 'clsx';

export function CartTotals({
    subtotal,
    discount,
    totalAmount,
    cashReceived,
    paymentMethod,
    isPending,
    currency = '$',
    onSetCashReceived,
    onSetPaymentMethod,
    onCharge,
    onDiscountClick
}: {
    subtotal: number,
    discount: number,
    totalAmount: number,
    cashReceived: string,
    paymentMethod: string,
    isPending: boolean,
    currency?: string,
    onSetCashReceived: (val: string) => void,
    onSetPaymentMethod: (val: string) => void,
    onCharge: () => void,
    onDiscountClick: () => void
}) {
    const receivedAmount = Number(cashReceived) || totalAmount;
    const changeDue = Math.max(0, receivedAmount - totalAmount);

    return (
        <div className="space-y-4 font-bold text-xs uppercase tracking-tight text-gray-500">
            {/* Totals Summary */}
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-gray-400">
                    <span className="text-[9px] font-black tracking-widest">Subtotal</span>
                    <span className="font-mono text-[10px]">{currency}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black tracking-widest">Discount</span>
                    <button
                        onClick={onDiscountClick}
                        className="px-2 py-0.5 bg-white border border-gray-100 rounded text-[9px] hover:border-indigo-500 transition-all"
                    >
                        {currency}{discount.toFixed(2)}
                    </button>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-black tracking-widest">Total Pay</span>
                    <span className="text-gray-900 font-black text-base tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Cash Input & Change */}
            <div className="space-y-2">
                <div className="relative">
                    <Banknote className="absolute left-3 top-[1.8rem] text-indigo-400" size={14} />
                    <label className="text-[7px] font-black text-gray-400 block mb-1 tracking-widest">Cash Received</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => onSetCashReceived(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-gray-900 outline-none focus:bg-white focus:border-indigo-500 transition-all tabular-nums"
                    />
                </div>
                <div className={clsx(
                    "rounded-xl p-3 flex justify-between items-center shadow-md transition-all",
                    changeDue > 0 ? "bg-emerald-500" : "bg-indigo-500"
                )}>
                    <span className="text-white font-black text-[9px] tracking-widest">Change Due</span>
                    <span className="text-white font-black text-base tabular-nums">{currency}{changeDue.toFixed(2)}</span>
                </div>
            </div>

            {/* Payment Options Grid */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'WAVE', label: 'Wave', icon: Smartphone },
                    { id: 'OM', label: 'OM', icon: Landmark }
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => onSetPaymentMethod(m.id)}
                        className={clsx(
                            "flex items-center gap-2 p-3 rounded-xl border transition-all",
                            paymentMethod === m.id
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                        )}
                    >
                        <m.icon size={16} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[8px] uppercase tracking-widest">
                        <History size={14} />
                        Multi
                    </button>
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[8px] uppercase tracking-widest">
                        <Truck size={14} />
                        Delivery
                    </button>
                </div>
                <button
                    onClick={onCharge}
                    disabled={isPending}
                    className="w-full bg-indigo-600 text-white rounded-xl h-12 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Finalize Charge
                </button>
            </div>
        </div>
    );
}
