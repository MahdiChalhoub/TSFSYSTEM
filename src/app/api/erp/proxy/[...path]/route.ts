import { NextRequest, NextResponse } from "next/server"

/**
 * API GATEWAY PROXY
 * Redirects ERP requests to the Django backend while handling authentication and tenant context.
 */
export async function POST(req: NextRequest) {
    const { pathname, search } = new URL(req.url)
    const djangoUrl = process.env.DJANGO_API_URL || 'http://localhost:8000'

    // Extract endpoint from proxy path
    // e.g. /api/erp/proxy/finance/ledger -> finance/ledger
    const endpoint = pathname.replace('/api/erp/proxy/', '')

    const body = await req.json()

    try {
        const response = await fetch(`${djangoUrl}/api/${endpoint}${search}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Future: Add JWT or internal token from NextAuth session
                'X-Tenant-Slug': body.tenantSlug || 'default'
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })
    } catch (error) {
        console.error("ERP Proxy Error:", error)
        return NextResponse.json({ error: "Failed to connect to ERP Core" }, { status: 502 })
    }
}

export async function GET(req: NextRequest) {
    const { pathname, search } = new URL(req.url)
    const djangoUrl = process.env.DJANGO_API_URL || 'http://localhost:8000'
    const endpoint = pathname.replace('/api/erp/proxy/', '')

    try {
        const response = await fetch(`${djangoUrl}/api/${endpoint}${search}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })
    } catch (error) {
        return NextResponse.json({ error: "Failed to connect to ERP Core" }, { status: 502 })
    }
}
