# Offline POS Mode

## Goal
The goal of Offline POS Mode is to ensure that sales can continue even during local network outages or server downtime, by caching the product catalog locally and queueing orders for background synchronization.

## Data Movement
- **READ**: Product catalog from `pos-offline-db` (IndexedDB).
- **SAVED**: Pending orders in `pos-offline-db`. Sync logs in `pos-offline-db`. Final orders saved to PostgreSQL upon sync.

## User Interaction
- Cashiers see an "Offline Mode" indicator when the connection is lost.
- They can search and add products from the local cache.
- They can complete a checkout which gets stored locally.
- When the connection is restored, a "Syncing" indicator appears, and orders are uploaded.

## Step-by-Step Workflow
1. The app detects a network loss using `navigator.onLine` and the `OfflinePOSManager` facade.
2. The UI switches to using `getCachedProducts()` for the product selection.
3. Upon checkout, `OfflinePOSManager.submitOrder` detects the offline state.
4. The order is stored in the `pendingOrders` object store in IndexedDB via `queueOrder`.
5. The `OfflinePOSManager` listens for the `online` event or runs a periodic interval (30s).
6. When online, `syncPendingOrders()` iterates through the local queue.
7. Each order is POSTed to the backend `/api/v1/pos/orders/`.
8. Successful orders are deleted from the local queue and logged in the sync audit trail.

## How it achieves its goal
By decoupling the checkout action from the live API availability, it provides business continuity for retail operations in environments with unstable internet connectivity.
