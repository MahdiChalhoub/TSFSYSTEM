'use client';

import { useState, useCallback } from 'react';
import { ProductScanBar } from '../components/ProductScanBar';
import { CartPanel, type CartItem } from '../components/CartPanel';
import { CategoryRibbon, type ProductCategory } from '../components/CategoryRibbon';
import { CheckoutBar } from '../components/CheckoutBar';
import { PromotionBadge } from '../components/PromotionBadge';
import { ThemeSelectorTrigger } from '../engine/ThemeSelector';
import { Store, BarChart3 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────
export interface SupermarcheProduct {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    category_id: string;
    barcode?: string;
    image?: string;
    unit?: string;
    stock?: number;
    promotion?: 'DISCOUNT' | 'BUNDLE' | 'FLASH' | 'CLEARANCE';
    promotionValue?: number;
}

interface SupermarcheLayoutGridProps {
    products: SupermarcheProduct[];
    categories: ProductCategory[];
    orgName: string;
    formatCurrency: (amount: number) => string;
    onCheckout: (items: CartItem[]) => Promise<void>;
}

// ── Product Card ───────────────────────────────────────────
function ProductCard({
    product,
    onAdd,
    formatCurrency,
    index,
}: {
    product: SupermarcheProduct;
    onAdd: (p: SupermarcheProduct) => void;
    formatCurrency: (n: number) => string;
    index: number;
}) {
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;

    return (
        <button
            onClick={() => onAdd(product)}
            aria-label={`Add ${product.name} to cart`}
            className={`group relative flex flex-col rounded-xl p-3 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] sm-anim-fade-in sm-stagger-${Math.min(index + 1, 5)}`}
            style={{
                background: 'var(--sm-surface)',
                border: '1px solid var(--sm-border)',
                boxShadow: 'var(--sm-shadow-sm)',
                fontFamily: 'var(--sm-font)',
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sm-primary)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--sm-shadow-glow)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sm-border)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--sm-shadow-sm)';
            }}
        >
            {/* Promotion badge */}
            {product.promotion && (
                <div className="absolute top-2 left-2 z-10">
                    <PromotionBadge type={product.promotion} value={product.promotionValue} size="sm" pulse />
                </div>
            )}

            {/* Product image / placeholder */}
            <div
                className="w-full h-20 rounded-lg mb-2 flex items-center justify-center text-3xl"
                style={{ background: 'var(--sm-surface-2)' }}
            >
                {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : '🛒'}
            </div>

            {/* Name */}
            <p className="text-xs font-semibold line-clamp-2 leading-tight flex-1" style={{ color: 'var(--sm-text)' }}>
                {product.name}
            </p>

            {/* Price */}
            <div className="mt-2 flex items-center justify-between">
                <div>
                    <span className="text-sm font-black" style={{ color: hasDiscount ? 'var(--sm-danger)' : 'var(--sm-primary)' }}>
                        {formatCurrency(product.price)}
                    </span>
                    {hasDiscount && product.originalPrice && (
                        <span className="text-[10px] ml-1 line-through" style={{ color: 'var(--sm-text-subtle)' }}>
                            {formatCurrency(product.originalPrice)}
                        </span>
                    )}
                </div>
                {product.stock !== undefined && product.stock < 5 && product.stock > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--sm-accent-glow)', color: 'var(--sm-accent)' }}>
                        {product.stock} left
                    </span>
                )}
            </div>
        </button>
    );
}

