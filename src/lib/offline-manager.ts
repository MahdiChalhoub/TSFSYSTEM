/**
 * Offline POS Manager Facade
 * ==========================
 * Provides a high-level API for components to handle offline state,
 * product caching, and background synchronization.
 */

import {
    cacheProducts,
    getCachedProducts,
    getCachedProductCount,
    queueOrder,
    getPendingOrderCount,
    getRecentSyncLogs,
    addSyncLog
} from './offline/db';

import {
    syncPendingOrders,
    startAutoSync,
    stopAutoSync,
    isOnline,
    forceSyncBeforeAction
} from './offline/sync';

export class OfflinePOSManager {
    private static onlineHandler: (() => void) | null = null;

    /**
     * Initialize offline subsystems
     */
    static init() {
        if (typeof window === 'undefined') return;

        console.log("🚀 Initializing Offline POS Manager...");
        startAutoSync();

        // Listen for online events to trigger immediate sync
        this.onlineHandler = () => {
            console.log("🌐 Connection restored! Triggering sync...");
            syncPendingOrders();
        };
        window.addEventListener('online', this.onlineHandler);
    }

    /**
     * Clean up event listeners (call on unmount)
     */
    static cleanup() {
        if (this.onlineHandler) {
            window.removeEventListener('online', this.onlineHandler);
            this.onlineHandler = null;
        }
        stopAutoSync();
    }

    /**
     * High-level Product Cache Refresh
     */
    static async refreshProductCatalog(products: Record<string, any>[]) {
        try {
            const mapped = products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.selling_price_ttc,
                taxRate: p.tva_rate,
                isTaxIncluded: true,
                sku: p.sku,
                category: p.category_name,
                stock: p.stock_level,
                cachedAt: Date.now()
            }));

            await cacheProducts(mapped);
            return true;
        } catch (error) {
            console.error("Failed to refresh product catalog", error);
            return false;
        }
    }

    /**
     * Submit an order with offline fallback
     */
    static async submitOrder(orderData: Record<string, any>, headers: Record<string, string>) {
        if (isOnline()) {
            try {
                // Try online first
                return await fetch('/api/v1/pos/orders/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify(orderData)
                });
            } catch (error) {
                console.warn("Online submission failed, falling back to queueing.", error);
            }
        }

        // Offline or online failure: queue it
        await queueOrder({ data: orderData, headers } as any);
        return { offline: true, message: "Order stored locally and will be synced when online." };
    }

    /**
     * Get stats for UI (e.g. status bar)
     */
    static async getStatus() {
        return {
            isOnline: isOnline(),
            cachedProducts: await getCachedProductCount(),
            pendingOrders: await getPendingOrderCount(),
            recentLogs: await getRecentSyncLogs(5)
        };
    }

    /**
     * Force clean-up before sensitive operations
     */
    static async prepareForAction() {
        return await forceSyncBeforeAction();
    }
}
