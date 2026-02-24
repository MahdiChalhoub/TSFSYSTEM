import { NextRequest, NextResponse } from "next/server";
import { MODULE_ROUTES } from "@/lib/module-routes";

export default async function middleware(req: NextRequest) {
    const url = req.nextUrl;

    // ─── DEV MODULE GUARD ────────────────────────────────────────────────────
    // When DEV_MODULE is set, only allow routes for the active module + core routes.
    // This is only set locally via `npm run dev:module -- <module>`.
    // In production, DEV_MODULE is never set, so this block is skipped entirely.
    const devModule = process.env.DEV_MODULE;
    if (devModule) {
        const pathname = url.pathname;

        // Always allow: static files, API, Next.js internals, auth, core
        const isCorePath =
            pathname === '/' ||
            pathname.includes('.') ||
            pathname.startsWith('/api') ||
            pathname.startsWith('/_next') ||
            pathname.startsWith('/login') ||
            pathname.startsWith('/register') ||
            pathname.startsWith('/dashboard') ||
            pathname.startsWith('/settings') ||
            pathname.startsWith('/saas') ||
            pathname.startsWith('/workspace') ||
            pathname.startsWith('/users') ||
            pathname.startsWith('/landing') ||
            pathname.startsWith('/tenant') ||
            pathname.startsWith('/supplier-portal') ||
            pathname.startsWith('/monitoring');

        if (!isCorePath) {
            // Check if this route belongs to ANY module
            const routeModule = Object.entries(MODULE_ROUTES).find(([, prefixes]) =>
                prefixes.some(prefix => pathname.startsWith(prefix))
            );

            // If it belongs to a module that is NOT the active dev module → block it
            if (routeModule && routeModule[0] !== devModule) {
                const blockedModule = routeModule[0];
                return new NextResponse(
                    `<!DOCTYPE html>
                    <html>
                    <head><title>Module Locked</title></head>
                    <body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif">
                        <div style="text-align:center;max-width:480px;padding:40px">
                            <div style="font-size:64px;margin-bottom:16px">🔒</div>
                            <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 8px">Module Locked</h1>
                            <p style="color:#64748b;font-size:16px;margin:0 0 24px">
                                You're in <strong style="color:#059669">DEV MODE: ${devModule.toUpperCase()}</strong>.
                                <br/>The <strong>${blockedModule}</strong> module is not active.
                            </p>
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:left;font-size:14px;color:#166534">
                                <strong>To switch modules:</strong><br/>
                                <code style="background:#dcfce7;padding:2px 6px;border-radius:4px;font-size:13px">
                                    npm run dev:module -- ${blockedModule}
                                </code>
                            </div>
                            <a href="/dashboard" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#059669;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                                ← Go to Dashboard
                            </a>
                        </div>
                    </body>
                    </html>`,
                    { status: 200, headers: { 'Content-Type': 'text/html' } }
                );
            }
        }
    }
    // ─── END DEV MODULE GUARD ────────────────────────────────────────────────

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
    // Removed: Cloudflare handles "Always Use HTTPS". Doing this here causes
    // an infinite redirect loop if Cloudflare connects to Nginx over HTTP (Flexible SSL).
    // The loop: CF connects -> Nginx sets X-Forwarded-Proto: http -> Next.js redirects to https -> CF connects over HTTP -> repeat.

    // ─── HOSTNAME DETECTION (needed for auth redirect logic) ───
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
    const isRootDomain = hostname === rootDomain || hostname === `www.${rootDomain}`;
    const isLocalhost = hostname.endsWith("localhost") || hostname.includes("127.0.0.1") || hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    const isVercel = hostname.includes("vercel.app"); // Fallback for previews
    const isSaaSSubdomain = hostname === `saas.${rootDomain}` || (hostname.startsWith("saas.") && hostname.includes("localhost"));
    const isOnRootOrSaaS = isLocalhost || isVercel || isRootDomain || isSaaSSubdomain;
    const isOnTenantSubdomain = !isOnRootOrSaaS;

    // ─── AUTH REDIRECT (Security) ───
    // Redirect unauthenticated users away from privileged routes.
    // This prevents layout shells from rendering for unauthenticated visitors.
    const isAuthRoute = url.pathname.startsWith('/login') || url.pathname.startsWith('/register');
    const isPortalRoute = url.pathname.startsWith('/tenant') || url.pathname.startsWith('/supplier-portal');
    const isStorefrontAlias = url.pathname === '/store' || url.pathname === '/home';

    // Storefront sub-routes that should be public.
    // On tenant subdomains, these arrive BEFORE the tenant rewrite.
    // /shop/* routes are the customer-facing storefront (including /shop/login).
    const isStorefrontSubRoute =
        url.pathname.startsWith('/product') ||
        url.pathname.startsWith('/categories') ||
        url.pathname.startsWith('/cart') ||
        url.pathname.startsWith('/checkout') ||
        url.pathname.startsWith('/search') ||
        url.pathname.startsWith('/account') ||
        url.pathname.startsWith('/quote') ||
        url.pathname.startsWith('/shop') ||
        url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/register');

    const isPublicRoute = url.pathname === '/' || url.pathname.startsWith('/landing') || isAuthRoute || isPortalRoute || isStorefrontAlias || isStorefrontSubRoute;
    const hasAuthToken = req.cookies.get('auth_token')?.value && req.cookies.get('auth_token')?.value !== '';

    if (!hasAuthToken && !isPublicRoute && !url.pathname.startsWith('/saas/login')) {
        const loginUrl = url.clone();
        // On tenant subdomains, redirect to /login on the SAME subdomain.
        // /login is the employee/admin ERP login for this workspace.
        // (Customer login is at /shop/login — a separate storefront route.)
        loginUrl.hostname = hostname;
        loginUrl.pathname = '/login';
        loginUrl.port = "";
        loginUrl.searchParams.set('error', 'session_expired');
        return NextResponse.redirect(loginUrl);
    }

    // ROOT / SAAS PLATFORM LOGIC
    if (isOnRootOrSaaS) {

        if (isSaaSSubdomain) {
            // 1. Redirect legacy /saas/xxx to /xxx (Clean URL enforcement)
            if (url.pathname.startsWith('/saas')) {
                const cleanPath = url.pathname.replace('/saas', '') || '/';
                const redirectUrl = url.clone();
                redirectUrl.pathname = cleanPath;
                redirectUrl.hostname = hostname;
                redirectUrl.port = "";
                return NextResponse.redirect(redirectUrl);
            }

            // 2. Redirect root / to /dashboard for SaaS subdomain
            if (url.pathname === '/') {
                const dashboardUrl = url.clone();
                dashboardUrl.pathname = '/dashboard';
                dashboardUrl.hostname = hostname;
                dashboardUrl.port = "";
                return NextResponse.redirect(dashboardUrl);
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
            || url.pathname.startsWith('/storage')
            || url.pathname.startsWith('/inventory')
            || url.pathname.startsWith('/finance')
            || url.pathname.startsWith('/sales')
            || url.pathname.startsWith('/purchases')
            || url.pathname.startsWith('/crm')
            || url.pathname.startsWith('/hr')
            || url.pathname.startsWith('/products')
            || url.pathname.startsWith('/ecommerce')
            || url.pathname.startsWith('/migration')
            || url.pathname.startsWith('/settings')
            || url.pathname.startsWith('/workspace')
            || url.pathname.startsWith('/users')
            || url.pathname.startsWith('/connector')
            || url.pathname.startsWith('/encryption')
            || url.pathname.startsWith('/health')
            || url.pathname.startsWith('/subscription')
            || url.pathname.startsWith('/updates')
            || url.pathname.startsWith('/apps')
            || url.pathname.startsWith('/currencies')
            || url.pathname.startsWith('/kernel')
            || url.pathname.startsWith('/mcp')
            || url.pathname.startsWith('/switcher')
            || url.pathname.startsWith('/supplier-portal')
            || url.pathname.startsWith('/tsf-system-kernel-7788');

        if (isAppRoute) {
            return NextResponse.next();
        }

        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // TENANT SUBDOMAIN (e.g. pos.tsf.ci)
    // Robust detection: use the same part-splitting logic as in erp-api.ts
    const parts = hostname.split('.');
    let currentHost = "";

    if (parts.length > 2) {
        // e.g. org.tsf.ci or org.tsf.localhost
        currentHost = parts[0];
    } else {
        // Fallback or development (localhost)
        currentHost = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost'}`, "");
    }

    // Check for reserved subdomains just in case
    if (currentHost === 'app' || currentHost === 'www') {
        return NextResponse.rewrite(new URL(`/landing${path === "/" ? "" : path}`, req.url));
    }

    // ─── TENANT SUBDOMAIN STOREFRONT REWRITES ─────────────────────────────
    // On tenant subdomains (e.g. tsf-global.tsf.ci), rewrite storefront
    // routes so users see clean URLs:
    //   tsf-global.tsf.ci/register  →  internally /tenant/tsf-global/register
    //   tsf-global.tsf.ci/account   →  internally /tenant/tsf-global/account
    //
    // ERP admin routes (sales, finance, inventory, etc.) still pass through
    // directly since those belong to the authenticated admin panel.

    // ─── SECURITY: SaaS-Only Routes ─────────────────────────────────────
    // These routes are EXCLUSIVELY for the SaaS master panel (saas.tsf.ci).
    // They must NEVER be accessible from tenant subdomains, even if the
    // user is authenticated. These control global platform infrastructure.
    const isSaaSOnlyRoute =
        url.pathname.startsWith('/organizations') ||
        url.pathname.startsWith('/modules') ||
        url.pathname.startsWith('/saas') ||
        url.pathname.startsWith('/connector') ||
        url.pathname.startsWith('/encryption') ||
        url.pathname.startsWith('/health') ||
        url.pathname.startsWith('/subscription') ||
        url.pathname.startsWith('/updates') ||
        url.pathname.startsWith('/migration') ||
        url.pathname.startsWith('/apps') ||
        url.pathname.startsWith('/currencies') ||
        url.pathname.startsWith('/kernel') ||
        url.pathname.startsWith('/mcp') ||
        url.pathname.startsWith('/switcher') ||
        url.pathname.startsWith('/tsf-system-kernel-7788');

    // BLOCK: Tenant users cannot access SaaS infrastructure pages
    if (isSaaSOnlyRoute) {
        const blockedUrl = url.clone();
        blockedUrl.pathname = '/dashboard';
        blockedUrl.hostname = hostname;
        blockedUrl.port = "";
        blockedUrl.searchParams.set('error', 'access_denied');
        blockedUrl.searchParams.set('reason', 'saas_only');
        return NextResponse.redirect(blockedUrl);
    }

    // Tenant ERP/admin routes that pass through directly (NOT rewritten to storefront).
    // /login and /register are now EMPLOYEE routes on tenant subdomains.
    // Customer/storefront login is at /shop/login.
    const isTenantAdminRoute =
        url.pathname.startsWith('/dashboard') ||
        url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/register') ||
        url.pathname.startsWith('/storage') ||
        url.pathname.startsWith('/inventory') ||
        url.pathname.startsWith('/finance') ||
        url.pathname.startsWith('/sales') ||
        url.pathname.startsWith('/purchases') ||
        url.pathname.startsWith('/crm') ||
        url.pathname.startsWith('/hr') ||
        url.pathname.startsWith('/products') ||
        url.pathname.startsWith('/ecommerce') ||
        url.pathname.startsWith('/settings') ||
        url.pathname.startsWith('/workspace') ||
        url.pathname.startsWith('/users') ||
        url.pathname.startsWith('/supplier-portal');

    // If it's already a /tenant/... path, let it through (prevent double rewrite)
    if (url.pathname.startsWith('/tenant')) {
        return NextResponse.next();
    }

    // If it's a tenant-allowed ERP admin route, let it through
    if (isTenantAdminRoute) {
        return NextResponse.next();
    }

    // ─── STOREFRONT ROUTES ─────────────────────────────────────────────
    // Everything else on the tenant subdomain is a storefront route.
    // Rewrite it to /tenant/[slug]/... internally.
    //
    // Route mapping:
    //   /                    →  /tenant/tsf-global           (storefront home)
    //   /shop                →  /tenant/tsf-global           (storefront home alias)
    //   /shop/login          →  /tenant/tsf-global/login     (customer login)
    //   /shop/register       →  /tenant/tsf-global/register  (customer register)
    //   /shop/account        →  /tenant/tsf-global/account   (customer account)
    //   /product/123         →  /tenant/tsf-global/product/123
    //   /categories          →  /tenant/tsf-global/categories
    //   /cart                →  /tenant/tsf-global/cart
    //   /account             →  /tenant/tsf-global/account
    //
    // /shop/* prefix strips the /shop part before rewriting:
    let storefrontInternalPath = url.pathname;
    if (url.pathname.startsWith('/shop')) {
        // Strip /shop prefix: /shop/login → /login, /shop → /
        storefrontInternalPath = url.pathname.replace(/^\/shop/, '') || '/';
    }

    const storefrontPath = storefrontInternalPath === '/' || storefrontInternalPath === '/store' || storefrontInternalPath === '/home'
        ? `/tenant/${currentHost}`
        : `/tenant/${currentHost}${storefrontInternalPath}`;

    return NextResponse.rewrite(
        new URL(`${storefrontPath}${searchParams.length > 0 ? '?' + searchParams : ''}`, req.url)
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
