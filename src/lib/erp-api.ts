import { headers } from 'next/headers';
// import { prisma } from './db'; // Prisma usage removed

// Use 127.0.0.1 to avoid IPv6 resolution issues with localhost on Windows/Node 18+
const DJANGO_URL = process.env.DJANGO_URL || 'http://127.0.0.1:8000';

export async function getTenantContext() {
    const headerList = await headers();
    const host = headerList.get('host') || 'localhost:3000';
    console.log(`[DEBUG] getTenantContext Host: ${host}`);

    // Precise Hostname extraction (removes port)
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');

    let subdomain = "";
    if (hostname.includes("localhost")) {
        if (parts.length > 1) subdomain = parts[0];
    } else {
        // Production: expect xxx.domain.com (3 parts or more)
        if (parts.length > 2) subdomain = parts[0];
    }

    console.log(`[DEBUG] Subdomain detected: ${subdomain}`);

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
    if (!headersRaw.has('Authorization')) {
        try {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            const token = cookieStore.get('auth_token')?.value;
            if (token) {
                headersRaw.set('Authorization', `Token ${token}`);
                console.log(`[ERP_API] Token found in cookies for ${path}: ${token.substring(0, 5)}...`);
            } else {
                console.log(`[ERP_API] No auth_token cookie found for ${path}`);
            }
        } catch (e) {
            console.log(`[ERP_API] Cookies not available in this context for ${path}`);
        }
    } else {
        console.log(`[ERP_API] Authorization header already present for ${path}`);
    }

    if (context) {
        headersRaw.set('X-Tenant-Id', context.id);
        headersRaw.set('X-Tenant-Slug', context.slug);
        console.log(`[DEBUG] erpFetch Context: ${context.slug}`);
    } else {
        // [SAAS FIX]
        // If no context (SaaS Panel), we DO NOT send X-Tenant-Id.
        // This is valid for /api/saas/, /api/sites/, etc.
        console.log(`[DEBUG] erpFetch Context: SaaS/Root (No Tenant ID sent)`);
    }

    const url = `${DJANGO_URL}/api/${path.startsWith('/') ? path.slice(1) : path}`;
    const cleanHeaders: any = {};
    headersRaw.forEach((v, k) => {
        cleanHeaders[k] = k.toLowerCase() === 'authorization' ? 'Token [REDACTED]' : v;
    });
    console.log(`[ERP_API] Request: ${options.method || 'GET'} ${url} | Headers: ${JSON.stringify(cleanHeaders)}`)

    try {
        const response = await fetch(url, {
            ...options,
            headers: headersRaw,
            cache: 'no-store'
        });

        console.log(`[ERP_API] Response: ${response.status} from ${path}`)

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown Error")

            // Only log errors for non-auth issues to prevent noise during redirects
            // [SAAS RESILIENCE] Suppress "No organization context" errors in the logs if we are at SaaS root
            const isContextError = errorText.includes("No organization context");
            const isSaaS = !context;

            if (response.status !== 401 && response.status !== 403) {
                if (isContextError && isSaaS) {
                    console.log(`[ERP_API] Root/SaaS context - Ignoring expected missing context for ${path}`);
                } else {
                    console.error(`[ERP_API] Error response from ${path}:`, errorText);
                }
            } else {
                // Debug log only for auth failures
                console.log(`[ERP_API] Auth required for ${path}: ${response.status}`);
            }

            let errorData: any = {}
            try {
                errorData = JSON.parse(errorText)
                // Throw the whole data object so catch blocks can access field-specific errors
                throw new Error(JSON.stringify(errorData));
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('{')) throw e;
                throw new Error(errorData.error || errorData.detail || `ERP Backend error: ${response.statusText}`);
            }
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error: any) {
        // Suppress noisy logs for expected auth redirection flows
        const isAuthError =
            error.message?.includes('Authentication credentials') ||
            error.message?.includes('Invalid token') ||
            error.message?.includes('401') ||
            error.message?.includes('403');

        if (!isAuthError) {
            console.error(`[ERP_API] Request to ${path} failed:`, error);
        } else {
            // Keep debug log for troubleshooting if needed, but clean up production/dev console
            console.log(`[ERP_API] Auth check failed for ${path} (Handled)`);
        }
        throw error;
    }
}

export async function getUser() {
    try {
        return await erpFetch('auth/me/');
    } catch {
        return null;
    }
}
