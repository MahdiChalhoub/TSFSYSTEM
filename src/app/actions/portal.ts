'use server'

import { erpFetch } from '@/lib/erp-api'
import { serialize } from '@/lib/utils'

// ── Client Portal — Admin side ────────────────────────────────────

export async function getClientWallets() {
    try { const d = await erpFetch('client_portal/admin-wallets/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function getClientOrders() {
    try { const d = await erpFetch('client_portal/admin-orders/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function getClientTickets() {
    try { const d = await erpFetch('client_portal/admin-tickets/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function getQuoteRequests() {
    try { const d = await erpFetch('client_portal/quote-requests/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function getClientAccess() {
    try { const d = await erpFetch('client_portal/client-access/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function updateClientTicket(id: number, data: Record<string, any>) {
    return await erpFetch(`client_portal/admin-tickets/${id}/`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Supplier Portal — Admin side ──────────────────────────────────

export async function getSupplierProformas() {
    try { const d = await erpFetch('supplier_portal/admin-proformas/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function getPriceChangeRequests() {
    try { const d = await erpFetch('supplier_portal/admin-price-requests/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}

export async function approvePriceRequest(id: number) {
    return await erpFetch(`supplier_portal/admin-price-requests/${id}/approve/`, { method: 'POST' })
}

export async function getSupplierPortalAccess() {
    try { const d = await erpFetch('supplier_portal/portal-access/'); return serialize(Array.isArray(d) ? d : (d?.results ?? [])) } catch { return [] }
}
