'use server';

import { erpFetch } from '@/lib/erpFetch';

// =============================================================================
// ADMIN: PORTAL ACCESS MANAGEMENT
// =============================================================================

export async function getPortalAccesses() {
    try { return await erpFetch('supplier-portal/portal-access/'); } catch { return []; }
}
export async function createPortalAccess(data: any) {
    return erpFetch('supplier-portal/portal-access/', { method: 'POST', body: JSON.stringify(data) });
}
export async function updatePortalAccess(id: number, data: any) {
    return erpFetch(`supplier-portal/portal-access/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function activatePortalAccess(id: number) {
    return erpFetch(`supplier-portal/portal-access/${id}/activate/`, { method: 'POST' });
}
export async function suspendPortalAccess(id: number) {
    return erpFetch(`supplier-portal/portal-access/${id}/suspend/`, { method: 'POST' });
}
export async function revokePortalAccess(id: number) {
    return erpFetch(`supplier-portal/portal-access/${id}/revoke/`, { method: 'POST' });
}
export async function setPortalPermissions(id: number, permissions: string[]) {
    return erpFetch(`supplier-portal/portal-access/${id}/set_permissions/`, {
        method: 'POST', body: JSON.stringify({ permissions })
    });
}

// =============================================================================
// ADMIN: PROFORMA REVIEW
// =============================================================================

export async function getAdminProformas() {
    try { return await erpFetch('supplier-portal/admin-proformas/'); } catch { return []; }
}
export async function getAdminProforma(id: number) {
    return erpFetch(`supplier-portal/admin-proformas/${id}/`);
}
export async function approveProforma(id: number) {
    return erpFetch(`supplier-portal/admin-proformas/${id}/approve/`, { method: 'POST' });
}
export async function rejectProforma(id: number, reason: string) {
    return erpFetch(`supplier-portal/admin-proformas/${id}/reject/`, {
        method: 'POST', body: JSON.stringify({ reason })
    });
}
export async function negotiateProforma(id: number, notes: string) {
    return erpFetch(`supplier-portal/admin-proformas/${id}/negotiate/`, {
        method: 'POST', body: JSON.stringify({ notes })
    });
}
export async function convertProformaToPO(id: number) {
    return erpFetch(`supplier-portal/admin-proformas/${id}/convert_to_po/`, { method: 'POST' });
}

// =============================================================================
// ADMIN: PRICE CHANGE REVIEW
// =============================================================================

export async function getAdminPriceRequests() {
    try { return await erpFetch('supplier-portal/admin-price-requests/'); } catch { return []; }
}
export async function approvePriceRequest(id: number, notes?: string) {
    return erpFetch(`supplier-portal/admin-price-requests/${id}/approve/`, {
        method: 'POST', body: JSON.stringify({ notes: notes || '' })
    });
}
export async function rejectPriceRequest(id: number, notes: string) {
    return erpFetch(`supplier-portal/admin-price-requests/${id}/reject/`, {
        method: 'POST', body: JSON.stringify({ notes })
    });
}
export async function counterProposePriceRequest(id: number, counterPrice: number, notes?: string) {
    return erpFetch(`supplier-portal/admin-price-requests/${id}/counter_propose/`, {
        method: 'POST', body: JSON.stringify({ counter_price: counterPrice, notes: notes || '' })
    });
}

// =============================================================================
// SUPPLIER-SIDE: DASHBOARD
// =============================================================================

export async function getSupplierDashboard() {
    try { return await erpFetch('supplier-portal/dashboard/'); } catch { return null; }
}

// =============================================================================
// SUPPLIER-SIDE: MY ORDERS
// =============================================================================

export async function getSupplierOrders(status?: string) {
    const params = status ? `?status=${status}` : '';
    try { return await erpFetch(`supplier-portal/my-orders/${params}`); } catch { return []; }
}

// =============================================================================
// SUPPLIER-SIDE: MY STOCK
// =============================================================================

export async function getSupplierStock() {
    try { return await erpFetch('supplier-portal/my-stock/'); } catch { return []; }
}

// =============================================================================
// SUPPLIER-SIDE: MY PROFORMAS
// =============================================================================

export async function getMyProformas() {
    try { return await erpFetch('supplier-portal/my-proformas/'); } catch { return []; }
}
export async function getMyProforma(id: number) {
    return erpFetch(`supplier-portal/my-proformas/${id}/`);
}
export async function createProforma(data: any) {
    return erpFetch('supplier-portal/my-proformas/', { method: 'POST', body: JSON.stringify(data) });
}
export async function submitProforma(id: number) {
    return erpFetch(`supplier-portal/my-proformas/${id}/submit/`, { method: 'POST' });
}
export async function addProformaLine(proformaId: number, data: any) {
    return erpFetch(`supplier-portal/my-proformas/${proformaId}/add_line/`, {
        method: 'POST', body: JSON.stringify(data)
    });
}

// =============================================================================
// SUPPLIER-SIDE: MY PRICE REQUESTS
// =============================================================================

export async function getMyPriceRequests() {
    try { return await erpFetch('supplier-portal/my-price-requests/'); } catch { return []; }
}
export async function createPriceRequest(data: any) {
    return erpFetch('supplier-portal/my-price-requests/', { method: 'POST', body: JSON.stringify(data) });
}
export async function acceptCounterProposal(id: number) {
    return erpFetch(`supplier-portal/my-price-requests/${id}/accept_counter/`, { method: 'POST' });
}

// =============================================================================
// SUPPLIER-SIDE: NOTIFICATIONS
// =============================================================================

export async function getSupplierNotifications() {
    try { return await erpFetch('supplier-portal/my-notifications/'); } catch { return []; }
}
export async function markNotificationRead(id: number) {
    return erpFetch(`supplier-portal/my-notifications/${id}/mark_read/`, { method: 'POST' });
}
export async function markAllNotificationsRead() {
    return erpFetch('supplier-portal/my-notifications/mark_all_read/', { method: 'POST' });
}
