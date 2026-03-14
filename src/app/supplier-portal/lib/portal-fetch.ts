/**
 * Supplier Portal Fetch Utility
 * =============================
 * Centralized fetch wrapper for the supplier portal.
 * Uses token-based auth (not session cookies like erpFetch).
 */

const djangoUrl = typeof window !== 'undefined'
    ? ''                                                          // Client: relative URL
    : (process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000');  // Server: direct

export class PortalApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'PortalApiError';
        this.status = status;
    }
}

/**
 * Fetch wrapper for supplier-portal endpoints.
 * Automatically prepends /api/supplier-portal/ and sets auth header.
 */
export async function portalFetch<T = any>(
    path: string,
    token: string,
    options: RequestInit = {}
): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${djangoUrl}/api/supplier-portal${normalizedPath}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const err = await res.json();
            message = err.detail || err.message || message;
        } catch { /* empty */ }
        throw new PortalApiError(message, res.status);
    }

    // Handle 204 No Content
    if (res.status === 204) return null as T;

    return res.json();
}
