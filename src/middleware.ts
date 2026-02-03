import { NextRequest, NextResponse } from "next/server"

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
}

export default async function middleware(req: NextRequest) {
    const url = req.nextUrl
    // Extract subdomain
    const hostname = req.headers.get("host")?.split(":")[0] || "localhost"
    const hostnameParts = hostname.split('.')

    const searchParams = url.searchParams.toString()
    const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`

    let subdomain = ""
    if (hostname.includes("localhost")) {
        if (hostnameParts.length > 1) {
            subdomain = hostnameParts[0]
        }
    } else {
        // Production: expect xxx.domain.com (3 parts or more)
        if (hostnameParts.length > 2) {
            subdomain = hostnameParts[0]
        }
    }

    // 0. AUTHENTICATION CHECK
    const authToken = req.cookies.get("auth_token")?.value
    const isLoginPage = url.pathname.startsWith("/login") || url.pathname.startsWith("/auth")

    // If trying to access protected routes (admin, tenant dashboard) without token
    const isProtectedRoute =
        url.pathname.startsWith("/admin") ||
        url.pathname.startsWith("/tenant") ||
        url.pathname === "/dashboard"

    if (isProtectedRoute && !authToken) {
        // Allow public tenant paths if needed, but generally tenant = app, so login required.
        // For now, strict login.
        if (url.pathname.startsWith("/tenant") && url.pathname.includes("/public")) {
            // Check for public exceptions
        } else {
            const loginUrl = new URL("/login", req.url)
            // loginUrl.searchParams.set("callbackUrl", url.pathname)
            return NextResponse.redirect(loginUrl)
        }
    }

    // If logged in and at Login page, redirect to Dashboard (or tenant home)
    if (authToken && isLoginPage) {
        // If subdomain is saas, go to admin. If tenant, go to tenant dashboard.
        const dashboardUrl = new URL("/admin/dashboard", req.url);
        return NextResponse.redirect(dashboardUrl);
    }

    // SLIDING EXPIRATION: Refresh cookie if interacting with protected route
    // This ensures session stays alive as long as user is active
    let response = NextResponse.next()

    // 1. MASTER PANEL logic override
    if (subdomain === "saas") {
        const isAuth = url.pathname.startsWith("/login") || url.pathname.startsWith("/register") || url.pathname.startsWith("/auth");
        if (!url.pathname.startsWith("/admin/saas") && !isAuth) {
            response = NextResponse.rewrite(new URL(`/admin/saas${path}`, req.url))
        }
    }
    // 2. TENANT INSTANCE logic override
    else if (subdomain && subdomain !== "www") {
        if (
            url.pathname.startsWith("/admin") ||
            url.pathname.startsWith("/api") ||
            url.pathname.startsWith("/login") ||
            url.pathname.startsWith("/register") ||
            url.pathname.startsWith("/auth") ||
            url.pathname.startsWith("/_next") ||
            url.pathname.startsWith("/static")
        ) {
            // No rewrite needed
        } else if (!url.pathname.startsWith(`/tenant/${subdomain}`)) {
            response = NextResponse.rewrite(new URL(`/tenant/${subdomain}${path}`, req.url))
        }
    }
    // 3. LANDING PAGE logic
    else if (!subdomain || subdomain === "www") {
        const isInternalPath =
            url.pathname.startsWith("/admin") ||
            url.pathname.startsWith("/api") ||
            url.pathname.startsWith("/tenant") ||
            url.pathname.startsWith("/login") ||
            url.pathname.startsWith("/auth") ||
            url.pathname.startsWith("/register") ||
            url.pathname.startsWith("/saas") ||
            url.pathname.startsWith("/static") ||
            url.pathname.startsWith("/_next")

        if (!isInternalPath) {
            if (!url.pathname.startsWith("/landing")) {
                response = NextResponse.rewrite(new URL(`/landing${path}`, req.url))
            }
        }
    }

    // Set cookie if token exists (Sliding Window)
    if (authToken && !path.startsWith('/_next') && !path.startsWith('/static')) {
        response.cookies.set('auth_token', authToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 30, // Reset to 30 mins
        })
    }

    // DEVELOPMENT ONLY: Allow unsafe-eval for Turbopack/HMR to prevent browser blocking scripts
    if (process.env.NODE_ENV !== 'production') {
        response.headers.set(
            'Content-Security-Policy',
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
        )
    }

    return response
}
