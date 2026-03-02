'use server'

import { erpFetch } from "@/lib/erp-api"

/**
 * Fetches organization data by slug to establish tenant context.
 * Used for routing, branding, and security isolation.
 */
export async function getOrganizationBySlug(slug: string) {
 try {
 const response = await erpFetch(`tenant/resolve/?slug=${slug}`);
 if (!response || response.error) return null;

 // Map backend response to frontend expectation
 return {
 ...response,
 isActive: true, // Assuming if resolved it is active
 _count: { sites: 0, users: 0 } // dummy counts or enhance API later
 }
 } catch (error) {
 console.error("[TENANT_CONTEXT] Failed to fetch org:", error)
 return null
 }
}

/**
 * Validates if the current request is coming from a valid tenant.
 */
export async function validateTenantAccess(slug: string) {
 const org = await getOrganizationBySlug(slug)
 if (!org || (org as any).error) return false
 return true
}
/**
 * Fetches public product catalog for the storefront.
 */
export async function getPublicProducts(slug: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/products/storefront/?organization_slug=${slug}`, {
 next: { revalidate: 0 } // No cache for testing phase
 });
 if (!res.ok) return [];
 const data = await res.json();
 return Array.isArray(data) ? data : (data.results || []);
 } catch (error) {
 // Storefront products are optional — fail silently
 return [];
 }
}

/**
 * Fetches the public storefront configuration (store_mode, branding, etc.).
 */
export async function getStorefrontConfig(slug: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/storefront/config/?slug=${slug}`, {
 cache: 'no-store'
 });
 if (!res.ok) return null;
 return await res.json();
 } catch {
 return null;
 }
}

/**
 * Fetches the public category list for the storefront.
 */
export async function getPublicCategories(slug: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/categories/storefront/?organization_slug=${slug}`, {
 next: { revalidate: 60 }
 });
 if (!res.ok) return [];
 return await res.json();
 } catch {
 return [];
 }
}

/**
 * Fetches the public brand list for the storefront.
 */
export async function getPublicBrands(slug: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/brands/storefront/?organization_slug=${slug}`, {
 next: { revalidate: 60 }
 });
 if (!res.ok) return [];
 return await res.json();
 } catch {
 return [];
 }
}

/**
 * Client portal login — authenticates client credentials against the portal.
 */
export async function clientLogin(slug: string, email: string, password: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/portal-auth/login/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email, password, slug }),
 });
 const data = await res.json();
 if (!res.ok) return { success: false, error: data.error || 'Login failed' };
 return { success: true, data };
 } catch (err: any) {
 return { success: false, error: err.message || 'Network error' };
 }
}

/**
 * Fetches authenticated client's order history.
 */
export async function getMyOrders(token: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/my-orders/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return Array.isArray(data) ? data : data.results || [];
 } catch {
 return [];
 }
}

/**
 * Fetches authenticated client's wallet and loyalty data.
 */
export async function getMyWallet(token: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/my-wallet/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 });
 if (!res.ok) return null;
 const data = await res.json();
 return Array.isArray(data) ? data[0] : data;
 } catch {
 return null;
 }
}

/**
 * Fetches authenticated client's support tickets.
 */
export async function getMyTickets(token: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/my-tickets/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 });
 if (!res.ok) return [];
 const data = await res.json();
 return Array.isArray(data) ? data : data.results || [];
 } catch {
 return [];
 }
}

/**
 * Creates a support ticket for the authenticated client.
 */
export async function createTicket(token: string, payload: { ticket_type: string; subject: string; description: string }) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/my-tickets/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
 body: JSON.stringify(payload),
 });
 if (!res.ok) {
 const data = await res.json();
 return { success: false, error: data.error || 'Failed to create ticket' };
 }
 return { success: true, data: await res.json() };
 } catch (err: any) {
 return { success: false, error: err.message };
 }
}

/**
 * Creates a new client order and returns it.
 */
export async function createOrder(token: string, payload: Record<string, any>) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/my-orders/`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
 body: JSON.stringify(payload),
 });
 if (!res.ok) {
 const data = await res.json();
 return { success: false, error: data.error || 'Failed to create order' };
 }
 return { success: true, data: await res.json() };
 } catch (err: any) {
 return { success: false, error: err.message };
 }
}

/**
 * Submits a quote request (for CATALOG_QUOTE store mode).
 */
export async function submitQuoteRequest(slug: string, payload: Record<string, any>, token?: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const headers: Record<string, string> = {
 'Content-Type': 'application/json',
 'X-Tenant-Id': slug,
 };
 if (token) headers['Authorization'] = `Token ${token}`;
 const res = await fetch(`${djangoUrl}/api/client_portal/quote-requests/`, {
 method: 'POST',
 headers,
 body: JSON.stringify(payload),
 });
 if (!res.ok) {
 const data = await res.json();
 return { success: false, error: data.error || data.detail || JSON.stringify(data) };
 }
 return { success: true, data: await res.json() };
 } catch (err: any) {
 return { success: false, error: err.message };
 }
}

/**
 * Fetches the client's dashboard summary (stats, barcode, etc.).
 */
export async function getClientDashboard(token: string) {
 try {
 const djangoUrl = process.env.DJANGO_URL || 'http://backend:8000';
 const res = await fetch(`${djangoUrl}/api/client_portal/dashboard/`, {
 headers: { 'Authorization': `Token ${token}` },
 cache: 'no-store',
 });
 if (!res.ok) return null;
 const data = await res.json();
 return Array.isArray(data) && data.length > 0 ? data[0] : data;
 } catch {
 return null;
 }
}
