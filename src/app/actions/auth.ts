'use server'

export async function meAction() {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/me/')
}

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { PLATFORM_CONFIG } from '@/lib/saas_config'
import { ErpApiError } from '@/lib/erp-api'

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
            // IP address detected — skip subdomain redirect
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
                redirect(`${protocol}://${newHost}/login`);
                return;
            }
        }
    }

    // ── 2FA Challenge Resolution (Step 2) ──────────────────────────────────────
    // When challenge_id is present, the user already authenticated in step 1.
    // Credentials are stored server-side — only challenge_id + OTP needed.
    if (data.challenge_id && data.challenge_id.toString().trim() !== '') {
        const { erpFetch } = await import("@/lib/erp-api")
        try {
            const responseData = await erpFetch('auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge_id: data.challenge_id,
                    otp_token: data.otp_token
                }),
            })

            const token = responseData.token
            const scopeAccess = responseData.scope_access || 'internal'
            const hStore = await import('next/headers');
            const hList = await hStore.headers();
            const isSecure = hList.get('x-forwarded-proto') === 'https';
            const host2 = hList.get('host') || '';
            const isLocal = host2.includes('localhost');
            const cookieDomain = isLocal ? undefined : `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tsf.ci'}`;

            const cookieStore = await cookies()
            cookieStore.set('auth_token', token, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
                ...(cookieDomain && { domain: cookieDomain }),
            })
            cookieStore.set('scope_access', scopeAccess, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
                ...(cookieDomain && { domain: cookieDomain }),
            })
        } catch (error: any) {
            let message = 'Verification failed'
            try {
                const errData = JSON.parse(error.message)
                if (errData.error) message = errData.error
                else if (errData.detail) message = errData.detail
            } catch (e) {
                message = error.message || 'Service unavailable'
            }
            return { error: { root: [message] } }
        }

        // Redirect after successful 2FA
        const headerStore = await import('next/headers');
        const hList = await headerStore.headers();
        const host = hList.get('host') || '';
        if (data.slug === 'saas' || host.includes('saas')) {
            redirect('/dashboard')
        } else {
            redirect('/')
        }
    }

    // ── Normal Login (Step 1) ────────────────────────────────────────────────
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
                site_id: data.site_id,
                otp_token: data.otp_token
            }),
        })

        if (responseData.two_factor_required) {
            return {
                two_factor_required: true,
                message: responseData.message,
                challenge_id: responseData.challenge_id,
                _username: username,
                _slug: data.slug
            }
        }

        const token = responseData.token
        const scopeAccess = responseData.scope_access || 'internal'
        const hStore = await import('next/headers');
        const hList = await hStore.headers();
        const isSecure = hList.get('x-forwarded-proto') === 'https';
        const host = hList.get('host') || '';

        // Shared cookie domain: .tsf.ci allows auth across all subdomains
        const isLocalhost = host.includes('localhost');
        const cookieDomain = isLocalhost ? undefined : `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tsf.ci'}`;

        const cookieStore = await cookies()
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            ...(cookieDomain && { domain: cookieDomain }),
        })
        cookieStore.set('scope_access', scopeAccess, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            ...(cookieDomain && { domain: cookieDomain }),
        })

    } catch (error: any) {
        console.error('Login Tactical Error:', error)
        let message = `${PLATFORM_CONFIG.name} Login Failed`
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
        } catch (e) { console.error('Logout backend call failed (non-blocking):', e) }
    }

    cookieStore.delete('auth_token')
    cookieStore.delete('scope_access')
    redirect('/')
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
            (error instanceof ErpApiError && (error.status === 401 || error.status === 403)) ||
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

/**
 * Notifications
 */
export async function getNotifications() {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('notifications/')
}

export async function markNotificationAsRead(id: number) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch(`notifications/${id}/mark-read/`, { method: 'POST' })
}

export async function markAllNotificationsRead() {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('notifications/mark-all-read/', { method: 'POST' })
}

/**
 * Password Reset
 */
export async function requestPasswordResetAction(email: string) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/password-reset/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
}

const PasswordResetSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
})

export async function confirmPasswordResetAction(data: any) {
    const validated = PasswordResetSchema.safeParse(data)
    if (!validated.success) {
        throw new Error(validated.error.issues[0]?.message || 'Invalid input')
    }
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/password-reset/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.data)
    })
}

/**
 * User Admin (Approval Workflow)
 */
export async function getPendingUsers() {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('users/?registration_status=PENDING')
}

export async function approveUserAction(id: number) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch(`users/${id}/approve/`, { method: 'POST' })
}

export async function rejectUserAction(id: number) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch(`users/${id}/reject/`, { method: 'POST' })
}

export async function requestCorrectionAction(id: number, notes: string) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch(`users/${id}/request-correction/`, {
        method: 'POST',
        body: JSON.stringify({ notes })
    })
}

// ── Two-Factor Authentication (2FA) ──────────────────────────────────────────

export async function setup2FAAction() {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/2fa/setup/', {
        method: 'POST'
    })
}

export async function verify2FAAction(token: string) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/2fa/verify/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
}

export async function disable2FAAction(token: string) {
    const { erpFetch } = await import("@/lib/erp-api")
    return erpFetch('auth/2fa/disable/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
}
