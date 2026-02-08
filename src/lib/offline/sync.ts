/**
 * Sync Manager for POS Offline Mode
 * ====================================
 * Handles syncing pending orders to the backend when connectivity resumes.
 * Supports both Background Sync API and manual poll-based sync.
 */

import {
    getPendingOrders,
    updateOrderStatus,
    deleteOrder,
    addSyncLog,
    type PendingOrder,
} from './db';

const MAX_RETRIES = 3;

// ── Connection Status ───────────────────────────────────────────

export function isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
}

// ── Register Background Sync ────────────────────────────────────

export async function registerBackgroundSync(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-pending-orders');
        return true;
    } catch {
        return false;
    }
}

// ── Manual Sync: Replay pending orders ──────────────────────────

export async function syncPendingOrders(): Promise<{
    synced: number;
    failed: number;
    total: number;
}> {
    const pending = await getPendingOrders();

    if (pending.length === 0) {
        return { synced: 0, failed: 0, total: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const order of pending) {
        if (!isOnline()) {
            // Stop syncing if we lost connection mid-sync
            break;
        }

        try {
            await updateOrderStatus(order.id!, 'syncing');

            const response = await fetch('/api/v1/pos/orders/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...order.headers,
                },
                body: JSON.stringify(order.data),
            });

            if (response.ok) {
                await deleteOrder(order.id!);
                synced++;
            } else {
                const errorText = await response.text().catch(() => 'Unknown error');
                await handleSyncFailure(order, `HTTP ${response.status}: ${errorText}`);
                failed++;
            }
        } catch (error) {
            await handleSyncFailure(order, String(error));
            failed++;
        }
    }

    await addSyncLog({
        action: 'sync',
        module: 'orders',
        detail: `Sync complete: ${synced} synced, ${failed} failed`,
        timestamp: Date.now(),
        ordersCount: synced,
    });

    return { synced, failed, total: pending.length };
}

async function handleSyncFailure(order: PendingOrder, error: string): Promise<void> {
    const retryCount = (order.retryCount || 0) + 1;

    if (retryCount >= MAX_RETRIES) {
        await updateOrderStatus(order.id!, 'failed', error);
        await addSyncLog({
            action: 'error',
            module: 'orders',
            detail: `Order ${order.id} permanently failed after ${MAX_RETRIES} retries: ${error}`,
            timestamp: Date.now(),
        });
    } else {
        await updateOrderStatus(order.id!, 'pending', error);
    }
}

// ── Trigger SW sync via postMessage ─────────────────────────────

export async function triggerSwSync(): Promise<void> {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'SYNC_NOW' });
    }
}
