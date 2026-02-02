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
    const hostname = req.headers.get("host") || "localhost:3000"

    // Extract subdomain (works for localhost and production domains)
    // localhost:3000 -> ["localhost:3000"]
    // saas.localhost:3000 -> ["saas", "localhost:3000"]
    // demo.tsf-city.com -> ["demo", "tsf-city", "com"]
    const searchParams = url.searchParams.toString()
    const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ""}`

    const hostnameParts = hostname.split('.')

    // Logic for localhost development vs Production
    let subdomain = ""
    if (hostnameParts.length > 1 && !hostname.includes("localhost")) {
        // Production: xxx.domain.com
        subdomain = hostnameParts[0]
    } else if (hostnameParts.length > 2 && hostname.includes("localhost")) {
        // Localhost: xxx.localhost:3000
        subdomain = hostnameParts[0]
    }

    // 1. MASTER PANEL: saas.localhost -> /admin/saas
    if (subdomain === "saas") {
        return NextResponse.rewrite(new URL(`/admin/saas${path}`, req.url))
    }

    // 2. TENANT INSTANCE: xxx.localhost -> /tenant/[slug]
    if (subdomain && subdomain !== "www") {
        return NextResponse.rewrite(new URL(`/tenant/${subdomain}${path}`, req.url))
    }

    // 3. LANDING PAGE: root localhost -> /landing (internal rewrite)
    // We rewrite so the URL remains clean as "/"
    if (!subdomain || subdomain === "www") {
        return NextResponse.rewrite(new URL(`/landing${path}`, req.url))
    }

    return NextResponse.next()
}
