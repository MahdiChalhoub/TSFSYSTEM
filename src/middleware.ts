import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
    const url = req.nextUrl;

    // Get hostname (e.g. "tenant.tsfcloud.com" or "localhost:3000")
    let hostname = req.headers.get("host")!;

    // Remove port if present
    hostname = hostname.replace("www.", "").split(":")[0];

    const searchParams = req.nextUrl.searchParams.toString();
    // Get the pathname of the request (e.g. /, /about, /blog/first-post)
    const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""
        }`;

    // Rewrites for public files
    if (
        url.pathname.includes('.') ||
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/monitoring')
    ) {
        return NextResponse.next();
    }

    // IP Address or Localhost handling for Root
    const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    const isVercel = hostname.includes("vercel.app"); // Fallback for previews

    // ROOT DOMAIN (e.g. tsfcloud.com or just IP)
    // If accessing via IP directly in production, treat as LANDING
    if (isLocalhost || isVercel || hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN) {

        // Special case: /saas is the Master Panel
        if (url.pathname.startsWith('/saas') && !url.pathname.startsWith('/saas/login')) {
            return NextResponse.rewrite(new URL(`/admin${path}`, req.url));
        }

        // Default to Application or Landing
        const isAppRoute = url.pathname.startsWith('/login')
            || url.pathname.startsWith('/register')
            || url.pathname.startsWith('/admin')
            || url.pathname === '/saas/login';

        if (isAppRoute) {
            return NextResponse.next();
        }

        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // TENANT SUBDOMAIN (e.g. demo.tsfcloud.com)
    // Rewrite to /tenant/[slug]
    const currentHost = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, "");

    // Check for reserved subdomains just in case
    if (currentHost === 'app' || currentHost === 'www') {
        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    return NextResponse.rewrite(
        new URL(`/tenant/${currentHost}${path}`, req.url)
    );
}

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /api routes
         * 2. /_next (Next.js internals)
         * 3. /_static (inside /public)
         * 4. all root files inside /public (e.g. /favicon.ico)
         */
        "/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)",
    ],
};
