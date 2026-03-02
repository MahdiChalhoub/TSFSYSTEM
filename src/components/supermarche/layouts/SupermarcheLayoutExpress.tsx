'use client';

import { useState, useCallback } from 'react';
import { ProductScanBar } from '../components/ProductScanBar';
import { CartPanel, type CartItem } from '../components/CartPanel';
import { CheckoutBar } from '../components/CheckoutBar';
import type { SupermarcheProduct } from './SupermarcheLayoutGrid';
import { Zap } from 'lucide-react';

interface SupermarcheLayoutExpressProps {
 products: SupermarcheProduct[];
 orgName: string;
 formatCurrency: (amount: number) => string;
 onCheckout: (items: CartItem[]) => Promise<void>;
}

export function SupermarcheLayoutExpress({
 products,
 orgName,
 formatCurrency,
 onCheckout,
}: SupermarcheLayoutExpressProps) {
 const [scanQuery, setScanQuery] = useState('');
 const [cartItems, setCartItems] = useState<CartItem[]>([]);
 const [isCheckingOut, setIsCheckingOut] = useState(false);

 const handleScan = useCallback((code: string) => {
 const product = products.find((p) =>
 p.barcode === code || p.name.toLowerCase().includes(code.toLowerCase())
 );
 if (!product) return;

 setCartItems((prev) => {
 const existing = prev.find((i) => i.id === product.id);
 if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
 return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, unit: product.unit }];
 });
 setScanQuery('');
 }, [products]);

 const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

 return (
 <div
 className="supermarche-root flex flex-col h-screen overflow-hidden"
 style={{ fontFamily: 'var(--sm-font)', maxWidth: 600, margin: '0 auto' }}
 >
 {/* Header */}
 <header
 className="flex items-center justify-between px-5 py-3 flex-shrink-0"
 style={{ background: 'var(--sm-surface)', borderBottom: '1px solid var(--sm-border)' }}
 >
 <div className="flex items-center gap-2">
 <div
 className="w-8 h-8 rounded-lg flex items-center justify-center"
 style={{ background: 'var(--sm-accent-glow)' }}
 >
 <Zap size={16} style={{ color: 'var(--sm-accent)' }} />
 </div>
 <div>
 <p className="text-sm font-black" style={{ color: 'var(--sm-text)' }}>
 Express Lane
 </p>
 <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--sm-text-muted)' }}>
 {orgName}
 </p>
 </div>
 </div>

 <span
 className="text-xs font-bold px-2.5 py-1 rounded-full"
 style={{ background: 'var(--sm-accent-glow)', color: 'var(--sm-accent)' }}
 >
 Fast Checkout
 </span>
 </header>

 {/* Scan bar — full width, dominant */}
 <div className="px-4 pt-4 pb-2 flex-shrink-0">
 <ProductScanBar
 value={scanQuery}
 onChange={setScanQuery}
 onScan={handleScan}
 placeholder="Scan barcode to add item..."
 autoFocus
 />
 <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--sm-text-subtle)' }}>
 {products.length} products available — press Enter to scan
 </p>
 </div>

 {/* Cart — takes remaining height */}
 <div className="flex-1 overflow-hidden px-4 py-2">
 <CartPanel
 items={cartItems}
 onQtyChange={(id, qty) => setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i))}
 onRemove={(id) => setCartItems((prev) => prev.filter((i) => i.id !== id))}
 formatCurrency={formatCurrency}
 />
 </div>

 {/* Checkout — fixed bottom */}
 <div className="px-4 pb-4 flex-shrink-0">
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
 </div>
 </div>
 );
}
