import { cache } from 'react';

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

// Default per-request timeout. Django occasionally hangs (slow queries, stale
// connections, pending migrations) and the Node fetch default is ~300s — far
// past nginx's upstream_read_timeout, which produces cascading 504s and ties
// up Next.js workers. Bound each request to 20s so a hung backend fails fast
// and the caller can recover, fall back, or retry.
const ERP_FETCH_TIMEOUT_MS = Number(process.env.ERP_FETCH_TIMEOUT_MS) || 20_000;

/** Wraps fetch() with an AbortController so hung requests don't consume the
 *  Next.js worker. Callers may still pass their own `signal` via options; we
 *  merge them — whichever aborts first wins. */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = ERP_FETCH_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If caller supplied a signal, forward its aborts into our controller too
    const callerSignal = options.signal as AbortSignal | undefined;
    if (callerSignal) {
        if (callerSignal.aborted) controller.abort();
        else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/** Custom error class for ERP API errors — used for type-safe catch blocks */
export class ErpApiError extends Error {
    status: number
    data?: Record<string, any>
    constructor(message: string, status: number, data?: Record<string, any>) {
        super(message)
        this.name = 'ErpApiError'
        this.status = status
        this.data = data
    }
}

// Client-side singleton cache for the resolved tenant context. React.cache()
// below only dedupes within a single server render — the browser would
// otherwise call /tenant/resolve on EVERY erpFetch (one per component mount),
// instantly hitting the rate-limiter on a busy page. Cache for 5 min.
type TenantContext = (Record<string, any> & { id: string; slug: string }) | null
let _tenantPromise: Promise<TenantContext> | null = null
let _tenantCachedAt = 0
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000

async function resolveTenantContextImpl(): Promise<TenantContext> {
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

    // Extract hostname without port (host may be "sub.domain.com:3000")
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');

    // IP detection: port is already stripped, so no (?::[0-9]+)? needed
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    let subdomain = "";
    if (isIp) {
        subdomain = "";
    } else if (hostname.includes("localhost")) {
        if (parts.length > 1) subdomain = parts[0];
    } else {
        // Production: expect sub.domain.tld (≥3 parts)
        if (parts.length > 2) subdomain = parts[0];
    }

    debug(`[DEBUG] Subdomain detected: ${subdomain}`);

    if (!subdomain || subdomain === "www") {
        // Root Domain only - No Tenant Context (Fallback)
        return null;
    }

    try {
        // Client: route through proxy (DJANGO_URL is null on client — can't call directly)
        // Server: call Django directly (faster, no HTTP hop)
        const tenantResolveUrl = isClient
            ? `/api/proxy/tenant/resolve/?slug=${subdomain}`
            : `${DJANGO_URL}/api/tenant/resolve/?slug=${subdomain}`;

        const res = await fetchWithTimeout(tenantResolveUrl, {
            cache: 'no-store',  // Never cache — a cached 404 causes infinite crash loops
        });

        if (!res.ok) {
            // 429 from rate-limiter is the most common outcome on a heavy
            // initial load — log once at warn level instead of error so the
            // console doesn't flood (the singleton cache above also prevents
            // it from happening on subsequent calls in this session).
            if (res.status === 429) {
                console.warn(`[DEBUG] Tenant Resolution rate-limited (429) — falling back to no-tenant context`);
            } else {
                console.error(`[DEBUG] Tenant Resolution Failed: ${res.status}`);
            }
            return null;
        }
        return await res.json();
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('aborted')) {
            console.error('[DEBUG] Tenant Resolution timed out — Django slow or unreachable');
        } else {
            console.error("Failed to resolve tenant:", e);
        }
        return null;
    }
}

// Wraps the resolver with both server-side React.cache (per-render dedup) AND
// a client-side module-level Promise cache (session-long dedup with TTL refresh).
//
// Caching policy:
//   - Successful resolve (real tenant)         → cache for TTL
//   - Resolved to null because no subdomain    → cache for TTL (won't change)
//   - Resolved to null due to 429/timeout/etc  → DO NOT CACHE; next call retries
//   - Thrown error                             → drop cache so next call retries
//
// Without the third bullet, a transient rate-limit on the very first call
// would pin a null tenant context for the full TTL — every subsequent
// erpFetch would send no X-Tenant-Id and the data endpoints would all 4xx.
async function resolveTenantContext(): Promise<TenantContext> {
    if (typeof window === 'undefined') return resolveTenantContextImpl()
    const now = Date.now()
    if (_tenantPromise && (now - _tenantCachedAt) < TENANT_CACHE_TTL_MS) {
        return _tenantPromise
    }
    _tenantCachedAt = now
    const fresh = (async () => {
        try {
            const v = await resolveTenantContextImpl()
            // If we got null but the URL DOES have a subdomain, that's a
            // transient failure (rate-limit, network glitch, etc) — don't
            // pin null in the cache.
            if (v === null) {
                const host = (typeof window !== 'undefined' ? window.location.host : '').split(':')[0].toLowerCase()
                const parts = host.split('.')
                const looksLikeTenantSub = parts.length >= 2 && parts[0] !== 'www'
                if (looksLikeTenantSub) {
                    _tenantPromise = null
                    _tenantCachedAt = 0
                }
            }
            return v
        } catch (err) {
            _tenantPromise = null
            _tenantCachedAt = 0
            throw err
        }
    })()
    _tenantPromise = fresh
    return _tenantPromise
}

