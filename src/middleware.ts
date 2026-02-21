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

    // ─── HTTPS ENFORCEMENT (Security) ───
    // Force HTTPS on ALL non-static routes in production.
    // Cloudflare sets x-forwarded-proto; if it's "http", redirect to https.
    // Skip for localhost/dev environments.
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

    if (proto === 'http' && !isLocal) {
        const httpsUrl = new URL(req.url);
        httpsUrl.protocol = 'https:';
        return NextResponse.redirect(httpsUrl, 301);
    }

    // ─── AUTH REDIRECT (Security) ───
    // Redirect unauthenticated users away from privileged routes.
    // This prevents layout shells from rendering for unauthenticated visitors.
    const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');
    const isPortalRoute = url.pathname.startsWith('/tenant') || url.pathname.startsWith('/supplier-portal');
    const isStorefrontAlias = url.pathname === '/store' || url.pathname === '/home';
    const isPublicRoute = url.pathname === '/' || url.pathname.startsWith('/landing') || isAuthRoute || isPortalRoute || isStorefrontAlias;
    const hasAuthToken = req.cookies.has('auth_token');

    if (!hasAuthToken && !isPublicRoute && !url.pathname.startsWith('/saas/login')) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('error', 'session_expired');
        return NextResponse.redirect(loginUrl);
    }

    // IP Address or Localhost handling for Root
    const isLocalhost = hostname.endsWith("localhost") || hostname.includes("127.0.0.1") || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    const isVercel = hostname.includes("vercel.app"); // Fallback for previews
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
    const isRootDomain = hostname === rootDomain || hostname === `www.${rootDomain}`;
    // Enhanced Localhost Subdomain detection
    const isSaaSSubdomain = hostname === `saas.${rootDomain}` || (hostname.startsWith("saas.") && hostname.includes("localhost"));

    // ROOT / SAAS PLATFORM LOGIC
    if (isLocalhost || isVercel || isRootDomain || isSaaSSubdomain) {

        if (isSaaSSubdomain) {
            // 1. Redirect legacy /saas/xxx to /xxx (Clean URL enforcement)
            if (url.pathname.startsWith('/saas')) {
                const cleanPath = url.pathname.replace('/saas', '') || '/';
                return NextResponse.redirect(new URL(`${cleanPath}${searchParams ? '?' + searchParams : ''}`, req.url));
            }

            // 2. Redirect root / to /dashboard for SaaS subdomain
            if (url.pathname === '/') {
                return NextResponse.redirect(new URL(`/dashboard${searchParams ? '?' + searchParams : ''}`, req.url));
            }

            // 3. Rewrite /dashboard to SaaS-specific dashboard on SaaS subdomain
            if (url.pathname === '/dashboard') {
                return NextResponse.rewrite(new URL(`/saas-home${searchParams ? '?' + searchParams : ''}`, req.url));
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
            || url.pathname.startsWith('/modules')
            || url.pathname.startsWith('/tsf-system-kernel-7788');

        if (isAppRoute) {
            return NextResponse.next();
        }

        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // TENANT SUBDOMAIN (e.g. pos.tsf.ci)
    const currentHost = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, "");

    // Check for reserved subdomains just in case
    if (currentHost === 'app' || currentHost === 'www') {
        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // On tenant subdomains, rewrite storefront routes to the tenant page.
    // "/", "/store", "/home" all map to the storefront.
    // All other routes (sales, dashboard, finance, etc.) pass through to the
    // regular app routes — the tenant context is established via cookies/headers.
    if (url.pathname === '/' || url.pathname === '/store' || url.pathname === '/home') {
        return NextResponse.rewrite(
            new URL(`/tenant/${currentHost}${searchParams.length > 0 ? '?' + searchParams : ''}`, req.url)
        );
    }

    // Let all app routes work normally on tenant subdomains
    return NextResponse.next();
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
