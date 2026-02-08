/**
 * React Hooks for POS Offline Mode
 * ==================================
 * Provides reactive state for online/offline status,
 * cached products, and pending order count.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { isOnline, syncPendingOrders, registerBackgroundSync, startAutoSync, stopAutoSync } from './sync';
import { getCachedProducts, getPendingOrderCount, type OfflineProduct } from './db';

// ── useOnlineStatus ─────────────────────────────────────────────

export function useOnlineStatus() {
    const [online, setOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        // Set initial state
        setOnline(isOnline());
        // Start auto-sync on mount if online
        if (isOnline()) startAutoSync();

        const handleOnline = () => {
            setOnline(true);
            setWasOffline(true);
            // Auto-sync when coming back online
            syncPendingOrders().catch(console.error);
            registerBackgroundSync().catch(console.error);
            startAutoSync(); // Resume periodic sync
        };

        const handleOffline = () => {
            setOnline(false);
            stopAutoSync(); // Pause periodic sync
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            stopAutoSync(); // Cleanup on unmount
        };
    }, []);

    const clearWasOffline = useCallback(() => setWasOffline(false), []);

    return { isOnline: online, wasOffline, clearWasOffline };
}

// ── useOfflineProducts ──────────────────────────────────────────

export function useOfflineProducts() {
    const [products, setProducts] = useState<OfflineProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const loadCached = useCallback(async () => {
        try {
            setLoading(true);
            const cached = await getCachedProducts();
            setProducts(cached);
        } catch (error) {
            console.error('Failed to load cached products:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCached();
    }, [loadCached]);

    return { products, loading, refresh: loadCached };
}

// ── usePendingOrders ────────────────────────────────────────────

export function usePendingOrders() {
    const [count, setCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    const refreshCount = useCallback(async () => {
        try {
            const c = await getPendingOrderCount();
            setCount(c);
        } catch {
            // IndexedDB not available
        }
    }, []);

    useEffect(() => {
        refreshCount();
        // Refresh count periodically
        const interval = setInterval(refreshCount, 5000);
        return () => clearInterval(interval);
    }, [refreshCount]);

    // Listen for sync complete messages from SW
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_COMPLETE') {
                refreshCount();
                setSyncing(false);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }, [refreshCount]);

    const triggerSync = useCallback(async () => {
        setSyncing(true);
        try {
            await syncPendingOrders();
            await refreshCount();
        } finally {
            setSyncing(false);
        }
    }, [refreshCount]);

    return { count, syncing, triggerSync, refreshCount };
}

// ── useOnlineOnlyMode ───────────────────────────────────────────
// Use on pages that MUST have live server data (inventory audits,
// accounting reconciliation). Blocks all operations if offline.

export function useOnlineOnlyMode(reason: string) {
    const { isOnline: online } = useOnlineStatus();
    const [active, setActive] = useState(false);
    const [blocked, setBlocked] = useState(false);

    const enable = useCallback(() => {
        try {
            const { enableOnlineOnlyMode: enable } = require('./sync');
            enable(reason);
            setActive(true);
            setBlocked(false);
        } catch {
            setBlocked(true);
        }
    }, [reason]);

    const disable = useCallback(() => {
        const { disableOnlineOnlyMode: disable } = require('./sync');
        disable();
        setActive(false);
        setBlocked(false);
    }, []);

    // If online-only is active and we go offline → blocked
    useEffect(() => {
        if (active && !online) {
            setBlocked(true);
        } else if (active && online) {
            setBlocked(false);
        }
    }, [active, online]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (active) {
                const { disableOnlineOnlyMode: disable } = require('./sync');
                disable();
            }
        };
    }, [active]);

    return { active, blocked, enable, disable };
}
