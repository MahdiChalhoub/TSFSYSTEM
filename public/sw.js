/**
 * Service Worker for POS Offline Mode
 * ====================================
 * Strategies:
 *   - Static assets: Cache-first (JS, CSS, images, fonts)
 *   - API calls:     Network-first, fallback to IndexedDB cache
 *   - Navigation:    Network-first with offline fallback page
 */

const CACHE_NAME = 'pos-cache-v1';
const STATIC_ASSETS = [
    '/sales',
    '/manifest.json',
];

// ── Install: Pre-cache critical assets ──────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// ── Activate: Clean old caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Route requests based on type ─────────────────────────
self.addEventListener('fetch', (event) => {
    // Skip non-http/https schemes (prevents chrome-extension errors)
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Skip cross-origin requests to prevent connect-src CSP blocking on images/CDN imports
    if (url.origin !== self.location.origin) return;

    // Skip non-GET requests (POST orders etc. handled by sync queue)
    if (event.request.method !== 'GET') return;

    // API calls: network-first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Static assets: cache-first
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Navigation: network-first
    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Default: network-first
    event.respondWith(networkFirst(event.request));
});

// ── Background Sync: Replay queued orders ───────────────────────
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pending-orders') {
        event.waitUntil(syncPendingOrders());
    }
});

// ── Message handler: Manual sync trigger ────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_NOW') {
        syncPendingOrders().then((result) => {
            // Notify all clients of sync result
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SYNC_COMPLETE', ...result });
                });
            });
        });
    }
});

// ── Strategies ──────────────────────────────────────────────────

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ offline: true, error: 'No network' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ttf|ico)$/.test(pathname) ||
        pathname.startsWith('/_next/static/');
}

// ── Sync Logic ──────────────────────────────────────────────────

async function syncPendingOrders() {
    // Open IndexedDB to get pending orders
    const dbRequest = indexedDB.open('pos-offline-db', 1);

    return new Promise((resolve) => {
        dbRequest.onsuccess = async (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('pendingOrders')) {
                resolve({ synced: 0, failed: 0 });
                return;
            }

            const tx = db.transaction('pendingOrders', 'readwrite');
            const store = tx.objectStore('pendingOrders');
            const getAll = store.getAll();

            getAll.onsuccess = async () => {
                const orders = getAll.result;
                let synced = 0;
                let failed = 0;

                for (const order of orders) {
                    try {
                        const response = await fetch('/api/v1/pos/orders/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(order.headers || {}),
                            },
                            body: JSON.stringify(order.data),
                        });

                        if (response.ok) {
                            // Delete from pending queue
                            const delTx = db.transaction('pendingOrders', 'readwrite');
                            delTx.objectStore('pendingOrders').delete(order.id);
                            synced++;
                        } else {
                            failed++;
                        }
                    } catch {
                        failed++;
                    }
                }

                resolve({ synced, failed, total: orders.length });
            };

            getAll.onerror = () => resolve({ synced: 0, failed: 0, error: 'DB read failed' });
        };

        dbRequest.onerror = () => resolve({ synced: 0, failed: 0, error: 'DB open failed' });
    });
}
