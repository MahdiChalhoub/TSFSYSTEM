'use client';

import { useEffect, useState, useCallback } from 'react';
import { SupermarcheThemeProvider } from '@/components/supermarche/engine/ThemeProvider';
import { SupermarcheLayoutGrid } from '@/components/supermarche/layouts/SupermarcheLayoutGrid';
import { SupermarcheLayoutKiosk } from '@/components/supermarche/layouts/SupermarcheLayoutKiosk';
import { SupermarcheLayoutExpress } from '@/components/supermarche/layouts/SupermarcheLayoutExpress';
import type { CartItem } from '@/components/supermarche/components/CartPanel';
import type { SupermarcheProduct } from '@/components/supermarche/layouts/SupermarcheLayoutGrid';
import type { ProductCategory } from '@/components/supermarche/components/CategoryRibbon';
import type { ThemeName } from '@/components/supermarche/engine/themes';
import { ShoppingCart, Monitor, Zap } from 'lucide-react';
import '../../../../styles/supermarche/theme-engine.css';
import '../../../../styles/supermarche/animations.css';

// ── Layout types ───────────────────────────────────────────
type LayoutMode = 'grid' | 'kiosk' | 'express';

// ── Demo data (will be replaced by real server actions) ────
const DEMO_CATEGORIES: ProductCategory[] = [
    { id: 'fresh', name: 'Fresh', icon: '🥦', count: 24 },
    { id: 'dairy', name: 'Dairy', icon: '🧀', count: 18 },
    { id: 'bakery', name: 'Bakery', icon: '🥖', count: 12 },
    { id: 'drinks', name: 'Drinks', icon: '🥤', count: 30 },
    { id: 'snacks', name: 'Snacks', icon: '🍿', count: 15 },
    { id: 'frozen', name: 'Frozen', icon: '🧊', count: 9 },
    { id: 'hygiene', name: 'Hygiene', icon: '🧴', count: 21 },
];

const DEMO_PRODUCTS: SupermarcheProduct[] = [
    { id: '1', name: 'Organic Bananas', price: 1200, originalPrice: 1500, category_id: 'fresh', barcode: '011', unit: 'kg', promotion: 'DISCOUNT', promotionValue: 20, stock: 3 },
    { id: '2', name: 'Whole Milk 1L', price: 800, category_id: 'dairy', barcode: '012', unit: 'L' },
    { id: '3', name: 'Sourdough Bread', price: 1500, originalPrice: 1800, category_id: 'bakery', barcode: '013', promotion: 'FLASH' },
    { id: '4', name: 'Orange Juice 1L', price: 2200, category_id: 'drinks', barcode: '014', unit: 'L' },
    { id: '5', name: 'Lay\'s Classic 150g', price: 600, category_id: 'snacks', barcode: '015' },
    { id: '6', name: 'Tomato Paste 70g', price: 300, category_id: 'fresh', barcode: '016', stock: 2 },
    { id: '7', name: 'Greek Yogurt 500g', price: 1800, category_id: 'dairy', barcode: '017' },
    { id: '8', name: 'Frozen Pizza', price: 4500, originalPrice: 5500, category_id: 'frozen', barcode: '018', promotion: 'DISCOUNT', promotionValue: 18 },
    { id: '9', name: 'Shampoo 400ml', price: 2800, category_id: 'hygiene', barcode: '019' },
    { id: '10', name: 'Diet Coke 6-pack', price: 3200, category_id: 'drinks', barcode: '020', promotion: 'BUNDLE' },
    { id: '11', name: 'Avocado ×2', price: 1000, category_id: 'fresh', barcode: '021' },
    { id: '12', name: 'Cheddar Cheese 200g', price: 2100, category_id: 'dairy', barcode: '022' },
];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-CI', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

async function handleCheckout(items: CartItem[]): Promise<void> {
    // TODO: wire to actual POS session checkout server action
    console.log('Checkout:', items);
    await new Promise((r) => setTimeout(r, 1000));
}

// ── Layout Switcher ────────────────────────────────────────
function LayoutSwitcher({
    active,
    onChange,
}: {
    active: LayoutMode;
    onChange: (m: LayoutMode) => void;
}) {
    const modes: { id: LayoutMode; label: string; icon: React.ReactNode }[] = [
        { id: 'grid', label: 'Grid', icon: <ShoppingCart size={14} /> },
        { id: 'kiosk', label: 'Kiosk', icon: <Monitor size={14} /> },
        { id: 'express', label: 'Express', icon: <Zap size={14} /> },
    ];

    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full px-2 py-1.5"
            style={{
                background: 'var(--sm-surface)',
                border: '1px solid var(--sm-border)',
                boxShadow: 'var(--sm-shadow)',
                backdropFilter: 'var(--sm-backdrop)',
            }}
        >
            {modes.map((m) => (
                <button
                    key={m.id}
                    onClick={() => onChange(m.id)}
                    aria-label={`Switch to ${m.label} layout`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                    style={{
                        background: active === m.id ? 'var(--sm-primary)' : 'transparent',
                        color: active === m.id ? '#fff' : 'var(--sm-text-muted)',
                        fontFamily: 'var(--sm-font)',
                    }}
                >
                    {m.icon}
                    {m.label}
                </button>
            ))}
        </div>
    );
}

// ── Main Client Component ──────────────────────────────────
export function SupermarcheClient() {
    const [layout, setLayout] = useState<LayoutMode>('grid');
    const [initialTheme] = useState<ThemeName>(() => {
        if (typeof window === 'undefined') return 'midnight-pro';
        return (localStorage.getItem('supermarche-theme') as ThemeName) || 'midnight-pro';
    });

    const commonProps = {
        products: DEMO_PRODUCTS,
        orgName: 'Dajingo Market',
        formatCurrency,
        onCheckout: handleCheckout,
    };

    return (
        <SupermarcheThemeProvider defaultTheme={initialTheme}>
            {layout === 'grid' && (
                <SupermarcheLayoutGrid {...commonProps} categories={DEMO_CATEGORIES} />
            )}
            {layout === 'kiosk' && (
                <SupermarcheLayoutKiosk {...commonProps} />
            )}
            {layout === 'express' && (
                <SupermarcheLayoutExpress {...commonProps} />
            )}

            {/* Layout switcher — floating pill at bottom center */}
            <LayoutSwitcher active={layout} onChange={setLayout} />
        </SupermarcheThemeProvider>
    );
}
