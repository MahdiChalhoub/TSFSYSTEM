'use client';

/**
 * useBarcodeScanner — Hardware Barcode Scanner Integration
 * =========================================================
 * Listens for rapid-fire keystrokes (scanner input at <80ms gaps),
 * buffers them, and on Enter resolves the barcode against:
 *   1. In-memory product index (O(1), 0ms)
 *   2. Backend API search (fallback)
 *
 * Also handles keyboard shortcuts: F2 (charge), F4 (search focus),
 * Delete (clear cart), Escape (close modals).
 *
 * Uses refs exclusively for buffer state to avoid re-render thrashing.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { TerminalState } from '@/hooks/pos/useTerminal';
import { erpFetch } from '@/lib/erp-api';

const BARCODE_GAP_MS = 80;

const playSound = (type: 'beep' | 'error' | 'success') => {
    try {
        const file = type === 'beep' ? 'scan.mp3' : type === 'error' ? 'error.mp3' : 'success.mp3';
        new Audio(`/sounds/${file}`).play().catch(() => { });
    } catch { }
};

export function useBarcodeScanner(terminal: TerminalState) {
    // Stable refs so the keydown handler always reads the latest state
    const addToCartRef = useRef(terminal.addToCart);
    const onProductsLoadedRef = useRef(terminal.onProductsLoaded);
    const handleChargeRef = useRef(terminal.handleCharge);
    const clearCartRef = useRef(terminal.clearCart);
    const setSearchQueryRef = useRef(terminal.setSearchQuery);
    const cartLengthRef = useRef(terminal.cart.length);
    const productIndexRef = useRef(terminal.productIndex);
    const setIsOverrideOpenRef = useRef(terminal.setIsOverrideOpen);
    const setIsReceiptOpenRef = useRef(terminal.setIsReceiptOpen);

    // Sync refs on every render
    addToCartRef.current = terminal.addToCart;
    onProductsLoadedRef.current = terminal.onProductsLoaded;
    handleChargeRef.current = terminal.handleCharge;
    clearCartRef.current = terminal.clearCart;
    setSearchQueryRef.current = terminal.setSearchQuery;
    cartLengthRef.current = terminal.cart.length;
    productIndexRef.current = terminal.productIndex;
    setIsOverrideOpenRef.current = terminal.setIsOverrideOpen;
    setIsReceiptOpenRef.current = terminal.setIsReceiptOpen;

    useEffect(() => {
        let buffer = '';
        let lastKeyTime = 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

            // ── Named shortcuts ──
            if (e.key === 'F2') { e.preventDefault(); handleChargeRef.current(); return; }
            if (e.key === 'Escape' && !inInput) {
                e.preventDefault();
                setIsOverrideOpenRef.current(false);
                setIsReceiptOpenRef.current(false);
                setSearchQueryRef.current('');
                return;
            }
            if (e.key === 'F4') {
                e.preventDefault();
                const si = document.getElementById('pos-product-search') as HTMLInputElement | null
                    || document.querySelector('input[placeholder*="Search product"]') as HTMLInputElement | null;
                if (si) { si.focus(); si.select(); }
                return;
            }
            if (e.key === 'Delete' && !inInput) {
                e.preventDefault();
                if (cartLengthRef.current > 0) { clearCartRef.current(); toast.info('Cart cleared via shortcut'); }
                return;
            }

            // ── Barcode scanner detection ──
            if (now - lastKeyTime > BARCODE_GAP_MS && buffer.length > 0) buffer = '';
            lastKeyTime = now;

            if (e.key === 'Enter' && buffer.length >= 3) {
                e.preventDefault();
                const code = buffer.trim();
                buffer = '';

                const si = document.getElementById('pos-product-search') as HTMLInputElement | null;
                if (si) si.value = '';

                // Path 1: In-memory index
                const idx = productIndexRef.current.current;
                const cached = idx.get(code) || idx.get(code.toLowerCase());
                if (cached) { addToCartRef.current(cached); return; }

                // Path 2: API search
                erpFetch(`products/search_enhanced/?query=${encodeURIComponent(code)}&limit=2`)
                    .then((data: any) => {
                        const results: any[] = Array.isArray(data) ? data : data?.results || [];
                        if (results.length === 1) {
                            onProductsLoadedRef.current(results);
                            addToCartRef.current(results[0]);
                        } else if (results.length > 1) {
                            setSearchQueryRef.current(code);
                            if (si) { si.value = code; si.focus(); }
                        } else {
                            playSound('error');
                            toast.error(`"${code}" not found`, { duration: 2500 });
                        }
                    })
                    .catch(() => { playSound('error'); toast.error('Scanner error — check connection'); });
                return;
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                buffer += e.key;
                if (!inInput) {
                    e.preventDefault();
                    const si = document.getElementById('pos-product-search') as HTMLInputElement | null;
                    if (si) {
                        si.focus();
                        si.value = buffer.length === 1 ? e.key : si.value + e.key;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []); // Empty deps — all state accessed via refs
}
