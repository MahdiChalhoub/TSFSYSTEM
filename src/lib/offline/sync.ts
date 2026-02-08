/**
 * Sync Manager for POS Offline Mode
 * ====================================
 * Handles syncing pending orders to the backend when connectivity resumes.
 * Supports both Background Sync API and manual poll-based sync.
 * 
 * Rules:
 *   - ONLINE PRIORITY: When online, always fetch fresh data from server
 *   - AUTO SYNC: Periodic sync every 30s while online
 *   - FORCE SYNC: Block critical actions (checkout) until queue is drained
 */

import {
    getPendingOrders,
    getPendingOrderCount,
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

// ── Auto Sync: Periodic interval while online ───────────────────

const AUTO_SYNC_INTERVAL_MS = 30_000; // 30 seconds
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(): void {
    stopAutoSync();
    autoSyncTimer = setInterval(async () => {
        if (isOnline()) {
            const count = await getPendingOrderCount();
            if (count > 0) {
                console.log(`[AutoSync] ${count} pending orders, syncing...`);
                await syncPendingOrders();
            }
        }
    }, AUTO_SYNC_INTERVAL_MS);
}

export function stopAutoSync(): void {
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
}

// ── Force Sync Rule: Block actions until queue is drained ───────

export async function forceSyncBeforeAction(): Promise<boolean> {
    const count = await getPendingOrderCount();
    if (count === 0) return true; // Queue empty, proceed

    if (!isOnline()) {
        // Can't sync while offline
        return false;
    }

    // Attempt to drain the queue
    const result = await syncPendingOrders();
    const remaining = await getPendingOrderCount();

    // Only allow action if queue is fully drained
    return remaining === 0;
}

// ── Online-Only Mode: For critical operations ───────────────────
// When active, the app REFUSES cached/offline data and blocks
// all actions if connectivity drops. Use for:
//   - Live inventory counts
//   - Accounting audits
//   - Financial reconciliation

let onlineOnlyMode = false;
let onlineOnlyReason = '';

export function enableOnlineOnlyMode(reason: string = 'Critical operation in progress'): void {
    if (!isOnline()) {
        throw new Error('Cannot enter Online-Only Mode while offline. Connect first.');
    }
    onlineOnlyMode = true;
    onlineOnlyReason = reason;
    console.log(`[OnlineOnly] ENABLED: ${reason}`);
}

export function disableOnlineOnlyMode(): void {
    onlineOnlyMode = false;
    onlineOnlyReason = '';
    console.log('[OnlineOnly] DISABLED');
}

export function isOnlineOnlyMode(): boolean {
    return onlineOnlyMode;
}

export function getOnlineOnlyReason(): string {
    return onlineOnlyReason;
}

/**
 * Call before any data read/write in a critical workflow.
 * Throws if connectivity is lost during Online-Only Mode.
 */
export function requireOnline(): void {
    if (onlineOnlyMode && !isOnline()) {
        throw new Error(
            `🔒 Online-Only Mode: ${onlineOnlyReason}. ` +
            'Cannot proceed — live server connection required. ' +
            'Reconnect to continue.'
        );
    }
}
