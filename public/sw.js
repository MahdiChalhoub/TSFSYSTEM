/**
 * Service Worker — TSFSYSTEM Enterprise PWA
 * ==========================================
 * Strategies:
 *   - Static assets (images, fonts):  Cache-first
 *   - Next.js chunks:                 Network-first (content-hashed)
 *   - API calls:                      Network-first, fallback to cache
 *   - Navigation pages:               Network-first with offline fallback
 *   - Background Sync:                Replay queued POS orders
 */

const CACHE_VERSION = 'tsf-v3';
const STATIC_ASSETS = [
    '/manifest.json',
    '/dashboard',
];

// ── Install: Pre-cache critical assets ──────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            console.log('[SW] Pre-caching critical assets');
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
                    .filter((key) => key !== CACHE_VERSION)
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

    // Skip cross-origin requests
    if (url.origin !== self.location.origin) return;

    // Skip non-GET requests (POST/PUT handled by sync queue)
    if (event.request.method !== 'GET') return;

    // API calls: network-first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Next.js static chunks: cache-first (content-hashed filenames)
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Other static assets (images, fonts): cache-first
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
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SYNC_COMPLETE', ...result });
                });
            });
        });
    }

    // Force update when requested
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Strategies ──────────────────────────────────────────────────

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
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
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // For navigation, return a basic offline page
        if (request.mode === 'navigate') {
            return new Response(
                `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — TSFSYSTEM</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#09090B;color:#F1F5F9;text-align:center}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#94A3B8}button{margin-top:1rem;padding:0.75rem 1.5rem;background:#10B981;color:white;border:none;border-radius:0.75rem;font-weight:700;cursor:pointer}</style></head><body><div><h1>You're Offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>`,
                { status: 503, headers: { 'Content-Type': 'text/html' } }
            );
        }
        return new Response(JSON.stringify({ offline: true, error: 'No network' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function isStaticAsset(pathname) {
    return /\.(css|png|jpg|jpeg|webp|svg|woff2?|ttf|ico|mp3|wav)$/.test(pathname);
}

// ── Sync Logic ──────────────────────────────────────────────────

async function syncPendingOrders() {
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
