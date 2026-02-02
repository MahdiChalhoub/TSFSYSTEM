import { headers } from 'next/headers';
import { prisma } from './db';

const DJANGO_URL = process.env.DJANGO_URL || 'http://localhost:8000';

export async function getTenantContext() {
    const headerList = await headers();
    const host = headerList.get('host') || 'localhost:3000';

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

    if (!subdomain || subdomain === "localhost" || subdomain === "saas" || subdomain === "www") {
        return null; // Master panel or landing page
    }

    const org = await prisma.organization.findUnique({
        where: { slug: subdomain },
        select: { id: true, slug: true }
    });

    return org;
}

export async function erpFetch(path: string, options: RequestInit = {}) {
    const context = await getTenantContext();
    const headersRaw = new Headers(options.headers || {});

    if (context) {
        headersRaw.set('X-Tenant-Id', context.id);
        headersRaw.set('X-Tenant-Slug', context.slug);
    }

    const url = `${DJANGO_URL}/api/${path.startsWith('/') ? path.slice(1) : path}`;
    console.log(`[ERP_API] Requesting: ${options.method || 'GET'} ${url}`)

    try {
        const response = await fetch(url, {
            ...options,
            headers: headersRaw,
            cache: 'no-store'
        });

        console.log(`[ERP_API] Response: ${response.status} from ${path}`)

        if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown Error")
            console.error(`[ERP_API] Error response from ${path}:`, errorText)
            let errorData: any = {}
            try { errorData = JSON.parse(errorText) } catch (e) { }
            throw new Error(errorData.error || `ERP Backend error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[ERP_API] Request to ${path} failed:`, error);
        throw error;
    }
}
