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

    // 1. MASTER PANEL: saas.localhost -> /admin/saas
    if (subdomain === "saas") {
        if (url.pathname.startsWith("/admin/saas")) return NextResponse.next()
        return NextResponse.rewrite(new URL(`/admin/saas${path}`, req.url))
    }

    // 2. TENANT INSTANCE: xxx.localhost -> /tenant/[slug]
    if (subdomain && subdomain !== "www") {
        if (url.pathname.startsWith(`/tenant/${subdomain}`)) return NextResponse.next()
        return NextResponse.rewrite(new URL(`/tenant/${subdomain}${path}`, req.url))
    }

    // 3. LANDING PAGE: root localhost -> /landing (internal rewrite)
    if (!subdomain || subdomain === "www") {
        if (url.pathname.startsWith("/landing")) return NextResponse.next()
        return NextResponse.rewrite(new URL(`/landing${path}`, req.url))
    }

    return NextResponse.next()
}
