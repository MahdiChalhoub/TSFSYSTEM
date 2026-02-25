import { NextRequest, NextResponse } from 'next/server';

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
    const headers = new Headers(req.headers);
    headers.set('Host', new URL(DJANGO_URL).host);

    // 1. Manually resolve auth token from cookies if Authorization is missing
    const authToken = req.cookies.get('auth_token')?.value;
    if (authToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Token ${authToken}`);
    }

    // 2. Extract tenant context from headers (injected by middleware or browser)
    let tenantId = req.headers.get('x-tenant-id');
    let tenantSlug = req.headers.get('x-tenant-slug');

    // 3. If missing (common for client-side fetches), try to resolve from host
    if (!tenantId) {
        const host = req.headers.get('host') || '';
        const hostname = host.split(':')[0].toLowerCase();
        const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tsf.ci').toLowerCase();

        const isSaas = hostname === rootDomain ||
            hostname === `www.${rootDomain}` ||
            hostname === `saas.${rootDomain}` ||
            hostname.includes('vercel.app');

        if (!isSaas) {
            // It's a tenant subdomain (e.g. acme.tsf.ci)
            const parts = hostname.split('.');
            if (parts.length > 2 || (parts.length === 2 && hostname.endsWith(`.${rootDomain}`))) {
                tenantSlug = parts[0];
                // Note: We only have the slug here. Our backend TenantMiddleware 
                // now supports slugs in X-Tenant-Id, so we can pass it there!
                tenantId = tenantSlug;
            }
        }
    }

    if (tenantId) headers.set('X-Tenant-Id', tenantId);
    if (tenantSlug) headers.set('X-Tenant-Slug', tenantSlug);

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: req.method !== 'GET' ? await req.blob() : undefined,
        });

        const data = await response.blob();

        return new NextResponse(data, {
            status: response.status,
            headers: response.headers,
        });
    } catch (error) {
        console.error('[ERP_PROXY] Forwarding failed:', error);
        return NextResponse.json({ error: 'ERP_BACKEND_UNREACHABLE' }, { status: 502 });
    }
}
