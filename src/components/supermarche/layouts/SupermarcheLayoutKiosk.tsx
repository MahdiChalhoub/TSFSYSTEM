'use client';

import { useState, useCallback, useEffect } from 'react';
import { ProductScanBar } from '../components/ProductScanBar';
import { CartPanel, type CartItem } from '../components/CartPanel';
import { CheckoutBar } from '../components/CheckoutBar';
import { PriceDisplay } from '../components/PriceDisplay';
import { SupermarcheNumpad } from '../components/SupermarcheNumpad';
import { PromotionBadge } from '../components/PromotionBadge';
import type { SupermarcheProduct } from './SupermarcheLayoutGrid';
import { Scan, ShoppingBag } from 'lucide-react';

interface SupermarcheLayoutKioskProps {
    products: SupermarcheProduct[];
    orgName: string;
    formatCurrency: (amount: number) => string;
    onCheckout: (items: CartItem[]) => Promise<void>;
}

export function SupermarcheLayoutKiosk({
    products,
    orgName,
    formatCurrency,
    onCheckout,
}: SupermarcheLayoutKioskProps) {
    const [scanQuery, setScanQuery] = useState('');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [lastAdded, setLastAdded] = useState<SupermarcheProduct | null>(null);
    const [numpadValue, setNumpadValue] = useState('1');
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const clearLastAdded = () => {
        setTimeout(() => setLastAdded(null), 3000);
    };

    const addToCart = useCallback((product: SupermarcheProduct, qty = 1) => {
        setCartItems((prev) => {
            const existing = prev.find((i) => i.id === product.id);
            if (existing) {
                return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
            }
            return [...prev, { id: product.id, name: product.name, price: product.price, qty, unit: product.unit }];
        });
        setLastAdded(product);
        clearLastAdded();
    }, []);

    const handleScan = useCallback((code: string) => {
        const product = products.find((p) => p.barcode === code);
        if (product) {
            const qty = parseInt(numpadValue, 10) || 1;
            addToCart(product, qty);
            setScanQuery('');
            setNumpadValue('1');
        }
    }, [products, addToCart, numpadValue]);

    const handleNumpad = (key: string) => {
        setNumpadValue((v) => {
            if (key === '.' && v.includes('.')) return v;
            if (v === '0') return key;
            return (v + key).slice(0, 6);
        });
    };

    const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    return (
        <div
            className="supermarche-root flex flex-col h-screen overflow-hidden select-none"
            style={{ fontFamily: 'var(--sm-font)' }}
        >
            {/* ── KIOSK HEADER ── */}
            <header
                className="flex items-center justify-center py-4 flex-shrink-0"
                style={{ background: 'var(--sm-surface)', borderBottom: '1px solid var(--sm-border)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--sm-primary-glow)' }}
                    >
                        <ShoppingBag size={20} style={{ color: 'var(--sm-primary)' }} />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-black" style={{ color: 'var(--sm-text)' }}>{orgName}</p>
                        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--sm-text-muted)' }}>
                            Self-Checkout Kiosk
                        </p>
                    </div>
                </div>
            </header>

            {/* ── MAIN BODY ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT: Scan + Last item + Numpad ── */}
                <div className="flex-1 flex flex-col p-6 gap-5">
                    {/* Scan bar — large for kiosk */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--sm-text-muted)' }}>
                            <Scan size={14} /> Scan Product
                        </p>
                        <div style={{ fontSize: '1.1rem' }}>
                            <ProductScanBar
                                value={scanQuery}
                                onChange={setScanQuery}
                                onScan={handleScan}
                                placeholder="Scan barcode..."
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Last scanned product */}
                    <div
                        className="flex-1 rounded-2xl p-6 flex flex-col justify-center items-center gap-4"
                        style={{
                            background: 'var(--sm-surface)',
                            border: '1px solid var(--sm-border)',
                            minHeight: 200,
                        }}
                    >
                        {lastAdded ? (
                            <>
                                <div className="text-6xl">{lastAdded.image || '🛒'}</div>
                                <div className="text-center">
                                    <p className="text-lg font-bold" style={{ color: 'var(--sm-text)' }}>
                                        {lastAdded.name}
                                    </p>
                                    {lastAdded.promotion && (
                                        <div className="flex justify-center mt-1">
                                            <PromotionBadge type={lastAdded.promotion} value={lastAdded.promotionValue} />
                                        </div>
                                    )}
                                </div>
                                <PriceDisplay
                                    price={lastAdded.price}
                                    originalPrice={lastAdded.originalPrice}
                                    size="lg"
                                    label="Unit price"
                                    formatCurrency={formatCurrency}
                                />
                            </>
                        ) : (
                            <div className="text-center" style={{ color: 'var(--sm-text-subtle)' }}>
                                <Scan size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                                <p className="text-sm">Scan an item to begin</p>
                            </div>
                        )}
                    </div>

                    {/* Qty numpad */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--sm-text-muted)' }}>
                            Quantity
                        </p>
                        <SupermarcheNumpad
                            onPress={handleNumpad}
                            onDelete={() => setNumpadValue((v) => v.slice(0, -1) || '0')}
                            onClear={() => setNumpadValue('0')}
                            onEnter={() => {
                                if (lastAdded) {
                                    const qty = parseFloat(numpadValue) || 1;
                                    addToCart(lastAdded, qty);
                                }
                            }}
                            display={numpadValue}
                            showDisplay
                        />
                    </div>
                </div>

                {/* ── RIGHT: Cart + Checkout ── */}
                <aside
                    className="w-[340px] flex-shrink-0 flex flex-col p-5 gap-4"
                    style={{ background: 'var(--sm-surface)', borderLeft: '1px solid var(--sm-border)' }}
                >
                    <div className="flex-1 overflow-hidden">
                        <CartPanel
                            items={cartItems}
                            onQtyChange={(id, qty) => setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i))}
                            onRemove={(id) => setCartItems((prev) => prev.filter((i) => i.id !== id))}
                            formatCurrency={formatCurrency}
                        />
                    </div>
                    <CheckoutBar
                        total={total}
                        itemCount={cartItems.reduce((s, i) => s + i.qty, 0)}
                        onCharge={async () => {
                            setIsCheckingOut(true);
                            await onCheckout(cartItems);
                            setCartItems([]);
                            setIsCheckingOut(false);
                        }}
                        isLoading={isCheckingOut}
                        disabled={cartItems.length === 0}
                        formatCurrency={formatCurrency}
                    />
                </aside>
            </div>
        </div>
    );
}