// ── Grid Layout ────────────────────────────────────────────
export function SupermarcheLayoutGrid({
    products,
    categories,
    orgName,
    formatCurrency,
    onCheckout,
}: SupermarcheLayoutGridProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // Filter products
    const filtered = products.filter((p) => {
        const matchesCat = !activeCategoryId || p.category_id === activeCategoryId;
        const matchesSearch = !searchQuery
            || p.name.toLowerCase().includes(searchQuery.toLowerCase())
            || p.barcode === searchQuery;
        return matchesCat && matchesSearch;
    });

    const addToCart = useCallback((product: SupermarcheProduct) => {
        setCartItems((prev) => {
            const existing = prev.find((i) => i.id === product.id);
            if (existing) {
                return prev.map((i) =>
                    i.id === product.id ? { ...i, qty: i.qty + 1 } : i
                );
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                price: product.price,
                qty: 1,
                unit: product.unit,
                discount: product.originalPrice && product.originalPrice > product.price
                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                    : undefined,
            }];
        });
    }, []);

    const handleScan = useCallback((code: string) => {
        const product = products.find((p) => p.barcode === code || p.name.toLowerCase() === code.toLowerCase());
        if (product) {
            addToCart(product);
            setSearchQuery('');
        }
    }, [products, addToCart]);

    const handleQtyChange = useCallback((id: string, qty: number) => {
        setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
    }, []);

    const handleRemove = useCallback((id: string) => {
        setCartItems((prev) => prev.filter((i) => i.id !== id));
    }, []);

    const handleCheckout = async () => {
        if (cartItems.length === 0) return;
        setIsCheckingOut(true);
        try {
            await onCheckout(cartItems);
            setCartItems([]);
        } finally {
            setIsCheckingOut(false);
        }
    };

    const total = cartItems.reduce((sum, item) => {
        const price = item.discount ? item.price * (1 - item.discount / 100) : item.price;
        return sum + price * item.qty;
    }, 0);

    return (
        <div
            className="supermarche-root flex flex-col h-screen overflow-hidden"
            style={{ fontFamily: 'var(--sm-font)' }}
        >
            {/* ── TOPBAR ── */}
            <header
                className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
                style={{
                    background: 'var(--sm-surface)',
                    borderBottom: '1px solid var(--sm-border)',
                    boxShadow: 'var(--sm-shadow-sm)',
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--sm-primary-glow)' }}
                    >
                        <Store size={18} style={{ color: 'var(--sm-primary)' }} />
                    </div>
                    <div>
                        <p className="text-sm font-black tracking-tight" style={{ color: 'var(--sm-text)' }}>
                            {orgName}
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--sm-text-muted)' }}>
                            Supermarché POS
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Theme switcher */}
                    <ThemeSelectorTrigger />
                    {/* Stats */}
                    <button
                        className="sm-btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                    >
                        <BarChart3 size={14} />
                        <span className="hidden sm:inline">Today</span>
                    </button>
                </div>
            </header>

            {/* ── MAIN BODY — 3-column grid ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT: Product Browser ── */}
                <main className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
                    {/* Scan bar */}
                    <ProductScanBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onScan={handleScan}
                        autoFocus
                    />

                    {/* Category ribbon */}
                    <CategoryRibbon
                        categories={categories}
                        activeId={activeCategoryId}
                        onSelect={setActiveCategoryId}
                    />

                    {/* Product grid */}
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div
                                className="h-full flex flex-col items-center justify-center gap-3"
                                style={{ color: 'var(--sm-text-muted)' }}
                            >
                                <p className="text-4xl">🔍</p>
                                <p className="text-sm font-medium">No products found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pb-3">
                                {filtered.map((product, idx) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onAdd={addToCart}
                                        formatCurrency={formatCurrency}
                                        index={idx}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                {/* ── RIGHT: Cart + Checkout ── */}
                <aside
                    className="w-[300px] xl:w-[340px] flex-shrink-0 flex flex-col p-3 gap-3 sm-anim-slide-right"
                    style={{
                        background: 'var(--sm-surface)',
                        borderLeft: '1px solid var(--sm-border)',
                    }}
                >
                    <div className="flex-1 overflow-hidden">
                        <CartPanel
                            items={cartItems}
                            onQtyChange={handleQtyChange}
                            onRemove={handleRemove}
                            formatCurrency={formatCurrency}
                        />
                    </div>

                    <CheckoutBar
                        total={total}
                        itemCount={cartItems.reduce((s, i) => s + i.qty, 0)}
                        onCharge={handleCheckout}
                        isLoading={isCheckingOut}
                        disabled={cartItems.length === 0}
                        formatCurrency={formatCurrency}
                    />
                </aside>
            </div>
        </div>
    );
}
