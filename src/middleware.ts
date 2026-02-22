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
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "tsf.ci";
    const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    const isVercel = hostname.includes("vercel.app");
    const isRootDomain = hostname === rootDomain || hostname === `www.${rootDomain}`;
    const isSaaSSubdomain = hostname === `saas.${rootDomain}`;

    // ROOT / SAAS PLATFORM LOGIC
    if (isLocalhost || isVercel || isRootDomain || isSaaSSubdomain) {
        if (isSaaSSubdomain) {
            // SaaS subdomain routes everything to /saas/ (login or dashboard)
            if (!url.pathname.startsWith('/saas')) {
                // If they request /login on saas. domain, send to /saas/login
                if (url.pathname === '/login') {
                    return NextResponse.rewrite(new URL(`/saas/login${searchParams.length > 0 ? `?${searchParams}` : ""}`, req.url));
                }
                if (url.pathname === '/') {
                    return NextResponse.rewrite(new URL(`/saas/dashboard${searchParams.length > 0 ? `?${searchParams}` : ""}`, req.url));
                }
                return NextResponse.rewrite(new URL(`/saas${path}`, req.url));
            }
            return NextResponse.next();
        }

        // Special case: /saas path on root domain
        if (url.pathname.startsWith('/saas')) {
            return NextResponse.next();
        }

        // Standard App Routes on Root
        const isAppRoute = url.pathname.startsWith('/login')
            || url.pathname.startsWith('/register')
            || url.pathname.startsWith('/admin');

        if (isAppRoute) {
            return NextResponse.next();
        }

        // Default to Landing for everything else on Root
        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // TENANT SUBDOMAIN (e.g. demo.tsf.ci)
    const currentHost = hostname.replace(`.${rootDomain}`, "");

    // Check for reserved subdomains
    if (currentHost === 'app' || currentHost === 'www') {
        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // Rewrite to tenant-specific logic
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
