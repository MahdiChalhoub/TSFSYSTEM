/**
 * React Hooks for POS Offline Mode
 * ==================================
 * Provides reactive state for online/offline status,
 * cached products, and pending order count.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { isOnline, syncPendingOrders, registerBackgroundSync } from './sync';
import { getCachedProducts, getPendingOrderCount, type OfflineProduct } from './db';

// ── useOnlineStatus ─────────────────────────────────────────────

export function useOnlineStatus() {
    const [online, setOnline] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        // Set initial state
        setOnline(isOnline());

        const handleOnline = () => {
            setOnline(true);
            setWasOffline(true);
            // Auto-sync when coming back online
            syncPendingOrders().catch(console.error);
            registerBackgroundSync().catch(console.error);
        };

        const handleOffline = () => {
            setOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
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
