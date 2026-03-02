'use server'

const DJANGO_URL = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'

// ─── Auth ────────────────────────────────────────────────────────────────

export async function supplierLogin(slug: string, email: string, password: string) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/login/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ username: email, password, organization_slug: slug }),
 })
 if (!res.ok) {
 const err = await res.json().catch(() => ({}))
 return { success: false, error: err.detail || 'Login failed' }
 }
 return { success: true, data: await res.json() }
 } catch {
 return { success: false, error: 'Network error' }
 }
}

// ─── Dashboard ───────────────────────────────────────────────────────────

export async function getSupplierDashboard(token: string) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/dashboard/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return null
 return await res.json()
 } catch {
 return null
 }
}

// ─── Purchase Orders ─────────────────────────────────────────────────────

export async function getSupplierOrders(token: string, params?: Record<string, string>) {
 try {
 const qp = new URLSearchParams(params || {}).toString()
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-orders/?${qp}`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return []
 const data = await res.json()
 return Array.isArray(data) ? data : data.results || []
 } catch {
 return []
 }
}

export async function getSupplierOrderDetail(token: string, orderId: string) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-orders/${orderId}/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return null
 return await res.json()
 } catch {
 return null
 }
}

export async function updateOrderStatus(token: string, orderId: string, status: string) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-orders/${orderId}/update_status/`, {
 method: 'POST',
 headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 })
 if (!res.ok) return { success: false, error: 'Failed to update status' }
 return { success: true, data: await res.json() }
 } catch {
 return { success: false, error: 'Network error' }
 }
}

// ─── Proformas ───────────────────────────────────────────────────────────

export async function getSupplierProformas(token: string, params?: Record<string, string>) {
 try {
 const qp = new URLSearchParams(params || {}).toString()
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-proformas/?${qp}`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return []
 const data = await res.json()
 return Array.isArray(data) ? data : data.results || []
 } catch {
 return []
 }
}

export async function createProforma(token: string, payload: Record<string, unknown>) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-proformas/`, {
 method: 'POST',
 headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 })
 if (!res.ok) return { success: false, error: 'Failed to create proforma' }
 return { success: true, data: await res.json() }
 } catch {
 return { success: false, error: 'Network error' }
 }
}

// ─── Price Requests ──────────────────────────────────────────────────────

export async function getSupplierPriceRequests(token: string, params?: Record<string, string>) {
 try {
 const qp = new URLSearchParams(params || {}).toString()
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-price-requests/?${qp}`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return []
 const data = await res.json()
 return Array.isArray(data) ? data : data.results || []
 } catch {
 return []
 }
}

export async function createPriceRequest(token: string, payload: Record<string, unknown>) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-price-requests/`, {
 method: 'POST',
 headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 })
 if (!res.ok) return { success: false, error: 'Failed to submit price request' }
 return { success: true, data: await res.json() }
 } catch {
 return { success: false, error: 'Network error' }
 }
}

// ─── Financial Statement ─────────────────────────────────────────────────

export async function getSupplierStatement(token: string, params?: Record<string, string>) {
 try {
 const qp = new URLSearchParams(params || {}).toString()
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-statement/?${qp}`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return null
 return await res.json()
 } catch {
 return null
 }
}

// ─── Notifications ───────────────────────────────────────────────────────

export async function getSupplierNotifications(token: string) {
 try {
 const res = await fetch(`${DJANGO_URL}/api/supplier-portal/my-notifications/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 })
 if (!res.ok) return []
 const data = await res.json()
 return Array.isArray(data) ? data : data.results || []
 } catch {
 return []
 }
}
