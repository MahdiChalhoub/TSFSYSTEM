'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { PLATFORM_CONFIG } from '@/lib/saas_config'

// Original schema
const LoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

// Schema for root login (requires slug)
const RootLoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
    slug: z.string().optional() // Optional because tenant login doesn't need it
})

export async function loginAction(prevState: any, formData: FormData) {
    const data = Object.fromEntries(formData.entries())

    // Check if we are validating with slug or without
    // If we are on root (determined by frontend state or hidden field?), we need slug.
    // However, simplest is to check if 'slug' key exists in formData and is not empty

    // Actually, handling redirection:
    // If slug is provided, we should redirect the user to the tenant login page
    // So they can login there (ensures cookies are set on correct subdomain).
    // OR, if the user expects "Single Sign On" feel, we login against backend and get token.
    // Backend supports Host header tenant resolution.
    // If we are on localhost:3000, we can't easily set a cookie for sub.localhost:3000 
    // unless domain is .localhost (which is tricky on some browsers/local setup).

    // SAFE APPROACH: If slug provided, redirect to that tenant's login page with username prefilled?
    // User asked: "add name of business to be able to log in"
    // He implies doing it in one step.

    // Let's try "Smart Login":
    // 1. If slug is present: 
    //    - Verify slug exists (optional call to config or just redirect)
    //    - Redirect to `http://${slug}.localhost:3000/login`
    //    - Maybe pass `?username=...` for convenience?
    //    - RETURN "Redirecting..." to frontend.

    if (data.slug && data.slug.toString().trim() !== '') {
        const slug = data.slug.toString().trim();

        const headerStore = await import('next/headers');
        const headersList = await headerStore.headers();
        const host = headersList.get('host') || "";

        // CHECK IF HOST IS AN IP ADDRESS (IPv4)
        const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?$/.test(host);

        if (isIp) {
            // WE ARE ON AN IP ADDRESS via direct access (e.g. http://91.99.186.183:3000)
            // We CANNOT redirect to saas.91.99.186.183
            // So we skip the redirection and allow the login to proceed on this host.
            // The user will just stay on the IP.
            console.log(`[AUTH] IP Address detected (${host}). Skipping subdomain redirect for slug: ${slug}`);
        }
        else {
            // Domain-based logic (localhost or production domain)
            const baseDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_CONFIG.domain;
            let protocol = "http";

            // Prefer HTTPS if header says so, or on production domain (never on localhost)
            const isLocalhost = host.includes('localhost');
            if (headersList.get('x-forwarded-proto') === 'https' || (!isLocalhost && (host.includes(baseDomain) || host.includes('vercel.app')))) {
                protocol = "https";
            }

            let newHost = "";
            if (host.includes('localhost')) {
                newHost = `${slug}.localhost:3000`;
            } else {
                const baseDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || PLATFORM_CONFIG.domain;
                // Avoid double-slugging
                if (host.includes(baseDomain) && !host.startsWith('www')) {
                    // Already on a subdomain? Replacing it is safer.
                    newHost = `${slug}.${baseDomain}`;
                } else {
                    newHost = `${slug}.${baseDomain}`;
                }
            }

            // Only redirect if we are not already on that host
            if (host !== newHost) {
                redirect(`${protocol}://${newHost}/login?u=${btoa(data.username as string)}`);
                return;
            }
        }
    }

    // Normal Login (Tenant Context detected or ignored)
    const validated = LoginSchema.safeParse(data)

    if (!validated.success) {
        return { error: validated.error.flatten().fieldErrors }
    }

    const { username, password } = validated.data
    const { erpFetch } = await import("@/lib/erp-api")

    try {
        const responseData = await erpFetch('auth/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                site_id: data.site_id
            }),
        })

        const token = responseData.token
        const scopeAccess = responseData.scope_access || 'internal'
        const hStore = await import('next/headers');
        const hList = await hStore.headers();
        const isSecure = hList.get('x-forwarded-proto') === 'https';

        const cookieStore = await cookies()
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days session for better DX
        })
        // Store scope access level (official-only or full internal access)
        cookieStore.set('scope_access', scopeAccess, {
            httpOnly: false,  // Frontend needs to read this
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        })
        console.log(`[AUTH_ACTION] Cookie set successfully (Secure: ${isSecure}, Scope: ${scopeAccess}) for token: ${token.substring(0, 5)}...`);

    } catch (error: any) {
        console.error('Login Tactical Error:', error)
        let message = `${PLATFORM_CONFIG.name} Uplink Failure`
        try {
            const errData = JSON.parse(error.message)
            if (errData.non_field_errors) message = errData.non_field_errors[0]
            else if (errData.detail) message = errData.detail
            else if (errData.error) message = errData.error
        } catch (e) {
            message = error.message || 'Service unavailable'
        }
        return { error: { root: [message] } }
    }

    const headerStore = await import('next/headers');
    const hList = await headerStore.headers();
    const host = hList.get('host') || '';

    // FIX: Use PUBLIC URLs, not internal file paths
    if (data.slug === 'saas' || host.includes('saas')) {
        // Middleware maps /saas/* -> /saas/*
        redirect('/dashboard')
    } else {
        // Tenants: Redirect to root. 
        // If on subdomain: / -> /tenant/[slug]/page
        // If on IP: This will go to Landing. Tenants via IP need full path support which is out of scope for login action.
        redirect('/')
    }
}

export async function logoutAction() {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000'

    if (token) {
        try {
            await fetch(`${djangoUrl}/api/auth/logout/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
            })
        } catch (e) { }
    }

    cookieStore.delete('auth_token')
    cookieStore.delete('scope_access')
    redirect('/login')
}

/**
 * React.cache() deduplicates calls within a single server render.
 * Multiple layouts calling getUser() in the same request → only 1 API call.
 */
export const getUser = cache(async function getUser() {
    const { erpFetch } = await import("@/lib/erp-api")
    try {
        const user = await erpFetch('auth/me/')
        return user
    } catch (error: any) {
        // Robust check for session expiry / invalid credentials
        const msg = error.message?.toLowerCase() || '';
        const isAuthError =
            msg.includes('401') ||
            msg.includes('403') ||
            msg.includes('invalid token') ||
            msg.includes('credentials') ||
            msg.includes('unauthorized') ||
            msg.includes('not provided');

        if (isAuthError) {
            return null;
        }

        // Otherwise throw so layout can show "Reconnecting" or error boundary
        // This handles cases where the backend is down (ECONNREFUSED) or returning 500
        throw error;
    }
})
