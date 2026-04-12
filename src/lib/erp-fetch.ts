/**
 * ERP Fetch Utility
 * 
 * Server-side fetch wrapper for Django API calls.
 * Handles authentication, base URL, and headers automatically.
 */

// Use 127.0.0.1 to avoid IPv6 resolution issues with localhost on Windows/Node 18+
const DJANGO_URL = process.env.DJANGO_URL || 'http://127.0.0.1:8000'

export interface ErpFetchOptions extends RequestInit {
    skipAuth?: boolean
}

/**
 * Fetch wrapper for Django ERP API
 * Automatically includes auth cookies and base URL
 */
export async function erpFetch(
    endpoint: string,
    options: ErpFetchOptions = {}
): Promise<Response> {
    const { skipAuth = false, headers: customHeaders, ...rest } = options

    const url = endpoint.startsWith('http')
        ? endpoint
        : `${DJANGO_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`

    const headers: HeadersInit = {
        ...customHeaders,
    }

    // Add auth token from cookies if available
    if (!skipAuth) {
        try {
            const { cookies } = await import('next/headers')
            const cookieStore = await cookies()
            const sessionId = cookieStore.get('sessionid')?.value
            const csrfToken = cookieStore.get('csrftoken')?.value

            if (sessionId) {
                (headers as Record<string, string>)['Cookie'] = `sessionid=${sessionId}`
            }
            if (csrfToken) {
                (headers as Record<string, string>)['X-CSRFToken'] = csrfToken
            }
        } catch (e) {
            // Cookies not available (e.g., in static generation)
            console.warn('[erpFetch] Could not access cookies:', e)
        }
    }

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
        (headers as Record<string, string>)['Content-Type'] =
            (headers as Record<string, string>)['Content-Type'] || 'application/json'
    }

    // Smart cache: GET requests revalidate every 30s, mutations use no-store
    const method = (rest.method || 'GET').toUpperCase();
    const isReadRequest = method === 'GET' || method === 'HEAD';

    const fetchOpts: Record<string, any> = {
        ...rest,
        headers,
    };

    if (options.cache) {
        fetchOpts.cache = options.cache;
    } else if (isReadRequest) {
        fetchOpts.next = { revalidate: 30 };
    } else {
        fetchOpts.cache = 'no-store';
    }

    return fetch(url, fetchOpts)
}

/**
 * Convenience method for GET requests
 */
export async function erpGet(endpoint: string, options?: ErpFetchOptions) {
    return erpFetch(endpoint, { ...options, method: 'GET' })
}

/**
 * Convenience method for POST requests with JSON body
 */
export async function erpPost(endpoint: string, data: unknown, options?: ErpFetchOptions) {
    return erpFetch(endpoint, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
    })
}

/**
 * Convenience method that parses the JSON response body.
 * Used by API clients that need typed responses.
 */
export async function erpFetchJSON<T = unknown>(
    endpoint: string,
    options: ErpFetchOptions = {}
): Promise<T> {
    const res = await erpFetch(endpoint, options)
    if (!res.ok) {
        throw new Error(`[erpFetchJSON] ${res.status} ${res.statusText} — ${endpoint}`)
    }
    return res.json() as Promise<T>
}
