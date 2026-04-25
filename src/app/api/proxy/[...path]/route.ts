import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_CONFIG } from '@/lib/branding';

const DJANGO_URL = process.env.DJANGO_URL || 'http://backend:8000';

/**
 * Next.js ERP Proxy
 * Forwards requests to the Django Backend and injects tenant context.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    return proxyRequest(req, path);
}

async function proxyRequest(req: NextRequest, pathParts: string[]) {
    // Use pathParts to get the clean structure, but explicitly add the trailing slash
    // that Django REST Framework expects for POST/PUT/PATCH requests.
    let apiPath = pathParts.join('/');

    // Always append trailing slash for backend parity if it's missing
    if (!apiPath.endsWith('/')) {
        apiPath += '/';
    }

    const searchParams = req.nextUrl.searchParams.toString();
    const targetUrl = `${DJANGO_URL}/api/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    // ─── AUTH & TENANT INJECTION ───
    const headers = new Headers();
    // Copy select headers to avoid corruption of multipart boundaries
    const headersToCopy = ['content-type', 'content-length', 'accept', 'authorization', 'x-tenant-id', 'x-tenant-slug', 'x-scope'];
    headersToCopy.forEach(h => {
        const val = req.headers.get(h);
        if (val) headers.set(h, val);
    });

    headers.set('Host', new URL(DJANGO_URL).host);

    // 1. Manually resolve auth token from cookies if Authorization is missing
    const authToken = req.cookies.get('auth_token')?.value;
    if (authToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Token ${authToken}`);
    }

    // 2. Extract tenant context from headers (injected by browser)
    let tenantId = req.headers.get('x-tenant-id');
    let tenantSlug = req.headers.get('x-tenant-slug');

    // 3. If missing, resolve from host
    if (!tenantId) {
        const host = req.headers.get('host') || '';
        const hostname = host.split(':')[0].toLowerCase();
        const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_CONFIG.domain).toLowerCase();

        // Check if it's a bare root domain (no subdomain at all)
        const isBareRoot = hostname === rootDomain ||
            hostname === `www.${rootDomain}` ||
            hostname.includes('vercel.app') ||
            /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

        if (!isBareRoot) {
            // Extract subdomain — includes 'saas' as a real tenant
            const parts = hostname.split('.');
            if (parts.length > 2 || (parts.length === 2 && hostname.endsWith(`.${rootDomain}`))) {
                tenantSlug = parts[0];
                tenantId = tenantSlug;
            }
        }
    }

    if (tenantId) headers.set('X-Tenant-Id', tenantId);
    if (tenantSlug) headers.set('X-Tenant-Slug', tenantSlug);

    // 4. Extract scope from cookies (Official vs Internal)
    const scope = req.cookies.get('tsf_view_scope')?.value || req.headers.get('x-scope');
    if (scope) {
        headers.set('X-Scope', scope.toUpperCase());
    }

    // 4b. Forward the user's authorized-scope (set httpOnly at login). Lets the
    // backend tell whether the requester is allowed to ask for INTERNAL data.
    const scopeAccess = req.cookies.get('scope_access')?.value;
    if (scopeAccess) {
        headers.set('X-Scope-Access', scopeAccess.toLowerCase());
    }

    console.log(`[ERP_PROXY] ${req.method} ${targetUrl} | Tenant: ${tenantSlug || 'None'} | Auth: ${headers.has('Authorization') ? 'Present' : 'Missing'}`);

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            // Stream the body for efficiency (multipart friendly)
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            // @ts-ignore - duplex is required for streaming bodies in fetch
            duplex: 'half',
        });

        console.log(`[ERP_PROXY] Response: ${response.status} from ${apiPath}`);
        return new NextResponse(response.body, {
            status: response.status,
            headers: response.headers,
        });
    } catch (error) {
        console.error('[ERP_PROXY] Forwarding failed:', error);
        return NextResponse.json({ error: 'ERP_BACKEND_UNREACHABLE', details: String(error) }, { status: 502 });
    }
}
