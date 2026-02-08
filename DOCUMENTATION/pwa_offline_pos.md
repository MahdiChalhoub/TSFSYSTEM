# PWA Offline Mode for POS — Documentation

## Goal
Enable the POS to work without an internet connection. Products are cached locally, and orders created while offline are queued and automatically synced when connectivity resumes.

## Architecture

### Service Worker (`public/sw.js`)
- **Static assets**: Cache-first strategy (JS, CSS, images, fonts)
- **API calls**: Network-first with cache fallback
- **Navigation**: Network-first with offline fallback
- **Background Sync**: Replays queued orders via `sync-pending-orders` event

### IndexedDB (`src/lib/offline/db.ts`)
Three object stores powered by the `idb` library:
- `products` — Cached product catalog (auto-populated on successful fetch)
- `pendingOrders` — Orders created while offline, with status tracking
- `syncLog` — Audit trail of cache and sync operations

### Sync Manager (`src/lib/offline/sync.ts`)
- `syncPendingOrders()` — Replays all pending orders to `/api/v1/pos/orders/`
- `registerBackgroundSync()` — Registers browser Background Sync if supported
- Retry logic: max 3 retries before marking as `failed`

### React Hooks (`src/lib/offline/hooks.ts`)
- `useOnlineStatus()` — Reactive online/offline state, auto-syncs on reconnect
- `useOfflineProducts()` — Loads product cache from IndexedDB
- `usePendingOrders()` — Pending order count with 5s polling + SW message listener

## Data Flow

### From (READ)
- Server action `getPosProducts` — fetches products from backend
- IndexedDB `products` store — cached products for offline display
- IndexedDB `pendingOrders` store — queued transactions

### To (WRITE)
- IndexedDB `products` store — cached on every successful product fetch
- IndexedDB `pendingOrders` store — saved when user creates order while offline
- Backend `/api/v1/pos/orders/` — replayed orders on reconnect
- IndexedDB `syncLog` store — audit entries

### Variables Users Interact With
- Product grid items — displayed from server or cache
- Offline indicator — shows online/offline/syncing/pending status
- Sync button — triggers manual sync of pending orders
- Pending order badge — shows count of queued orders

### Step-by-Step Workflow
1. User opens POS (`/sales`) → products fetched from server
2. Products automatically cached to IndexedDB
3. If network drops → products loaded from IndexedDB cache
4. Offline mode banner shown on product grid
5. User creates order while offline → saved to IndexedDB `pendingOrders`
6. `OfflineIndicator` shows pending count
7. When connectivity resumes → `useOnlineStatus` fires `online` event
8. `syncPendingOrders()` replays each pending order to backend
9. Successfully synced orders deleted from IndexedDB
10. Failed orders retry up to 3 times before being marked `failed`

### How This Achieves Its Goal
By caching the product catalog in IndexedDB and queuing orders locally, the POS remains fully functional even without network access. The sync queue ensures no data is lost, with automatic replay on reconnect and manual sync as a fallback.
