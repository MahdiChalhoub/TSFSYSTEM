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

    try {
        const response = await fetch(url, {
            ...options,
            headers: headersRaw,
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `ERP Backend error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`[ERP_API] Request to ${path} failed:`, error);
        throw error;
    }
}
