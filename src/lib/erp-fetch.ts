/**
 * ERP Fetch Utility
 * 
 * Server-side fetch wrapper for Django API calls.
 * Handles authentication, base URL, and headers automatically.
 */

// Remote import moved inside erpFetch for universal support

// Use 127.0.0.1 to avoid IPv6 resolution issues with localhost on Windows/Node 18+
const DJANGO_URL = process.env.DJANGO_URL ||
    (typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000')

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
        : `${DJANGO_URL}/api/${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`

    const headers: HeadersInit = {
        ...customHeaders,
    }

    // Add auth token from cookies if available
    if (!skipAuth) {
        let token: string | undefined

        if (typeof window === 'undefined') {
            // Server-side: use next/headers dynamic import to avoid client-side build errors
            try {
                const { cookies } = await import('next/headers')
                const cookieStore = await cookies()
                token = cookieStore.get('auth_token')?.value
            } catch (e) {
                console.warn('[erpFetch] Could not access server cookies:', e)
            }
        } else {
            // Client-side: use document.cookie
            token = document.cookie
                .split('; ')
                .find(row => row.startsWith('auth_token='))
                ?.split('=')[1]
        }

        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Token ${token}`
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
