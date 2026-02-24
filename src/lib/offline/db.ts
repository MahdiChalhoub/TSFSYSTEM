/**
 * IndexedDB Offline Storage for POS
 * ===================================
 * Uses the `idb` library for a promise-based IndexedDB API.
 * 
 * Stores:
 *   - products:      Cached product catalog for offline access
 *   - pendingOrders: Orders created while offline, awaiting sync
 *   - syncLog:       Audit trail of sync operations
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;

export interface OfflineProduct {
    id: number;
    name: string;
    price: number;
    taxRate: number;
    isTaxIncluded: boolean;
    category?: string;
    sku?: string;
    imageUrl?: string;
    stock?: number;
    cachedAt: number; // timestamp
}

export interface PendingOrder {
    id?: number;
    data: {
        items: Array<{
            productId: number;
            name: string;
            price: number;
            quantity: number;
            taxRate: number;
        }>;
        total: number;
        paymentMethod: string;
        siteId?: string;
    };
    headers: Record<string, string>;
    createdAt: number;
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    retryCount: number;
    lastError?: string;
}

export interface SyncLogEntry {
    id?: number;
    action: 'sync' | 'cache' | 'error';
    module: string;
    detail: string;
    timestamp: number;
    ordersCount?: number;
}

// ── Database Initialization ─────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
    if (typeof window === 'undefined') {
        throw new Error('IndexedDB is not available during server-side rendering');
    }
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Products cache
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('category', 'category');
                    productStore.createIndex('cachedAt', 'cachedAt');
                }

                // Pending orders queue
                if (!db.objectStoreNames.contains('pendingOrders')) {
                    const orderStore = db.createObjectStore('pendingOrders', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    orderStore.createIndex('status', 'status');
                    orderStore.createIndex('createdAt', 'createdAt');
                }

                // Sync log
                if (!db.objectStoreNames.contains('syncLog')) {
                    const logStore = db.createObjectStore('syncLog', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    logStore.createIndex('timestamp', 'timestamp');
                }
            },
        });
    }
    return dbPromise;
}

// ── Product Cache Operations ────────────────────────────────────

export async function cacheProducts(products: OfflineProduct[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');

    const now = Date.now();
    for (const product of products) {
        await store.put({ ...product, cachedAt: now });
    }
    await tx.done;

    await addSyncLog({
        action: 'cache',
        module: 'products',
        detail: `Cached ${products.length} products`,
        timestamp: now,
    });
}

export async function getCachedProducts(): Promise<OfflineProduct[]> {
    const db = await getDB();
    return db.getAll('products');
}

export async function getCachedProductCount(): Promise<number> {
    const db = await getDB();
    return db.count('products');
}

export async function clearProductCache(): Promise<void> {
    const db = await getDB();
    await db.clear('products');
}

// ── Pending Order Operations ────────────────────────────────────

export async function queueOrder(order: Omit<PendingOrder, 'id' | 'createdAt' | 'status' | 'retryCount'>): Promise<number> {
    const db = await getDB();
    const id = await db.add('pendingOrders', {
        ...order,
        createdAt: Date.now(),
        status: 'pending',
        retryCount: 0,
    });

    await addSyncLog({
        action: 'sync',
        module: 'orders',
        detail: `Order queued for sync (id=${id})`,
        timestamp: Date.now(),
    });

    return id as number;
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
    const db = await getDB();
    const tx = db.transaction('pendingOrders', 'readonly');
    const index = tx.objectStore('pendingOrders').index('status');
    return index.getAll('pending');
}

export async function getPendingOrderCount(): Promise<number> {
    const db = await getDB();
    const tx = db.transaction('pendingOrders', 'readonly');
    const index = tx.objectStore('pendingOrders').index('status');
    return index.count('pending');
}

export async function updateOrderStatus(
    id: number,
    status: PendingOrder['status'],
    error?: string
): Promise<void> {
    const db = await getDB();
    const order = await db.get('pendingOrders', id);
    if (order) {
        order.status = status;
        if (error) {
            order.lastError = error;
            order.retryCount = (order.retryCount || 0) + 1;
        }
        await db.put('pendingOrders', order);
    }
}

export async function deleteOrder(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('pendingOrders', id);
}

// ── Sync Log Operations ─────────────────────────────────────────

export async function addSyncLog(entry: Omit<SyncLogEntry, 'id'>): Promise<void> {
    const db = await getDB();
    await db.add('syncLog', entry);
}

export async function getRecentSyncLogs(limit = 20): Promise<SyncLogEntry[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex('syncLog', 'timestamp');
    return all.slice(-limit).reverse();
}