// React.cache() deduplicates calls within a single server render — all erpFetch
// calls in the same request reuse the same resolved tenant, eliminating N redundant
// backend fetches (one per erpFetch call in layout + page data loaders).
export const getTenantContext = cache(resolveTenantContext);

export async function erpFetch(path: string, options: RequestInit = {}) {
    const context = await getTenantContext();
    const headersRaw = new Headers(options.headers || {});

    // [AUTH + SCOPE HEADERS]
    // Server-side only: read cookies once, inject Authorization + X-Scope together.
    // Client-side: the /api/proxy/ route handles both (reads httpOnly cookies server-side).
    const isLoginEndpoint = path.includes('auth/login');

    if (!isClient) {
        try {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies(); // single read — reused for both headers

            if (!headersRaw.has('Authorization') && !isLoginEndpoint) {
                const token = cookieStore.get('auth_token')?.value;
                if (token) {
                    headersRaw.set('Authorization', `Token ${token}`);
                    debug(`[ERP_API] Token injected for ${path}`);
                }
            }

            if (!headersRaw.has('X-Scope')) {
                const scope = cookieStore.get('tsf_view_scope')?.value;
                if (scope) headersRaw.set('X-Scope', scope.toUpperCase());
            }

            if (!headersRaw.has('X-Scope-Access')) {
                const scopeAccess = cookieStore.get('scope_access')?.value;
                if (scopeAccess) headersRaw.set('X-Scope-Access', scopeAccess.toLowerCase());
            }
        } catch (e) {
            // Cookies not available in static generation context
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

        const response = await fetchWithTimeout(url, fetchOptions);

        debug(`[ERP_API] Response: ${response.status} from ${path}`);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown Error")

            // Only log errors for non-auth issues to prevent noise during redirects
            // [SAAS RESILIENCE] Suppress expected errors on SaaS root domain:
            // - "No organization context" / "No tenant context" errors
            // - 404s on tenant-scoped endpoints (organizations/me, inventory/warehouses, modules, etc.)
            const isContextError = errorText.includes("No organization context") || errorText.includes("No tenant context");
            const isSaaS = !context;
            const isExpectedSaaS404 = isSaaS && response.status === 404 && (
                path.includes('organizations/me') ||
                path.includes('inventory/warehouses') ||
                path.includes('business-types') ||
                path.includes('modules/')
            );

            if (response.status !== 401 && response.status !== 403) {
                if ((isContextError && isSaaS) || isExpectedSaaS404) {
                    debug(`[ERP_API] Root/SaaS context - Returning null for ${path} (no tenant)`);
                } else {
                    console.error(`[ERP_API] Error response from ${path}:`, errorText.substring(0, 500));
                }
            }

            // [HTML DETECTION] Django returns HTML error pages when DEBUG=False and a 500 occurs.
            // Match only real HTML documents (<!DOCTYPE or <html) — never bare JSON with < operators.
            const trimmed = errorText.trimStart();
            if (trimmed.startsWith('<!') || /^<html[\s>]/i.test(trimmed)) {
                if (!isExpectedSaaS404) {
                    console.error(`[ERP_API] HTML error page received from ${path} (HTTP ${response.status})`);
                }
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

                throw new ErpApiError(message, response.status, errorData);
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
        // Timeout/abort — surface as a typed 504-ish error so callers can
        // distinguish a slow/down backend from a real application-level error.
        const errName = (error instanceof Error ? error.name : '') || '';
        const msgRaw = (error instanceof Error ? error.message : String(error)) || '';
        const isAbort = errName === 'AbortError' || msgRaw.toLowerCase().includes('aborted');
        if (isAbort) {
            console.error(`[ERP_API] Request to ${path} timed out after ${ERP_FETCH_TIMEOUT_MS}ms — Django slow or unreachable`);
            throw new ErpApiError(`Backend timeout: ${path}`, 504);
        }

        // Suppress noisy logs for expected auth redirection flows and known SaaS-root context gaps
        const msg = msgRaw;
        const isAuthError =
            msg.includes('Authentication credentials') ||
            msg.includes('Invalid token') ||
            msg.includes('401') ||
            msg.includes('403');

        // On SaaS root (no tenant context), many tenant-scoped endpoints are expected to fail.
        const isExpectedSaaSError = !context && (
            msg.includes('No organization context') ||
            msg.includes('No tenant context') ||
            msg.includes('Not found')
        );

        if (!isAuthError && !isExpectedSaaSError) {
            console.error(`[ERP_API] Request to ${path} failed:`, error);
        }
        throw error;
    }
}
