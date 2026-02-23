'use client';

import { Banknote, CreditCard, Landmark, Smartphone, Save, History, Truck, Gift, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import clsx from 'clsx';

export function CartTotals({
    subtotal,
    discount,
    discountType = 'fixed',
    totalAmount,
    cashReceived,
    paymentMethod,
    isPending,
    currency = '$',
    storeChangeInWallet,
    loyaltyBalance = 0,
    pointsRedeemed = 0,
    onSetCashReceived,
    onSetPaymentMethod,
    onStoreChangeInWallet,
    onSetPointsRedeemed,
    onCharge,
    onSetDiscountType,
    onDiscountClick
}: {
    subtotal: number,
    discount: number,
    discountType?: 'fixed' | 'percentage',
    totalAmount: number,
    cashReceived: string,
    paymentMethod: string,
    isPending: boolean,
    currency?: string,
    storeChangeInWallet?: boolean,
    loyaltyBalance?: number,
    pointsRedeemed?: number,
    onSetCashReceived: (val: string) => void,
    onSetPaymentMethod: (val: string) => void,
    onStoreChangeInWallet?: (val: boolean) => void,
    onSetPointsRedeemed?: (val: number) => void,
    onCharge: () => void,
    onSetDiscountType?: (type: 'fixed' | 'percentage') => void,
    onDiscountClick: () => void
}) {
    const receivedAmount = Number(cashReceived.replace(/\D/g, '')) || totalAmount;
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
                    <div className="flex items-center gap-2">
                        {onSetDiscountType && (
                            <div className="flex items-center bg-gray-100 rounded p-0.5">
                                <button
                                    onClick={() => onSetDiscountType('fixed')}
                                    className={clsx("px-2 py-0.5 rounded text-[9px] font-black transition-all", discountType === 'fixed' ? "bg-white shadow text-gray-800" : "text-gray-400")}
                                >
                                    {currency}
                                </button>
                                <button
                                    onClick={() => onSetDiscountType('percentage')}
                                    className={clsx("px-2 py-0.5 rounded text-[9px] font-black transition-all", discountType === 'percentage' ? "bg-white shadow text-gray-800" : "text-gray-400")}
                                >
                                    %
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onDiscountClick}
                            className="px-2 py-0.5 bg-white border border-gray-100 rounded text-[9px] hover:border-indigo-500 transition-all text-right min-w-[3rem]"
                        >
                            {discountType === 'fixed' ? currency : ''}{discount.toFixed(2)}{discountType === 'percentage' ? '%' : ''}
                        </button>
                    </div>
                </div>
                {loyaltyBalance > 0 && onSetPointsRedeemed && (
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-[9px] font-black tracking-widest text-indigo-500">Loyalty ({loyaltyBalance} pts)</span>
                        <button
                            onClick={() => {
                                const toggleTo = pointsRedeemed === loyaltyBalance ? 0 : loyaltyBalance;
                                onSetPointsRedeemed(toggleTo);
                            }}
                            className={clsx(
                                "px-2 py-0.5 border rounded text-[9px] font-black transition-all",
                                pointsRedeemed > 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-indigo-500 border-indigo-100 hover:border-indigo-300"
                            )}
                        >
                            {pointsRedeemed > 0 ? `Redeeming ${pointsRedeemed}` : 'Redeem All'}
                        </button>
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-900 font-black tracking-widest">Total Pay</span>
                    <span className="text-gray-900 font-black text-base tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Cash Input */}
            <div className="space-y-2">
                <div className="relative">
                    <Banknote className="absolute left-3 top-[1.8rem] text-indigo-400" size={14} />
                    <label className="text-[7px] font-black text-gray-400 block mb-1 tracking-widest">Cash Received</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder={totalAmount.toFixed(0)}
                        value={cashReceived ? Number(cashReceived.replace(/\D/g, '')).toLocaleString('fr-FR') : ''}
                        onChange={(e) => {
                            const numericValue = e.target.value.replace(/\s+/g, '').replace(/,/g, '.');
                            if (/^\d*\.?\d*$/.test(numericValue)) onSetCashReceived(numericValue);
                        }}
                        className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-gray-900 outline-none focus:bg-white focus:border-indigo-500 transition-all tabular-nums text-right"
                    />
                </div>
            </div>

            {/* Payment Options Grid */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'WALLET', label: 'Wallet', icon: Smartphone },
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

            {changeDue > 0 && onStoreChangeInWallet && (
                <label className="flex items-center gap-2 cursor-pointer mt-2 text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 p-2 rounded-xl hover:bg-indigo-100 transition-colors">
                    <input
                        type="checkbox"
                        checked={storeChangeInWallet}
                        onChange={(e) => onStoreChangeInWallet(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                    />
                    <Save size={14} className="opacity-70" />
                    Store {currency}{changeDue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} in Wallet
                </label>
            )}

            {/* Main Action Buttons */}
            <div className="space-y-2 pt-2">
                <button
                    onClick={onCharge}
                    disabled={isPending}
                    className="w-full bg-indigo-600 text-white rounded-xl h-14 flex flex-col items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isPending ? (
                        <div className="flex items-center gap-3"><Loader2 size={16} className="animate-spin" /> Finalize Charge</div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3"><Save size={16} /> Finalize Charge</div>
                            {changeDue > 0 && (
                                <span className="text-[9px] text-indigo-200 mt-0.5 opacity-90 tracking-widest">
                                    Change Due: {currency}{changeDue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                                </span>
                            )}
                        </>
                    )}
                </button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[8px] uppercase tracking-widest">
                        <History size={14} /> Multi
                    </button>
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all font-black text-[8px] uppercase tracking-widest">
                        <Truck size={14} /> Delivery
                    </button>
                </div>
            </div>
        </div>
    );
}
