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
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";
    const isRootDomain = hostname === rootDomain || hostname === `www.${rootDomain}`;
    const isSaaSSubdomain = hostname === `saas.${rootDomain}`;

    // ROOT / SAAS PLATFORM LOGIC
    if (isLocalhost || isVercel || isRootDomain || isSaaSSubdomain) {

        if (isSaaSSubdomain) {
            // 1. Redirect legacy /saas/xxx to /xxx (Clean URL enforcement)
            if (url.pathname.startsWith('/saas')) {
                const cleanPath = url.pathname.replace('/saas', '') || '/';
                return NextResponse.redirect(new URL(`${cleanPath}${searchParams ? '?' + searchParams : ''}`, req.url));
            }

            // 2. Redirect root / to /dashboard for SaaS subdomain (Resolves conflict with (store))
            if (url.pathname === '/') {
                return NextResponse.redirect(new URL(`/dashboard${searchParams ? '?' + searchParams : ''}`, req.url));
            }

            return NextResponse.next();
        }

        // Special case: /saas is the Master Panel on root/IP
        // No longer needs rewrite to /admin since /saas is top-level
        if (url.pathname.startsWith('/saas') && !url.pathname.startsWith('/saas/login')) {
            return NextResponse.next();
        }

        // Default to Application or Landing
        const isAppRoute = url.pathname.startsWith('/login')
            || url.pathname.startsWith('/register')
            || url.pathname.startsWith('/admin')
            || url.pathname.startsWith('/dashboard')
            || url.pathname.startsWith('/organizations')
            || url.pathname.startsWith('/modules');

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
