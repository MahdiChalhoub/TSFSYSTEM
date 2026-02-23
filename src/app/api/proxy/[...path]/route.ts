import { NextRequest, NextResponse } from 'next/server';

const DJANGO_URL = process.env.DJANGO_URL || 'http://localhost:8000';

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
    const apiPath = pathParts.join('/');
    const searchParams = req.nextUrl.searchParams.toString();
    const targetUrl = `${DJANGO_URL}/api/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

    // Extract tenant context from headers (injected by middleware or previous logic)
    const tenantId = req.headers.get('x-tenant-id');
    const tenantSlug = req.headers.get('x-tenant-slug');

    const headers = new Headers(req.headers);
    headers.set('Host', new URL(DJANGO_URL).host);

    // Inject tenant info for Django isolation
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
