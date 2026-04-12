// Detect if running in browser or server
const isClient = typeof window !== 'undefined';

// Server-side: call Django directly (fast, no Nginx hop)
// Client-side: route through /api/proxy/[...path] — the Next.js proxy reads the
//              httpOnly auth_token cookie server-side and injects Authorization header.
//              Calling /api/... directly from the browser sends NO auth (httpOnly = unreadable).
const DJANGO_URL = isClient
    ? null  // Client uses /api/proxy/ — see URL construction below
    : (process.env.DJANGO_URL || 'http://127.0.0.1:8000');

// Performance: Only log in development to avoid I/O overhead in production
const isDev = process.env.NODE_ENV === 'development';
const debug = (...args: unknown[]) => isDev && console.log(...args);

/** Custom error class for ERP API errors — used for type-safe catch blocks */
export class ErpApiError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.name = 'ErpApiError'
        this.status = status
    }
}

export async function getTenantContext() {
    let host = '';

    if (typeof window !== 'undefined') {
        host = window.location.host;
    } else {
        try {
            const { headers } = await import('next/headers');
            const headerList = await headers();
            host = headerList.get('host') || 'localhost:3000';
        } catch (e) {
            host = 'localhost:3000';
        }
    }

    debug(`[DEBUG] getTenantContext Host: ${host}`);

    // Precise Hostname extraction (removes port)
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');

    let subdomain = "";
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(hostname);

    if (isIp) {
        subdomain = "";
    } else if (hostname.includes("localhost")) {
        if (parts.length > 1) subdomain = parts[0];
    } else {
        // Production: expect xxx.domain.com (3 parts or more)
        if (parts.length > 2) subdomain = parts[0];
    }

    debug(`[DEBUG] Subdomain detected: ${subdomain}`);

    if (!subdomain || subdomain === "www") {
        // Root Domain only - No Tenant Context (Fallback)
        return null;
    }

    try {
        // Resolve via Django API to avoid direct DB access
        const res = await fetch(`${DJANGO_URL}/api/tenant/resolve/?slug=${subdomain}`, {
            cache: 'force-cache',
            next: { revalidate: 60 } // Cache resolution for 60s
        });

        if (!res.ok) {
            console.error(`[DEBUG] Tenant Resolution Failed: ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.error("Failed to resolve tenant:", e);
        return null;
    }
}

export async function erpFetch(path: string, options: RequestInit = {}) {
    const context = await getTenantContext();
    const headersRaw = new Headers(options.headers || {});

    // [AUTH RESTORATION]
    // Crucial: Inject auth token from cookies if not already present
    // EXCEPT for login endpoint - sending stale token causes "Invalid token" error
    const isLoginEndpoint = path.includes('auth/login');

    if (!headersRaw.has('Authorization') && !isLoginEndpoint) {
        try {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            const token = cookieStore.get('auth_token')?.value;
            if (token) {
                headersRaw.set('Authorization', `Token ${token}`);
                debug(`[ERP_API] Token injected for ${path}`);
            }
        } catch (e) {
            // Cookies not available (client context or static generation)
        }
    }

    if (context) {
        headersRaw.set('X-Tenant-Id', context.id);
        headersRaw.set('X-Tenant-Slug', context.slug);
        debug(`[DEBUG] erpFetch Context: ${context.slug}`);
    } else {
        debug(`[DEBUG] erpFetch Context: SaaS/Root (No Tenant ID sent)`);
    }

    // Client: proxy route handles auth injection (reads httpOnly cookie server-side)
    // Server: call Django directly with token already injected above
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    let url = isClient
        ? `/api/proxy/${cleanPath}`
        : `${DJANGO_URL}/api/${cleanPath}`;

    // Support for complex query params (UDLE Filtering)
    if (options.body === undefined && (options.method === 'GET' || !options.method)) {
        // Option to pass params as an object in options (if we want to expand erpFetch later)
        // For now, most callers append them manually to the path, but UDLE might need it cleaner.
    }

    // [CONTENT-TYPE FIX]
    // For JSON POST/PUT/PATCH requests, set Content-Type to application/json
    // fetch() defaults to text/plain which Django REST Framework rejects (415)
    if (options.body && typeof options.body === 'string' && !headersRaw.has('Content-Type')) {
        headersRaw.set('Content-Type', 'application/json');
    }

    // [UPLOAD FIX]
    // If body is FormData, we must NOT send Content-Type header.
    // Fetch will automatically set it with the correct boundary.
    if (options.body instanceof FormData) {
        headersRaw.delete('Content-Type');
    }

    // Determine HTTP method
    const method = (options.method || 'GET').toUpperCase();
    const isReadRequest = method === 'GET' || method === 'HEAD';

    debug(`[ERP_API] ${method} ${url}`);

    try {
        // [SMART CACHE]
        // GET requests: allow Next.js to revalidate (stale-while-revalidate pattern, 30s)
        // Mutating requests (POST/PUT/PATCH/DELETE): always no-store
        const fetchOptions: Record<string, unknown> = {
            ...options,
            headers: headersRaw,
        };

        if (isReadRequest) {
            // Respect explicit cache: 'no-store' from caller (e.g. auth/me must be fresh)
            if (options.cache !== 'no-store') {
                fetchOptions.next = { revalidate: 30 };
            }
        } else {
            fetchOptions.cache = 'no-store';
        }

        const response = await fetch(url, fetchOptions);

        debug(`[ERP_API] Response: ${response.status} from ${path}`);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown Error")

            // Only log errors for non-auth issues to prevent noise during redirects
            // [SAAS RESILIENCE] Suppress "No organization context" errors in the logs if we are at SaaS root
            const isContextError = errorText.includes("No organization context");
            const isSaaS = !context;

            if (response.status !== 401 && response.status !== 403) {
                if (isContextError && isSaaS) {
                    debug(`[ERP_API] Root/SaaS context - Ignoring expected missing context for ${path}`);
                } else {
                    console.error(`[ERP_API] Error response from ${path}:`, errorText.substring(0, 500));
                }
            }

            // [HTML DETECTION] Django returns HTML error pages when DEBUG=False and a 500 occurs.
            // Detect HTML responses early and throw a clean, JSON-parseable error instead of crashing on JSON.parse().
            const trimmed = errorText.trimStart();
            if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
                console.error(`[ERP_API] HTML error page received from ${path} (HTTP ${response.status})`);
                throw new Error(JSON.stringify({
                    error: `Server error (${response.status}). Please try again later.`
                }));
            }

            let errorData: Record<string, any> = {}
            try {
                errorData = JSON.parse(errorText)

                // Extract best possible error message
                let message = `ERP Error: ${response.statusText}`;

                if (typeof errorData === 'string') {
                    message = errorData;
                } else if (errorData.error) {
                    message = Array.isArray(errorData.error) ? errorData.error[0] : errorData.error;
                } else if (errorData.detail) {
                    message = errorData.detail;
                } else if (typeof errorData === 'object') {
                    // Handle field-specific errors or simple lists
                    const firstKey = Object.keys(errorData)[0];
                    if (firstKey) {
                        const val = errorData[firstKey];
                        message = Array.isArray(val) ? val[0] : val.toString();
                    }
                }

                throw new ErpApiError(message, response.status);
            } catch (e) {
                if (e instanceof ErpApiError) throw e;
                throw new ErpApiError(errorText || `ERP Backend error: ${response.statusText}`, response.status);
            }
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/pdf')) {
            return await response.blob();
        }

        return await response.json();
    } catch (error: unknown) {
        // Suppress noisy logs for expected auth redirection flows and known SaaS-root context gaps
        const msg = (error instanceof Error ? error.message : String(error)) || '';
        const isAuthError =
            msg.includes('Authentication credentials') ||
            msg.includes('Invalid token') ||
            msg.includes('401') ||
            msg.includes('403');

        // On SaaS root (no tenant context), "No organization context" is expected for
        // tenant-scoped endpoints — don't spam the log for these.
        const isExpectedContextError = !context && msg.includes('No organization context');

        if (!isAuthError && !isExpectedContextError) {
            console.error(`[ERP_API] Request to ${path} failed:`, error);
        }
        throw error;
    }
}
