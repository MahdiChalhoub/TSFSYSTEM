'use client';

import { CreditCard, Loader2, ChevronRight } from 'lucide-react';

interface CheckoutBarProps {
    total: number;
    itemCount: number;
    taxAmount?: number;
    onCharge: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    formatCurrency: (amount: number) => string;
}

export function CheckoutBar({
    total,
    itemCount,
    taxAmount,
    onCharge,
    isLoading = false,
    disabled = false,
    formatCurrency,
}: CheckoutBarProps) {
    return (
        <div
            className="rounded-xl p-3 flex flex-col gap-2 sm-anim-slide-bottom"
            style={{
                background: 'var(--sm-cart-total-bg)',
                fontFamily: 'var(--sm-font)',
                boxShadow: 'var(--sm-shadow-glow)',
            }}
        >
            {/* Summary row */}
            <div className="flex items-center justify-between px-1">
                <div>
                    {taxAmount !== undefined && taxAmount > 0 && (
                        <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            Tax: {formatCurrency(taxAmount)}
                        </p>
                    )}
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        TOTAL
                    </p>
                    <p className="text-3xl font-black tracking-tight text-white">
                        {formatCurrency(total)}
                    </p>
                </div>
            </div>

            {/* Charge button */}
            <button
                onClick={onCharge}
                disabled={disabled || isLoading || itemCount === 0}
                aria-label={`Checkout — Total ${formatCurrency(total)}`}
                className="w-full h-14 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: 'rgba(255,255,255,0.95)',
                    color: 'var(--sm-primary-dark, #059669)',
                }}
            >
                {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : (
                    <>
                        <CreditCard size={20} />
                        <span>Charge</span>
                        <ChevronRight size={18} />
                    </>
                )}
            </button>
        </div>
    );
}
