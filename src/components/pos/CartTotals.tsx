'use client';

import { Banknote, CreditCard, Landmark, Smartphone, Save, History, Truck, Gift, Loader2, Eye } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import clsx from 'clsx';
import { TaxLinePreviewTable } from '@/components/finance/TaxLinePreviewTable';

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
    onDiscountClick,
    taxLines,
    onOpenTaxExplainer,
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
    onDiscountClick: () => void,
    taxLines?: Array<{ type: string; rate: number | string; amount: number | string; base_amount?: number | string; behavior?: string; name?: string }>,
    onOpenTaxExplainer?: () => void,
}) {
    const receivedAmount = Number(cashReceived.replace(/\D/g, '')) || totalAmount;
    const changeDue = Math.max(0, receivedAmount - totalAmount);

    return (
        <div className="space-y-4 font-bold text-xs uppercase tracking-tight text-app-muted-foreground">
            {/* Totals Summary */}
            <div className="bg-app-bg/50 p-4 rounded-2xl border border-app-border space-y-3">
                <div className="flex justify-between items-center text-app-muted-foreground">
                    <span className="text-[9px] font-black tracking-widest">Subtotal</span>
                    <span className="font-mono text-[10px]">{currency}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black tracking-widest">Discount</span>
                    <div className="flex items-center gap-2">
                        {onSetDiscountType && (
                            <div className="flex items-center bg-app-surface-2 rounded p-0.5">
                                <button
                                    onClick={() => onSetDiscountType('fixed')}
                                    className={clsx("px-2 py-0.5 rounded text-[9px] font-black transition-all", discountType === 'fixed' ? "bg-app-surface shadow text-app-foreground" : "text-app-muted-foreground")}
                                >
                                    {currency}
                                </button>
                                <button
                                    onClick={() => onSetDiscountType('percentage')}
                                    className={clsx("px-2 py-0.5 rounded text-[9px] font-black transition-all", discountType === 'percentage' ? "bg-app-surface shadow text-app-foreground" : "text-app-muted-foreground")}
                                >
                                    %
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onDiscountClick}
                            className="px-2 py-0.5 bg-app-surface border border-app-border rounded text-[9px] hover:border-app-info transition-all text-right min-w-[3rem]"
                        >
                            {discountType === 'fixed' ? currency : ''}{discount.toFixed(2)}{discountType === 'percentage' ? '%' : ''}
                        </button>
                    </div>
                </div>
                {loyaltyBalance > 0 && onSetPointsRedeemed && (
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-[9px] font-black tracking-widest text-app-info">Loyalty ({loyaltyBalance} pts)</span>
                        <button
                            onClick={() => {
                                const toggleTo = pointsRedeemed === loyaltyBalance ? 0 : loyaltyBalance;
                                onSetPointsRedeemed(toggleTo);
                            }}
                            className={clsx(
                                "px-2 py-0.5 border rounded text-[9px] font-black transition-all",
                                pointsRedeemed > 0 ? "bg-app-info text-app-foreground border-indigo-600" : "bg-app-surface text-app-info border-indigo-100 hover:border-app-info"
                            )}
                        >
                            {pointsRedeemed > 0 ? `Redeeming ${pointsRedeemed}` : 'Redeem All'}
                        </button>
                    </div>
                )}
                {/* Tax Breakdown (inline compact) */}
                {taxLines && taxLines.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-app-border">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black tracking-widest text-app-muted-foreground">Tax Breakdown</span>
                            {onOpenTaxExplainer && (
                                <button onClick={onOpenTaxExplainer} className="flex items-center gap-1 text-[8px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors">
                                    <Eye size={10} /> Details
                                </button>
                            )}
                        </div>
                        {taxLines.map((line, idx) => {
                            const rate = typeof line.rate === 'number' ? line.rate : parseFloat(String(line.rate));
                            const amount = typeof line.amount === 'number' ? line.amount : parseFloat(String(line.amount));
                            return (
                                <div key={idx} className="flex justify-between items-center text-[9px]">
                                    <span className="text-app-muted-foreground font-bold">
                                        {line.type}{line.name ? ` (${line.name})` : ''}
                                        <span className="ml-1 opacity-60">{(rate * 100).toFixed(1)}%</span>
                                    </span>
                                    <span className="font-mono font-bold text-app-muted-foreground">{currency}{amount.toFixed(2)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-app-border">
                    <span className="text-app-foreground font-black tracking-widest">Total Pay</span>
                    <span className="text-app-foreground font-black text-base tabular-nums">{currency}{totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Cash Input */}
            <div className="space-y-2">
                <div className="relative">
                    <Banknote className="absolute left-3 top-[1.8rem] text-indigo-400" size={14} />
                    <label className="text-[7px] font-black text-app-muted-foreground block mb-1 tracking-widest">Cash Received</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder={totalAmount.toFixed(0)}
                        value={cashReceived ? Number(cashReceived.replace(/\D/g, '')).toLocaleString('fr-FR') : ''}
                        onChange={(e) => {
                            const numericValue = e.target.value.replace(/\s+/g, '').replace(/,/g, '.');
                            if (/^\d*\.?\d*$/.test(numericValue)) onSetCashReceived(numericValue);
                        }}
                        className="w-full pl-10 pr-3 py-3 bg-app-bg border border-app-border rounded-xl text-sm font-black text-app-foreground outline-none focus:bg-app-surface focus:border-app-info transition-all tabular-nums text-right"
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
                                ? 'bg-app-info border-indigo-600 text-app-foreground shadow-lg'
                                : 'bg-app-surface border-app-border text-app-muted-foreground hover:bg-app-bg'
                        )}
                    >
                        <m.icon size={16} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                    </button>
                ))}
            </div>

            {changeDue > 0 && onStoreChangeInWallet && (
                <label className="flex items-center gap-2 cursor-pointer mt-2 text-[10px] font-black tracking-widest text-app-info bg-app-info-soft p-2 rounded-xl hover:bg-app-info-soft transition-colors">
                    <input
                        type="checkbox"
                        checked={storeChangeInWallet}
                        onChange={(e) => onStoreChangeInWallet(e.target.checked)}
                        className="rounded border-app-info text-app-info focus:ring-app-info w-3 h-3"
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
                    className="w-full bg-app-info text-app-foreground rounded-xl h-14 flex flex-col items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-app-info active:scale-95 transition-all disabled:opacity-50"
                >
                    {isPending ? (
                        <div className="flex items-center gap-3"><Loader2 size={16} className="animate-spin" /> Processing...</div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3"><Save size={16} /> Complete Sale</div>
                            {changeDue > 0 && (
                                <span className="text-[9px] text-indigo-200 mt-0.5 opacity-90 tracking-widest">
                                    Change Due: {currency}{changeDue.toLocaleString('fr-FR', { minimumFractionDigits: 0 })}
                                </span>
                            )}
                        </>
                    )}
                </button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-bg transition-all font-black text-[8px] uppercase tracking-widest">
                        <History size={14} /> Multi
                    </button>
                    <button className="flex items-center justify-center gap-2 h-10 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-bg transition-all font-black text-[8px] uppercase tracking-widest">
                        <Truck size={14} /> Delivery
                    </button>
                </div>
            </div>
        </div>
    );
}
