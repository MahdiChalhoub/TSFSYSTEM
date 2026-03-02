'use client';

import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    unit?: string;
    discount?: number;
}

interface CartPanelProps {
    items: CartItem[];
    onQtyChange: (id: string, qty: number) => void;
    onRemove: (id: string) => void;
    formatCurrency: (amount: number) => string;
}

export function CartPanel({ items, onQtyChange, onRemove, formatCurrency }: CartPanelProps) {
    const subtotal = items.reduce((sum, item) => {
        const price = item.discount
            ? item.price * (1 - item.discount / 100)
            : item.price;
        return sum + price * item.qty;
    }, 0);

    if (items.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center h-full gap-3 py-12"
                style={{ color: 'var(--sm-text-muted)', fontFamily: 'var(--sm-font)' }}
            >
                <ShoppingCart size={40} style={{ opacity: 0.3 }} />
                <p className="text-sm font-medium" style={{ color: 'var(--sm-text-subtle)' }}>
                    Cart is empty
                </p>
                <p className="text-xs" style={{ color: 'var(--sm-text-subtle)' }}>
                    Scan a product to start
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-3">
                <div className="flex items-center gap-2">
                    <ShoppingCart size={16} style={{ color: 'var(--sm-primary)' }} />
                    <span
                        className="text-sm font-bold"
                        style={{ color: 'var(--sm-text)', fontFamily: 'var(--sm-font)' }}
                    >
                        Cart
                    </span>
                </div>
                <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'var(--sm-primary-glow)', color: 'var(--sm-primary)', fontFamily: 'var(--sm-font)' }}
                >
                    {items.reduce((s, i) => s + i.qty, 0)} items
                </span>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded-lg sm-anim-fade-in sm-stagger-${Math.min(idx + 1, 5)}`}
                        style={{
                            background: 'var(--sm-surface-2)',
                            border: '1px solid var(--sm-border)',
                            fontFamily: 'var(--sm-font)',
                        }}
                    >
                        {/* Name + price */}
                        <div className="flex-1 min-w-0">
                            <p
                                className="text-xs font-semibold truncate"
                                style={{ color: 'var(--sm-text)' }}
                            >
                                {item.name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--sm-text-muted)' }}>
                                {item.discount ? (
                                    <>
                                        <span style={{ color: 'var(--sm-danger)', textDecoration: 'line-through', marginRight: 4 }}>
                                            {formatCurrency(item.price)}
                                        </span>
                                        {formatCurrency(item.price * (1 - item.discount / 100))}
                                    </>
                                ) : formatCurrency(item.price)}
                                {item.unit && ` / ${item.unit}`}
                            </p>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => item.qty > 1 ? onQtyChange(item.id, item.qty - 1) : onRemove(item.id)}
                                aria-label="Decrease quantity"
                                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                style={{ background: 'var(--sm-surface)', color: 'var(--sm-text-muted)' }}
                            >
                                <Minus size={10} />
                            </button>
                            <span
                                className="w-7 text-center text-xs font-bold"
                                style={{ color: 'var(--sm-text)' }}
                            >
                                {item.qty}
                            </span>
                            <button
                                onClick={() => onQtyChange(item.id, item.qty + 1)}
                                aria-label="Increase quantity"
                                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                style={{ background: 'var(--sm-primary)', color: '#fff' }}
                            >
                                <Plus size={10} />
                            </button>
                        </div>

                        {/* Line total */}
                        <p
                            className="text-xs font-bold w-14 text-right"
                            style={{ color: 'var(--sm-text)' }}
                        >
                            {formatCurrency(
                                (item.discount
                                    ? item.price * (1 - item.discount / 100)
                                    : item.price) * item.qty
                            )}
                        </p>

                        {/* Remove */}
                        <button
                            onClick={() => onRemove(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                            style={{ color: 'var(--sm-text-subtle)' }}
                        >
                            <Trash2 size={11} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Subtotal */}
            <div
                className="mt-2 pt-2 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--sm-border)', fontFamily: 'var(--sm-font)' }}
            >
                <span className="text-sm font-medium" style={{ color: 'var(--sm-text-muted)' }}>
                    Subtotal
                </span>
                <span className="text-base font-black" style={{ color: 'var(--sm-text)' }}>
                    {formatCurrency(subtotal)}
                </span>
            </div>
        </div>
    );
}
