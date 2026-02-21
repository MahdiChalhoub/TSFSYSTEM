'use server';

import { erpFetch } from '@/lib/erp-api';

// =============================================================================
// ADMIN: CLIENT ACCESS MANAGEMENT
// =============================================================================

export async function getClientAccesses() {
    try { return await erpFetch('client-portal/client-access/'); } catch { return []; }
}
export async function createClientAccess(data: any) {
    return erpFetch('client-portal/client-access/', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateClientAccess(id: number, data: any) {
    return erpFetch(`client-portal/client-access/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function activateClientAccess(id: number) {
    return erpFetch(`client-portal/client-access/${id}/activate/`, { method: 'POST' });
}
export async function suspendClientAccess(id: number) {
    return erpFetch(`client-portal/client-access/${id}/suspend/`, { method: 'POST' });
}
export async function revokeClientAccess(id: number) {
    return erpFetch(`client-portal/client-access/${id}/revoke/`, { method: 'POST' });
}
export async function setClientPermissions(id: number, permissions: string[]) {
    return erpFetch(`client-portal/client-access/${id}/set_permissions/`, {
        method: 'POST', body: JSON.stringify({ permissions })
    });
}
export async function generateClientBarcode(id: number) {
    return erpFetch(`client-portal/client-access/${id}/generate_barcode/`, { method: 'POST' });
}

// =============================================================================
// ADMIN: ORDER MANAGEMENT
// =============================================================================

export async function getAdminClientOrders() {
    try { return await erpFetch('client-portal/admin-orders/'); } catch { return []; }
}
export async function getAdminClientOrder(id: number) {
    return erpFetch(`client-portal/admin-orders/${id}/`);
}
export async function confirmClientOrder(id: number) {
    return erpFetch(`client-portal/admin-orders/${id}/confirm/`, { method: 'POST' });
}
export async function processClientOrder(id: number) {
    return erpFetch(`client-portal/admin-orders/${id}/process/`, { method: 'POST' });
}
export async function shipClientOrder(id: number, estimatedDelivery?: string) {
    return erpFetch(`client-portal/admin-orders/${id}/ship/`, {
        method: 'POST', body: JSON.stringify({ estimated_delivery: estimatedDelivery })
    });
}
export async function deliverClientOrder(id: number) {
    return erpFetch(`client-portal/admin-orders/${id}/deliver/`, { method: 'POST' });
}
export async function cancelClientOrder(id: number) {
    return erpFetch(`client-portal/admin-orders/${id}/cancel/`, { method: 'POST' });
}

// =============================================================================
// ADMIN: TICKET MANAGEMENT
// =============================================================================

export async function getAdminClientTickets() {
    try { return await erpFetch('client-portal/admin-tickets/'); } catch { return []; }
}
export async function assignTicket(id: number, userId: number) {
    return erpFetch(`client-portal/admin-tickets/${id}/assign/`, {
        method: 'POST', body: JSON.stringify({ assigned_to: userId })
    });
}
export async function resolveTicket(id: number, notes: string) {
    return erpFetch(`client-portal/admin-tickets/${id}/resolve/`, {
        method: 'POST', body: JSON.stringify({ notes })
    });
}
export async function closeTicket(id: number) {
    return erpFetch(`client-portal/admin-tickets/${id}/close/`, { method: 'POST' });
}
export async function reopenTicket(id: number) {
    return erpFetch(`client-portal/admin-tickets/${id}/reopen/`, { method: 'POST' });
}

// =============================================================================
// ADMIN: WALLET MANAGEMENT
// =============================================================================

export async function getAdminWallets() {
    try { return await erpFetch('client-portal/admin-wallets/'); } catch { return []; }
}
export async function manualWalletCredit(id: number, amount: number, reason: string) {
    return erpFetch(`client-portal/admin-wallets/${id}/manual_credit/`, {
        method: 'POST', body: JSON.stringify({ amount, reason })
    });
}
export async function manualWalletDebit(id: number, amount: number, reason: string) {
    return erpFetch(`client-portal/admin-wallets/${id}/manual_debit/`, {
        method: 'POST', body: JSON.stringify({ amount, reason })
    });
}

// =============================================================================
// ADMIN: PORTAL CONFIGURATION (Per-Organization)
// =============================================================================

export async function getPortalConfig() {
    try { return await erpFetch('client-portal/config/'); } catch { return []; }
}
export async function getCurrentPortalConfig() {
    try { return await erpFetch('client-portal/config/current/'); } catch { return null; }
}
export async function updatePortalConfig(id: number, data: any) {
    return erpFetch(`client-portal/config/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

// =============================================================================
// CLIENT-SIDE: DASHBOARD
// =============================================================================

export async function getClientDashboard() {
    try { return await erpFetch('client-portal/dashboard/'); } catch { return null; }
}

// =============================================================================
// CLIENT-SIDE: MY ORDERS
// =============================================================================

export async function getMyClientOrders() {
    try { return await erpFetch('client-portal/my-orders/'); } catch { return []; }
}
export async function createCartOrder(data: any) {
    return erpFetch('client-portal/my-orders/', { method: 'POST', body: JSON.stringify(data) });
}
export async function addToCart(orderId: number, data: any) {
    return erpFetch(`client-portal/my-orders/${orderId}/add_to_cart/`, {
        method: 'POST', body: JSON.stringify(data)
    });
}
export async function placeClientOrder(orderId: number, data: any) {
    return erpFetch(`client-portal/my-orders/${orderId}/place_order/`, {
        method: 'POST', body: JSON.stringify(data)
    });
}
export async function rateDelivery(orderId: number, rating: number, feedback?: string) {
    return erpFetch(`client-portal/my-orders/${orderId}/rate_delivery/`, {
        method: 'POST', body: JSON.stringify({ rating, feedback: feedback || '' })
    });
}

// =============================================================================
// CLIENT-SIDE: WALLET
// =============================================================================

export async function getMyWallet() {
    try { return await erpFetch('client-portal/my-wallet/'); } catch { return null; }
}
export async function getMyWalletTransactions() {
    try { return await erpFetch('client-portal/my-wallet/transactions/'); } catch { return []; }
}
export async function redeemLoyaltyPoints(points: number) {
    return erpFetch('client-portal/my-wallet/redeem_points/', {
        method: 'POST', body: JSON.stringify({ points })
    });
}

// =============================================================================
// CLIENT-SIDE: TICKETS
// =============================================================================

export async function getMyTickets() {
    try { return await erpFetch('client-portal/my-tickets/'); } catch { return []; }
}
export async function createTicket(data: any) {
    return erpFetch('client-portal/my-tickets/', { method: 'POST', body: JSON.stringify(data) });
}
export async function rateTicketResolution(ticketId: number, rating: number, feedback?: string) {
    return erpFetch(`client-portal/my-tickets/${ticketId}/rate_resolution/`, {
        method: 'POST', body: JSON.stringify({ rating, feedback: feedback || '' })
    });
}

// =============================================================================
// ADMIN: QUOTE REQUEST MANAGEMENT
// =============================================================================

export async function getQuoteRequests() {
    try { return await erpFetch('client-portal/quote-requests/'); } catch { return []; }
}
export async function getQuoteRequest(id: number) {
    return erpFetch(`client-portal/quote-requests/${id}/`);
}
export async function updateQuoteRequest(id: number, data: any) {
    return erpFetch(`client-portal/quote-requests/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteQuoteRequest(id: number) {
    return erpFetch(`client-portal/quote-requests/${id}/`, { method: 'DELETE' });
}
